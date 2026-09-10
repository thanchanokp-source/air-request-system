import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recomputePullAir } from "@/lib/pull-freight"
import { notifyPullStage } from "@/lib/pull-notify"
import { itemHasAnyRate } from "@/lib/pull-courier"

export const runtime = "nodejs"

// Admin: pull EVERY in-flight/approved doc that has NO rate in ANY mode (air + sea + courier all missing)
// back to LG (PENDING_LG_RATE) so LG fills a rate before it proceeds — and email LG. Recomputes first.
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const isAdmin = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("ADMIN")))
  if (!isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })

  // Load the sea + courier masters once (air rate lives on each item after recompute).
  const [seaRows, courierRows] = await Promise.all([
    (prisma as any).pullFreightSea.findMany(),
    (prisma as any).pullFreightCourier.findMany(),
  ])
  const skip = ["COMPLETED", "PENDING_LG_RATE", "RECALLED", "REJECTED", "NO_AIR"]
  const reqs = await (prisma as any).pullMaterialRequest.findMany({
    where: { status: { notIn: skip } }, select: { id: true, documentNo: true, bu: true },
  })
  const reverted: string[] = []
  for (const r of reqs) {
    await recomputePullAir(r.id).catch(() => {}) // in case the master now has the rate
    const its = await (prisma as any).pullMaterialItem.findMany({ where: { requestId: r.id }, select: { airFreightCost: true, weight: true, port: true, seaPort: true } })
    // No Master = an item with a port/weight that has NO rate in air, sea OR courier.
    const missing = its.some((i: any) => i.port && Number(i.weight) > 0 && !itemHasAnyRate(i, seaRows, courierRows, r.bu))
    if (missing) {
      await (prisma as any).pullMaterialRequest.update({ where: { id: r.id }, data: { status: "PENDING_LG_RATE" } })
      await notifyPullStage(r.id, "PENDING_LG_RATE").catch(() => {})
      reverted.push(r.documentNo)
    }
  }
  return NextResponse.json({ ok: true, count: reverted.length, docs: reverted })
}
