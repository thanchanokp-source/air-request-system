import { prisma } from "./prisma"

// Lightweight cached access to the AppSetting key-value table. Cache avoids a DB hit on
// every outgoing email; 15s TTL keeps toggles near-instant. Falls back gracefully if the
// table doesn't exist yet (e.g. before the migration is run).
let cache: { at: number; map: Record<string, string> } | null = null
const TTL_MS = 15000

export async function getSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map
  try {
    const rows = await (prisma as any).appSetting.findMany()
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    cache = { at: Date.now(), map }
    return map
  } catch {
    return cache?.map ?? {}
  }
}

export async function getSetting(key: string): Promise<string | null> {
  return (await getSettings())[key] ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await (prisma as any).appSetting.upsert({
    where: { key }, create: { key, value }, update: { value },
  })
  cache = null // invalidate so the change takes effect immediately
}

// All outgoing mail is redirected here when set (DB toggle wins over the env fallback).
export async function getEmailOverride(): Promise<string> {
  const db = await getSetting("testEmailOverride")
  return (db && db.trim()) || process.env.TEST_EMAIL_OVERRIDE || ""
}

// When on, non-admin users see a maintenance screen instead of the app.
export async function isMaintenance(): Promise<boolean> {
  return (await getSetting("maintenanceMode")) === "on"
}
