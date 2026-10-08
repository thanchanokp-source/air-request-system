import { prisma } from "@/lib/prisma"
import { notifyStatusChange } from "@/lib/notify"
import { soCurrency } from "@/lib/currency"

// Canonical country key for freight-rate matching — folds common aliases so
// "United States", "U.S.A", "USA", "US" all match the same Master rate.
const COUNTRY_ALIAS: Record<string, string> = {
  "USA": "USA", "US": "USA", "UNITED STATES": "USA", "UNITED STATES OF AMERICA": "USA", "AMERICA": "USA",
  "UK": "UK", "UNITED KINGDOM": "UK", "GREAT BRITAIN": "UK", "ENGLAND": "UK",
}
export function canonCountry(c: string): string {
  const raw = String(c || "").trim().toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim()
  return COUNTRY_ALIAS[raw] || raw
}

const rateKey = (country: string) => canonCountry(country)

// Must match the upload's normalisation: case-insensitive, trim, collapse spaces, AND remove
// spaces around commas so "JACKET,Hoodie" == "JACKET, Hoodie" (a very common mismatch).
const descKey = (s: string) => String(s || "").trim().toUpperCase().replace(/\s*,\s*/g, ",").replace(/\s+/g, " ")

// Release documents HELD for missing master data. A doc is held while any COUNTRY has
// no freight rate (pendingRate) OR any DESCRIPTION has no WT Charge (pendingWeight).
// On each call we recompute Gross (= QTY Air × WT Charge) and Est. Air Freight (= Gross ×
// rate) as data becomes available, clear whichever hold is now satisfied, and — once BOTH
// are satisfied — notify the current first approver. Call after adding/editing a
// MasterFreightRate (rate) or a MasterDescription WT Charge (weight).
export async function releaseHeldDocs() {
  const held = await (prisma.airRequest as any).findMany({
    where: { OR: [{ pendingRate: true }, { pendingWeight: true }] },
    include: { items: true },
  })
  if (!held.length) return

  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const rates: Record<string, number> = {}, ratesUsd: Record<string, number> = {}
  for (const r of rateList) { rates[rateKey(r.country)] = r.ratePerKg; ratesUsd[rateKey(r.country)] = r.rateUsd || 0 }
  const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
  const wts: Record<string, number> = {}
  for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0

  for (const doc of held) {
    const items = doc.items as any[]
    // Rate currency is per-SO (EA / GW-RHONE = USD, else THB).
    const rateOf = (it: any) => (soCurrency(doc.bu, it.brand) === "USD" ? ratesUsd : rates)[rateKey(it.country)] || 0
    const rateOk = items.filter(i => i.country).every(i => rateOf(i) > 0)
    const wtOk = items.filter(i => i.description).every(i => (wts[descKey(i.description)] || 0) > 0)
    // Recompute Gross + Est. for every item now that data may have been added.
    // Gross uses QTY Air (fall back to QTY Original if Air is blank) — see recomputeRequestFreight.
    for (const it of items) {
      const wt = wts[descKey(it.description)] || 0
      const rate = rateOf(it)
      const gross = (it.qtyRequestAir || it.qtyOriginalShipment || 0) * wt
      await prisma.airRequestItem.update({
        where: { id: it.id },
        data: { grossWeight: gross, airFreight: gross * rate, marketRatePerKg: rate > 0 ? rate : null },
      }).catch(() => {})
    }
    await (prisma.airRequest as any).update({ where: { id: doc.id }, data: { pendingRate: !rateOk, pendingWeight: !wtOk } })
    // Both holds cleared → send to the current first approver (status unchanged).
    if (rateOk && wtOk) await notifyStatusChange(doc.id, doc.status).catch(() => {})
  }
}

// Fill EST for lines that still have NO estimate (gross or est 0) — e.g. the DESCRIPTION / country had no
// master when the doc was uploaded and the doc was not held. Runs after a Master Description / rate is
// added or edited, on ANY status (an empty estimate is not an "approved" one, so the EST freeze does not
// apply). Description match = upload rule: exact key, else closest name ≥ FUZZY_MIN. Returns lines filled.
export async function fillMissingEst(): Promise<number> {
  const { lev, FUZZY_MIN } = await import("@/lib/build-items")
  const items = await (prisma.airRequestItem as any).findMany({
    where: { itemStatus: { not: "REJECTED" }, request: { isTest: false }, OR: [{ grossWeight: null }, { grossWeight: 0 }, { airFreight: null }, { airFreight: 0 }] },
    select: { id: true, description: true, country: true, brand: true, qtyRequestAir: true, qtyOriginalShipment: true, grossWeight: true, request: { select: { bu: true } } },
  })
  if (!items.length) return 0
  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const rates: Record<string, number> = {}, ratesUsd: Record<string, number> = {}
  for (const r of rateList) { rates[rateKey(r.country)] = r.ratePerKg; ratesUsd[rateKey(r.country)] = r.rateUsd || 0 }
  const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
  const wts: Record<string, number> = {}
  for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0
  const keys = Object.keys(wts)
  const wtOf = (desc: string) => {
    const k = descKey(desc); if (!k) return 0
    if (wts[k] != null) return wts[k]
    let best = "", ratio = 0
    for (const mk of keys) { const r = 1 - lev(k, mk) / Math.max(k.length, mk.length, 1); if (r > ratio) { ratio = r; best = mk } }
    return ratio >= FUZZY_MIN ? wts[best] : 0
  }
  let n = 0
  for (const it of items as any[]) {
    const qty = it.qtyRequestAir || it.qtyOriginalShipment || 0
    const gross = (Number(it.grossWeight) || 0) > 0 ? Number(it.grossWeight) : qty * wtOf(it.description)
    const rate = (soCurrency(it.request?.bu, it.brand) === "USD" ? ratesUsd : rates)[rateKey(it.country)] || 0
    if (!(gross > 0)) continue
    await prisma.airRequestItem.update({ where: { id: it.id }, data: { grossWeight: gross, ...(rate > 0 ? { airFreight: gross * rate, marketRatePerKg: rate } : {}) } as any }).catch(() => {})
    n++
  }
  return n
}

// Back-compat alias (older call sites). Both rate and weight releases run the same pass.
export const releasePendingRateDocs = releaseHeldDocs

// Distribute a HAWB's ONE total actual cost across ALL its shipment lines GLOBALLY — every
// airRequestItem carrying that hawbNo, across EVERY document — proportionally by air qty. A HAWB can
// span multiple documents (same SO/SUB can split into different INV/HAWB), so its cost must be keyed
// by the HAWB number and spread once. This makes the result idempotent: entering the same HAWB total
// in two separate documents can no longer double the actual (sum over the HAWB always = totalCost).
export async function redistributeHawbCost(hawbNo: string, totalCost: number): Promise<void> {
  const h = String(hawbNo || "").trim()
  if (!h || !(totalCost > 0)) return
  const items = await (prisma.airRequestItem as any).findMany({
    where: { hawbNo: h }, select: { id: true, qtyActualShip: true, qtyRequestAir: true },
  })
  const qtyOf = (it: any) => Number(it.qtyActualShip ?? it.qtyRequestAir) || 0
  const totalQty = items.reduce((s: number, it: any) => s + qtyOf(it), 0)
  if (totalQty <= 0) return
  const avg = totalCost / totalQty
  for (const it of items) {
    await prisma.airRequestItem.update({ where: { id: it.id }, data: { actualAirFreight: Math.round(qtyOf(it) * avg * 100) / 100 } }).catch(() => {})
  }
}

// Recompute Gross (= QTY Air × WT Charge) + Est. Air Freight (= Gross × rate) for EVERY item of a
// request. Gross/Est are based on QTY Air (what's actually flown → comparable to Actual), falling
// back to QTY Original when Air is blank. Call after Master data or an item's qty changes.
export async function recomputeRequestFreight(requestId: string): Promise<void> {
  const items = await (prisma.airRequestItem as any).findMany({ where: { requestId } })
  if (!items.length) return
  const req = await (prisma.airRequest as any).findUnique({ where: { id: requestId }, select: { bu: true } })
  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const rates: Record<string, number> = {}, ratesUsd: Record<string, number> = {}
  for (const r of rateList) { rates[rateKey(r.country)] = r.ratePerKg; ratesUsd[rateKey(r.country)] = r.rateUsd || 0 }
  const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
  const wts: Record<string, number> = {}
  for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0
  // Rate currency is per-SO (EA / GW-RHONE = USD, else THB).
  const rateOf = (it: any) => (soCurrency(req?.bu, it.brand) === "USD" ? ratesUsd : rates)[rateKey(it.country)] || 0
  for (const it of items) {
    const wt = wts[descKey(it.description)] || 0
    const rate = rateOf(it)
    const gross = (it.qtyRequestAir || it.qtyOriginalShipment || 0) * wt
    await prisma.airRequestItem.update({
      where: { id: it.id },
      data: { grossWeight: gross, airFreight: gross * rate, marketRatePerKg: rate > 0 ? rate : null },
    }).catch(() => {})
  }
}
