import { prisma } from "./prisma"

const norm = (s: any) => String(s ?? "").trim().toUpperCase()
// A cell may hold several values in one string (comma / slash / semicolon). Split → clean tokens.
const splitMulti = (s: any) => norm(s).split(/[,/;]+/).map(x => x.trim()).filter(Boolean)

// Attach `poGarment` to every item, matched against the BillOfMaterial reference table (synced by
// RPA) BY SO ONLY: the SO the MER keyed in is matched against BillOfMaterial.soNoDoc, then ALL of
// that SO's garment PO numbers are collected and stored comma-separated ("PO A, PO B, PO C").
export async function attachGarmentPo(requests: any[]): Promise<void> {
  try {
    const items = requests.flatMap((r: any) => r.items || [])
    const sos = [...new Set(items.map((i: any) => String(i.so ?? "").trim()).filter(Boolean))]
    if (!sos.length) return
    const boms: any[] = await (prisma as any).billOfMaterial.findMany({ where: { soNoDoc: { in: sos } } }).catch(() => [])
    if (!boms.length) return

    // SO -> set of garment PO numbers (poNoDoc may itself be a comma list).
    const bySo = new Map<string, Set<string>>()
    for (const b of boms) {
      const so = norm(b.soNoDoc)
      if (!so) continue
      if (!bySo.has(so)) bySo.set(so, new Set())
      for (const po of splitMulti(b.poNoDoc)) bySo.get(so)!.add(po)
    }
    for (const it of items) {
      const pos = bySo.get(norm(it.so))
      it.poGarment = pos && pos.size ? [...pos].join(", ") : null
    }
  } catch (e) { console.error("[bom] attachGarmentPo failed:", e) }
}
