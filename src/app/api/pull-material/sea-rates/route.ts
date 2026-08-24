import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import seed from "./rates.json"

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
