import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Per-browser maintenance bypass. Only an ADMIN can turn it on; it sets a cookie so that
// magic-link logins as ANY role IN THE SAME BROWSER also get past the maintenance screen
// (needed to test the full approval flow while the system is "closed" to real users).
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }
  const res = NextResponse.json({ ok: true, bypass: true })
  res.cookies.set("mtnc_bypass", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 })
  return res
}

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }
  const res = NextResponse.json({ ok: true, bypass: false })
  res.cookies.set("mtnc_bypass", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
  return res
}
