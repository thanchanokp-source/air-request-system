import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = req.nextUrl.searchParams.get("role")
  const bu = req.nextUrl.searchParams.get("bu")
  if (!role) return NextResponse.json([])
  // A person can hold multiple roles → match the primary `role` OR any in `roles[]`.
  const users = await (prisma.user as any).findMany({
    where: { isActive: true, ...(bu ? { bu } : {}), OR: [{ role }, { roles: { has: role } }] },
    select: { id: true, name: true, email: true, role: true, priority: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  })
  return NextResponse.json(users)
}
