import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { magicLoginFor } from "@/lib/notify"

// Alert the LG Import team that a Pull Material doc reached Logistics (ready for freight entry).
// Each recipient gets their OWN magic-login link (click → auto-login as their account → LG page).
// A TEST doc reroutes every mail to the creator (monitor copy shows "meant for").
export async function notifyPullLogistics(reqId: string): Promise<void> {
  const rq = await (prisma as any).pullMaterialRequest.findUnique({
    where: { id: reqId },
    select: {
      documentNo: true, bu: true, requesterName: true, isTest: true,
      items: { select: { soNoDoc: true } },
      createdBy: { select: { email: true } },
    },
  }).catch(() => null)
  if (!rq) return

  const lg = await (prisma.user as any).findMany({
    where: { isActive: true, OR: [{ role: "LOGISTICS_IMPORT" }, { roles: { has: "LOGISTICS_IMPORT" } }] },
    select: { id: true, email: true },
  })
  const seen = new Set<string>()
  const recips = lg.filter((u: any) => u.email && !seen.has(u.email.toLowerCase()) && seen.add(u.email.toLowerCase()))
  if (!recips.length) return

  const sos = [...new Set((rq.items || []).map((i: any) => i.soNoDoc).filter(Boolean))].join(", ")
  const subject = `[Logistics] Pull Material ready for freight — ${rq.documentNo}`
  const testTo = rq.isTest ? (rq.createdBy?.email ?? null) : null

  await runWithTestMail(testTo, async () => {
    for (const u of recips) {
      const link = await magicLoginFor(u.id, "/pull-material/logistics")
      const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
        <h2 style="color:#6b1a1a;margin:0 0 10px">Pull Material — ready for Logistics</h2>
        <p><b>${rq.documentNo}</b> (${rq.bu}) has passed Purchase — please enter freight (Air rate / In-House date).</p>
        <table style="border-collapse:collapse;font-size:13px;margin:6px 0">
          <tr><td style="color:#888;padding-right:12px">Requester</td><td>${rq.requesterName || "-"}</td></tr>
          <tr><td style="color:#888;padding-right:12px">SO</td><td>${sos || "-"}</td></tr>
          <tr><td style="color:#888;padding-right:12px">Items</td><td>${(rq.items || []).length}</td></tr>
        </table>
        <p style="margin-top:14px"><a href="${link}" style="background:#6b1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;display:inline-block">Open Logistics queue →</a></p>
        <p style="color:#9ca3af;font-size:12px;margin-top:12px">This link logs you in automatically (no password).</p>
      </div>`
      await sendMail([u.email], subject, html).catch(() => {})
    }
  }).catch(() => {})
}
