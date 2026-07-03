import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 400 })

  const user = await (prisma.user as any).findFirst({
    where: { resetToken: token }
  })

  if (!user) return NextResponse.json({ error: "Invalid or already-used token" }, { status: 400 })
  if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
    return NextResponse.json({ error: "This token has expired. Please register again" }, { status: 400 })
  }

  await (prisma.user as any).update({
    where: { id: user.id },
    data: { isActive: true, resetToken: null, resetTokenExpiry: null }
  })

  return NextResponse.json({ ok: true })
}
