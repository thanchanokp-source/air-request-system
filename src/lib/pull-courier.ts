// Client-safe courier helpers (no prisma import) for the shipping-mode compare box.
// Courier master rates are in THB per weight tier → divide by EXCHANGE_RATE to show USD.
export const EXCHANGE_RATE = 32.5

// Destination by requesting BU (same rule as air): NYG/GW → BKK, EA → VTE, TRM → LAOS.
export const destForBu = (bu: any) => (({ NYG: "BKK", GW: "BKK", EA: "VTE", TRM: "LAOS" } as Record<string, string>)[String(bu || "").toUpperCase()] || "BKK")

// Sea freight (USD) from the SEA master — LCL rate only (per-shipment, comparable to air/courier;
// FCL 40'/20' rates are ignored). Sea master rates are already USD (no /32).
// Matching is forgiving because the doc carries the AIR PORT CODE (e.g. "HKG") while LG keys the SEA
// master by full name ("HONGKONG"): match on exact port, OR country CONTAINS (either direction), OR the
// sea port name contains the country — so "HONG KONG" ↔ "HONGKONG" links up. Spaces/punctuation ignored.
export function seaUsd(rows: any[], seaPort: string, country?: string): { cost: number; container: string } | null {
  const norm = (s: any) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const P = norm(seaPort), C = norm(country)
  if (!P && !C) return null
  const contains = (a: string, b: string) => !!a && !!b && (a.includes(b) || b.includes(a))
  const matches = (rows || []).filter(x => {
    if (!(Number(x.rate) > 0 && String(x.container || "").toUpperCase().includes("LCL"))) return false
    const xp = norm(x.port), xc = norm(x.country)
    if (P && xp === P) return true          // exact air-port code / port name
    if (C && contains(xc, C)) return true    // sea row's COUNTRY ~ doc country
    if (C && contains(xp, C)) return true    // sea PORT full name ~ doc country (HKG doc, HONGKONG master)
    return false
  })
  if (!matches.length) return null
  // Multiple LCL rows can match one port/country → take the MAX freight (worst-case, same rule as air).
  const best = matches.reduce((a, b) => (Number(b.rate) > Number(a.rate) ? b : a))
  return { cost: Number(best.rate), container: String(best.container || "LCL") }
}

// A Pull item is "No Master" only when it has NO rate in ANY mode — air, sea AND courier are all missing
// for its port. If any single mode has a master rate, the item is considered covered.
export function itemHasAnyRate(item: any, seaRows: any[], courierRows: any[], bu: any): boolean {
  if (item?.airFreightCost != null) return true
  const dest = destForBu(bu)
  if (seaUsd(seaRows, item?.seaPort || item?.port, item?.country)) return true
  const wt = Number(item?.weight) || 0
  if (courierUsd(courierRows, item?.port, dest, wt, "DHL") != null) return true
  if (courierUsd(courierRows, item?.port, dest, wt, "FEDEX") != null) return true
  return false
}

// ── Full LANDED-COST compare (Air / Courier / Sea) — every value in USD (baht ÷ EXCHANGE_RATE 32.5).
// Thailand-side charges (local / store / transport) apply to NYG only. One source of truth for the
// purchase form, LG and Approval pages. Air weight breaks + LAOS↔VTE aliasing mirror the backend.
const LC_BREAKS = [45, 100, 250, 300, 500, 1000, 2000, 8000]
const lcBreakKey = (w: number) => { let b = 45; for (const x of LC_BREAKS) if (x <= w) b = x; return "Q" + b }
const lcCbm = (w: number) => (w < 500 ? 1 : w <= 700 ? 2 : w <= 1000 ? 3 : 5)
const lcUp = (s: any) => String(s || "").toUpperCase()
export type LandedLine = { freight: number; fca: number; clear: number; local: number; store: number; transport: number; total: number; cbm?: number }
export function pullLandedCost(o: { airRows: any[]; seaRows: any[]; courierRows: any[]; truckRows: any[]; port?: any; seaPort?: any; country?: any; weight?: any; incoterm?: any; bu?: any; factory?: any }) {
  const w = Number(o.weight) || 0, port = o.port, dest = destForBu(o.bu)
  if (!w || (!port && !o.seaPort)) return null
  const R = EXCHANGE_RATE, r2 = (v: number) => Math.round(v * 100) / 100
  const isNyg = lcUp(o.bu) === "NYG"
  const clear = r2(1000 / R)
  // AIR — max rate at the weight break for origin+dest × weight + origin cost (EXW/FCA).
  const inc = lcUp(o.incoterm)
  const routes = (o.airRows || []).filter((r: any) => lcUp(r.origin) === lcUp(port))
  const bk = lcBreakKey(w)
  const cand = routes.map((r: any) => ({ rate: Number((r.rates || {})[bk]), exw: Number(r.origCostExw) || 0, fca: Number(r.origCostFca) || 0 })).filter((x: any) => x.rate && !isNaN(x.rate))
  let air: LandedLine | null = null
  if (cand.length) {
    const best = cand.reduce((a: any, b: any) => (b.rate > a.rate ? b : a))
    const add = inc === "EX-WORK" ? best.exw : inc === "FCA" ? best.fca : 0
    const freight = r2(best.rate * w), fca = r2(add)
    const local = isNyg ? r2((2 * w) / R) : 0, store = isNyg ? r2((4.5 * w) / R) : 0
    const transport = isNyg ? (truckTransportUsd(o.truckRows, o.factory, "air", w) || 0) : 0
    air = { freight, fca, clear, local, store, transport, total: r2(freight + fca + clear + local + store + transport) }
  }
  // COURIER (DHL) — freight only.
  const dhl = courierUsd(o.courierRows, port, dest, w, "DHL")
  const courier: LandedLine | null = dhl != null ? { freight: dhl, fca: 0, clear: 0, local: 0, store: 0, transport: 0, total: dhl } : null
  // SEA — LCL rate (USD/CBM) × cbm; local = 2500×cbm, store = 1500 (NYG).
  const seaM = seaUsd(o.seaRows, o.seaPort || port, o.country)
  const cbm = lcCbm(w)
  let sea: LandedLine | null = null
  if (seaM) {
    const freight = r2(seaM.cost * cbm)
    const local = isNyg ? r2((2500 * cbm) / R) : 0, store = isNyg ? r2(1500 / R) : 0
    const transport = isNyg ? (truckTransportUsd(o.truckRows, o.factory, "sea", w) || 0) : 0
    sea = { freight, fca: 0, clear, local, store, transport, total: r2(freight + clear + local + store + transport), cbm }
  }
  return { air, courier, sea, over: w > 100, isNyg }
}

// Transport (port/airport → factory) from the TRUCK master, in USD (rate is THB → ÷ EXCHANGE_RATE).
// AIR ships via BKK Airport, SEA via Bangkok Port. Factory (G1-G4) matched by "contains" on location.
// Weight < 1 ton (1000kg) → LCL 4-wheel rate; ≥ 1 ton → LCL 6-wheel rate.
export function truckTransportUsd(rows: any[], factory: string, mode: "air" | "sea", weightKg: number): number | null {
  const f = String(factory || "").trim().toUpperCase()
  if (!f || !rows?.length) return null
  const group = mode === "air" ? "BKK_AIRPORT" : "BANGKOK_PORT"
  const match = rows.find((r: any) => String(r.portGroup) === group && String(r.location || "").toUpperCase().includes(f))
  if (!match) return null
  const thb = Number(weightKg < 1000 ? match.rateLcl1 : match.rateLcl2)
  if (!thb || isNaN(thb)) return null
  return Math.round((thb / EXCHANGE_RATE) * 100) / 100
}

// Courier weight tiers (kg, ascending) — the price column is the TOTAL for a shipment up to that tier.
// Matches the courier master columns: 29 / 30 / 40 / 45 / 50 / 75 / 100 KG (smallest tier ≥ weight is used,
// so a ≤29 kg parcel is priced at the 29KG column).
const TIERS = [29, 30, 40, 45, 50, 75, 100]
// Courier is offered up to this weight; anything heavier is NOT priced by courier at all.
export const COURIER_MAX_KG = 100

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
