import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// ── QTY AIR MAP (NYG only · admin preview · READ-ONLY) ────────────────────────
// Reconcile Air Request (แผน) against public.mp_line (ออกจริง) by SO.
//   • mp_line filtered to status=SHIPPED AND ship_mode=AIR PP (actual air-prepaid exports)
//   • join key = SO (leading zeros / non-digits stripped) — INV/SUB are display units, not join keys
//   • QTY ยึด mp_line (final_pcs) = QTY AIR MAP
// This endpoint writes NOTHING and does not touch the existing LG/claim flow — it only shows admin
// what the mapping WOULD look like before we build the write path.
const soN = (s: any) => String(s == null ? "" : s).replace(/\D/g, "").replace(/^0+/, "")
const up = (s: any) => String(s == null ? "" : s).trim().toUpperCase()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // Admin-only preview (phase 1) — everyone else gets an empty, harmless payload.
  // Read-only mp_line reconcile — open to every signed-in user (dashboard map mode is now for everyone).

  // Optional brand filter (?brand=A,B) — normalized like the dashboard's brandKey (upper + single space).
  // mp_line stores SHORT brand names ("LULULEMON") while air req stores the FULL name
  // ("LULULEMON ATHLETICA CANADA INC."), so match tolerantly: equal OR one is a prefix of the other.
  const bk = (s: any) => String(s == null ? "" : s).trim().toUpperCase().replace(/\s+/g, " ")
  // Optional actual filter (?actual=HAS|NONE) — narrows the SUMMARY CARD totals to SOs that have
  // (HAS) / don't have (NONE) an actual air freight entered. tabA (the map SO set) is left whole
  // so the data table's own actual filter isn't applied twice.
  const actualParam = (req.nextUrl.searchParams.get("actual") || "").toUpperCase()
  const brandParam = req.nextUrl.searchParams.get("brand") || ""
  const brandSet = [...new Set(brandParam.split(",").map(bk).filter(Boolean))]
  const brandOk = (b: any) => {
    if (brandSet.length === 0) return true
    const x = bk(b); if (!x) return false
    return brandSet.some(f => x === f || x.startsWith(f) || f.startsWith(x))
  }

  // ── mp_line: actual AIR PP exports that have shipped ──
  let mp: any[] = []
  try {
    mp = await prisma.$queryRawUnsafe<any[]>(
      `SELECT so_no, sub_no, invoice_no, brand, style, final_pcs, etd, eta, forwarder, po_no, hod_date, original_hod_date
       FROM public.mp_line
       WHERE UPPER(TRIM(status)) = 'SHIPPED' AND UPPER(TRIM(ship_mode)) = 'AIR PP'`)
  } catch (e: any) {
    return NextResponse.json({ error: "อ่าน public.mp_line ไม่ได้: " + (e?.message || "error"), tabA: [], tabB: [], counts: {} }, { status: 500 })
  }
  // Group mp_line by SO → its INV lines (each INV = one shipment; qty = final_pcs).
  const mpBySo = new Map<string, { so: string; lines: any[]; pcs: number; brands: Set<string> }>()
  for (const r of mp) {
    const k = soN(r.so_no); if (!k) continue
    if (!brandOk(r.brand)) continue // brand filter (export side)
    const g = mpBySo.get(k) || { so: String(r.so_no ?? ""), lines: [], pcs: 0, brands: new Set<string>() }
    g.lines.push({ sub: r.sub_no ?? "", inv: r.invoice_no ?? "", pcs: Number(r.final_pcs) || 0, style: r.style ?? "", brand: r.brand ?? "", etd: r.etd, forwarder: r.forwarder ?? "", planDate: r.hod_date ?? null, origDate: r.original_hod_date ?? null, po: r.po_no ?? "" })
    g.pcs += Number(r.final_pcs) || 0
    if (r.brand) g.brands.add(String(r.brand))
    mpBySo.set(k, g)
  }

  // ── Actual shipped qty per SO+SUB, with SOURCE ──────────────────────────────
  // mp_line covers ~mid-Sept onward; older AIR shipments live in sq_report.export_row (AIR PREPAID).
  // Prefer mp_line for any SO+SUB it has; fall back to sq_report for the rest → no double-count.
  const subActual: Record<string, { qty: number; src: string }> = {}
  for (const [k, m] of mpBySo) {
    for (const ln of m.lines) {
      const sk = `${k}|${up(ln.sub)}`
      if (!subActual[sk]) subActual[sk] = { qty: 0, src: "mp_line" }
      subActual[sk].qty += Number(ln.pcs) || 0
    }
  }
  try {
    const sq = await prisma.$queryRawUnsafe<any[]>(
      `SELECT so_no, sub_no, qty_pcs FROM sq_report.export_row WHERE UPPER(TRIM(ship_mode)) = 'AIR PREPAID'`)
    for (const r of sq) {
      const k = soN(r.so_no); if (!k) continue
      const sk = `${k}|${up(r.sub_no)}`
      if (subActual[sk]?.src === "mp_line") continue      // mp_line wins for overlapping subs
      if (!subActual[sk]) subActual[sk] = { qty: 0, src: "export" }
      subActual[sk].qty += Number(r.qty_pcs) || 0
    }
  } catch { /* sq_report.export_row unavailable → mp_line only */ }

  // ── Air Request items (NYG, non-test) ──
  const items = await (prisma as any).airRequestItem.findMany({
    where: { request: { bu: "NYG", isTest: false } },
    select: { so: true, sub: true, brand: true, invoiceNo: true, qtyRequestAir: true, airFreight: true, actualAirFreight: true,
      request: { select: { documentNo: true, status: true } } },
  }).catch(() => [])
  const airBySo = new Map<string, { so: string; qtyPlan: number; est: number; actual: number; brands: Set<string>; docs: Set<string>; invs: Set<string>; subs: Set<string> }>()
  for (const i of items) {
    const k = soN(i.so); if (!k) continue
    if (!brandOk(i.brand)) continue // brand filter (air req side)
    const g = airBySo.get(k) || { so: i.so, qtyPlan: 0, est: 0, actual: 0, brands: new Set<string>(), docs: new Set<string>(), invs: new Set<string>(), subs: new Set<string>() }
    g.qtyPlan += Number(i.qtyRequestAir) || 0
    g.est += Number(i.airFreight) || 0
    g.actual += Number(i.actualAirFreight) || 0
    if (i.brand) g.brands.add(String(i.brand))
    if (i.invoiceNo) g.invs.add(String(i.invoiceNo))
    if (i.sub) g.subs.add(String(i.sub))
    if (i.request?.documentNo) g.docs.add(i.request.documentNo)
    airBySo.set(k, g)
  }
  // Distinct SUBs from mp_line lines for a SO group.
  const mpSubs = (m: any) => [...new Set((m.lines || []).map((l: any) => String(l.sub ?? "").trim()).filter(Boolean))]

  // Tab A = SO ที่มีประวัติส่งออก (อยู่ใน mp_line): matched (exactly/revise) หรือ auto prepaid (mp_line only)
  const tabA: any[] = []
  let exactly = 0, revise = 0, prepaid = 0
  // QTY (pcs) totals — the ACTUAL exported qty from mp_line, split by match status.
  let exactlyPcs = 0, revisePcs = 0, prepaidPcs = 0, shippedPcs = 0
  // Freight totals (THB) for the matched (exported ∩ air req) SOs — EST (planned) + Actual (LG-entered).
  let matchedEst = 0, matchedActual = 0
  let filledEst = 0 // EST of ONLY the SOs that already have actual filled (fair vs actual comparison)
  let actualFilledSo = 0, actualWaitingSo = 0 // matched SOs: LG has entered actual vs still waiting
  let countedSo = 0 // SOs actually included in the card totals (after the actual filter)
  for (const [k, m] of mpBySo) {
    const a = airBySo.get(k)
    const qtyAirMap = m.pcs
    // Actual filter gates only the CARD totals (not tabA): HAS = SO has actual, NONE = SO has none.
    const hasActual = !!(a && a.actual > 0)
    const countThis = actualParam === "HAS" ? hasActual : actualParam === "NONE" ? !hasActual : true
    if (countThis) { shippedPcs += qtyAirMap; countedSo++ }
    if (a) {
      if (countThis) {
        matchedEst += a.est; matchedActual += a.actual
        if (a.actual > 0) { actualFilledSo++; filledEst += a.est } else actualWaitingSo++
        const status = a.qtyPlan === qtyAirMap ? "exactly" : "revise"
        if (status === "exactly") { exactly++; exactlyPcs += qtyAirMap } else { revise++; revisePcs += qtyAirMap }
      }
      const status = a.qtyPlan === qtyAirMap ? "exactly" : "revise"
      tabA.push({ status, so: m.so, brand: [...(a.brands.size ? a.brands : m.brands)].slice(0, 2), qtyPlan: a.qtyPlan, qtyAirMap, lines: m.lines, docs: [...a.docs].slice(0, 3), airInv: [...a.invs].slice(0, 3), subs: [...(a.subs.size ? a.subs : new Set(mpSubs(m)))] })
    } else {
      if (countThis) { prepaid++; prepaidPcs += qtyAirMap }
      tabA.push({ status: "auto_air_prepaid_mapping", so: m.so, brand: [...m.brands].slice(0, 2), qtyPlan: null, qtyAirMap, lines: m.lines, docs: [], airInv: [], subs: mpSubs(m) })
    }
  }
  tabA.sort((a, b) => (a.status > b.status ? 1 : a.status < b.status ? -1 : 0))

  // Tab B = air req มี แต่ยังไม่มีใน mp_line (ยังไม่มีประวัติการส่งออก)
  const tabB: any[] = []
  for (const [k, a] of airBySo) {
    if (!mpBySo.has(k)) tabB.push({ status: "no_ship_record", so: a.so, brand: [...a.brands].slice(0, 2), qtyPlan: a.qtyPlan, docs: [...a.docs].slice(0, 3), airInv: [...a.invs].slice(0, 3), subs: [...a.subs] })
  }

  return NextResponse.json({
    tabA, tabB, subActual,
    counts: {
      tabA: tabA.length, tabB: tabB.length, exactly, revise, prepaid, noship: tabB.length, mpKeys: mpBySo.size, countedSo, airKeys: airBySo.size,
      // pcs totals — actual exported qty from mp_line
      shippedPcs, exactlyPcs, revisePcs, prepaidPcs, matchedPcs: exactlyPcs + revisePcs, matchedSo: exactly + revise,
      // freight totals (THB) for matched SOs
      matchedEst: Math.round(matchedEst), matchedActual: Math.round(matchedActual), filledEst: Math.round(filledEst),
      actualFilledSo, actualWaitingSo,
    },
  })
}
