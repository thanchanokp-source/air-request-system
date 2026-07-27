import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditMaster } from "@/lib/master-access"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Read only — only Admin/Logistics can edit" }, { status: 403 })
  const { id } = await params
  const { code, definitions, isActive } = await req.json()
  const defs = Array.isArray(definitions) ? definitions.map((d: any) => String(d).trim()).filter(Boolean)
    : definitions != null ? String(definitions).split("\n").map(s => s.trim()).filter(Boolean) : undefined
  try {
    const item = await (prisma as any).masterDelayCode.update({
      where: { id },
      data: {
        ...(code != null ? { code: String(code).trim() } : {}),
        ...(defs != null ? { definitions: defs } : {}),
        ...(isActive != null ? { isActive: !!isActive } : {}),
      },
    })
    return NextResponse.json(item)
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: `"${code}" already exists` }, { status: 409 })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Read only — only Admin/Logistics can edit" }, { status: 403 })
  const { id } = await params
  await (prisma as any).masterDelayCode.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
