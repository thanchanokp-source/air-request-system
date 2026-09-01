import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Server-side proxy: given a Google Sheets URL, download the whole workbook as .xlsx and stream the
// bytes back to the browser (avoids CORS). The client then parses it with the existing AIR/SEA importer.
// The sheet must be shared "Anyone with the link → Viewer" (otherwise Google returns an HTML login page).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const canEdit = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("LOGISTICS_IMPORT")))
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { url } = await req.json().catch(() => ({}))
  const m = String(url || "").match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!m) return NextResponse.json({ error: "ไม่ใช่ลิงก์ Google Sheets ที่ถูกต้อง" }, { status: 400 })
  const id = m[1]
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`

  let res: Response
  try {
    res = await fetch(exportUrl, { redirect: "follow" })
  } catch (e: any) {
    return NextResponse.json({ error: `Server เข้าถึง Google ไม่ได้ (${e?.message || "network"}) — เช็ค outbound internet` }, { status: 502 })
  }
  const ctype = res.headers.get("content-type") || ""
  // A public sheet returns the spreadsheet binary; a private one returns an HTML sign-in page.
  if (!res.ok || ctype.includes("text/html")) {
    return NextResponse.json({ error: "ดึงไฟล์ไม่ได้ — Sheet ต้องแชร์เป็น “ใครมีลิงก์ก็ดูได้ (Viewer)”" }, { status: 403 })
  }
  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `inline; filename="google_sheet_${id}.xlsx"`,
    },
  })
}
