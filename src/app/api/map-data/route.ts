import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Cross-check Air Request SOs against the production line table public.mp_line (VLOOKUP-style).
// Join key modes:
//   "sosub" (default) → SO (leading zeros stripped) + SUB   (exact per-sub, lower match)
//   "so"              → SO only, final_pcs summed across every sub of that SO (higher match)
// INV is NOT a join key (air uses "A…" invoices, mp_line uses "G…" — different series).
// QTY Air comes from mp_line.final_pcs.
const soN = (s: any) => String(s == null ? "" : s).replace(/\D/g, "").replace(/^0+/, "")
const norm = (s: any) => String(s == null ? "" : s).trim().toUpperCase()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const mp0 = req.nextUrl.searchParams.get("mode")
  const mode = mp0 === "so" ? "so" : mp0 === "sosubinv" ? "sosubinv" : "sosub"
  // Invoice normalize: strip spaces/dashes, uppercase → so "A250920-3" and "a2509203" compare equal.
  const normInv = (s: any) => String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "")
  const K = mode === "so" ? (so: any, _sub: any, _inv: any) => soN(so)
    : mode === "sosubinv" ? (so: any, sub: any, inv: any) => soN(so) + "|" + norm(sub) + "|" + normInv(inv)
    : (so: any, sub: any, _inv: any) => soN(so) + "|" + norm(sub)

  let mp: any[] = []
  try {
    mp = await prisma.$queryRawUnsafe<any[]>('SELECT so_no, sub_no, invoice_no, final_pcs, brand FROM public.mp_line')
  } catch (e: any) {
    return NextResponse.json({ error: "อ่านตาราง public.mp_line ไม่ได้: " + (e?.message || "error") }, { status: 500 })
  }

  const mpMap = new Map<string, { so: string; sub: string; pcs: number; rows: number; inv: Set<string>; brand: Set<string> }>()
  const mpSoSet = new Set<string>() // SO-level presence in mp_line (ignore SUB) — for "no SO at all"
  for (const r of mp) {
    const k = K(r.so_no, r.sub_no, r.invoice_no)
    mpSoSet.add(soN(r.so_no))
    const e = mpMap.get(k) || { so: String(r.so_no ?? ""), sub: mode === "so" ? "" : String(r.sub_no ?? ""), pcs: 0, rows: 0, inv: new Set<string>(), brand: new Set<string>() }
    e.pcs += Number(r.final_pcs) || 0
    e.rows++
    if (r.invoice_no) e.inv.add(String(r.invoice_no))
    if (r.brand) e.brand.add(String(r.brand))
    mpMap.set(k, e)
  }

  const items = await prisma.airRequestItem.findMany({
    select: { so: true, sub: true, brand: true, invoiceNo: true, qtyRequestAir: true, qtyOriginalShipment: true, planShipmentDate: true, request: { select: { documentNo: true } } },
  })
  const airMap = new Map<string, { so: string; sub: string | null; qty: number; plan: number; inv: Set<string>; docs: Set<string>; brand: Set<string>; dates: Set<string> }>()
  for (const i of items) {
    const k = K(i.so, i.sub, i.invoiceNo)
    const e = airMap.get(k) || { so: i.so, sub: mode === "so" ? "" : i.sub, qty: 0, plan: 0, inv: new Set<string>(), docs: new Set<string>(), brand: new Set<string>(), dates: new Set<string>() }
    e.qty += Number(i.qtyRequestAir) || 0
    e.plan += Number(i.qtyOriginalShipment) || 0
    if (i.invoiceNo) e.inv.add(i.invoiceNo)
    if (i.brand) e.brand.add(String(i.brand))
    if (i.planShipmentDate) { const d = new Date(i.planShipmentDate); if (!isNaN(d.getTime())) e.dates.add(d.toISOString().slice(0, 10)) }
    if ((i as any).request?.documentNo) e.docs.add((i as any).request.documentNo)
    airMap.set(k, e)
  }

  const rows: any[] = []
  let matched = 0, notFound = 0, merUpload = 0
  for (const [k, a] of airMap) {
    const m = mpMap.get(k)
    if (m) { matched++; rows.push({ status: "matched", so: a.so, sub: a.sub || "", qtyAir: m.pcs, airQty: a.qty, qtyPlan: a.plan, brand: [...a.brand].slice(0, 2), mpBrand: [...m.brand].slice(0, 2), shipDates: [...a.dates].sort(), docs: [...a.docs].slice(0, 3), airInv: [...a.inv].slice(0, 3), mpInv: [...m.inv].slice(0, 3) }) }
    else {
      notFound++
      // Why not found? no INV yet = waiting for LG; has INV but SUB differs (SO exists in mp_line);
      // has INV and the SO isn't in mp_line at all.
      const nfReason = a.inv.size === 0 ? "no_inv" : (mpSoSet.has(soN(a.so)) ? "inv_sub" : "inv_no_so")
      rows.push({ status: "not_found", nfReason, so: a.so, sub: a.sub || "", qtyAir: null, airQty: a.qty, qtyPlan: a.plan, brand: [...a.brand].slice(0, 2), mpBrand: [], shipDates: [...a.dates].sort(), docs: [...a.docs].slice(0, 3), airInv: [...a.inv].slice(0, 3), mpInv: [] })
    }
  }
  for (const [k, m] of mpMap) {
    if (!airMap.has(k)) { merUpload++; rows.push({ status: "mer_upload", so: m.so, sub: m.sub || "", qtyAir: m.pcs, airQty: null, qtyPlan: null, brand: [], mpBrand: [...m.brand].slice(0, 2), shipDates: [], docs: [], airInv: [], mpInv: [...m.inv].slice(0, 3) }) }
  }

  const airKeys = airMap.size
  return NextResponse.json({
    mode,
    summary: {
      airKeys, mpKeys: mpMap.size, matched, notFound, merUpload,
      matchPct: airKeys ? Math.round((1000 * matched) / airKeys) / 10 : 0,
    },
    rows,
  })
}
