import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// Admin "View as" — log in AS an active user of the chosen role+BU, so the admin sees that
// role's pages/queue and can act, WITHOUT logging in/out. An httpOnly `impersonator` cookie
// remembers the admin so they can switch roles freely and return. Reuses the loginToken magic
// login. Allowed if the current session is ADMIN, or the impersonator cookie is set (a switch
// while already impersonating — the cookie proves it started from an admin).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const impersonator = req.cookies.get("impersonator")?.value
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  if (!session || (!isAdmin && !impersonator)) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
  const role = (req.nextUrl.searchParams.get("role") || "").trim()
  const bu = (req.nextUrl.searchParams.get("bu") || "").trim()
  const userId = (req.nextUrl.searchParams.get("userId") || "").trim()

  let target: any = null
  if (userId) {
    // View as a SPECIFIC person → see exactly their pages/queue (their BU, claim dept, assignments).
    target = await (prisma.user as any).findFirst({ where: { id: userId, isActive: true } })
    if (!target) return NextResponse.redirect(new URL(`/approvals?impersonate_error=${encodeURIComponent("User not found or inactive")}`, req.url))
  } else {
    if (!role) return NextResponse.json({ error: "role or userId required" }, { status: 400 })
    // First active holder of the role (+ BU for BU-specific roles; SCM_NYK_* are cross-BU).
    const where: any = { isActive: true, OR: [{ role }, { roles: { has: role } }] }
    if (bu && bu !== "ALL" && !role.startsWith("SCM_NYK")) where.bu = { in: [bu, "ALL"] }
    target = await (prisma.user as any).findFirst({ where, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] })
    if (!target) {
      return NextResponse.redirect(new URL(`/approvals?impersonate_error=${encodeURIComponent(`No user with role ${role}${bu ? " ("+bu+")" : ""}`)}`, req.url))
    }
  }

  // Remember the ORIGINAL admin (only on the first hop; keep it while switching roles).
  const adminId = isAdmin ? (session.user as any).id : impersonator
  const loginToken = crypto.randomUUID()
  await prisma.user.update({ where: { id: target.id }, data: { loginToken, loginTokenExpiry: new Date(Date.now() + 4 * 60 * 60 * 1000) } as any })

  const res = NextResponse.redirect(new URL(`/api/magic-login?token=${loginToken}&redirect=/approvals`, req.url))
  res.cookies.set("impersonator", adminId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 4 * 60 * 60 })
  return res
}
