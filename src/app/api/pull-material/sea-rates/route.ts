import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import seed from "./rates.json"

// Inline-edit one sea port's rates (admin).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id, rates } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const clean: Record<string, number> = {}
  for (const [k, v] of Object.entries(rates || {})) { const n = Number(v); if (v !== "" && v != null && !isNaN(n)) clean[k] = n }
  const row = await (prisma as any).pullFreightSea.update({ where: { id }, data: { rates: clean } })
  return NextResponse.json({ ok: true, row })
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
