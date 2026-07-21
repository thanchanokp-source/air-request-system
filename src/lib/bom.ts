import { prisma } from "./prisma"

const norm = (s: any) => String(s ?? "").trim().toUpperCase()
// A cell may hold several values in one string (comma / slash / semicolon). Split → clean tokens.
const splitMulti = (s: any) => norm(s).split(/[,/;]+/).map(x => x.trim()).filter(Boolean)

// Attach `poGarment` (garment PO number(s)) to every item, matched against the BillOfMaterial
// reference table (synced by RPA) by SO. Matching is comma-tolerant on Customer PO and PO No
// (either side may list several values), and falls back to SO+Style when the Customer PO differs
// or is missing — so a formatting mismatch never hides the PO. Several POs → "PO A, PO B".
export async function attachGarmentPo(requests: any[]): Promise<void> {
  try {
    const items = requests.flatMap((r: any) => r.items || [])
    const sos = [...new Set(items.map((i: any) => String(i.so ?? "").trim()).filter(Boolean))]
    if (!sos.length) return
    const boms: any[] = await (prisma as any).billOfMaterial.findMany({ where: { soNoDoc: { in: sos } } }).catch(() => [])
    if (!boms.length) return

    // Two lookup levels: exact (SO|STYLE|customerPO) and looser (SO|STYLE).
    const byPo = new Map<string, Set<string>>()      // SO|STYLE|PO -> garment POs
    const bySoStyle = new Map<string, Set<string>>() // SO|STYLE    -> garment POs
    const add = (m: Map<string, Set<string>>, k: string, po: string) => { if (!m.has(k)) m.set(k, new Set()); m.get(k)!.add(po) }
    for (const b of boms) {
      const so = norm(b.soNoDoc), style = norm(b.style)
      const pos = splitMulti(b.poNoDoc)      // poNoDoc itself may be a comma list
      const cpos = splitMulti(b.customerPo)  // customerPo may be a comma list
      for (const po of pos) {
        add(bySoStyle, `${so}|${style}`, po)
        for (const cpo of (cpos.length ? cpos : [""])) add(byPo, `${so}|${style}|${cpo}`, po)
      }
    }
    for (const it of items) {
      const so = norm(it.so), style = norm(it.style)
      const found = new Set<string>()
      // 1) exact — any of the item's (comma-split) Customer POs matches
      for (const cpo of splitMulti(it.customerPO)) (byPo.get(`${so}|${style}|${cpo}`) || []).forEach((p: string) => found.add(p))
      // 2) fallback — SO + Style (Customer PO missing / formatted differently)
      if (!found.size) (bySoStyle.get(`${so}|${style}`) || []).forEach((p: string) => found.add(p))
      it.poGarment = found.size ? [...found].join(", ") : null
    }
  } catch (e) { console.error("[bom] attachGarmentPo failed:", e) }
}
