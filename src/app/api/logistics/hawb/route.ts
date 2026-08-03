import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const LG_ROLES = ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "ADMIN"]

// Cross-document HAWB. Unlike /api/requests/[id]/hawb (single doc), this accepts SOs that span several
// documents and shares ONE Total Air across all of them: costPerPc = totalCharge ÷ Σqty(all selected).
// Each SO's actualAirFreight = costPerPc × its qty. A per-document HawbGroup row is still created (the
// model is doc-scoped) holding that doc's share of the total; the SOs are tied together by hawbNo string.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const roles: string[] = [role, ...(((session.user as any).roles) || [])]
  if (!roles.some(r => LG_ROLES.includes(r))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // items: [{ id, invoiceNo }] — may span documents.
  const { hawbNo, totalCharge, items: itemInput } = await req.json()
  const charge = Number(totalCharge)
  if (!hawbNo || !charge || charge <= 0 || !Array.isArray(itemInput) || itemInput.length === 0) {
    return NextResponse.json({ error: "hawbNo, totalCharge, items required" }, { status: 400 })
  }
  const invById: Record<string, string> = {}
  const ids: string[] = []
  for (const x of itemInput) { if (x?.id) { ids.push(String(x.id)); if (x.invoiceNo) invById[String(x.id)] = String(x.invoiceNo) } }

  const items = await prisma.airRequestItem.findMany({ where: { id: { in: ids }, itemStatus: "PRES_PASSED" } })
  if (items.length === 0) return NextResponse.json({ error: "Selected SO not found (or already booked)" }, { status: 400 })

  const totalQty = items.reduce((s, i) => s + (i.qtyActualShip ?? i.qtyRequestAir), 0)
  if (totalQty === 0) return NextResponse.json({ error: "Total QTY is 0" }, { status: 400 })
  const costPerPc = charge / totalQty

  // Group by document → one HawbGroup per doc, each holding that doc's proportional share of the total.
  const byDoc: Record<string, typeof items> = {}
  for (const it of items) (byDoc[it.requestId] ||= []).push(it)

  for (const [requestId, docItems] of Object.entries(byDoc)) {
    const docShare = docItems.reduce((s, i) => s + costPerPc * (i.qtyActualShip ?? i.qtyRequestAir), 0)
    await prisma.hawbGroup.create({
      data: { requestId, hawbNo, totalCharge: parseFloat(docShare.toFixed(2)), items: { connect: docItems.map(i => ({ id: i.id })) } },
    })
    for (const it of docItems) {
      const qty = it.qtyActualShip ?? it.qtyRequestAir
      const inv = invById[it.id]
      await prisma.airRequestItem.update({
        where: { id: it.id },
        data: { actualAirFreight: parseFloat((costPerPc * qty).toFixed(2)), hawbNo, ...(inv ? { invoiceNo: inv } : {}) },
      })
    }
  }

  return NextResponse.json({ ok: true, docs: Object.keys(byDoc).length, sos: items.length, costPerPc })
}

// Delete a cross-document HAWB by its hawbNo — removes every per-doc HawbGroup row that shares it and
// resets the SOs (clears actual / hawbNo) so they return to the "without HAWB" pool.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const roles: string[] = [role, ...(((session.user as any).roles) || [])]
  if (!roles.some(r => LG_ROLES.includes(r))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { hawbNo } = await req.json()
  if (!hawbNo) return NextResponse.json({ error: "hawbNo required" }, { status: 400 })

  const groups = await prisma.hawbGroup.findMany({ where: { hawbNo: String(hawbNo) }, select: { id: true } })
  await prisma.airRequestItem.updateMany({
    where: { hawbNo: String(hawbNo) },
    data: { hawbGroupId: null, actualAirFreight: null, hawbNo: null },
  })
  if (groups.length) await prisma.hawbGroup.deleteMany({ where: { id: { in: groups.map(g => g.id) } } })
  return NextResponse.json({ ok: true, removed: groups.length })
}
