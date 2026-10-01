import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Web entry (admin test): look up SO → every SUB with its starting data.
// mp_line first (ANY status / ship mode — we want the base data), SO_ORDER as fallback.
// POST { sos: string[] } → { bySo: { [so8]: SubInfo[] } }

const so8 = (s: any) => { const d = String(s ?? "").replace(/\D/g, "").replace(/^0+/, ""); return d ? d.padStart(8, "0") : "" }
const subU = (s: any) => String(s ?? "").trim().toUpperCase()
// case-insensitive column pick (SELECT * → we don't depend on exact column casing)
const pick = (row: any, ...names: string[]) => {
  if (!row) return null
  const keys = Object.keys(row)
  for (const n of names) {
    const k = keys.find(k => k.toLowerCase() === n.toLowerCase())
    if (k && row[k] != null && String(row[k]).trim() !== "") return row[k]
  }
  return null
}
const str = (v: any) => (v == null ? "" : String(v).trim())
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isNaN(n) ? 0 : n }
// date / text date → "YYYY-MM-DD" ("" when unknown)
const ymd = (v: any): string => {
  if (v == null || v === "") return ""
  const p2 = (n: number) => String(n).padStart(2, "0")
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : `${v.getUTCFullYear()}-${p2(v.getUTCMonth() + 1)}-${p2(v.getUTCDate())}`
  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/)
  if (m) return `${m[1]}-${p2(+m[2])}-${p2(+m[3])}`
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/)
  if (m) return `${m[3]}-${p2(+m[2])}-${p2(+m[1])}`   // DD/MM/YYYY
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // admin-only while testing
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const sos = [...new Set((Array.isArray(body?.sos) ? body.sos : []).map(so8).filter(Boolean))] as string[]
  if (!sos.length) return NextResponse.json({ bySo: {} })

  let mpRows: any[] = [], soRows: any[] = []
  try {
    mpRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM public.mp_line WHERE lpad(ltrim(regexp_replace(so_no::text,'\\D','','g'),'0'),8,'0') = ANY($1::text[])`, sos)
  } catch { /* mp_line unavailable */ }
  try {
    soRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "ReportDB"."SO_ORDER_NYG_2020_present" WHERE lpad(ltrim(regexp_replace(so_no_doc::text,'\\D','','g'),'0'),8,'0') = ANY($1::text[])`, sos)
  } catch { /* SO_ORDER unavailable */ }

  // air requests that already have this SO (not rejected, not test)
  const existing = await (prisma.airRequestItem as any).findMany({
    where: { so: { in: sos }, itemStatus: { not: "REJECTED" }, request: { isTest: false } },
    select: { so: true, sub: true, qtyRequestAir: true, request: { select: { documentNo: true, status: true } } },
  }).catch(() => [])

  const bySo: Record<string, any[]> = {}
  for (const s of sos) {
    const mp = mpRows.filter(r => so8(pick(r, "so_no")) === s)
    const so = soRows.filter(r => so8(pick(r, "so_no_doc")) === s)
    const subs = [...new Set([...mp.map(r => subU(pick(r, "sub_no"))), ...so.map(r => subU(pick(r, "sub_no")))].filter(Boolean))].sort()
    bySo[s] = subs.map(sub => {
      const mpS = mp.filter(r => subU(pick(r, "sub_no")) === sub)
        .sort((a, b) => ymd(pick(a, "hod_date")).localeCompare(ymd(pick(b, "hod_date"))))
      const soS = so.filter(r => subU(pick(r, "sub_no")) === sub)
      const m0 = mpS[0], o0 = soS[0] || so[0]   // SO_ORDER: SO-level fallback for brand/BU/country
      const ex = (existing as any[]).filter(e => so8(e.so) === s && subU(e.sub) === sub)
      return {
        sub,
        src: mpS.length ? "mp_line" : "so_order",
        brand: str(pick(o0, "customername", "customer_name") ?? pick(m0, "brand")),
        bu: str(pick(o0, "bu", "bu_name", "business_unit")),
        country: str(pick(o0, "shipcountry", "ship_country")),
        style: str(pick(m0, "style") ?? pick(soS[0], "style", "style_no")),
        po: str(pick(m0, "po_no") ?? pick(soS[0], "po_no", "customer_po", "cust_po")),
        description: str(pick(m0, "description") ?? pick(soS[0], "producttype", "product_type")),
        origDate: ymd(pick(m0, "original_hod_date", "origi_hod_date", "orig_hod_date")),
        planDate: ymd(pick(m0, "hod_date") ?? pick(soS[0], "ship_date")),
        qtyAir: mpS.length ? mpS.reduce((t, r) => t + num(pick(r, "final_pcs")), 0) : null,
        soQty: soS.length ? soS.reduce((t, r) => t + num(pick(r, "qty")), 0) : null,
        mpRows: mpS.map(r => ({ inv: str(pick(r, "invoice_no")), status: str(pick(r, "status")), shipMode: str(pick(r, "ship_mode")), pcs: num(pick(r, "final_pcs")), hod: ymd(pick(r, "hod_date")) })),
        shipped: mpS.some(r => str(pick(r, "status")).toUpperCase() === "SHIPPED"),
        existing: ex.map(e => ({ docNo: e.request?.documentNo || "-", qtyAir: Number(e.qtyRequestAir) || 0, status: e.request?.status || "" })),
      }
    })
  }
  return NextResponse.json({ bySo })
}
