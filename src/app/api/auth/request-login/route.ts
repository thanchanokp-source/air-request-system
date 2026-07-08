import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendLoginLinkEmail } from "@/lib/notify"
import crypto from "crypto"

// Passwordless login: user enters their email → we email a one-time login link.
// No admin, no password, no registration — the account already exists in master.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || "").toLowerCase().trim()

  // Always respond ok (never reveal whether an email exists / is active).
  if (email.endsWith("@nanyangtextile.com")) {
    const user = await (prisma.user as any).findUnique({ where: { email } })
    if (user && user.isActive) {
      const token = crypto.randomUUID()
      const expiry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      await (prisma.user as any).update({ where: { id: user.id }, data: { loginToken: token, loginTokenExpiry: expiry } })
      await sendLoginLinkEmail(user.email, user.name || user.email, token)
    }
  }
  return NextResponse.json({ ok: true })
}
