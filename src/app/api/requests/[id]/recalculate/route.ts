import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const request = await prisma.airRequest.findUnique({ where: { id }, include: { items: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const items = request.items as any[]
  // Freight rate is keyed by BRAND + COUNTRY. Case-insensitive.
  const rateKey = (brand: string, country: string) => `${brand.trim().toUpperCase()}|${country.trim().toUpperCase()}`
  const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true } })
  const freightRates: Record<string, number> = {}
  for (const r of rateList) freightRates[rateKey(r.brand, r.country)] = r.ratePerKg

  let updated = 0
  for (const item of items) {
    const rate = freightRates[rateKey(String(item.brand || ""), String(item.country || ""))] || 0
    const gw = item.grossWeight || 0
    await prisma.airRequestItem.update({
      where: { id: item.id },
      data: {
        airFreight: gw * rate,
        marketRatePerKg: rate > 0 ? rate : undefined
      }
    })
    updated++
  }

  return NextResponse.json({ ok: true, updated })
}
