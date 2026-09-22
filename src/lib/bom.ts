import { prisma } from "./prisma"

const norm = (s: any) => String(s ?? "").trim().toUpperCase()
// A cell may hold several values in one string (comma / slash / semicolon). Split → clean tokens.
const splitMulti = (s: any) => norm(s).split(/[,/;\s]+/).map(x => x.trim()).filter(Boolean)

// Canonical SO key: digits only, leading zeros stripped. Excel often drops a leading 0 (a real
// 8-digit SO "01234567" becomes "1234567"), so we compare SOs with leading zeros removed on BOTH
// sides. SOs that start with a non-zero digit are unaffected.
const soKey = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")

// Attach `poGarment` to every item, matched against BillOfMaterial (synced by RPA) by SO + BU:
// the SO the MER keyed in is matched against BillOfMaterial.soNoDoc (leading-zero tolerant) AND
// the document's BU against BillOfMaterial.bu — because the SAME SO number can exist in different
// BUs (NYG/GW/EA) with different garment POs. All matching PO numbers are stored comma-separated.
const buKey = (b: any) => norm(b || "NYG") // legacy/blank BU → NYG (schema default)

// Per-SO PO cache. BOM is an RPA-synced REFERENCE table (445k rows, ~20 dup rows per SO) that
// changes infrequently, but attachGarmentPo runs on EVERY /api/requests load — a 6000-value IN
// against 445k rows dominated the response time. Cache each SO's resolved PO (string or null) for
// a few minutes so repeated list loads only query BOM for SOs not yet seen. Module-level → persists
// per warm serverless instance; a cold start just repopulates on first use.
const CACHE_TTL_MS = 10 * 60 * 1000
type PoEntry = { po: string | null; at: number }
const poCache = new Map<string, PoEntry>() // key = "<canonical SO>|<BU>"
const keyOf = (so: any, bu: any) => `${soKey(so)}|${buKey(bu)}`

export async function attachGarmentPo(requests: any[]): Promise<void> {
  try {
    // Keep each item's document BU so we can match SO + BU (not SO alone).
    const itemBu = new Map<any, string>()
    const items: any[] = []
    for (const r of requests) {
      const bu = buKey(r.bu)
      for (const it of (r.items || [])) { items.push(it); itemBu.set(it, bu) }
    }
    if (!items.length) return
    const now = Date.now()

    // 1) Serve from cache; collect the SOs that still need a BOM lookup.
    const missSos = new Set<string>()
    for (const it of items) {
      const hit = poCache.get(keyOf(it.so, itemBu.get(it)))
      if (hit && now - hit.at < CACHE_TTL_MS) it.poGarment = hit.po
      else { const raw = String(it.so ?? "").trim(); if (raw) missSos.add(raw) }
    }
    if (missSos.size === 0) return // everything served from cache → no BOM query at all

    // 2) BOM's soNoDoc cell may hold ONE SO or a COMMA/SPACE LIST of several SOs sharing the same
    // garment PO (e.g. "09260005,09260006,09260011" → FL2610719). Exact IN misses the multi-SO rows,
    // so fetch with `contains` on the 8-digit-padded form of each MISSING SO (precise enough to avoid
    // most false hits; the exact per-token grouping below filters any that slip through). Runs only
    // for cache misses (then cached 10 min), so the wider scan is infrequent.
    const orForms = new Set<string>()
    for (const s of missSos) {
      const digits = s.replace(/\D/g, "")
      if (!digits) continue
      orForms.add(digits.padStart(8, "0")) // canonical 8-digit written form (matches inside a list)
      orForms.add(digits.replace(/^0+/, "")) // and the no-leading-zero form
    }
    const boms: any[] = orForms.size
      ? await (prisma as any).billOfMaterial.findMany({
          where: { OR: [...orForms].map(f => ({ soNoDoc: { contains: f } })) },
          select: { soNoDoc: true, poNoDoc: true, bu: true },
        }).catch(() => [])
      : []

    // key = "<canonical SO>|<BU>" -> set of garment PO numbers. SPLIT soNoDoc into its SO tokens so a
    // multi-SO cell maps its PO to EACH of its SOs (poNoDoc may itself be a comma list too).
    const byKey = new Map<string, Set<string>>()
    for (const b of boms) {
      const soTokens = splitMulti(b.soNoDoc)
      for (const soTok of soTokens) {
        if (!soKey(soTok)) continue
        const k = keyOf(soTok, b.bu)
        if (!byKey.has(k)) byKey.set(k, new Set())
        for (const po of splitMulti(b.poNoDoc)) byKey.get(k)!.add(po)
      }
    }
    // 3) Fill the missed items + cache the result (incl. null misses, so we don't re-query them).
    for (const it of items) {
      if (it.poGarment !== undefined) continue // already served from cache
      const k = keyOf(it.so, itemBu.get(it))
      const pos = byKey.get(k)
      const po = pos && pos.size ? [...pos].join(", ") : null
      it.poGarment = po
      poCache.set(k, { po, at: now })
    }
  } catch (e) { console.error("[bom] attachGarmentPo failed:", e) }
}
