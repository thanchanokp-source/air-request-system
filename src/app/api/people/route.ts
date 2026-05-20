import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const PEOPLE_API = "http://172.16.9.89:8080/info/people.php/getList"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase().trim()
  if (!q) return NextResponse.json([])

  try {
    const res = await fetch(PEOPLE_API, { method: "POST" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const all: any[] = Array.isArray(data) ? data : []

    const filtered = all
      .filter(p => {
        const name = (p.NA_EN || p.NA_TH || "").toLowerCase()
        const mail = (p.MAIL || "").toLowerCase()
        return name.includes(q) || mail.includes(q)
      })
      .slice(0, 20)
      .map(p => ({
        name: p.NA_EN || p.NA_TH || "",
        email: p.MAIL || "",
        dept: p.DEPT || "",
        bu: p.BU || "",
      }))

    return NextResponse.json(filtered)
  } catch {
    return NextResponse.json({ error: "ไม่สามารถเชื่อมต่อ People Directory ได้" }, { status: 503 })
  }
}
