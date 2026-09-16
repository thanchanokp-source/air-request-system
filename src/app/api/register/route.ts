import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { sendVerificationEmail } from "@/lib/notify"

// Self-register role depends on BOTH the position AND the BU: a Merchandise person in GW is
// MER_GW (not MER_USER, which is NYG). Getting this wrong makes a GW user register as NYG.
function resolveRole(position: string, bu: string): string | null {
  if (position === "ACCOUNTING") return "ACCOUNTING" // cross-BU (both NYG & GW)
  // "DPM Merchandise" behaves exactly like Merchandise → same BU-based MER role.
  if (position === "MER" || position === "DPM_MER") return bu === "GW" ? "MER_GW" : bu === "EA" ? "MER_EA" : bu === "TRM" ? "MER_TRM" : "MER_USER"
  // Pull Material roles are cross-BU (BU chosen per document, not per account).
  if (["MER_PULL", "PURCHASING", "SCM_PULL", "LOGISTICS_IMPORT", "DVM_PUR", "VP_PUR", "PULL_DVM_SCM"].includes(position)) return position
  if (position === "VISITOR") return "VISITOR" // read-only viewer (all BU, no actions)
  return null
}

export async function POST(req: NextRequest) {
  const { name, email, password, bu, position } = await req.json()

  if (!email || !password || !bu || !position) {
    return NextResponse.json({ error: "Please fill in all required fields" }, { status: 400 })
  }

  if (!email.toLowerCase().endsWith("@nanyangtextile.com")) {
    return NextResponse.json({ error: "A company email is required (@nanyangtextile.com)" }, { status: 400 })
  }

  if (bu !== "NYG" && bu !== "GW" && bu !== "EA" && bu !== "TRM" && bu !== "ALL") {
    return NextResponse.json({ error: "Invalid BU" }, { status: 400 })
  }
  const role = resolveRole(position, bu)
  if (!role) {
    return NextResponse.json({ error: "Invalid position" }, { status: 400 })
  }

  // Self-registration is gated by the company-email domain + email verification (account is
  // created isActive:false and only activates after the verification link). We do NOT require
  // the LAN People directory here — EA / overseas staff are not in it, and the decision is to
  // rely on the master + admin, not the People Finder.

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }

  const normalEmail = email.toLowerCase()

  const existing = await (prisma.user as any).findUnique({ where: { email: normalEmail } })
  if (existing) {
    if (existing.isActive) {
      return NextResponse.json({ error: "This email is already registered" }, { status: 409 })
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
      // Pull Material roles → flag as a Pull RM user so they show in Pull RM user management.
      ...(["MER_PULL", "PURCHASING", "SCM_PULL", "LOGISTICS_IMPORT", "DVM_PUR", "VP_PUR"].includes(role) ? { pullRm: true } : {}),
      // "DPM Merchandise" behaves as MER but shows a distinct display label.
      ...(position === "DPM_MER" ? { title: "DPM Merchandise" } : {}),
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
