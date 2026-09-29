import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { notifyPullStage, notifyPullReturn, notifyShipModeChange } from "@/lib/pull-notify"
import { recomputePullAir } from "@/lib/pull-freight"
import { itemHasAnyRate } from "@/lib/pull-courier"
import { magicLoginFor } from "@/lib/notify"
import { pcApprover } from "@/lib/pull-approvers"

// Role holders that own each stage — used to notify the CURRENT owner when a doc is recalled/rejected.
const STAGE_ROLES: Record<string, string[]> = {
  PENDING_PURCHASING: ["PURCHASING"], PENDING_SCM_DECISION: ["SCM_PULL"], PENDING_PC_DECISION: ["PURCHASING"],
  PENDING_DVM_SCM: ["PULL_DVM_SCM"], PENDING_VP_SCM: ["VP_SCM"], PENDING_FINAL: ["PULL_PRESIDENT"],
  PENDING_DVM_PUR: ["DVM_PUR"], PENDING_VP_PUR: ["VP_PUR"], APPROVED: ["LOGISTICS_IMPORT"],
  PENDING_LG_RATE: ["LOGISTICS_IMPORT"], // no air master rate on submit → LG fills the rate before approval
  PC_REVISE: ["PURCHASING"], // LG returned the doc — Purchasing must fix files/data then send back
}

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
  "PENDING_LG_RATE", // LG fills a missing air master rate before the doc goes to approval
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
  "PC_REVISE", // LG returned to Purchasing to fix wrong attachment (bounces straight back, no re-approval)
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
    pickupAddress: (v) => v || null, needDate: dt, cartons: num, boxW: num, boxL: num, boxH: num, etc: dt,
    poPullQty: num, // PO PULL quantity entered by Purchasing (per PO line)
    // Purchasing may also fix the material name (MER/PPC lines sometimes arrive without one).
    itemName: (v) => v || null,
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
  // Edited purchase fields (country/port/weight/incoterm) → recompute Est Air.
  if (itemUpdates.length && itemUpdates.some((u: any) => "port" in u || "weight" in u || "incoterm" in u || "country" in u)) {
    await recomputePullAir(id).catch(() => {})
  }

  const actorEmail = (session.user as any).email as string | undefined
  const actorName = ((session.user as any).name || (session.user as any).title || "") as string

  // LG returns the doc to Purchasing (wrong attachment / files). Bounce straight to PC_REVISE — no approval
  // re-run — bump the revise counter, keep the reason, and alert the purchaser ("Revise #N").
  if (body.returnToPurchase) {
    const cur = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, select: { reviseCount: true } })
    const n = (cur?.reviseCount || 0) + 1
    await (prisma as any).pullMaterialRequest.update({
      where: { id }, data: { status: "PC_REVISE", lastReturnReason: String(body.returnReason || "").trim() || null, reviseCount: n },
    })
    await notifyPullReturn(id, n, String(body.returnReason || "").trim()).catch(() => {})
    return NextResponse.json({ ok: true, status: "PC_REVISE", reviseCount: n })
  }

  // Toggle Regular / Irregular mode per doc (no status change needed).
  if (body.mode === "REGULAR" || body.mode === "IRREGULAR") {
    await (prisma as any).pullMaterialRequest.update({ where: { id }, data: { mode: body.mode } })
  }

  // Purchasing forwards a doc to another purchaser (e.g. a pool doc with no PO owner) → reassign + re-alert.
  if (body.forwardTo) {
    const to = String(body.forwardTo).trim().toLowerCase()
    if (!/^[\w.+-]+@nanyangtextile\.com$/i.test(to)) return NextResponse.json({ error: "invalid purchaser email" }, { status: 400 })
    await (prisma as any).pullMaterialRequest.update({ where: { id }, data: { purchaserEmail: to } })
    await notifyPullStage(id, "PENDING_PURCHASING").catch(() => {})
    return NextResponse.json({ ok: true, forwardedTo: to })
  }

  // Edit (recalled doc): packages / remark at request level; Purchase packing-list filename.
  if ("packages" in body || "remark" in body || "packingListName" in body || "factory" in body) {
    await (prisma as any).pullMaterialRequest.update({
      where: { id },
      data: {
        ...("packages" in body ? { packages: Array.isArray(body.packages) && body.packages.length ? body.packages : undefined } : {}),
        ...("remark" in body ? { remark: body.remark || null } : {}),
        ...("packingListName" in body ? { packingListName: body.packingListName || null } : {}),
        ...("factory" in body ? { factory: body.factory || null } : {}),
      },
    })
  }

  // LG closes the doc ONCE (1 shipment / 1 doc): actual air freight + INV + HAWB at request level.
  if ("actualAir" in body || "invoiceNo" in body || "hawbNo" in body || "mawbNo" in body || "flightEtd" in body || "flightEta" in body || "cfmInHouseDate" in body || "poInvoices" in body || "localChargeTh" in body || "preCost" in body || "fwdRemark" in body || "actualSource" in body || "actualCurrency" in body || "fwdRateThbPerKg" in body) {
    await (prisma as any).pullMaterialRequest.update({
      where: { id },
      data: {
        ...("actualAir" in body ? { actualAir: num(body.actualAir) } : {}),
        ...("invoiceNo" in body ? { invoiceNo: body.invoiceNo || null } : {}),
        ...("hawbNo" in body ? { hawbNo: body.hawbNo || null } : {}),
        ...("mawbNo" in body ? { mawbNo: body.mawbNo || null } : {}),
        ...("flightEtd" in body ? { flightEtd: dt(body.flightEtd) } : {}),
        ...("flightEta" in body ? { flightEta: dt(body.flightEta) } : {}),
        ...("cfmInHouseDate" in body ? { cfmInHouseDate: dt(body.cfmInHouseDate) } : {}),
        ...("poInvoices" in body ? { poInvoices: body.poInvoices && typeof body.poInvoices === "object" ? body.poInvoices : undefined } : {}),
        ...("localChargeTh" in body ? { localChargeTh: num(body.localChargeTh) } : {}),
        ...("preCost" in body ? { preCost: num(body.preCost) } : {}),
        ...("preCostFwd" in body ? { preCostFwd: body.preCostFwd || null } : {}),
        // Phase 2 — values that came back from the forwarder's workbook (LG still reviews & saves).
        ...("fwdRemark" in body ? { fwdRemark: body.fwdRemark || null } : {}),
        ...("fwdRateThbPerKg" in body ? { fwdRateThbPerKg: num(body.fwdRateThbPerKg) } : {}),
        ...("actualCurrency" in body ? { actualCurrency: body.actualCurrency === "USD" ? "USD" : "THB" } : {}),
        ...("actualSource" in body ? {
          actualSource: body.actualSource === "FWD" ? "FWD" : "LG",
          ...(body.actualSource === "FWD" ? { fwdImportedAt: new Date(), fwdImportedBy: actorEmail || null } : {}),
        } : {}),
      },
    })
  }

  // ── Shipping mode (AIR / SEA / COURIER) ──────────────────────────────────────────────────────
  // The doc is ALWAYS raised as an AIR request by the user. The approver PICKS a mode at approval
  // (cheapest is only a suggestion — a non-AIR pick needs a reason); LG has the FINAL say and may
  // change it afterwards with NO re-approval. Every change is appended to PullShipModeLog together
  // with the landed cost of ALL modes at that moment, for later analysis.
  if (typeof body.shipMode === "string" && ["AIR", "SEA", "COURIER"].includes(body.shipMode)) {
    const src = body.shipModeSource === "LG" ? "LG" : "APPROVER"
    const est = body.shipModeEst || {}
    const reason = String(body.shipModeReason || "").trim() || null
    if (body.shipMode !== "AIR" && !reason) {
      return NextResponse.json({ error: "ผู้ขอร้องขอ AIR — เลือก mode อื่นต้องระบุเหตุผล" }, { status: 400 })
    }
    const cur = await (prisma as any).pullMaterialRequest.findUnique({
      where: { id },
      select: { shipMode: true, approvedMode: true, documentNo: true, bu: true },
    })
    const prev = cur?.shipMode || null
    await (prisma as any).pullMaterialRequest.update({
      where: { id },
      data: { shipMode: body.shipMode, shipModeBy: actorEmail || null, shipModeAt: new Date(), shipModeSource: src, shipModeReason: reason },
    })
    await (prisma as any).pullShipModeLog.create({
      data: {
        requestId: id, documentNo: cur?.documentNo || null, bu: cur?.bu || null,
        brand: est.brand || null, port: est.port || null, seaPort: est.seaPort || null, weightKg: num(est.weightKg),
        chosenMode: body.shipMode, prevMode: prev, carrier: est.carrier || null,
        estAir: num(est.estAir), estSea: num(est.estSea), estCourier: num(est.estCourier), chosenEst: num(est.chosenEst),
        reason, source: src, chosenBy: actorEmail || null,
      },
    }).catch(() => {})
    // LG overruled what was approved → tell the approver and the doc owners (no re-approval needed).
    if (src === "LG" && cur?.approvedMode && cur.approvedMode !== body.shipMode) {
      await notifyShipModeChange(id, cur.approvedMode, body.shipMode, actorName || actorEmail || "LG", reason).catch(() => {})
    }
  }

  if (body.status && (PULL_FLOW as readonly string[]).concat(["NO_AIR", "RECALLED", "REJECTED"]).includes(body.status)) {
    const data: any = { status: body.status }
    const isStop = body.status === "RECALLED" || body.status === "REJECTED"
    // The stage the doc is on BEFORE this change (lost after the update) — used to alert the current owner on recall.
    const before = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, select: { status: true, bu: true } })

    // Attribute the doc to the purchaser when Purchasing submits it forward or re-submits after a return —
    // powers the "who gets revised most" tracking.
    if ((before?.status === "PENDING_PURCHASING" || before?.status === "PC_REVISE") && actorEmail) {
      data.purchaserEmail = actorEmail
      data.purchaserName = actorName || actorEmail
    }

    // GATE: LG forwarding out of PENDING_LG_RATE → every line must have a rate in at least one mode
    // (air OR sea OR courier) before it can go to approval.
    if (before?.status === "PENDING_LG_RATE" && !isStop) {
      await recomputePullAir(id).catch(() => {})
      const [seaRows, courierRows] = await Promise.all([(prisma as any).pullFreightSea.findMany(), (prisma as any).pullFreightCourier.findMany()])
      const its = await (prisma as any).pullMaterialItem.findMany({ where: { requestId: id }, select: { airFreightCost: true, weight: true, port: true, seaPort: true } })
      const stillMissing = its.some((i: any) => i.port && Number(i.weight) > 0 && !itemHasAnyRate(i, seaRows, courierRows, before.bu))
      if (stillMissing) return NextResponse.json({ error: "ยังมี port ที่ไม่มี rate เลย (air/sea/courier) — เพิ่ม rate อย่างน้อย 1 mode ให้ครบก่อนส่งต่อ Approval" }, { status: 400 })
    }

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
      // Resubmit / any forward move → clear a prior recall so it re-enters the flow cleanly.
      data.recallReason = null
      data.recalledBy = null
    }

    // DVM Purchase approval → snapshot the approver's signature onto the doc (stamped in the PDF).
    // Approval also FREEZES the shipping mode that was approved + its landed cost (LG changes are
    // compared against this snapshot, so "LG changed Sea → Air" stays visible on the doc).
    if (body.status === "APPROVED") {
      const chosen = typeof body.shipMode === "string" ? body.shipMode : (await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, select: { shipMode: true } }))?.shipMode
      if (chosen) {
        data.approvedMode = chosen
        data.approvedEst = num(body.shipModeEst?.chosenEst)
      }
    }
    if (body.status === "APPROVED" && typeof body.signatureData === "string" && body.signatureData.startsWith("data:image")) {
      data.approverSignature = body.signatureData
      data.approverName = (session.user as any).name || actorEmail || null
      data.approvedAt = new Date()
    }

    await (prisma as any).pullMaterialRequest.update({ where: { id }, data })

    // Purchasing → air decision: auto-compute Est Air + Air L/T from the master (no manual LG step).
    // GATE: if a line still has NO rate in ANY mode (air/sea/courier) → auto-route to LG (PENDING_LG_RATE)
    // FIRST so LG fills a rate before it reaches approval — no one has to click "backfill" for new docs.
    if (body.status === "PENDING_SCM_DECISION" || body.status === "PENDING_PC_DECISION") {
      await recomputePullAir(id).catch(() => {})
      const [seaRows, courierRows] = await Promise.all([(prisma as any).pullFreightSea.findMany(), (prisma as any).pullFreightCourier.findMany()])
      const its = await (prisma as any).pullMaterialItem.findMany({ where: { requestId: id }, select: { airFreightCost: true, weight: true, port: true, seaPort: true } })
      const bu = before?.bu
      if (its.some((i: any) => i.port && Number(i.weight) > 0 && !itemHasAnyRate(i, seaRows, courierRows, bu))) {
        await (prisma as any).pullMaterialRequest.update({ where: { id }, data: { status: "PENDING_LG_RATE" } })
        await notifyPullStage(id, "PENDING_LG_RATE").catch(() => {})
        return NextResponse.json({ ok: true, status: "PENDING_LG_RATE", note: "no master rate → routed to LG" })
      }
    }

    // Alert the owner(s) of the NEW stage (magic-link per person). Covers every forward transition:
    // Logistics, SCM/PC decision, VP SCM, President, DVM/VP Purchasing, and APPROVED (→ requester).
    if (!isStop) await notifyPullStage(id, body.status).catch(() => {})

    if (isStop) {
      const word = body.status === "REJECTED" ? "Rejected" : "Recalled"
      const rq = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, include: { items: true } })
      // The person/role the doc was WAITING on (so they stop waiting) + everyone who acted + the requester.
      let stageEmails: string[] = []
      if (before?.status === "PENDING_VP_PUR") { const a = pcApprover(before.bu); if (a) stageEmails = [a] }
      else if (before?.status && STAGE_ROLES[before.status]) {
        const us = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: { in: STAGE_ROLES[before.status] } }, { roles: { hasSome: STAGE_ROLES[before.status] } }] }, select: { email: true } })
        stageEmails = us.map((u: any) => u.email).filter(Boolean)
      }
      const recipients = [...new Set([...(rq.actors || []), rq.requesterEmail, ...stageEmails].filter(Boolean))].filter((e) => e !== actorEmail)
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
