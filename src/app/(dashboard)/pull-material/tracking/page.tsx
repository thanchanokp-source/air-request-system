"use client"

import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL, buColor } from "../_StageWork"

const FLOW = ["PENDING_PURCHASING", "PENDING_LOGISTICS", "PENDING_SCM_DECISION", "PENDING_APPROVAL", "APPROVED"]
const STEP_SHORT = ["Purchasing", "LG", "SCM", "Approve", "Done"]

export default function Page() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const isScmPull = roles.includes("SCM_PULL")
  const isPurchasing = roles.includes("PURCHASING")
  const isLgImport = roles.includes("LOGISTICS_IMPORT")
  const canUse = isAdmin || isScmPull || isPurchasing || isLgImport
  // Who may see BOTH types (with the tab): admin, LG (handles both), or a person holding both roles.
  // A pure SCM / pure Purchasing user sees ONLY their own request type.
  const canSeeBoth = isAdmin || isLgImport || (isScmPull && isPurchasing)
  const userId = (session?.user as any)?.id
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [statusF, setStatusF] = useState("")
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING">("ALL")
  const [pdfing, setPdfing] = useState<string | null>(null)

  // Download the document PDF (available once LG has entered the actual air freight).
  const downloadPdf = async (rq: any) => {
    setPdfing(rq.id)
    try {
      const [{ pdf }, { PullMaterialPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/pull-material-pdf")])
      const blob = await pdf(React.createElement(PullMaterialPdf, { req: rq }) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `${rq.documentNo}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) { console.error(e); alert("PDF generation failed") } finally { setPdfing(null) }
  }

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

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
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Pull RM / Admin only</p></div>

  const stepIdx = (s: string) => FLOW.indexOf(s === "COMPLETED" ? "APPROVED" : s)

  // Filter by search (doc no / SO) + status.
  const qq = q.trim().toLowerCase()
  // Non-admin single-role users are locked to their own request type; only "canSeeBoth" uses the tab.
  const effType: "ALL" | "SCM" | "PURCHASING" = canSeeBoth ? typeF : (isPurchasing ? "PURCHASING" : isScmPull ? "SCM" : "ALL")
  const shown = reqs.filter(rq => {
    if (effType !== "ALL" && (rq.requestType || "SCM") !== effType) return false
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

      {/* Request type tab — only for admin / LG / dual-role. Pure SCM or PC users are auto-locked. */}
      {canSeeBoth && (
      <div className="flex gap-1.5">
        {([["ALL", "ทั้งหมด"], ["SCM", "SCM request"], ["PURCHASING", "Purchasing request"]] as const).map(([v, label]) => {
          const n = v === "ALL" ? reqs.length : reqs.filter(r => (r.requestType || "SCM") === v).length
          return (
            <button key={v} onClick={() => setTypeF(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${typeF === v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
              style={typeF === v ? { background: MAROON } : undefined}>{label} <span className="opacity-70">({n})</span></button>
          )
        })}
      </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search SO / document no…"
          className="flex-1 min-w-[240px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">All statuses</option>
          {Object.keys(STATUS_LABEL).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {(q || statusF || typeF !== "ALL") && <button onClick={() => { setQ(""); setStatusF(""); setTypeF("ALL") }} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg">Clear</button>}
        <span className="text-xs text-gray-400">{shown.length} / {reqs.length}</span>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        shown.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">{reqs.length === 0 ? "No documents yet" : "No documents match the filter"}</div> :
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {["Document", "SO", "Items", "Progress", "Status", "Files", ""].map((h, i) =>
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
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {(rq.attachments || []).length === 0 ? <span className="text-xs text-gray-300">—</span> : (
                          <div className="flex flex-col gap-0.5">
                            {(rq.attachments || []).map((a: any) => (
                              <a key={a.id} href={`/api/pull-material/attachments/${a.id}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:underline max-w-[180px] truncate" title={a.fileName}>
                                📎 {a.fileName}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {["APPROVED", "COMPLETED"].includes(rq.status) && (
                          <button onClick={() => downloadPdf(rq)} disabled={pdfing === rq.id} title="Download document PDF"
                            className="text-xs px-2.5 py-1 rounded-lg text-white disabled:opacity-50 mr-1" style={{ background: MAROON }}>{pdfing === rq.id ? "…" : "↓ PDF"}</button>
                        )}
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
