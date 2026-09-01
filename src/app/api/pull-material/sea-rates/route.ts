import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import seed from "./rates.json"

// Inline-edit one sea port's rates, OR create a NEW port row (Admin + Logistics Import).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const clean: Record<string, number> = {}
  for (const [k, v] of Object.entries(body.rates || {})) { const n = Number(v); if (v !== "" && v != null && !isNaN(n)) clean[k] = n }
  // Create a new SEA port row (Purchase flagged it as "Other" — not in master).
  if (body.create) {
    if (!body.port) return NextResponse.json({ error: "port required" }, { status: 400 })
    const row = await (prisma as any).pullFreightSea.create({
      data: { country: body.country || null, port: String(body.port).trim(), rates: clean },
    })
    return NextResponse.json({ ok: true, row })
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const row = await (prisma as any).pullFreightSea.update({ where: { id: body.id }, data: { rates: clean } })
  return NextResponse.json({ ok: true, row })
}

// Bulk REPLACE the whole SEA master from an uploaded Rate_LG "SEA RATE" sheet (Admin + Logistics Import).
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const rows: any[] = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ error: "no rows" }, { status: 400 })
  const data = rows.filter(r => r.port).map(r => {
    const rates: Record<string, number> = {}
    for (const [k, v] of Object.entries(r.rates || {})) { const n = Number(v); if (v !== "" && v != null && !isNaN(n)) rates[k] = n }
    return { country: r.country || null, port: String(r.port).trim(), leadTime: r.leadTime ? String(r.leadTime).trim() : null, rates }
  })
  await (prisma as any).pullFreightSea.deleteMany({})
  await (prisma as any).pullFreightSea.createMany({ data })
  const count = await (prisma as any).pullFreightSea.count()
  return NextResponse.json({ ok: true, count })
}

// Pull RM SEA freight master (by sea PORT). GET → rows + distinct ports. POST (admin) → reload
// from the bundled Rate_LG "SEA RATE" seed.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await (prisma as any).pullFreightSea.findMany({ orderBy: [{ country: "asc" }, { port: "asc" }] })
  const ports = [...new Set(rows.map((r: any) => r.port))]
  return NextResponse.json({ rows, ports })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await (prisma as any).pullFreightSea.deleteMany({})
  await (prisma as any).pullFreightSea.createMany({
    data: (seed as any[]).map(s => ({ country: s.country, port: s.port, rates: s.rates || {} })),
  })
  const count = await (prisma as any).pullFreightSea.count()
  return NextResponse.json({ ok: true, count })
}
