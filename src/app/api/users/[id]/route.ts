import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  try {
    const { name, email, password, role, title, roles, bu, isActive, priority, claimDepartment, procurementType } = await req.json()
    const emailLc = String(email || "").toLowerCase().trim()
    // Guard: email is unique. If another user already owns this email, reject clearly
    // (to give ONE person several roles, don't create/rename to a shared email — use the
    // multi-role "Add role" flow which appends to their roles[]).
    if (emailLc) {
      const clash = await (prisma.user as any).findUnique({ where: { email: emailLc }, select: { id: true } })
      if (clash && clash.id !== id) {
        return NextResponse.json({ error: `Email ${emailLc} already belongs to another user — if one person should hold multiple roles, add the role to their existing account instead of creating/changing to a duplicate email` }, { status: 409 })
      }
    }
    // GW-only roles always belong to BU "GW". SCM_NYK* exist in BOTH BU → bu from form.
    const isGwOnlyRole = role.endsWith("_GW") || role.startsWith("SCM_NYG")
    const data: any = { name, email: emailLc, role, title: title ?? null, bu: isGwOnlyRole ? "GW" : (bu || "NYG"), isActive, priority: priority ?? null }
    // Keep the multi-role list: use an explicit `roles` if sent, else preserve the
    // person's existing extra roles and just ensure the primary role is included.
    const existing = await (prisma.user as any).findUnique({ where: { id }, select: { roles: true } })
    const baseRoles: string[] = Array.isArray(roles) ? roles : ((existing?.roles && existing.roles.length) ? existing.roles : [])
    data.roles = Array.from(new Set([role, ...baseRoles]))
    const needsDept = ["CLAIM_GW","SCM_NYK","SCM_NYG","CLAIM_PRODUCTION","VP_PRODUCTION"].includes(role)
    data.claimDepartment = needsDept ? (claimDepartment || null) : null
    const isProcurement = role === "CLAIM_PROCUREMENT" || role === "DVM_PROCUREMENT"
    data.procurementType = isProcurement ? (procurementType || null) : null
    if (password) data.password = await bcrypt.hash(password, 10)
    const user = await prisma.user.update({ where: { id }, data })
    return NextResponse.json({ id: user.id })
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "This email is already used by another user" }, { status: 409 })
    console.error("[users PATCH] error:", e)
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // P2003 = foreign-key constraint: the user is referenced by existing documents
    // (created / approved / uploaded). Deleting would orphan those rows.
    if (e?.code === "P2003" || e?.code === "P2014") {
      return NextResponse.json({ error: "This user is linked to existing documents (created/approved/uploaded before), so it cannot be deleted — we recommend disabling Status instead" }, { status: 409 })
    }
    console.error("[users DELETE] error:", e)
    return NextResponse.json({ error: e?.message || "Delete failed" }, { status: 500 })
  }
}
