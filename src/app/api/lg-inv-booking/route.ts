import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
  if (!roles.includes("ADMIN")) return NextResponse.json({ error: "Admin only", brands: [] }, { status: 403 })

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

  // 2) Air Request items (NYG) → per-SO readiness + per SO+SUB planned air qty + the bookable item id.
  const items = await (prisma as any).airRequestItem.findMany({
    where: { request: { bu: "NYG", isTest: false } },
    select: { id: true, so: true, sub: true, itemStatus: true, qtyRequestAir: true, airFreight: true },
  }).catch(() => [])
  const subN = (s: any) => String(s == null ? "" : s).trim().toUpperCase()
  // Air req items grouped as a LIST per SO+SUB (NOT summed) — needed to PAIR each mp_line line to a
  // specific air req item when a SO+SUB has several planned lines with different qty.
  type AirItem = { itemId: string; qty: number; est: number; ready: boolean }
  const airItemsBySoSub = new Map<string, AirItem[]>()
  for (const it of items) {
    const k = soN(it.so); if (!k) continue
    const pk = `${k}|${subN(it.sub)}`
    const arr = airItemsBySoSub.get(pk) || []
    arr.push({ itemId: it.id, qty: Number(it.qtyRequestAir) || 0, est: Number(it.airFreight) || 0, ready: READY.has(it.itemStatus) })
    airItemsBySoSub.set(pk, arr)
  }

  // 3) Build mp_line lines, then PAIR them to air req items per SO+SUB:
  //    exact qty match first → then closest qty → leftover mp_line lines = auto add.
  //    QTY always follows mp_line (revise); the pairing just decides WHICH air req item (→ claim dept).
  type Line = { so: string; sub: string; pcs: number; plan: number | null; est: number | null; qty: "exactly" | "revise" | "auto"; style: string; air: "ready" | "pending" | "auto"; itemId: string | null; inv: string; brand: string }
  const allLines: Line[] = mp.map((r: any) => ({
    so: so8(r.so_no), sub: String(r.sub_no ?? ""), pcs: Number(r.final_pcs) || 0, plan: null, est: null,
    qty: "auto", style: String(r.style ?? ""), air: "auto", itemId: null,
    inv: String(r.invoice_no ?? "").trim(), brand: String(r.brand ?? "").trim() || "(no brand)",
    _sok: soN(r.so_no), _sub: subN(r.sub_no),
  } as any)).filter((l: any) => l.inv)

  // group lines by SO+SUB and pair
  const byPk = new Map<string, any[]>()
  for (const l of allLines as any[]) { const pk = `${l._sok}|${l._sub}`; if (!byPk.has(pk)) byPk.set(pk, []); byPk.get(pk)!.push(l) }
  for (const [pk, lines] of byPk) {
    const pool = [...(airItemsBySoSub.get(pk) || [])] // available air req items
    // Pass 1 — exact qty
    for (const l of lines) { const i = pool.findIndex(a => a.qty === l.pcs); if (i >= 0) l._pair = pool.splice(i, 1)[0] }
    // Pass 2 — closest qty for the rest
    for (const l of lines) {
      if (l._pair || pool.length === 0) continue
      let bi = 0, bd = Infinity
      pool.forEach((a, i) => { const d = Math.abs(a.qty - l.pcs); if (d < bd) { bd = d; bi = i } })
      l._pair = pool.splice(bi, 1)[0]
    }
    for (const l of lines) {
      if (l._pair) {
        l.plan = l._pair.qty; l.est = l._pair.est; l.itemId = l._pair.ready ? l._pair.itemId : null
        l.air = l._pair.ready ? "ready" : "pending"
        l.qty = l.pcs === l._pair.qty ? "exactly" : "revise"
      } else { l.plan = null; l.est = null; l.itemId = null; l.air = "auto"; l.qty = "auto" }
    }
  }

  // place paired lines into invMap (brand + invoice)
  const invMap = new Map<string, { inv: string; brand: string; lines: Line[] }>()
  for (const l of allLines) {
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
