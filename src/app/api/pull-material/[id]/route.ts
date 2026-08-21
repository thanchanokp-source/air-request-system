import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Valid lifecycle statuses (in order).
// Flow: Purchase enters country/incoterm/weight FIRST, then Logistics computes freight,
// then SCM decides air per-line, then Approval.
export const PULL_FLOW = [
  "PENDING_PURCHASING",
  "PENDING_LOGISTICS",
  "PENDING_SCM_DECISION",
  "PENDING_APPROVAL",
  "APPROVED",
  "COMPLETED",
] as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const request = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, include: { items: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ request })
}

// Update item fields (LG / Purchase / SCM decision) and/or advance the request status.
// body: { itemUpdates?: [{ id, ...fields }], status?: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v))
  const dt = (v: any) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d }
  const FIELD: Record<string, (v: any) => any> = {
    // Logistics
    inHouseAirDate: dt, inHouseSeaDate: dt, estAir: num, estSea: num,
    leadTimeAir: (v) => v || null, leadTimeSea: (v) => v || null,
    airFreightCost: num, seaFreightCost: num, incotermCost: num,
    // Purchase
    weight: num, weightGenerated: num, grossWeightKg: num, shipmentDate: dt,
    country: (v) => v || null, incoterm: (v) => v || null,
    // SCM decision
    airDecision: (v) => v || null,
    reasonAirPick: (v) => v || null,
    sewingStartDate: dt,
    // LG actual
    invoiceNo: (v) => v || null, actualAir: num,
  }

  const itemUpdates: any[] = Array.isArray(body.itemUpdates) ? body.itemUpdates : []
  for (const u of itemUpdates) {
    if (!u?.id) continue
    const data: any = {}
    for (const [k, conv] of Object.entries(FIELD)) if (k in u) data[k] = conv(u[k])
    if (Object.keys(data).length) await (prisma as any).pullMaterialItem.update({ where: { id: u.id }, data })
  }

  if (body.status && (PULL_FLOW as readonly string[]).concat(["NO_AIR"]).includes(body.status)) {
    await (prisma as any).pullMaterialRequest.update({ where: { id }, data: { status: body.status } })
  }

  const request = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, include: { items: true } })
  return NextResponse.json({ request })
}

// Delete a request — allowed only for the creator (or an admin). Items cascade.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const userId = (session.user as any).id
  const isAdmin = (session.user as any).role === "ADMIN"
  const rq = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, select: { createdById: true } })
  if (!rq) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!isAdmin && rq.createdById !== userId) return NextResponse.json({ error: "Forbidden — creator only" }, { status: 403 })
  await (prisma as any).pullMaterialRequest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
