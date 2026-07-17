import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { releaseHeldDocs } from "@/lib/freight"
import { canEditMaster } from "@/lib/master-access"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const items = await prisma.masterDescription.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Read only — only Admin/Logistics can edit" }, { status: 403 })
  const { name, weightPerUnit } = await req.json()
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 })
  try {
    const item = await prisma.masterDescription.create({
      data: { name, weightPerUnit: Number(weightPerUnit) || 0 }
    })
    // A newly-added WT Charge may release documents held for this description.
    if ((Number(weightPerUnit) || 0) > 0) await releaseHeldDocs().catch(() => {})
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
