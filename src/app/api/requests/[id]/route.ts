import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { attachGarmentPo } from "@/lib/bom"
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const request = await prisma.airRequest.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      items: {
        include: {
          claimApprovals: {
            include: { user: { select: { id: true, name: true, role: true, priority: true } } },
            orderBy: { createdAt: "asc" }
          }
        }
      } as any,
      approvalLogs: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      attachments: { include: { uploadedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      claimForwards: true,
      approvalSignatures: { orderBy: { signedAt: "asc" } },
    } as any
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await attachGarmentPo([request as any])
  return NextResponse.json(request)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { id } = await params
  const request = await prisma.airRequest.findUnique({ where: { id } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const email = String((session.user as any).email || "").toLowerCase()
  const isAdmin = role === "ADMIN" || email === "jariya.t@nanyangtextile.com"
  const isCreator = request.createdById === userId
  // Only deletable while the doc is back at Merchandise (recalled / sent back), by the uploader or admin.
  // Anywhere else in the flow → must be Rejected by an approver instead.
  const atMerchandise = ["PENDING_MER", "PENDING_MER_GW", "DRAFT"].includes(request.status)
  if (!(atMerchandise && (isCreator || isAdmin))) {
    return NextResponse.json({ error: "Delete is only allowed at Merchandise (after a recall) by the uploader or admin. Otherwise please have the approver Reject it." }, { status: 403 })
  }
  // Remove all children first so the delete never hits a foreign-key constraint.
  await (prisma as any).claimApproval.deleteMany({ where: { item: { requestId: id } } }).catch(() => {})
  await (prisma as any).hawbGroup.deleteMany({ where: { requestId: id } }).catch(() => {})
  await (prisma as any).approvalSignature.deleteMany({ where: { requestId: id } }).catch(() => {})
  await (prisma as any).claimForward.deleteMany({ where: { requestId: id } }).catch(() => {})
  await (prisma as any).requestAttachment.deleteMany({ where: { requestId: id } }).catch(() => {})
  await (prisma as any).approvalLog.deleteMany({ where: { requestId: id } }).catch(() => {})
  await (prisma as any).airRequestItem.deleteMany({ where: { requestId: id } }).catch(() => {})
  await prisma.airRequest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
