"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL, fmt, buColor } from "../_StageWork"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING">("ALL")
  // Branch of a doc: requestType, falling back to the documentNo prefix (PULL_… = Purchasing, else SCM).
  const reqTypeOf = (r: any) => (r.requestType === "PURCHASING" || String(r.documentNo || "").toUpperCase().startsWith("PULL")) ? "PURCHASING" : "SCM"

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { load() }, [bu]) // eslint-disable-line

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>

  // Apply the SCM / Purchasing filter to every metric below.
  const fReqs = typeF === "ALL" ? reqs : reqs.filter((r: any) => reqTypeOf(r) === typeF)
  const items = fReqs.flatMap((r: any) => r.items || [])
  const totalDocs = fReqs.length
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
  fReqs.forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1 })

  // Regular vs Irregular
  const regular = fReqs.filter((r: any) => r.mode === "REGULAR").length
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

  // Monthly trend (docs + Est + Actual)
  const byMonth: Record<string, { docs: number; est: number; act: number }> = {}
  fReqs.forEach((r: any) => {
    const d = new Date(r.createdAt); if (isNaN(d.getTime())) return
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!byMonth[k]) byMonth[k] = { docs: 0, est: 0, act: 0 }
    byMonth[k].docs++
    byMonth[k].est += (r.items || []).reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
    byMonth[k].act += Number(r.actualAir) || 0
  })
  const monthly = Object.entries(byMonth).sort()
  const maxMonthEst = Math.max(1, ...monthly.flatMap(([, v]) => [v.est, v.act]))

  // Spend by BU (Est + Actual) for the BU-split bars.
  const byBu: Record<string, { est: number; act: number }> = {}
  fReqs.forEach((r: any) => {
    const b = r.bu || "NYG"; const e = (byBu[b] ||= { est: 0, act: 0 })
    e.est += (r.items || []).reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
    e.act += Number(r.actualAir) || 0
  })
  const buRows = Object.entries(byBu).sort((a, b) => b[1].est - a[1].est)
  const maxBuEst = Math.max(1, ...buRows.map(([, v]) => v.est))
  const dstr = (v: any) => (v ? new Date(v).toLocaleDateString("en-GB") : "-")
  const TABLE_COLS = ["Doc No", "BU", "สาย", "จัดซื้อ", "PO", "Country", "Port", "Incoterm", "Wt(kg)", "Factory", "ETC", "Est USD", "MAWB", "HAWB", "ETD", "ETA", "Pre cost", "Actual", "Local", "CFM in-house", "Status"]

  // OVER BUDGET (Actual > Est) attributed to brand / vendor. A doc's Actual is per-doc, so it's split
  // across its lines by each line's Est share, then summed per brand & per vendor. Only docs with both
  // Est and Actual entered count; only groups that ended up over budget are shown.
  const overBy = (key: "brand" | "vendorName") => {
    const m: Record<string, { est: number; act: number }> = {}
    fReqs.forEach((r: any) => {
      const its = r.items || []
      const docEst = its.reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
      const docAct = Number(r.actualAir) || 0
      if (!docEst || !docAct) return
      its.forEach((i: any) => {
        const k = i[key]; if (!k) return
        const e = Number(i.airFreightCost) || 0
        const g = (m[k] ||= { est: 0, act: 0 })
        g.est += e; g.act += docAct * (e / docEst)
      })
    })
    return Object.entries(m).map(([name, v]) => ({ name, est: v.est, act: v.act, diff: v.act - v.est }))
      .filter(x => x.diff > 0.5).sort((a, b) => b.diff - a.diff).slice(0, 6)
  }
  const overBrand = overBy("brand"), overVendor = overBy("vendorName")
  const overTotal = overBrand.reduce((s, x) => s + x.diff, 0)

  const cards = [
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

      {/* Branch filter — every metric below reflects the chosen branch (SCM vs Purchasing) */}
      <div className="flex gap-2 border-b border-gray-200">
        {([["ALL", "📁 ทั้งหมด"], ["SCM", "🧾 SCM"], ["PURCHASING", "🛒 จัดซื้อ"]] as const).map(([v, label]) => {
          const n = v === "ALL" ? reqs.length : reqs.filter((r: any) => reqTypeOf(r) === v).length
          return (
            <button key={v} onClick={() => setTypeF(v)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${typeF === v ? "" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              style={typeF === v ? { color: MAROON, borderColor: MAROON } : undefined}>
              {label}<span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500">{n}</span>
            </button>
          )
        })}
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : totalDocs === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">ยังไม่มีเอกสารใน BU นี้</div>
      ) : (
        <>
          {/* A · KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map(c => (
              <div key={c.label} className="bg-white rounded-xl border p-4">
                <div className="text-xl font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[11px] text-gray-500 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          {/* A · OVER BUDGET (Actual > Est) — by brand & vendor */}
          {(overBrand.length > 0 || overVendor.length > 0) && (() => {
            const OverList = ({ title, rows }: { title: string; rows: { name: string; est: number; act: number; diff: number }[] }) => (
              <div className="flex-1 min-w-[260px]">
                <p className="text-[11px] font-semibold text-gray-500 uppercase mb-2">{title}</p>
                {rows.length === 0 ? <p className="text-sm text-gray-300">ไม่มีที่เกินงบ 🎉</p> : (
                  <div className="space-y-1.5">
                    {rows.map(x => {
                      const pct = x.est > 0 ? (x.diff / x.est) * 100 : 0
                      return (
                        <div key={x.name} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                          <span className="text-sm text-gray-800 truncate" title={x.name}>{x.name}</span>
                          <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full shrink-0 ${pct >= 15 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>+${fmt(Math.round(x.diff))} (+{pct.toFixed(0)}%)</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
            return (
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">⚠ เกินงบ (Actual &gt; Est) — เจาะตามแบรนด์ / ผู้ขาย</p>
                  <span className="text-xs font-bold text-red-700 tabular-nums">รวม +${fmt(Math.round(overTotal))}</span>
                </div>
                <div className="flex gap-6 flex-wrap">
                  <OverList title="🏷️ ตามแบรนด์ (Brand)" rows={overBrand} />
                  <OverList title="🏭 ตามผู้ขาย (Vendor)" rows={overVendor} />
                </div>
                <p className="text-[11px] text-gray-400 mt-3">* Actual ต่อเอกสารถูกกระจายเข้าแต่ละบรรทัดตามสัดส่วน Est แล้วรวมตามแบรนด์/ผู้ขาย · นับเฉพาะเอกสารที่กรอก Actual แล้ว</p>
              </div>
            )
          })()}

          {/* A · Actual vs Est monthly + spend by BU (the Control-Tower core) */}
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase">Actual vs Est — รายเดือน (USD)</p>
                <div className="flex gap-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#c99aa2" }} />Est</span>
                  <span className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: MAROON }} />Actual</span>
                </div>
              </div>
              {monthly.length === 0 ? <p className="text-sm text-gray-300">No data</p> : (
                <div className="flex items-end gap-4 h-44 overflow-x-auto pb-1">
                  {monthly.map(([m, v]) => (
                    <div key={m} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 60 }}>
                      <div className="flex items-end gap-1 h-32">
                        <div className="w-5 rounded-t" title={`Est ${fmt(Math.round(v.est))}`} style={{ height: `${(v.est / maxMonthEst) * 100}%`, minHeight: 3, background: "#c99aa2" }} />
                        <div className="w-5 rounded-t" title={`Actual ${fmt(Math.round(v.act))}`} style={{ height: `${(v.act / maxMonthEst) * 100}%`, minHeight: v.act > 0 ? 3 : 0, background: MAROON }} />
                      </div>
                      <span className="text-[10px] text-gray-400">{m.slice(2)}</span>
                      <span className="text-[10px] text-blue-600 font-medium">{v.docs} doc</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">ต้นทุนตาม BU (Est · USD)</p>
              {buRows.length === 0 ? <p className="text-sm text-gray-300">No data</p> : (
                <div className="space-y-2.5">
                  {buRows.map(([b, v]) => (
                    <div key={b} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700 w-10">{b}</span>
                      <Bar pct={(v.est / maxBuEst) * 100} color={MAROON} />
                      <span className="text-xs font-semibold text-gray-700 w-16 text-right tabular-nums">{fmt(Math.round(v.est))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* B · Top by cost */}
          <div className="grid md:grid-cols-3 gap-3">
            <TopCard title="Top brand — by Est Air (USD)" rows={topBrand as [string, number][]} />
            <TopCard title="Top supplier — by Est Air (USD)" rows={topVendor as [string, number][]} />
            <TopCard title="Top country — by Est Air (USD)" rows={topCountry as [string, number][]} />
          </div>

          {/* E · Data table — every field entered by SCM / จัดซื้อ / LG (one row per document) */}
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">ตารางข้อมูลทั้งหมด (SCM · จัดซื้อ · LG) — {fReqs.length} เอกสาร</p>
            <div className="overflow-x-auto">
              <table className="text-xs whitespace-nowrap min-w-[1500px] w-full">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>{TABLE_COLS.map(h => <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fReqs.map((r: any) => {
                    const its = r.items || []
                    const d0 = its.find((i: any) => i.airFreightCost != null) || its[0] || {}
                    const est = its.reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
                    const po = [...new Set(its.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-semibold text-gray-800">{r.documentNo}</td>
                        <td className="px-2 py-1.5">{r.bu}</td>
                        <td className="px-2 py-1.5">{reqTypeOf(r) === "PURCHASING" ? "จัดซื้อ" : "SCM"}</td>
                        <td className="px-2 py-1.5">{r.requesterName || "-"}</td>
                        <td className="px-2 py-1.5 max-w-[160px] truncate" title={po}>{po || "-"}</td>
                        <td className="px-2 py-1.5">{d0.country || "-"}</td>
                        <td className="px-2 py-1.5">{d0.port || d0.seaPort || "-"}</td>
                        <td className="px-2 py-1.5">{d0.incoterm || "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{d0.weight != null ? fmt(d0.weight) : "-"}</td>
                        <td className="px-2 py-1.5">{r.factory || d0.factory || "-"}</td>
                        <td className="px-2 py-1.5">{dstr(d0.etc)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: MAROON }}>{est ? fmt(Math.round(est)) : "-"}</td>
                        <td className="px-2 py-1.5">{r.mawbNo || "-"}</td>
                        <td className="px-2 py-1.5">{r.hawbNo || "-"}</td>
                        <td className="px-2 py-1.5">{dstr(r.flightEtd)}</td>
                        <td className="px-2 py-1.5">{dstr(r.flightEta)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.preCost != null ? fmt(r.preCost) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.actualAir != null ? fmt(r.actualAir) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.localChargeTh != null ? fmt(r.localChargeTh) : "-"}</td>
                        <td className="px-2 py-1.5">{dstr(r.cfmInHouseDate)}</td>
                        <td className="px-2 py-1.5">{STATUS_LABEL[r.status] || r.status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}
    </div>
  )
}
