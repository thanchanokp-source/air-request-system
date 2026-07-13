import { prisma } from "@/lib/prisma"
import { notifyStatusChange } from "@/lib/notify"

const rateKey = (brand: string, country: string) => `${brand.trim().toUpperCase()}|${country.trim().toUpperCase()}`

// Release any document HELD for a missing freight rate once every Brand+Country
// pair on it has a rate. On release the doc is finally sent (notified) to VP MER.
// Call after adding/editing a MasterFreightRate.
export async function releasePendingRateDocs() {
  const held = await (prisma.airRequest as any).findMany({ where: { pendingRate: true }, include: { items: true } })
  if (!held.length) return

  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const have = new Set<string>(rateList.map((r: any) => rateKey(r.brand, r.country)))

  for (const doc of held) {
    const combos = (doc.items as any[])
      .map((i) => ({ b: String(i.brand || "").trim(), c: String(i.country || "").trim() }))
      .filter((x) => x.b && x.c)
      .map((x) => rateKey(x.b, x.c))
    const allCovered = combos.length > 0 && combos.every((k) => have.has(k))
    if (!allCovered) continue

    await (prisma.airRequest as any).update({ where: { id: doc.id }, data: { pendingRate: false } })
    // status is still PENDING_VP_MER / PENDING_VP_MER_GW — now notify VP MER.
    await notifyStatusChange(doc.id, doc.status).catch(() => {})
  }
}
