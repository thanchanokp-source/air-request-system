import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return NextResponse.json({ error: "Invalid token" }, { status: 400 })

  const user = await (prisma.user as any).findUnique({ where: { resetToken: token } })
  if (!user) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
  if (user.resetTokenExpiry && new Date() > new Date(user.resetTokenExpiry)) {
    return NextResponse.json({ error: "This link has expired. Please contact Admin" }, { status: 410 })
  }
  return NextResponse.json({ name: user.name, email: user.email })
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })

  const user = await (prisma.user as any).findUnique({ where: { resetToken: token } })
  if (!user) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
  if (user.resetTokenExpiry && new Date() > new Date(user.resetTokenExpiry)) {
    return NextResponse.json({ error: "This link has expired. Please contact Admin" }, { status: 410 })
  }

  const hashed = await bcrypt.hash(password, 10)
  await (prisma.user as any).update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetTokenExpiry: null, isActive: true }
  })
  return NextResponse.json({ ok: true })
}
