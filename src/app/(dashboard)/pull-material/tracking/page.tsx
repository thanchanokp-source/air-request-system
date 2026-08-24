"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL, buColor } from "../_StageWork"

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

  // Creator (or admin) can RECALL a document that hasn't been approved yet — withdraws it
  // from the flow (soft, non-destructive) instead of deleting.
  const recall = async (rq: any) => {
    const reason = prompt(`Recall ${rq.documentNo}\n\nEveryone who worked on it (Purchasing / LG / SCM) will be notified.\nEnter the reason for recall:`)
    if (reason === null) return
    if (!reason.trim()) { alert("A reason is required to recall."); return }
    setBusy(rq.id)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RECALLED", recallReason: reason.trim() }),
      })
      if (r.ok) await load()
      else { const d = await r.json().catch(() => ({})); alert(d.error || "Recall failed") }
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
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
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
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {["Document", "SO", "Items", "Progress", "Status", ""].map((h, i) =>
                    <th key={i} className={`px-4 py-2.5 font-medium whitespace-nowrap ${h === "Items" ? "text-center" : "text-left"}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map(rq => {
                  const idx = stepIdx(rq.status)
                  const noAir = rq.status === "NO_AIR"
                  const sos = [...new Set((rq.items || []).map((i: any) => i.soNoDoc).filter(Boolean))] as string[]
                  return (
                    <tr key={rq.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-blue-700">{rq.documentNo}</div>
                        <div className="text-[11px] text-gray-400">{rq.requesterName}</div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-[220px] truncate" title={sos.join(", ")}>{sos.join(", ") || "-"}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500">{rq.items.length}</td>
                      <td className="px-4 py-2.5">
                        {noAir ? <span className="text-xs text-gray-400">—</span> : (
                          <div className="flex items-center gap-1.5">
                            {FLOW.map((s, i) => (
                              <span key={s} title={STEP_SHORT[i]} className="w-2 h-2 rounded-full"
                                style={{ background: i < idx ? "#16a34a" : i === idx ? MAROON : "#e5e7eb" }} />
                            ))}
                            <span className="text-[11px] text-gray-500 ml-1">{STEP_SHORT[Math.min(idx, FLOW.length - 1)]}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span title={rq.status === "RECALLED" ? `Recalled by ${rq.recalledBy || "-"}: ${rq.recallReason || ""}` : undefined}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${rq.status === "RECALLED" ? "bg-orange-100 text-orange-700" : noAir ? "bg-gray-100 text-gray-600" : rq.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {STATUS_LABEL[rq.status] || rq.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {(isAdmin || rq.createdById === userId) && !["APPROVED", "COMPLETED", "RECALLED"].includes(rq.status) && (
                          <button onClick={() => recall(rq)} disabled={busy === rq.id} title="Recall (creator only)"
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-amber-700 hover:border-amber-300 disabled:opacity-50">↩ Recall</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
    </div>
  )
}
