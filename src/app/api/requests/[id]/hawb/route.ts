import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const hawbs = await prisma.hawbGroup.findMany({
    where: { requestId: id },
    include: {
      items: {
        select: {
          id: true, so: true, style: true, customerPO: true, country: true,
          factory: true, grossWeight: true, qtyRequestAir: true, qtyActualShip: true,
          actualAirFreight: true, claimDepartment: true, invoiceNo: true,
        }
      }
    },
    orderBy: { createdAt: "asc" }
  })
  return NextResponse.json(hawbs)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (role !== "LOGISTICS") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { hawbNo, totalCharge, itemIds } = await req.json()

  if (!hawbNo || !totalCharge || !Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json({ error: "hawbNo, totalCharge, itemIds required" }, { status: 400 })
  }

  const items = await prisma.airRequestItem.findMany({
    where: { id: { in: itemIds }, requestId: id, itemStatus: "PRES_PASSED" }
  })
  if (items.length === 0) return NextResponse.json({ error: "ไม่พบ SO ที่เลือก" }, { status: 400 })

  const totalQty = items.reduce((s, i) => s + (i.qtyActualShip ?? i.qtyRequestAir), 0)
  if (totalQty === 0) return NextResponse.json({ error: "QTY รวมเป็น 0" }, { status: 400 })

  const costPerPc = totalCharge / totalQty

  const hawb = await prisma.hawbGroup.create({
    data: {
      requestId: id,
      hawbNo,
      totalCharge,
      items: {
        connect: items.map(i => ({ id: i.id }))
      }
    },
    include: { items: { select: { id: true, so: true, style: true, qtyRequestAir: true, qtyActualShip: true } } }
  })

  // Calculate and save actualAirFreight per item
  for (const item of items) {
    const qty = item.qtyActualShip ?? item.qtyRequestAir
    await prisma.airRequestItem.update({
      where: { id: item.id },
      data: { actualAirFreight: parseFloat((costPerPc * qty).toFixed(2)) }
    })
  }

  return NextResponse.json(hawb)
}
