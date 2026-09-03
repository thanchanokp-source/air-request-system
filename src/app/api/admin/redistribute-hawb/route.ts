import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redistributeHawbCost } from "@/lib/freight"

// Fix a single HAWB whose actual was mis-entered (e.g. the whole total on one SO row from an uploaded
// file). Admin gives the HAWB# + its correct Total; the cost is split GLOBALLY across every SO carrying
// that hawbNo (all documents) by air qty. Idempotent (sum over the HAWB = total). Admin only.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { hawbNo, total } = await req.json().catch(() => ({}))
  const h = String(hawbNo || "").trim()
  const t = Number(total)
  if (!h) return NextResponse.json({ error: "hawbNo required" }, { status: 400 })
  if (!(t > 0)) return NextResponse.json({ error: "total must be > 0" }, { status: 400 })

  const items = await (prisma as any).airRequestItem.findMany({
    where: { hawbNo: h }, select: { id: true, qtyActualShip: true, qtyRequestAir: true },
  })
  if (!items.length) return NextResponse.json({ error: `No SO found with HAWB# ${h}` }, { status: 404 })
  const totalQty = items.reduce((s: number, it: any) => s + (Number(it.qtyActualShip ?? it.qtyRequestAir) || 0), 0)

  await redistributeHawbCost(h, t)
  return NextResponse.json({ ok: true, hawbNo: h, total: t, items: items.length, totalQty })
}
