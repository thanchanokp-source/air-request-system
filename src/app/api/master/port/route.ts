import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const ports = await prisma.masterPort.findMany({ orderBy: [{ country: "asc" }, { port: "asc" }] })
  return NextResponse.json(ports)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (!["ADMIN", "LOGISTICS", "LOGISTICS_GW"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { country, port, ratePerKg } = await req.json()
  if (!country || !port) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  try {
    const rate = Number(ratePerKg) || 0
    const item = await prisma.masterPort.create({ data: { country, port, ratePerKg: rate } })
    // Auto-recalc: any open document using this port now gets its Est. Air Freight
    // filled in immediately (no manual Recalculate needed).
    const recalculated = rate > 0 ? await recalcOpenItemsForPort(port, rate) : 0
    return NextResponse.json({ ...item, recalculated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Recompute Est. Air Freight (grossWeight × rate) for every item on a non-closed
// document that uses this port. Returns how many items were updated.
async function recalcOpenItemsForPort(port: string, rate: number): Promise<number> {
  const affected = await (prisma.airRequestItem as any).findMany({
    where: {
      port: { equals: port, mode: "insensitive" },
      request: { status: { notIn: ["COMPLETED", "REJECTED"] } },
    },
    select: { id: true, grossWeight: true },
  })
  for (const it of affected) {
    await prisma.airRequestItem.update({
      where: { id: it.id },
      data: { airFreight: (it.grossWeight || 0) * rate, marketRatePerKg: rate },
    })
  }
  return affected.length
}
