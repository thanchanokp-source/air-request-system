import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { releasePendingRateDocs } from "@/lib/freight"
import { canEditMaster } from "@/lib/master-access"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  try {
    const rateThb = Number(body.ratePerKg) || 0
    const rateUsd = Number(body.rateUsd) || 0
    const data: any = { country: String(body.country).trim(), ratePerKg: rateThb, rateUsd }
    if (body.bu != null) data.bu = String(body.bu).trim() || "ALL"
    const item = await (prisma as any).masterFreightRate.update({ where: { id }, data })
    // Auto-recalc open docs of this COUNTRY: EA items use the USD rate (est in USD), others the THB rate.
    const affected = await (prisma.airRequestItem as any).findMany({
      where: {
        country: { equals: item.country, mode: "insensitive" },
        request: { status: { notIn: ["COMPLETED", "REJECTED"] }, ...(item.bu !== "ALL" ? { bu: item.bu } : {}) },
      },
      select: { id: true, grossWeight: true, request: { select: { bu: true } } },
    })
    let recalculated = 0
    for (const it of affected) {
      const r = it.request?.bu === "EA" ? rateUsd : rateThb
      if (r <= 0) continue
      await prisma.airRequestItem.update({ where: { id: it.id }, data: { airFreight: (it.grossWeight || 0) * r, marketRatePerKg: r } })
      recalculated++
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
