"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL } from "../_StageWork"

const FLOW = ["PENDING_PURCHASING", "PENDING_LOGISTICS", "PENDING_SCM_DECISION", "PENDING_APPROVAL", "APPROVED"]
const STEP_SHORT = ["Purchasing", "LG", "SCM", "Approve", "Done"]

export default function Page() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const userId = (session?.user as any)?.id
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [statusF, setStatusF] = useState("")

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line

  const del = async (rq: any) => {
    if (!confirm(`Delete ${rq.documentNo}? This cannot be undone.`)) return
    setBusy(rq.id)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, { method: "DELETE" })
      if (r.ok) await load()
      else { const d = await r.json().catch(() => ({})); alert(d.error || "Delete failed") }
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Under testing (Admin only)</p></div>

  const stepIdx = (s: string) => FLOW.indexOf(s === "COMPLETED" ? "APPROVED" : s)

  // Filter by search (doc no / SO) + status.
  const qq = q.trim().toLowerCase()
  const shown = reqs.filter(rq => {
    if (statusF && rq.status !== statusF) return false
    if (!qq) return true
    if (rq.documentNo.toLowerCase().includes(qq)) return true
    return (rq.items || []).some((i: any) => String(i.soNoDoc || "").toLowerCase().includes(qq))
  })

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Tracking Document — Pull Material</h1>
        <p className="text-sm text-gray-500">Track every document · SCM decides air / no-air at the &quot;Pending SCM Decision&quot; stage</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: MAROON } : undefined}>{b}</button>
      ))}</div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search SO / document no…"
          className="flex-1 min-w-[240px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">All statuses</option>
          {Object.keys(STATUS_LABEL).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {(q || statusF) && <button onClick={() => { setQ(""); setStatusF("") }} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg">Clear</button>}
        <span className="text-xs text-gray-400">{shown.length} / {reqs.length}</span>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        shown.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">{reqs.length === 0 ? "No documents yet" : "No documents match the filter"}</div> :
          shown.map(rq => {
            const idx = stepIdx(rq.status)
            const noAir = rq.status === "NO_AIR"
            return (
              <div key={rq.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                      <span className="text-xs text-gray-500"> · {rq.requesterName} · {rq.items.length} items</span></div>
                    <div className="text-xs text-gray-500 mt-0.5">SO: <span className="text-gray-700">{[...new Set((rq.items || []).map((i: any) => i.soNoDoc).filter(Boolean))].join(", ") || "-"}</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${noAir ? "bg-gray-100 text-gray-600" : rq.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {STATUS_LABEL[rq.status] || rq.status}
                    </span>
                    {(isAdmin || rq.createdById === userId) && (
                      <button onClick={() => del(rq)} disabled={busy === rq.id} title="Delete (creator only)"
                        className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 disabled:opacity-50">🗑 Delete</button>
                    )}
                  </div>
                </div>

                {!noAir && (
                  <div className="mt-3 flex items-center gap-1">
                    {FLOW.map((s, i) => (
                      <div key={s} className="flex items-center flex-1">
                        <div className={`flex-1 text-center text-[10px] py-1 rounded ${i < idx ? "bg-green-50 text-green-700" : i === idx ? "text-white" : "bg-gray-50 text-gray-400"}`}
                          style={i === idx ? { background: MAROON } : undefined}>{STEP_SHORT[i]}{i < idx ? " ✓" : ""}</div>
                        {i < FLOW.length - 1 && <span className="text-gray-300 px-0.5">›</span>}
                      </div>
                    ))}
                  </div>
                )}

                {rq.status === "PENDING_SCM_DECISION" && (
                  <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    Waiting for SCM decision at <span className="font-semibold">SCM REQUEST → Send Approve</span>
                  </div>
                )}
              </div>
            )
          })}
    </div>
  )
}
