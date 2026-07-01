import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { emailExistsInDirectory } from "@/lib/people"
import { sendVerificationEmail } from "@/lib/notify"

const ALLOWED_ROLES: Record<string, string> = {
  MER: "MER_USER",
  ACCOUNTING: "ACCOUNTING",
}

export async function POST(req: NextRequest) {
  const { name, email, password, bu, position } = await req.json()

  if (!email || !password || !bu || !position) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 })
  }

  if (!email.toLowerCase().endsWith("@nanyangtextile.com")) {
    return NextResponse.json({ error: "ต้องใช้ email ของบริษัท (@nanyangtextile.com)" }, { status: 400 })
  }

  const role = ALLOWED_ROLES[position]
  if (!role) {
    return NextResponse.json({ error: "Position ไม่ถูกต้อง" }, { status: 400 })
  }

  try {
    const exists = await emailExistsInDirectory(email)
    if (!exists) {
      return NextResponse.json({ error: "ไม่พบ email นี้ในระบบพนักงาน กรุณาติดต่อ Admin" }, { status: 403 })
    }
  } catch {
    // People API unreachable (e.g. external deployment) — skip check, rely on email domain validation
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password ต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 })
  }

  const normalEmail = email.toLowerCase()

  const existing = await (prisma.user as any).findUnique({ where: { email: normalEmail } })
  if (existing) {
    if (existing.isActive) {
      return NextResponse.json({ error: "Email นี้มีในระบบแล้ว" }, { status: 409 })
    }
    await (prisma.user as any).delete({ where: { email: normalEmail } })
  }

  const hashed = await bcrypt.hash(password, 10)
  const token = crypto.randomUUID()
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await (prisma.user as any).create({
    data: {
      name: name || null,
      email: normalEmail,
      password: hashed,
      role, bu,
      isActive: false,
      resetToken: token,
      resetTokenExpiry: expiry,
    }
  })

  try {
    await sendVerificationEmail(normalEmail, token)
  } catch (err: any) {
    return NextResponse.json({ ok: true, emailError: err?.message || String(err) })
  }

  return NextResponse.json({ ok: true })
}
