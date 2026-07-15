import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Lightweight directory of claim ENTRY approvers (auto-notified position-0 holders),
// so the UI can show WHO each pending dept is currently waiting on — resolved in-memory
// (one fetch), no per-row queries. Forwarded positions carry their own name already.
const ENTRY_ROLES = [
  "DVM_MER", "CLAIM_PRODUCTION", "CLAIM_PROCUREMENT",
  "SCM_NYK_APPROVER", "SCM_NYG", "CLAIM_GW",
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const users = await (prisma.user as any).findMany({
    where: {
      isActive: true,
      OR: [{ role: { in: ENTRY_ROLES } }, { roles: { hasSome: ENTRY_ROLES } }],
    },
    select: {
      email: true, name: true, role: true, roles: true, bu: true,
      priority: true, claimDepartment: true, procurementType: true,
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })
  return NextResponse.json(users)
}
