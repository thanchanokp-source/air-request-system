import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// MER Drop Queue — SOs a claim approver flagged for MER to drop (data wrong). The doc stays at its claim
// stage; only these flagged SOs surface here for MER to delete (or unflag/keep). NYG/EA/TRM (not GW).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles: string[] = [(session.user as any)?.role, ...(((session.user as any)?.roles) || [])].filter(Boolean)
  const allowed = roles.includes("ADMIN") || roles.some(r => ["MER_USER", "MER_EA", "MER_TRM"].includes(r))
  if (!allowed) return NextResponse.json({ error: "Merchandise / Admin only", rows: [] }, { status: 403 })

  const items = await (prisma as any).airRequestItem.findMany({
    where: { dropRequested: true, request: { bu: { not: "GW" } } },
    select: {
      id: true, so: true, sub: true, style: true, brand: true, qtyRequestAir: true,
      dropReason: true, dropRequestedBy: true,
      request: { select: { id: true, documentNo: true, bu: true, status: true } },
    },
    orderBy: { so: "asc" },
  }).catch(() => [])

  const rows = items.map((i: any) => ({
    itemId: i.id, requestId: i.request?.id, documentNo: i.request?.documentNo, bu: i.request?.bu, docStatus: i.request?.status,
    so: i.so, sub: i.sub, style: i.style, brand: i.brand, qty: i.qtyRequestAir,
    reason: i.dropReason, by: i.dropRequestedBy,
  }))
  return NextResponse.json({ rows, count: rows.length })
}
