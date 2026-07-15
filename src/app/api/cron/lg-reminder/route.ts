import { NextRequest, NextResponse } from "next/server"
import { notifyLgPendingReminder } from "@/lib/notify"

// Weekly Monday reminder to Logistics about documents still missing their data
// (Actual Air Freight not entered). Triggered by Vercel Cron (see vercel.json).
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is configured.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await notifyLgPendingReminder()
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error("[cron] lg-reminder error:", e)
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 })
  }
}
