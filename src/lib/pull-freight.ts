import { prisma } from "@/lib/prisma"

// Air weight breaks (kg minimums) → the Q-column key. 150kg → Q100 (100 ≤ 150 < 250).
const BREAK_ORDER = [45, 100, 250, 300, 500, 1000, 2000, 8000]
const breakKey = (w: number) => { let b = 45; for (const x of BREAK_ORDER) if (x <= w) b = x; return "Q" + b }

// Auto-compute Est Air (+ Air lead time) for every item of a Pull Material request, straight from the
// AIR master — so Logistics no longer needs to key anything before approval. Rules:
//   • chargeable weight = the weight Purchasing entered, used DIRECTLY (no ×qty)
//   • Est Air = weight × rate(port, break) + origin cost (EX-WORK → EXW, FCA → FCA, else 0)
//   • same port → pick the MAXIMUM rate at that break; Air L/T = that route's TT
// Called when Purchasing forwards the doc (or whenever port/weight/incoterm change pre-approval).
export async function recomputePullAir(reqId: string): Promise<void> {
  const items = await (prisma as any).pullMaterialItem.findMany({ where: { requestId: reqId } })
  if (!items.length) return
  const rateRows = await (prisma as any).pullFreightAir.findMany()
  for (const it of items) {
    const w = Number(it.weight) || 0
    const port = it.port
    if (!w || !port) continue
    const routes = rateRows.filter((r: any) => r.origin === port)
    if (!routes.length) continue
    const bk = breakKey(w)
    const cand = routes
      .map((r: any) => ({ rate: Number((r.rates || {})[bk]), tt: r.tt, exw: Number(r.origCostExw) || 0, fca: Number(r.origCostFca) || 0 }))
      .filter((x: any) => x.rate && !isNaN(x.rate))
    if (!cand.length) continue
    const best = cand.reduce((a: any, b: any) => (b.rate > a.rate ? b : a))
    const inc = String(it.incoterm || "").toUpperCase()
    const add = inc === "EX-WORK" ? best.exw : inc === "FCA" ? best.fca : 0
    const est = Math.round((best.rate * w + add) * 100) / 100
    await prisma.pullMaterialItem.update({
      where: { id: it.id },
      data: { airFreightCost: est, leadTimeAir: best.tt || null },
    }).catch(() => {})
  }
}
