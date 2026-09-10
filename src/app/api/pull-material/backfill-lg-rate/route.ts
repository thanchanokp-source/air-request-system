import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recomputePullAir } from "@/lib/pull-freight"
import { notifyPullStage } from "@/lib/pull-notify"

export const runtime = "nodejs"

// Admin: pull EVERY in-flight/approved doc whose Air rate is still missing back to LG (PENDING_LG_RATE)
// so LG fills the rate before it proceeds — and email LG. Recomputes first (skips docs the master now covers).
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const isAdmin = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("ADMIN")))
  if (!isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })

  const skip = ["COMPLETED", "PENDING_LG_RATE", "RECALLED", "REJECTED", "NO_AIR"]
  const reqs = await (prisma as any).pullMaterialRequest.findMany({
    where: { status: { notIn: skip } }, select: { id: true, documentNo: true },
  })
  const reverted: string[] = []
  for (const r of reqs) {
    await recomputePullAir(r.id).catch(() => {}) // in case the master now has the rate
    const its = await (prisma as any).pullMaterialItem.findMany({ where: { requestId: r.id }, select: { airFreightCost: true, weight: true, port: true } })
    const missing = its.some((i: any) => i.port && Number(i.weight) > 0 && i.airFreightCost == null)
    if (missing) {
      await (prisma as any).pullMaterialRequest.update({ where: { id: r.id }, data: { status: "PENDING_LG_RATE" } })
      await notifyPullStage(r.id, "PENDING_LG_RATE").catch(() => {})
      reverted.push(r.documentNo)
    }
  }
  return NextResponse.json({ ok: true, count: reverted.length, docs: reverted })
}
