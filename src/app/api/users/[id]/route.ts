import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { name, email, password, role, roles, bu, isActive, priority, claimDepartment, procurementType } = await req.json()
  // GW-only roles always belong to BU "GW". SCM_NYK* exist in BOTH BU → bu from form.
  const isGwOnlyRole = role.endsWith("_GW") || role.startsWith("SCM_NYG")
  const data: any = { name, email, role, bu: isGwOnlyRole ? "GW" : (bu || "NYG"), isActive, priority: priority ?? null }
  // Keep the multi-role list: use an explicit `roles` if sent, else preserve the
  // person's existing extra roles and just ensure the primary role is included.
  const existing = await (prisma.user as any).findUnique({ where: { id }, select: { roles: true } })
  const baseRoles: string[] = Array.isArray(roles) ? roles : ((existing?.roles && existing.roles.length) ? existing.roles : [])
  data.roles = Array.from(new Set([role, ...baseRoles]))
  const needsDept = ["CLAIM_GW","SCM_NYK","SCM_NYG"].includes(role)
  data.claimDepartment = needsDept ? (claimDepartment || null) : null
  const isProcurement = role === "CLAIM_PROCUREMENT" || role === "DVM_PROCUREMENT"
  data.procurementType = isProcurement ? (procurementType || null) : null
  if (password) data.password = await bcrypt.hash(password, 10)
  const user = await prisma.user.update({ where: { id }, data })
  return NextResponse.json({ id: user.id })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
