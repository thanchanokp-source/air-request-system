import { prisma } from "./prisma"

const norm = (s: any) => String(s ?? "").trim().toUpperCase()
// A cell may hold several values in one string (comma / slash / semicolon). Split → clean tokens.
const splitMulti = (s: any) => norm(s).split(/[,/;]+/).map(x => x.trim()).filter(Boolean)

// Canonical SO key: digits only, leading zeros stripped. Excel often drops a leading 0 (a real
// 8-digit SO "01234567" becomes "1234567"), so we compare SOs with leading zeros removed on BOTH
// sides. SOs that start with a non-zero digit are unaffected.
const soKey = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")

// Attach `poGarment` to every item, matched against BillOfMaterial (synced by RPA) by SO + BU:
// the SO the MER keyed in is matched against BillOfMaterial.soNoDoc (leading-zero tolerant) AND
// the document's BU against BillOfMaterial.bu — because the SAME SO number can exist in different
// BUs (NYG/GW/EA) with different garment POs. All matching PO numbers are stored comma-separated.
const buKey = (b: any) => norm(b || "NYG") // legacy/blank BU → NYG (schema default)
export async function attachGarmentPo(requests: any[]): Promise<void> {
  try {
    // Keep each item's document BU so we can match SO + BU (not SO alone).
    const itemBu = new Map<any, string>()
    const items: any[] = []
    for (const r of requests) {
      const bu = buKey(r.bu)
      for (const it of (r.items || [])) { items.push(it); itemBu.set(it, bu) }
    }
    const rawSos = [...new Set(items.map((i: any) => String(i.so ?? "").trim()).filter(Boolean))]
    if (!rawSos.length) return

    // The DB query is exact, and BOM may store the SO with OR without the leading 0. So fetch every
    // plausible written form (raw / digits / no-leading-zero / zero-padded to 8), then match in
    // memory by the canonical soKey + BU.
    const candidates = new Set<string>()
    for (const s of rawSos) {
      const digits = s.replace(/\D/g, "")
      candidates.add(s)
      if (digits) { candidates.add(digits); candidates.add(digits.replace(/^0+/, "")); candidates.add(digits.padStart(8, "0")) }
    }
    const boms: any[] = await (prisma as any).billOfMaterial.findMany({ where: { soNoDoc: { in: [...candidates].filter(Boolean) } } }).catch(() => [])
    if (!boms.length) return

    // key = "<canonical SO>|<BU>" -> set of garment PO numbers (poNoDoc may itself be a comma list).
    const key = (so: any, bu: any) => `${soKey(so)}|${buKey(bu)}`
    const byKey = new Map<string, Set<string>>()
    for (const b of boms) {
      if (!soKey(b.soNoDoc)) continue
      const k = key(b.soNoDoc, b.bu)
      if (!byKey.has(k)) byKey.set(k, new Set())
      for (const po of splitMulti(b.poNoDoc)) byKey.get(k)!.add(po)
    }
    for (const it of items) {
      const pos = byKey.get(key(it.so, itemBu.get(it)))
      it.poGarment = pos && pos.size ? [...pos].join(", ") : null
    }
  } catch (e) { console.error("[bom] attachGarmentPo failed:", e) }
}
