import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Read-only lookup against the Bill of Material tables in the ReportDB schema
// (<BU>_BILL_OF_MATERIALS_EXPORT_CHECK — refreshed by the daily job). Used by the
// Pull Material screen to pull SO → customer / PO / style / vendor / order qty.
// ReportDB keeps a SEPARATE table per BU (not one table filtered by a bu column).
const BOM_TABLE: Record<string, string> = {
  NYG: `"ReportDB"."NYG_BILL_OF_MATERIALS_EXPORT_CHECK"`,
  EA:  `"ReportDB"."NYV_BILL_OF_MATERIALS_EXPORT_CHECK"`, // EA (Pull RM) pulls from the NYV BOM
  GW:  `"ReportDB"."GW_BILL_OF_MATERIALS_EXPORT_CHECK"`,
  TRM: `"ReportDB"."TRM_BILL_OF_MATERIALS_EXPORT_CHECK"`,
  NYV: `"ReportDB"."NYV_BILL_OF_MATERIALS_EXPORT_CHECK"`,
}
const tableFor = (bu: string) => BOM_TABLE[bu?.toUpperCase()] || BOM_TABLE.NYG

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const bu = (sp.get("bu") || "NYG").trim()
  const q = (sp.get("q") || "").trim()
  const so = (sp.get("so") || "").trim()
  const limit = Math.min(Number(sp.get("limit")) || 50, 200)
  const SRC = tableFor(bu)

  // BOM tables differ per BU (some lack columns like insert_date / ou / mrd2). Read the table's
  // ACTUAL columns and select only those that exist (missing → NULL) so no BU errors out.
  const bare = SRC.match(/\."([^"]+)"\s*$/)?.[1] || ""
  let cols = new Set<string>()
  try {
    const cr = await prisma.$queryRawUnsafe<any[]>(`SELECT lower(column_name) AS c FROM information_schema.columns WHERE lower(table_name)=lower($1)`, bare)
    cols = new Set(cr.map(r => r.c))
  } catch { /* ignore — falls back to selecting nothing → empty */ }
  const has = (c: string) => cols.has(c.toLowerCase())
  const sel = (dbCol: string, alias: string) => (has(dbCol) ? `${dbCol} AS "${alias}"` : `NULL AS "${alias}"`)

  // Detail mode: all material lines (per item) for ONE SO — used after SCM picks an SO.
  // Each row = a material; SCM enters pull-garment per SO, material qty scales proportionally.
  if (so) {
    const fields = [
      sel("bu", "bu"), sel("so_year", "soYear"), sel("so_no_doc", "soNoDoc"), sel("cust_name", "customerName"),
      sel("group_code", "groupCode"), sel("ou", "ou"), sel("cpart_no", "cpartNo"), sel("part_desc", "partDesc"),
      sel("item_no", "itemNo"), sel("item_code", "itemCode"), sel("item_name", "itemName"), sel("orderqty", "orderQty"),
      sel("poqty_bomdummy", "poqtyBomdummy"), sel("po_no_doc", "poNoDoc"), sel("po_date", "poDate"), sel("upd_inhouse", "updInhouse"),
      sel("vend_name", "vendorName"), sel("status", "status"), sel("pousername", "poUsername"), sel("mrd_date", "mrdDate"),
      sel("mrd_need_date", "mrdNeedDate"), sel("mrd2", "mrd2"), sel("cust_po", "customerPo"), sel("style", "style"),
      sel("gmt_type", "gmtType"), sel("brand_name", "brand"), sel("shipment_date", "shipmentDate"), sel("bomqty", "bomQty"),
      sel("bom_uom", "bomUom"), sel("consumption", "consumption"),
    ].join(", ")
    const sql = `
      SELECT DISTINCT ON (item_code) ${fields}
      FROM ${SRC}
      WHERE so_no_doc = $1
      ORDER BY item_code
      LIMIT 500`
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(sql, so)
      return NextResponse.json({ rows })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "BOM detail failed", rows: [] }, { status: 500 })
    }
  }

  const po = (sp.get("po") || "").trim()
  const where: string[] = []
  const params: any[] = []
  if (q && has("so_no_doc")) {
    params.push(`%${q}%`)
    // Search by SO number.
    where.push(`so_no_doc ILIKE $${params.length}`)
  }
  if (po) {
    params.push(`%${po}%`)
    // Search by PO — match either the PO doc number or the customer PO (whichever columns exist).
    const parts = [has("po_no_doc") && `po_no_doc ILIKE $${params.length}`, has("cust_po") && `cust_po ILIKE $${params.length}`].filter(Boolean)
    if (parts.length) where.push(`(${parts.join(" OR ")})`)
  }
  const vend = (sp.get("vend") || "").trim()
  if (vend && has("vend_name")) {
    params.push(`%${vend}%`)
    // Search by supplier / vendor name.
    where.push(`vend_name ILIKE $${params.length}`)
  }
  // One row per SO (DISTINCT ON) — the SO-level fields for the search list. Material-line
  // detail (consumption per item) can be fetched per SO later when needed.
  const listFields = [
    sel("so_no_doc", "soNoDoc"), sel("cust_name", "customerName"), sel("cust_po", "customerPo"),
    sel("vend_name", "vendorName"), sel("po_no_doc", "poNoDoc"), sel("style", "style"),
    sel("gmt_type", "gmtType"), sel("brand_name", "brand"), sel("orderqty", "orderQty"), sel("shipment_date", "shipmentDate"),
  ].join(", ")
  const sql = `
    SELECT DISTINCT ON (so_no_doc) ${listFields}
    FROM ${SRC}
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY so_no_doc
    LIMIT ${limit}`

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params)
    return NextResponse.json({ rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "BOM query failed", rows: [] }, { status: 500 })
  }
}

// Which BUs have a BOM table + latest refresh time (for the selector + freshness banner).
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const ts = await prisma.$queryRawUnsafe<any[]>(`SELECT MAX(insert_date) AS "lastSync" FROM ${BOM_TABLE.NYG}`)
    return NextResponse.json({ bus: Object.keys(BOM_TABLE), lastSync: ts?.[0]?.lastSync ?? null })
  } catch {
    return NextResponse.json({ bus: ["NYG"], lastSync: null })
  }
}
