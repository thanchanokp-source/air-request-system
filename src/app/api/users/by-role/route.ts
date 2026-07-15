import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let role = req.nextUrl.searchParams.get("role")
  const bu = req.nextUrl.searchParams.get("bu")
  const priorityParam = req.nextUrl.searchParams.get("priority")
  if (!role) return NextResponse.json([])
  // Production VP/EVP share role CLAIM_PRODUCTION; the factory group lives in
  // claimDepartment ("G1/G3" / "G2/G4"). nextPositionRole encodes the group as a
  // role suffix (_G1G3 / _G2G4) → strip it and filter by claimDepartment instead.
  let claimDeptFilter: string | null = null
  if (role.endsWith("_G1G3")) { role = role.slice(0, -5); claimDeptFilter = "G1/G3" }
  else if (role.endsWith("_G2G4")) { role = role.slice(0, -5); claimDeptFilter = "G2/G4" }
  const priorityFilter = priorityParam != null && priorityParam !== "" ? { priority: Number(priorityParam) } : {}
  // A person can hold multiple roles → match the primary `role` OR any in `roles[]`.
  const users = await (prisma.user as any).findMany({
    where: {
      isActive: true,
      ...(bu ? { bu } : {}),
      ...(claimDeptFilter ? { claimDepartment: claimDeptFilter } : {}),
      ...priorityFilter,
      OR: [{ role }, { roles: { has: role } }],
    },
    select: { id: true, name: true, email: true, role: true, priority: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  })
  return NextResponse.json(users)
}
