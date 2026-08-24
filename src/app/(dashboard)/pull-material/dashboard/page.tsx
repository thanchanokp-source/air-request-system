"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL, fmt, buColor } from "../_StageWork"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Under testing (Admin only)</p></div>

  const items = reqs.flatMap((r: any) => r.items || [])
  const totalDocs = reqs.length
  const totalItems = items.length
  const totalAirCost = items.reduce((s, i) => s + (Number(i.airFreightCost) || 0), 0)
  const totalPullGarment = items.reduce((s, i) => s + (Number(i.pullGarment) || 0), 0)
  const byStatus: Record<string, number> = {}
  reqs.forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1 })

  const cards = [
    { label: "Total documents", value: fmt(totalDocs), color: "#1e3a8a" },
    { label: "Material lines", value: fmt(totalItems), color: "#6b1a1a" },
    { label: "Total Pull (garment)", value: fmt(totalPullGarment), color: "#a04020" },
    { label: "Total Air Freight (THB)", value: fmt(Math.round(totalAirCost)), color: "#16a34a" },
  ]

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Dashboard — Pull Material</h1>
        <p className="text-sm text-gray-500">Value / statistics of material pulls</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map(c => (
              <div key={c.label} className="bg-white rounded-xl border p-4">
                <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-xs text-gray-500 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">By status</p>
            {Object.keys(byStatus).length === 0 ? <p className="text-sm text-gray-400">No data yet</p> : (
              <div className="space-y-2">
                {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-40">{STATUS_LABEL[s] || s}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(n / totalDocs) * 100}%`, background: MAROON }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-8 text-right">{n}</span>
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
