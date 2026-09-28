import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Master signatures of the VP Merchandise approvers (Nuttareeporn H / Isawaruk T …), keyed by name.
// Used to STAMP the VP MER signature on a PDF when the doc has no real approval signature yet
// (e.g. auto-add prepaid docs) so Logistics can process without waiting for a formal sign-off.
const VP_MER_ROLES = ["VP_MER", "VP_MER_EA", "VP_MER_TRM", "VP_MER_GW"]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ signatures: {} }, { status: 401 })
  const users = await (prisma.user as any).findMany({
    where: { isActive: true, signatureData: { not: null }, OR: [{ role: { in: VP_MER_ROLES } }, { roles: { hasSome: VP_MER_ROLES } }] },
    select: { name: true, signatureData: true },
  }).catch(() => [])
  const signatures: Record<string, string> = {}
  for (const u of users) if (u.name && u.signatureData) signatures[u.name] = u.signatureData
  return NextResponse.json({ signatures })
}
