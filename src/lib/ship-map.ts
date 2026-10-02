// Map air-request lines (what MER keyed) to the REAL shipped qty in mp_line / export — per line.
//
// Same rules as the dashboard DATA TABLE "ส่งออกจริง" (src/app/(dashboard)/dashboard/page.tsx · shipAgg):
//   · match by SO+SUB; take the source (mp_line | export) with the larger SO+SUB total
//   · give each line an INV of that source:
//       a) an INV whose qty equals the line's air/ship qty (1:1 — a line already carrying that INV wins)
//       b) the INV LG keyed on the line, if it exists in the source
//       c) INVs still open → the lines still left (one combined group)
//       d) leftover lines: same qty as a placed line = duplicate (joins that INV) · else = not shipped yet
//   · inside one INV, lines are grouped by their QTY AIR (same qty = duplicate); the INV's qty is split
//     over those groups by qty → each line gets its group's qty
//   · SO+SUB not in the source → not shipped (no entry)
// ⚠ Keep in step with the dashboard if those rules change.

export type ShipSource = {
  subActual: Record<string, { qty: number; src: string }>   // "SO|SUB" → total + chosen source
  invMp: Record<string, number>                              // "SO|SUB|INV" → qty (mp_line)
  invEx: Record<string, number>                              // "SO|SUB|INV" → qty (export)
}
export type ShipInfo = { qty: number; inv: string; src: string }

const soKey = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")
const up = (s: any) => String(s ?? "").trim().toUpperCase()
export const shipSubKey = (it: any) => `${soKey(it?.so)}|${up(it?.sub)}`
const hasHawb = (it: any) => { const h = String(it?.hawbNo ?? "").trim(); return h !== "" && !/^[-.\s]*$/.test(h) }

export function mapShippedPerItem(items: any[], src: ShipSource): Map<string, ShipInfo> {
  const out = new Map<string, ShipInfo>()
  const bySub = new Map<string, any[]>()
  for (const it of items) { const k = shipSubKey(it); const g = bySub.get(k) || []; g.push(it); bySub.set(k, g) }

  const emit = (label: string, g: any[], invQty: number, s: string) => {
    const byQ = new Map<number, any[]>()
    for (const r of g) { const q = Number(r.qtyRequestAir) || 0; const a = byQ.get(q) || []; a.push(r); byQ.set(q, a) }
    const parts = [...byQ.entries()]
    const W = parts.reduce((a, [q]) => a + q, 0)
    const raw = parts.map(([q]) => W > 0 ? invQty * q / W : invQty / parts.length)
    const base = raw.map(Math.floor); let rest = Math.round(invQty) - base.reduce((a, b) => a + b, 0)
    raw.map((v, i) => ({ i, f: v - base[i] })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (rest > 0) { base[i]++; rest-- } })
    parts.forEach(([, rs], i) => rs.forEach(r => out.set(r.id, { qty: base[i], inv: label, src: s })))
  }

  for (const [sk, rows] of bySub) {
    const tot = src.subActual?.[sk]
    if (!tot) continue                                                    // not shipped
    const s = tot.src === "export" ? "export" : "mp_line"
    const invMap = (s === "export" ? src.invEx : src.invMp) || {}
    const srcInvs = Object.keys(invMap).filter(k => k.startsWith(`${sk}|`)).map(k => k.split("|")[2] || "")
    if (!srcInvs.length) { emit("", rows, Number(tot.qty) || 0, s); continue }
    const qOf = (inv: string) => Number(invMap[`${sk}|${inv}`]) || 0
    const sameQty = (r: any, q: number) => Number(r.qtyRequestAir) === q || Number(r.qtyActualShip) === q
    const assigned = new Map<string, any[]>()
    const put = (inv: string, r: any) => assigned.set(inv, [...(assigned.get(inv) || []), r])
    const left = [...rows].sort((a, b) => (hasHawb(b) ? 1 : 0) - (hasHawb(a) ? 1 : 0))
    const open = [...srcInvs]
    for (const inv of [...open]) {                                          // a)
      const q = qOf(inv)
      let i = left.findIndex(r => up(r.invoiceNo) === inv && sameQty(r, q))
      if (i < 0) i = left.findIndex(r => sameQty(r, q))
      if (i >= 0) { put(inv, left.splice(i, 1)[0]); open.splice(open.indexOf(inv), 1) }
    }
    for (let i = left.length - 1; i >= 0; i--) {                            // b)
      const inv = up(left[i].invoiceNo)
      if (srcInvs.includes(inv)) { put(inv, left.splice(i, 1)[0]); const o = open.indexOf(inv); if (o >= 0) open.splice(o, 1) }
    }
    if (open.length && left.length) emit(open.join(", "), left.splice(0), open.reduce((a, inv) => a + qOf(inv), 0), s)  // c)
    for (const r of left) {                                                  // d)
      const hit = [...assigned.entries()].find(([, g]) => g.some(x => Number(x.qtyRequestAir) === Number(r.qtyRequestAir)))
      if (hit) put(hit[0], r)
    }
    for (const [inv, g] of assigned) emit(inv, g, qOf(inv), s)
  }
  return out
}
