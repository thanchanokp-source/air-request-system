import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const userId = (session.user as any).id
  const where = role === "MER_USER" ? { createdById: userId } : {}
  const requests = await prisma.airRequest.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" }
  })
  return NextResponse.json(requests)
}
