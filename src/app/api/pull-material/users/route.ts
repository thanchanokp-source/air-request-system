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

// Add a user to the Pull RM list. If the email exists → append role + flag pullRm;
// otherwise create a new user (no password — they set one via magic login / reset link).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { name, email, role, bu } = await req.json()
  const emailLc = String(email || "").toLowerCase().trim()
  if (!emailLc || !role) return NextResponse.json({ error: "email and role are required" }, { status: 400 })
  if (!emailLc.endsWith("@nanyangtextile.com")) return NextResponse.json({ error: "Use a company email (@nanyangtextile.com)" }, { status: 400 })

  const existing = await (prisma.user as any).findUnique({ where: { email: emailLc } })
  if (existing) {
    const roles = [...new Set([...(existing.roles || []), existing.role, role].filter(Boolean))]
    await (prisma.user as any).update({ where: { id: existing.id }, data: { pullRm: true, roles, name: name || existing.name } })
    return NextResponse.json({ ok: true, updated: true })
  }
  const user = await (prisma.user as any).create({
    data: { name: name || null, email: emailLc, role, roles: [role], bu: bu || "NYG", isActive: true, pullRm: true },
  })
  return NextResponse.json({ ok: true, user })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id, pullRm } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const user = await (prisma.user as any).update({ where: { id }, data: { pullRm: !!pullRm }, select: { id: true, pullRm: true } })
  return NextResponse.json({ user })
}
