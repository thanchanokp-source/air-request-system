import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"

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
    country: (v) => v || null, incoterm: (v) => v || null, port: (v) => v || null, seaPort: (v) => v || null,
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

  const actorEmail = (session.user as any).email as string | undefined

  if (body.status && (PULL_FLOW as readonly string[]).concat(["NO_AIR", "RECALLED"]).includes(body.status)) {
    const data: any = { status: body.status }

    if (body.status === "RECALLED") {
      const reason = String(body.recallReason || "").trim()
      if (!reason) return NextResponse.json({ error: "recallReason required" }, { status: 400 })
      data.recallReason = reason
      data.recalledBy = actorEmail || null
    } else if (actorEmail) {
      // Record everyone who acted on the doc (PC/LG/SCM) — they get notified on recall.
      const cur = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, select: { actors: true } })
      const set = new Set<string>([...(cur?.actors || []), actorEmail])
      data.actors = [...set]
    }

    await (prisma as any).pullMaterialRequest.update({ where: { id }, data })

    if (body.status === "RECALLED") {
      const rq = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, include: { items: true } })
      // Notify the whole chain (everyone who acted) + the requester.
      const recipients = [...new Set([...(rq.actors || []), rq.requesterEmail].filter(Boolean))].filter((e) => e !== actorEmail)
      if (recipients.length) {
        const sos = [...new Set((rq.items || []).map((i: any) => i.soNoDoc).filter(Boolean))].join(", ")
        const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
          <h2 style="color:#b45309;margin:0 0 10px">Pull Material Recalled</h2>
          <p><b>${rq.documentNo}</b> (${rq.bu}) has been <b>recalled</b> and withdrawn from the flow.</p>
          <table style="border-collapse:collapse;font-size:13px">
            <tr><td style="padding:2px 10px 2px 0;color:#666">Recalled by</td><td>${data.recalledBy || "-"}</td></tr>
            <tr><td style="padding:2px 10px 2px 0;color:#666">Reason</td><td><b>${data.recallReason}</b></td></tr>
            <tr><td style="padding:2px 10px 2px 0;color:#666">SO</td><td>${sos || "-"}</td></tr>
            <tr><td style="padding:2px 10px 2px 0;color:#666">Requester</td><td>${rq.requesterName}</td></tr>
          </table>
          <p style="color:#888;font-size:12px;margin-top:12px">No further action is needed on this document.</p>
        </div>`
        sendMail(recipients as string[], `Pull Material Recalled — ${rq.documentNo}`, html).catch(() => {})
      }
      return NextResponse.json({ request: rq })
    }
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
