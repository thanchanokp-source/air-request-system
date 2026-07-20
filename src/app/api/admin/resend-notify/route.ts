import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyStatusChange, notifyGwClaimNyk } from "@/lib/notify"

// Admin-only helper: RE-SEND the "next step" notification for one or more documents. Handy when
// test-email override was turned on AFTER an approval and you want to receive that email again.
// Open in a browser while logged in as ADMIN:
//   /api/admin/resend-notify?doc=AIR-2607-0001,AIR-2607-0003
// Re-fires notifyStatusChange for each doc's CURRENT status. For GW docs at the parallel
// Logistics∥Claim stage it fires BOTH the Logistics and Claim notifications.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }
  const docParam = req.nextUrl.searchParams.get("doc") || ""
  const only = (req.nextUrl.searchParams.get("only") || "").toLowerCase() // e.g. "nyk"
  const docNos = docParam.split(",").map(s => s.trim()).filter(Boolean)
  if (!docNos.length) return NextResponse.json({ error: "Pass ?doc=AIR-XXXX[,AIR-YYYY]  (optional &only=nyk)" }, { status: 400 })

  const results: any[] = []
  for (const documentNo of docNos) {
    const reqDoc = await (prisma.airRequest as any).findFirst({ where: { documentNo } })
    if (!reqDoc) { results.push({ documentNo, ok: false, error: "not found" }); continue }
    // Targeted resend: ONLY the SCM NYK approvers (other roles were already notified).
    if (only === "nyk") {
      const n = await notifyGwClaimNyk(reqDoc.id)
      results.push({ documentNo, ok: true, only: "nyk", nykEmailsSent: n })
      continue
    }
    const fired: string[] = []
    await notifyStatusChange(reqDoc.id, reqDoc.status).catch(() => {})
    fired.push(reqDoc.status)
    // GW parallel stage: also notify Logistics + Claim explicitly.
    if (reqDoc.bu === "GW" && reqDoc.status === "PENDING_CLAIM_GW") {
      await notifyStatusChange(reqDoc.id, "PENDING_LOGISTICS_GW").catch(() => {})
      fired.push("PENDING_LOGISTICS_GW")
    }
    results.push({ documentNo, ok: true, status: reqDoc.status, bu: reqDoc.bu, fired })
  }
  return NextResponse.json({ ok: true, results })
}
