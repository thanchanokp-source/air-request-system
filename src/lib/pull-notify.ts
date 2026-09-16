import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { magicLoginFor } from "@/lib/notify"
import { pcApprover } from "@/lib/pull-approvers"

// LG alert routing (explicit people, not the whole LOGISTICS_IMPORT role):
//  • No-Master (fill Master rate) → wanna + krittamet
//  • Approved (enter actual air)   → nuttawut
const LG_NOMASTER_TO = ["wanna.p@nanyangtextile.com", "krittamet.h@nanyangtextile.com"]
const LG_ACTUAL_TO = ["nuttawut.t@nanyangtextile.com"]
const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || ""

// Per-stage recipient config for the Pull Material flow. Each entry = who to alert when a doc REACHES
// that status, and where their magic link should land. Covers BOTH branches (SCM / PC).
const STAGE: Record<string, { roles: string[]; redirect: string; title: string; cta: string }> = {
  PENDING_PURCHASING:   { roles: ["PURCHASING"],       redirect: "/pull-material/purchase",  title: "new request for Purchasing — fill Country / Port / Incoterm / Weight", cta: "Open Purchase queue" },
  PENDING_LOGISTICS:    { roles: ["LOGISTICS_IMPORT"], redirect: "/pull-material/logistics", title: "ready for Logistics — enter freight (Air rate / In-House date)", cta: "Open Logistics queue" },
  PENDING_LG_RATE:      { roles: ["LOGISTICS_IMPORT"], redirect: "/pull-material/documents",  title: "รอ LG เติม Air rate — port นี้ยังไม่มีใน Master Rate (ต้องเติมก่อนส่ง Approval)", cta: "Open LOGISTICS" },
  PENDING_SCM_DECISION: { roles: ["SCM_PULL"],         redirect: "/pull-material/request?tab=approve", title: "ready for SCM — confirm which lines go by AIR", cta: "Open SCM decision" },
  PENDING_PC_DECISION:  { roles: ["PURCHASING"],       redirect: "/pull-material/request?tab=approve", title: "ready for Purchase — decide which lines go by AIR", cta: "Open PC decision" },
  PENDING_DVM_SCM:      { roles: ["PULL_DVM_SCM"],      redirect: "/pull-material/approval",  title: "pending your approval — DVM SCM", cta: "Open Approval" },
  PENDING_VP_SCM:       { roles: ["VP_SCM"],           redirect: "/pull-material/approval",  title: "pending your approval — VP SCM", cta: "Open Approval" },
  PENDING_FINAL:        { roles: ["PULL_PRESIDENT"],   redirect: "/pull-material/approval",  title: "pending your approval — VP Production", cta: "Open Approval" },
  PENDING_DVM_PUR:      { roles: ["DVM_PUR"],          redirect: "/pull-material/approval",  title: "pending your approval — DVM Purchasing", cta: "Open Approval" },
  PENDING_VP_PUR:       { roles: ["VP_PUR"],           redirect: "/pull-material/approval",  title: "pending your approval — DPM", cta: "Open Approval" },
}

// Alert the owner(s) of a Pull Material stage when a doc reaches it. Per-recipient magic-login link
// (auto-login → the right page). TEST doc reroutes every mail to the creator (monitor copy).
// Clean status labels for the email (no internal role names like "DPM").
const PULL_STATUS_LABEL: Record<string, string> = {
  PENDING_PURCHASING: "Pending Purchasing",
  PENDING_LOGISTICS: "Pending Logistics",
  PENDING_LG_RATE: "รอ LG เติม Air rate",
  PENDING_SCM_DECISION: "Pending SCM Decision",
  PENDING_PC_DECISION: "Pending Purchase Decision",
  PENDING_DVM_SCM: "Pending Approval",
  PENDING_VP_SCM: "Pending Approval",
  PENDING_FINAL: "Pending Approval",
  PENDING_DVM_PUR: "Pending Approval",
  PENDING_VP_PUR: "Pending Approval",
  APPROVED: "Approved",
}

// Maroon email card (mirrors the Air Request layout). `fields` = the rows shown under DOC NO / STATUS.
const EMAIL_FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
function pullEmailCard(o: { documentNo: string; bu: string; statusText: string; fields: { label: string; value: string }[]; cta: string; link: string }): string {
  const M = "#6b1a1a", M_SOFT = "#e8b0b0"
  const base = String(process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/+$/, "")
  const loginUrl = base ? `${base}/login` : ""
  const rows = o.fields.filter(f => f.value != null && String(f.value).trim() !== "").map((f, i, arr) =>
    `<tr><td style="${i < arr.length - 1 ? "border-bottom:1px solid #f1f5f9;" : ""}padding:9px 0"><span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:${EMAIL_FONT};text-transform:uppercase">${f.label}</span><br><span style="color:#1e293b;font-size:14px;font-family:${EMAIL_FONT}">${f.value}</span></td></tr>`
  ).join("")
  return `<body style="margin:0;background:#f1f5f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0"><tr><td align="center">
    <table role="presentation" width="460" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;max-width:460px">
      <tr><td style="background:${M};padding:22px;text-align:center">
        <p style="margin:0;color:${M_SOFT};font-size:10px;letter-spacing:3px;font-family:${EMAIL_FONT};text-transform:uppercase">Nan Yang Textile</p>
        <h1 style="margin:6px 0 0;color:#ffffff;font-size:21px;font-family:${EMAIL_FONT};font-weight:700;letter-spacing:3px">PULL MATERIAL</h1>
      </td></tr>
      <tr><td style="padding:30px 36px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="border-bottom:1px solid #f1f5f9;padding:9px 0"><span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:${EMAIL_FONT};text-transform:uppercase">DOC NO</span><br><span style="color:${M};font-size:16px;font-weight:700;font-family:${EMAIL_FONT}">${o.documentNo}</span><span style="color:#94a3b8;font-size:12px;font-family:${EMAIL_FONT}"> · ${o.bu}</span></td></tr>
          <tr><td style="border-bottom:1px solid #f1f5f9;padding:9px 0"><span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:${EMAIL_FONT};text-transform:uppercase">Status</span><br><span style="color:${M};font-size:14px;font-weight:600;font-family:${EMAIL_FONT}">${o.statusText}</span></td></tr>
          ${rows}
        </table>
        <div style="text-align:center;margin-top:26px">
          <a href="${o.link}" style="display:inline-block;background:${M};color:#fff;padding:13px 32px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;font-family:${EMAIL_FONT}">${o.cta} →</a>
          ${loginUrl ? `<p style="margin:14px 0 2px;color:#94a3b8;font-size:11px;font-family:${EMAIL_FONT}">Or log in to the system with your account</p><a href="${loginUrl}" style="color:${M};font-size:12px;font-weight:700;font-family:${EMAIL_FONT}">${loginUrl}</a>` : ""}
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0"><p style="margin:0;color:#94a3b8;font-size:11px;font-family:${EMAIL_FONT}">Pull Material · Nan Yang Textile Group</p></td></tr>
    </table>
  </td></tr></table>
</body>`
}

// POUSERNAME ("JUTHALAK POUKNOI") → the purchaser's login email ("juthalak.p@nanyangtextile.com"):
// first name + "." + first letter of the surname, lowercased. One word → just the first name.
export function poUsernameToEmail(name: any): string | null {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return null
  const first = parts[0].toLowerCase().replace(/[^a-z0-9]/g, "")
  if (!first) return null
  const initial = parts.length > 1 ? parts[1][0].toLowerCase().replace(/[^a-z0-9]/g, "") : ""
  return `${first}${initial ? "." + initial : ""}@nanyangtextile.com`
}

export async function notifyPullStage(reqId: string, status: string): Promise<void> {
  const cfg = STAGE[status]
  // NOTE: PullMaterialRequest has createdById but NO `createdBy` relation — selecting it here made the
  // whole query throw → notify returned silently → every Pull RM email was lost. Use createdById instead.
  const rq = await (prisma as any).pullMaterialRequest.findUnique({
    where: { id: reqId },
    select: { documentNo: true, bu: true, requesterName: true, requesterEmail: true, purchaserEmail: true, isTest: true, status: true, createdById: true, remark: true,
      items: { select: { soNoDoc: true, poNoDoc: true, poUsername: true, country: true, port: true, seaPort: true, incoterm: true, city: true, pullMaterialQty: true, airFreightCost: true, leadTimeAir: true, weight: true } } },
  }).catch((e: any) => { console.log(`[pull-notify] load failed for ${reqId}: ${String(e).slice(0, 160)}`); return null })
  if (!rq) return
  // Test docs reroute to the creator; look up their email by id (no relation available).
  let testTo: string | null = null
  if (rq.isTest && rq.createdById) {
    const u = await (prisma.user as any).findUnique({ where: { id: rq.createdById }, select: { email: true } }).catch(() => null)
    testTo = u?.email || rq.requesterEmail || null
  }

  // Complete document facts for the email (shows PO — not SO — plus the key shipment fields).
  const items = rq.items || []
  const fmtN = (n: any) => (n == null || isNaN(Number(n)) ? "" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))
  const pos = [...new Set(items.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
  const s0 = items.find((i: any) => i.airFreightCost != null) || items[0] || {}
  const qtyAir = items.reduce((s: number, i: any) => s + (Number(i.pullMaterialQty) || 0), 0)
  const estAir = items.reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
  const docFields: { label: string; value: string }[] = [
    { label: "Requester", value: rq.requesterName || "" },
    { label: "PO", value: pos },
    { label: "Country / Port", value: [s0.country, s0.port || s0.seaPort].filter(Boolean).join(" · ") },
    { label: "Incoterm", value: s0.incoterm || "" },
    { label: "QTY Air", value: fmtN(qtyAir) },
    { label: "Est Air", value: estAir ? `${fmtN(estAir)} USD` : "" },
    { label: "L/T Air", value: s0.leadTimeAir || "" },
    { label: "Remark", value: rq.remark || "" },
  ]

  // Terminal: FYI to the requester + ALERT Logistics to enter the actual air freight.
  if (status === "APPROVED") {
    // 1) Requester FYI
    if (rq.requesterEmail) {
      const html = `<div style="font-family:${EMAIL_FONT};font-size:13px;color:#1a1a1a">
        <h2 style="color:#6b1a1a;margin:0 0 10px">Pull Material — Approved</h2>
        <p><b>${rq.documentNo}</b> (${rq.bu}) has been approved.</p>
        <p style="color:#888;font-size:12px">PO: ${pos || "-"}</p></div>`
      await runWithTestMail(testTo, () => sendMail([rq.requesterEmail], `[Pull Material] Approved — ${rq.documentNo}`, html)).catch(() => {})
    }
    // 2) Logistics alert (enter the actual air freight) → nuttawut.
    console.log(`[pull-notify] ${rq.documentNo} APPROVED → alert LG actual=${LG_ACTUAL_TO.join(",")}`)
    await runWithTestMail(testTo, () =>
      alertLgList(LG_ACTUAL_TO, rq, docFields, "Approved · Logistics — enter actual air freight", "Open Logistics Document", "/pull-material/documents")
    ).catch(() => {})
    return
  }

  // No-Master (fill Master rate) → wanna + krittamet only (not the whole LG role).
  if (status === "PENDING_LG_RATE") {
    const c = STAGE[status]
    console.log(`[pull-notify] ${rq.documentNo} PENDING_LG_RATE → alert ${LG_NOMASTER_TO.join(",")}`)
    await runWithTestMail(testTo, () =>
      alertLgList(LG_NOMASTER_TO, rq, docFields, PULL_STATUS_LABEL[status] || "รอ LG เติม Air rate", c.cta, c.redirect)
    ).catch(() => {})
    return
  }

  // SCM req landed at Purchasing → alert ONLY the specific purchaser(s) that own the PO (from POUSERNAME),
  // not the whole Purchasing pool. Multiple POs → multiple owners. Fall back to the pool if none derivable.
  if (status === "PENDING_PURCHASING") {
    const c = STAGE[status]
    // Sample (MER) carries the chosen purchaser email directly; SCM req derives it from each PO's POUSERNAME.
    const emails = rq.purchaserEmail
      ? [String(rq.purchaserEmail).toLowerCase()]
      : [...new Set(items.map((i: any) => poUsernameToEmail(i.poUsername)).filter(Boolean) as string[])]
    if (emails.length) {
      console.log(`[pull-notify] ${rq.documentNo} PENDING_PURCHASING → owner(s) ${emails.join(",")}`)
      await runWithTestMail(testTo, () => alertLgList(emails, rq, docFields, PULL_STATUS_LABEL[status] || "Pending Purchasing", c.cta, c.redirect)).catch(() => {})
      return
    }
    console.log(`[pull-notify] ${rq.documentNo} PENDING_PURCHASING → no POUSERNAME → fallback to PURCHASING pool`)
  }

  if (!cfg) { console.log(`[pull-notify] no STAGE config for status=${status} (${rq.documentNo})`); return }
  // PC approval (PENDING_VP_PUR) = a SINGLE approver routed by BU → email only that person.
  const pcTo = status === "PENDING_VP_PUR" ? pcApprover(rq.bu) : null
  const users = await (prisma.user as any).findMany({
    where: pcTo
      ? { isActive: true, email: { equals: pcTo, mode: "insensitive" } }
      : { isActive: true, OR: [{ role: { in: cfg.roles } }, { roles: { hasSome: cfg.roles } }] },
    select: { id: true, email: true },
  })
  const seen = new Set<string>()
  const recips = users.filter((u: any) => u.email && !seen.has(u.email.toLowerCase()) && seen.add(u.email.toLowerCase()))
  console.log(`[pull-notify] ${rq.documentNo} status=${status} bu=${rq.bu} pcTo=${pcTo ?? "-"} roles=${cfg.roles.join(",")} recips=${recips.length}${rq.isTest ? " TEST→" + (testTo ?? "?") : ""}`)
  if (!recips.length) { console.log(`[pull-notify] NO RECIPIENT for ${rq.documentNo} status=${status} (pcTo=${pcTo ?? "-"}) — no email sent`); return }

  const statusText = PULL_STATUS_LABEL[status] || "Notification"

  await runWithTestMail(testTo, async () => {
    for (const u of recips) {
      const link = await magicLoginFor(u.id, cfg.redirect)
      const html = pullEmailCard({ documentNo: rq.documentNo, bu: rq.bu, statusText, fields: docFields, cta: cfg.cta, link })
      await sendMail([u.email], `[Pull Material] ${statusText} — ${rq.documentNo}`, html).catch(() => {})
    }
  }).catch(() => {})
}

// Alert a fixed list of LG people by email: a registered user gets a personal magic link; anyone not yet
// a user gets a /login link (never a direct page link — that would ride whatever session is in the browser).
async function alertLgList(emails: string[], rq: any, docFields: any[], statusText: string, cta: string, redirect: string): Promise<void> {
  const users = await (prisma.user as any).findMany({
    where: { isActive: true, email: { in: emails, mode: "insensitive" } },
    select: { id: true, email: true },
  })
  const byEmail = new Map<string, any>(users.map((u: any) => [String(u.email).toLowerCase(), u]))
  for (const email of emails) {
    const u = byEmail.get(email.toLowerCase())
    const link = u ? await magicLoginFor(u.id, redirect) : (APP_URL ? `${APP_URL}/login?next=${encodeURIComponent(redirect)}` : "/login")
    const html = pullEmailCard({ documentNo: rq.documentNo, bu: rq.bu, statusText, fields: docFields, cta, link })
    await sendMail([email], `[Pull Material] ${statusText} — ${rq.documentNo}`, html).catch(() => {})
  }
}

// LG returned a doc to Purchasing (wrong attachment). Alert the purchaser who owns it (fallback: the
// creator, then the whole Purchasing pool) with the reason and the running revise count.
export async function notifyPullReturn(reqId: string, reviseCount: number, reason: string): Promise<void> {
  const rq = await (prisma as any).pullMaterialRequest.findUnique({
    where: { id: reqId },
    select: { documentNo: true, bu: true, isTest: true, createdById: true, requesterEmail: true, purchaserEmail: true, remark: true,
      items: { select: { poNoDoc: true, country: true, port: true, seaPort: true } } },
  }).catch(() => null)
  if (!rq) return
  let testTo: string | null = null
  if (rq.isTest && rq.createdById) {
    const cu = await (prisma.user as any).findUnique({ where: { id: rq.createdById }, select: { email: true } }).catch(() => null)
    testTo = cu?.email || rq.requesterEmail || null
  }
  // Recipient list: the owning purchaser, else creator, else every Purchasing user.
  let recips: { id?: string; email: string }[] = []
  if (rq.purchaserEmail) {
    const u = await (prisma.user as any).findUnique({ where: { email: rq.purchaserEmail }, select: { id: true, email: true } }).catch(() => null)
    recips = u?.email ? [u] : [{ email: rq.purchaserEmail }]
  }
  if (!recips.length && rq.createdById) {
    const u = await (prisma.user as any).findUnique({ where: { id: rq.createdById }, select: { id: true, email: true } }).catch(() => null)
    if (u?.email) recips = [u]
  }
  if (!recips.length) {
    const us = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: "PURCHASING" }, { roles: { has: "PURCHASING" } }] }, select: { id: true, email: true } })
    recips = us.filter((u: any) => u.email)
  }
  const pos = [...new Set((rq.items || []).map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
  const s0 = (rq.items || [])[0] || {}
  const fields = [
    { label: "PO", value: pos },
    { label: "Country / Port", value: [s0.country, s0.port || s0.seaPort].filter(Boolean).join(" · ") },
    { label: "ตีกลับครั้งที่ (Revise #)", value: String(reviseCount) },
    { label: "เหตุผล (Reason)", value: reason || "-" },
    { label: "Remark", value: rq.remark || "" },
  ]
  const statusText = `⚠️ ตีกลับให้แก้ไข · Revise ครั้งที่ ${reviseCount}`
  await runWithTestMail(testTo, async () => {
    for (const u of recips) {
      const link = u.id ? await magicLoginFor(u.id, "/pull-material/purchase") : (APP_URL ? `${APP_URL}/login?next=${encodeURIComponent("/pull-material/purchase")}` : "/login")
      const html = pullEmailCard({ documentNo: rq.documentNo, bu: rq.bu, statusText, fields, cta: "แก้ไขเอกสาร (Open Purchase)", link })
      await sendMail([u.email], `[Pull Material] ตีกลับให้แก้ไข (Revise #${reviseCount}) — ${rq.documentNo}`, html).catch(() => {})
    }
  }).catch(() => {})
}

// Back-compat: the old LG-only helper now delegates to the generic stage notifier.
export async function notifyPullLogistics(reqId: string): Promise<void> {
  return notifyPullStage(reqId, "PENDING_LOGISTICS")
}
