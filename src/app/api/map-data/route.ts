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

  const mode = req.nextUrl.searchParams.get("mode") === "so" ? "so" : "sosub"
  const K = mode === "so" ? (so: any, _sub: any) => soN(so) : (so: any, sub: any) => soN(so) + "|" + norm(sub)

  let mp: any[] = []
  try {
    mp = await prisma.$queryRawUnsafe<any[]>('SELECT so_no, sub_no, invoice_no, final_pcs FROM public.mp_line')
  } catch (e: any) {
    return NextResponse.json({ error: "อ่านตาราง public.mp_line ไม่ได้: " + (e?.message || "error") }, { status: 500 })
  }

  const mpMap = new Map<string, { so: string; sub: string; pcs: number; rows: number; inv: Set<string> }>()
  for (const r of mp) {
    const k = K(r.so_no, r.sub_no)
    const e = mpMap.get(k) || { so: String(r.so_no ?? ""), sub: mode === "so" ? "" : String(r.sub_no ?? ""), pcs: 0, rows: 0, inv: new Set<string>() }
    e.pcs += Number(r.final_pcs) || 0
    e.rows++
    if (r.invoice_no) e.inv.add(String(r.invoice_no))
    mpMap.set(k, e)
  }

  const items = await prisma.airRequestItem.findMany({
    select: { so: true, sub: true, invoiceNo: true, qtyRequestAir: true, qtyOriginalShipment: true, request: { select: { documentNo: true } } },
  })
  const airMap = new Map<string, { so: string; sub: string | null; qty: number; plan: number; inv: Set<string>; docs: Set<string> }>()
  for (const i of items) {
    const k = K(i.so, i.sub)
    const e = airMap.get(k) || { so: i.so, sub: mode === "so" ? "" : i.sub, qty: 0, plan: 0, inv: new Set<string>(), docs: new Set<string>() }
    e.qty += Number(i.qtyRequestAir) || 0
    e.plan += Number(i.qtyOriginalShipment) || 0
    if (i.invoiceNo) e.inv.add(i.invoiceNo)
    if ((i as any).request?.documentNo) e.docs.add((i as any).request.documentNo)
    airMap.set(k, e)
  }

  const rows: any[] = []
  let matched = 0, notFound = 0, merUpload = 0
  for (const [k, a] of airMap) {
    const m = mpMap.get(k)
    if (m) { matched++; rows.push({ status: "matched", so: a.so, sub: a.sub || "", qtyAir: m.pcs, airQty: a.qty, qtyPlan: a.plan, docs: [...a.docs].slice(0, 3), airInv: [...a.inv].slice(0, 3), mpInv: [...m.inv].slice(0, 3) }) }
    else { notFound++; rows.push({ status: "not_found", so: a.so, sub: a.sub || "", qtyAir: null, airQty: a.qty, qtyPlan: a.plan, docs: [...a.docs].slice(0, 3), airInv: [...a.inv].slice(0, 3), mpInv: [] }) }
  }
  for (const [k, m] of mpMap) {
    if (!airMap.has(k)) { merUpload++; rows.push({ status: "mer_upload", so: m.so, sub: m.sub || "", qtyAir: m.pcs, airQty: null, qtyPlan: null, docs: [], airInv: [], mpInv: [...m.inv].slice(0, 3) }) }
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
