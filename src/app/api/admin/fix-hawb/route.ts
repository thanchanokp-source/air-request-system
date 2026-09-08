import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redistributeHawbCost } from "@/lib/freight"

export const runtime = "nodejs"

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const role = (session.user as any).role
  const email = String((session.user as any).email || "").toLowerCase()
  if (role !== "ADMIN" && email !== "jariya.t@nanyangtextile.com") return { err: NextResponse.json({ error: "Admin only" }, { status: 403 }) }
  return { err: null as any }
}

// GET ?hawb=CAR-... → all SOs currently on that HAWB (across documents), with qty + current actual.
export async function GET(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err
  const hawb = String(req.nextUrl.searchParams.get("hawb") || "").trim()
  if (!hawb) return NextResponse.json({ error: "hawb required" }, { status: 400 })
  const items = await (prisma.airRequestItem as any).findMany({
    where: { hawbNo: hawb },
    select: { id: true, so: true, sub: true, brand: true, invoiceNo: true, hawbNo: true, actualAirFreight: true, qtyActualShip: true, qtyRequestAir: true, request: { select: { documentNo: true } } },
    orderBy: [{ so: "asc" }],
  })
  const rows = items.map((it: any) => ({
    id: it.id, documentNo: it.request?.documentNo || "-", so: it.so, sub: it.sub, brand: it.brand,
    invoiceNo: it.invoiceNo, hawbNo: it.hawbNo, actualAirFreight: it.actualAirFreight,
    qty: Number(it.qtyActualShip ?? it.qtyRequestAir) || 0,
  }))
  const totalQty = rows.reduce((s: number, r: any) => s + r.qty, 0)
  const totalActual = rows.reduce((s: number, r: any) => s + (Number(r.actualAirFreight) || 0), 0)
  return NextResponse.json({ hawb, rows, totalQty, totalActual })
}

export async function POST(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err
  const body = await req.json()
  const action = body.action

  if (action === "rename") {
    const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds : []
    const newHawb = String(body.newHawb || "").trim()
    if (!itemIds.length || !newHawb) return NextResponse.json({ error: "itemIds + newHawb required" }, { status: 400 })
    const r = await prisma.airRequestItem.updateMany({ where: { id: { in: itemIds } }, data: { hawbNo: newHawb } as any })
    return NextResponse.json({ ok: true, moved: r.count, newHawb })
  }

  if (action === "redistribute") {
    const hawb = String(body.hawb || "").trim()
    const total = Number(body.total)
    if (!hawb || !(total > 0)) return NextResponse.json({ error: "hawb + total(>0) required" }, { status: 400 })
    await redistributeHawbCost(hawb, total)
    return NextResponse.json({ ok: true, hawb, total })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
