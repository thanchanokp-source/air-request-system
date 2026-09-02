"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL, fmt, buColor } from "../_StageWork"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { load() }, [bu]) // eslint-disable-line

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>

  const items = reqs.flatMap((r: any) => r.items || [])
  const totalDocs = reqs.length
  const totalItems = items.length
  const totalPullGarment = items.reduce((s, i) => s + (Number(i.pullGarment) || 0), 0)
  // Pull RM freight is priced in USD (air master rates are USD/kg).
  const est = items.reduce((s, i) => s + (Number(i.airFreightCost) || 0), 0)
  const act = items.reduce((s, i) => s + (Number(i.actualAir) || 0), 0)
  const variance = act - est
  const variancePct = est > 0 && act > 0 ? (variance / est) * 100 : null
  const costPerGarment = totalPullGarment > 0 ? est / totalPullGarment : 0

  // By status
  const byStatus: Record<string, number> = {}
  reqs.forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1 })

  // Regular vs Irregular
  const regular = reqs.filter((r: any) => r.mode === "REGULAR").length
  const irregular = totalDocs - regular

  // Air vs Sea decision (per material line)
  const airLines = items.filter((i: any) => i.airDecision === "AIR").length
  const noAirLines = items.filter((i: any) => i.airDecision && i.airDecision !== "AIR").length
  const undecided = totalItems - airLines - noAirLines

  // Top-5 by est air cost (brand / supplier / country)
  const topBy = (key: string) => {
    const m: Record<string, number> = {}
    items.forEach((i: any) => { const k = i[key] || null; if (k) m[k] = (m[k] || 0) + (Number(i.airFreightCost) || 0) })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }
  const topBrand = topBy("brand"), topVendor = topBy("vendorName"), topCountry = topBy("country")

  // Monthly trend (docs + est)
  const byMonth: Record<string, { docs: number; est: number }> = {}
  reqs.forEach((r: any) => {
    const d = new Date(r.createdAt); if (isNaN(d.getTime())) return
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!byMonth[k]) byMonth[k] = { docs: 0, est: 0 }
    byMonth[k].docs++
    byMonth[k].est += (r.items || []).reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
  })
  const monthly = Object.entries(byMonth).sort()
  const maxMonthEst = Math.max(1, ...monthly.map(([, v]) => v.est))

  const cards = [
    { label: "Total documents", value: fmt(totalDocs), color: "#1e3a8a" },
    { label: "Material lines", value: fmt(totalItems), color: "#6b1a1a" },
    { label: "Total Pull (garment)", value: fmt(totalPullGarment), color: "#a04020" },
    { label: "Est Air Freight (USD)", value: fmt(Math.round(est)), color: "#0369a1" },
    { label: "Actual Air Freight (USD)", value: fmt(Math.round(act)), color: "#16a34a" },
    {
      label: "Variance (Act − Est)", value: variancePct == null ? "—" : `${variance >= 0 ? "▲" : "▼"} ${fmt(Math.abs(Math.round(variance)))} (${Math.abs(variancePct).toFixed(0)}%)`,
      color: variance > 0 ? "#dc2626" : "#16a34a",
    },
    { label: "Cost / garment (USD)", value: costPerGarment ? costPerGarment.toFixed(2) : "—", color: "#7c3aed" },
  ]

  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="flex-1 bg-gray-100 rounded-full h-3.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: color }} /></div>
  )
  const TopCard = ({ title, rows }: { title: string; rows: [string, number][] }) => {
    const max = Math.max(1, ...rows.map(([, v]) => v))
    return (
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">{title}</p>
        {rows.length === 0 ? <p className="text-sm text-gray-300">No data</p> : (
          <div className="space-y-2">
            {rows.map(([name, v]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-28 truncate" title={name}>{name}</span>
                <Bar pct={(v / max) * 100} color={MAROON} />
                <span className="text-xs font-semibold text-gray-700 w-16 text-right tabular-nums">{fmt(Math.round(v))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Dashboard — Pull Material</h1>
        <p className="text-sm text-gray-500">มูลค่า / สถิติการดึงวัสดุทางอากาศ · freight = USD</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : totalDocs === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">ยังไม่มีเอกสารใน BU นี้</div>
      ) : (
        <>
          {/* A · KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {cards.map(c => (
              <div key={c.label} className="bg-white rounded-xl border p-4">
                <div className="text-xl font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[11px] text-gray-500 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* C · By status funnel */}
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Pipeline — by status</p>
              {Object.keys(byStatus).length === 0 ? <p className="text-sm text-gray-400">No data</p> : (
                <div className="space-y-2">
                  {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                    <div key={s} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-44 truncate" title={STATUS_LABEL[s] || s}>{STATUS_LABEL[s] || s}</span>
                      <Bar pct={(n / totalDocs) * 100} color={MAROON} />
                      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* C · Mode + Air/Sea */}
            <div className="bg-white rounded-xl border p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Mode</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg p-3 bg-green-50 border border-green-200">
                    <div className="text-lg font-bold text-green-700">{regular}</div>
                    <div className="text-[11px] text-green-700">🟢 Regular (ไม่ต้องรออนุมัติ)</div>
                  </div>
                  <div className="flex-1 rounded-lg p-3 bg-amber-50 border border-amber-200">
                    <div className="text-lg font-bold text-amber-700">{irregular}</div>
                    <div className="text-[11px] text-amber-700">🟠 Irregular (อนุมัติเต็ม)</div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Air vs Sea decision (material lines)</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg p-3 bg-sky-50 border border-sky-200"><div className="text-lg font-bold text-sky-700">{airLines}</div><div className="text-[11px] text-sky-700">✈ AIR</div></div>
                  <div className="flex-1 rounded-lg p-3 bg-gray-50 border border-gray-200"><div className="text-lg font-bold text-gray-600">{noAirLines}</div><div className="text-[11px] text-gray-500">🚢 NO AIR</div></div>
                  <div className="flex-1 rounded-lg p-3 bg-gray-50 border border-gray-200"><div className="text-lg font-bold text-gray-400">{undecided}</div><div className="text-[11px] text-gray-400">ยังไม่ตัดสิน</div></div>
                </div>
              </div>
            </div>
          </div>

          {/* B · Top by cost */}
          <div className="grid md:grid-cols-3 gap-3">
            <TopCard title="Top brand — by Est Air (USD)" rows={topBrand as [string, number][]} />
            <TopCard title="Top supplier — by Est Air (USD)" rows={topVendor as [string, number][]} />
            <TopCard title="Top country — by Est Air (USD)" rows={topCountry as [string, number][]} />
          </div>

          {/* D · Monthly trend */}
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Monthly — documents &amp; Est Air (USD)</p>
            {monthly.length === 0 ? <p className="text-sm text-gray-300">No data</p> : (
              <div className="flex items-end gap-3 h-40 overflow-x-auto pb-1">
                {monthly.map(([m, v]) => (
                  <div key={m} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                    <span className="text-[10px] text-gray-500 tabular-nums">{fmt(Math.round(v.est))}</span>
                    <div className="w-8 rounded-t" style={{ height: `${(v.est / maxMonthEst) * 100}%`, minHeight: 4, background: MAROON }} />
                    <span className="text-[10px] text-gray-400">{m.slice(2)}</span>
                    <span className="text-[10px] text-blue-600 font-medium">{v.docs} doc</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
