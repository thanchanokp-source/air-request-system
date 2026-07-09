import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { notifyClaimNext } from "@/lib/notify"
import { sendMail } from "@/lib/email"

const APP_URL = process.env.APP_URL || "http://localhost:3000"

function isAdmin(session: any) {
  return (session?.user as any)?.role === "ADMIN"
}

// List pending new-approver requests (Admin only).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const rows = await (prisma as any).pendingApprover.findMany({
    where: { status: "PENDING" }, orderBy: { createdAt: "desc" },
  })
  // Attach document number for display.
  const ids = [...new Set(rows.map((r: any) => r.requestId))]
  const docs = await prisma.airRequest.findMany({ where: { id: { in: ids as string[] } }, select: { id: true, documentNo: true } })
  const docMap = Object.fromEntries(docs.map(d => [d.id, d.documentNo]))
  return NextResponse.json(rows.map((r: any) => ({ ...r, documentNo: docMap[r.requestId] || r.requestId })))
}

// Approve → create the user with the exact role, execute the held forward, and
// alert the new person. Reject → just close the request. (Admin only.)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { id, action, reason } = await req.json()
    const pa = await (prisma as any).pendingApprover.findUnique({ where: { id: String(id) } })
    if (!pa || pa.status !== "PENDING") return NextResponse.json({ error: "Request not found or already handled" }, { status: 404 })

    // Collapse any duplicate PENDING requests for the same doc + dept + person so
    // handling one clears the rest.
    await (prisma as any).pendingApprover.updateMany({
      where: { requestId: pa.requestId, dept: pa.dept, nextEmail: pa.nextEmail, status: "PENDING", id: { not: pa.id } },
      data: { status: "SUPERSEDED" },
    })

    const doc = await prisma.airRequest.findUnique({ where: { id: pa.requestId }, select: { documentNo: true } })

    if (action === "reject") {
      await (prisma as any).pendingApprover.update({ where: { id: pa.id }, data: { status: "REJECTED" } })
      // Tell the requester so they can pick another approver. The SO were never
      // forwarded — they are still pending with the requester.
      if (pa.requestedBy) {
        const link = `${APP_URL}/requests/${pa.requestId}`
        const html = `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0"><tr><td align="center">
  <table width="440" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#b91c1c;padding:16px;text-align:center"><h1 style="margin:0;color:#fff;font-size:15px">Approver Request Rejected</h1></td></tr>
    <tr><td style="padding:22px 28px;color:#374151;font-size:13px;line-height:1.6">
      <p style="margin:0 0 10px">Admin did not approve adding <b>${pa.nextName || pa.nextEmail}</b> as <b>${pa.positionLabel}</b> on <b>${doc?.documentNo || pa.requestId}</b>.</p>
      ${reason ? `<p style="margin:0 0 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;color:#b91c1c">Reason: ${String(reason)}</p>` : ""}
      <p style="margin:0 0 16px;color:#6b7280">The SO are still pending with you — please open the document and choose another approver.</p>
      <div style="text-align:center"><a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:11px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">Open Document →</a></div>
    </td></tr>
  </table>
</td></tr></table></body></html>`
        sendMail(pa.requestedBy, `[Rejected] Add approver — ${doc?.documentNo || ""}`, html).catch(() => {})
      }
      return NextResponse.json({ ok: true, action: "rejected" })
    }

    // 1) Create/activate the user with the exact position role + auto priority
    // (next after the highest existing priority for that role + BU).
    const displayName = pa.nextName || pa.nextEmail.split("@")[0]
    const existingU = await (prisma.user as any).findUnique({ where: { email: pa.nextEmail }, select: { priority: true } })
    let priority: number | null = existingU?.priority ?? null
    if (priority == null) {
      const maxP = await (prisma.user as any).aggregate({ where: { role: pa.role, bu: pa.bu }, _max: { priority: true } })
      priority = ((maxP._max.priority as number) ?? 0) + 1
    }
    await (prisma.user as any).upsert({
      where: { email: pa.nextEmail },
      create: { email: pa.nextEmail, name: displayName, role: pa.role, bu: pa.bu, isActive: true, priority },
      update: { role: pa.role, bu: pa.bu, isActive: true, name: displayName, priority },
    })

    // 2) Execute the held forward: create the ClaimForward row for the SO subset.
    const token = randomBytes(32).toString("hex")
    await (prisma as any).claimForward.create({
      data: {
        requestId: pa.requestId, dept: pa.dept, nextEmail: pa.nextEmail, nextName: pa.nextName,
        token, position: (pa.fromPos ?? 0) + 1, branch: pa.branch || null,
        itemIds: Array.isArray(pa.itemIds) ? pa.itemIds : null,
      },
    })
    // Remove those SO from the requester's own forward row, if they had one.
    if (pa.requestedBy && Array.isArray(pa.itemIds)) {
      const ownerRow = await (prisma as any).claimForward.findFirst({ where: { requestId: pa.requestId, dept: pa.dept, nextEmail: pa.requestedBy } })
      if (ownerRow) {
        const remaining = (Array.isArray(ownerRow.itemIds) ? ownerRow.itemIds : []).filter((x: string) => !pa.itemIds.includes(x))
        if (Array.isArray(ownerRow.itemIds) && remaining.length === 0) await (prisma as any).claimForward.delete({ where: { id: ownerRow.id } }).catch(() => {})
        else if (Array.isArray(ownerRow.itemIds)) await (prisma as any).claimForward.update({ where: { id: ownerRow.id }, data: { itemIds: remaining } })
      }
    }

    // 3) Now alert the new person (magic link to approve their SO).
    await notifyClaimNext(pa.requestId, pa.nextEmail, pa.nextName || pa.nextEmail, "Admin", token, `${pa.dept} — ${pa.positionLabel}`).catch(() => {})

    await (prisma as any).pendingApprover.update({ where: { id: pa.id }, data: { status: "APPROVED" } })
    return NextResponse.json({ ok: true, action: "approved" })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}
