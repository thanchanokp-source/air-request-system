import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPasswordSetupEmail } from "@/lib/notify"
import crypto from "crypto"

// Self-service "Forgot password": user enters their email → we email a password-setup link
// (same resetToken flow as the admin "Send Link" button). No auth required.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || "").toLowerCase().trim()

  // Always respond ok (never reveal whether an email exists / is active).
  if (email.endsWith("@nanyangtextile.com")) {
    const user = await (prisma.user as any).findUnique({ where: { email } })
    if (user && user.isActive) {
      const token = crypto.randomUUID()
      const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
      await (prisma.user as any).update({ where: { id: user.id }, data: { resetToken: token, resetTokenExpiry: expiry } })
      await sendPasswordSetupEmail(user.email, user.name || user.email, token)
    }
  }
  return NextResponse.json({ ok: true })
}
