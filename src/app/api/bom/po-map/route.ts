import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Map SO number → PO number (po_no_doc) from the Bill of Material tables (ReportDB, per BU).
// Used by the dashboard to show the BOM PO alongside each SO row.
const BOM_TABLE: Record<string, string> = {
  NYG: `"ReportDB"."NYG_BILL_OF_MATERIALS_EXPORT_CHECK"`,
  GW: `"ReportDB"."GW_BILL_OF_MATERIALS_EXPORT_CHECK"`,
  TRM: `"ReportDB"."TRM_BILL_OF_MATERIALS_EXPORT_CHECK"`,
  NYV: `"ReportDB"."NYV_BILL_OF_MATERIALS_EXPORT_CHECK"`,
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sos: string[] = Array.isArray(body.sos) ? body.sos.map((s: any) => String(s)).filter(Boolean) : []
  if (sos.length === 0) return NextResponse.json({ map: {} })

  const map: Record<string, string> = {}
  for (const tbl of Object.values(BOM_TABLE)) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT DISTINCT ON (so_no_doc) so_no_doc AS "so", po_no_doc AS "po"
         FROM ${tbl} WHERE so_no_doc = ANY($1) ORDER BY so_no_doc`,
        sos,
      )
      rows.forEach(r => { if (r.so && r.po && !map[r.so]) map[r.so] = r.po })
    } catch { /* table/BU may not exist — skip */ }
  }
  return NextResponse.json({ map })
}
