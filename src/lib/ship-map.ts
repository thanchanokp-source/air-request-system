// Map air-request lines (what MER keyed) to the REAL shipments in mp_line / export.
// ONE implementation used by the dashboard DATA TABLE, the AIR REQUESTS "QTY ส่งออกจริง" column and the
// "sync shipped qty" tool, so every page shows the same numbers.
//
// Rules (agreed with the business):
//   · every field comes from the MER row EXCEPT QTY AIR and INV, which come from the shipment source
//   · match by SO + SUB + STYLE. STYLE matches by CONTAINS either way, ignoring case/spaces
//     (MER may key "3AZ" for "3AZ-010"); a source line matching several MER styles goes to the longest
//   · source = mp_line first; only when mp_line has nothing for that SO+SUB+STYLE → export (same rules)
//   · output rows = number of INVs of that SO+SUB+STYLE:
//       MER rows are paired to INVs by equal qty, then closest qty;
//       more INVs than MER rows → extra rows = a COPY of the MER row, only INV + QTY differ
//       (EST/ACT not repeated on the copy, so totals stay = the MER rows)
//       more MER rows than INVs → the extra MER rows merge into the INV with the closest qty
//   · EST / ACT stay on their own MER row (never split)
//   · nothing found in either source → not shipped yet

export type SrcLine = { inv: string; style: string; qty: number }
export type ShipSource = {
  mp: Record<string, SrcLine[]>   // "SO|SUB" → lines aggregated by INV + STYLE (mp_line, SHIPPED AIR PP)
  ex: Record<string, SrcLine[]>   // "SO|SUB" → same from sq_report.export_row (AIR PREPAID)
}
export type ShipGroup = {
  key: string          // unique row key
  sk: string           // "SO|SUB"
  rows: any[]          // MER rows behind this output row (EST/ACT = Σ of these; [] for an extra INV row)
  base: any            // MER row whose fields are shown
  inv: string
  qty: number          // shipped qty of this INV
  src: "mp_line" | "export"
  extra: boolean       // INV with no MER row of its own → shown as a copy of base (only INV + QTY differ)
}
export type ShipInfo = { qty: number; inv: string; src: string }

const soKey = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")
const up = (s: any) => String(s ?? "").trim().toUpperCase()
const normStyle = (s: any) => String(s ?? "").toUpperCase().replace(/\s+/g, "")
export const shipSubKey = (it: any) => `${soKey(it?.so)}|${up(it?.sub)}`
const hasHawb = (it: any) => { const h = String(it?.hawbNo ?? "").trim(); return h !== "" && !/^[-.\s]*$/.test(h) }
const styleHit = (mer: string, src: string) => !!mer && !!src && (src.includes(mer) || mer.includes(src))

export function buildShipRows(items: any[], src: ShipSource): { groups: ShipGroup[]; unshipped: any[]; perItem: Map<string, ShipInfo> } {
  const groups: ShipGroup[] = [], unshipped: any[] = []
  const perItem = new Map<string, ShipInfo>()
  const bySub = new Map<string, any[]>()
  for (const it of items) { const k = shipSubKey(it); const g = bySub.get(k) || []; g.push(it); bySub.set(k, g) }

  for (const [sk, rows] of bySub) {
    const mpLines = src.mp?.[sk] || [], exLines = src.ex?.[sk] || []
    // MER rows grouped by style; most specific (longest) style claims source lines first
    const byStyle = new Map<string, any[]>()
    for (const r of rows) { const s = normStyle(r.style); const g = byStyle.get(s) || []; g.push(r); byStyle.set(s, g) }
    const styles = [...byStyle.keys()].sort((a, b) => b.length - a.length)
    const usedMp = new Set<number>(), usedEx = new Set<number>()

    for (const st of styles) {
      const mer = byStyle.get(st)!
      const pick = (lines: SrcLine[], used: Set<number>) =>
        lines.map((_, i) => i).filter(i => !used.has(i) && styleHit(st, normStyle(lines[i].style)))
      let s: "mp_line" | "export" = "mp_line"
      let idx = pick(mpLines, usedMp)
      let lines = mpLines
      if (!idx.length) { idx = pick(exLines, usedEx); lines = exLines; s = "export" }
      if (!idx.length) { unshipped.push(...mer); continue }
      for (const i of idx) (s === "mp_line" ? usedMp : usedEx).add(i)

      // INVs of this SO+SUB+STYLE (qty summed over matched styles)
      const invQ = new Map<string, number>()
      for (const i of idx) invQ.set(lines[i].inv, (invQ.get(lines[i].inv) || 0) + (Number(lines[i].qty) || 0))
      const invs = [...invQ.entries()].map(([inv, qty]) => ({ inv, qty }))

      // pair MER rows ↔ INVs: equal qty (a row already carrying that INV wins), then closest
      const left = [...mer].sort((a, b) => (hasHawb(b) ? 1 : 0) - (hasHawb(a) ? 1 : 0))
      const owner = new Map<string, any[]>()            // inv → MER rows
      const openInv = [...invs]
      const sameQ = (r: any, q: number) => Number(r.qtyRequestAir) === q || Number(r.qtyActualShip) === q
      for (const iv of [...openInv]) {
        let i = left.findIndex(r => up(r.invoiceNo) === iv.inv && sameQ(r, iv.qty))
        if (i < 0) i = left.findIndex(r => sameQ(r, iv.qty))
        if (i >= 0) { owner.set(iv.inv, [left.splice(i, 1)[0]]); openInv.splice(openInv.indexOf(iv), 1) }
      }
      while (openInv.length && left.length) {            // closest qty, one-to-one
        let best: { li: number; vi: number; d: number } | null = null
        left.forEach((r, li) => openInv.forEach((iv, vi) => {
          const d = Math.abs((Number(r.qtyRequestAir) || 0) - iv.qty)
          if (!best || d < best.d) best = { li, vi, d }
        }))
        const b = best!; const iv = openInv.splice(b.vi, 1)[0]
        owner.set(iv.inv, [left.splice(b.li, 1)[0]])
      }
      for (const r of left) {                            // more MER rows than INVs → merge into closest INV
        let bi = invs[0], bd = Infinity
        for (const iv of invs) { const d = Math.abs((Number(r.qtyRequestAir) || 0) - iv.qty); if (d < bd) { bd = d; bi = iv } }
        owner.set(bi.inv, [...(owner.get(bi.inv) || []), r])
      }
      const base0 = mer[0]
      for (const iv of invs) {
        const rs = owner.get(iv.inv) || []
        const extra = rs.length === 0
        const base = rs[0] || [...owner.values()].flat()[0] || base0
        groups.push({ key: `${sk}|${st}|${iv.inv}`, sk, rows: rs, base, inv: iv.inv, qty: iv.qty, src: s, extra })
        // per MER row: Σ qty / INVs of the rows it heads — its own INV + extra INVs copied from it
        const head = rs[0] || base
        const cur = perItem.get(head.id)
        perItem.set(head.id, { qty: (cur?.qty || 0) + iv.qty, inv: [cur?.inv, iv.inv].filter(Boolean).join(", "), src: s })
        for (const r of rs.slice(1)) if (!perItem.has(r.id)) perItem.set(r.id, { qty: iv.qty, inv: iv.inv, src: s })
      }
    }
  }
  return { groups, unshipped, perItem }
}

// Back-compat helper for pages that only need the per-line value.
export function mapShippedPerItem(items: any[], src: ShipSource): Map<string, ShipInfo> {
  return buildShipRows(items, src).perItem
}
