import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { prodGroupCovers } from "@/lib/claim"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let role = req.nextUrl.searchParams.get("role")
  const bu = req.nextUrl.searchParams.get("bu")
  const priorityParam = req.nextUrl.searchParams.get("priority")
  if (!role) return NextResponse.json([])
  // Production VP/EVP share role CLAIM_PRODUCTION; the factory group lives in
  // claimDepartment. nextPositionRole encodes the group as a role suffix (_G1G3 /
  // _G2G4) → strip it and match by normalized G-group (so "G1", "G3", "G1/G3" all fit).
  let groupFilter: string | null = null
  if (role.endsWith("_G1G3")) { role = role.slice(0, -5); groupFilter = "G1/G3" }
  else if (role.endsWith("_G2G4")) { role = role.slice(0, -5); groupFilter = "G2/G4" }
  const priorityFilter = priorityParam != null && priorityParam !== "" ? { priority: Number(priorityParam) } : {}
  // A person can hold multiple roles → match the primary `role` OR any in `roles[]`.
  let users = await (prisma.user as any).findMany({
    where: {
      isActive: true,
      // Cross-BU claim roles (SCM_NYG, Claim/VP-Production, SCM NYK) carry bu = "ALL" —
      // include them alongside the requested BU so pickers/chains don't drop them.
      ...(bu ? { bu: { in: [bu, "ALL"] } } : {}),
      ...priorityFilter,
      OR: [{ role }, { roles: { has: role } }],
    },
    select: { id: true, name: true, email: true, role: true, priority: true, claimDepartment: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  })
  if (groupFilter) users = users.filter((u: any) => prodGroupCovers(u.claimDepartment, groupFilter))
  return NextResponse.json(users)
}
