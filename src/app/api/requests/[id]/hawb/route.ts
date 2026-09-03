import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redistributeHawbCost } from "@/lib/freight"

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
  if (role !== "LOGISTICS" && role !== "LOGISTICS_GW") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  // itemInvoices: optional { itemId: invoiceNo } — 1 HAWB may hold several INVs, each over several SOs.
  const { hawbNo, totalCharge, itemIds, itemInvoices } = await req.json()

  if (!hawbNo || !totalCharge || !Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json({ error: "hawbNo, totalCharge, itemIds required" }, { status: 400 })
  }

  const items = await prisma.airRequestItem.findMany({
    where: { id: { in: itemIds }, requestId: id, itemStatus: "PRES_PASSED" }
  })
  if (items.length === 0) return NextResponse.json({ error: "Selected SO not found" }, { status: 400 })

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

  // Bind the selected SOs to this HAWB (+ optional per-SO INV). Do NOT divide the total per-document.
  for (const item of items) {
    const inv = itemInvoices && typeof itemInvoices === "object" ? itemInvoices[item.id] : undefined
    await prisma.airRequestItem.update({
      where: { id: item.id },
      data: { hawbNo, ...(inv ? { invoiceNo: String(inv) } : {}) },
    })
  }

  // ONE HAWB total split across ALL SOs carrying this hawbNo — across EVERY document — by air qty.
  // Idempotent: booking the same HAWB in two documents can no longer double the actual (sum = totalCharge).
  await redistributeHawbCost(hawbNo, Number(totalCharge))

  return NextResponse.json(hawb)
}
