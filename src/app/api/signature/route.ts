import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — the current user's saved master signature (null if never set).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id
  const user = await (prisma.user as any).findUnique({ where: { id: userId }, select: { signatureData: true, signatureUpdatedAt: true } })
  return NextResponse.json({ signatureData: user?.signatureData || null, signatureUpdatedAt: user?.signatureUpdatedAt || null })
}

// PUT — save/replace the current user's master signature (base64 PNG data URI).
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id
  const { signatureData } = await req.json()
  if (!signatureData || typeof signatureData !== "string" || !signatureData.startsWith("data:image")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }
  await (prisma.user as any).update({
    where: { id: userId },
    data: { signatureData, signatureUpdatedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
