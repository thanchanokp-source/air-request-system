import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Split ONE SO (item) into several shipments — used when a container is full and the SO must ship in
// more than one lot, each with its OWN Invoice No + HAWB# + qty. Shipment #1 REUSES the original item;
// the rest are NEW items that INHERIT the parent's claim data (claimDepts / claimDepartment /
// claimPercentage) and all descriptive fields, so the claim approval routing is unchanged — the new
// shipments belong to the same claim department(s) and carry the same approved status.
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
  const itemId: string = body.itemId
  const shipments: { qty: number; invoiceNo?: string; hawbNo?: string }[] = Array.isArray(body.shipments) ? body.shipments : []
  if (!itemId || shipments.length < 2) {
    return NextResponse.json({ error: "Provide an itemId and at least 2 shipments" }, { status: 400 })
  }

  const parent = await prisma.airRequestItem.findUnique({ where: { id: itemId } })
  if (!parent || parent.requestId !== id) return NextResponse.json({ error: "SO not found in this document" }, { status: 404 })

  const qtys = shipments.map(s => Math.round(Number(s.qty) || 0))
  if (qtys.some(q => q <= 0)) return NextResponse.json({ error: "Every shipment needs a qty > 0" }, { status: 400 })
  const sumQty = qtys.reduce((a, b) => a + b, 0)
  const origQty = parent.qtyRequestAir || sumQty
  // Split EST air freight + gross weight proportionally by qty share; actual comes later from the HAWB.
  const est = Number(parent.airFreight) || 0
  const gross = Number(parent.grossWeight) || 0
  const share = (q: number, total: number) => (origQty > 0 ? Math.round((total * q / origQty) * 100) / 100 : 0)

  const shipAt = (i: number) => ({
    qtyRequestAir: qtys[i],
    invoiceNo: shipments[i].invoiceNo?.trim() || null,
    hawbNo: shipments[i].hawbNo?.trim() || null,
    airFreight: share(qtys[i], est),
    grossWeight: share(qtys[i], gross),
    actualAirFreight: null,
  })

  await prisma.$transaction(async (tx) => {
    // Shipment #1 reuses the original row.
    await tx.airRequestItem.update({ where: { id: parent.id }, data: shipAt(0) as any })
    // Shipments #2..N — new rows copying the parent (claim + descriptive fields inherited verbatim).
    for (let i = 1; i < shipments.length; i++) {
      await tx.airRequestItem.create({
        data: {
          requestId: parent.requestId,
          style: parent.style,
          so: parent.so,
          brand: parent.brand,
          sub: parent.sub,
          customerPO: parent.customerPO,
          description: parent.description,
          gmtType: parent.gmtType,
          originalShipmentDate: parent.originalShipmentDate,
          planShipmentDate: parent.planShipmentDate,
          qtyOriginalShipment: parent.qtyOriginalShipment,
          reasonDelay: parent.reasonDelay,
          factory: parent.factory,
          country: parent.country,
          port: parent.port,
          marketRatePerKg: parent.marketRatePerKg,
          itemStatus: parent.itemStatus,
          itemComment: parent.itemComment,
          assignedDvm: parent.assignedDvm,
          // Claim inherited verbatim → same dept(s)/%/status → approval routing unaffected.
          claimDepartment: parent.claimDepartment,
          claimDepts: parent.claimDepts as any,
          claimPercentage: parent.claimPercentage,
          ...shipAt(i),
        } as any,
      })
    }
  })

  const items = await prisma.airRequestItem.findMany({ where: { requestId: id, so: parent.so }, select: { id: true } })
  return NextResponse.json({ ok: true, so: parent.so, shipments: items.length })
}
