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

  // 2) Air Request items (NYG) → per-SO readiness (ready if ANY item reached LG).
  const items = await (prisma as any).airRequestItem.findMany({
    where: { request: { bu: "NYG", isTest: false } },
    select: { so: true, itemStatus: true },
  }).catch(() => [])
  const soAir = new Map<string, "ready" | "pending">()
  for (const it of items) {
    const k = soN(it.so); if (!k) continue
    const isReady = READY.has(it.itemStatus)
    const cur = soAir.get(k)
    if (isReady) soAir.set(k, "ready")           // ready wins
    else if (cur !== "ready") soAir.set(k, "pending")
  }

  // 3) Group mp_line by INVOICE → its SO+SUB lines (with air-req status), then by brand.
  type Line = { so: string; sub: string; pcs: number; style: string; air: "ready" | "pending" | "none" }
  const invMap = new Map<string, { inv: string; brand: string; lines: Line[] }>()
  for (const r of mp) {
    const inv = String(r.invoice_no ?? "").trim(); if (!inv) continue
    const brand = String(r.brand ?? "").trim() || "(no brand)"
    const key = `${brand}||${inv}`
    const g = invMap.get(key) || { inv, brand, lines: [] as Line[] }
    const k = soN(r.so_no)
    const air = k && soAir.has(k) ? soAir.get(k)! : "none"
    g.lines.push({ so: String(r.so_no ?? ""), sub: String(r.sub_no ?? ""), pcs: Number(r.final_pcs) || 0, style: String(r.style ?? ""), air })
    invMap.set(key, g)
  }

  // 4) Shape: brands → invs → lines. Sort brands by name, invs by inv no.
  const byBrand = new Map<string, any[]>()
  for (const g of invMap.values()) {
    const readyCnt = g.lines.filter(l => l.air === "ready").length
    const inv = { inv: g.inv, sos: g.lines, total: g.lines.length, ready: readyCnt, complete: readyCnt === g.lines.length }
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
