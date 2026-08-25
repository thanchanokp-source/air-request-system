import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canonCountry } from "@/lib/freight"
import { soCurrency } from "@/lib/currency"

// Bulk recompute Gross + EST with the new QTY-Air basis for EXISTING documents.
// Only touches ACTIVE items that haven't shipped yet (itemStatus != COMPLETED and no
// actualAirFreight) — completed / historical rows keep their real weights & actuals.
// Optional body { bu } to limit to one BU. Admin only.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const bu = body.bu ? String(body.bu) : null

  const descKey = (s: string) => String(s || "").trim().toUpperCase().replace(/\s*,\s*/g, ",").replace(/\s+/g, " ")
  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const rates: Record<string, number> = {}, ratesUsd: Record<string, number> = {}
  for (const r of rateList) { rates[canonCountry(r.country)] = r.ratePerKg; ratesUsd[canonCountry(r.country)] = r.rateUsd || 0 }
  const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
  const wts: Record<string, number> = {}
  for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0

  const items = await (prisma.airRequestItem as any).findMany({
    where: { itemStatus: { not: "COMPLETED" }, actualAirFreight: null, ...(bu ? { request: { is: { bu } } } : {}) },
    select: { id: true, description: true, country: true, brand: true, qtyRequestAir: true, qtyOriginalShipment: true, request: { select: { bu: true } } },
  })

  let updated = 0
  for (const it of items) {
    const wt = wts[descKey(it.description)] || 0
    const rate = (soCurrency(it.request?.bu, it.brand) === "USD" ? ratesUsd : rates)[canonCountry(it.country)] || 0
    const gross = (it.qtyRequestAir || it.qtyOriginalShipment || 0) * wt
    await prisma.airRequestItem.update({
      where: { id: it.id },
      data: { grossWeight: gross, airFreight: gross * rate, marketRatePerKg: rate > 0 ? rate : null },
    }).catch(() => {})
    updated++
  }
  return NextResponse.json({ ok: true, updated, scanned: items.length })
}
