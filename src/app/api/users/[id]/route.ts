import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { name, email, password, role, bu, isActive, priority, claimDepartment, procurementType } = await req.json()
  const data: any = { name, email, role, bu: bu || "NYG", isActive, priority: priority ?? null }
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
