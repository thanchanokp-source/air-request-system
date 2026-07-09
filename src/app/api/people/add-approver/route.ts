import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyAdminAddPerson } from "@/lib/notify"

// Self-service: a claim approver can add the person for the required position when
// they aren't in the master yet. Creates/updates a User with that exact role + BU
// so they immediately become selectable (and can log in via magic link later).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { email, name, role, bu, requestId, position } = await req.json()
    const mail = String(email || "").trim().toLowerCase()
    if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 })
    }
    if (!role) return NextResponse.json({ error: "Missing role for this position" }, { status: 400 })

    const displayName = String(name || "").trim() || mail.split("@")[0]
    const buVal = String(bu || "").trim() || "GW"

    const existingU = await (prisma.user as any).findUnique({ where: { email: mail }, select: { priority: true } })
    let priority: number | null = existingU?.priority ?? null
    if (priority == null) {
      const maxP = await (prisma.user as any).aggregate({ where: { role: String(role), bu: buVal }, _max: { priority: true } })
      priority = ((maxP._max.priority as number) ?? 0) + 1
    }
    const user = await (prisma.user as any).upsert({
      where: { email: mail },
      create: { email: mail, name: displayName, role: String(role), bu: buVal, isActive: true, priority },
      update: { role: String(role), bu: buVal, isActive: true, priority, ...(name ? { name: displayName } : {}) },
    })

    // Let Admin know a person was added self-service (awaited — Vercel drops un-awaited work).
    await notifyAdminAddPerson({
      position: String(position || role),
      suggestedName: `${displayName} <${mail}>`,
      requesterName: (session.user as any)?.name || (session.user as any)?.email,
      requestId, bu: buVal,
    })

    return NextResponse.json({ ok: true, name: user.name || displayName, email: user.email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to add" }, { status: 500 })
  }
}
