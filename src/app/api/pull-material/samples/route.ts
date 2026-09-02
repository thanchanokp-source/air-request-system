import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Sample log — any signed-in user can read/add. Edit/delete: the creator or an admin.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await (prisma as any).pullSample.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({ rows })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const b = await req.json()
  const row = await (prisma as any).pullSample.create({
    data: {
      brand: (b.brand || "").trim() || null,
      supplier: (b.supplier || "").trim() || null,
      qty: (b.qty || "").trim() || null,
      remark: (b.remark || "").trim() || null,
      createdBy: (session.user as any)?.email || (session.user as any)?.name || null,
    },
  })
  return NextResponse.json({ ok: true, row })
}

const canEditRow = async (session: any, id: string) => {
  const u = session?.user
  if (!u) return false
  if (u.role === "ADMIN") return true
  const row = await (prisma as any).pullSample.findUnique({ where: { id } })
  const me = u.email || u.name
  return !!row && !!me && row.createdBy === me
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 })
  if (!(await canEditRow(session, b.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const row = await (prisma as any).pullSample.update({
    where: { id: b.id },
    data: {
      brand: (b.brand || "").trim() || null,
      supplier: (b.supplier || "").trim() || null,
      qty: (b.qty || "").trim() || null,
      remark: (b.remark || "").trim() || null,
    },
  })
  return NextResponse.json({ ok: true, row })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  if (!(await canEditRow(session, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await (prisma as any).pullSample.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
