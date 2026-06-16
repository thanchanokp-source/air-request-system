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
  const descNames = [...new Set(items.map(i => String(i.description || "")).filter(Boolean))]
  const portNames = [...new Set(items.map(i => String(i.port || "")).filter(Boolean))]

  const [descList, portList] = await Promise.all([
    prisma.masterDescription.findMany({ where: { name: { in: descNames } } }),
    prisma.masterPort.findMany({ where: { port: { in: portNames } } })
  ])

  const descWeights: Record<string, number> = {}
  for (const d of descList) descWeights[d.name] = d.weightPerUnit

  const portRates: Record<string, number> = {}
  for (const p of portList) portRates[p.port] = p.ratePerKg

  let updated = 0
  for (const item of items) {
    const weight = descWeights[item.description] || 0
    const rate = portRates[item.port] || 0
    const gw = (item.qtyRequestAir || 0) * weight
    const af = gw * rate
    await prisma.airItem.update({
      where: { id: item.id },
      data: {
        grossWeight: gw,
        airFreight: af,
        marketRatePerKg: rate > 0 ? rate : undefined
      }
    })
    updated++
  }

  return NextResponse.json({ ok: true, updated, descWeights, portRates })
}
