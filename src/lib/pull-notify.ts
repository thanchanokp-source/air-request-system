import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { magicLoginFor } from "@/lib/notify"
import { pcApprover } from "@/lib/pull-approvers"

// Per-stage recipient config for the Pull Material flow. Each entry = who to alert when a doc REACHES
// that status, and where their magic link should land. Covers BOTH branches (SCM / PC).
const STAGE: Record<string, { roles: string[]; redirect: string; title: string; cta: string }> = {
  PENDING_PURCHASING:   { roles: ["PURCHASING"],       redirect: "/pull-material/purchase",  title: "new request for Purchasing — fill Country / Port / Incoterm / Weight", cta: "Open Purchase queue" },
  PENDING_LOGISTICS:    { roles: ["LOGISTICS_IMPORT"], redirect: "/pull-material/logistics", title: "ready for Logistics — enter freight (Air rate / In-House date)", cta: "Open Logistics queue" },
  PENDING_SCM_DECISION: { roles: ["SCM_PULL"],         redirect: "/pull-material/request?tab=approve", title: "ready for SCM — confirm which lines go by AIR", cta: "Open SCM decision" },
  PENDING_PC_DECISION:  { roles: ["PURCHASING"],       redirect: "/pull-material/request?tab=approve", title: "ready for Purchase — decide which lines go by AIR", cta: "Open PC decision" },
  PENDING_DVM_SCM:      { roles: ["PULL_DVM_SCM"],      redirect: "/pull-material/approval",  title: "pending your approval — DVM SCM", cta: "Open Approval" },
  PENDING_VP_SCM:       { roles: ["VP_SCM"],           redirect: "/pull-material/approval",  title: "pending your approval — VP SCM", cta: "Open Approval" },
  PENDING_FINAL:        { roles: ["PULL_PRESIDENT"],   redirect: "/pull-material/approval",  title: "pending final approval (President)", cta: "Open Approval" },
  PENDING_DVM_PUR:      { roles: ["DVM_PUR"],          redirect: "/pull-material/approval",  title: "pending your approval — DVM Purchasing", cta: "Open Approval" },
  PENDING_VP_PUR:       { roles: ["VP_PUR"],           redirect: "/pull-material/approval",  title: "pending your approval — DPM", cta: "Open Approval" },
}

// Alert the owner(s) of a Pull Material stage when a doc reaches it. Per-recipient magic-login link
// (auto-login → the right page). TEST doc reroutes every mail to the creator (monitor copy).
export async function notifyPullStage(reqId: string, status: string): Promise<void> {
  const cfg = STAGE[status]
  const rq = await (prisma as any).pullMaterialRequest.findUnique({
    where: { id: reqId },
    select: { documentNo: true, bu: true, requesterName: true, requesterEmail: true, isTest: true, status: true, items: { select: { soNoDoc: true } }, createdBy: { select: { email: true } } },
  }).catch(() => null)
  if (!rq) return
  const testTo = rq.isTest ? (rq.createdBy?.email ?? null) : null
  const sos = [...new Set((rq.items || []).map((i: any) => i.soNoDoc).filter(Boolean))].join(", ")

  // Terminal: notify the requester that it's approved (FYI, no action).
  if (status === "APPROVED") {
    const to = rq.requesterEmail
    if (!to) return
    const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
      <h2 style="color:#16a34a;margin:0 0 10px">Pull Material — Approved</h2>
      <p><b>${rq.documentNo}</b> (${rq.bu}) has been fully approved.</p>
      <p style="color:#888;font-size:12px">SO: ${sos || "-"}</p></div>`
    await runWithTestMail(testTo, () => sendMail([to], `[Pull Material] Approved — ${rq.documentNo}`, html)).catch(() => {})
    return
  }

  if (!cfg) return
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
  if (!recips.length) return

  await runWithTestMail(testTo, async () => {
    for (const u of recips) {
      const link = await magicLoginFor(u.id, cfg.redirect)
      const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
        <h2 style="color:#6b1a1a;margin:0 0 10px">Pull Material — ${cfg.title}</h2>
        <p><b>${rq.documentNo}</b> (${rq.bu})</p>
        <table style="border-collapse:collapse;font-size:13px;margin:6px 0">
          <tr><td style="color:#888;padding-right:12px">Requester</td><td>${rq.requesterName || "-"}</td></tr>
          <tr><td style="color:#888;padding-right:12px">SO</td><td>${sos || "-"}</td></tr>
          <tr><td style="color:#888;padding-right:12px">Items</td><td>${(rq.items || []).length}</td></tr>
        </table>
        <p style="margin-top:14px"><a href="${link}" style="background:#6b1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;display:inline-block">${cfg.cta} →</a></p>
        <p style="color:#9ca3af;font-size:12px;margin-top:12px">This link logs you in automatically (no password).</p>
      </div>`
      await sendMail([u.email], `[Pull Material] ${cfg.title.split(" — ")[0]} — ${rq.documentNo}`, html).catch(() => {})
    }
  }).catch(() => {})
}

// Back-compat: the old LG-only helper now delegates to the generic stage notifier.
export async function notifyPullLogistics(reqId: string): Promise<void> {
  return notifyPullStage(reqId, "PENDING_LOGISTICS")
}
