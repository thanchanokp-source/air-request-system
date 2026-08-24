import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import seed from "./rates.json"

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
