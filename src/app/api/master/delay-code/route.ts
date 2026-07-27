import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditMaster } from "@/lib/master-access"

// SCM delay-reason codes (dropdown source for claim assignment — web + Export/Import Excel).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const items = await (prisma as any).masterDelayCode.findMany({
    where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Read only — only Admin/Logistics can edit" }, { status: 403 })
  const { code, definitions } = await req.json()
  if (!code || !String(code).trim()) return NextResponse.json({ error: "Missing code" }, { status: 400 })
  const defs = Array.isArray(definitions) ? definitions.map((d: any) => String(d).trim()).filter(Boolean)
    : String(definitions || "").split("\n").map(s => s.trim()).filter(Boolean)
  try {
    const max = await (prisma as any).masterDelayCode.aggregate({ _max: { sortOrder: true } })
    const item = await (prisma as any).masterDelayCode.create({
      data: { code: String(code).trim(), definitions: defs, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    })
    return NextResponse.json(item)
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: `"${code}" already exists` }, { status: 409 })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
