import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSettings, setSetting } from "@/lib/settings"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Unauthorized", status: 401 }
  if ((session.user as any).role !== "ADMIN") return { error: "Forbidden", status: 403 }
  return { ok: true }
}

export async function GET() {
  const gate = await requireAdmin()
  if (!("ok" in gate)) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const s = await getSettings()
  return NextResponse.json({
    testEmailOverride: s.testEmailOverride || "",
    maintenanceMode: s.maintenanceMode === "on",
  })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!("ok" in gate)) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const body = await req.json().catch(() => ({}))
  try {
    if (typeof body.testEmailOverride === "string") {
      await setSetting("testEmailOverride", body.testEmailOverride.trim())
    }
    if (typeof body.maintenanceMode === "boolean") {
      await setSetting("maintenanceMode", body.maintenanceMode ? "on" : "off")
    }
    const s = await getSettings()
    return NextResponse.json({
      testEmailOverride: s.testEmailOverride || "",
      maintenanceMode: s.maintenanceMode === "on",
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save settings" }, { status: 500 })
  }
}
