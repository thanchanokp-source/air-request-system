import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { notifyPullStage } from "@/lib/pull-notify"
import { recomputePullAir } from "@/lib/pull-freight"
import { magicLoginFor } from "@/lib/notify"

// TEST doc → all its emails reroute to the creator (monitor copy, "meant for"), like Air Request.
async function pullTestRecipient(id: string): Promise<string | null> {
  // PullMaterialRequest has no `createdBy` relation (only createdById) — look the creator up by id.
  const r = await (prisma as any).pullMaterialRequest.findUnique({
    where: { id }, select: { isTest: true, createdById: true, requesterEmail: true },
  }).catch(() => null)
  if (!r?.isTest) return null
  const u = r.createdById ? await (prisma.user as any).findUnique({ where: { id: r.createdById }, select: { email: true } }).catch(() => null) : null
  return u?.email || r.requesterEmail || null
}

// Valid lifecycle statuses (in order).
// Flow: Purchase enters country/incoterm/weight FIRST, then Logistics computes freight,
// then SCM decides air per-line, then Approval.
// Two branches after Logistics, chosen by requestType:
//  SCM  : … → PENDING_SCM_DECISION → PENDING_DVM_SCM → PENDING_VP_SCM → PENDING_FINAL (K.Khomkrit) → APPROVED
//  PC   : … → PENDING_PC_DECISION  → PENDING_DVM_PUR → PENDING_VP_PUR → APPROVED
const PULL_FLOW = [
  "PENDING_PURCHASING",
  "PENDING_LOGISTICS",
  // SCM branch
  "PENDING_SCM_DECISION",
  "PENDING_DVM_SCM",
  "PENDING_VP_SCM",
  "PENDING_FINAL",
  // PC branch
  "PENDING_PC_DECISION",
  "PENDING_DVM_PUR",
  "PENDING_VP_PUR",
  // legacy single approval step (older docs) + terminal
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
    pickupAddress: (v) => v || null, needDate: dt, cartons: num, boxW: num, boxL: num, boxH: num,
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

  // Toggle Regular / Irregular mode per doc (no status change needed).
  if (body.mode === "REGULAR" || body.mode === "IRREGULAR") {
    await (prisma as any).pullMaterialRequest.update({ where: { id }, data: { mode: body.mode } })
  }

  if (body.status && (PULL_FLOW as readonly string[]).concat(["NO_AIR", "RECALLED", "REJECTED"]).includes(body.status)) {
    const data: any = { status: body.status }
    const isStop = body.status === "RECALLED" || body.status === "REJECTED"

    if (isStop) {
      const reason = String((body.status === "REJECTED" ? body.rejectReason : body.recallReason) || "").trim()
      if (!reason) return NextResponse.json({ error: "reason required" }, { status: 400 })
      data.recallReason = reason
      data.recalledBy = actorEmail || null
    } else if (actorEmail) {
      // Record everyone who acted on the doc (PC/LG/SCM) — they get notified on recall/reject.
      const cur = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, select: { actors: true } })
      const set = new Set<string>([...(cur?.actors || []), actorEmail])
      data.actors = [...set]
    }

    await (prisma as any).pullMaterialRequest.update({ where: { id }, data })

    // Purchasing → air decision: auto-compute Est Air + Air L/T from the master (no manual LG step).
    if (body.status === "PENDING_SCM_DECISION" || body.status === "PENDING_PC_DECISION") {
      await recomputePullAir(id).catch(() => {})
    }

    // Alert the owner(s) of the NEW stage (magic-link per person). Covers every forward transition:
    // Logistics, SCM/PC decision, VP SCM, President, DVM/VP Purchasing, and APPROVED (→ requester).
    if (!isStop) await notifyPullStage(id, body.status).catch(() => {})

    if (isStop) {
      const word = body.status === "REJECTED" ? "Rejected" : "Recalled"
      const rq = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, include: { items: true } })
      // Notify the whole chain (everyone who acted) + the requester.
      const recipients = [...new Set([...(rq.actors || []), rq.requesterEmail].filter(Boolean))].filter((e) => e !== actorEmail)
      if (recipients.length) {
        const sos = [...new Set((rq.items || []).map((i: any) => i.soNoDoc).filter(Boolean))].join(", ")
        const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
          <h2 style="color:#b45309;margin:0 0 10px">Pull Material ${word}</h2>
          <p><b>${rq.documentNo}</b> (${rq.bu}) has been <b>${word.toLowerCase()}</b> and withdrawn from the flow.</p>
          <table style="border-collapse:collapse;font-size:13px">
            <tr><td style="padding:2px 10px 2px 0;color:#666">${word} by</td><td>${data.recalledBy || "-"}</td></tr>
            <tr><td style="padding:2px 10px 2px 0;color:#666">Reason</td><td><b>${data.recallReason}</b></td></tr>
            <tr><td style="padding:2px 10px 2px 0;color:#666">SO</td><td>${sos || "-"}</td></tr>
            <tr><td style="padding:2px 10px 2px 0;color:#666">Requester</td><td>${rq.requesterName}</td></tr>
          </table>
          <p style="color:#888;font-size:12px;margin-top:12px">No further action is needed on this document.</p>
        </div>`
        await runWithTestMail(await pullTestRecipient(id), () =>
          sendMail(recipients as string[], `Pull Material ${word} — ${rq.documentNo}`, html)).catch(() => {})
      }
      return NextResponse.json({ request: rq })
    }
  }

  // Purchase flagged a port/country NOT in the freight master → email Logistics Import a magic link
  // straight to MASTER RATE with the missing port(s) pre-created as draft rows → LG just fills numbers.
  if (Array.isArray(body.otherPorts) && body.otherPorts.length) {
    const rq = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, select: { documentNo: true, bu: true } })
    const bu = rq?.bu || "NYG"
    const lgUsers = await (prisma.user as any).findMany({
      where: { isActive: true, OR: [{ role: "LOGISTICS_IMPORT" }, { roles: { has: "LOGISTICS_IMPORT" } }] },
      select: { id: true, email: true },
    })
    const seenU = new Set<string>()
    const recips = lgUsers.filter((u: any) => u.email && !seenU.has(u.email.toLowerCase()) && seenU.add(u.email.toLowerCase()))
    if (recips.length) {
      // Prefill entries for the rates page (dedup): one per air port + one per sea port.
      const pf: { type: string; country: string; port: string }[] = []
      const seenPf = new Set<string>()
      for (const p of body.otherPorts) {
        if (p.port) { const k = `air|${p.country}|${p.port}`; if (!seenPf.has(k)) { seenPf.add(k); pf.push({ type: "air", country: p.country || "", port: p.port }) } }
        if (p.seaPort) { const k = `sea|${p.country}|${p.seaPort}`; if (!seenPf.has(k)) { seenPf.add(k); pf.push({ type: "sea", country: p.country || "", port: p.seaPort }) } }
      }
      const rows = body.otherPorts.map((p: any) =>
        `<tr><td style="padding:3px 12px 3px 0;color:#666">SO ${p.so || "-"}</td><td style="padding:3px 12px 3px 0"><b>${p.country || "-"}</b>${p.newCountry ? ' <span style="color:#b45309">(new)</span>' : ""}</td><td>${[p.port ? "✈ " + p.port : "", p.seaPort ? "🚢 " + p.seaPort : ""].filter(Boolean).join(" · ") || "-"}</td></tr>`
      ).join("")
      const redirect = `/pull-material/rates?prefill=${encodeURIComponent(JSON.stringify(pf))}`
      await runWithTestMail(await pullTestRecipient(id), async () => {
        for (const u of recips) {
          const link = await magicLoginFor(u.id, redirect)
          const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
            <h2 style="color:#b45309;margin:0 0 10px">Pull Material — new port needs a rate</h2>
            <p>Purchase selected a port/country <b>not in the freight master</b> on <b>${rq?.documentNo}</b> (${bu}).<br/>Click below → the port is pre-created in <b>MASTER RATE</b>; just fill the rate numbers and Save.</p>
            <table style="border-collapse:collapse;font-size:13px;margin-top:6px">
              <tr><td style="color:#999;padding-right:12px">SO</td><td style="color:#999;padding-right:12px">Country</td><td style="color:#999">Port</td></tr>
              ${rows}
            </table>
            <p style="margin-top:14px"><a href="${link}" style="background:#b45309;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;display:inline-block">Add rate in Master Rate →</a></p>
            <p style="color:#9ca3af;font-size:12px;margin-top:12px">This link logs you in automatically and opens the port ready to fill.</p>
          </div>`
          await sendMail([u.email], `Pull Material — add missing port rate (${rq?.documentNo})`, html).catch(() => {})
        }
      }).catch(() => {})
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
