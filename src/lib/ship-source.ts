import { prisma } from "@/lib/prisma"
import type { ShipSource } from "@/lib/ship-map"

// Server-side loader of the REAL shipped qty (same rules as /api/air-export-map):
//   mp_line  = status SHIPPED + ship_mode AIR PP · final_pcs
//   export   = sq_report.export_row ship_mode AIR PREPAID · qty_pcs
//   per SO+SUB (and per SO+SUB+INV) the source with the LARGER total wins (mp_line can be partial).
const soN = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")
const up = (s: any) => String(s ?? "").trim().toUpperCase()

export async function loadShipSource(): Promise<ShipSource> {
  const mpSub: Record<string, number> = {}, exSub: Record<string, number> = {}
  const invMp: Record<string, number> = {}, invEx: Record<string, number> = {}
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT so_no, sub_no, invoice_no, SUM(final_pcs)::float8 q FROM public.mp_line
       WHERE UPPER(TRIM(status)) = 'SHIPPED' AND UPPER(TRIM(ship_mode)) = 'AIR PP' GROUP BY 1,2,3`)
    for (const r of rows) {
      const k = soN(r.so_no); if (!k) continue
      const sk = `${k}|${up(r.sub_no)}`, q = Number(r.q) || 0
      mpSub[sk] = (mpSub[sk] || 0) + q
      invMp[`${sk}|${up(r.invoice_no)}`] = (invMp[`${sk}|${up(r.invoice_no)}`] || 0) + q
    }
  } catch { /* mp_line unavailable */ }
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT so_no, sub_no, invoice_no, SUM(qty_pcs)::float8 q FROM sq_report.export_row
       WHERE UPPER(TRIM(ship_mode)) = 'AIR PREPAID' GROUP BY 1,2,3`)
    for (const r of rows) {
      const k = soN(r.so_no); if (!k) continue
      const sk = `${k}|${up(r.sub_no)}`, q = Number(r.q) || 0
      exSub[sk] = (exSub[sk] || 0) + q
      invEx[`${sk}|${up(r.invoice_no)}`] = (invEx[`${sk}|${up(r.invoice_no)}`] || 0) + q
    }
  } catch { /* export unavailable */ }
  const subActual: ShipSource["subActual"] = {}
  for (const k of new Set([...Object.keys(mpSub), ...Object.keys(exSub)])) {
    const a = mpSub[k] || 0, b = exSub[k] || 0
    subActual[k] = b > a ? { qty: b, src: "export" } : { qty: a, src: "mp_line" }
  }
  return { subActual, invMp, invEx }
}
