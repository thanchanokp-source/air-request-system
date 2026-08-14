import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Reconcile ONE SO into shipment lines (split by INV). Each shipment = 1 Invoice No + HAWB# + its own
// shipped qty (qtyActualShip). Called by the LG split-template import, per (document, SO).
//
// Model: every shipment row COPIES the SO's full plan (qtyRequestAir / orig / EST / gross) + claim
// (claimDepts / dept / % / status) so the plan stays visible when filtering by any INV and the claim
// routing is unaffected. All shipments of the SO share `shipmentGroupId` → plan TOTALS count the group
// once (no double). Idempotent: re-import matches by SO + INV, so it updates instead of duplicating.
const LG_ROLES = ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "LOGISTICS_SUB"]

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const roles: string[] = [role, ...(((session.user as any).roles) || [])]
  if (role !== "ADMIN" && !roles.some(r => LG_ROLES.includes(r))) {
    return NextResponse.json({ error: "Only Logistics or Admin can split a shipment" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const so: string = String(body.so || "").trim()
  const sub: string = String(body.sub ?? "").trim()
  const shipments: { invoiceNo?: string; hawbNo?: string; qtyShip?: any }[] = Array.isArray(body.shipments) ? body.shipments : []
  if (!so || shipments.length === 0) return NextResponse.json({ error: "Provide SO + shipments" }, { status: 400 })

  const existing = await prisma.airRequestItem.findMany({ where: { requestId: id, so } })
  const scoped = sub ? existing.filter(i => (i.sub || "") === sub) : existing
  const template = scoped[0]
  if (!template) return NextResponse.json({ error: `SO ${so} not found in this document` }, { status: 404 })
  const groupId = template.id

  // Fields copied onto every new shipment row (plan + claim inherited verbatim).
  const inherit = (t: any) => ({
    requestId: t.requestId, style: t.style, so: t.so, brand: t.brand, sub: t.sub, customerPO: t.customerPO,
    description: t.description, gmtType: t.gmtType, originalShipmentDate: t.originalShipmentDate,
    planShipmentDate: t.planShipmentDate, qtyOriginalShipment: t.qtyOriginalShipment, qtyRequestAir: t.qtyRequestAir,
    airFreight: t.airFreight, grossWeight: t.grossWeight, reasonDelay: t.reasonDelay, factory: t.factory,
    country: t.country, port: t.port, marketRatePerKg: t.marketRatePerKg, itemStatus: t.itemStatus,
    itemComment: t.itemComment, assignedDvm: t.assignedDvm, claimDepartment: t.claimDepartment,
    claimDepts: t.claimDepts as any, claimPercentage: t.claimPercentage,
  })

  const isGroup = shipments.length > 1
  let created = 0, updated = 0
  const unmatched = [...scoped]

  await prisma.$transaction(async (tx) => {
    for (const s of shipments) {
      const inv = String(s.invoiceNo || "").trim() || null
      const hawb = String(s.hawbNo || "").trim() || null
      const qtyShip = Math.round(Number(s.qtyShip) || 0) || null
      // Match an existing row by INV; else reuse a still-un-invoiced existing row; else create.
      let match = inv ? unmatched.find(i => (i.invoiceNo || "") === inv) : undefined
      if (!match) match = unmatched.find(i => !i.invoiceNo)
      const data = { invoiceNo: inv, hawbNo: hawb, qtyActualShip: qtyShip, shipmentGroupId: isGroup ? groupId : (unmatched.length ? null : null) }
      if (match) {
        await tx.airRequestItem.update({ where: { id: match.id }, data: data as any })
        unmatched.splice(unmatched.indexOf(match), 1)
        updated++
      } else {
        await tx.airRequestItem.create({ data: { ...inherit(template), ...data } as any })
        created++
      }
    }
    // Ensure the group marker is on ALL of this SO's shipment rows (so plan totals dedupe correctly).
    if (isGroup) await tx.airRequestItem.updateMany({ where: { requestId: id, so, ...(sub ? { sub } : {}) }, data: { shipmentGroupId: groupId } })
  })

  return NextResponse.json({ ok: true, so, created, updated })
}
