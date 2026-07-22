import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDocumentNo } from "@/lib/docno"
import { canonCountry } from "@/lib/freight"

// Admin-only backfill of HISTORICAL, already-complete documents. Uses the same MER
// template headers, but creates each doc as COMPLETED — no approval flow, no emails.
// ONE uploaded file = ONE document (every row becomes an SO of that document).

const normYear = (y: number): number => {
  if (y < 100) return y + 2000
  if (y >= 2400 && y <= 2600) return y - 543
  return y
}
const parseDate = (val: any): Date | null => {
  if (val == null || val === "") return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === "number") { const d = new Date(Math.round((val - 25569) * 86400 * 1000)); return isNaN(d.getTime()) ? null : d }
  const s = String(val).trim(); if (!s) return null
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/)
  if (m) { const d = new Date(normYear(+m[1]), +m[2] - 1, +m[3]); return isNaN(d.getTime()) ? null : d }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) { let a = +m[1], b = +m[2]; const year = normYear(+m[3]); let dd: number, mm: number; if (a > 12 && b <= 12) { dd = a; mm = b } else if (b > 12 && a <= 12) { mm = a; dd = b } else { dd = a; mm = b } const d = new Date(year, mm - 1, dd); return isNaN(d.getTime()) ? null : d }
  const d = new Date(s); return isNaN(d.getTime()) ? null : d
}
const col = (item: any, key: string) => {
  const k = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase()) ?? key
  return item[k]
}
// Fuzzy header match — find a column whose header CONTAINS all given substrings
// (case-insensitive), so odd headers like "Weight(KG.)" / "Gross Wt" still match.
const colLike = (item: any, ...subs: string[]) => {
  const k = Object.keys(item).find(k => { const lk = k.toLowerCase(); return subs.every(s => lk.includes(s.toLowerCase())) })
  return k ? item[k] : ""
}
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isNaN(n) ? 0 : n }
const rateKey = (country: string) => canonCountry(country)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  const userId = (session.user as any).id

  try {
    const body = await req.json()
    const items: any[] = body.items
    if (!items || !items.length) return NextResponse.json({ error: "No rows to import" }, { status: 400 })

    // Freight rate by COUNTRY (for Est.; historical rows also carry actuals).
    const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true }, orderBy: { updatedAt: "asc" } })
    const rates: Record<string, number> = {}
    for (const r of rateList) rates[rateKey(r.country)] = r.ratePerKg

    // Gross Weight source: old files often leave the WEIGHT column blank, so fall back to
    // QTY Original × WT Charge/pc of the DESCRIPTION from Master Description (same as a normal
    // upload) → EST = Gross Weight × country rate. Fuzzy-match handles typos/plurals.
    const descKey = (s: string) => String(s || "").trim().toUpperCase().replace(/\s*,\s*/g, ",").replace(/\s+/g, " ")
    const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
    const descWeights: Record<string, number> = {}
    for (const d of descList) descWeights[descKey(d.name)] = d.weightPerUnit || 0
    const descKeys = Object.keys(descWeights)
    const lev = (a: string, b: string) => {
      const m = a.length, n = b.length
      if (!m) return n; if (!n) return m
      const dp = Array.from({ length: n + 1 }, (_, j) => j)
      for (let i = 1; i <= m; i++) {
        let prev = dp[0]; dp[0] = i
        for (let j = 1; j <= n; j++) { const tmp = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp }
      }
      return dp[n]
    }
    const wtChargeFor = (desc: string): number => {
      const k = descKey(desc)
      if (!k) return 0
      if (descWeights[k] != null) return descWeights[k]
      let best = "", ratio = 0
      for (const mk of descKeys) { const r = 1 - lev(k, mk) / Math.max(k.length, mk.length, 1); if (r > ratio) { ratio = r; best = mk } }
      return ratio >= 0.85 ? descWeights[best] : 0
    }

    // ONE uploaded file = ONE document — every row becomes an SO of that single doc.
    const groups = new Map<string, any[]>([["__onedoc__", items]])

    let createdDocs = 0, createdItems = 0
    for (const [, rows] of groups) {
      const first = rows[0]
      const isGW = String(col(first, "BU") || "").toUpperCase().includes("GW")
      const docNo = await generateDocumentNo(isGW ? "GW" : "NYG")

      const itemsData = rows.map((item: any) => {
        const country = String(col(item, "Country") || "").trim()
        // Weight header varies a lot → match ANY column containing "weight". If the old file
        // left it blank, compute Gross = QTY Original × WT Charge from Master Description.
        const fileWeight = num(colLike(item, "weight"))
        const qtyOrig = Math.round(num(col(item, "QTY Original Shipment (pcs)")))
        const gw = fileWeight > 0 ? fileWeight : qtyOrig * wtChargeFor(String(col(item, "DESCRIPTION") || ""))
        const rate = rates[rateKey(country)] || 0   // EST = Gross Weight × country rate (0 if no rate in Master)
        // Claim splits (+ per-dept ACTUAL AIRFREIGHT → summed to the SO's total actual)
        const splits = [1, 2, 3].map(n => ({
          dept: String(col(item, `CLAIM DEPT ${n}`) || "").trim(),
          pct: num(col(item, `%CLAIM${n}`)),
          reason: String(col(item, `REASON ${n}`) || "").trim() || null,
          actual: num(col(item, `ACTUAL AIRFREIGHT${n}`)),
        })).filter(s => s.dept)
        // Actual per SO: prefer a single SO-level column if the file has one,
        // else sum the per-dept ACTUAL AIRFREIGHT 1/2/3.
        const soActual = num(col(item, "Actual Airfreight")) || num(col(item, "ACTUAL AIRFREIGHT")) || num(col(item, "ACTUAL (THB)")) || num(col(item, "Actual Freight (THB)"))
        const totalActual = soActual > 0 ? soActual : splits.reduce((s, x) => s + x.actual, 0)
        const claimDepts = splits.length ? splits.map(({ actual, ...rest }) => rest) : null

        return {
          style: String(col(item, "STYLE") || ""),
          so: String(col(item, "SO") || ""),
          brand: String(col(item, "Brand name") || col(item, "BRAND") || "").trim() || null,
          sub: String(col(item, "SUB") || "") || null,
          customerPO: String(col(item, "CUSTOMER PO") || ""),
          description: String(col(item, "DESCRIPTION") || ""),
          originalShipmentDate: parseDate(col(item, "Original Shipment Date")),
          planShipmentDate: parseDate(col(item, "Plan Shipment Date")),
          qtyOriginalShipment: Math.round(num(col(item, "QTY Original Shipment (pcs)"))),
          qtyRequestAir: Math.round(num(col(item, "QTY Request ship Air (pcs)"))),
          reasonDelay: String(col(item, "Reason delay") || ""),
          factory: String(col(item, "Factory") || ""),
          country,
          port: "",
          grossWeight: gw,
          airFreight: gw * rate,
          marketRatePerKg: rate > 0 ? rate : null,
          actualAirFreight: totalActual > 0 ? totalActual : null,
          invoiceNo: String(col(item, "INV NO.") || "") || null,
          hawbNo: String(col(item, "HAWB#") || "") || null,
          itemStatus: "COMPLETED",
          claimDepartment: claimDepts ? claimDepts[0].dept : null,
          claimDepts: claimDepts as any,
          claimPercentage: claimDepts ? (claimDepts[0].pct || null) : null,
        }
      })

      await prisma.airRequest.create({
        data: {
          documentNo: docNo,
          brandName: String(col(first, "Brand name") || col(first, "BRAND") || ""),
          buName: String(col(first, "BU") || ""),
          bu: isGW ? "GW" : "NYG",
          status: "COMPLETED",
          createdById: userId,
          crNo: String(col(first, "CR NO") || col(first, "CR NO.") || "").trim() || null,
          items: { create: itemsData },
        } as any,
      })
      createdDocs++
      createdItems += itemsData.length
    }

    return NextResponse.json({ ok: true, createdDocs, createdItems })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
