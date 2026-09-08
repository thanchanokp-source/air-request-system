import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Read-only audit of Logistics data entry (LgEntryLog). Admin + any Logistics role.
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const roles = [role, ...(((session.user as any).roles) || [])].filter(Boolean)
  const ok = role === "ADMIN" || roles.some((r: string) => ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "LOGISTICS_SUB"].includes(r))
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const logs = await (prisma as any).lgEntryLog.findMany({ orderBy: { createdAt: "desc" }, take: 3000 })
  return NextResponse.json(logs)
}

// Admin adds/edits the note on a log row.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const email = String((session.user as any).email || "").toLowerCase()
  if (role !== "ADMIN" && email !== "jariya.t@nanyangtextile.com") return NextResponse.json({ error: "Admin only" }, { status: 403 })
  const { id, comment } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await (prisma as any).lgEntryLog.update({ where: { id }, data: { comment: String(comment ?? "").trim() || null } })
  return NextResponse.json({ ok: true })
}
