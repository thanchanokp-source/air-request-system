"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, fmt } from "../_StageWork"

const AIR_BREAKS = ["M", "N", "Q45", "Q100", "Q250", "Q300", "Q500", "Q1000", "Q2000", "Q8000"]
const SEA_CT = ["40GP", "20GP", "LCL"]

export default function PullRatesPage() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [tab, setTab] = useState<"air" | "sea">("air")
  const [air, setAir] = useState<any[]>([])
  const [sea, setSea] = useState<any[]>([])
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [a, s] = await Promise.all([
      fetch("/api/pull-material/air-rates").then(r => r.json()).catch(() => ({})),
      fetch("/api/pull-material/sea-rates").then(r => r.json()).catch(() => ({})),
    ])
    setAir(a.rows || []); setSea(s.rows || [])
  }
  useEffect(() => { load() }, [])

  const reload = async (which: "air" | "sea") => {
    if (!confirm(`Reload ${which.toUpperCase()} rates from the bundled Rate_LG data? This replaces the current ${which} master.`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${which}-rates`, { method: "POST" }).then(r => r.json())
      alert(r.ok ? `Loaded ${r.count} ${which} rows` : (r.error || "Failed"))
      await load()
    } finally { setBusy(false) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>

  const qq = q.trim().toLowerCase()
  const airRows = air.filter(r => !qq || `${r.origin} ${r.destination} ${r.fwd} ${r.airline}`.toLowerCase().includes(qq))
  const seaRows = sea.filter(r => !qq || `${r.country} ${r.port}`.toLowerCase().includes(qq))

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Master Rate — Pull Material</h1>
          <p className="text-sm text-gray-500">Freight rates by PORT (from Rate_LG). AIR = per kg by weight break · SEA = per container / CBM.</p></div>
        {isAdmin && (
          <button onClick={() => reload(tab)} disabled={busy} className="px-3 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
            {busy ? "..." : `↻ Reload ${tab.toUpperCase()} from file`}
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {([["air", `Air Rate (${air.length})`], ["sea", `Sea Rate (${sea.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-current" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            style={tab === k ? { color: MAROON, borderColor: MAROON } : undefined}>{label}</button>
        ))}
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === "air" ? "🔍 Search origin / airline / fwd…" : "🔍 Search country / port…"}
        className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      <div className="bg-white rounded-xl border overflow-x-auto">
        {tab === "air" ? (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["ORIGIN", "DEST", "FWD", "A/L", "TT", ...AIR_BREAKS].map(h =>
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {airRows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{r.origin}</td>
                  <td className="px-3 py-1.5">{r.destination}</td>
                  <td className="px-3 py-1.5">{r.fwd || "-"}</td>
                  <td className="px-3 py-1.5">{r.airline || "-"}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{r.tt || "-"}</td>
                  {AIR_BREAKS.map(b => <td key={b} className="px-3 py-1.5 text-right">{r.rates?.[b] != null ? fmt(r.rates[b]) : "-"}</td>)}
                </tr>
              ))}
              {airRows.length === 0 && <tr><td colSpan={5 + AIR_BREAKS.length} className="px-3 py-10 text-center text-gray-400">No air rates {air.length === 0 && "— click Reload to load from file"}</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["COUNTRY", "PORT", "40'GP (USD/CTR)", "20'GP (USD/CTR)", "LCL (USD/CBM)"].map(h =>
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {seaRows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 text-gray-600">{r.country}</td>
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{r.port}</td>
                  {SEA_CT.map(c => <td key={c} className="px-3 py-1.5 text-right">{r.rates?.[c] != null ? fmt(r.rates[c]) : "-"}</td>)}
                </tr>
              ))}
              {seaRows.length === 0 && <tr><td colSpan={2 + SEA_CT.length} className="px-3 py-10 text-center text-gray-400">No sea rates {sea.length === 0 && "— click Reload to load from file"}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
