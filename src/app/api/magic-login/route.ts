import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const redirectTo = req.nextUrl.searchParams.get("redirect") || "/dashboard"

  console.log("[magic-login] token:", token?.slice(0, 8), "redirect:", redirectTo)

  if (!token) {
    console.log("[magic-login] no token")
    return NextResponse.redirect(new URL("/login?error=missing-token", req.url))
  }

  // Validate token — check all token types in order
  const byVpMer      = await (prisma.airRequest as any).findFirst({ where: { vpMerToken: token } })
  const byGm         = byVpMer ? null : await (prisma.airRequest as any).findFirst({ where: { gmToken: token } })
  const byPresident  = byVpMer || byGm ? null : await (prisma.airRequest as any).findFirst({ where: { presidentToken: token } })
  const byScm        = byVpMer || byPresident ? null : await (prisma.airRequest as any).findFirst({ where: { scmToken: token } })
  const byVpScm      = byVpMer || byPresident || byScm ? null : await (prisma.airRequest as any).findFirst({ where: { vpScmToken: token } })
  const byLogistics  = byVpMer || byPresident || byScm || byVpScm ? null : await (prisma.airRequest as any).findFirst({ where: { logisticsToken: token } })
  const byAccounting = byVpMer || byPresident || byScm || byVpScm || byLogistics ? null : await (prisma.airRequest as any).findFirst({ where: { accountingToken: token } })
  const byClaimGw    = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting ? null : await (prisma.airRequest as any).findFirst({ where: { claimGwToken: token } })
  const byClaimSup   = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw ? null : await (prisma.airRequest as any).findFirst({ where: { claimSupplierToken: token } })
  const byScmNykAppr = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw || byClaimSup ? null : await (prisma.airRequest as any).findFirst({ where: { scmNykApproverToken: token } })
  const byScmNykEvp  = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw || byScmNykAppr ? null : await (prisma.airRequest as any).findFirst({ where: { scmNykEvpToken: token } })
  const byScmNyk     = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw || byScmNykAppr || byScmNykEvp ? null : await (prisma.airRequest as any).findFirst({ where: { scmNykToken: token } })
  const byScmNyg     = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw || byScmNykAppr || byScmNykEvp || byScmNyk ? null : await (prisma.airRequest as any).findFirst({ where: { scmNygToken: token } })
  const byClaimNext  = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw || byScmNykAppr || byScmNykEvp || byScmNyk || byScmNyg ? null : await (prisma.airRequest as any).findFirst({ where: { claimNextToken: token } })
  // Per-department forward token (ClaimForward)
  const byClaimFwd   = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw || byScmNykAppr || byScmNykEvp || byScmNyk || byScmNyg || byClaimNext ? null : await (prisma as any).claimForward.findFirst({ where: { token } })
  // Logistics handoff token (a senior LG forwarded data-entry to a subordinate)
  const byLgFwd      = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw || byScmNykAppr || byScmNykEvp || byScmNyk || byScmNyg || byClaimNext || byClaimFwd ? null : await (prisma.airRequest as any).findFirst({ where: { lgForwardToken: token } })
  // Passwordless account login link (User.loginToken)
  const byLoginToken = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting || byClaimGw || byScmNykAppr || byScmNykEvp || byScmNyk || byScmNyg || byClaimNext || byClaimFwd || byLgFwd ? null : await (prisma.user as any).findFirst({ where: { loginToken: token } })

  console.log("[magic-login] matched:", byVpMer ? "vpMer" : byGm ? "gm" : byPresident ? "president" : byScm ? "scm" : byVpScm ? "vpScm" : byLogistics ? "logistics" : byAccounting ? "accounting" : byClaimGw ? "claimGw" : byClaimSup ? "claimSupplier" : byScmNykAppr ? "scmNykApprover" : byScmNykEvp ? "scmNykEvp" : byScmNyk ? "scmNyk" : byScmNyg ? "scmNyg" : byClaimNext ? "claimNext" : byClaimFwd ? "claimForward" : byLgFwd ? "lgForward" : "none")

  if (!byVpMer && !byGm && !byPresident && !byScm && !byVpScm && !byLogistics && !byAccounting && !byClaimGw && !byClaimSup && !byScmNykAppr && !byScmNykEvp && !byScmNyk && !byScmNyg && !byClaimNext && !byClaimFwd && !byLgFwd && !byLoginToken) {
    console.log("[magic-login] token not found")
    return NextResponse.redirect(new URL("/login?error=invalid-token", req.url))
  }

  const finalRedirect = byLoginToken ? (redirectTo || "/dashboard") : byLgFwd ? `/requests/${byLgFwd.id}` : byLogistics ? "/logistics" : byClaimNext || byClaimFwd ? (byClaimFwd ? `/requests/${byClaimFwd.requestId}` : redirectTo) : "/approvals"

  // Hand off to client-side page which calls signIn() via NextAuth
  const magicAuthUrl = new URL("/magic-auth", req.url)
  magicAuthUrl.searchParams.set("token", token)
  const asParam = req.nextUrl.searchParams.get("as")   // per-recipient identity
  if (asParam) magicAuthUrl.searchParams.set("as", asParam)
  magicAuthUrl.searchParams.set("redirect", finalRedirect)
  return NextResponse.redirect(magicAuthUrl)
}
