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
  // req.url host is localhost under `next start`; build redirects from APP_URL instead.
  const BASE = process.env.APP_URL || req.nextUrl.origin
  if (!session || (!isAdmin && !impersonator)) {
    return NextResponse.redirect(new URL("/login", BASE))
  }
  const role = (req.nextUrl.searchParams.get("role") || "").trim()
  const bu = (req.nextUrl.searchParams.get("bu") || "").trim()
  const userId = (req.nextUrl.searchParams.get("userId") || "").trim()

  let target: any = null
  if (userId) {
    // View as a SPECIFIC person → see exactly their pages/queue (their BU, claim dept, assignments).
    target = await (prisma.user as any).findFirst({ where: { id: userId, isActive: true } })
    if (!target) return NextResponse.redirect(new URL(`/approvals?impersonate_error=${encodeURIComponent("User not found or inactive")}`, BASE))
  } else {
    if (!role) return NextResponse.json({ error: "role or userId required" }, { status: 400 })
    // First active holder of the role (+ BU for BU-specific roles; SCM_NYK_* are cross-BU).
    const where: any = { isActive: true, OR: [{ role }, { roles: { has: role } }] }
    if (bu && bu !== "ALL" && !role.startsWith("SCM_NYK")) where.bu = { in: [bu, "ALL"] }
    target = await (prisma.user as any).findFirst({ where, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] })
    if (!target) {
      return NextResponse.redirect(new URL(`/approvals?impersonate_error=${encodeURIComponent(`No user with role ${role}${bu ? " ("+bu+")" : ""}`)}`, BASE))
    }
  }

  // Remember the ORIGINAL admin (only on the first hop; keep it while switching roles).
  const adminId = isAdmin ? (session.user as any).id : impersonator
  const loginToken = crypto.randomUUID()
  await prisma.user.update({ where: { id: target.id }, data: { loginToken, loginTokenExpiry: new Date(Date.now() + 4 * 60 * 60 * 1000) } as any })

  // Land on the role-appropriate home (mirror src/app/page.tsx): Pull RM roles → Pull Material,
  // Logistics → LG Booking, else the claim approvals queue.
  const tRoles: string[] = [target.role, ...((target.roles as string[]) || [])].filter(Boolean)
  const pullHome = tRoles.includes("PURCHASING") ? "/pull-material/purchase"
    : tRoles.includes("SCM_PULL") ? "/pull-material/request"
    : tRoles.includes("LOGISTICS_IMPORT") ? "/pull-material/logistics"
    : (tRoles.includes("PULL_DVM_SCM") || tRoles.includes("DVM_PUR") || tRoles.includes("VP_PUR")) ? "/pull-material/approval" : null
  const isLg = tRoles.some(r => ["LOGISTICS", "LOGISTICS_SUB", "LOGISTICS_GW", "LOGISTICS_TRM"].includes(r))
  const home = pullHome || (isLg ? "/logistics" : "/approvals")
  const res = NextResponse.redirect(new URL(`/api/magic-login?token=${loginToken}&redirect=${encodeURIComponent(home)}`, BASE))
  res.cookies.set("impersonator", adminId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 4 * 60 * 60 })
  return res
}
