import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendPasswordSetupEmail } from "@/lib/notify"
import crypto from "crypto"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const users = await (prisma.user as any).findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, roles: true, bu: true, claimDepartment: true, procurementType: true, isActive: true, priority: true, createdAt: true }
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, email, role, bu, claimDepartment, priority, procurementType, sendEmail } = await req.json()
  if (!email || !role) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const token = crypto.randomUUID()
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const isProcurement = role === "CLAIM_PROCUREMENT" || role === "DVM_PROCUREMENT"
  // GW-only roles always belong to BU "GW". SCM_NYK* exist in BOTH BU, so their
  // bu comes from the selected master role (form).
  const isGwOnlyRole = role.endsWith("_GW") || role.startsWith("SCM_NYG")
  const resolvedBu = isGwOnlyRole ? "GW" : (bu || "NYG")

  const emailLc = email.toLowerCase()
  try {
    // 1 person can hold MANY roles: if the email already exists, just ADD this role
    // to their roles[] (so they show up in that role's approver dropdown) — don't
    // create a duplicate account.
    const existing = await (prisma.user as any).findUnique({ where: { email: emailLc } })
    if (existing) {
      const current: string[] = (existing.roles && existing.roles.length) ? existing.roles : [existing.role]
      const roles = Array.from(new Set([...current, role]))
      // Append the role AND apply its priority / claim dept (so a multi-role person
      // added via "Add" is ordered correctly in the NEW role's approval chain). The
      // primary role/BU stay unchanged — this only ADDS a position.
      const upd: any = { roles }
      if (priority != null) upd.priority = priority
      if (["CLAIM_GW", "SCM_NYK", "SCM_NYG", "CLAIM_PRODUCTION", "VP_PRODUCTION"].includes(role) && claimDepartment) upd.claimDepartment = claimDepartment
      if (isProcurement && procurementType) upd.procurementType = procurementType
      await (prisma.user as any).update({ where: { id: existing.id }, data: upd })
      if (current.includes(role)) return NextResponse.json({ id: existing.id, alreadyHadRole: true, updated: true })
      return NextResponse.json({ id: existing.id, addedRole: role, multiRole: true })
    }

    const user = await (prisma.user as any).create({
      data: {
        name, email: emailLc, password: null,
        role, roles: [role], bu: resolvedBu,
        claimDepartment: ["CLAIM_GW", "SCM_NYK", "SCM_NYG", "CLAIM_PRODUCTION", "VP_PRODUCTION"].includes(role) ? (claimDepartment || null) : null,
        procurementType: isProcurement ? (procurementType || null) : null,
        priority: priority ?? null,
        isActive: false,
        resetToken: token,
        resetTokenExpiry: expiry,
      }
    })
    if (sendEmail) {
      sendPasswordSetupEmail(email, name || email, token).catch(() => {})
    }
    return NextResponse.json({ id: user.id })
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "This email is already registered" }, { status: 409 })
    console.error("[users POST] error:", e)
    return NextResponse.json({ error: e?.message || "Create failed" }, { status: 500 })
  }
}
