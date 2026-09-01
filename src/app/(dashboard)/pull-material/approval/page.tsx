"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"

// Approver stages: which role owns each, and where Approve / Send-back go.
const APPROVER: Record<string, { role: string; label: string; next: string; back: string; backLabel: string }> = {
  PENDING_DVM_SCM:  { role: "PULL_DVM_SCM",   label: "DVM SCM",        next: "PENDING_VP_SCM",  back: "PENDING_SCM_DECISION", backLabel: "Send back to SCM" },
  PENDING_VP_SCM:   { role: "VP_SCM",         label: "VP SCM",         next: "PENDING_FINAL",   back: "PENDING_DVM_SCM",      backLabel: "Send back to DVM SCM" },
  PENDING_FINAL:    { role: "PULL_PRESIDENT", label: "Final approval", next: "APPROVED",        back: "PENDING_VP_SCM",       backLabel: "Send back to VP SCM" },
  PENDING_DVM_PUR:  { role: "DVM_PUR",        label: "DVM Purchasing", next: "PENDING_VP_PUR",  back: "PENDING_PC_DECISION",  backLabel: "Send back to Purchase" },
  PENDING_VP_PUR:   { role: "VP_PUR",         label: "VP Purchasing",  next: "APPROVED",        back: "PENDING_DVM_PUR",      backLabel: "Send back to DVM Pur" },
  PENDING_APPROVAL: { role: "ADMIN",          label: "Approval (legacy)", next: "APPROVED",     back: "PENDING_SCM_DECISION", backLabel: "Send back" },
}

// Full stage chain per branch — for the stepper. `role` resolves the actual approver NAME per stage.
// Est Air is auto-computed after Purchasing (no manual Logistics step); LG only enters ACTUAL after approval.
const SCM_CHAIN = [
  { s: "PENDING_PURCHASING", l: "Purchasing", role: "PURCHASING" },
  { s: "PENDING_SCM_DECISION", l: "SCM", role: "SCM_PULL" }, { s: "PENDING_DVM_SCM", l: "DVM SCM", role: "PULL_DVM_SCM" },
  { s: "PENDING_VP_SCM", l: "VP SCM", role: "VP_SCM" },
  { s: "PENDING_FINAL", l: "Final approval", role: "PULL_PRESIDENT" }, { s: "APPROVED", l: "Approved · LG fills actual", role: "" },
]
const PC_CHAIN = [
  { s: "PENDING_PURCHASING", l: "Purchasing", role: "PURCHASING" },
  { s: "PENDING_PC_DECISION", l: "PC decision", role: "PURCHASING" }, { s: "PENDING_DVM_PUR", l: "DVM Purchasing", role: "DVM_PUR" },
  { s: "PENDING_VP_PUR", l: "VP Purchasing", role: "VP_PUR" }, { s: "APPROVED", l: "Approved · LG fills actual", role: "" },
]
const nameOf = (u: any) => u?.name || (u?.email ? String(u.email).split("@")[0] : "")

export default function Page() {
  const { data: session } = useSession()
  const myRoles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = myRoles.includes("ADMIN")

  // Statuses this user can approve (admin = all).
  const canApprove = (st: string) => isAdmin || myRoles.includes(APPROVER[st]?.role)

  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  // role → approver names (for the stepper)
  const [roleNames, setRoleNames] = useState<Record<string, string[]>>({})
  useEffect(() => {
    fetch("/api/pull-material/approvers").then(r => r.json()).then(d => {
      const map: Record<string, string[]> = {}
      for (const u of (d.users || [])) {
        const held = [u.role, ...(u.roles || [])].filter(Boolean)
        for (const rl of new Set(held)) { (map[rl as string] ||= []).push(nameOf(u)) }
      }
      setRoleNames(map)
    }).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      const wanted = new Set(Object.keys(APPROVER).filter(st => canApprove(st)))
      setReqs((d.requests || []).filter((r: any) => wanted.has(r.status)))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [bu, isAdmin]) // eslint-disable-line

  const act = async (rq: any, toStatus: string) => {
    const label = toStatus === "APPROVED" ? "Approve" : "Send back"
    if (!confirm(`${label} ${rq.documentNo}?`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      })
      if (r.ok) { setOpenId(null); await load() } else alert("Error")
    } finally { setBusy(false) }
  }

  const doReject = async (rq: any) => {
    if (!rejectReason.trim()) return alert("Please enter a reason for rejection.")
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectReason: rejectReason.trim() }),
      })
      if (r.ok) { setShowReject(false); setRejectReason(""); setOpenId(null); await load() } else alert("Error")
    } finally { setBusy(false) }
  }

  const openReq = reqs.find(r => r.id === openId)

  return (
    <div className="p-5 md:p-8 max-w-[1100px] mx-auto space-y-5">
      {!openReq && (
        <>
          <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>Approval — Pull Material</h1>
            <p className="text-sm text-gray-400 mt-0.5">Documents pending your approval</p></div>
          <div className="flex gap-1.5">{BUS.map(b => (
            <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${bu === b ? "text-white border-transparent shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
          ))}</div>

          {loading ? <p className="text-sm text-gray-400">Loading…</p> :
            reqs.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">No documents pending your approval</div> :
              <div className="space-y-2.5">
                {reqs.map(rq => (
                  <button key={rq.id} onClick={() => setOpenId(rq.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition text-left">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{rq.documentNo}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{APPROVER[rq.status]?.label || rq.status}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{rq.requestType === "PURCHASING" ? "PC branch" : "SCM branch"}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{rq.requesterName} · {rq.items?.length || 0} items · {[...new Set((rq.items || []).map((i: any) => i.soNoDoc))].join(", ")}</div>
                    </div>
                    <span className="shrink-0 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>Open →</span>
                  </button>
                ))}
              </div>}
        </>
      )}

      {openReq && (() => {
        const chain = openReq.requestType === "PURCHASING" ? PC_CHAIN : SCM_CHAIN
        const curIdx = chain.findIndex(s => s.s === openReq.status)
        const cfg = APPROVER[openReq.status]
        const total = (openReq.items || []).reduce((s: number, it: any) => s + (Number(it.airFreightCost) || 0), 0)
        return (
          <div className="space-y-5">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">← Back</button>
            {/* Header: doc info left · action buttons top-right (GM74 style) */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{openReq.documentNo}</h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{cfg?.label || openReq.status}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">{openReq.requestType === "PURCHASING" ? "PC branch" : "SCM branch"}</span>
                <span className="text-xs text-gray-400">by {openReq.requesterName} · {fmtDate(openReq.createdAt)}</span>
              </div>
              {cfg && canApprove(openReq.status) && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => act(openReq, cfg.next)} disabled={busy}
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 shadow-sm" style={{ background: "#16a34a" }}>
                    {busy ? "…" : cfg.next === "APPROVED" ? "✓ Approve (final)" : "✓ Approve"}
                  </button>
                  <button onClick={() => { setRejectReason(""); setShowReject(true) }} disabled={busy}
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 bg-red-600 hover:bg-red-700 shadow-sm">
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              {/* Left: doc info + items */}
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="text-sm font-bold text-gray-800 mb-3">📄 Document</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Info label="BU" value={openReq.bu} />
                    <Info label="Type" value={openReq.requestType === "PURCHASING" ? "PC request" : "SCM request"} />
                    <Info label="Requester" value={openReq.requesterName} />
                    <Info label="Items" value={String(openReq.items?.length || 0)} />
                    {openReq.remark && <div className="col-span-2"><Info label="Remark" value={openReq.remark} /></div>}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="text-sm font-bold text-gray-800 px-5 pt-5 pb-2">Items</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500"><tr>
                        {["SO", "Material", "PULL", "Country", "Port", "Incoterm", "Wt(kg)", "Air Freight", "L/T Air", "Air?", "Reason"].map(h =>
                          <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {(openReq.items || []).map((it: any) => (
                          <tr key={it.id} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{it.soNoDoc}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{it.itemName || it.itemCode}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{it.country || "-"}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{it.port || it.seaPort || "-"}</td>
                            <td className="px-3 py-1.5">{it.incoterm || "-"}</td>
                            <td className="px-3 py-1.5 text-right">{fmt(it.weight)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(it.airFreightCost)}</td>
                            <td className="px-3 py-1.5">{it.leadTimeAir || "-"}</td>
                            <td className="px-3 py-1.5 text-center">{it.airDecision === "AIR" ? "✈" : it.airDecision === "NO_AIR" ? "—" : ""}</td>
                            <td className="px-3 py-1.5 text-gray-500 max-w-[160px] truncate" title={it.reasonAirPick || ""}>{it.reasonAirPick || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="bg-gray-50 font-semibold"><td colSpan={7} className="px-3 py-2 text-right text-gray-600">Total Air Freight</td><td className="px-3 py-2 text-right" style={{ color: MAROON }}>{fmt(total)}</td><td colSpan={3}></td></tr></tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right: approval stepper (shows the actual approver name per stage) */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="text-sm font-bold text-gray-800 mb-4">Approval steps</div>
                  <div className="space-y-0">
                    {chain.map((step, i) => {
                      const done = i < curIdx, current = i === curIdx
                      const who = step.role ? (roleNames[step.role] || []).join(", ") : ""
                      return (
                        <div key={step.s} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? "bg-green-500 text-white" : current ? "bg-amber-400 text-white" : "bg-gray-200 text-gray-400"}`}>
                              {done ? "✓" : current ? "●" : "○"}
                            </div>
                            {i < chain.length - 1 && <div className={`w-0.5 flex-1 min-h-[26px] ${done ? "bg-green-400" : "bg-gray-200"}`} />}
                          </div>
                          <div className={`pb-4 ${current ? "" : "opacity-80"}`}>
                            <div className={`text-sm font-semibold ${current ? "text-amber-700" : done ? "text-gray-700" : "text-gray-400"}`}>{step.l}</div>
                            {who && <div className="text-[11px] text-gray-500">{who}</div>}
                            {current && <div className="text-[11px] text-amber-600">รออนุมัติ</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Reject modal — reason required */}
            {showReject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setShowReject(false)}>
                <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold text-gray-800">✕ Reject {openReq.documentNo}</h3>
                  <p className="text-xs text-gray-500">The document will be withdrawn from the flow and everyone who acted on it (+ requester) will be notified with this reason.</p>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Reason <span className="text-red-500">*</span></label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} autoFocus
                      placeholder="Why is this document rejected?"
                      className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowReject(false)} disabled={busy} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                    <button onClick={() => doReject(openReq)} disabled={busy || !rejectReason.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40">
                      {busy ? "…" : "Confirm Reject"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function Info({ label, value }: { label: string; value: any }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-gray-800">{value || "-"}</div></div>
}
