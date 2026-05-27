import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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
      attachments: { include: { uploadedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } }
    }
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
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
  if (role !== "MER_USER" || request.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (request.status !== "PENDING_VP_MER") {
    return NextResponse.json({ error: "Cannot delete request in current status" }, { status: 400 })
  }
  await prisma.airRequest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
