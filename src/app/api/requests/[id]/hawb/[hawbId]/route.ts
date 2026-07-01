import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; hawbId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (role !== "LOGISTICS") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { hawbId } = await params

  const hawb = await prisma.hawbGroup.findUnique({ where: { id: hawbId }, include: { items: true } })
  if (!hawb) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Reset items before delete
  await prisma.airRequestItem.updateMany({
    where: { hawbGroupId: hawbId },
    data: { hawbGroupId: null, actualAirFreight: null }
  })
  await prisma.hawbGroup.delete({ where: { id: hawbId } })

  return NextResponse.json({ ok: true })
}
