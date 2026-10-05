import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDocumentNo } from "@/lib/docno"
import { notifyStatusChange } from "@/lib/notify"
import { canonCountry } from "@/lib/freight"
import { randomUUID } from "crypto"

export const runtime = "nodejs"

// ── LG BOOKING BY INV (NYG only · admin preview · READ-ONLY) ──────────────────
// Start from the INVOICE (mp_line) instead of the SO:
//   • mp_line filtered to status=SHIPPED AND ship_mode=AIR PP (actual air-prepaid exports)
//   • group by brand → invoice_no → the SO+SUB lines that shipped on that invoice
//   • cross-check each SO against the Air Request: is it at the LG stage yet?
//       ready   = air req item reached LG (bookable: LOG/CLAIM/PRES_PASSED / PRESIDENT_PENDING / COMPLETED)
//       pending = in air req but not yet at LG (still in approval)
//       none    = not in any air req (auto air prepaid → must go via SCM first)
// Writes NOTHING — admin trial before we build the write path.
const soN = (s: any) => String(s == null ? "" : s).replace(/\D/g, "").replace(/^0+/, "")
// Display form: pad an all-digit SO to the canonical 8 digits (Excel/mp_line may drop the leading 0).
const so8 = (s: any) => { const raw = String(s == null ? "" : s).trim(); return /^\d+$/.test(raw) ? raw.padStart(8, "0") : raw }
const READY = new Set(["LOG_PASSED", "CLAIM_PASSED", "PRES_PASSED", "PRESIDENT_PENDING", "COMPLETED"])

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles: string[] = [(session.user as any)?.role, ...(((session.user as any)?.roles) || [])].filter(Boolean)
  // NYG LG booking (mp_line data is NYG) — open to NYG Logistics + admin.
  const canUse = roles.includes("ADMIN") || roles.includes("LOGISTICS") || roles.includes("LOGISTICS_SUB")
  if (!canUse) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะ Logistics NYG / admin)", brands: [] }, { status: 403 })

  // 1) mp_line: shipped AIR PP lines
  let mp: any[] = []
  try {
    mp = await prisma.$queryRawUnsafe<any[]>(
      `SELECT so_no, sub_no, invoice_no, brand, style, final_pcs, etd
       FROM public.mp_line
       WHERE UPPER(TRIM(status)) = 'SHIPPED' AND UPPER(TRIM(ship_mode)) = 'AIR PP'`)
  } catch (e: any) {
    return NextResponse.json({ error: "อ่าน public.mp_line ไม่ได้: " + (e?.message || "error"), brands: [] }, { status: 500 })
  }

  // 1b) sq_report.export_row: older AIR PREPAID exports (before mp_line coverage ~mid-Sept). Union into
  //     the same list, shaped like mp_line. Overlap is judged per SO+SUB+INV (one INV = one shipment round):
  //     an INV mp_line already has is skipped (no double), but ANOTHER INV of the same SO+SUB is kept —
  //     skipping by SO+SUB alone hid real rounds (e.g. INV G26166806497 when mp_line had another 3A21 INV).
  try {
    const _up = (s: any) => String(s ?? "").trim().toUpperCase()
    const mpKeys = new Set(mp.map((r: any) => `${soN(r.so_no)}|${_up(r.sub_no)}|${_up(r.invoice_no)}`))
    const sq = await prisma.$queryRawUnsafe<any[]>(
      `SELECT so_no, sub_no, invoice_no, customer_brand AS brand, style, qty_pcs AS final_pcs, ex_fty_date AS etd
       FROM sq_report.export_row WHERE UPPER(TRIM(ship_mode)) = 'AIR PREPAID'`)
    for (const r of sq) {
      if (mpKeys.has(`${soN(r.so_no)}|${_up(r.sub_no)}|${_up(r.invoice_no)}`)) continue   // same INV already from mp_line
      mp.push(r)
    }
  } catch { /* sq_report.export_row unavailable → mp_line only */ }

  // 2) Air Request items (NYG) → per-SO readiness + per SO+SUB planned air qty + the bookable item id.
  const items = await (prisma as any).airRequestItem.findMany({
    where: { request: { bu: "NYG", isTest: false } },
    select: { id: true, requestId: true, so: true, sub: true, itemStatus: true, qtyRequestAir: true, airFreight: true, hawbNo: true, invoiceNo: true },
  }).catch(() => [])
  const subN = (s: any) => String(s == null ? "" : s).trim().toUpperCase()
  const invN = (s: any) => String(s == null ? "" : s).trim().toUpperCase()
  // Air req items grouped as a LIST per SO+SUB (NOT summed) — needed to PAIR each mp_line line to a
  // specific air req item when a SO+SUB has several planned lines with different qty.
  type AirItem = { itemId: string; reqId: string; qty: number; est: number; ready: boolean; booked: boolean; inv: string }
  const airItemsBySoSub = new Map<string, AirItem[]>()
  for (const it of items) {
    const k = soN(it.so); if (!k) continue
    const pk = `${k}|${subN(it.sub)}`
    const arr = airItemsBySoSub.get(pk) || []
    // booked = LG already keyed a HAWB on this item → the SO is done, drop it from the pick list.
    arr.push({ itemId: it.id, reqId: it.requestId, qty: Number(it.qtyRequestAir) || 0, est: Number(it.airFreight) || 0, ready: READY.has(it.itemStatus), booked: !!(it.hawbNo && String(it.hawbNo).trim()), inv: invN(it.invoiceNo) })
    airItemsBySoSub.set(pk, arr)
  }

  // 3) Build mp_line lines, then PAIR them to air req items per SO+SUB:
  //    exact qty match first → then closest qty → leftover mp_line lines = auto add.
  //    QTY always follows mp_line (revise); the pairing just decides WHICH air req item (→ claim dept).
  type Line = { so: string; sub: string; pcs: number; plan: number | null; est: number | null; qty: "exactly" | "revise" | "auto"; style: string; air: "ready" | "pending" | "auto"; itemId: string | null; reqId: string | null; inv: string; brand: string }
  const allLines: Line[] = mp.map((r: any) => ({
    so: so8(r.so_no), sub: String(r.sub_no ?? ""), pcs: Number(r.final_pcs) || 0, plan: null, est: null,
    qty: "auto", style: String(r.style ?? ""), air: "auto", itemId: null, reqId: null,
    inv: String(r.invoice_no ?? "").trim(), brand: String(r.brand ?? "").trim() || "(no brand)",
    _sok: soN(r.so_no), _sub: subN(r.sub_no),
  } as any)).filter((l: any) => l.inv)

  // group lines by SO+SUB and pair
  const byPk = new Map<string, any[]>()
  for (const l of allLines as any[]) { const pk = `${l._sok}|${l._sub}`; if (!byPk.has(pk)) byPk.set(pk, []); byPk.get(pk)!.push(l) }
  for (const [pk, lines] of byPk) {
    const all = airItemsBySoSub.get(pk) || []
    // Pass 0 — this INV is ALREADY booked on an item of this SO+SUB (same invoice) → that line is done.
    // Must run before qty pairing, else a duplicate unbooked item (same SO+SUB in another doc) steals
    // the line and the booked INV reappears as "ยังไม่ถึงคิว".
    const used = new Set<string>()
    for (const l of lines) {
      const b = all.find(a => a.booked && a.inv && a.inv === invN(l.inv) && !used.has(a.itemId))
      if (b) { used.add(b.itemId); l._pair = b }
    }
    // Remaining pool: unbooked items + legacy booked items with no invoice recorded. An item booked
    // under ANOTHER invoice belongs to that INV's line, never to this one.
    const pool = all.filter(a => !used.has(a.itemId) && !(a.booked && a.inv))
    // Pass 1 — exact qty
    for (const l of lines) { if (l._pair) continue; const i = pool.findIndex(a => a.qty === l.pcs); if (i >= 0) l._pair = pool.splice(i, 1)[0] }
    // Pass 2 — closest qty for the rest
    for (const l of lines) {
      if (l._pair || pool.length === 0) continue
      let bi = 0, bd = Infinity
      pool.forEach((a, i) => { const d = Math.abs(a.qty - l.pcs); if (d < bd) { bd = d; bi = i } })
      l._pair = pool.splice(bi, 1)[0]
    }
    for (const l of lines) {
      if (l._pair) {
        l.plan = l._pair.qty; l.est = l._pair.est
        // Both ready and pending carry the itemId/reqId now — pending SOs shipped already, so LG may
        // enter their data EARLY (saved as draft) while approval keeps running normally in parallel.
        l.itemId = l._pair.itemId
        l.reqId = l._pair.reqId
        l.air = l._pair.ready ? "ready" : "pending"
        l.qty = l.pcs === l._pair.qty ? "exactly" : "revise"
        l._done = l._pair.booked   // already has a HAWB → hide it from the pick list
      } else { l.plan = null; l.est = null; l.itemId = null; l.reqId = null; l.air = "auto"; l.qty = "auto" }
    }
  }

  // place paired lines into invMap (brand + invoice) — SKIP lines already booked (have a HAWB), so a
  // booked SO drops out and an INV whose SOs are all booked disappears from the page entirely.
  const invMap = new Map<string, { inv: string; brand: string; lines: Line[] }>()
  for (const l of allLines) {
    if ((l as any)._done) continue
    const key = `${l.brand}||${l.inv}`
    const g = invMap.get(key) || { inv: l.inv, brand: l.brand, lines: [] as Line[] }
    g.lines.push(l)
    invMap.set(key, g)
  }

  // 4) Shape: brands → invs → lines. Sort brands by name, invs by inv no.
  const byBrand = new Map<string, any[]>()
  for (const g of invMap.values()) {
    // "bookable" = LG can act now (ready OR auto). "complete" = no line still waiting (pending).
    const bookable = g.lines.filter(l => l.air === "ready" || l.air === "auto").length
    const inv = { inv: g.inv, sos: g.lines, total: g.lines.length, ready: bookable, complete: g.lines.every(l => l.air !== "pending") }
    if (!byBrand.has(g.brand)) byBrand.set(g.brand, [])
    byBrand.get(g.brand)!.push(inv)
  }
  const brands = [...byBrand.entries()]
    .map(([brand, invs]) => ({
      brand,
      invCount: invs.length,
      readySo: invs.reduce((a, iv) => a + iv.ready, 0),
      invs: invs.sort((a, b) => a.inv.localeCompare(b.inv)),
    }))
    .sort((a, b) => a.brand.localeCompare(b.brand))

  return NextResponse.json({ brands, counts: { brands: brands.length, invs: invMap.size } })
}

// ── POST: AUTO-ADD (NYG prepaid) ──────────────────────────────────────────────
// SOs that shipped (mp_line AIR PP) but were NEVER in an air request. LG has the actual air (their
// share of the HAWB expense). We create ONE prepaid NYG document per booking (1 brand · 1 HAWB) that
// enters the SCM claim-selection stage directly (status PENDING_SCM, itemStatus PENDING, actual filled,
// logisticsSent=true — skips MER/DVM/VP-MER/President/LG-entry). Flow onward: SCM_USER (Kimita) selects
// claim dept(s) + assigns VP SCM → VP_SCM (Saji) approves → PENDING_CLAIM → claim depts approve.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles: string[] = [(session.user as any)?.role, ...(((session.user as any)?.roles) || [])].filter(Boolean)
  const canUse = roles.includes("ADMIN") || roles.includes("LOGISTICS") || roles.includes("LOGISTICS_SUB")
  if (!canUse) return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะ Logistics NYG / admin)" }, { status: 403 })
  const userId = (session.user as any)?.id
  if (!userId) return NextResponse.json({ error: "No user id in session" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const brand = String(body?.brand || "").trim()
  const hawbNo = String(body?.hawbNo || "").trim()
  const bookingDate = body?.bookingDate ? new Date(body.bookingDate) : null
  const lines: any[] = Array.isArray(body?.lines) ? body.lines : []
  if (!hawbNo) return NextResponse.json({ error: "ต้องมี HAWB" }, { status: 400 })
  if (lines.length === 0) return NextResponse.json({ error: "ไม่มี auto line" }, { status: 400 })

  // Look up EST inputs from ReportDB.SO_ORDER_NYG_2020_present (keyed by so_no_doc→8 digits + sub_no,
  // which is unique there): producttype → DESCRIPTION (→ weight from MasterDescription) and shipcountry
  // → country (→ rate from MasterFreightRate). One join gives both → EST computes on recompute.
  const nrm = (s: any) => String(s == null ? "" : s).trim().toUpperCase()
  const so8k = (s: any) => { const d = String(s == null ? "" : s).replace(/\D/g, ""); return d ? d.padStart(8, "0") : "" }
  const infoByKey = new Map<string, { producttype: string; country: string }>()
  const infoBySo = new Map<string, { producttype: string; country: string }>()
  const so8keys = [...new Set(lines.map((l: any) => so8k(l.so)).filter(Boolean))]
  if (so8keys.length) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT lpad(regexp_replace(COALESCE(so_no_doc,''),'\\D','','g'),8,'0') AS so8, UPPER(TRIM(COALESCE(sub_no,''))) AS sub, producttype, shipcountry
         FROM "ReportDB"."SO_ORDER_NYG_2020_present"
         WHERE lpad(regexp_replace(COALESCE(so_no_doc,''),'\\D','','g'),8,'0') = ANY($1::text[])`, so8keys)
      for (const r of rows) {
        const info = { producttype: String(r.producttype || ""), country: String(r.shipcountry || "") }
        const kk = `${r.so8}|${r.sub || ""}`
        if (!infoByKey.has(kk)) infoByKey.set(kk, info)
        if (!infoBySo.has(String(r.so8))) infoBySo.set(String(r.so8), info)  // SO-only fallback (country is per SO)
      }
    } catch { /* ReportDB unavailable → description/country blank, EST 0 */ }
  }
  const infoOf = (l: any) => infoByKey.get(`${so8k(l.so)}|${nrm(l.sub)}`) || infoBySo.get(so8k(l.so)) || { producttype: "", country: "" }

  // EST for auto-add = mp_line ACTUAL weight/pc × freight rate (MasterDescription has no producttype
  // names, so recompute would give 0). weight/pc = final_gw ÷ final_pcs (fallback plan_gw ÷ plan_pcs).
  const soN2 = (s: any) => String(s == null ? "" : s).replace(/\D/g, "").replace(/^0+/, "")
  const wtBySo = new Map<string, number>()
  const soDigitKeys = [...new Set(lines.map((l: any) => soN2(l.so)).filter(Boolean))]
  if (soDigitKeys.length) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') AS so, sum(COALESCE(final_gw,0)) gw, sum(COALESCE(final_pcs,0)) pcs, sum(COALESCE(plan_gw,0)) pgw, sum(COALESCE(plan_pcs,0)) ppcs FROM public.mp_line WHERE ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') = ANY($1::text[]) GROUP BY 1`, soDigitKeys)
      for (const r of rows) {
        const gw = Number(r.gw) || 0, pcs = Number(r.pcs) || 0, pgw = Number(r.pgw) || 0, ppcs = Number(r.ppcs) || 0
        const perPc = (pcs > 0 && gw > 0) ? gw / pcs : (ppcs > 0 && pgw > 0) ? pgw / ppcs : 0
        if (perPc > 0) wtBySo.set(String(r.so), perPc)
      }
    } catch { /* mp_line weight unavailable → gross/EST 0 */ }
  }
  const rates: Record<string, number> = {}
  try {
    const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
    for (const r of rateList) rates[canonCountry(r.country)] = r.ratePerKg
  } catch { /* no rates → EST 0 */ }
  // ORIG DATE = mp_line.original_hod_date · PLAN DATE = mp_line.hod_date (by SO+SUB).
  const dateBy = new Map<string, { orig: Date | null; plan: Date | null }>()
  if (soDigitKeys.length) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') AS so, UPPER(TRIM(COALESCE(sub_no,''))) AS sub, max(original_hod_date) AS orig, max(hod_date) AS plan FROM public.mp_line WHERE ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') = ANY($1::text[]) GROUP BY 1,2`, soDigitKeys)
      for (const r of rows) { const k = `${r.so}|${r.sub || ""}`; if (!dateBy.has(k)) dateBy.set(k, { orig: r.orig ? new Date(r.orig) : null, plan: r.plan ? new Date(r.plan) : null }) }
    } catch { /* dates unavailable */ }
  }
  const datesOf = (l: any) => dateBy.get(`${soN2(l.so)}|${nrm(l.sub)}`) || { orig: null, plan: null }
  const estOf = (l: any) => {
    const pcs = Math.round(Number(l.pcs) || 0)
    const wt = wtBySo.get(soN2(l.so)) || 0
    const rate = rates[canonCountry(infoOf(l).country)] || 0
    const gross = Math.round(pcs * wt * 1000) / 1000
    return { gross, est: Math.round(gross * rate * 100) / 100, rate }
  }

  const itemData = lines.map((l: any) => {
    const pcs = Math.round(Number(l.pcs) || 0)
    const e = estOf(l)
    return {
      style: String(l.style || ""),
      so: String(l.so || ""),                    // already 8-digit from GET (so8)
      brand: brand || null,
      sub: l.sub ? String(l.sub) : null,
      customerPO: "",
      description: infoOf(l).producttype || "",   // producttype from SO_ORDER → drives weight/EST
      originalShipmentDate: datesOf(l).orig,       // mp_line.original_hod_date
      planShipmentDate: datesOf(l).plan,           // mp_line.hod_date
      qtyOriginalShipment: pcs,
      qtyRequestAir: pcs,                         // QTY follows mp_line
      reasonDelay: "Auto-add (shipped, prepaid — no air request)",
      factory: "",
      country: infoOf(l).country || "",   // shipcountry from SO_ORDER → drives the freight rate (EST)
      port: "",
      grossWeight: e.gross,                      // mp_line actual weight (qty × final_gw/final_pcs)
      airFreight: e.est,                         // EST = gross × freight rate (shipcountry)
      marketRatePerKg: e.rate || null,
      invoiceNo: l.inv ? String(l.inv) : null,
      hawbNo,
      bookingDate,
      actualAirFreight: Math.round((Number(l.actual) || 0) * 100) / 100, // LG's share of the HAWB expense
      claimDepartment: null,                     // SCM (Kimita) selects
      claimDepts: undefined,                     // leave unassigned so the SCM step is meaningful
      claimPercentage: null,
      itemStatus: "PENDING",                     // → SCM claim-selection entry
    }
  })

  const documentNo = await generateDocumentNo("NYG")
  const request = await prisma.airRequest.create({
    data: {
      documentNo,
      brandName: brand || "(no brand)",
      buName: "NYG",
      bu: "NYG",
      status: "PENDING_SCM",
      logisticsSent: true,                       // LG actual already in → a completed claim can reach President
      createdById: userId,
      scmToken: randomUUID(),                    // magic-link SCM_USER (Kimita)
      vpScmToken: randomUUID(),                  // magic-link VP_SCM (Saji)
      presidentToken: randomUUID(),
      logisticsToken: randomUUID(),
      accountingToken: randomUUID(),
      items: { create: itemData as any },
    } as any,
    include: { items: true },
  })

  // gross/EST already set from mp_line weight × rate above (do NOT recompute — MasterDescription has no
  // producttype names, so recompute would zero them).
  await notifyStatusChange(request.id, "PENDING_SCM").catch(() => {}) // alert SCM_USER (Kimita) to select claim

  return NextResponse.json({ id: request.id, documentNo: request.documentNo, items: request.items.length })
}
