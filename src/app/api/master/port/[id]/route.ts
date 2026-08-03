import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { releasePendingRateDocs } from "@/lib/freight"
import { canEditMaster } from "@/lib/master-access"
import { getFx } from "@/lib/fx"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const { country, ratePerKg } = body
  try {
    const rate = Number(ratePerKg) || 0
    const data: any = { country: String(country).trim(), ratePerKg: rate }
    if (body.bu != null) data.bu = String(body.bu).trim() || "ALL"
    if (body.currency != null) data.currency = String(body.currency).toUpperCase() === "USD" ? "USD" : "THB"
    const item = await (prisma as any).masterFreightRate.update({ where: { id }, data })
    // Auto-recalc open docs matching this COUNTRY. USD (EA) → THB via FX; bu-specific row only its BU.
    let recalculated = 0
    const fx = item.currency === "USD" ? await getFx() : null
    const rateThb = item.currency === "USD" ? rate * (fx?.thbPerUsd || 0) : rate
    if (rateThb > 0) {
      const affected = await (prisma.airRequestItem as any).findMany({
        where: {
          country: { equals: item.country, mode: "insensitive" },
          request: { status: { notIn: ["COMPLETED", "REJECTED"] }, ...(item.bu !== "ALL" ? { bu: item.bu } : {}) },
        },
        select: { id: true, grossWeight: true },
      })
      for (const it of affected) {
        await prisma.airRequestItem.update({ where: { id: it.id }, data: { airFreight: (it.grossWeight || 0) * rateThb, marketRatePerKg: rateThb } })
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
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  try {
    await (prisma as any).masterFreightRate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
