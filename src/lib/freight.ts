import { prisma } from "@/lib/prisma"
import { notifyStatusChange } from "@/lib/notify"

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
  const rates: Record<string, number> = {}
  for (const r of rateList) rates[rateKey(r.country)] = r.ratePerKg
  const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
  const wts: Record<string, number> = {}
  for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0

  for (const doc of held) {
    const items = doc.items as any[]
    const rateOk = items.filter(i => i.country).every(i => (rates[rateKey(i.country)] || 0) > 0)
    const wtOk = items.filter(i => i.description).every(i => (wts[descKey(i.description)] || 0) > 0)
    // Recompute Gross + Est. for every item now that data may have been added.
    for (const it of items) {
      const wt = wts[descKey(it.description)] || 0
      const rate = rates[rateKey(it.country)] || 0
      const gross = (it.qtyRequestAir || 0) * wt
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

// Back-compat alias (older call sites). Both rate and weight releases run the same pass.
export const releasePendingRateDocs = releaseHeldDocs

// Recompute Gross (= QTY Air × WT Charge) + Est. Air Freight (= Gross × rate) for EVERY item
// of a request. Call after Logistics fills in a QTY that Merchandise left blank at upload.
export async function recomputeRequestFreight(requestId: string): Promise<void> {
  const items = await (prisma.airRequestItem as any).findMany({ where: { requestId } })
  if (!items.length) return
  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const rates: Record<string, number> = {}
  for (const r of rateList) rates[rateKey(r.country)] = r.ratePerKg
  const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
  const wts: Record<string, number> = {}
  for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0
  for (const it of items) {
    const wt = wts[descKey(it.description)] || 0
    const rate = rates[rateKey(it.country)] || 0
    const gross = (it.qtyRequestAir || 0) * wt
    await prisma.airRequestItem.update({
      where: { id: it.id },
      data: { grossWeight: gross, airFreight: gross * rate, marketRatePerKg: rate > 0 ? rate : null },
    }).catch(() => {})
  }
}
