import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// Return to the original admin after impersonating. Reads the httpOnly `impersonator` cookie
// (the admin's id), logs back in as that admin via a fresh loginToken, and clears the cookie.
export async function GET(req: NextRequest) {
  const adminId = req.cookies.get("impersonator")?.value
  if (!adminId) return NextResponse.redirect(new URL("/dashboard", req.url))
  const admin = await prisma.user.findUnique({ where: { id: adminId } })
  if (!admin) {
    const bad = NextResponse.redirect(new URL("/login", req.url))
    bad.cookies.set("impersonator", "", { path: "/", maxAge: 0 })
    return bad
  }
  const loginToken = crypto.randomUUID()
  await prisma.user.update({ where: { id: adminId }, data: { loginToken, loginTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) } as any })
  const res = NextResponse.redirect(new URL(`/api/magic-login?token=${loginToken}&redirect=/dashboard`, req.url))
  res.cookies.set("impersonator", "", { path: "/", maxAge: 0 })
  return res
}
