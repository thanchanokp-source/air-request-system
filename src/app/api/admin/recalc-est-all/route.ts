import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canonCountry } from "@/lib/freight"
import { soCurrency } from "@/lib/currency"

export const runtime = "nodejs"

// ONE-TIME: re-price EST for EVERY item (all docs, all statuses incl. COMPLETED) from the CURRENT
// master rates. EST = existing grossWeight × rate (gross untouched — historical imports keep their
// real file weights). Rate = BU-specific row, else shared ALL; USD for EA / GW-RHONE, else THB
// (same rule as the New Request POST). No rate → item skipped (EST kept). ACTUAL / HAWB untouched.
// Body { commit?: boolean } — without commit it's a dry run (summary only). Admin only.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const commit = !!body.commit

  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const thbAll: Record<string, number> = {}, usdAll: Record<string, number> = {}
  const thbBu: Record<string, Record<string, number>> = {}, usdBu: Record<string, Record<string, number>> = {}
  for (const r of rateList) {
    const k = canonCountry(r.country), bu = String(r.bu || "ALL"), thb = Number(r.ratePerKg) || 0, usd = Number(r.rateUsd) || 0
    if (bu === "ALL") { if (thb > 0) thbAll[k] = thb; if (usd > 0) usdAll[k] = usd }
    else { if (thb > 0) (thbBu[bu] ||= {})[k] = thb; if (usd > 0) (usdBu[bu] ||= {})[k] = usd }
  }
  const rateFor = (bu: string, brand: string, country: string) => {
    const k = canonCountry(country)
    return soCurrency(bu, brand) === "USD" ? (usdBu[bu]?.[k] ?? usdAll[k] ?? 0) : (thbBu[bu]?.[k] ?? thbAll[k] ?? 0)
  }

  const items = await (prisma.airRequestItem as any).findMany({
    select: { id: true, grossWeight: true, airFreight: true, marketRatePerKg: true, country: true, brand: true, request: { select: { bu: true } } },
  })

  const byBu: Record<string, { items: number; changed: number; before: number; after: number; cur: string }> = {}
  const noRate = new Map<string, number>()
  const updates: { id: string; airFreight: number; marketRatePerKg: number }[] = []
  for (const it of items as any[]) {
    const bu = String(it.request?.bu || "NYG")
    const g = (byBu[bu] ||= { items: 0, changed: 0, before: 0, after: 0, cur: bu === "EA" ? "USD" : bu === "GW" ? "THB+USD" : "THB" })
    g.items++
    const before = Number(it.airFreight) || 0
    const rate = rateFor(bu, String(it.brand || ""), String(it.country || ""))
    if (!(rate > 0)) {
      const key = `${bu} · ${String(it.country || "(ว่าง)").trim() || "(ว่าง)"}`
      noRate.set(key, (noRate.get(key) || 0) + 1)
      g.before += before; g.after += before
      continue
    }
    const after = (Number(it.grossWeight) || 0) * rate
    g.before += before; g.after += after
    if (Math.abs(after - before) > 0.005 || Number(it.marketRatePerKg) !== rate) {
      g.changed++
      updates.push({ id: it.id, airFreight: after, marketRatePerKg: rate })
    }
  }

  if (commit) {
    for (let i = 0; i < updates.length; i += 200) {
      await prisma.$transaction(updates.slice(i, i + 200).map(u =>
        prisma.airRequestItem.update({ where: { id: u.id }, data: { airFreight: u.airFreight, marketRatePerKg: u.marketRatePerKg } as any })))
    }
  }

  return NextResponse.json({
    ok: true, commit, scanned: items.length, changed: updates.length,
    byBu: Object.entries(byBu).map(([bu, v]) => ({ bu, ...v, before: Math.round(v.before), after: Math.round(v.after) })).sort((a, b) => a.bu.localeCompare(b.bu)),
    noRate: [...noRate].map(([k, n]) => ({ key: k, items: n })).sort((a, b) => b.items - a.items),
  })
}
