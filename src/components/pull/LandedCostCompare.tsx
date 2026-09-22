"use client"
import { useMemo } from "react"
import { pullLandedCost, EXCHANGE_RATE, cheapestMode, ltDays, type ShipMode } from "@/lib/pull-courier"

// Shared LANDED-COST compare table (Air / Courier / Sea + Market) — every value in USD (rate 32.5).
// Used identically on the Purchase request form, the LG documents page and the Approval page so the
// three views can never disagree. Feed it the 4 rate masters (fetched once by the parent) + doc fields.
//
// SELECT MODE (approval / LG): pass `value` + `onChange` to turn the cards into a picker. The cheapest
// card is only a SUGGESTION — the document is always raised as an AIR request by the user, so the AIR
// card keeps a "ผู้ขอร้องขอ" badge and picking anything else raises a warning (+ reason, enforced by the
// parent page).
const MAROON = "#7a1f2b"
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type LandedInput = {
  airRows: any[]; seaRows: any[]; courierRows: any[]; truckRows: any[]
  port?: any; seaPort?: any; country?: any; weight?: any; incoterm?: any; bu?: any; factory?: any
}

export default function LandedCostCompare(p: LandedInput & {
  compact?: boolean
  value?: ShipMode | null            // selected mode — turns the cards into a picker
  onChange?: (m: ShipMode) => void   // omit → read-only, exactly as before
  requestedMode?: ShipMode           // what the user asked for (always AIR for RM REQ AIR)
  needDate?: any                     // in-house need date — used for the lead-time warning
  leadTimeAir?: any; leadTimeSea?: any
}) {
  const lc = useMemo(() => pullLandedCost(p), [p.airRows, p.seaRows, p.courierRows, p.truckRows, p.port, p.seaPort, p.country, p.weight, p.incoterm, p.bu, p.factory])
  if (!lc) return null
  const pick = p.onChange                       // picker mode on/off
  const requested: ShipMode = p.requestedMode || "AIR"
  // Card order per request: Air → Sea → Courier (DHL) → Market.
  const cols: any[] = [
    { key: "air", mode: "AIR", label: "✈️ Air", d: lc.air, accent: MAROON },
    { key: "sea", mode: "SEA", label: `🚢 Sea (LCL${lc.sea?.cbm ? ` · ${lc.sea.cbm} cbm` : ""})`, d: lc.sea, accent: "#0369a1" },
    { key: "courier", mode: "COURIER", label: "📦 Courier (DHL)", d: lc.courier, accent: "#b45309", over: lc.over },
    { key: "market", label: "📈 Market (Air)", d: null, accent: "#7c3aed", market: true },
  ]
  const rows: [string, string][] = [["Freight", "freight"], ["FCA / EX-WORK", "fca"], ["Shipping clear", "clear"], ["Local charge TH", "local"], ["Store / DO", "store"], ["Transport", "transport"]]
  const totals = cols.map(c => c.d?.total).filter((v): v is number => v != null && v > 0)
  const cheapest = totals.length ? Math.min(...totals) : null
  const cheapMode = cheapestMode(lc)
  // Lead-time check — only meaningful once LG has entered the L/T and Purchase the need date.
  const need = p.needDate ? new Date(p.needDate) : null
  const ltOf = (m: ShipMode) => (m === "AIR" ? ltDays(p.leadTimeAir) : m === "SEA" ? ltDays(p.leadTimeSea) : null)
  const etaOf = (m: ShipMode) => { const d = ltOf(m); if (d == null) return null; const t = new Date(); t.setDate(t.getDate() + d); return t }
  const sel = p.value || null
  const selEta = sel ? etaOf(sel) : null
  const lateDays = (need && selEta && !isNaN(need.getTime())) ? Math.ceil((selEta.getTime() - need.getTime()) / 86400000) : null
  const cell = (c: any, f: string) => { if (c.market) return <span className="text-gray-300">รอ</span>; const v = c.d ? c.d[f] : null; if (v == null) return <span className="text-gray-300">–</span>; return v > 0 ? fmt(v) : <span className="text-gray-300">–</span> }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-600">เปรียบเทียบต้นทุนขนส่ง (Landed cost) <span className="font-normal text-gray-400">· USD</span></span>
        <span className="text-[10px] text-gray-400">Rate {EXCHANGE_RATE} · TH charge เฉพาะ NYG</span>
      </div>

      {/* The document is an AIR request — the cheapest card is only a suggestion, never the intent. */}
      {pick && (
        <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold">✈️ ผู้ขอร้องขอ AIR</span>
          <span className="text-amber-700">เอกสารนี้เปิดมาเป็น RM REQ AIR — &ldquo;ถูกสุด&rdquo; เป็นเพียงคำแนะนำ</span>
          {need && !isNaN(need.getTime()) && <span className="text-amber-700">· Need date <b>{need.toLocaleDateString("en-GB")}</b></span>}
          {cheapMode && cheapMode !== requested && <span className="ml-auto text-amber-700">ถูกสุดคือ <b>{cheapMode}</b></span>}
        </div>
      )}

      {/* Old-style comparison CARDS — one box per mode, each with the full landed-cost breakdown. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cols.map(c => {
          const best = c.d?.total != null && c.d.total === cheapest
          const selectable = !!pick && !c.market && c.d?.total != null
          const isSel = !!pick && sel === c.mode
          return (
            <div key={c.key}
              role={selectable ? "button" : undefined} tabIndex={selectable ? 0 : undefined}
              onClick={selectable ? () => pick!(c.mode as ShipMode) : undefined}
              onKeyDown={selectable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick!(c.mode as ShipMode) } } : undefined}
              className={`rounded-xl border p-3 transition ${selectable ? "cursor-pointer hover:shadow-md" : ""} ${
                isSel ? "ring-2 ring-offset-1 border-transparent bg-white shadow-md" : best ? "ring-2 ring-emerald-300 border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"
              }`}
              style={isSel ? { ["--tw-ring-color" as any]: MAROON } : undefined}>
              <div className="text-xs font-semibold mb-1.5 flex items-center justify-between gap-1" style={{ color: c.accent }}>
                <span className="inline-flex items-center gap-1">
                  {pick && !c.market && (
                    <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${isSel ? "border-transparent" : "border-gray-300"}`} style={isSel ? { background: MAROON } : undefined} />
                  )}
                  {c.label}
                </span>
                {best && <span className="text-[10px] text-emerald-600 shrink-0">ถูกสุด</span>}
              </div>
              {pick && c.mode === requested && (
                <div className="mb-1.5 text-[9px] font-bold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 inline-block">ผู้ขอร้องขอ</div>
              )}
              <div className="space-y-0.5 text-[11px]">
                {rows.map(([label, f]) => (
                  <div key={f} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-medium text-gray-700 tabular-nums">{cell(c, f)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                  <span className="text-gray-600 font-semibold">Total <span className="text-[9px] font-normal text-gray-400">USD</span></span>
                  <span className={`font-bold tabular-nums ${isSel ? "" : best ? "text-emerald-700" : "text-gray-900"}`} style={isSel ? { color: MAROON } : undefined}>
                    {c.market ? <span className="text-gray-300 font-normal">รอ</span> : c.d?.total != null ? fmt(c.d.total) : (c.over ? <span className="text-gray-400 text-[10px] font-normal">&gt;100kg</span> : <span className="text-amber-600 text-[10px] font-normal">no master</span>)}
                  </span>
                </div>
                {pick && !c.market && ltOf(c.mode as ShipMode) != null && (
                  <div className="text-[10px] text-gray-400 pt-0.5">L/T {ltOf(c.mode as ShipMode)} วัน</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Picking anything other than what the user asked for → say it out loud (+ late warning). */}
      {pick && sel && sel !== requested && (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          <b>เลือก {sel} แทน {requested} ที่ผู้ขอร้องขอ</b> — ต้องระบุเหตุผล
          {lateDays != null && lateDays > 0 && <span> · ⏰ L/T ไม่ทัน need date ประมาณ <b>{lateDays} วัน</b></span>}
          {lateDays != null && lateDays <= 0 && <span> · ✓ L/T ยังทัน need date</span>}
        </div>
      )}

      <div className="text-[10px] text-gray-400 mt-1.5">* Transport = ค่ารถ→โรงงาน จาก Truck master (ตาม Factory + น้ำหนัก) · Market price กรอกทีหลัง</div>
    </div>
  )
}
