import { prisma } from "./prisma"

const norm = (s: any) => String(s ?? "").trim().toUpperCase()

// Attach `poGarment` (garment PO number(s), "/"-joined) to every item of the given requests, by
// matching SO + Style + Customer PO against the BillOfMaterial reference table (synced by RPA).
// Several matches → several POs ("PO A / PO B / …"). No match → null.
export async function attachGarmentPo(requests: any[]): Promise<void> {
  try {
    const items = requests.flatMap((r: any) => r.items || [])
    const sos = [...new Set(items.map((i: any) => String(i.so ?? "").trim()).filter(Boolean))]
    if (!sos.length) return
    const boms: any[] = await (prisma as any).billOfMaterial.findMany({ where: { soNoDoc: { in: sos } } }).catch(() => [])
    if (!boms.length) return
    const map = new Map<string, Set<string>>()
    for (const b of boms) {
      const k = `${norm(b.soNoDoc)}|${norm(b.style)}|${norm(b.customerPo)}`
      if (!map.has(k)) map.set(k, new Set())
      if (b.poNoDoc) map.get(k)!.add(String(b.poNoDoc).trim())
    }
    for (const it of items) {
      const pos = map.get(`${norm(it.so)}|${norm(it.style)}|${norm(it.customerPO)}`)
      it.poGarment = pos && pos.size ? [...pos].join(" / ") : null
    }
  } catch (e) { console.error("[bom] attachGarmentPo failed:", e) }
}
