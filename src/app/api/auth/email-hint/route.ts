import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Login-page email autocomplete. Returns active users' emails that START WITH the typed text
// (≥ 2 chars, capped). Unauthenticated on purpose (used before login). Seeing an email grants
// no access — a password or a magic link sent to the @nanyangtextile.com inbox is still required.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase()
  if (q.length < 2) return NextResponse.json([])
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, email: { startsWith: q, mode: "insensitive" } },
      select: { email: true },
      take: 6,
      orderBy: { email: "asc" },
    })
    return NextResponse.json(users.map(u => u.email))
  } catch {
    return NextResponse.json([])
  }
}
