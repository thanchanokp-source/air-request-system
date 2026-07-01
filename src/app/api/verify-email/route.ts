import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return NextResponse.json({ error: "ไม่พบ token" }, { status: 400 })

  const user = await (prisma.user as any).findFirst({
    where: { resetToken: token }
  })

  if (!user) return NextResponse.json({ error: "Token ไม่ถูกต้องหรือถูกใช้ไปแล้ว" }, { status: 400 })
  if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
    return NextResponse.json({ error: "Token หมดอายุแล้ว กรุณาสมัครใหม่" }, { status: 400 })
  }

  await (prisma.user as any).update({
    where: { id: user.id },
    data: { isActive: true, resetToken: null, resetTokenExpiry: null }
  })

  return NextResponse.json({ ok: true })
}
