import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const ROLE_PENDING: Record<string, { statuses: string[]; filterDept: boolean }> = {
  VP_MER:            { statuses: ["PENDING_VP_MER"], filterDept: false },
  SCM_USER:          { statuses: ["PENDING_SCM"], filterDept: false },
  VP_SCM:            { statuses: ["PENDING_SCM", "PENDING_VP_SCM"], filterDept: false },
  PRESIDENT:         { statuses: ["PENDING_PRESIDENT"], filterDept: false },
  LOGISTICS:         { statuses: ["PENDING_LOGISTICS"], filterDept: false },
  DVM_COMMERCIAL:    { statuses: ["PENDING_CLAIM"], filterDept: true },
  DVM_PROCUREMENT:   { statuses: ["PENDING_CLAIM"], filterDept: true },
  DVM_NYK:           { statuses: ["PENDING_CLAIM"], filterDept: true },
  DVM_PRODUCTION:    { statuses: ["PENDING_CLAIM"], filterDept: true },
  CLAIM_COMMERCIAL:  { statuses: ["PENDING_CLAIM"], filterDept: true },
  CLAIM_PROCUREMENT: { statuses: ["PENDING_CLAIM"], filterDept: true },
  CLAIM_NYK:         { statuses: ["PENDING_CLAIM"], filterDept: true },
  CLAIM_PRODUCTION:  { statuses: ["PENDING_CLAIM"], filterDept: true },
  VP_COMMERCIAL:     { statuses: ["PENDING_VP_CLAIM"], filterDept: true },
  VP_PROCUREMENT:    { statuses: ["PENDING_VP_CLAIM"], filterDept: true },
  VP_NYK:            { statuses: ["PENDING_VP_CLAIM", "PENDING_VP_NYK"], filterDept: true },
  VP_PRODUCTION:     { statuses: ["PENDING_VP_CLAIM"], filterDept: true },
}

const deptFromRole = (role: string) =>
  role.startsWith("DVM_") ? role.replace("DVM_", "") :
  role.startsWith("CLAIM_") ? role.replace("CLAIM_", "") :
  role.startsWith("VP_") ? role.replace("VP_", "") : null

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ count: 0 })

  const role = (session.user as any).role
  const config = ROLE_PENDING[role]
  if (!config) return NextResponse.json({ count: 0 })

  const dept = config.filterDept ? deptFromRole(role) : null

  let count = 0
  for (const status of config.statuses) {
    if (dept) {
      const requests = await prisma.airRequest.findMany({
        where: { status },
        include: { items: { where: { claimDepartment: dept }, select: { id: true } } }
      })
      count += requests.filter(r => r.items.length > 0).length
    } else {
      count += await prisma.airRequest.count({ where: { status } })
    }
  }

  return NextResponse.json({ count })
}
