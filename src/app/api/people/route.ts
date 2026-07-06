import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { fetchPeopleList } from "@/lib/people"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase().trim()
  if (!q) return NextResponse.json([])

  const results: { name: string; email: string | null; dept: string; bu: string; pos: string }[] = []

  // 1) App users (same DB — always reachable, incl. on Vercel/cloud).
  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { name: true, email: true, role: true, bu: true },
      take: 30,
    })
    for (const u of users) {
      results.push({ name: u.name || u.email, email: u.email, dept: (u as any).role || "", bu: (u as any).bu || "", pos: (u as any).role || "" })
    }
  } catch {
    // ignore — fall through to directory
  }

  // 2) Nan Yang People Directory (LAN-only host — best-effort; unreachable from cloud).
  try {
    const all = await fetchPeopleList()
    for (const p of all) {
      const name = (p.NA_EN || p.NA_TH || "").toLowerCase()
      const mail = (p.MAIL || "").toLowerCase()
      const dept = (p.DEPT || "").toLowerCase()
      if (name.includes(q) || mail.includes(q) || dept.includes(q)) {
        results.push({ name: p.NA_EN || p.NA_TH || "", email: p.MAIL || null, dept: p.DEPT || "", bu: p.BU || "", pos: p.POS_EN || "" })
      }
    }
  } catch {
    // directory unreachable (e.g. on Vercel) — app users above still returned
  }

  // Dedupe by email (fallback to name), cap at 30.
  const seen = new Set<string>()
  const out: typeof results = []
  for (const r of results) {
    const key = (r.email || r.name || "").toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(r)
    if (out.length >= 30) break
  }

  return NextResponse.json(out)
}
