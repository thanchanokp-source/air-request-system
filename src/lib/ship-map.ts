// Map air-request lines (what MER keyed) to the REAL shipments in mp_line / export.
// ONE implementation used by the dashboard DATA TABLE, the AIR REQUESTS "QTY ส่งออกจริง" column and the
// "sync shipped qty" tool, so every page shows the same numbers.
//
// Rules (agreed with the business):
//   · every field comes from the MER row EXCEPT QTY AIR and INV, which come from the shipment source
//   · match by SO + SUB + STYLE. STYLE matches by CONTAINS either way, ignoring case/spaces
//     (MER may key "3AZ" for "3AZ-010"); a source line matching several MER styles goes to the longest
//   · source per SO+SUB+STYLE = ONE of mp_line / export (never both): the larger total; equal total →
//     the one with more INVs; still equal → mp_line (mp_line can miss or lump INVs)
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
    // MER styles that CONTAIN each other are the same style keyed differently ("03AZ" vs
    // "03AZ-00A-A2T-CYB") → one cluster. Clusters are processed most-specific (longest) first.
    const byStyle = new Map<string, any[]>()
    for (const r of rows) { const s = normStyle(r.style); const g = byStyle.get(s) || []; g.push(r); byStyle.set(s, g) }
    const styleList = [...byStyle.keys()]
    const parent = styleList.map((_, i) => i)
    const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]))
    for (let i = 0; i < styleList.length; i++) for (let j = i + 1; j < styleList.length; j++)
      if (styleHit(styleList[i], styleList[j])) parent[find(i)] = find(j)
    const clusterMap = new Map<number, string[]>()
    styleList.forEach((s, i) => { const r = find(i); clusterMap.set(r, [...(clusterMap.get(r) || []), s]) })
    const clusters = [...clusterMap.values()].sort((a, b) => Math.max(...b.map(s => s.length)) - Math.max(...a.map(s => s.length)))
    const usedMp = new Set<number>(), usedEx = new Set<number>()

    for (const cl of clusters) {
      const mer = cl.flatMap(s => byStyle.get(s)!)
      const st = cl.slice().sort((a, b) => b.length - a.length)[0]          // label for the row key
      const hitAny = (l: SrcLine) => cl.some(s => styleHit(s, normStyle(l.style)))
      const pick = (lines: SrcLine[], used: Set<number>) => lines.map((_, i) => i).filter(i => !used.has(i) && hitAny(lines[i]))
      // Both sources describe the SAME shipments — use ONE of them per SO+SUB+STYLE, never add them:
      //   1) the larger total (mp_line can MISS INVs: 1256946 mp 12 vs export 12+88+1)
      //   2) equal total → the one with more INVs (mp_line can LUMP INVs: 09261668 one 6,768 vs 3,102+3,666)
      //   3) still equal → mp_line
      const mpIdx = pick(mpLines, usedMp), exIdx = pick(exLines, usedEx)
      const tot = (lines: SrcLine[], ix: number[]) => ix.reduce((a, i) => a + (Number(lines[i].qty) || 0), 0)
      const nInv = (lines: SrcLine[], ix: number[]) => new Set(ix.map(i => lines[i].inv)).size
      const mT = tot(mpLines, mpIdx), eT = tot(exLines, exIdx)
      const useEx = eT > mT || (eT === mT && eT > 0 && nInv(exLines, exIdx) > nInv(mpLines, mpIdx))
      const s: "mp_line" | "export" = useEx ? "export" : "mp_line"
      const lines = useEx ? exLines : mpLines
      const idx = useEx ? exIdx : mpIdx
      if (!idx.length) { unshipped.push(...mer); continue }
      // claim this style's lines in BOTH sources so no other cluster picks the same shipments up
      for (const i of mpIdx) usedMp.add(i)
      for (const i of exIdx) usedEx.add(i)

      // INVs of this SO+SUB+STYLE (qty summed over matched styles)
      const invQ = new Map<string, number>()
      for (const i of idx) invQ.set(lines[i].inv, (invQ.get(lines[i].inv) || 0) + (Number(lines[i].qty) || 0))
      const invs = [...invQ.entries()].map(([inv, qty]) => ({ inv, qty }))

      // pair MER rows ↔ INVs: equal qty (a row already carrying that INV wins), then closest
      // head-row preference: booked (HAWB) → has ACTUAL → OLDER document (a duplicate upload is usually
      // the later doc, e.g. 2609_0056) — so the original document is the one paired / shown
      const docNo = (r: any) => String(r?.request?.documentNo || "")
      const left = [...mer].sort((a, b) =>
        ((hasHawb(b) ? 1 : 0) - (hasHawb(a) ? 1 : 0)) ||
        (((Number(b.actualAirFreight) || 0) > 0 ? 1 : 0) - ((Number(a.actualAirFreight) || 0) > 0 ? 1 : 0)) ||
        docNo(a).localeCompare(docNo(b)))
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
      for (const r of left) {                            // more MER rows than INVs → duplicates: merge into closest INV (head stays first)
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
