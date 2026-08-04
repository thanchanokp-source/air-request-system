import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Forward-target picker for the LG handoff: all LG-capable people (subordinates + seniors),
// so a senior can hand a document to whoever should continue it.
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const meId = (session.user as any).id
  const roles = ["LOGISTICS_SUB", "LOGISTICS", "LOGISTICS_TRM", "LOGISTICS_GW"]
  const users = await (prisma.user as any).findMany({
    where: { isActive: true, OR: [{ role: { in: roles } }, { roles: { hasSome: roles } }] },
    select: { id: true, name: true, email: true, role: true, roles: true, bu: true },
    orderBy: [{ name: "asc" }],
  })
  return NextResponse.json(users.filter((u: any) => u.id !== meId))
}
