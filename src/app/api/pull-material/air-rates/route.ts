import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import seed from "./rates.json"

// Inline-edit one route's rates, OR create a NEW port row (Admin + Logistics Import).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const clean: Record<string, number> = {}
  for (const [k, v] of Object.entries(body.rates || {})) { const n = Number(v); if (v !== "" && v != null && !isNaN(n)) clean[k] = n }
  const numOrNull = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v))
  // Origin cost per incoterm (only set the field if the caller sent the key).
  const extra: any = {}
  if ("origCostExw" in body) extra.origCostExw = numOrNull(body.origCostExw)
  if ("origCostFca" in body) extra.origCostFca = numOrNull(body.origCostFca)
  // Create a new AIR port row (Purchase flagged it as "Other" — not in master).
  if (body.create) {
    if (!body.origin) return NextResponse.json({ error: "origin (air port) required" }, { status: 400 })
    const row = await (prisma as any).pullFreightAir.create({
      data: { origin: String(body.origin).trim(), country: body.country || null, destination: body.destination || "BKK", fwd: body.fwd || null, airline: body.airline || null, tt: body.tt || null, rates: clean, ...extra },
    })
    return NextResponse.json({ ok: true, row })
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const data: any = { ...extra }
  if (body.rates) data.rates = clean // only overwrite rates when the caller sent them
  const row = await (prisma as any).pullFreightAir.update({ where: { id: body.id }, data })
  return NextResponse.json({ ok: true, row })
}

// Bulk REPLACE the whole AIR master from an uploaded Rate_LG "AIR RATE" sheet (Admin + Logistics Import).
// Country is preserved from the existing master by origin when the upload has no COUNTRY column.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const rows: any[] = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ error: "no rows" }, { status: 400 })
  const numOrNull = (v: any) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v))

  // Keep a origin→country fallback from what's already in the master.
  const existing = await (prisma as any).pullFreightAir.findMany({ select: { origin: true, country: true } })
  const countryByOrigin: Record<string, string> = {}
  for (const e of existing) if (e.origin && e.country && !countryByOrigin[e.origin]) countryByOrigin[e.origin] = e.country

  const data = rows.filter(r => r.origin).map(r => {
    const rates: Record<string, number> = {}
    for (const [k, v] of Object.entries(r.rates || {})) { const n = Number(v); if (v !== "" && v != null && !isNaN(n)) rates[k] = n }
    const origin = String(r.origin).trim()
    return {
      origin, country: (r.country || countryByOrigin[origin]) || null,
      destination: r.destination || "BKK", fwd: r.fwd || null, airline: r.airline || null, tt: r.tt || null,
      origCostExw: numOrNull(r.origCostExw), origCostFca: numOrNull(r.origCostFca), rates,
    }
  })
  await (prisma as any).pullFreightAir.deleteMany({})
  await (prisma as any).pullFreightAir.createMany({ data })
  const count = await (prisma as any).pullFreightAir.count()
  return NextResponse.json({ ok: true, count })
}

// Pull RM AIR freight master (by PORT). GET → rows + distinct origins (for the Purchase Port
// dropdown). POST (admin) → reload the master from the bundled Rate_LG "AIR RATE" seed.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await (prisma as any).pullFreightAir.findMany({ orderBy: [{ country: "asc" }, { origin: "asc" }, { airline: "asc" }] })
  const origins = [...new Set(rows.map((r: any) => r.origin))]
  const countries = [...new Set(rows.map((r: any) => r.country).filter(Boolean))]
  return NextResponse.json({ rows, origins, countries })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await (prisma as any).pullFreightAir.deleteMany({})
  await (prisma as any).pullFreightAir.createMany({
    data: (seed as any[]).map(s => ({ origin: s.origin, country: s.country || null, destination: s.destination || "BKK", fwd: s.fwd || null, airline: s.airline || null, tt: s.tt || null, rates: s.rates || {} })),
  })
  const count = await (prisma as any).pullFreightAir.count()
  return NextResponse.json({ ok: true, count })
}
