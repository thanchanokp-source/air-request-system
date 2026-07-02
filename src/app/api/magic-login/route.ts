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
  const byClaimNext  = byVpMer || byPresident || byScm || byVpScm || byLogistics || byAccounting ? null : await (prisma.airRequest as any).findFirst({ where: { claimNextToken: token } })

  console.log("[magic-login] matched:", byVpMer ? "vpMer" : byGm ? "gm" : byPresident ? "president" : byScm ? "scm" : byVpScm ? "vpScm" : byLogistics ? "logistics" : byAccounting ? "accounting" : byClaimNext ? "claimNext" : "none")

  if (!byVpMer && !byGm && !byPresident && !byScm && !byVpScm && !byLogistics && !byAccounting && !byClaimNext) {
    console.log("[magic-login] token not found")
    return NextResponse.redirect(new URL("/login?error=invalid-token", req.url))
  }

  const finalRedirect = byClaimNext ? redirectTo : "/approvals"

  // Hand off to client-side page which calls signIn() via NextAuth
  const magicAuthUrl = new URL("/magic-auth", req.url)
  magicAuthUrl.searchParams.set("token", token)
  magicAuthUrl.searchParams.set("redirect", finalRedirect)
  return NextResponse.redirect(magicAuthUrl)
}
