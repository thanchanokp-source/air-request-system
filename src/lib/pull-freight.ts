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
// Destination depends on the requesting BU: NYG/GW ship to Bangkok, EA to Vientiane, TRM to Laos.
const DEST_BY_BU: Record<string, string> = { NYG: "BKK", GW: "BKK", EA: "VTE", TRM: "LAOS" }
export const destForBu = (bu: any) => DEST_BY_BU[String(bu || "").toUpperCase()] || "BKK"
// The master uses airport codes; Laos is written as either LAOS or VTE (Vientiane) → treat as equal.
export const destMatches = (docDest: any, rowDest: any) => {
  const a = String(docDest || "BKK").toUpperCase(), b = String(rowDest || "BKK").toUpperCase()
  if (a === b) return true
  const laos = (x: string) => x === "LAOS" || x === "VTE" || x === "VIENTIANE"
  return laos(a) && laos(b)
}

export async function recomputePullAir(reqId: string): Promise<void> {
  const request = await (prisma as any).pullMaterialRequest.findUnique({ where: { id: reqId }, select: { bu: true } })
  const dest = destForBu(request?.bu)
  const items = await (prisma as any).pullMaterialItem.findMany({ where: { requestId: reqId } })
  if (!items.length) return
  const rateRows = await (prisma as any).pullFreightAir.findMany()
  for (const it of items) {
    const w = Number(it.weight) || 0
    const port = it.port
    if (!w || !port) continue
    // Match origin PORT + destination (by BU). Pick the MAX rate at the weight break across forwarders.
    const routes = rateRows.filter((r: any) => r.origin === port && destMatches(dest, r.destination))
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
      data: { airFreightCost: est, originCost: add, leadTimeAir: "3 days" }, // Air lead time = fixed default; originCost = incoterm portion
    }).catch(() => {})
  }
}
