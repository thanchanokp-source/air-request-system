import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Admin-only: list users (for the Pull Material "User Management" tab) and toggle their
// `pullRm` flag. Users are shared with the main app — this only flips the Pull RM flag.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const users = await (prisma.user as any).findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, roles: true, bu: true, pullRm: true },
    orderBy: [{ pullRm: "desc" }, { email: "asc" }],
  })
  return NextResponse.json({ users })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id, pullRm } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const user = await (prisma.user as any).update({ where: { id }, data: { pullRm: !!pullRm }, select: { id: true, pullRm: true } })
  return NextResponse.json({ user })
}
