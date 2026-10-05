import { prisma } from "@/lib/prisma"
import type { ShipSource, SrcLine } from "@/lib/ship-map"

// Server-side loader of the REAL shipments for lib/ship-map:
//   mp_line = status SHIPPED + ship_mode AIR PP · final_pcs
//   export  = sq_report.export_row ship_mode AIR PREPAID · qty_pcs
// Returned per "SO|SUB" as lines aggregated by INV + STYLE (mp_line and export kept separate —
// ship-map uses mp_line first and export only when mp_line has nothing for that SO+SUB+STYLE).
const soN = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")
const up = (s: any) => String(s ?? "").trim().toUpperCase()

export function toSrcLines(rows: any[]): Record<string, SrcLine[]> {
  const acc = new Map<string, SrcLine>()
  for (const r of rows) {
    const k = soN(r.so_no); if (!k) continue
    const sk = `${k}|${up(r.sub_no)}`, inv = up(r.invoice_no), style = String(r.style ?? "").trim()
    const key = `${sk}||${inv}||${style.toUpperCase()}`
    const cur = acc.get(key)
    if (cur) cur.qty += Number(r.q) || 0
    else acc.set(key, { inv, style, qty: Number(r.q) || 0 })
  }
  const out: Record<string, SrcLine[]> = {}
  for (const [key, l] of acc) { const sk = key.split("||")[0]; (out[sk] ||= []).push(l) }
  return out
}

export async function loadShipSource(): Promise<ShipSource> {
  let mp: any[] = [], ex: any[] = []
  try {
    mp = await prisma.$queryRawUnsafe<any[]>(
      `SELECT so_no, sub_no, invoice_no, style, SUM(final_pcs)::float8 q FROM public.mp_line
       WHERE UPPER(TRIM(status)) = 'SHIPPED' AND UPPER(TRIM(ship_mode)) = 'AIR PP' GROUP BY 1,2,3,4`)
  } catch { /* mp_line unavailable */ }
  try {
    ex = await prisma.$queryRawUnsafe<any[]>(
      `SELECT so_no, sub_no, invoice_no, style, SUM(qty_pcs)::float8 q FROM sq_report.export_row
       WHERE UPPER(TRIM(ship_mode)) = 'AIR PREPAID' GROUP BY 1,2,3,4`)
  } catch { /* export unavailable */ }
  return { mp: toSrcLines(mp), ex: toSrcLines(ex) }
}
