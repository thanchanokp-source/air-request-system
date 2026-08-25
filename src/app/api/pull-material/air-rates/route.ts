import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import seed from "./rates.json"

// Inline-edit one route's rates (admin).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id, rates } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const clean: Record<string, number> = {}
  for (const [k, v] of Object.entries(rates || {})) { const n = Number(v); if (v !== "" && v != null && !isNaN(n)) clean[k] = n }
  const row = await (prisma as any).pullFreightAir.update({ where: { id }, data: { rates: clean } })
  return NextResponse.json({ ok: true, row })
}

// Pull RM AIR freight master (by PORT). GET → rows + distinct origins (for the Purchase Port
// dropdown). POST (admin) → reload the master from the bundled Rate_LG "AIR RATE" seed.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await (prisma as any).pullFreightAir.findMany({ orderBy: [{ origin: "asc" }, { airline: "asc" }] })
  const origins = [...new Set(rows.map((r: any) => r.origin))]
  return NextResponse.json({ rows, origins })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await (prisma as any).pullFreightAir.deleteMany({})
  await (prisma as any).pullFreightAir.createMany({
    data: (seed as any[]).map(s => ({ origin: s.origin, destination: s.destination || "BKK", fwd: s.fwd || null, airline: s.airline || null, tt: s.tt || null, rates: s.rates || {} })),
  })
  const count = await (prisma as any).pullFreightAir.count()
  return NextResponse.json({ ok: true, count })
}
