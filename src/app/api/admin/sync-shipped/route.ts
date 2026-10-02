import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { mapShippedPerItem } from "@/lib/ship-map"
import { loadShipSource } from "@/lib/ship-source"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// SYNC "QTY ส่งออกจริง" into the database so EVERY page computes from the real shipped qty.
//   1. map every air-request line to mp_line / export (same rules as the dashboard, lib/ship-map)
//   2. write the mapped qty into qtyActualShip (QTY Air / MER value is never touched)
//   3. every HAWB that had a changed line is re-split by the new qty — its money TOTAL stays the same
//      (Σ actual before = what LG keyed from the HAWB), so ACTUAL and every claim amount follow.
// Admin:  POST { preview?: boolean, includeDone?: boolean }
// Cron:   GET  ?secret=CRON_SECRET  (commit, open documents only — never rewrites finished ones)
const DONE = new Set(["COMPLETED", "PENDING_ACCOUNTING", "ACCOUNTING_PENDING"])

async function run(opts: { preview: boolean; includeDone: boolean }) {
  const src = await loadShipSource()
  const items = await (prisma.airRequestItem as any).findMany({
    where: { request: { isTest: false } },
    select: { id: true, so: true, sub: true, qtyRequestAir: true, qtyActualShip: true, invoiceNo: true, hawbNo: true, actualAirFreight: true, itemStatus: true,
      request: { select: { documentNo: true, status: true } } },
  }) as any[]
  const map = mapShippedPerItem(items, src)
  const isDone = (it: any) => DONE.has(String(it.itemStatus || "")) || DONE.has(String(it.request?.status || ""))
  const changed = items.filter(it => {
    const m = map.get(it.id); if (!m) return false
    if (!opts.includeDone && isDone(it)) return false
    return Math.round(m.qty) !== Math.round(Number(it.qtyActualShip ?? NaN))
  })
  const hawbOf = (it: any) => { const h = String(it.hawbNo || "").trim(); return h && !/^[-.\s]*$/.test(h) ? h : "" }
  const hawbs = [...new Set(changed.map(hawbOf).filter(Boolean))]
  const summary = {
    scanned: items.length, mapped: map.size, changed: changed.length, hawbs: hawbs.length,
    doneSkipped: opts.includeDone ? 0 : items.filter(it => map.has(it.id) && isDone(it) && Math.round(map.get(it.id)!.qty) !== Math.round(Number(it.qtyActualShip ?? NaN))).length,
    sample: changed.slice(0, 80).map(it => ({ doc: it.request?.documentNo || "-", so: it.so, sub: it.sub || "", qtyAir: Number(it.qtyRequestAir) || 0,
      before: it.qtyActualShip ?? null, after: map.get(it.id)!.qty, inv: map.get(it.id)!.inv, hawb: hawbOf(it) || "-" })),
  }
  if (opts.preview) return { ok: true, preview: true, ...summary }

  // money total of each affected HAWB BEFORE the qty change (keeps LG's HAWB amount)
  const totals = new Map<string, number>()
  for (const h of hawbs) {
    const agg = await (prisma.airRequestItem as any).aggregate({ where: { hawbNo: h }, _sum: { actualAirFreight: true } })
    totals.set(h, Math.round((Number(agg?._sum?.actualAirFreight) || 0) * 100) / 100)
  }
  for (const it of changed) {
    await prisma.airRequestItem.update({ where: { id: it.id }, data: { qtyActualShip: map.get(it.id)!.qty } as any }).catch(() => {})
  }
  let hawbDone = 0
  for (const h of hawbs) {
    const total = totals.get(h) || 0
    if (!(total > 0)) continue
    const all = await (prisma.airRequestItem as any).findMany({ where: { hawbNo: h },
      select: { id: true, qtyActualShip: true, qtyRequestAir: true, actualAirFreight: true, itemStatus: true, request: { select: { status: true, isTest: true } } }, orderBy: { id: "asc" } }) as any[]
    // finished documents keep their money unless includeDone → only the open lines share what's left
    const fixed = opts.includeDone ? [] : all.filter(isDone)
    const lines = all.filter(it => !fixed.includes(it))
    const movable = Math.round((total - fixed.reduce((a, it) => a + (Number(it.actualAirFreight) || 0), 0)) * 100) / 100
    const q = (it: any) => Math.max(Number(it.qtyActualShip ?? it.qtyRequestAir) || 0, 0)
    const Q = lines.reduce((a, it) => a + q(it), 0)
    if (!(Q > 0) || !(movable > 0)) continue
    let acc = 0
    for (let i = 0; i < lines.length; i++) {
      const v = i === lines.length - 1 ? Math.round((movable - acc) * 100) / 100 : Math.round(movable * q(lines[i]) / Q * 100) / 100
      acc += v
      await prisma.airRequestItem.update({ where: { id: lines[i].id }, data: { actualAirFreight: v } }).catch(() => {})
    }
    hawbDone++
  }
  return { ok: true, ...summary, written: changed.length, hawbRedistributed: hawbDone }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  try { return NextResponse.json(await run({ preview: !!body.preview, includeDone: !!body.includeDone })) }
  catch (e: any) { return NextResponse.json({ error: e?.message || "sync failed" }, { status: 500 }) }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const ok = !!secret && (req.headers.get("authorization") === `Bearer ${secret}` || req.nextUrl.searchParams.get("secret") === secret)
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json(await run({ preview: false, includeDone: false })) }
  catch (e: any) { return NextResponse.json({ error: e?.message || "sync failed" }, { status: 500 }) }
}
