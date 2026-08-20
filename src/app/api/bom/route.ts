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
  GW: `"ReportDB"."GW_BILL_OF_MATERIALS_EXPORT_CHECK"`,
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

  // Detail mode: all material lines (per item) for ONE SO — used after SCM picks an SO.
  // Each row = a material; SCM enters pull-garment per SO, material qty scales proportionally.
  if (so) {
    const sql = `
      SELECT DISTINCT ON (item_code)
             bu             AS "bu",
             so_year        AS "soYear",
             so_no_doc      AS "soNoDoc",
             cust_name      AS "customerName",
             group_code     AS "groupCode",
             cpart_no       AS "cpartNo",
             part_desc      AS "partDesc",
             item_no        AS "itemNo",
             item_code      AS "itemCode",
             item_name      AS "itemName",
             orderqty       AS "orderQty",
             poqty_bomdummy AS "poqtyBomdummy",
             po_no_doc      AS "poNoDoc",
             po_date        AS "poDate",
             upd_inhouse    AS "updInhouse",
             vend_name      AS "vendorName",
             status         AS "status",
             pousername     AS "poUsername",
             mrd_date       AS "mrdDate",
             mrd_need_date  AS "mrdNeedDate",
             mrd2           AS "mrd2",
             cust_po        AS "customerPo",
             style,
             gmt_type       AS "gmtType",
             brand_name     AS "brand",
             shipment_date  AS "shipmentDate",
             bomqty         AS "bomQty",
             bom_uom        AS "bomUom",
             consumption    AS "consumption"
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

  const where: string[] = []
  const params: any[] = []
  if (q) {
    params.push(`%${q}%`)
    const i = params.length
    where.push(`(so_no_doc ILIKE $${i} OR cust_name ILIKE $${i} OR cust_po ILIKE $${i} OR style ILIKE $${i} OR brand_name ILIKE $${i})`)
  }
  // One row per SO (DISTINCT ON) — the SO-level fields for the search list. Material-line
  // detail (consumption per item) can be fetched per SO later when needed.
  const sql = `
    SELECT DISTINCT ON (so_no_doc)
           so_no_doc     AS "soNoDoc",
           cust_name     AS "customerName",
           cust_po       AS "customerPo",
           vend_name     AS "vendorName",
           po_no_doc     AS "poNoDoc",
           style,
           gmt_type      AS "gmtType",
           brand_name    AS "brand",
           orderqty      AS "orderQty",
           shipment_date AS "shipmentDate",
           insert_date   AS "updatedAt"
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
