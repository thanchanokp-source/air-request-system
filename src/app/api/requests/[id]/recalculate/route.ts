import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recomputeRequestFreight } from "@/lib/freight"

// Admin "Recalculate" — recompute Gross Weight (= QTY Air × WT Charge) AND Est. Air Freight
// (= Gross × rate) for EVERY item from the CURRENT Master data. Fixes documents created before
// a Master Description WT Charge / Master Rate was added (their Gross was frozen at 0). Also
// clears the pending-master holds if everything now resolves.
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const request = await prisma.airRequest.findUnique({ where: { id }, include: { items: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Recompute Gross + Est. from current Master (WT Charge + rate).
  await recomputeRequestFreight(id)

  // Re-evaluate the holds: clear pendingWeight / pendingRate if every item now resolves.
  const items = await prisma.airRequestItem.findMany({ where: { requestId: id } })
  const wtOk = items.filter(i => i.description).every(i => (i.grossWeight || 0) > 0)
  const rateOk = items.filter(i => i.country).every(i => (i.marketRatePerKg || 0) > 0)
  await (prisma.airRequest as any).update({ where: { id }, data: { pendingWeight: !wtOk, pendingRate: !rateOk } }).catch(() => {})

  return NextResponse.json({ ok: true, updated: items.length })
}
