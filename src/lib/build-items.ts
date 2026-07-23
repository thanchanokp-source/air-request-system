// Build AirRequestItem create-data from raw uploaded Excel rows.
//
// This MIRRORS the item-mapping logic in src/app/api/requests/route.ts (the New Request POST)
// so a RE-UPLOAD (replace-all) during resubmit produces items identical to a fresh upload —
// same Gross/Est. freight, same claim-split parsing. It is kept in a SEPARATE file (used only
// by the re-upload endpoint) so the critical New-Request path is never touched.
//
// ⚠ If the mapping in route.ts POST changes, update this to match.

import { prisma } from "@/lib/prisma"
import { canonCountry } from "@/lib/freight"
import { normalizeSo } from "@/lib/so"
import { forceImportReason } from "@/lib/claim"

// Normalize a year that may be 2-digit or Thai Buddhist (B.E.) to Gregorian.
const normYear = (y: number): number => {
  if (y < 100) return y + 2000
  if (y >= 2400 && y <= 2600) return y - 543
  return y
}

const parseDate = (val: any): Date | null => {
  if (val == null || val === "") return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(val).trim()
  if (!s) return null
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/)
  if (m) { const d = new Date(normYear(+m[1]), +m[2] - 1, +m[3]); return isNaN(d.getTime()) ? null : d }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    const a = +m[1], b = +m[2]; const year = normYear(+m[3])
    let dd: number, mm: number
    if (a > 12 && b <= 12) { dd = a; mm = b }
    else if (b > 12 && a <= 12) { mm = a; dd = b }
    else { dd = a; mm = b }
    const d = new Date(year, mm - 1, dd); return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const col = (item: any, key: string) => {
  const k = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase()) ?? key
  return item[k]
}
const colLike = (item: any, ...subs: string[]) => {
  const k = Object.keys(item).find(k => { const lk = k.toLowerCase(); return subs.every(s => lk.includes(s.toLowerCase())) })
  return k ? item[k] : ""
}
const numOf = (v: any) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isNaN(n) ? 0 : n }

const descKey = (s: string) => String(s || "").trim().toUpperCase().replace(/\s*,\s*/g, ",").replace(/\s+/g, " ")
const rateKey = (country: string) => canonCountry(country)

const lev = (a: string, b: string) => {
  const m = a.length, n = b.length
  if (!m) return n; if (!n) return m
  const dp = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[n]
}
const FUZZY_MIN = 0.85

export interface BuildItemsResult {
  items: any[]
  missingRates: { country: string }[]
  missingDescriptions: string[]
}

// Build the item create-data array (identical shape to route.ts POST's items.create).
export async function buildRequestItems(
  rows: any[],
  opts: { isGW: boolean; isEA?: boolean; isHistorical?: boolean }
): Promise<BuildItemsResult> {
  const { isGW, isHistorical = false } = opts
  const items = rows

  const combos = [...new Map(items
    .map((i: any) => ({ country: String(col(i, "Country") || "").trim() }))
    .filter((x: any) => x.country)
    .map((x: any) => [rateKey(x.country), x])).values()] as { country: string }[]

  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true }, orderBy: { updatedAt: "asc" } })
  const freightRates: Record<string, number> = {}
  for (const r of rateList) freightRates[rateKey(r.country)] = r.ratePerKg
  const missingRates = combos.filter(x => !(rateKey(x.country) in freightRates))

  const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
  const descWeights: Record<string, number> = {}
  for (const d of descList) descWeights[descKey(d.name)] = d.weightPerUnit || 0
  const descKeys = Object.keys(descWeights)
  const wtChargeFor = (desc: string): number => {
    const k = descKey(desc)
    if (!k) return 0
    if (descWeights[k] != null) return descWeights[k]
    let best = "", ratio = 0
    for (const mk of descKeys) {
      const r = 1 - lev(k, mk) / Math.max(k.length, mk.length, 1)
      if (r > ratio) { ratio = r; best = mk }
    }
    return ratio >= FUZZY_MIN ? descWeights[best] : 0
  }
  const missingDescriptions = [...new Set(items
    .map((i: any) => String(col(i, "DESCRIPTION") || "").trim())
    .filter((d: string) => d && wtChargeFor(d) <= 0))] as string[]

  const normGwDept = (raw: string) => {
    const s = raw.trim(); const u = s.toUpperCase()
    if (u === "NYK") return "SCM NYK"
    if (u === "NYG") return "SCM NYG"
    return s
  }

  const built = items.map((item: any) => {
    const port = String(col(item, "Port") || "").trim()
    const country = String(col(item, "Country") || "").trim()
    const itemBrand = String(col(item, "Brand name") || col(item, "BRAND") || "").trim()
    const qty = Number(col(item, "QTY Request ship Air (pcs)") || 0)
    const qtyOrig = Number(col(item, "QTY Original Shipment (pcs)") || 0)
    const rate = freightRates[rateKey(country)] || 0
    const fileWeight = Number(String(col(item, "WEIGHT(KG)") ?? col(item, "WEIGHT") ?? "").replace(/,/g, "")) || 0
    const gw = (isHistorical && fileWeight > 0) ? fileWeight : qtyOrig * wtChargeFor(String(col(item, "DESCRIPTION") || ""))
    let claimDepts: any = null, claimDept: string | null = null, claimPct: number | null = null
    if (isGW) {
      const splits = [1, 2, 3].map(n => {
        const dept = normGwDept(String(col(item, `CLAIM DEPT ${n}`) || ""))
        const rawReason = String(col(item, `REASON ${n}`) || "").trim() || null
        return { dept, pct: parseFloat(String(col(item, `%CLAIM${n}`) ?? "")) || 0, reason: isHistorical ? forceImportReason(dept, rawReason) : rawReason }
      }).filter(s => s.dept)
      if (splits.length > 0) { claimDepts = splits; claimDept = splits[0].dept; claimPct = splits[0].pct || null }
    }
    return {
      style: String(col(item, "STYLE") || ""),
      so: normalizeSo(col(item, "SO")),
      brand: itemBrand || null,
      sub: String(col(item, "SUB") || "") || null,
      customerPO: String(col(item, "CUSTOMER PO") || ""),
      description: String(col(item, "DESCRIPTION") || ""),
      gmtType: String(col(item, "GMT_TYPE") || ""),
      originalShipmentDate: parseDate(col(item, "Original Shipment Date")),
      planShipmentDate: parseDate(col(item, "Plan Shipment Date")),
      qtyOriginalShipment: Number(col(item, "QTY Original Shipment (pcs)") || 0),
      qtyRequestAir: qty,
      reasonDelay: String(col(item, "Reason delay") || ""),
      factory: String(col(item, "Factory") || ""),
      country,
      port,
      grossWeight: gw,
      airFreight: gw * rate,
      marketRatePerKg: rate > 0 ? rate : null,
      ...(isHistorical && (() => { const a = numOf(colLike(item, "total", "hawb")); return a > 0 ? { actualAirFreight: a } : {} })()),
      ...(isHistorical && { itemStatus: "COMPLETED" }),
      ...(isGW && { claimDepartment: claimDept, claimDepts, claimPercentage: claimPct }),
    }
  })

  return { items: built, missingRates, missingDescriptions }
}
