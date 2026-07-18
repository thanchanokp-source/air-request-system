import { NextRequest, NextResponse } from "next/server"
import { notifyLgPendingReminder, sendWeeklyStuckAlerts } from "@/lib/notify"

// Weekly Monday 08:00 ICT reminder (Vercel Cron, see vercel.json). Two parts:
//  1) Logistics: docs still missing Actual Air Freight.
//  2) Every approver: a digest of docs waiting on THEM + how many days each is stuck.
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is configured.
export const maxDuration = 60
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const lg = await notifyLgPendingReminder().catch((e: any) => ({ error: e?.message }))
    const stuck = await sendWeeklyStuckAlerts().catch((e: any) => ({ error: e?.message }))
    return NextResponse.json({ ok: true, lg, stuck })
  } catch (e: any) {
    console.error("[cron] weekly reminder error:", e)
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 })
  }
}
