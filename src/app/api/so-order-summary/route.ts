import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Total SALE ORDER qty (SO_ORDER, NYG, every ship mode) for the dashboard — follows the same
// period filter (year / months, by ship_date; never before 2026) and Brand filter (customername, normalised like brandKey).
// GET ?year=2026&months=01,02&brands=FANATICS|NIKE → { pcs, soCount, subCount, unparsed, byMonth[{ym,pcs,soCount}] }
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const year = String(sp.get("year") || "").trim()
  const months = String(sp.get("months") || "").split(",").map(s => s.trim()).filter(s => /^\d{2}$/.test(s))
  const brands = String(sp.get("brands") || "").split("|").map(s => s.trim()).filter(Boolean)

  // ship_date is TEXT → parse the common formats; unknown format = NULL (counted as unparsed)
  const sql = `
    WITH s AS (
      SELECT so_no_doc, sub_no,
             NULLIF(regexp_replace(qty::text, '[^0-9.]', '', 'g'), '')::numeric AS pcs,
             UPPER(regexp_replace(TRIM(COALESCE(customername, '')), '\\s+', ' ', 'g')) AS brand,
             CASE
               WHEN TRIM(ship_date::text) ~ '^\\d{4}-\\d{1,2}-\\d{1,2}'      THEN to_date(substring(TRIM(ship_date::text) from '^\\d{4}-\\d{1,2}-\\d{1,2}'), 'YYYY-MM-DD')
               WHEN TRIM(ship_date::text) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}'      THEN to_date(substring(TRIM(ship_date::text) from '^\\d{1,2}/\\d{1,2}/\\d{4}'), 'DD/MM/YYYY')
               WHEN TRIM(ship_date::text) ~ '^\\d{1,2}-[A-Za-z]{3}-\\d{4}'  THEN to_date(TRIM(ship_date::text), 'DD-Mon-YYYY')
               WHEN TRIM(ship_date::text) ~ '^\\d{8}$'                     THEN to_date(TRIM(ship_date::text), 'YYYYMMDD')
             END AS sd
      FROM "ReportDB"."SO_ORDER_NYG_2020_present"
    )
    , f AS (
      SELECT * FROM s
      WHERE (sd IS NULL OR sd >= DATE '2026-01-01')   -- air-request system starts 2026 → older SO not counted
        AND ($1 = '' OR sd IS NULL OR to_char(sd, 'YYYY') = $1)
        AND (cardinality($2::text[]) = 0 OR sd IS NULL OR to_char(sd, 'MM') = ANY($2::text[]))
        AND (cardinality($3::text[]) = 0 OR brand = ANY($3::text[]))
    )
    SELECT 'ALL' AS ym,
           COALESCE(SUM(pcs) FILTER (WHERE sd IS NOT NULL), 0)::float8              AS pcs,
           COUNT(DISTINCT so_no_doc) FILTER (WHERE sd IS NOT NULL)::int             AS so_count,
           COUNT(DISTINCT (so_no_doc, sub_no)) FILTER (WHERE sd IS NOT NULL)::int   AS sub_count,
           COUNT(*) FILTER (WHERE sd IS NULL)::int                                  AS unparsed
    FROM f
    UNION ALL
    SELECT to_char(sd, 'YYYY-MM'), COALESCE(SUM(pcs), 0)::float8, COUNT(DISTINCT so_no_doc)::int, 0, 0
    FROM f WHERE sd IS NOT NULL
    GROUP BY 1`
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(sql, year, months, brands)
    const r = rows.find(x => x.ym === "ALL")
    const byMonth = rows.filter(x => x.ym !== "ALL").map(x => ({ ym: String(x.ym), pcs: Number(x.pcs) || 0, soCount: Number(x.so_count) || 0 })).sort((a, b) => a.ym.localeCompare(b.ym))
    return NextResponse.json({ pcs: Number(r?.pcs) || 0, soCount: Number(r?.so_count) || 0, subCount: Number(r?.sub_count) || 0, unparsed: Number(r?.unparsed) || 0, byMonth })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 })
  }
}
