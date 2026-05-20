"use client"
import { useEffect, useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, PieChart, Pie, Cell } from "recharts"
import { MultiSelect } from "@/components/ui/multi-select"

const EST_COLOR = "#60a5fa"
const ACTUAL_COLOR = "#10b981"
const REASON_COLOR = "#f59e0b"

const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "0"
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtK = (v: any) => { const n = Number(v); if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`; if (n >= 1000) return `${(n/1000).toFixed(0)}K`; return String(n) }
const fmtMonth = (ym: string) => { const [y, m] = ym.split("-"); const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${M[parseInt(m)-1]} ${y.slice(2)}` }

const STATUS_OPTIONS = ["PENDING_VP_MER","PENDING_SCM","PENDING_VP_SCM","PENDING_PRESIDENT","PENDING_LOGISTICS","PENDING_CLAIM","PENDING_VP_NYK","COMPLETED","REJECTED"]
const STATUS_LABELS: Record<string,string> = {
  PENDING_VP_MER:"Pending VP MER", PENDING_SCM:"Pending SCM", PENDING_VP_SCM:"Pending VP SCM",
  PENDING_PRESIDENT:"Pending President", PENDING_LOGISTICS:"Pending Logistics",
  PENDING_CLAIM:"Pending Claim", PENDING_VP_NYK:"Pending VP NYK", COMPLETED:"Completed", REJECTED:"Rejected"
}
const CLAIM_DEPTS = ["COMMERCIAL","PROCUREMENT","NYK","PRODUCTION"]
const PIE_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16","#94a3b8"]
const MONTH_OPTS = [
  { value: "01", label: "Jan" }, { value: "02", label: "Feb" }, { value: "03", label: "Mar" },
  { value: "04", label: "Apr" }, { value: "05", label: "May" }, { value: "06", label: "Jun" },
  { value: "07", label: "Jul" }, { value: "08", label: "Aug" }, { value: "09", label: "Sep" },
  { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" },
]

function SoCountPie({ data, title, subtitle }: { data: { name: string, value: number }[], title: string, subtitle?: string }) {
  const total = data.reduce((s, x) => s + x.value, 0)
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-semibold text-gray-600 mb-0.5">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mb-3">{subtitle}</p>}
      {data.length === 0
        ? <div className="h-[220px] flex items-center justify-center text-xs text-gray-300">No data</div>
        : <div className="flex items-center gap-4">
            <div className="shrink-0" style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} innerRadius={40}>
                    {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} SO`, "Count"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 overflow-hidden">
              {data.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs text-gray-700 flex-1 truncate min-w-0" title={d.name}>{d.name}</span>
                  <span className="text-xs font-semibold text-gray-800 shrink-0">{d.value} SO</span>
                  <span className="text-xs text-gray-400 w-9 text-right shrink-0">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
      }
    </div>
  )
}

function EstActualBar({ data, title, onBarClick, drillLabel, onBack }: {
  data: { name: string, est: number, actual: number }[]
  title: string
  onBarClick?: (name: string) => void
  drillLabel?: string
  onBack?: () => void
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600">{drillLabel ? `${title} › ${drillLabel} BY PORT` : title}</p>
        {onBack && <button onClick={onBack} className="text-xs text-blue-600 hover:underline">← All Countries</button>}
        {onBarClick && !onBack && <span className="text-xs text-gray-400">Click bar to drill down by port</span>}
      </div>
      {data.length === 0
        ? <div className="h-[250px] flex items-center justify-center text-xs text-gray-300">No data</div>
        : <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: 10, paddingBottom: 12 }} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtK} />
              <Tooltip formatter={(v: any, n: string) => [Number(v).toLocaleString(), n]} />
              <Bar dataKey="est" name="Est. (THB)" fill={EST_COLOR} radius={[3,3,0,0]}
                cursor={onBarClick ? "pointer" : undefined}
                onClick={(d: any) => onBarClick?.(d.name)} />
              <Bar dataKey="actual" name="Actual (THB)" fill={ACTUAL_COLOR} radius={[3,3,0,0]}
                cursor={onBarClick ? "pointer" : undefined}
                onClick={(d: any) => onBarClick?.(d.name)} />
            </BarChart>
          </ResponsiveContainer>
      }
    </div>
  )
}

export default function DashboardPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState("")
  const [monthFilter, setMonthFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [brandFilter, setBrandFilter] = useState("")
  const [soF, setSoF] = useState<string[]>([])
  const [cpF, setCpF] = useState<string[]>([])
  const [portFilter, setPortFilter] = useState("")
  const [countryFilter, setCountryFilter] = useState("")
  const [claimF, setClaimF] = useState<string[]>([])
  const [drillCountry, setDrillCountry] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => { setRequests(d); setLoading(false) })
  }, [])

  const allSOs = useMemo(() => requests.flatMap(r =>
    (r.items || []).map((item: any) => ({ ...item, request: r }))
  ), [requests])

  const filtered = useMemo(() => allSOs.filter(row => {
    const r = row.request
    const d = row.originalShipmentDate ? new Date(row.originalShipmentDate) : null
    const rowYear = d && !isNaN(d.getTime()) ? String(d.getFullYear()) : ""
    const rowMonth = d && !isNaN(d.getTime()) ? String(d.getMonth() + 1).padStart(2, "0") : ""
    return (!yearFilter || rowYear === yearFilter) &&
      (!monthFilter.length || monthFilter.includes(rowMonth)) &&
      (!statusFilter || r.status === statusFilter) &&
      (!brandFilter || r.brandName === brandFilter) &&
      (!soF.length || soF.includes(row.so)) &&
      (!cpF.length || cpF.includes(row.customerPO)) &&
      (!portFilter || row.port === portFilter) &&
      (!countryFilter || row.country === countryFilter) &&
      (!claimF.length || claimF.includes(row.claimDepartment))
  }), [allSOs, yearFilter, monthFilter, statusFilter, brandFilter, soF, cpF, portFilter, countryFilter, claimF])

  // KPI
  const totalSO = filtered.length
  const totalGW = filtered.reduce((s, r) => s + (r.grossWeight || 0), 0)
  const totalEst = filtered.reduce((s, r) => s + (r.airFreight || 0), 0)
  const totalActual = filtered.reduce((s, r) => s + (r.actualAirFreight || 0), 0)

  const buildChart = (rows: any[], key: (r: any) => string) => {
    const map: Record<string, { est: number, actual: number }> = {}
    rows.forEach(r => {
      const k = key(r) || "N/A"
      if (!map[k]) map[k] = { est: 0, actual: 0 }
      map[k].est += r.airFreight || 0
      map[k].actual += r.actualAirFreight || 0
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name, est: Math.round(v.est), actual: Math.round(v.actual) }))
      .sort((a, b) => b.est - a.est)
  }

  // Monthly summary — group by originalShipmentDate year-month
  const monthlyChart = useMemo(() => {
    const map: Record<string, { est: number, actual: number }> = {}
    filtered.forEach(r => {
      if (!r.originalShipmentDate) return
      const d = new Date(r.originalShipmentDate)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (!map[key]) map[key] = { est: 0, actual: 0 }
      map[key].est += r.airFreight || 0
      map[key].actual += r.actualAirFreight || 0
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ name: fmtMonth(key), est: Math.round(v.est), actual: Math.round(v.actual) }))
  }, [filtered])

  const claimChart = useMemo(() => buildChart(filtered, r => r.claimDepartment || "Unassigned"), [filtered])
  const brandChart = useMemo(() => buildChart(filtered, r => r.request.brandName), [filtered])
  const buChart = useMemo(() => buildChart(filtered, r => r.request.buName), [filtered])
  const countryChart = useMemo(() => buildChart(filtered, r => r.country), [filtered])
  const portDrillChart = useMemo(() => {
    if (!drillCountry) return []
    return buildChart(filtered.filter(r => r.country === drillCountry), r => r.port)
  }, [filtered, drillCountry])

  const buildPie = (rows: any[], key: (r: any) => string, top = 8) => {
    const map: Record<string, number> = {}
    rows.forEach(r => { const k = key(r) || "N/A"; map[k] = (map[k] || 0) + 1 })
    const sorted = Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    if (sorted.length <= top) return sorted
    const others = sorted.slice(top).reduce((s, i) => s + i.value, 0)
    return [...sorted.slice(0, top), { name: "Others", value: others }]
  }

  const descChart = useMemo(() => buildPie(filtered, r => r.description), [filtered])
  const brandCountChart = useMemo(() => buildPie(filtered, r => r.request.brandName), [filtered])
  const buCountChart = useMemo(() => buildPie(filtered, r => r.request.buName), [filtered])

  const reasonChart = useMemo(() => {
    const map: Record<string, { est: number, count: number }> = {}
    filtered.forEach(r => {
      const k = r.reasonDelay || "N/A"
      if (!map[k]) map[k] = { est: 0, count: 0 }
      map[k].est += r.airFreight || 0
      map[k].count += 1
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name, est: Math.round(v.est), count: v.count }))
      .sort((a, b) => b.est - a.est)
      .slice(0, 12)
  }, [filtered])

  // Filter options
  const years = useMemo(() => {
    const ys = new Set<string>()
    allSOs.forEach(r => {
      if (r.originalShipmentDate) {
        const y = new Date(r.originalShipmentDate).getFullYear()
        if (!isNaN(y)) ys.add(String(y))
      }
    })
    return [...ys].sort().reverse()
  }, [allSOs])
  const brands = [...new Set(requests.map(r => r.brandName).filter(Boolean))].sort()
  const sos = [...new Set(allSOs.map(r => r.so).filter(Boolean))].sort()
  const cps = [...new Set(allSOs.map(r => r.customerPO).filter(Boolean))].sort()
  const ports = [...new Set(allSOs.map(r => r.port).filter(Boolean))].sort()
  const countries = [...new Set(allSOs.map(r => r.country).filter(Boolean))].sort()

  const hasFilter = yearFilter || monthFilter.length || statusFilter || brandFilter || soF.length || cpF.length || portFilter || countryFilter || claimF.length
  const clearAll = () => { setYearFilter(""); setMonthFilter([]); setStatusFilter(""); setBrandFilter(""); setSoF([]); setCpF([]); setPortFilter(""); setCountryFilter(""); setClaimF([]) }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">DASHBOARD</h1>

      {/* KPI 4 boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ["TOTAL SO", totalSO, "text-blue-700", "bg-blue-50 border-blue-200"],
          ["GROSS WEIGHT (KG)", fmtNum(totalGW, 2), "text-purple-700", "bg-purple-50 border-purple-200"],
          ["EST. AIR FREIGHT (THB)", fmtNum(totalEst), "text-orange-700", "bg-orange-50 border-orange-200"],
          ["ACTUAL AIR FREIGHT (THB)", fmtNum(totalActual), "text-green-700", "bg-green-50 border-green-200"],
        ] as [string, any, string, string][]).map(([label, value, textColor, bg]) => (
          <div key={label} className={`${bg} border rounded-xl p-4`}>
            <p className="text-xs text-gray-500 leading-tight">{label}</p>
            <p className={`text-xl font-bold ${textColor} mt-1`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600">FILTERS</p>
          {hasFilter && <button onClick={clearAll} className="text-xs text-blue-600 hover:underline">Clear all</button>}
        </div>

        {/* Period row */}
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-500 w-14 shrink-0">PERIOD</span>
          <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setMonthFilter([]) }}
            className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm bg-blue-50 font-medium text-blue-700 focus:ring-1 focus:ring-blue-400">
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="w-52">
            <MultiSelect
              label="All Months"
              options={MONTH_OPTS.map(m => m.label)}
              value={monthFilter.map(v => MONTH_OPTS.find(m => m.value === v)?.label || v)}
              onChange={labels => setMonthFilter(labels.map(l => MONTH_OPTS.find(m => m.label === l)?.value || l))}
            />
          </div>
          {(yearFilter || monthFilter.length > 0) && (
            <span className="text-xs text-blue-600 font-medium">
              {yearFilter}{monthFilter.length ? ` · ${monthFilter.map(v => MONTH_OPTS.find(m => m.value === v)?.label).join(", ")}` : ""}
            </span>
          )}
        </div>

        {/* Other filters */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Brand</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <MultiSelect label="SO..." options={sos} value={soF} onChange={setSoF} />
          <MultiSelect label="Customer PO..." options={cps} value={cpF} onChange={setCpF} />
          <select value={portFilter} onChange={e => setPortFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Port</option>
            {ports.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Country</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <MultiSelect label="Claim Dept" options={CLAIM_DEPTS} value={claimF} onChange={setClaimF} />
        </div>
      </div>

      {/* Monthly Summary Chart */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs font-semibold text-gray-600 mb-1">MONTHLY SUMMARY — EST vs ACTUAL AIR FREIGHT (THB)</p>
        <p className="text-xs text-gray-400 mb-3">based on Original Shipment Date</p>
        {monthlyChart.length === 0
          ? <div className="h-[220px] flex items-center justify-center text-xs text-gray-300">No data{yearFilter ? ` for ${yearFilter}` : ""}</div>
          : <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyChart} margin={{ top: 0, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: 10, paddingBottom: 12 }} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtK} />
                <Tooltip formatter={(v: any, n: string) => [Number(v).toLocaleString(), n]} />
                <Bar dataKey="est" name="Est. (THB)" fill={EST_COLOR} radius={[3,3,0,0]} />
                <Bar dataKey="actual" name="Actual (THB)" fill={ACTUAL_COLOR} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
        }
      </div>

      {/* Charts 2x2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EstActualBar data={claimChart} title="BY CLAIM DEPT (THB)" />
        <EstActualBar data={brandChart} title="BY BRAND (THB)" />
        <EstActualBar
          data={drillCountry ? portDrillChart : countryChart}
          title="BY COUNTRY (THB)"
          drillLabel={drillCountry || undefined}
          onBarClick={!drillCountry ? (name) => setDrillCountry(name) : undefined}
          onBack={drillCountry ? () => setDrillCountry(null) : undefined}
        />
        <EstActualBar data={buChart} title="BY BU (THB)" />
      </div>

      {/* Delay Reason */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs font-semibold text-gray-600 mb-1">DELAY REASON — EST. AIR FREIGHT (THB)</p>
        <p className="text-xs text-gray-400 mb-3">entered by SCM · top 12 reasons</p>
        {reasonChart.length === 0
          ? <div className="h-[200px] flex items-center justify-center text-xs text-gray-300">No data</div>
          : <ResponsiveContainer width="100%" height={Math.max(280, reasonChart.length * 46)}>
              <BarChart data={reasonChart} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: 10, paddingBottom: 16 }} />
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={fmtK} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={200} />
                <Tooltip formatter={(v: any, n: string) => [Number(v).toLocaleString(), n]} />
                <Bar dataKey="est" name="Est. (THB)" fill={REASON_COLOR} radius={[0,3,3,0]}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 9, fill: "#6b7280" }} formatter={(v: any) => `${v} SO`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        }
      </div>

      {/* SO Count Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SoCountPie data={brandCountChart} title="BRAND — SO COUNT" />
        <SoCountPie data={buCountChart} title="BU — SO COUNT" />
        <SoCountPie data={descChart} title="DESCRIPTION — SO COUNT (TOP 8)" />
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex justify-between">
          <h2 className="font-semibold text-gray-800">DATA TABLE</h2>
          <span className="text-xs text-gray-400">{filtered.length} SO(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>{["DOC NO","SO","STYLE","DESCRIPTION","BRAND","BU","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)","ACTUAL FREIGHT (THB)","FACTORY","COUNTRY","PORT","CLAIM DEPT","DELAY REASON","STATUS"].map(h =>
                <th key={h} className="px-3 py-2 text-left text-gray-600 whitespace-nowrap font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={19} className="text-center py-10 text-gray-400">Loading...</td></tr>}
              {!loading && filtered.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">{row.request.documentNo}</td>
                  <td className="px-3 py-1.5 font-medium">{row.so}</td>
                  <td className="px-3 py-1.5">{row.style}</td>
                  <td className="px-3 py-1.5">{row.description}</td>
                  <td className="px-3 py-1.5">{row.request.brandName}</td>
                  <td className="px-3 py-1.5">{row.request.buName}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(row.originalShipmentDate)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(row.planShipmentDate)}</td>
                  <td className="px-3 py-1.5">{row.qtyOriginalShipment}</td>
                  <td className="px-3 py-1.5 font-semibold">{row.qtyRequestAir}</td>
                  <td className="px-3 py-1.5">{fmtNum(row.grossWeight, 2)}</td>
                  <td className="px-3 py-1.5 text-blue-700">{fmtNum(row.airFreight)}</td>
                  <td className="px-3 py-1.5 text-green-700 font-medium">{fmtNum(row.actualAirFreight)}</td>
                  <td className="px-3 py-1.5">{row.factory}</td>
                  <td className="px-3 py-1.5">{row.country}</td>
                  <td className="px-3 py-1.5">{row.port}</td>
                  <td className="px-3 py-1.5">{row.claimDepartment || "-"}</td>
                  <td className="px-3 py-1.5">{row.reasonDelay || "-"}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${row.request.status === "COMPLETED" ? "bg-green-100 text-green-700" : row.request.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {(STATUS_LABELS[row.request.status] || row.request.status).replace("Pending ", "")}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={19} className="text-center py-10 text-gray-400">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
