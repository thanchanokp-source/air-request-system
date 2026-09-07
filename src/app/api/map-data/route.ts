import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Cross-check Air Request SOs against the production line table public.mp_line (VLOOKUP-style).
// Join key = SO (leading zeros stripped) + SUB. INV is NOT a join key (air uses "A…" invoices,
// mp_line uses "G…" — different series). QTY Air comes from mp_line.final_pcs (summed per SO+SUB,
// since one SO+SUB can span several pack/invoice rows).
const soN = (s: any) => String(s == null ? "" : s).replace(/\D/g, "").replace(/^0+/, "")
const norm = (s: any) => String(s == null ? "" : s).trim().toUpperCase()
const K = (so: any, sub: any) => soN(so) + "|" + norm(sub)

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let mp: any[] = []
  try {
    mp = await prisma.$queryRawUnsafe<any[]>('SELECT so_no, sub_no, invoice_no, final_pcs FROM public.mp_line')
  } catch (e: any) {
    return NextResponse.json({ error: "อ่านตาราง public.mp_line ไม่ได้: " + (e?.message || "error") }, { status: 500 })
  }

  // mp_line → aggregate final_pcs by SO+SUB
  const mpMap = new Map<string, { so: string; sub: string; pcs: number; rows: number; inv: Set<string> }>()
  for (const r of mp) {
    const k = K(r.so_no, r.sub_no)
    const e = mpMap.get(k) || { so: String(r.so_no ?? ""), sub: String(r.sub_no ?? ""), pcs: 0, rows: 0, inv: new Set<string>() }
    e.pcs += Number(r.final_pcs) || 0
    e.rows++
    if (r.invoice_no) e.inv.add(String(r.invoice_no))
    mpMap.set(k, e)
  }

  // air items → aggregate by SO+SUB
  const items = await prisma.airRequestItem.findMany({
    select: { so: true, sub: true, invoiceNo: true, qtyRequestAir: true, request: { select: { documentNo: true } } },
  })
  const airMap = new Map<string, { so: string; sub: string | null; qty: number; inv: Set<string>; docs: Set<string> }>()
  for (const i of items) {
    const k = K(i.so, i.sub)
    const e = airMap.get(k) || { so: i.so, sub: i.sub, qty: 0, inv: new Set<string>(), docs: new Set<string>() }
    e.qty += Number(i.qtyRequestAir) || 0
    if (i.invoiceNo) e.inv.add(i.invoiceNo)
    if ((i as any).request?.documentNo) e.docs.add((i as any).request.documentNo)
    airMap.set(k, e)
  }

  const rows: any[] = []
  let matched = 0, notFound = 0, merUpload = 0
  for (const [k, a] of airMap) {
    const m = mpMap.get(k)
    if (m) { matched++; rows.push({ status: "matched", so: a.so, sub: a.sub || "", qtyAir: m.pcs, airQty: a.qty, docs: [...a.docs].slice(0, 3), airInv: [...a.inv].slice(0, 2), mpInv: [...m.inv].slice(0, 2) }) }
    else { notFound++; rows.push({ status: "not_found", so: a.so, sub: a.sub || "", qtyAir: null, airQty: a.qty, docs: [...a.docs].slice(0, 3), airInv: [...a.inv].slice(0, 2), mpInv: [] }) }
  }
  for (const [k, m] of mpMap) {
    if (!airMap.has(k)) { merUpload++; rows.push({ status: "mer_upload", so: m.so, sub: m.sub || "", qtyAir: m.pcs, airQty: null, docs: [], airInv: [], mpInv: [...m.inv].slice(0, 2) }) }
  }

  const airKeys = airMap.size
  return NextResponse.json({
    summary: {
      airKeys, mpKeys: mpMap.size, matched, notFound, merUpload,
      matchPct: airKeys ? Math.round((1000 * matched) / airKeys) / 10 : 0,
    },
    rows,
  })
}
