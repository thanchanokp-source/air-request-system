// Client-safe courier helpers (no prisma import) for the shipping-mode compare box.
// Courier master rates are in THB per weight tier → divide by EXCHANGE_RATE to show USD.
export const EXCHANGE_RATE = 32

// Destination by requesting BU (same rule as air): NYG/GW → BKK, EA → VTE, TRM → LAOS.
export const destForBu = (bu: any) => (({ NYG: "BKK", GW: "BKK", EA: "VTE", TRM: "LAOS" } as Record<string, string>)[String(bu || "").toUpperCase()] || "BKK")

// Courier weight tiers (kg, ascending) — the price column is the TOTAL for a shipment up to that tier.
const TIERS = [0.5, 1, 2, 3, 5, 10, 15, 20, 25, 30]

// Look up the courier price (USD) for a carrier at origin PORT + DEST for the given weight.
// Courier only covers small parcels (≤ 30 kg) — heavier shipments return null.
export function courierUsd(rows: any[], port: string, dest: string, weightKg: number, carrier: string): number | null {
  if (!weightKg || weightKg > 30) return null
  const tier = TIERS.find(t => t >= weightKg)
  if (tier == null) return null
  const P = String(port || "").toUpperCase(), D = String(dest || "").toUpperCase(), C = carrier.toUpperCase()
  const r = (rows || []).find(x =>
    String(x.origin || "").toUpperCase() === P &&
    String(x.destination || "BKK").toUpperCase() === D &&
    String(x.carrier || "").toUpperCase().includes(C))
  if (!r) return null
  const thb = Number((r.rates || {})[String(tier)])
  if (!thb || isNaN(thb)) return null
  return Math.round((thb / EXCHANGE_RATE) * 100) / 100
}
