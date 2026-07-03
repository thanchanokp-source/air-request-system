import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Clears all Logistics-entered data for a request: deletes HAWB groups and resets
// per-SO invoice / hawb / actual air / booking. Used by the "Clear Data" button.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  if (role !== "LOGISTICS" && role !== "LOGISTICS_GW") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  await prisma.hawbGroup.deleteMany({ where: { requestId: id } })
  // Clear logistics fields on ALL items of this doc (not just PRES_PASSED) so
  // nothing lingers regardless of the current item status.
  const upd = await prisma.airRequestItem.updateMany({
    where: { requestId: id },
    data: { invoiceNo: null, hawbNo: null, actualAirFreight: null, qtyActualShip: null, bookingDate: null } as any,
  })

  return NextResponse.json({ ok: true, cleared: upd.count })
}
