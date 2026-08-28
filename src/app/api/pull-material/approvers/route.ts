import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Active holders of each Pull Material stage role → used to show the actual approver NAME per stage
// in the approval stepper (any logged-in user may read this; it is name/email only).
const ROLES = ["PURCHASING", "LOGISTICS_IMPORT", "SCM_PULL", "VP_SCM", "PULL_PRESIDENT", "DVM_PUR", "VP_PUR"]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const users = await (prisma.user as any).findMany({
    where: { isActive: true, OR: [{ role: { in: ROLES } }, { roles: { hasSome: ROLES } }] },
    select: { name: true, email: true, role: true, roles: true },
  })
  return NextResponse.json({ users })
}
