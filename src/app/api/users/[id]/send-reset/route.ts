import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendPasswordSetupEmail } from "@/lib/notify"
import crypto from "crypto"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const token = crypto.randomUUID()
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

  await (prisma.user as any).update({
    where: { id },
    data: { resetToken: token, resetTokenExpiry: expiry }
  })

  await sendPasswordSetupEmail(user.email, user.name || user.email, token)

  return NextResponse.json({ ok: true })
}
