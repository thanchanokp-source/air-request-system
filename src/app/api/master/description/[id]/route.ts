import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { releaseHeldDocs } from "@/lib/freight"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "LOGISTICS", "LOGISTICS_GW"].includes((session.user as any).role)) return NextResponse.json({ error: "Read only — only Admin/Logistics can edit" }, { status: 403 })
  const { id } = await params
  const { name, weightPerUnit } = await req.json()
  try {
    const item = await prisma.masterDescription.update({
      where: { id },
      data: { name, weightPerUnit: Number(weightPerUnit) }
    })
    // Adding/raising a WT Charge may release documents held for this description.
    if ((Number(weightPerUnit) || 0) > 0) await releaseHeldDocs().catch(() => {})
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "LOGISTICS"].includes((session.user as any).role)) return NextResponse.json({ error: "Read only — only Admin/Logistics can edit" }, { status: 403 })
  const { id } = await params
  try {
    await prisma.masterDescription.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
