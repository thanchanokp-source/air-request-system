import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redistributeHawbCost } from "@/lib/freight"

export const runtime = "nodejs"

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const role = (session.user as any).role
  const email = String((session.user as any).email || "").toLowerCase()
  if (role !== "ADMIN" && email !== "jariya.t@nanyangtextile.com") return { err: NextResponse.json({ error: "Admin only" }, { status: 403 }) }
  return { err: null as any }
}

// GET ?hawb=CAR-... → all SOs currently on that HAWB (across documents), with qty + current actual.
export async function GET(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err
  const hawb = String(req.nextUrl.searchParams.get("hawb") || "").trim()
  if (!hawb) return NextResponse.json({ error: "hawb required" }, { status: 400 })
  const items = await (prisma.airRequestItem as any).findMany({
    where: { hawbNo: hawb },
    select: { id: true, so: true, sub: true, brand: true, invoiceNo: true, hawbNo: true, actualAirFreight: true, qtyActualShip: true, qtyRequestAir: true, request: { select: { documentNo: true } } },
    orderBy: [{ so: "asc" }],
  })
  const rows = items.map((it: any) => ({
    id: it.id, documentNo: it.request?.documentNo || "-", so: it.so, sub: it.sub, brand: it.brand,
    invoiceNo: it.invoiceNo, hawbNo: it.hawbNo, actualAirFreight: it.actualAirFreight,
    qty: Number(it.qtyActualShip ?? it.qtyRequestAir) || 0,
  }))
  const totalQty = rows.reduce((s: number, r: any) => s + r.qty, 0)
  const totalActual = rows.reduce((s: number, r: any) => s + (Number(r.actualAirFreight) || 0), 0)
  return NextResponse.json({ hawb, rows, totalQty, totalActual })
}

export async function POST(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err
  const body = await req.json()
  const action = body.action

  if (action === "rename") {
    const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds : []
    const newHawb = String(body.newHawb || "").trim()
    if (!itemIds.length || !newHawb) return NextResponse.json({ error: "itemIds + newHawb required" }, { status: 400 })
    const r = await prisma.airRequestItem.updateMany({ where: { id: { in: itemIds } }, data: { hawbNo: newHawb } as any })
    return NextResponse.json({ ok: true, moved: r.count, newHawb })
  }

  // Attach an INV's SO+SUB lines to this HAWB (for an INV that never got booked). Looks the INV up in
  // mp_line (AIR PP) then sq_report.export_row (AIR PREPAID), matches NYG air-req items by SO+SUB
  // (unbooked, or already on this HAWB), and sets invoiceNo + hawbNo + actual qty. Then redistribute.
  if (action === "add_inv") {
    // รับได้หลาย INV — คั่นด้วย comma / เว้นวรรค / ขึ้นบรรทัดใหม่
    const invs = [...new Set(String(body.inv || "").split(/[\s,;]+/).map((s: string) => s.trim()).filter(Boolean))]
    const hawb = String(body.hawb || "").trim()
    if (!invs.length || !hawb) return NextResponse.json({ error: "inv + hawb required" }, { status: 400 })
    const soN = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")
    const subU = (s: any) => String(s ?? "").trim().toUpperCase()
    const qByKey = new Map<string, number>()          // so|sub → qty รวม
    const invByKey = new Map<string, string>()         // so|sub → INV ที่มาจาก (ตัวแรกที่เจอ)
    const srcByInv: Record<string, string> = {}        // INV → mp_line / export
    const notFound: string[] = []
    for (const inv of invs as string[]) {
      let lines: any[] = [], src = "mp_line"
      try { lines = await prisma.$queryRawUnsafe<any[]>(`SELECT so_no, sub_no, final_pcs AS pcs FROM public.mp_line WHERE TRIM(invoice_no)=$1 AND UPPER(TRIM(status))='SHIPPED' AND UPPER(TRIM(ship_mode))='AIR PP'`, inv) } catch { /* */ }
      if (!lines.length) { try { lines = await prisma.$queryRawUnsafe<any[]>(`SELECT so_no, sub_no, qty_pcs AS pcs FROM sq_report.export_row WHERE TRIM(invoice_no)=$1 AND UPPER(TRIM(ship_mode))='AIR PREPAID'`, inv); src = "export" } catch { /* */ } }
      if (!lines.length) { notFound.push(inv); continue }
      srcByInv[inv] = src
      for (const l of lines) {
        const k = `${soN(l.so_no)}|${subU(l.sub_no)}`
        qByKey.set(k, (qByKey.get(k) || 0) + (Number(l.pcs) || 0))
        if (!invByKey.has(k)) invByKey.set(k, inv)
      }
    }
    if (!qByKey.size) return NextResponse.json({ error: `ไม่พบ INV ${invs.join(", ")} ใน mp_line / export (AIR)` }, { status: 404 })
    const sos8 = [...new Set([...qByKey.keys()].map(k => k.split("|")[0]).filter(Boolean))].map((s: string) => s.padStart(8, "0"))
    const cand = await (prisma.airRequestItem as any).findMany({
      where: { so: { in: sos8 }, request: { bu: "NYG", isTest: false }, itemStatus: { not: "REJECTED" } },
      select: { id: true, so: true, sub: true, hawbNo: true },
    })
    const preview = !!body.preview
    const used = new Set<string>()
    // ถ้า SO+SUB มีหลายแถว → เติม "แถวที่ HAWB ว่าง" ก่อน (blank มาก่อน booked) เพื่อไม่ให้แถวว่างถูกข้าม
    cand.sort((a: any, b: any) => (String(a.hawbNo || "").trim() ? 1 : 0) - (String(b.hawbNo || "").trim() ? 1 : 0))
    const toAttach: { itemId: string; so: string; sub: string; qty: number; inv: string }[] = []
    for (const it of cand) {
      const k = `${soN(it.so)}|${subU(it.sub)}`
      if (!qByKey.has(k) || used.has(k)) continue
      if (it.hawbNo && String(it.hawbNo).trim() && it.hawbNo !== hawb) continue  // booked to another HAWB → leave it
      toAttach.push({ itemId: it.id, so: it.so, sub: it.sub, qty: qByKey.get(k) || 0, inv: invByKey.get(k) || (invs[0] as string) })
      used.add(k)
    }
    const foundInvs = Object.keys(srcByInv)
    if (preview) return NextResponse.json({ ok: true, preview: true, invs: foundInvs, notFound, hawb, srcByInv, foundSubs: qByKey.size, willAttach: toAttach })
    for (const t of toAttach) await prisma.airRequestItem.update({ where: { id: t.itemId }, data: { invoiceNo: t.inv, hawbNo: hawb, qtyActualShip: t.qty } as any })
    return NextResponse.json({ ok: true, added: toAttach.length, invs: foundInvs, notFound, hawb, srcByInv, foundSubs: qByKey.size })
  }

  // Split a HAWB total by the REAL shipped qty of its INVs (mp_line / export) instead of LG's typed qty.
  // Per SO+SUB on the HAWB: src qty = max(mp_line, export) over the HAWB's INVs; that qty is shared over
  // the SO+SUB's lines by LG's qty; money = total × line share (exact-sum: last line absorbs rounding).
  // Lines whose SO+SUB isn't in the sources keep LG's qty (flagged). Optional: write the real qty back
  // into qtyActualShip so later redistributes / the dashboard use it. POST { hawb, total, invs?, preview?, writeQty? }
  if (action === "redistribute_src") {
    const hawb = String(body.hawb || "").trim()
    const total = Number(body.total)
    if (!hawb || !(total > 0)) return NextResponse.json({ error: "hawb + total(>0) required" }, { status: 400 })
    const soN = (s: any) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "")
    const subU = (s: any) => String(s ?? "").trim().toUpperCase()
    const items = await (prisma.airRequestItem as any).findMany({
      where: { hawbNo: hawb },
      select: { id: true, so: true, sub: true, invoiceNo: true, qtyActualShip: true, qtyRequestAir: true, actualAirFreight: true, request: { select: { documentNo: true } } },
    }) as any[]
    if (!items.length) return NextResponse.json({ error: `ไม่พบ SO ใน HAWB ${hawb}` }, { status: 404 })
    const typed = String(body.invs || "").split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    const invs = [...new Set(typed.length ? typed : items.map(i => String(i.invoiceNo || "").trim().toUpperCase()).filter(Boolean))]
    const sos = [...new Set(items.map(i => soN(i.so)).filter(Boolean))]
    const mpQ = new Map<string, number>(), exQ = new Map<string, number>()
    if (invs.length && sos.length) {
      try {
        const r = await prisma.$queryRawUnsafe<any[]>(`SELECT so_no, sub_no, SUM(final_pcs)::float8 q FROM public.mp_line WHERE UPPER(TRIM(invoice_no)) = ANY($1::text[]) AND UPPER(TRIM(ship_mode))='AIR PP' AND ltrim(regexp_replace(so_no::text,'\\D','','g'),'0') = ANY($2::text[]) GROUP BY 1,2`, invs, sos)
        r.forEach(x => { const k = `${soN(x.so_no)}|${subU(x.sub_no)}`; mpQ.set(k, (mpQ.get(k) || 0) + (Number(x.q) || 0)) })
      } catch { /* mp_line unavailable */ }
      try {
        const r = await prisma.$queryRawUnsafe<any[]>(`SELECT so_no, sub_no, SUM(qty_pcs)::float8 q FROM sq_report.export_row WHERE UPPER(TRIM(invoice_no)) = ANY($1::text[]) AND UPPER(TRIM(ship_mode))='AIR PREPAID' AND ltrim(regexp_replace(so_no::text,'\\D','','g'),'0') = ANY($2::text[]) GROUP BY 1,2`, invs, sos)
        r.forEach(x => { const k = `${soN(x.so_no)}|${subU(x.sub_no)}`; exQ.set(k, (exQ.get(k) || 0) + (Number(x.q) || 0)) })
      } catch { /* export unavailable */ }
    }
    const lgQty = (it: any) => Math.max(Number(it.qtyActualShip ?? it.qtyRequestAir) || 0, 0)
    const groups = new Map<string, any[]>()
    for (const it of items) { const k = `${soN(it.so)}|${subU(it.sub)}`; const g = groups.get(k) || []; g.push(it); groups.set(k, g) }
    // effective (real) qty per line
    const eff = new Map<string, number>(), effInt = new Map<string, number>()
    const summary: any[] = []
    for (const [k, g] of groups) {
      const lg = g.reduce((a, it) => a + lgQty(it), 0)
      const src = Math.max(mpQ.get(k) || 0, exQ.get(k) || 0)
      const real = src > 0 ? src : lg
      const raw = g.map(it => lg > 0 ? real * lgQty(it) / lg : real / g.length)
      raw.forEach((v, i) => eff.set(g[i].id, v))
      // integer version (largest remainder) for the optional qty write-back
      const base = raw.map(Math.floor); let rest = Math.round(real) - base.reduce((a, b) => a + b, 0)
      raw.map((v, i) => ({ i, f: v - base[i] })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (rest > 0) { base[i]++; rest-- } })
      g.forEach((it, i) => effInt.set(it.id, base[i]))
      summary.push({ so: g[0].so, sub: g[0].sub || "", lines: g.length, lgQty: lg, srcQty: src || null, usedQty: real, found: src > 0,
        actualBefore: Math.round(g.reduce((a, it) => a + (Number(it.actualAirFreight) || 0), 0) * 100) / 100 })
    }
    const effTotal = [...eff.values()].reduce((a, b) => a + b, 0)
    if (!(effTotal > 0)) return NextResponse.json({ error: "qty รวมเป็น 0" }, { status: 400 })
    // money per line, exact sum (last line absorbs the cents)
    const money = new Map<string, number>(); let acc = 0
    items.forEach((it, i) => {
      const v = i === items.length - 1 ? Math.round((total - acc) * 100) / 100 : Math.round(total * (eff.get(it.id) || 0) / effTotal * 100) / 100
      money.set(it.id, v); acc += v
    })
    for (const s of summary) {
      const g = groups.get(`${soN(s.so)}|${subU(s.sub)}`) || []
      s.actualAfter = Math.round(g.reduce((a, it) => a + (money.get(it.id) || 0), 0) * 100) / 100
    }
    summary.sort((a, b) => (b.lgQty - b.usedQty) - (a.lgQty - a.usedQty))
    const out = { ok: true, hawb, total, invs, lgTotal: items.reduce((a, it) => a + lgQty(it), 0), realTotal: Math.round(effTotal), summary }
    if (body.preview) return NextResponse.json({ ...out, preview: true })
    const writeQty = !!body.writeQty
    for (const it of items) {
      await prisma.airRequestItem.update({ where: { id: it.id }, data: { actualAirFreight: money.get(it.id) || 0, ...(writeQty ? { qtyActualShip: effInt.get(it.id) || 0 } : {}) } as any }).catch(() => {})
    }
    return NextResponse.json({ ...out, saved: items.length, writeQty })
  }

  if (action === "redistribute") {
    const hawb = String(body.hawb || "").trim()
    const total = Number(body.total)
    if (!hawb || !(total > 0)) return NextResponse.json({ error: "hawb + total(>0) required" }, { status: 400 })
    await redistributeHawbCost(hawb, total)
    return NextResponse.json({ ok: true, hawb, total })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
