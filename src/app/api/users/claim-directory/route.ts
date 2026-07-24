import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Lightweight directory of claim ENTRY approvers (auto-notified position-0 holders),
// so the UI can show WHO each pending dept is currently waiting on — resolved in-memory
// (one fetch), no per-row queries. Forwarded positions carry their own name already.
const ENTRY_ROLES = [
  // Claim entry approvers (Commercial = DVM MER, the upload approver)
  "DVM_MER", "CLAIM_PRODUCTION", "CLAIM_PROCUREMENT",
  "SCM_NYK_APPROVER", "SCM_NYG", "CLAIM_GW",
  // Main linear-stage approvers (so the chain can show who each stage waits on)
  "VP_MER", "VP_MER_GW", "GM_GW", "SCM_USER", "VP_SCM",
  "LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "PRESIDENT", "PRESIDENT_GW",
  // TRM merch approvers (so their names resolve in the Waiting line)
  "DVM_MER_TRM", "VP_MER_TRM",
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
