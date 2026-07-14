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

// Release any document HELD for a missing freight rate once every COUNTRY on it has
// a rate (rate is keyed by country only). On release the doc is finally sent
// (notified) to VP MER. Call after adding/editing a MasterFreightRate.
export async function releasePendingRateDocs() {
  const held = await (prisma.airRequest as any).findMany({ where: { pendingRate: true }, include: { items: true } })
  if (!held.length) return

  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const have = new Set<string>(rateList.map((r: any) => rateKey(r.country)))

  for (const doc of held) {
    const combos = (doc.items as any[])
      .map((i) => String(i.country || "").trim())
      .filter((c) => c)
      .map((c) => rateKey(c))
    const allCovered = combos.length > 0 && combos.every((k) => have.has(k))
    if (!allCovered) continue

    await (prisma.airRequest as any).update({ where: { id: doc.id }, data: { pendingRate: false } })
    // Status is unchanged (PENDING_DVM_MER / PENDING_VP_MER / PENDING_VP_MER_GW) —
    // now notify the current first approver for that stage.
    await notifyStatusChange(doc.id, doc.status).catch(() => {})
  }
}
