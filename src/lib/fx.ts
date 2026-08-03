import { prisma } from "./prisma"

// Currency conversion for EA. Freight is stored/computed in THB across ALL BUs (unchanged); EA
// simply displays amounts in VND via a snapshot factor. The two exchange rates below live in
// AppSetting (edited on the Master Rate page):
//   fx_thb_per_usd — used to convert an EA rate quoted in USD/kg into THB at import time
//   fx_vnd_per_usd — with the above, gives VND-per-THB for the EA display toggle
export const FX_KEYS = { thbPerUsd: "fx_thb_per_usd", vndPerUsd: "fx_vnd_per_usd" } as const

export type Fx = { thbPerUsd: number; vndPerUsd: number; vndPerThb: number }

export async function getFx(): Promise<Fx> {
  const rows = await (prisma as any).appSetting.findMany({ where: { key: { in: [FX_KEYS.thbPerUsd, FX_KEYS.vndPerUsd] } } })
  const map: Record<string, number> = {}
  for (const r of rows) map[r.key] = parseFloat(r.value) || 0
  const thbPerUsd = map[FX_KEYS.thbPerUsd] || 0
  const vndPerUsd = map[FX_KEYS.vndPerUsd] || 0
  const vndPerThb = thbPerUsd > 0 ? vndPerUsd / thbPerUsd : 0
  return { thbPerUsd, vndPerUsd, vndPerThb }
}

export async function setFx(thbPerUsd: number, vndPerUsd: number): Promise<void> {
  await (prisma as any).appSetting.upsert({ where: { key: FX_KEYS.thbPerUsd }, update: { value: String(thbPerUsd) }, create: { key: FX_KEYS.thbPerUsd, value: String(thbPerUsd) } })
  await (prisma as any).appSetting.upsert({ where: { key: FX_KEYS.vndPerUsd }, update: { value: String(vndPerUsd) }, create: { key: FX_KEYS.vndPerUsd, value: String(vndPerUsd) } })
}
