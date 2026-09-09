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

  // Shared material-line column list (used by SO-detail and PO-detail modes).
  const matFields = [
    sel("bu", "bu"), sel("so_year", "soYear"), sel("so_no_doc", "soNoDoc"), sel("cust_name", "customerName"),
    sel("group_code", "groupCode"), sel("ou", "ou"), sel("cpart_no", "cpartNo"), sel("part_desc", "partDesc"),
    sel("item_no", "itemNo"), sel("item_code", "itemCode"), sel("item_name", "itemName"), sel("orderqty", "orderQty"),
    sel("poqty_bomdummy", "poqtyBomdummy"), sel("po_no_doc", "poNoDoc"), sel("po_date", "poDate"), sel("upd_inhouse", "updInhouse"),
    sel("vend_name", "vendorName"), sel("status", "status"), sel("pousername", "poUsername"), sel("mrd_date", "mrdDate"),
    sel("mrd_need_date", "mrdNeedDate"), sel("mrd2", "mrd2"), sel("cust_po", "customerPo"), sel("style", "style"),
    sel("gmt_type", "gmtType"), sel("brand_name", "brand"), sel("shipment_date", "shipmentDate"), sel("bomqty", "bomQty"),
    sel("bom_uom", "bomUom"), sel("consumption", "consumption"),
  ].join(", ")

  // Vendors mode: distinct vendor names in this BU — the reference list for the PC Excel export.
  if (sp.get("vendors")) {
    if (!has("vend_name")) return NextResponse.json({ vendors: [] })
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT vend_name AS v FROM ${SRC} WHERE vend_name IS NOT NULL AND vend_name <> '' ORDER BY vend_name`)
      return NextResponse.json({ vendors: rows.map(r => r.v) })
    } catch (e: any) { return NextResponse.json({ error: e?.message || "vendors failed", vendors: [] }, { status: 500 }) }
  }

  // Vendor address mode: look up dc_vendor by vendor_name (CONTAIN match) and concat its address
  // (address_line1..4 + city + county + country) → prefill the Pickup/Vendor address on the PC form.
  const vendorAddr = (sp.get("vendorAddr") || "").trim()
  if (vendorAddr) {
    try {
      const loc = await prisma.$queryRawUnsafe<any[]>(`SELECT table_schema AS s FROM information_schema.tables WHERE lower(table_name)='dc_vendor' LIMIT 1`)
      if (!loc.length) return NextResponse.json({ address: "", matched: null })
      const sc = loc[0].s
      const cc = await prisma.$queryRawUnsafe<any[]>(`SELECT lower(column_name) AS c FROM information_schema.columns WHERE table_schema=$1 AND lower(table_name)='dc_vendor'`, sc)
      const set = new Set(cc.map(r => r.c))
      if (!set.has("vendor_name")) return NextResponse.json({ address: "", matched: null })
      const parts = ["address_line1", "address_line2", "address_line3", "address_line4", "city", "county", "country"].filter(c => set.has(c))
      // Auto-detect contact columns (names vary by ERP export) for email / contact name / tel.
      const colList = [...set] as string[]
      const emailCol = colList.find(c => /e_?mail/.test(c))
      const nameCol = colList.find(c => /contact.*name|contact_person|attn|^contact$/.test(c))
      const telCol = colList.find(c => /(^|_)(tel|phone|mobile|telephone)/.test(c))
      const extra = [emailCol, nameCol, telCol].filter(Boolean) as string[]
      const selCols = [...parts, ...extra].map(c => `"${c}"`).join(", ")
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT vendor_name${selCols ? ", " + selCols : ""} FROM "${sc}"."dc_vendor" WHERE vendor_name ILIKE $1 ORDER BY length(vendor_name) ASC LIMIT 1`,
        `%${vendorAddr}%`)
      if (!rows.length) return NextResponse.json({ address: "", matched: null })
      const r = rows[0]
      const clean = (v: any) => (v == null ? "" : String(v).trim().replace(/[,\s]+$/, ""))
      // Vendor name first, then the address lines.
      const address = [clean(r.vendor_name), ...parts.map(c => clean(r[c]))].filter(Boolean).join(", ")
      return NextResponse.json({
        address, matched: r.vendor_name,
        email: emailCol ? clean(r[emailCol]) : "",
        contactName: nameCol ? clean(r[nameCol]) : "",
        tel: telCol ? clean(r[telCol]) : "",
      })
    } catch (e: any) { return NextResponse.json({ address: "", error: e?.message || "vendorAddr failed" }) }
  }

  // UOMs mode: distinct bom_uom values in this BU — the PC by-PO "UOM" dropdown list.
  if (sp.get("uoms")) {
    if (!has("bom_uom")) return NextResponse.json({ uoms: [] })
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT bom_uom AS u FROM ${SRC} WHERE bom_uom IS NOT NULL AND bom_uom <> '' ORDER BY bom_uom`)
      return NextResponse.json({ uoms: rows.map(r => r.u) })
    } catch (e: any) { return NextResponse.json({ error: e?.message || "uoms failed", uoms: [] }, { status: 500 }) }
  }

  // Vendor-POs mode: distinct POs (+ a little context) for one vendor — the PC "select some POs" list.
  const vendorPos = (sp.get("vendorPos") || "").trim()
  if (vendorPos) {
    if (!has("vend_name") || !has("po_no_doc")) return NextResponse.json({ pos: [] })
    const ctx = [sel("brand_name", "brand"), sel("style", "style"), sel("cust_name", "customerName"), sel("shipment_date", "shipmentDate"), sel("po_date", "poDate")].join(", ")
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT DISTINCT ON (po_no_doc) po_no_doc AS "po", ${ctx} FROM ${SRC} WHERE vend_name = $1 AND po_no_doc IS NOT NULL AND po_no_doc <> '' ORDER BY po_no_doc DESC LIMIT 500`, vendorPos)
      return NextResponse.json({ pos: rows })
    } catch (e: any) { return NextResponse.json({ error: e?.message || "vendor POs failed", pos: [] }, { status: 500 }) }
  }

  // PO-detail mode: EVERY material line under one PO (matches PO doc no OR customer PO) in this BU.
  // Optionally scoped to a vendor. Used by the PC "pull whole PO" flow (no per-item pick).
  const poFull = (sp.get("poFull") || "").trim()
  if (poFull) {
    const vendF = (sp.get("vend") || "").trim()
    const wh: string[] = [], pr: any[] = []
    const poParts: string[] = []
    if (has("po_no_doc")) { pr.push(poFull); poParts.push(`po_no_doc = $${pr.length}`) }
    if (has("cust_po")) { pr.push(poFull); poParts.push(`cust_po = $${pr.length}`) }
    if (!poParts.length) return NextResponse.json({ rows: [] })
    wh.push(`(${poParts.join(" OR ")})`)
    if (vendF && has("vend_name")) { pr.push(vendF); wh.push(`vend_name = $${pr.length}`) }
    const sql = `SELECT DISTINCT ON (so_no_doc, item_code) ${matFields} FROM ${SRC} WHERE ${wh.join(" AND ")} ORDER BY so_no_doc, item_code LIMIT 1000`
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...pr)
      return NextResponse.json({ rows })
    } catch (e: any) { return NextResponse.json({ error: e?.message || "PO detail failed", rows: [] }, { status: 500 }) }
  }

  // Detail mode: all material lines (per item) for ONE SO — used after SCM picks an SO.
  // Each row = a material; SCM enters pull-garment per SO, material qty scales proportionally.
  if (so) {
    const sql = `
      SELECT DISTINCT ON (item_code) ${matFields}
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
