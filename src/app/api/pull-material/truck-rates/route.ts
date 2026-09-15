import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Pull RM TRUCK master — port/airport → factory transport cost.
const numOrNull = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return (v === "" || v == null || isNaN(n)) ? null : n }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await (prisma as any).pullFreightTruck.findMany({ orderBy: [{ portGroup: "asc" }, { location: "asc" }] })
  return NextResponse.json({ rows })
}

// Bulk REPLACE the truck master (from the "IMPORT TRUCK" sheet). Admin + Logistics Import.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const rows: any[] = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ error: "no rows" }, { status: 400 })
  const data = rows.filter(r => r.portGroup && r.location).map(r => ({
    portGroup: String(r.portGroup), supplier: r.supplier || null, location: String(r.location).trim(),
    rate20: numOrNull(r.rate20), rate40: numOrNull(r.rate40), rateLcl1: numOrNull(r.rateLcl1), rateLcl2: numOrNull(r.rateLcl2),
    updated: r.updated != null && r.updated !== "" ? String(r.updated) : null,
  }))
  await (prisma as any).pullFreightTruck.deleteMany({})
  await (prisma as any).pullFreightTruck.createMany({ data })
  const count = await (prisma as any).pullFreightTruck.count()
  return NextResponse.json({ ok: true, count })
}
