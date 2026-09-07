import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { readdirSync, copyFileSync, writeFileSync, existsSync, statSync } from "fs"
import path from "path"

export const runtime = "nodejs"

// ADMIN-ONLY: pull the live template files from a source folder into the app's public/ folder,
// then bump template-meta.json so every MER sees "template updated — download latest".
// Source folder is configurable via env TEMPLATE_SOURCE_DIR (so it works on the machine that
// actually runs the app). Default = the dev clone path.
const DEFAULT_SRC = "C:\\Projects\\Air_req_clone\\air-request-system\\public"

export async function POST() {
  const session = await getServerSession(authOptions)
  const roles = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  if (!session || !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const src = process.env.TEMPLATE_SOURCE_DIR || DEFAULT_SRC
  const dest = path.join(process.cwd(), "public")

  if (!existsSync(src)) {
    return NextResponse.json({ error: `ไม่พบโฟลเดอร์ต้นทาง: ${src}\n(ตั้งค่า env TEMPLATE_SOURCE_DIR ให้ชี้โฟลเดอร์ที่มีไฟล์เทมเพลตบนเครื่องที่รันแอป)` }, { status: 400 })
  }

  const copied: string[] = []
  const skipped: string[] = []
  try {
    for (const f of readdirSync(src)) {
      if (!/^air-request-template_.+\.xlsx$/i.test(f)) continue
      try {
        const s = path.join(src, f)
        if (!statSync(s).isFile()) continue
        copyFileSync(s, path.join(dest, f))
        copied.push(f)
      } catch (e: any) {
        skipped.push(`${f}: ${e?.message || "error"}`)
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: `อ่านโฟลเดอร์ต้นทางไม่ได้: ${e?.message || "error"}` }, { status: 400 })
  }

  if (copied.length === 0) {
    return NextResponse.json({ error: `ไม่พบไฟล์ air-request-template_*.xlsx ใน ${src}`, skipped }, { status: 400 })
  }

  // Bump the version banner so MERs re-download.
  const today = new Date().toISOString().slice(0, 10)
  try {
    writeFileSync(path.join(dest, "template-meta.json"), JSON.stringify({ updatedAt: today, note: "Bumped by admin template refresh." }) + "\n")
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, source: src, copied, skipped, updatedAt: today })
}
