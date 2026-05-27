import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = req.nextUrl.searchParams.get("role")
  if (!role) return NextResponse.json([])
  const users = await prisma.user.findMany({
    where: { role, isActive: true, priority: { not: null } },
    select: { id: true, name: true, email: true, role: true, priority: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  })
  return NextResponse.json(users)
}
