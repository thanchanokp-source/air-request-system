import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyStatusChange } from "@/lib/notify"
import { getSplits, nykSplitStatus, setGwSplitStatus, deriveGwItemStatus, deriveNygItemStatus } from "@/lib/claim"

// Case 9b — Auto-approve SCM NYK claim (EVP step) when it has been pending > 3 days.
//
// Scope (confirmed): ONLY the SCM NYK claim. Timer: from when the SO ENTERED the SCM NYK
// stage — i.e. the moment the SCM NYK *Approver* approved (that's when the EVP was notified).
// We read that moment from the Approver's ClaimApproval.createdAt (precise, per SO).
//
// If the Approver approved > 3 days ago and the EVP still hasn't → we approve on behalf of the
// assigned EVP (assignedScmNykEvp; fallback: any active SCM_NYK_EVP). We do NOT fabricate a CR NO
// (that is real business data entered by the CR user) — but if the CR is already in, the split
// completes. The Approver step itself is never auto-run (the Approver chooses the EVP/CR people).
//
// Trigger: a scheduled GET with the CRON_SECRET (Vercel Cron / external scheduler), or an ADMIN
// hitting it manually from the browser. TEST documents are skipped.
export const dynamic = "force-dynamic"

const DAYS = 3
const MS = DAYS * 24 * 60 * 60 * 1000

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization") || ""
    const q = req.nextUrl.searchParams.get("secret") || ""
    if (auth === `Bearer ${secret}` || q === secret) return true
  }
  // Fallback: allow an authenticated ADMIN to run it manually.
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === "ADMIN"
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const now = Date.now()
  const cutoff = new Date(now - MS)
  const result: { docsTouched: number; sosApproved: number; details: any[] } = { docsTouched: 0, sosApproved: 0, details: [] }

  // Only documents currently sitting in a claim stage where SCM NYK could be pending.
  const docs = await prisma.airRequest.findMany({
    where: { isTest: false, status: { in: ["PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_CLAIM_GW"] } },
    include: { items: { include: { claimApprovals: { select: { role: true, createdAt: true, userId: true } } } } as any },
  })

  for (const doc of docs) {
    const isGW = (doc as any).bu === "GW"
    const deptName = isGW ? "SCM NYK" : "NYK"
    const crNo = (doc as any).crNo || null
    let docChanged = false

    // Resolve the EVP user to auto-approve on behalf of (assigned first, else any active one).
    const assignedEvp = (doc as any).assignedScmNykEvp
    let evpUser: any = assignedEvp
      ? await (prisma.user as any).findUnique({ where: { email: assignedEvp } }).catch(() => null)
      : null
    if (!evpUser) {
      evpUser = await (prisma.user as any).findFirst({
        where: { isActive: true, OR: [{ role: "SCM_NYK_EVP" }, { roles: { has: "SCM_NYK_EVP" } }] },
        orderBy: { createdAt: "asc" },
      }).catch(() => null)
    }
    if (!evpUser) continue // no EVP configured → nothing to auto-approve

    for (const item of (doc as any).items) {
      if (item.itemStatus === "REJECTED") continue
      const splits = getSplits(item)
      if (!splits.some((s: any) => s.dept === deptName)) continue // no SCM NYK portion

      const appr = item.claimApprovals || []
      const approverRow = appr.find((a: any) => a.role === "SCM_NYK_APPROVER")
      const evpDone = appr.some((a: any) => a.role === "SCM_NYK_EVP")
      if (!approverRow || evpDone) continue // need Approver-done and EVP-not-done
      if (new Date(approverRow.createdAt).getTime() > now - MS) continue // not yet 3 days

      // Auto-approve the EVP step on behalf of evpUser.
      await (prisma as any).claimApproval.upsert({
        where: { itemId_userId: { itemId: item.id, userId: evpUser.id } },
        create: { itemId: item.id, userId: evpUser.id, role: "SCM_NYK_EVP" },
        update: { createdAt: new Date() },
      })
      const splitStatus = isGW
        ? nykSplitStatus({ approver: true, evp: true, cr: !!crNo })
        : nykSplitStatus({ approver: true, evp: true, cr: !!crNo }, "COMPLETED")
      const updated = setGwSplitStatus(splits, [deptName], splitStatus, crNo || undefined)
      const itemStatus = isGW
        ? deriveGwItemStatus(updated, (item as any).actualAirFreight != null)
        : deriveNygItemStatus(updated, !!(doc as any).logisticsSent)
      await prisma.airRequestItem.update({ where: { id: item.id }, data: { claimDepts: updated as any, itemStatus } })
      await prisma.approvalLog.create({
        data: { requestId: doc.id, userId: evpUser.id, action: "AUTO_APPROVE", fromStatus: doc.status, toStatus: doc.status, comment: `SO: ${item.so} — SCM NYK EVP auto-approved (pending > ${DAYS} days)` },
      })
      result.sosApproved++
      docChanged = true
      result.details.push({ documentNo: doc.documentNo, so: item.so, evp: evpUser.email, crPresent: !!crNo })
    }

    if (docChanged) {
      result.docsTouched++
      // Recompute the doc status (may advance to Accounting/VP Claim/etc.) and notify.
      const fresh = await prisma.airRequestItem.findMany({ where: { requestId: doc.id }, select: { itemStatus: true } })
      const nonRej = fresh.filter(i => i.itemStatus !== "REJECTED")
      const s = new Set(nonRej.map(i => i.itemStatus))
      let newStatus = doc.status
      if (isGW) {
        if (s.has("PRESIDENT_PENDING")) newStatus = "PENDING_PRESIDENT_GW"
        else if (s.has("ACCOUNTING_PENDING")) newStatus = "PENDING_ACCOUNTING"
      } else {
        if (s.has("CLAIM_PASSED")) newStatus = "PENDING_VP_CLAIM"
        else if (s.has("PRESIDENT_PENDING")) newStatus = "PENDING_PRESIDENT"
        else if (s.has("ACCOUNTING_PENDING")) newStatus = "PENDING_ACCOUNTING"
      }
      if (newStatus !== doc.status) {
        await prisma.airRequest.update({ where: { id: doc.id }, data: { status: newStatus } })
        await notifyStatusChange(doc.id, newStatus).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date(now).toISOString(), thresholdDays: DAYS, ...result })
}
