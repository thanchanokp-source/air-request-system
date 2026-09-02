import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Master Purchase (Country / Port / City) — read by anyone signed in; edited by Admin + Purchasing.
const canEdit = (u: any) => !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("PURCHASING")) || u.role === "PURCHASING")

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await (prisma as any).pullPurchaseCity.findMany({ orderBy: [{ country: "asc" }, { city: "asc" }] })
  return NextResponse.json({ rows })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canEdit(session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const b = await req.json()
  if (!b.city?.trim()) return NextResponse.json({ error: "city required" }, { status: 400 })
  const row = await (prisma as any).pullPurchaseCity.create({
    data: { country: String(b.country || "").trim(), port: String(b.port || "").trim(), city: String(b.city).trim() },
  })
  return NextResponse.json({ ok: true, row })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canEdit(session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const row = await (prisma as any).pullPurchaseCity.update({
    where: { id: b.id },
    data: { country: String(b.country || "").trim(), port: String(b.port || "").trim(), city: String(b.city || "").trim() },
  })
  return NextResponse.json({ ok: true, row })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canEdit(session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await (prisma as any).pullPurchaseCity.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
