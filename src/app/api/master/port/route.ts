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
  if (role !== "ADMIN" && role !== "LOGISTICS") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { country, port, ratePerKg } = await req.json()
  if (!country || !port) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  try {
    const item = await prisma.masterPort.create({ data: { country, port, ratePerKg: Number(ratePerKg) || 0 } })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
