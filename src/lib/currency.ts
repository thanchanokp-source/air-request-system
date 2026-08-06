// Currency of a single SO's air-freight amounts. Most BUs price in THB; EA prices in USD for the
// whole BU; and within GW the customer "RHONE" (any spelling starting with RHONE, e.g. "RHONE
// APPAREL INC.") is priced in USD too — so a GW document can mix THB and USD line items.
// Pure function → usable on both server (freight calc) and client (display labels).
export function soCurrency(bu: string | null | undefined, brand: string | null | undefined): "USD" | "THB" {
  if (bu === "EA") return "USD"
  if (bu === "GW" && String(brand || "").trim().toUpperCase().startsWith("RHONE")) return "USD"
  return "THB"
}

export function isUsdSo(bu: string | null | undefined, brand: string | null | undefined): boolean {
  return soCurrency(bu, brand) === "USD"
}

// Split a list of {amount, bu, brand} into per-currency totals for display, e.g. "5,000 THB · 200 USD".
export function splitByCurrency(rows: { amount: number; bu?: string | null; brand?: string | null }[]): { THB: number; USD: number } {
  const t = { THB: 0, USD: 0 }
  for (const r of rows) t[soCurrency(r.bu, r.brand)] += (Number(r.amount) || 0)
  return t
}

// Format the split as a compact string; hides a zero side (both zero → "0 THB").
export function fmtSplit(t: { THB: number; USD: number }, fmt: (n: number) => string = n => n.toLocaleString("en-US", { maximumFractionDigits: 0 })): string {
  const parts: string[] = []
  if (t.THB) parts.push(`${fmt(t.THB)} THB`)
  if (t.USD) parts.push(`${fmt(t.USD)} USD`)
  return parts.length ? parts.join(" · ") : "0 THB"
}
