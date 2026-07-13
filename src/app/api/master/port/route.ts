import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { releasePendingRateDocs } from "@/lib/freight"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rates = await (prisma as any).masterFreightRate.findMany({ orderBy: [{ brand: "asc" }, { country: "asc" }] })
  return NextResponse.json(rates)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (!["ADMIN", "LOGISTICS", "LOGISTICS_GW"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()

  // Bulk import (from an uploaded Excel): { rows: [{ brand, country, ratePerKg }] }
  // Upsert each row so re-importing updates existing brand+country rates.
  if (Array.isArray(body?.rows)) {
    let saved = 0
    for (const r of body.rows) {
      const brand = String(r.brand || "").trim()
      const country = String(r.country || "").trim()
      if (!brand || !country) continue
      const rate = Number(r.ratePerKg) || 0
      try {
        await (prisma as any).masterFreightRate.upsert({
          where: { brand_country: { brand, country } },
          update: { ratePerKg: rate },
          create: { brand, country, ratePerKg: rate },
        })
        saved++
      } catch { /* skip bad row */ }
    }
    await releasePendingRateDocs()
    return NextResponse.json({ ok: true, saved, total: body.rows.length })
  }

  const { brand, country, ratePerKg } = body
  if (!brand || !country) return NextResponse.json({ error: "Missing brand or country" }, { status: 400 })
  try {
    const rate = Number(ratePerKg) || 0
    const item = await (prisma as any).masterFreightRate.create({
      data: { brand: String(brand).trim(), country: String(country).trim(), ratePerKg: rate }
    })
    // Auto-recalc: any open document with this brand+country now gets its
    // Est. Air Freight filled in immediately (no manual Recalculate needed).
    const recalculated = rate > 0 ? await recalcOpenItems(item.brand, item.country, rate) : 0
    await releasePendingRateDocs()
    return NextResponse.json({ ...item, recalculated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Recompute Est. Air Freight (grossWeight × rate) for every item on a non-closed
// document matching this brand+country. Returns how many items were updated.
async function recalcOpenItems(brand: string, country: string, rate: number): Promise<number> {
  const affected = await (prisma.airRequestItem as any).findMany({
    where: {
      brand: { equals: brand, mode: "insensitive" },
      country: { equals: country, mode: "insensitive" },
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
