import { prisma } from "@/lib/prisma"
import { notifyStatusChange } from "@/lib/notify"

const rateKey = (country: string) => country.trim().toUpperCase()

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
    // status is still PENDING_VP_MER / PENDING_VP_MER_GW — now notify VP MER.
    await notifyStatusChange(doc.id, doc.status).catch(() => {})
  }
}
