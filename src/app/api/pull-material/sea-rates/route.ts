import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Pull RM SEA master — LONG format (one row per port+container), mirrors the Excel sheet exactly.
const numOrNull = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return (v === "" || v == null || isNaN(n)) ? null : n }

// Inline-edit one row's rate (Admin + Logistics Import).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  if (body.create) {
    if (!body.port) return NextResponse.json({ error: "port required" }, { status: 400 })
    const row = await (prisma as any).pullFreightSea.create({ data: { country: body.country || null, port: String(body.port).trim(), container: body.container || null, rate: numOrNull(body.rate) } })
    return NextResponse.json({ ok: true, row })
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const row = await (prisma as any).pullFreightSea.update({ where: { id: body.id }, data: { rate: numOrNull(body.rate) } })
  return NextResponse.json({ ok: true, row })
}

// Bulk REPLACE the SEA master from the "IMPORT SEA RATE" sheet — one DB row per sheet line.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const rows: any[] = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ error: "no rows" }, { status: 400 })
  const data = rows.filter(r => r.port).map(r => ({
    country: r.country || null, forwarder: r.forwarder || null, port: String(r.port).trim(),
    container: r.container || null, rate: numOrNull(r.rate), unit: r.unit || null,
    updated: r.updated != null && r.updated !== "" ? String(r.updated) : null, remarks: r.remarks || null,
  }))
  await (prisma as any).pullFreightSea.deleteMany({})
  await (prisma as any).pullFreightSea.createMany({ data })
  const count = await (prisma as any).pullFreightSea.count()
  return NextResponse.json({ ok: true, count })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await (prisma as any).pullFreightSea.findMany({ orderBy: [{ country: "asc" }, { port: "asc" }, { container: "asc" }] })
  const ports = [...new Set(rows.map((r: any) => r.port))]
  return NextResponse.json({ rows, ports })
}

// Sea master now comes only from the Excel sheet (format changed) → reset clears it; re-import via Sync.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await (prisma as any).pullFreightSea.deleteMany({})
  return NextResponse.json({ ok: true, count: 0, note: "cleared — import จากชีท SEA RATE" })
}
