import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Pull RM COURIER freight master (DHL / FedEx). Keyed by ORIGIN air port + carrier.
// rates = { "<kg tier>": total USD }.

// Bulk REPLACE the whole courier master from an uploaded "BY COURIER" sheet (Admin + Logistics Import).
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const rows: any[] = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ error: "no rows" }, { status: 400 })

  const existing = await (prisma as any).pullFreightCourier.findMany({ select: { origin: true, country: true } })
  const countryByOrigin: Record<string, string> = {}
  for (const e of existing) if (e.origin && e.country && !countryByOrigin[e.origin]) countryByOrigin[e.origin] = e.country

  const data = rows.filter(r => r.origin).map(r => {
    const rates: Record<string, number> = {}
    for (const [k, v] of Object.entries(r.rates || {})) { const n = Number(v); if (v !== "" && v != null && !isNaN(n)) rates[k] = n }
    const origin = String(r.origin).trim()
    return {
      origin, country: (r.country || countryByOrigin[origin]) || null,
      destination: r.destination || "BKK", carrier: String(r.carrier || "").trim().toUpperCase(), rates,
    }
  })
  await (prisma as any).pullFreightCourier.deleteMany({})
  await (prisma as any).pullFreightCourier.createMany({ data })
  const count = await (prisma as any).pullFreightCourier.count()
  return NextResponse.json({ ok: true, count })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await (prisma as any).pullFreightCourier.findMany({ orderBy: [{ country: "asc" }, { origin: "asc" }, { carrier: "asc" }] })
  const origins = [...new Set(rows.map((r: any) => r.origin))]
  return NextResponse.json({ rows, origins })
}
