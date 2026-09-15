"use client"
import { useMemo } from "react"
import { pullLandedCost, EXCHANGE_RATE } from "@/lib/pull-courier"

// Shared LANDED-COST compare table (Air / Courier / Sea + Market) — every value in USD (rate 32.5).
// Used identically on the Purchase request form, the LG documents page and the Approval page so the
// three views can never disagree. Feed it the 4 rate masters (fetched once by the parent) + doc fields.
const MAROON = "#7a1f2b"
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type LandedInput = {
  airRows: any[]; seaRows: any[]; courierRows: any[]; truckRows: any[]
  port?: any; seaPort?: any; country?: any; weight?: any; incoterm?: any; bu?: any; factory?: any
}

export default function LandedCostCompare(p: LandedInput & { compact?: boolean }) {
  const lc = useMemo(() => pullLandedCost(p), [p.airRows, p.seaRows, p.courierRows, p.truckRows, p.port, p.seaPort, p.country, p.weight, p.incoterm, p.bu, p.factory])
  if (!lc) return null
  const cols: any[] = [
    { key: "air", label: "✈️ Air", d: lc.air, accent: MAROON },
    { key: "courier", label: "📦 Courier (DHL)", d: lc.courier, accent: "#b45309", over: lc.over },
    { key: "sea", label: `🚢 Sea (LCL${lc.sea?.cbm ? ` · ${lc.sea.cbm} cbm` : ""})`, d: lc.sea, accent: "#0369a1" },
    { key: "market", label: "📈 Market (Air)", d: null, accent: "#7c3aed", market: true },
  ]
  const rows: [string, string][] = [["Freight", "freight"], ["FCA / EX-WORK", "fca"], ["Shipping clear", "clear"], ["Local charge TH", "local"], ["Store / DO", "store"], ["Transport", "transport"]]
  const totals = cols.map(c => c.d?.total).filter((v): v is number => v != null && v > 0)
  const cheapest = totals.length ? Math.min(...totals) : null
  const cell = (c: any, f: string) => { if (c.market) return <span className="text-gray-300">รอ</span>; const v = c.d ? c.d[f] : null; if (v == null) return c.over ? <span className="text-[10px] text-gray-400">&gt;100kg</span> : <span className="text-amber-600 text-[10px]">no master</span>; return v > 0 ? fmt(v) : <span className="text-gray-300">–</span> }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-600">เปรียบเทียบต้นทุนขนส่ง (Landed cost) <span className="font-normal text-gray-400">· USD</span></span>
        <span className="text-[10px] text-gray-400">Rate {EXCHANGE_RATE} · TH charge เฉพาะ NYG</span>
      </div>
      <table className="w-full text-[11px] min-w-[440px]">
        <thead><tr className="text-gray-400">
          <th className="text-left font-medium py-1"></th>
          {cols.map(c => { const best = c.d?.total != null && c.d.total === cheapest; return <th key={c.key} className="text-right font-semibold py-1 px-2" style={{ color: c.accent }}>{c.label}{best && <span className="ml-1 text-[9px] text-emerald-600">ถูกสุด</span>}</th> })}
        </tr></thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={f} className="border-t border-gray-50">
              <td className="text-gray-500 py-1">{label}</td>
              {cols.map(c => <td key={c.key} className="text-right py-1 px-2 text-gray-700 tabular-nums">{cell(c, f)}</td>)}
            </tr>
          ))}
          <tr className="border-t border-gray-200 font-bold">
            <td className="text-gray-800 py-1.5">Total <span className="text-[9px] font-normal text-gray-400">USD</span></td>
            {cols.map(c => { const best = c.d?.total != null && c.d.total === cheapest; return <td key={c.key} className={`text-right py-1.5 px-2 tabular-nums ${best ? "text-emerald-700" : "text-gray-900"}`}>{c.market ? <span className="text-gray-300 font-normal">รอ</span> : c.d?.total != null ? <>{fmt(c.d.total)} <span className="text-[9px] font-normal text-gray-400">USD</span></> : (c.over ? <span className="text-[10px] text-gray-400 font-normal">&gt;100kg</span> : <span className="text-amber-600 text-[10px] font-normal">no master</span>)}</td> })}
          </tr>
        </tbody>
      </table>
      <div className="text-[10px] text-gray-400 mt-1.5">* Transport = ค่ารถ→โรงงาน จาก Truck master (ตาม Factory + น้ำหนัก) · Market price กรอกทีหลัง</div>
    </div>
  )
}
