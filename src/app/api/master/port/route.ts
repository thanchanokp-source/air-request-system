import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { releasePendingRateDocs } from "@/lib/freight"
import { canEditMaster } from "@/lib/master-access"
import { soCurrency } from "@/lib/currency"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rates = await (prisma as any).masterFreightRate.findMany({ orderBy: [{ country: "asc" }] })
  return NextResponse.json(rates)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()

  // Bulk import (from an uploaded Excel): { rows: [{ country, ratePerKg }] } → shared THB rates (bu="ALL").
  if (Array.isArray(body?.rows)) {
    let saved = 0
    for (const r of body.rows) {
      const country = String(r.country || "").trim()
      if (!country) continue
      const rate = Number(r.ratePerKg) || 0
      try {
        await (prisma as any).masterFreightRate.upsert({
          where: { country_bu: { country, bu: "ALL" } },
          update: { ratePerKg: rate },
          create: { country, bu: "ALL", currency: "THB", ratePerKg: rate },
        })
        saved++
      } catch { /* skip bad row */ }
    }
    await releasePendingRateDocs()
    return NextResponse.json({ ok: true, saved, total: body.rows.length })
  }

  // Single rate. Two separate rates per country row: ratePerKg (THB, for NYG/GW/TRM) + rateUsd (USD, EA).
  const { country } = body
  const bu = String(body.bu || "ALL").trim() || "ALL"
  if (!country) return NextResponse.json({ error: "Missing country" }, { status: 400 })
  try {
    const rateThb = Number(body.ratePerKg) || 0
    const rateUsd = Number(body.rateUsd) || 0
    const item = await (prisma as any).masterFreightRate.upsert({
      where: { country_bu: { country: String(country).trim(), bu } },
      update: { ratePerKg: rateThb, rateUsd },
      create: { country: String(country).trim(), bu, currency: "THB", ratePerKg: rateThb, rateUsd },
    })
    const recalculated = await recalcOpenItems(item.country, rateThb, rateUsd, bu)
    await releasePendingRateDocs()
    return NextResponse.json({ ...item, recalculated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Recompute Est. Air Freight (grossWeight × rate) for open items of this COUNTRY. EA items use the USD
// rate (est stored in USD); every other BU uses the THB rate (est in THB). A bu-specific rate only
// recalcs that BU's docs; a shared "ALL" rate recalcs docs of any BU (that has no BU-specific override).
async function recalcOpenItems(country: string, rateThb: number, rateUsd: number, bu: string): Promise<number> {
  const affected = await (prisma.airRequestItem as any).findMany({
    where: {
      country: { equals: country, mode: "insensitive" },
      request: { status: { notIn: ["COMPLETED", "REJECTED"] }, ...(bu !== "ALL" ? { bu } : {}) },
    },
    select: { id: true, grossWeight: true, brand: true, request: { select: { bu: true } } },
  })
  let n = 0
  for (const it of affected) {
    const r = soCurrency(it.request?.bu, it.brand) === "USD" ? rateUsd : rateThb
    if (r <= 0) continue
    await prisma.airRequestItem.update({
      where: { id: it.id },
      data: { airFreight: (it.grossWeight || 0) * r, marketRatePerKg: r },
    })
    n++
  }
  return n
}
