import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyAdminAddPerson } from "@/lib/notify"

// A claim approver requests to add a NEW person for the next position. Nothing is
// forwarded yet — it waits in PendingApprover until an Admin approves.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { requestId, dept, role, positionLabel, fromPos, nextEmail, nextName, bu, branch, itemIds } = await req.json()
    const mail = String(nextEmail || "").trim().toLowerCase()
    if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 })
    if (!requestId || !dept || !role) return NextResponse.json({ error: "Missing forward context" }, { status: 400 })

    await (prisma as any).pendingApprover.create({
      data: {
        requestId: String(requestId), dept: String(dept), role: String(role),
        positionLabel: String(positionLabel || role), fromPos: Number(fromPos) || 0,
        nextEmail: mail, nextName: nextName ? String(nextName) : null,
        bu: String(bu || "GW"), branch: branch ? String(branch) : null,
        itemIds: Array.isArray(itemIds) ? itemIds : null,
        requestedBy: (session.user as any)?.email || null,
        requestedName: (session.user as any)?.name || null,
        status: "PENDING",
      },
    })

    const doc = await prisma.airRequest.findUnique({ where: { id: String(requestId) }, select: { documentNo: true } })
    // Alert Admin — they must approve before the new person is notified.
    notifyAdminAddPerson({
      position: `${positionLabel || role} (awaiting your approval)`,
      suggestedName: `${nextName || ""} <${mail}>`.trim(),
      requesterName: (session.user as any)?.name || (session.user as any)?.email,
      requestId: String(requestId), bu: String(bu || "GW"),
      documentNo: doc?.documentNo,
    } as any).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}
