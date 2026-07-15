import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { releasePendingRateDocs } from "@/lib/freight"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (!["ADMIN", "LOGISTICS", "LOGISTICS_GW"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const { country, ratePerKg } = await req.json()
  try {
    const rate = Number(ratePerKg) || 0
    const item = await (prisma as any).masterFreightRate.update({
      where: { id },
      data: { country: String(country).trim(), ratePerKg: rate }
    })
    // Auto-recalc open documents matching this COUNTRY (rate keyed by country only).
    let recalculated = 0
    if (rate > 0) {
      const affected = await (prisma.airRequestItem as any).findMany({
        where: {
          country: { equals: item.country, mode: "insensitive" },
          request: { status: { notIn: ["COMPLETED", "REJECTED"] } },
        },
        select: { id: true, grossWeight: true },
      })
      for (const it of affected) {
        await prisma.airRequestItem.update({ where: { id: it.id }, data: { airFreight: (it.grossWeight || 0) * rate, marketRatePerKg: rate } })
      }
      recalculated = affected.length
    }
    await releasePendingRateDocs()
    return NextResponse.json({ ...item, recalculated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (role !== "ADMIN" && role !== "LOGISTICS") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  try {
    await (prisma as any).masterFreightRate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
