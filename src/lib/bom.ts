import { prisma } from "./prisma"

const norm = (s: any) => String(s ?? "").trim().toUpperCase()
// A cell may hold several values in one string (comma / slash / semicolon). Split → clean tokens.
const splitMulti = (s: any) => norm(s).split(/[,/;]+/).map(x => x.trim()).filter(Boolean)

// Canonical SO key: digits only, leading zeros stripped. Excel often drops a leading 0 (a real
// 8-digit SO "01234567" becomes "1234567"), so we compare SOs with leading zeros removed on BOTH
// sides. SOs that start with a non-zero digit are unaffected.
const soKey = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")

// Attach `poGarment` to every item, matched against BillOfMaterial (synced by RPA) BY SO ONLY:
// the SO the MER keyed in is matched against BillOfMaterial.soNoDoc (leading-zero tolerant), then
// ALL of that SO's garment PO numbers are collected and stored comma-separated ("PO A, PO B").
export async function attachGarmentPo(requests: any[]): Promise<void> {
  try {
    const items = requests.flatMap((r: any) => r.items || [])
    const rawSos = [...new Set(items.map((i: any) => String(i.so ?? "").trim()).filter(Boolean))]
    if (!rawSos.length) return

    // The DB query is exact, and BOM may store the SO with OR without the leading 0. So fetch every
    // plausible written form (raw / digits / no-leading-zero / zero-padded to 8), then match in
    // memory by the canonical soKey.
    const candidates = new Set<string>()
    for (const s of rawSos) {
      const digits = s.replace(/\D/g, "")
      candidates.add(s)
      if (digits) { candidates.add(digits); candidates.add(digits.replace(/^0+/, "")); candidates.add(digits.padStart(8, "0")) }
    }
    const boms: any[] = await (prisma as any).billOfMaterial.findMany({ where: { soNoDoc: { in: [...candidates].filter(Boolean) } } }).catch(() => [])
    if (!boms.length) return

    // canonical SO -> set of garment PO numbers (poNoDoc may itself be a comma list).
    const bySo = new Map<string, Set<string>>()
    for (const b of boms) {
      const k = soKey(b.soNoDoc)
      if (!k) continue
      if (!bySo.has(k)) bySo.set(k, new Set())
      for (const po of splitMulti(b.poNoDoc)) bySo.get(k)!.add(po)
    }
    for (const it of items) {
      const pos = bySo.get(soKey(it.so))
      it.poGarment = pos && pos.size ? [...pos].join(", ") : null
    }
  } catch (e) { console.error("[bom] attachGarmentPo failed:", e) }
}
