import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase().trim()
  // `all=1` (optional bu) → list active users without a name query so the picker
  // can show a scrollable dropdown before the user types. Otherwise require q.
  const listAll = req.nextUrl.searchParams.get("all") === "1"
  const buParam = (req.nextUrl.searchParams.get("bu") || "").trim()
  if (!q && !listAll) return NextResponse.json([])

  const results: { name: string; email: string | null; dept: string; bu: string; pos: string; role: string; roles?: string[]; priority?: number | null; claimDepartment?: string | null; procurementType?: string | null }[] = []

  // 1) App users (same DB — always reachable, incl. on Vercel/cloud).
  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        // Match the requested BU OR a cross-BU (ALL) person — so people who serve both
        // BUs (e.g. the shared SCM NYK team set bu=ALL) appear in either BU's picker.
        ...(buParam ? { bu: { in: [buParam, "ALL"] } } : {}),
        ...(q ? { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ] } : {}),
      },
      select: { name: true, email: true, role: true, roles: true, bu: true, priority: true, claimDepartment: true, procurementType: true } as any,
      orderBy: { name: "asc" },
      take: listAll ? 300 : 30,
    })
    for (const u of users as any[]) {
      results.push({ name: u.name || u.email, email: u.email, dept: u.role || "", bu: u.bu || "", pos: u.role || "", role: u.role || "", roles: Array.isArray(u.roles) ? u.roles : [], priority: u.priority ?? null, claimDepartment: u.claimDepartment ?? null, procurementType: u.procurementType ?? null })
    }
  } catch {
    // ignore — fall through to directory
  }

  // 2) Nan Yang People Directory (LAN People Finder) — DISABLED by decision:
  // every approver must be set up in master, and all pickers search master ONLY.
  // (Kept import/branch off so we can re-enable later if needed.)
  // if (q) try { ... fetchPeopleList() ... } catch {}

  // Dedupe by email (fallback to name), cap at 30.
  const seen = new Set<string>()
  const out: typeof results = []
  for (const r of results) {
    const key = (r.email || r.name || "").toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(r)
    if (out.length >= (listAll ? 300 : 30)) break
  }

  return NextResponse.json(out)
}
