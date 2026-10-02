import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Admin: find + remove rows of ONE document that duplicate another document's rows.
//   exact  = same SO + SUB + qty Air in another (non-test, non-rejected) document → safe to delete
//   diff   = same SO + SUB but a different qty → admin decides (tick to delete)
//   fresh  = SO + SUB not in any other document → keep
// POST { documentNo, preview: true } → lists · POST { documentNo, itemIds: [...] } → delete those rows
// (same clean-up as the per-item delete: claim approvals, claim-forward ids, log; empty doc removed).
const soN = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")
const subU = (s: any) => String(s ?? "").trim().toUpperCase()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })
  const userId = (session.user as any).id
  const body = await req.json().catch(() => ({}))
  const documentNo = String(body.documentNo || "").trim()
  if (!documentNo) return NextResponse.json({ error: "documentNo required" }, { status: 400 })

  const doc = await prisma.airRequest.findFirst({ where: { documentNo }, select: { id: true, status: true, documentNo: true } })
  if (!doc) return NextResponse.json({ error: `ไม่พบเอกสาร ${documentNo}` }, { status: 404 })

  // ── delete ──
  if (!body.preview) {
    const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds.filter(Boolean) : []
    if (!itemIds.length) return NextResponse.json({ error: "ไม่ได้เลือกแถว" }, { status: 400 })
    await (prisma as any).claimApproval.deleteMany({ where: { itemId: { in: itemIds } } }).catch(() => {})
    const cfs = await (prisma as any).claimForward.findMany({ where: { requestId: doc.id } }).catch(() => [])
    for (const cf of cfs as any[]) {
      const keep = (cf.itemIds || []).filter((x: string) => !itemIds.includes(x))
      if (keep.length !== (cf.itemIds || []).length) {
        if (keep.length === 0) await (prisma as any).claimForward.delete({ where: { id: cf.id } }).catch(() => {})
        else await (prisma as any).claimForward.update({ where: { id: cf.id }, data: { itemIds: keep } }).catch(() => {})
      }
    }
    const del = await prisma.airRequestItem.deleteMany({ where: { id: { in: itemIds }, requestId: doc.id } })
    const remaining = await prisma.airRequestItem.count({ where: { requestId: doc.id } })
    await prisma.approvalLog.create({ data: { requestId: doc.id, userId, action: "DELETE_ITEMS", fromStatus: doc.status, toStatus: doc.status, comment: `Admin removed ${del.count} duplicate row(s) · เหลือ ${remaining}` } }).catch(() => {})
    if (remaining === 0) {
      await (prisma as any).hawbGroup.deleteMany({ where: { requestId: doc.id } }).catch(() => {})
      await (prisma as any).approvalSignature.deleteMany({ where: { requestId: doc.id } }).catch(() => {})
      await (prisma as any).claimForward.deleteMany({ where: { requestId: doc.id } }).catch(() => {})
      await (prisma as any).requestAttachment.deleteMany({ where: { requestId: doc.id } }).catch(() => {})
      await (prisma as any).approvalLog.deleteMany({ where: { requestId: doc.id } }).catch(() => {})
      await prisma.airRequest.delete({ where: { id: doc.id } }).catch(() => {})
    }
    return NextResponse.json({ ok: true, deleted: del.count, remaining, docDeleted: remaining === 0 })
  }

  // ── preview ──
  const mine = await prisma.airRequestItem.findMany({
    where: { requestId: doc.id },
    select: { id: true, so: true, sub: true, qtyRequestAir: true, hawbNo: true, invoiceNo: true, itemStatus: true },
  })
  const sos = [...new Set(mine.map(i => i.so).filter(Boolean))] as string[]
  const others = await (prisma.airRequestItem as any).findMany({
    where: { so: { in: sos }, requestId: { not: doc.id }, itemStatus: { not: "REJECTED" }, request: { isTest: false } },
    select: { so: true, sub: true, qtyRequestAir: true, request: { select: { documentNo: true } } },
  }) as any[]
  const byKey = new Map<string, { docNo: string; qty: number }[]>()
  for (const o of others) {
    const k = `${soN(o.so)}|${subU(o.sub)}`
    const a = byKey.get(k) || []; a.push({ docNo: o.request?.documentNo || "-", qty: Number(o.qtyRequestAir) || 0 }); byKey.set(k, a)
  }
  // Real shipments per SO+SUB = distinct INV in mp_line (AIR PP) ∪ export (AIR PREPAID). The same
  // SO+SUB+qty CAN legitimately repeat — one row per shipment round, each round its own INV. So a row is
  // only "excess" when the air-req rows for that SO+SUB outnumber the rounds (min 1 for not-yet-shipped).
  const invByKey = new Map<string, Set<string>>()
  const addInv = (so: any, sub: any, inv: any) => {
    const i = String(inv ?? "").trim().toUpperCase(); if (!i) return
    const k = `${soN(so)}|${subU(sub)}`; const s = invByKey.get(k) || new Set<string>(); s.add(i); invByKey.set(k, s)
  }
  const soDigits = [...new Set(sos.map(soN).filter(Boolean))]
  if (soDigits.length) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT so_no, sub_no, invoice_no FROM public.mp_line WHERE UPPER(TRIM(ship_mode))='AIR PP' AND ltrim(regexp_replace(so_no::text,'\\D','','g'),'0') = ANY($1::text[])`, soDigits)
      rows.forEach(r => addInv(r.so_no, r.sub_no, r.invoice_no))
    } catch { /* mp_line unavailable */ }
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT so_no, sub_no, invoice_no FROM sq_report.export_row WHERE UPPER(TRIM(ship_mode))='AIR PREPAID' AND ltrim(regexp_replace(so_no::text,'\\D','','g'),'0') = ANY($1::text[])`, soDigits)
      rows.forEach(r => addInv(r.so_no, r.sub_no, r.invoice_no))
    } catch { /* export unavailable */ }
  }
  // this doc's own rows per key (a doc may carry the same SO+SUB twice)
  const mineCount = new Map<string, number>()
  for (const it of mine) { const k = `${soN(it.so)}|${subU(it.sub)}`; mineCount.set(k, (mineCount.get(k) || 0) + 1) }

  const exact: any[] = [], diff: any[] = [], fresh: any[] = []
  for (const it of mine) {
    const qty = Number(it.qtyRequestAir) || 0
    const k = `${soN(it.so)}|${subU(it.sub)}`
    const o = byKey.get(k) || []
    const ships = invByKey.get(k)?.size || 0
    const airRows = o.length + (mineCount.get(k) || 0)            // every non-rejected air-req row for SO+SUB
    const excess = airRows > Math.max(ships, 1)                    // more rows than shipment rounds → duplicate
    const row = { id: it.id, so: it.so, sub: it.sub || "", qty, hawbNo: it.hawbNo || "", invoiceNo: it.invoiceNo || "", itemStatus: it.itemStatus, ships, airRows, excess }
    if (!o.length) fresh.push(row)
    else if (o.some(x => x.qty === qty)) exact.push({ ...row, others: o.filter(x => x.qty === qty).map(x => x.docNo) })
    else diff.push({ ...row, others: o.map(x => `${x.docNo} qty ${x.qty}`) })
  }
  const by = (a: any, b: any) => String(a.so).localeCompare(String(b.so)) || String(a.sub).localeCompare(String(b.sub))
  return NextResponse.json({ ok: true, documentNo: doc.documentNo, status: doc.status, total: mine.length, exact: exact.sort(by), diff: diff.sort(by), fresh: fresh.length })
}
