import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { releasePendingRateDocs } from "@/lib/freight"
import { canEditMaster } from "@/lib/master-access"
import { getFx } from "@/lib/fx"

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

  // Single rate. bu="ALL" = shared (default); a BU-specific row (e.g. EA) overrides. EA quotes in USD.
  const { country, ratePerKg } = body
  const bu = String(body.bu || "ALL").trim() || "ALL"
  const currency = String(body.currency || "THB").trim().toUpperCase() === "USD" ? "USD" : "THB"
  if (!country) return NextResponse.json({ error: "Missing country" }, { status: 400 })
  try {
    const rate = Number(ratePerKg) || 0
    const item = await (prisma as any).masterFreightRate.upsert({
      where: { country_bu: { country: String(country).trim(), bu } },
      update: { ratePerKg: rate, currency },
      create: { country: String(country).trim(), bu, currency, ratePerKg: rate },
    })
    const recalculated = rate > 0 ? await recalcOpenItems(item.country, rate, bu, currency) : 0
    await releasePendingRateDocs()
    return NextResponse.json({ ...item, recalculated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Recompute Est. Air Freight (grossWeight × rate, in THB) for open items matching this COUNTRY.
// A USD rate (EA) is converted to THB via the FX rate. A bu-specific rate only recalcs that BU's
// docs; a shared "ALL" rate recalcs docs of any BU that has NO BU-specific override.
async function recalcOpenItems(country: string, rate: number, bu: string, currency: string): Promise<number> {
  const fx = currency === "USD" ? await getFx() : null
  const rateThb = currency === "USD" ? rate * (fx?.thbPerUsd || 0) : rate
  if (rateThb <= 0) return 0
  const affected = await (prisma.airRequestItem as any).findMany({
    where: {
      country: { equals: country, mode: "insensitive" },
      request: { status: { notIn: ["COMPLETED", "REJECTED"] }, ...(bu !== "ALL" ? { bu } : {}) },
    },
    select: { id: true, grossWeight: true },
  })
  for (const it of affected) {
    await prisma.airRequestItem.update({
      where: { id: it.id },
      data: { airFreight: (it.grossWeight || 0) * rateThb, marketRatePerKg: rateThb },
    })
  }
  return affected.length
}
