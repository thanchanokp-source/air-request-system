import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { fetchPeopleList } from "@/lib/people"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase().trim()
  if (!q) return NextResponse.json([])

  try {
    const all = await fetchPeopleList()

    const filtered = all
      .filter(p => {
        const name = (p.NA_EN || p.NA_TH || "").toLowerCase()
        const mail = (p.MAIL || "").toLowerCase()
        const dept = (p.DEPT || "").toLowerCase()
        return name.includes(q) || mail.includes(q) || dept.includes(q)
      })
      .slice(0, 30)
      .map(p => ({
        name: p.NA_EN || p.NA_TH || "",
        email: p.MAIL || null,
        dept: p.DEPT || "",
        bu: p.BU || "",
        pos: p.POS_EN || "",
      }))

    return NextResponse.json(filtered)
  } catch {
    return NextResponse.json({ error: "ไม่สามารถเชื่อมต่อ People Directory ได้" }, { status: 503 })
  }
}
