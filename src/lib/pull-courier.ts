// Client-safe courier helpers (no prisma import) for the shipping-mode compare box.
// Courier master rates are in THB per weight tier → divide by EXCHANGE_RATE to show USD.
export const EXCHANGE_RATE = 32

// Destination by requesting BU (same rule as air): NYG/GW → BKK, EA → VTE, TRM → LAOS.
export const destForBu = (bu: any) => (({ NYG: "BKK", GW: "BKK", EA: "VTE", TRM: "LAOS" } as Record<string, string>)[String(bu || "").toUpperCase()] || "BKK")

// Sea freight (USD) from the SEA master — use the LCL rate only (per-shipment, comparable to air/courier;
// FCL 40'/20' container rates are ignored). Sea master rates are already USD (no /32).
export function seaUsd(rows: any[], seaPort: string): { cost: number; container: string } | null {
  if (!seaPort) return null
  const P = String(seaPort || "").toUpperCase()
  const matches = (rows || []).filter(x => String(x.port || "").toUpperCase() === P && Number(x.rate) > 0 && String(x.container || "").toUpperCase().includes("LCL"))
  if (!matches.length) return null
  const best = matches.reduce((a, b) => (Number(b.rate) < Number(a.rate) ? b : a))
  return { cost: Number(best.rate), container: String(best.container || "LCL") }
}

// A Pull item is "No Master" only when it has NO rate in ANY mode — air, sea AND courier are all missing
// for its port. If any single mode has a master rate, the item is considered covered.
export function itemHasAnyRate(item: any, seaRows: any[], courierRows: any[], bu: any): boolean {
  if (item?.airFreightCost != null) return true
  const dest = destForBu(bu)
  if (seaUsd(seaRows, item?.seaPort || item?.port)) return true
  const wt = Number(item?.weight) || 0
  if (courierUsd(courierRows, item?.port, dest, wt, "DHL") != null) return true
  if (courierUsd(courierRows, item?.port, dest, wt, "FEDEX") != null) return true
  return false
}

// Courier weight tiers (kg, ascending) — the price column is the TOTAL for a shipment up to that tier.
const TIERS = [0.5, 1, 2, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45]
// Courier is offered up to this weight; anything heavier is NOT priced by courier at all.
export const COURIER_MAX_KG = 45

// Look up the courier price (USD) for a carrier at origin PORT + DEST for the given weight.
// Courier only covers parcels ≤ COURIER_MAX_KG (45 kg) — heavier shipments return null.
export function courierUsd(rows: any[], port: string, dest: string, weightKg: number, carrier: string): number | null {
  if (!weightKg || weightKg > COURIER_MAX_KG) return null
  const P = String(port || "").toUpperCase(), D = String(dest || "").toUpperCase(), C = carrier.toUpperCase()
  const laos = (x: string) => x === "LAOS" || x === "VTE" || x === "VIENTIANE"
  const destOk = (rd: string) => { const b = String(rd || "BKK").toUpperCase(); return b === D || (laos(D) && laos(b)) }
  const r = (rows || []).find(x =>
    String(x.origin || "").toUpperCase() === P &&
    destOk(x.destination) &&
    String(x.carrier || "").toUpperCase().includes(C))
  if (!r) return null
  const rates = r.rates || {}
  // Tiers that actually have a price, ascending. Pick the smallest priced tier ≥ weight; if the weight is
  // above every priced tier (e.g. 30 < w ≤ 45 but the master only goes to 30 kg) use the largest priced tier.
  const priced = TIERS.filter(t => { const v = rates[String(t)]; return v != null && v !== "" && !isNaN(Number(v)) })
  if (!priced.length) return null
  const tier = priced.find(t => t >= weightKg) ?? priced[priced.length - 1]
  const thb = Number(rates[String(tier)])
  if (!thb || isNaN(thb)) return null
  return Math.round((thb / EXCHANGE_RATE) * 100) / 100
}
