import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Read-only lookup against the daily-refreshed Bill of Material table
// (NYG_BILL_OF_MATERIALS_EXPORT_CHECK — reloaded by the 09:00 job). Used by the
// Pull Material request screen to pull SO → customer / PO / style / vendor.
// Filters by BU and a free-text query on SO / customer / customer PO.
const SRC = `public."NYG_BILL_OF_MATERIALS_EXPORT_CHECK"`

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const bu = (sp.get("bu") || "").trim()
  const q = (sp.get("q") || "").trim()
  const limit = Math.min(Number(sp.get("limit")) || 50, 200)

  const where: string[] = []
  const params: any[] = []
  if (bu) { params.push(bu); where.push(`bu = $${params.length}`) }
  if (q) {
    params.push(`%${q}%`)
    const i = params.length
    where.push(`("soNoDoc" ILIKE $${i} OR "customerName" ILIKE $${i} OR "customerPo" ILIKE $${i} OR "poNoDoc" ILIKE $${i} OR style ILIKE $${i})`)
  }
  const sql = `
    SELECT bu, "soNoDoc" AS "soNoDoc", "customerName" AS "customerName", "customerPo" AS "customerPo",
           "vendorName" AS "vendorName", "poNoDoc" AS "poNoDoc", style, "updatedAt" AS "updatedAt"
    FROM ${SRC}
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY "soNoDoc"
    LIMIT ${limit}`

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params)
    return NextResponse.json({ rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "BOM query failed", rows: [] }, { status: 500 })
  }
}

// Distinct BU list for the selector (so the screen adapts as the job loads more BUs).
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT DISTINCT bu FROM ${SRC} WHERE bu IS NOT NULL ORDER BY bu`)
    return NextResponse.json({ bus: rows.map(r => r.bu) })
  } catch {
    return NextResponse.json({ bus: ["NYG"] })
  }
}
