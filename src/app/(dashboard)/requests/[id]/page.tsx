"use client"
import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import { StatusBadge } from "@/components/ui/status-badge"
import { ROLE_ACTIONS, STATUS_LABELS, STYLE_APPROVER_STATUSES } from "@/types"
import { PdfDownloadButton } from "@/components/pdf-download-button"
import HawbSection from "@/components/HawbSection"
import { ClaimSplitBadges, ClaimSplitTable } from "@/components/ClaimSplits"
import { getSplits, deptSplitStatus, isLastPosition, nextPositionLabel, nextPositionRole, positionHasBranch, PROCUREMENT_BRANCHES } from "@/lib/claim"

const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtDT = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

// Executive summary shown to the President at final approval (both BU).
// Focus: total ACTUAL air freight + a breakdown of how much each department claims,
// then the SO table, then the single approve button centered below it.
function PresidentFinalCard({ req, bu, submitting, onApprove }: {
  req: any; bu: "GW" | "NYG"; submitting: boolean; onApprove: () => void
}) {
  const a = bu === "GW"
    ? { border: "border-emerald-200", btn: "bg-emerald-600 hover:bg-emerald-700", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", strong: "text-emerald-700" }
    : { border: "border-blue-200", btn: "bg-blue-600 hover:bg-blue-700", badge: "bg-blue-100 text-blue-700", bar: "bg-blue-500", strong: "text-blue-700" }
  const items: any[] = (req.items || []).filter((i: any) => i.itemStatus !== "REJECTED")
  const totalEst = items.reduce((s, i) => s + (Number(i.airFreight) || 0), 0)
  const totalAct = items.reduce((s, i) => s + (Number(i.actualAirFreight) || 0), 0)
  // Aggregate claim amount per department: actual air freight × that dept's percentage.
  const deptMap: Record<string, number> = {}
  for (const i of items) {
    const act = Number(i.actualAirFreight) || 0
    for (const sp of getSplits(i)) {
      deptMap[sp.dept] = (deptMap[sp.dept] || 0) + act * (Number(sp.pct) || 0) / 100
    }
  }
  const deptRows = Object.entries(deptMap).map(([dept, amt]) => ({ dept, amt })).sort((x, y) => y.amt - x.amt)
  const totalClaim = deptRows.reduce((s, d) => s + d.amt, 0)
  const claimShareOfActual = totalAct > 0 ? Math.round((totalClaim / totalAct) * 100) : 0

  const Stat = ({ label, value, sub, big }: { label: string; value: number; sub?: string; big?: boolean }) => (
    <div className="px-4 py-3.5">
      <p className="text-[10px] font-semibold text-gray-400 tracking-wide uppercase">{label}</p>
      <p className={`tabular-nums font-bold ${big ? `text-2xl ${a.strong}` : "text-lg text-gray-700"}`}>{fmtNum(value)}</p>
      {sub && <p className="text-[10px] text-gray-400 tabular-nums">{sub}</p>}
    </div>
  )

  return (
    <div className={`bg-white rounded-xl border ${a.border} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-800 text-sm">Final Approval — President</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.badge}`}>{bu}</span>
        </div>
      </div>

      {/* Headline figures — ACTUAL is the number the President is here to sign off. */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50/60">
        <Stat label="Est. Air Freight" value={totalEst} sub="THB" />
        <Stat label="Actual Air Freight" value={totalAct} sub="THB" big />
      </div>

      {/* Who claims how much */}
      {deptRows.length > 0 && (
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 tracking-wide uppercase mb-3">Claim breakdown by department</p>
          <div className="space-y-2.5">
            {deptRows.map(d => {
              const share = totalClaim > 0 ? (d.amt / totalClaim) * 100 : 0
              return (
                <div key={d.dept}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{d.dept}</span>
                    <span className="tabular-nums text-gray-800">
                      <span className="font-semibold">{fmtNum(d.amt)}</span> <span className="text-gray-400 text-xs">THB</span>
                      <span className="text-gray-400 text-xs ml-2">{Math.round(share)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full ${a.bar} rounded-full`} style={{ width: `${share}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SO detail */}
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead className="bg-gray-50">
            <tr>
              {["STYLE", "SO", "QTY AIR", "EST. (THB)", "ACTUAL (THB)", "CLAIM"].map(h =>
                <th key={h} className={`px-3 py-2 font-medium text-gray-500 whitespace-nowrap ${["QTY AIR", "EST. (THB)", "ACTUAL (THB)"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{item.style}</td>
                <td className="px-3 py-2 whitespace-nowrap">{item.so}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(item.qtyRequestAir)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-blue-600">{fmtNum(item.airFreight)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {getSplits(item).map((sp: any, k: number) => (
                      <span key={k} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                        {sp.dept} {sp.pct}%
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-100 bg-gray-50/60 font-semibold">
              <td className="px-3 py-2 text-gray-600" colSpan={3}>Total</td>
              <td className="px-3 py-2 text-right tabular-nums text-blue-600">{fmtNum(totalEst)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-green-700">{fmtNum(totalAct)}</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Single decision — centered below the table */}
      <div className="flex flex-col items-center gap-1.5 px-5 py-6 border-t border-gray-100">
        <button disabled={submitting} onClick={onApprove}
          className={`px-8 py-3 ${a.btn} text-white rounded-lg text-sm font-semibold disabled:opacity-50 shadow-sm`}>
          {submitting ? "Approving..." : "Approve"}
        </button>
        <span className="text-[11px] text-gray-400">Finalizes this document and sends it to Accounting</span>
      </div>
    </div>
  )
}

// NYG claim departments (SCM NYG removed — NYG uses NYK, not NYG, as a claim dept).
const CLAIM_DEPTS = ["COMMERCIAL", "PROCUREMENT", "NYK", "PRODUCTION"]
const CLAIM_DEPT_LABEL: Record<string, string> = { NYK: "SCM NYK", NYG: "SCM NYG" }

// Avatar colour derived from the name so each person is visually distinct.
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700", "bg-indigo-100 text-indigo-700",
]
const avatarColor = (s: string) => AVATAR_COLORS[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
const initialsOf = (s: string) => (s || "?").trim().split(/\s+/).slice(0, 2).map(n => n[0] || "").join("").toUpperCase()

// Tokens that identify a position (drop generic words so "VP SCM NYG" keys on SCM/NYG).
const POS_STOP = new Set(["VP", "OF", "THE", "FOR", "AND", "DEPT", "DEPARTMENT", "VICE", "MANAGER", "APPROVE", "APPROVER", "NEXT", "GM", "DPM"])
const posTokens = (s?: string) => ((s || "").toUpperCase().match(/[A-Z0-9]+/g) || []).filter(t => t.length >= 2 && !POS_STOP.has(t))
// Factory groups mentioned in a string: "VP PROD (G1/G3)" or role "..._G1G3" → {1,3}.
const extractGs = (s?: string) => {
  const set = new Set<string>()
  for (const m of (s || "").toUpperCase().matchAll(/G\s*([1-4])/g)) set.add(m[1])
  return set
}
const posMatches = (p: any, position?: string, bu?: string, positionRole?: string | null) => {
  // BU must match when both are known.
  if (bu && p.bu && String(p.bu).toUpperCase() !== String(bu).toUpperCase()) return false
  // Precise: when the chain maps this position to an exact User.role, match that
  // role exactly (this already encodes the VP PROD factory group, e.g. _G1G3).
  if (positionRole) {
    return String(p.role || p.pos || "").toUpperCase() === positionRole.toUpperCase()
  }
  // Fallback (chains without a mapped role): loose token match.
  const need = posTokens(position)
  if (!need.length) return false
  const hayStr = `${p.pos || ""} ${p.dept || ""} ${p.role || ""} ${p.bu || ""}`
  const hay = posTokens(hayStr)
  const needGs = extractGs(position)
  if (needGs.size) {
    const candGs = extractGs(hayStr)
    return hay.includes("PROD") && [...needGs].some(g => candGs.has(g))
  }
  return need.some(t => hay.includes(t))
}

// Inline person search/select. When `position` is given, results matching that
// position are shown first with a badge; a footer lets the user ask ADMIN to add
// a missing person for that position.
function PersonPicker({ label, selected, onSelect, placeholder, position, positionRole, requestId, bu, onRequestAdd }: { label: string; selected: { name: string; email: string } | null; onSelect: (p: { name: string; email: string } | null) => void; placeholder?: string; position?: string; positionRole?: string | null; requestId?: string; bu?: string; onRequestAdd?: (email: string, name: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [q, setQ] = useState(""); const [results, setResults] = useState<any[]>([]); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false); const [notifyState, setNotifyState] = useState<"idle" | "sending" | "sent">("idle")
  const [addOpen, setAddOpen] = useState(false); const [addEmail, setAddEmail] = useState(""); const [addName, setAddName] = useState(""); const [adding, setAdding] = useState(false)
  // Add a new person. If onRequestAdd is provided, submit a request that Admin must
  // approve (the new person is alerted only after approval). Otherwise create directly.
  const [addSent, setAddSent] = useState(false)
  const addApprover = async () => {
    const mail = addEmail.trim().toLowerCase()
    if (!mail) return
    setAdding(true)
    try {
      if (onRequestAdd) {
        const r = await onRequestAdd(mail, addName.trim())
        if (r?.ok) { setAddSent(true); setTimeout(() => { setAddOpen(false); setOpen(false) }, 1500) }
        else alert(r?.error || "Failed to send request")
      } else {
        const r = await fetch("/api/people/add-approver", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: mail, name: addName.trim(), role: positionRole, bu, position, requestId }),
        })
        const d = await r.json()
        if (r.ok) { onSelect({ name: d.name || addName.trim() || mail, email: d.email || mail }); setAddOpen(false); setOpen(false) }
        else alert(d.error || "Failed to add")
      }
    } catch { alert("Failed") } finally { setAdding(false) }
  }
  // Hard filter: with a required position, ONLY people matching that position (exact
  // role + BU) are selectable. "Show all" is an explicit override.
  const matched = position ? results.filter(p => posMatches(p, position, bu, positionRole)) : results
  const shown = position && !showAll ? matched : results
  const notifyAdmin = async () => {
    setNotifyState("sending")
    try {
      await fetch("/api/notify/add-person", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, suggestedName: q, requestId }) })
      setNotifyState("sent")
    } catch { setNotifyState("idle"); alert("Failed to notify admin") }
  }
  // Full candidate list (no query) so the dropdown is browseable before typing.
  const loadList = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/people?all=1${bu ? `&bu=${encodeURIComponent(bu)}` : ""}`)
      const d = await r.json(); setResults(Array.isArray(d) ? d : [])
    } catch { setResults([]) } finally { setLoading(false) }
  }
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-gray-600 shrink-0 w-32">{label}</span>
      {!selected ? (
        <div className="relative flex-1 min-w-0 max-w-sm">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m21 21-4.3-4.3" /></svg>
            <input value={q}
              onChange={async e => { const v = e.target.value; setQ(v); setOpen(true); setShowAll(false); setNotifyState("idle"); if (v.length < 2) { loadList(); return } setLoading(true); try { const r = await fetch(`/api/people?q=${encodeURIComponent(v)}`); const d = await r.json(); setResults(Array.isArray(d) ? d : []) } catch { setResults([]) } finally { setLoading(false) } }}
              onFocus={() => { setOpen(true); if (results.length === 0) loadList() }} onBlur={() => setTimeout(() => setOpen(false), 200)}
              placeholder={placeholder || "Search or pick a name..."}
              className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition" />
            {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />}
          </div>
          {open && (q.length >= 2 || results.length > 0 || loading) && (
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 w-96 max-w-[90vw] overflow-hidden">
              {position && (
                <div className="px-3.5 py-1.5 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-700 flex items-center justify-between">
                  <span>{showAll ? "Showing all people" : `Position: ${position} only`}</span>
                  <button onMouseDown={e => { e.preventDefault(); setShowAll(v => !v) }} className="underline hover:text-blue-900">
                    {showAll ? `filter to ${position}` : `show all (${results.length})`}
                  </button>
                </div>
              )}
              <div className="max-h-72 overflow-y-auto py-1.5">
                {shown.length > 0 ? shown.map((p: any, i: number) => {
                  const m = posMatches(p, position, bu, positionRole)
                  return (
                  <div key={i} onMouseDown={() => { onSelect({ name: p.name, email: p.email }); setResults([]); setOpen(false) }}
                    className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors">
                    <div className={`w-10 h-10 rounded-full ${avatarColor(p.name)} text-sm font-bold flex items-center justify-center shrink-0 select-none`}>{initialsOf(p.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name || p.email}{position && m && <span className="ml-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 align-middle">✓ position</span>}{position && showAll && !m && <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 align-middle">≠ position</span>}</p>
                      <p className="text-xs text-gray-400 truncate">{p.email || "—"}</p>
                      {(p.dept || p.pos) && <p className="text-[11px] text-gray-400 truncate">{[p.pos, p.dept].filter(Boolean).join(" · ")}{p.bu ? ` · ${p.bu}` : ""}</p>}
                    </div>
                  </div>
                )}) : !loading && (
                  <div className="px-4 py-5 text-center text-sm text-gray-400">
                    {position && !showAll && results.length > 0
                      ? <>No one matches <b className="text-gray-600">{position}</b>. Use “show all” above, or notify Admin below.</>
                      : "No matching person"}
                  </div>
                )}
              </div>
              {/* Missing person → add them (auto-create with the role) or notify admin */}
              {position && !loading && (
                <div className="px-3.5 py-2.5 border-t border-gray-100 bg-gray-50">
                  {positionRole ? (
                    <button onMouseDown={e => { e.preventDefault(); setAddEmail(q.includes("@") ? q : ""); setAddName(""); setAddOpen(true); setOpen(false) }}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium">
                      Can&apos;t find the person? → <b>+ Add {position}</b>
                    </button>
                  ) : notifyState === "sent" ? (
                    <p className="text-[11px] text-emerald-700 font-medium">✓ Admin notified — they will add this person.</p>
                  ) : (
                    <button onMouseDown={e => { e.preventDefault(); notifyAdmin() }} disabled={notifyState === "sending"}
                      className="text-[11px] text-red-600 hover:text-red-700 font-medium disabled:opacity-50">
                      {notifyState === "sending" ? "Notifying admin..." : `Can't find the person? → Ask Admin to add for ${position}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Add-person popup — centered over everything so it's clearly visible */}
          {addOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={() => !adding && setAddOpen(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
                {addSent ? (
                  <div className="text-center py-4 space-y-2">
                    <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 text-xl flex items-center justify-center mx-auto">✓</div>
                    <p className="text-sm text-emerald-700 font-semibold">Sent to Admin for approval</p>
                    <p className="text-xs text-gray-500">The person will be notified once Admin approves.</p>
                  </div>
                ) : (<>
                  <h3 className="text-base font-bold text-gray-800">Add new <span className="text-blue-700">{position}</span></h3>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Name</label>
                    <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Full name (optional)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Email <span className="text-red-500">*</span></label>
                    <input value={addEmail} onChange={e => setAddEmail(e.target.value)} type="email" placeholder="name@nanyangtextile.com" autoFocus
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug">
                    {onRequestAdd
                      ? <>Sends a request to <b>Admin</b>. After approval, this person is added as <b>{positionRole}</b>{bu ? ` (${bu})` : ""} and emailed to approve the selected SO.</>
                      : <>Added to the master as <b>{positionRole}</b>{bu ? ` (${bu})` : ""} and selected.</>}
                  </p>
                  <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 mt-1">
                    <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button onClick={addApprover} disabled={adding || !addEmail.trim()}
                      className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                      {adding ? "Sending..." : (onRequestAdd ? "Send request to Admin" : "Add & select")}
                    </button>
                  </div>
                </>)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl pl-2 pr-3 py-2 max-w-sm">
          <div className={`w-9 h-9 rounded-full ${avatarColor(selected.name)} text-xs font-bold flex items-center justify-center shrink-0 select-none`}>{initialsOf(selected.name)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-blue-900 truncate leading-tight">{selected.name}</p>
            <p className="text-xs text-blue-400 truncate leading-tight">{selected.email}</p>
          </div>
          <button onClick={() => onSelect(null)} className="text-blue-300 hover:text-blue-600 shrink-0 text-lg leading-none">×</button>
        </div>
      )}
    </div>
  )
}

export default function RequestDetailPage() {
  const { id } = useParams()
  const { data: session } = useSession()
  const router = useRouter()
  const [req, setReq] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [itemActuals, setItemActuals] = useState<Record<string, string>>({})
  const [itemLogistics, setItemLogistics] = useState<Record<string, { invoiceNo: string, bookingDate: string }>>({})
  const [logSelected, setLogSelected] = useState<Set<string>>(new Set())
  const [batchInvoice, setBatchInvoice] = useState("")
  const [batchBookingDate, setBatchBookingDate] = useState("")
  const [soClaimDepts, setSoClaimDepts] = useState<Record<string, {dept: string, pct: number, reason?: string}[]>>({})
  const [soDvmAssigned, setSoDvmAssigned] = useState<Record<string, string>>({})
  const [dvmUsers, setDvmUsers] = useState<Record<string, any[]>>({})
  const [soClaimSelected, setSoClaimSelected] = useState<Set<string>>(new Set())
  const [batchClaimDept, setBatchClaimDept] = useState("")
  const [batchDvm, setBatchDvm] = useState("")
  const [batchComment, setBatchComment] = useState("")
  const [soClaimComments, setSoClaimComments] = useState<Record<string, string>>({})
  const [vpScmSelectedEmail, setVpScmSelectedEmail] = useState("")
  const [vpScmSelectedName, setVpScmSelectedName] = useState("")
  const [vpScmUsers, setVpScmUsers] = useState<any[]>([])
  const [vpScmQuery, setVpScmQuery] = useState("")
  const [vpScmResults, setVpScmResults] = useState<any[]>([])
  const [vpScmSearching, setVpScmSearching] = useState(false)
  const [vpScmOpen, setVpScmOpen] = useState(false)
  const [scmSelectedIds, setScmSelectedIds] = useState<Set<string>>(new Set())
  const [scmRows, setScmRows] = useState<{dept: string, pct: string, reason: string}[]>([{dept:"", pct:"", reason:""}])
  const [scmSoInput, setScmSoInput] = useState("")
  const [scmForwarding, setScmForwarding] = useState(false)
  const [importErrors, setImportErrors] = useState<{so: string, issues: string[]}[]>([])
  const [soInvMap, setSoInvMap] = useState<Record<string, string>>({})
  const [hawbGroups, setHawbGroups] = useState<{ id: string; hawbNo: string; bookingDate: string; totalCost: string; invNos: string[] }[]>([])
  const [lgDraftSaving, setLgDraftSaving] = useState(false)
  const [lgSelectedSoIds, setLgSelectedSoIds] = useState<Set<string>>(new Set())
  const [lgBulkInv, setLgBulkInv] = useState("")
  const [lgQuickInv, setLgQuickInv] = useState("")
  const [lgQuickSo, setLgQuickSo] = useState("")
  const [soActualOverride, setSoActualOverride] = useState<Record<string, string>>({})
  const [crNoInput, setCrNoInput] = useState("")
  const [savingCr, setSavingCr] = useState(false)
  const [reassign, setReassign] = useState<Record<string, { dept: string; pct: string; reason: string }[]>>({})

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set())
  const [rejectingStyle, setRejectingStyle] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState("")
  const [rejectingSo, setRejectingSo] = useState<string | null>(null)
  const [rejectSoComment, setRejectSoComment] = useState("")
  const [backToScmSo, setBackToScmSo] = useState<string | null>(null)
  const [backToScmSoComment, setBackToScmSoComment] = useState("")
  const [backToScmComment, setBackToScmComment] = useState("")
  const [backToScmStyleOpen, setBackToScmStyleOpen] = useState<string | null>(null)
  const [backToScmStyleComment, setBackToScmStyleComment] = useState("")
  const [scmStyleFilter, setScmStyleFilter] = useState("")
  const [uploadingItem, setUploadingItem] = useState<string | null>(null)
  const [dvmSelected, setDvmSelected] = useState<Set<string>>(new Set())
  const [vpSelected, setVpSelected] = useState<Set<string>>(new Set())
  const [nextSelected, setNextSelected] = useState<Set<string>>(new Set())
  const [nextInitialModal, setNextInitialModal] = useState(false)
  const nextInitialModalFired = useRef(false)
  const [nextIntent, setNextIntent] = useState<"send" | "done" | "send_boss" | null>(null)
  const [nextForwardTo, setNextForwardTo] = useState<{name:string,email:string}|null>(null)
  const [nextFwdQ, setNextFwdQ] = useState("")
  const [nextFwdResults, setNextFwdResults] = useState<any[]>([])
  const [nextFwdOpen, setNextFwdOpen] = useState(false)
  const [nextFwdLoading, setNextFwdLoading] = useState(false)
  const [vpProcureBoss, setVpProcureBoss] = useState<{name:string,email:string}|null>(null)
  const procureAutoFwdFired = useRef(false)
  const nextProcureAutoFwdFired = useRef(false)
  const [logEditMode, setLogEditMode] = useState<Set<string>>(new Set())
  const [gwClaimDept, setGwClaimDept] = useState("")
  const [claimGwSelected, setClaimGwSelected] = useState<Set<string>>(new Set())
  const [claimApproversList, setClaimApproversList] = useState<any[]>([])
  const [recalculating, setRecalculating] = useState(false)
  const [deletingAtt, setDeletingAtt] = useState<string | null>(null)
  const [hawbRefreshKey, setHawbRefreshKey] = useState(0)
  const [importingLg, setImportingLg] = useState(false)
  const claimAutoSaveReady = useRef(false)

  // Claim Forward (Option B) state
  const [claimFwdQ, setClaimFwdQ] = useState("")
  const [claimFwdResults, setClaimFwdResults] = useState<any[]>([])
  const [claimFwdSelected, setClaimFwdSelected] = useState<{name:string,email:string}|null>(null)
  const [claimFwdLoading, setClaimFwdLoading] = useState(false)
  const [claimFwdOpen, setClaimFwdOpen] = useState(false)
  const [claimFwdSaving, setClaimFwdSaving] = useState(false)
  const [procureDecision, setProcureDecision] = useState<"approve" | "forward" | null>(null)
  const [claimFwdDone, setClaimFwdDone] = useState<string|null>(null)
  // Claim review: card list (expand each) vs flat table (see all at once).
  const [claimTableView, setClaimTableView] = useState(false)
  const [soPick, setSoPick] = useState("")        // quick-select: type SO + Enter
  const [soPickMsg, setSoPickMsg] = useState("")
  const [backModalOpen, setBackModalOpen] = useState(false) // Back to MER/SCM reason modal
  const [backReason, setBackReason] = useState("")
  // Claim approver (NYG/GW/Supplier) action popup: forward to next person, or finish.
  const [gwModalOpen, setGwModalOpen] = useState(false)
  const [gwBranchChoice, setGwBranchChoice] = useState<string | null>(null)
  // SCM NYK Approver picks the CR-entry person + VP/EVP approver (one per doc).
  const [nykCr, setNykCr] = useState<{name:string,email:string}|null>(null)
  const [nykEvp, setNykEvp] = useState<{name:string,email:string}|null>(null)
  useEffect(() => {
    if (!req) return
    if ((req as any).assignedScmNykCr) setNykCr(p => p || { name: (req as any).assignedScmNykCr, email: (req as any).assignedScmNykCr })
    if ((req as any).assignedScmNykEvp) setNykEvp(p => p || { name: (req as any).assignedScmNykEvp, email: (req as any).assignedScmNykEvp })
  }, [req])

  // Auto-save SCM claim dept + comments to DB (debounced 1.5s)
  useEffect(() => {
    if (!claimAutoSaveReady.current || !id) return
    const deptEntries = Object.entries(soClaimDepts).filter(([, v]) => Array.isArray(v) && v.length > 0)
    if (deptEntries.length === 0) return
    const timer = setTimeout(async () => {
      const dataToSave = Object.fromEntries(deptEntries)
      await fetch(`/api/requests/${id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_claim_progress", soClaimData: dataToSave, soClaimComments })
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [soClaimDepts, soClaimComments])

  useEffect(() => {
    const CLAIM_DEPTS_LIST = ["COMMERCIAL","PROCUREMENT","NYK","PRODUCTION"]
    Promise.all(CLAIM_DEPTS_LIST.map(dept =>
      fetch(`/api/users/by-role?role=DVM_${dept}`).then(r => r.json()).then(d => ({ dept, users: Array.isArray(d) ? d : [] }))
    )).then(results => {
      const map: Record<string, any[]> = {}
      results.forEach(({ dept, users }) => { map[dept] = users })
      setDvmUsers(map)
    })
    fetch(`/api/users/by-role?role=VP_SCM`).then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : []
      setVpScmUsers(list)
      if (list.length === 1) { setVpScmSelectedEmail(list[0].email); setVpScmSelectedName(list[0].name) }
    })
  }, [])

   useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then(r => r.json())
      .then(d => {
        setReq(d)
        setLoading(false)
        if (d.claimDepartment) setGwClaimDept(d.claimDepartment)
        if (d.items) {
          const depts: Record<string, {dept: string, pct: number}[]> = {}
          const dvms: Record<string, string> = {}
          const comments: Record<string, string> = {}
          d.items.forEach((item: any) => {
            if (Array.isArray(item.claimDepts) && item.claimDepts.length > 0) {
              depts[item.id] = item.claimDepts
            } else if (item.claimDepartment) {
              depts[item.id] = [{ dept: item.claimDepartment, pct: 100 }]
            }
            if (item.assignedDvm) dvms[item.id] = item.assignedDvm
            // Only pre-fill SCM reason if SCM has already assigned this item before
            const alreadyAssigned = (Array.isArray(item.claimDepts) && item.claimDepts.length > 0) || item.claimDepartment
            const msg = item.reasonDelay || item.itemComment
            if (msg && alreadyAssigned) comments[item.id] = msg
          })
          setSoDvmAssigned(dvms)
          claimAutoSaveReady.current = false
          setSoClaimDepts(depts)
          setSoClaimComments(comments)
          setTimeout(() => { claimAutoSaveReady.current = true }, 200)
        }
        // Pre-fill logistics data for PRES_PASSED items, parallel-LG stage, and legacy PENDING at PENDING_LOGISTICS
        const logItems = (d.items || []).filter((i: any) =>
          i.itemStatus === "PRES_PASSED" || i.itemStatus === "LOG_PASSED" ||
          (d.status === "PENDING_LOGISTICS" && i.itemStatus === "PENDING") ||
          ((d.status === "PENDING_SCM" || d.status === "PENDING_PRESIDENT") && i.itemStatus !== "REJECTED")
        )
        if (logItems.length > 0) {
          const logistics: Record<string, { invoiceNo: string; bookingDate: string }> = {}
          const actuals: Record<string, string> = {}
          logItems.forEach((item: any) => {
            if (item.invoiceNo || item.bookingDate) {
              logistics[item.id] = {
                invoiceNo: item.invoiceNo || "",
                bookingDate: item.bookingDate ? new Date(item.bookingDate).toISOString().split("T")[0] : ""
              }
            }
            if (item.actualAirFreight != null) actuals[item.id] = String(item.actualAirFreight)
          })
          // Always reset from DB (don't merge) so state never leaks across documents
          setItemLogistics(logistics)
          setItemActuals(actuals)
          // Reconstruct soInvMap from saved invoiceNo per item
          const restoredInvMap: Record<string, string> = {}
          logItems.forEach((item: any) => {
            if (item.invoiceNo) restoredInvMap[item.id] = item.invoiceNo
          })
          setSoInvMap(restoredInvMap)
          // Reconstruct hawbGroups from saved hawbNo per item, summing actualAirFreight as totalCost
          const hawbRestoreMap: Record<string, { hawbNo: string; invNos: Set<string>; totalCost: number }> = {}
          logItems.forEach((item: any) => {
            if (item.hawbNo && item.invoiceNo) {
              if (!hawbRestoreMap[item.hawbNo]) hawbRestoreMap[item.hawbNo] = { hawbNo: item.hawbNo, invNos: new Set(), totalCost: 0 }
              hawbRestoreMap[item.hawbNo].invNos.add(item.invoiceNo)
              hawbRestoreMap[item.hawbNo].totalCost += item.actualAirFreight || 0
            }
          })
          setHawbGroups(Object.values(hawbRestoreMap).map(h => ({
            id: Math.random().toString(36).slice(2),
            hawbNo: h.hawbNo,
            bookingDate: "",
            totalCost: h.totalCost > 0 ? String(Math.round(h.totalCost * 100) / 100) : "",
            invNos: [...h.invNos]
          })))
        } else {
          // No logistics-relevant items on this doc → clear any leftover state
          setItemLogistics({}); setItemActuals({}); setSoInvMap({}); setHawbGroups([])
        }
      })
      .catch(() => setLoading(false))
  }, [id])

  const role = (session?.user as any)?.role || ""
  const myClaimDept: string | null = (session?.user as any)?.claimDepartment || null
  const myPriority: number | null = (session?.user as any)?.priority ?? null
  const myUserId: string = (session?.user as any)?.id || ""
  const isGWRole = ["VP_MER_GW", "DPM_GW", "GM_GW", "PRESIDENT_GW", "LOGISTICS_GW", "CLAIM_GW", "SCM_NYK_APPROVER", "SCM_NYK_EVP", "SCM_NYK", "SCM_NYG", "ACCOUNTING"].includes(role)
  const isGWRequest = req?.bu === "GW"
  const isProcureDvm = (role === "DVM_PROCUREMENT" || role === "CLAIM_PROCUREMENT") && req?.status === "PENDING_CLAIM"

  useEffect(() => {
    if (!role) return
    // GW claim roles use their own role as the priority group — scoped to the doc's BU
    // (SCM_NYK_* / SCM_NYG exist in both NYG & GW, so filter by BU to avoid cross-BU people).
    if (["CLAIM_GW", "SCM_NYK", "SCM_NYK_APPROVER", "SCM_NYK_EVP", "SCM_NYG"].includes(role)) {
      const buParam = req?.bu ? `&bu=${req.bu}` : ""
      fetch(`/api/users/by-role?role=${role}${buParam}`).then(r => r.json()).then(setClaimApproversList)
      return
    }
    const isDvm = role.startsWith("DVM_") || role.startsWith("CLAIM_")
    const isVp = ["VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION"].includes(role)
    if (isDvm || isVp) {
      const dept = isDvm ? role.replace("DVM_","").replace("CLAIM_","") : role.replace("VP_","")
      const groupRole = isDvm ? `DVM_${dept}` : `VP_${dept}`
      fetch(`/api/users/by-role?role=${groupRole}`).then(r => r.json()).then(setClaimApproversList)
    }
  }, [role, req?.bu])

  // Initial popup for CLAIM_NEXT_APPROVER: once per page load
  // PROCUREMENT dept → skip popup, set "send_boss" intent (auto-forward to VP after all approved)
  // Other depts → show popup asking Approve & Send to next / Approve & Done
  useEffect(() => {
    if (role !== "CLAIM_NEXT_APPROVER" || nextInitialModalFired.current || !req || claimFwdDone) return
    const nextApproverDept = (session?.user as any)?.claimDepartment || (req as any)?.claimDepartment || null
    const hasItems = (req?.items || []).some((i: any) =>
      (i.itemStatus === "LOG_PASSED" || i.itemStatus === "CLAIM_PASSED") &&
      (!nextApproverDept || i.claimDepartment === nextApproverDept)
    )
    if (!hasItems) return
    nextInitialModalFired.current = true
    if (nextApproverDept === "PROCUREMENT") {
      setNextIntent("send_boss")
    } else {
      setNextInitialModal(true)
    }
  }, [req?.id, role]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch VP_PROCUREMENT for auto-forward (used by PROCUREMENT DVM and PROCUREMENT-dept CLAIM_NEXT_APPROVER)
  useEffect(() => {
    const nextApproverDept = (session?.user as any)?.claimDepartment || (req as any)?.claimDepartment || null
    const needBoss = isProcureDvm || (role === "CLAIM_NEXT_APPROVER" && nextApproverDept === "PROCUREMENT")
    if (!needBoss) return
    fetch("/api/users/by-role?role=VP_PROCUREMENT").then(r => r.json()).then(data => {
      const users = Array.isArray(data) ? data : []
      if (users[0]) setVpProcureBoss({ name: users[0].name, email: users[0].email })
    })
  }, [isProcureDvm, role]) // eslint-disable-line react-hooks/exhaustive-deps

  // PROCUREMENT DVM "Approve self": when all dept items approved → auto-forward to VP_PROCUREMENT boss
  useEffect(() => {
    if (!isProcureDvm || procureDecision !== "approve" || claimFwdDone || !req || !vpProcureBoss || procureAutoFwdFired.current) return
    const deptItems = (req.items || []).filter((i: any) => i.claimDepartment === "PROCUREMENT")
    if (deptItems.length > 0 && deptItems.every((i: any) => i.itemStatus !== "LOG_PASSED")) {
      procureAutoFwdFired.current = true
      claimForwardTo(vpProcureBoss.email, vpProcureBoss.name)
    }
  }, [req, vpProcureBoss]) // eslint-disable-line react-hooks/exhaustive-deps

  // CLAIM_NEXT_APPROVER (PROCUREMENT dept): when all dept items approved → auto-forward to VP_PROCUREMENT boss
  useEffect(() => {
    if (role !== "CLAIM_NEXT_APPROVER" || nextIntent !== "send_boss" || claimFwdDone || !req || !vpProcureBoss || nextProcureAutoFwdFired.current) return
    const nextApproverDept = (session?.user as any)?.claimDepartment || (req as any)?.claimDepartment || null
    const deptItems = (req.items || []).filter((i: any) => !nextApproverDept || i.claimDepartment === nextApproverDept)
    if (deptItems.length > 0 && deptItems.every((i: any) => i.itemStatus !== "LOG_PASSED")) {
      nextProcureAutoFwdFired.current = true
      claimForwardTo(vpProcureBoss.email, vpProcureBoss.name)
    }
  }, [req, vpProcureBoss, nextIntent]) // eslint-disable-line react-hooks/exhaustive-deps

  const canAct = req && ROLE_ACTIONS[role]?.includes(req.status) && (!isGWRole || isGWRequest)
  const isStyleApprover = req && STYLE_APPROVER_STATUSES.includes(req.status)
  const CLAIM_VP_ROLES_LOCAL = ["VP_COMMERCIAL", "VP_PROCUREMENT", "VP_NYK", "VP_PRODUCTION"]
  const claimDept = role.startsWith("DVM_") ? role.replace("DVM_", "")
    : role.startsWith("CLAIM_") ? role.replace("CLAIM_", "")
    : role === "SCM_NYK" ? "SCM NYK"
    : role === "SCM_NYG" ? "SCM NYG"
    : CLAIM_VP_ROLES_LOCAL.includes(role) ? role.replace("VP_", "") : ""
  const claimDeptRole = claimDept
  const isNykClaimRole = role === "SCM_NYK" || role === "SCM_NYK_APPROVER" || role === "SCM_NYK_EVP"
  // SCM NYK 3-role UI applies in BOTH BU (dept "SCM NYK" in GW, "NYK" in NYG).
  // CLAIM_GW / SCM_NYG use this UI only in GW.
  const isGwClaimP1Role = isNykClaimRole || ((role === "CLAIM_GW" || role === "SCM_NYG") && isGWRequest)
  const gwClaimDepts = role === "CLAIM_GW"
    ? (myClaimDept === "GW" ? ["GW"] : myClaimDept === "SUPPLIER" ? ["SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"] : ["GW", "SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"])
    : isNykClaimRole ? (isGWRequest ? ["SCM NYK"] : ["NYK"]) : role === "SCM_NYG" ? ["SCM NYG"] : []
  // NYG per-split: my dept's split status (null = still waiting my DVM). undefined = my dept not on this SO.
  const mySplitStatus = (i: any): string | null | undefined => {
    const list: string[] = Array.isArray(i.claimDepts) && i.claimDepts.length > 0
      ? i.claimDepts.map((d: any) => d.dept)
      : (i.claimDepartment ? [i.claimDepartment] : [])
    if (!list.includes(claimDept)) return undefined
    return deptSplitStatus(i, claimDept)
  }
  const isDvmClaim = (role.startsWith("DVM_") || role.startsWith("CLAIM_") || isNykClaimRole || role === "SCM_NYG") && (req?.items || []).some((i: any) => {
    if (isGwClaimP1Role) {
      // GW parallel (Logistics ∥ Claim): SO sits at PRES_PASSED; my dept has a split still awaiting approval.
      return ["PRES_PASSED", "LOG_PASSED"].includes(i.itemStatus) && getSplits(i).some((s: any) => gwClaimDepts.includes(s.dept) && s.status !== "DEPT_APPROVED" && s.status !== "REJECTED")
    }
    // NYG DVM: my dept is on the SO and its split still awaits DVM approval.
    return i.itemStatus === "LOG_PASSED" && mySplitStatus(i) === null
  })
  const isVpClaim = CLAIM_VP_ROLES_LOCAL.includes(role) && (req?.items || []).some((i: any) =>
    i.itemStatus === "CLAIM_PASSED" && mySplitStatus(i) === "CLAIM_PASSED"
  )
  const isClaimApprover = isDvmClaim || isVpClaim
  // Forward-to-next-approver box is only for the legacy NYG DVM/CLAIM flow.
  // GW / SCM NYK / SCM NYG claim auto-route by master priority (no manual forward).
  const isClaimP1ForForward = ((role.startsWith("CLAIM_") && role !== "CLAIM_NEXT_APPROVER") || role.startsWith("DVM_")) && req?.status === "PENDING_CLAIM"
  const isClaimNextApprover = role === "CLAIM_NEXT_APPROVER" && (req?.status === "PENDING_CLAIM" || req?.status === "PENDING_CLAIM_GW")
  // ── GW per-department forward model: each dept finishes OR forwards its own
  // splits independently. Owner = CLAIM_GW / SCM_NYG (NOT NYK — CR flow). Next =
  // a forwarded CLAIM_NEXT_APPROVER scoped to a dept via its session dept.
  // Forced-position claim chain — works for BOTH BU (GW + NYG). Entry roles:
  //   GW:  CLAIM_GW (GW/SUPPLIER), SCM_NYG      NYG: CLAIM_COMMERCIAL/PRODUCTION/PROCUREMENT
  //   plus a forwarded CLAIM_NEXT_APPROVER (scoped to dept + position via ClaimForward).
  const gwFwdCanonicalDept: string | null =
    role === "CLAIM_NEXT_APPROVER" ? (myClaimDept || null)
    : role === "CLAIM_GW" ? (myClaimDept === "SUPPLIER" ? "SUPPLIER" : "GW")
    : role === "SCM_NYG" ? "SCM NYG"
    : role === "CLAIM_COMMERCIAL" ? "COMMERCIAL"
    : role === "CLAIM_PRODUCTION" ? "PRODUCTION"
    : role === "CLAIM_PROCUREMENT" ? "PROCUREMENT"
    : null
  const gwFwdSplitDepts = gwFwdCanonicalDept === "SUPPLIER"
    ? ["SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]
    : gwFwdCanonicalDept ? [gwFwdCanonicalDept] : []
  const fwdEntryRole = isGWRequest
    ? (role === "CLAIM_GW" || role === "SCM_NYG")
    : (role === "CLAIM_COMMERCIAL" || role === "CLAIM_PRODUCTION" || role === "CLAIM_PROCUREMENT")
  const isGwForwardRole = req?.status === (isGWRequest ? "PENDING_CLAIM_GW" : "PENDING_CLAIM") &&
    (fwdEntryRole || role === "CLAIM_NEXT_APPROVER")
  const fwdItemStatuses = isGWRequest ? ["PRES_PASSED", "LOG_PASSED"] : ["LOG_PASSED"]
  // My forward row (CLAIM_NEXT_APPROVER = the row I logged in with, by token).
  const myClaimToken = (session?.user as any)?.claimNextToken || null
  const myClaimFwdRow = role === "CLAIM_NEXT_APPROVER"
    ? (req?.claimForwards || []).find((f: any) => myClaimToken ? f.token === myClaimToken : (f.dept === gwFwdCanonicalDept && f.nextEmail === (session?.user as any)?.email))
    : null
  // Base = SO at the claim stage with a still-pending split for my dept.
  const gwFwdBase = isGwForwardRole
    ? (req?.items || []).filter((i: any) => fwdItemStatuses.includes(i.itemStatus) &&
        getSplits(i).some((s: any) => gwFwdSplitDepts.includes(s.dept) && s.status !== "DEPT_APPROVED" && s.status !== "COMPLETED" && s.status !== "REJECTED"))
    : []
  // Scope to the SO THIS actor owns (per-SO forward): a forwarded approver sees only
  // their row's SO; the entry owner sees SO not yet forwarded to a later position.
  const gwFwdItems = (() => {
    if (!isGwForwardRole) return []
    if (role === "CLAIM_NEXT_APPROVER") {
      const ids = Array.isArray(myClaimFwdRow?.itemIds) ? myClaimFwdRow.itemIds : null
      return ids ? gwFwdBase.filter((i: any) => ids.includes(i.id)) : gwFwdBase
    }
    const covered = new Set<string>((req?.claimForwards || [])
      .filter((f: any) => f.dept === gwFwdCanonicalDept)
      .flatMap((f: any) => (Array.isArray(f.itemIds) ? f.itemIds : [])))
    return gwFwdBase.filter((i: any) => !covered.has(i.id))
  })()
  const showGwFinishForward = isGwForwardRole && gwFwdSplitDepts.length > 0 && gwFwdItems.length > 0 && !claimFwdDone
  // A claim SO's own split (this dept). All money is scoped to THIS dept's share:
  //   myEst   = SO est.  freight × claim%
  //   myClaim = SO actual freight × claim%
  const claimRow = (item: any) => {
    const sp = getSplits(item).find((s: any) => gwFwdSplitDepts.includes(s.dept))
    const actual = Number(item.actualAirFreight) || 0
    const est = Number(item.airFreight) || 0
    const pct = Number(sp?.pct) || 0
    return { sp, actual, est, pct, myEst: Math.round(est * pct / 100), amt: Math.round(actual * pct / 100) }
  }
  const claimTotals = gwFwdItems.reduce((acc: any, it: any) => {
    const r = claimRow(it)
    acc.actual += r.actual; acc.est += r.est; acc.myEst += r.myEst; acc.amt += r.amt; acc.qty += Number(it.qtyRequestAir) || 0
    return acc
  }, { actual: 0, est: 0, myEst: 0, amt: 0, qty: 0 })
  // Sort SO by claim amount (actual × %) high→low; fall back to estimate share
  // while actuals are still zero (before Logistics fills HAWB).
  const gwFwdItemsSorted = [...gwFwdItems].sort((a: any, b: any) => {
    const ra = claimRow(a), rb = claimRow(b)
    return (rb.amt - ra.amt) || (rb.myEst - ra.myEst)
  })
  // Ticked SO within my scope (per-SO forward). Empty selection = act on all my SO.
  const claimSelIds = [...dvmSelected].filter((idv: string) => gwFwdItems.some((i: any) => i.id === idv))
  const claimActIds: string[] = claimSelIds.length ? claimSelIds : gwFwdItems.map((i: any) => i.id)
  const exportClaimExcel = () => {
    const rows = gwFwdItemsSorted.map((it: any, i: number) => {
      const r = claimRow(it)
      return {
        "No.": i + 1, "SO": it.so, "STYLE": it.style, "CUSTOMER PO": it.customerPO || "",
        "QTY AIR": it.qtyRequestAir ?? "", "GROSS (KG)": it.grossWeight ?? "",
        "HAWB#": it.hawbNo || "", "INVOICE NO": it.invoiceNo || "",
        "EST. FREIGHT (THB)": it.airFreight ?? "", "ACTUAL (THB)": r.actual,
        "CLAIM %": r.pct, "MY EST (THB)": r.myEst, "MY CLAIM (THB)": r.amt,
        "PLAN DATE": fmtDate(it.planShipmentDate), "DELAY REASON": it.reasonDelay || "",
        "FACTORY": it.factory || "", "COUNTRY": it.country || "", "PORT": it.port || "",
      }
    })
    rows.push({ "No.": "", "SO": "TOTAL", "STYLE": "", "CUSTOMER PO": "", "QTY AIR": claimTotals.qty,
      "GROSS (KG)": "", "HAWB#": "", "INVOICE NO": "", "EST. FREIGHT (THB)": claimTotals.est,
      "ACTUAL (THB)": claimTotals.actual, "CLAIM %": "", "MY EST (THB)": claimTotals.myEst, "MY CLAIM (THB)": claimTotals.amt,
      "PLAN DATE": "", "DELAY REASON": "", "FACTORY": "", "COUNTRY": "", "PORT": "" } as any)
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Claim")
    XLSX.writeFile(wb, `${req?.documentNo || "claim"}_${(gwFwdCanonicalDept || "claim").replace(/\s+/g, "")}.xlsx`)
  }
  // Current position + next required position (with factory / branch context).
  const myFwdRow = myClaimFwdRow
  const gwCurrentPos = role === "CLAIM_NEXT_APPROVER" ? (myFwdRow?.position ?? 0) : 0
  const gwBranch: string | null = myFwdRow?.branch || null
  const gwIsLastPos = gwFwdCanonicalDept ? isLastPosition(gwFwdCanonicalDept, gwCurrentPos) : true
  const gwNeedsBranch = gwFwdCanonicalDept ? positionHasBranch(gwFwdCanonicalDept, gwCurrentPos) : false
  const gwNextPosLabel = gwFwdCanonicalDept ? nextPositionLabel(gwFwdCanonicalDept, gwCurrentPos, gwFwdItems[0]?.factory, gwNeedsBranch ? gwBranchChoice : gwBranch) : null
  // Exact role for the next position (drives precise person filtering). VP PROD uses
  // the factory of the SELECTED SO so G1/G3 vs G2/G4 resolves correctly.
  const gwNextPosRole = gwFwdCanonicalDept
    ? nextPositionRole(gwFwdCanonicalDept, gwCurrentPos, (gwFwdItems.find((i: any) => claimSelIds.includes(i.id)) || gwFwdItems[0])?.factory)
    : null
  const myClaimItems = req?.items?.filter((i: any) => {
    const itemDeptList: string[] = Array.isArray(i.claimDepts) && i.claimDepts.length > 0
      ? i.claimDepts.map((d: any) => d.dept)
      : (i.claimDepartment ? [i.claimDepartment] : [])
    const matchDept = isGwClaimP1Role
      ? gwClaimDepts.some((gd: string) => itemDeptList.includes(gd))
      : (!claimDept || itemDeptList.includes(claimDept))
    if (!matchDept) return false
    if (isGwClaimP1Role) {
      // GW: show SOs at the parallel claim stage where my dept has a split (+ rejected history).
      if (i.itemStatus === "REJECTED") return true
      return ["PRES_PASSED", "LOG_PASSED"].includes(i.itemStatus) && getSplits(i).some((s: any) => gwClaimDepts.includes(s.dept))
    }
    // NYG: my dept is on this SO (matchDept). Show claim-stage items + rejected history.
    if (i.itemStatus === "REJECTED") return true
    if (isDvmClaim) return ["LOG_PASSED", "CLAIM_PASSED", "COMPLETED"].includes(i.itemStatus)
    if (isVpClaim) return ["CLAIM_PASSED", "COMPLETED"].includes(i.itemStatus)
    return false
  }) || []
  const isVpScmAtScm = role === "VP_SCM" && req?.status === "PENDING_SCM"
  const isScmAtVpMer = role === "SCM_USER" && req?.status === "PENDING_VP_MER"
  const isScmAtPendingScm = role === "SCM_USER" && req?.status === "PENDING_SCM"
  const vpPassedItems = (req?.items || []).filter((i: any) => i.itemStatus === "VP_PASSED")
  const presPassedItems = (req?.items || []).filter((i: any) => i.itemStatus === "PRES_PASSED")
  const logPassedItems = (req?.items || []).filter((i: any) => i.itemStatus === "LOG_PASSED")
  const claimPassedItems = (req?.items || []).filter((i: any) => i.itemStatus === "CLAIM_PASSED")
  // President (NYG) = FINAL approver: doc at PENDING_PRESIDENT, items PRESIDENT_PENDING.
  const isPresidentRole = role === "PRESIDENT" && req?.status === "PENDING_PRESIDENT" && (req?.items || []).some((i: any) => i.itemStatus === "PRESIDENT_PENDING")
  const isLogisticsRole = role === "LOGISTICS" && presPassedItems.length > 0 && !isGWRequest
  const isLgParallelAtScm = role === "LOGISTICS" && (req?.status === "PENDING_SCM" || req?.status === "PENDING_PRESIDENT") && !isGWRequest
  // GW Logistics uses the same Air Waybill Entry UI (at its own PENDING_LOGISTICS_GW stage).
  const isLgGwEntry = role === "LOGISTICS_GW" && (req?.status === "PENDING_CLAIM_GW" || req?.status === "PENDING_LOGISTICS_GW" || req?.status === "PENDING_PRESIDENT_GW") && isGWRequest
  const showAwbEntry = isLgParallelAtScm || isLgGwEntry
  const allLgItems = (req?.items || []).filter((i: any) => i.itemStatus !== "REJECTED" && (isLgGwEntry ? i.itemStatus === "PRES_PASSED" : true))
  const uniqueInvNos = [...new Set(Object.values(soInvMap).filter(Boolean))]
  const assignedHawbInvNos = new Set(hawbGroups.flatMap(g => g.invNos))
  const addHawbGroup = () => setHawbGroups(p => [...p, { id: Math.random().toString(36).slice(2), hawbNo: "", bookingDate: "", totalCost: "", invNos: [] }])
  const removeHawbGroup = (gid: string) => setHawbGroups(p => p.filter(g => g.id !== gid))
  const updateHawb = (gid: string, data: Partial<{ hawbNo: string; bookingDate: string; totalCost: string }>) => setHawbGroups(p => p.map(g => g.id === gid ? { ...g, ...data } : g))
  const toggleInvInHawb = (gid: string, invNo: string) => setHawbGroups(p => p.map(g => {
    if (g.id !== gid) return g
    return { ...g, invNos: g.invNos.includes(invNo) ? g.invNos.filter(n => n !== invNo) : [...g.invNos, invNo] }
  }))
  const getHawbCalc = (group: { totalCost: string; invNos: string[] }) => {
    const items = allLgItems.filter((i: any) => group.invNos.includes(soInvMap[i.id]))
    const totalQty = items.reduce((s: number, i: any) => s + (Number(i.qtyRequestAir) || 0), 0)
    const hasOverride = items.some((i: any) => soActualOverride[i.id] !== undefined && soActualOverride[i.id] !== "")
    const overrideTotal = hasOverride ? items.reduce((s: number, i: any) => s + (parseFloat(soActualOverride[i.id]) || 0), 0) : null
    const totalCost = overrideTotal !== null ? overrideTotal : (parseFloat(group.totalCost) || 0)
    const avgPerUnit = totalQty > 0 ? totalCost / totalQty : 0
    return { items, totalQty, totalCost, avgPerUnit, hasOverride, overrideTotal }
  }
  const LG_REQUIRED_FILES = [{ key: "INV", label: "INV" }, { key: "AWB", label: "AWB" }, { key: "EXPENSE", label: "Expense" }]
  const saveLgHawb = async () => {
    // GW Logistics must attach INV + AWB + Expense before forwarding.
    if (isLgGwEntry) {
      const cats = new Set((req?.attachments || []).map((a: any) => a.category).filter(Boolean))
      const missing = LG_REQUIRED_FILES.filter(f => !cats.has(f.key)).map(f => f.label)
      if (missing.length) { alert(`Please attach all required files before Save: ${missing.join(", ")}`); return }
    }
    const itemLogisticsData: Record<string, { invoiceNo: string; hawbNo: string; bookingDate: string }> = {}
    const itemActualsData: Record<string, string> = {}

    // 1. Save INV assignments - only for items explicitly in soInvMap (don't touch items not assigned)
    Object.entries(soInvMap).forEach(([itemId, invNo]) => {
      itemLogisticsData[itemId] = { invoiceNo: invNo || "", hawbNo: "", bookingDate: "" }
    })

    // 2. Override with HAWB data (hawbNo + actualAirFreight) for items inside a HAWB
    hawbGroups.forEach(group => {
      const { items, avgPerUnit } = getHawbCalc(group)
      items.forEach((item: any) => {
        itemLogisticsData[item.id] = { invoiceNo: soInvMap[item.id] || "", hawbNo: group.hawbNo || "", bookingDate: group.bookingDate }
        const overrideVal = soActualOverride[item.id]
        itemActualsData[item.id] = overrideVal !== undefined && overrideVal !== ""
          ? String(parseFloat(overrideVal) || 0)
          : String(Math.round(item.qtyRequestAir * avgPerUnit * 100) / 100)
      })
    })
    setLgDraftSaving(true)
    // GW: forward to Claim (approve). NYG parallel: save draft only (no status change).
    const action = isLgGwEntry ? "approve" : "save_logistics_draft"
    const res = await fetch(`/api/requests/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, itemLogistics: itemLogisticsData, itemActuals: itemActualsData }) })
    setLgDraftSaving(false)
    if (isLgGwEntry && !res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Save failed"); return }
    router.push("/approvals")
  }
  const uploadLgFile = async (file: File, category: string) => {
    setLgDraftSaving(true)
    const form = new FormData()
    form.append("file", file); form.append("category", category)
    const res = await fetch(`/api/requests/${id}/attachments`, { method: "POST", body: form })
    if (res.ok) { const rr = await fetch(`/api/requests/${id}`); if (rr.ok) setReq(await rr.json()) }
    else alert("File upload failed")
    setLgDraftSaving(false)
  }
  const isVpMerGW = (role === "DPM_GW" || role === "VP_MER_GW") && req?.status === "PENDING_VP_MER_GW" && isGWRequest
  const isGmGW = role === "GM_GW" && req?.status === "PENDING_GM_GW" && isGWRequest
  const isPresidentGW = role === "PRESIDENT_GW" && req?.status === "PENDING_PRESIDENT_GW" && isGWRequest
  // Logistics ∥ Claim run in parallel after President → the doc sits at
  // PENDING_CLAIM_GW while LG enters HAWB data. Include it so HawbSection renders.
  const isLogisticsGW = role === "LOGISTICS_GW" && (req?.status === "PENDING_CLAIM_GW" || req?.status === "PENDING_LOGISTICS_GW" || req?.status === "PENDING_PRESIDENT_GW") && presPassedItems.length > 0 && isGWRequest
  const userClaimDept = (session?.user as any)?.claimDepartment || null
  const isClaimGW = false // replaced by isDvmClaim (new GW P1 flow via claimForward)
  const myScmDept = role === "SCM_NYK" ? "NYK" : role === "SCM_NYG" ? "NYG" : null
  const scmGwItems = (req?.items || []).filter((i: any) =>
    i.itemStatus === "SCM_GW_PENDING" &&
    getSplits(i).some((s: any) => s.status === "SCM_PENDING" && (myScmDept ? s.dept === myScmDept : true))
  )
  const isScmGW = (role === "SCM_NYK" || role === "SCM_NYG") && req?.status === "PENDING_SCM_GW" && scmGwItems.length > 0 && isGWRequest
  const accountingItems = (req?.items || []).filter((i: any) => i.itemStatus === "ACCOUNTING_PENDING")
  const isAccounting = role === "ACCOUNTING" && req?.status === "PENDING_ACCOUNTING" && accountingItems.length > 0 && isGWRequest
  const isGWApprover = isVpMerGW || isGmGW || isPresidentGW || isLogisticsGW || isClaimGW || isScmGW || isAccounting
  const canReject = canAct && !isStyleApprover && !isClaimApprover && !isVpScmAtScm && !isScmAtVpMer && !isPresidentRole && !isLogisticsRole && !isGWApprover && !role.startsWith("DVM_") && !role.startsWith("CLAIM_") && !CLAIM_VP_ROLES_LOCAL.includes(role) && req.status !== "PENDING_SCM" && req.status !== "PENDING_LOGISTICS" && req.status !== "PENDING_LOGISTICS_GW"

  const presidentNewFlow = role === "PRESIDENT" && req?.status === "PENDING_PRESIDENT"

  const styleGroups = useMemo(() => {
    if (!req?.items) return []
    const groups: Record<string, any[]> = {}
    for (const item of req.items) {
      if (!groups[item.style]) groups[item.style] = []
      groups[item.style].push(item)
    }
    return Object.entries(groups).map(([style, items]) => {
      const nonRej = items.filter((i: any) => i.itemStatus !== "REJECTED")
      const STATUS_ORDER = ["PENDING", "VP_MER_PASSED", "PASSED", "VP_PASSED", "PRES_PASSED", "LOG_PASSED", "CLAIM_PASSED", "COMPLETED"]
      const status = nonRej.length === 0 ? "REJECTED"
        : nonRej.every((i: any) => i.itemStatus === "COMPLETED") ? "COMPLETED"
        : nonRej.every((i: any) => i.itemStatus === "CLAIM_PASSED") ? "CLAIM_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "LOG_PASSED") ? "LOG_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "PRES_PASSED") ? "PRES_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "VP_PASSED") ? "VP_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "VP_MER_PASSED") ? "VP_MER_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "PASSED") ? "PASSED"
        : STATUS_ORDER[Math.min(...nonRej.map((i: any) => STATUS_ORDER.indexOf(i.itemStatus)).filter(x => x >= 0))] || "PENDING"
      const totalGross = nonRej.reduce((s: number, i: any) => s + (Number(i.grossWeight) || 0), 0)
      const totalEst = nonRej.reduce((s: number, i: any) => s + (Number(i.airFreight) || 0), 0)
      const totalActual = nonRej.reduce((s: number, i: any) => s + (Number(i.actualAirFreight) || 0), 0)
      return { style, items, status, totalGross, totalEst, totalActual }
    })
  }, [req])

  const toggleExpand = (style: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(style) ? n.delete(style) : n.add(style); return n })
  }

  const approveStyle = async (style: string) => {
    setSubmitting(style)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_style", style, comment: "" })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null)
  }

  const approveSelectedStyles = async () => {
    const toApprove = styleGroups.filter(g => (g.status === "PENDING" || g.status === "PASSED" || (presidentNewFlow && g.status === "VP_MER_PASSED")) && selectedStyles.has(g.style)).map(g => g.style)
    for (const style of toApprove) {
      setSubmitting(style)
      const res = await fetch(`/api/requests/${id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_style", style, comment: "" })
      })
      if (res.ok) setReq(await res.json())
    }
    setSubmitting(null)
    setSelectedStyles(new Set())
  }

  const rejectSelectedStyles = async () => {
    const toReject = styleGroups.filter(g => (g.status === "PENDING" || g.status === "PASSED" || (presidentNewFlow && g.status === "VP_MER_PASSED")) && selectedStyles.has(g.style)).map(g => g.style)
    if (toReject.length === 0) return
    const reason = window.prompt(`Reason for rejecting ${toReject.length} style(s):`)
    if (reason == null || !reason.trim()) return
    for (const style of toReject) {
      setSubmitting(style)
      const res = await fetch(`/api/requests/${id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_style", style, comment: reason.trim() })
      })
      if (res.ok) setReq(await res.json())
      else { const e = await res.json().catch(() => ({})); alert(e.error || "Error"); break }
    }
    setSubmitting(null)
    setSelectedStyles(new Set())
  }

  const rejectStyle = async (style: string) => {
    setSubmitting(style)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject_style", style, comment: rejectComment })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null); setRejectingStyle(null); setRejectComment("")
  }

  const backToScmStyleFn = async (style: string) => {
    setSubmitting(style)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "back_to_scm_style", style, comment: backToScmStyleComment })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null); setBackToScmStyleOpen(null); setBackToScmStyleComment("")
  }

  const attachFileFn = async (file: File, itemId?: string) => {
    setUploadingItem(itemId || "_req")
    try {
      const form = new FormData()
      form.append("file", file)
      if (itemId) { form.append("itemId", itemId); form.append("claimDept", claimDeptRole) }
      const res = await fetch(`/api/requests/${id}/attachments`, { method: "POST", body: form })
      if (res.ok) {
        const att = await res.json()
        setReq((prev: any) => ({ ...prev, attachments: [...(prev.attachments || []), att] }))
      } else { alert("Upload failed") }
    } finally { setUploadingItem(null) }
  }

  // Request Admin to add a NEW person for the next position (no forward until approved).
  const requestNewApprover = async (email: string, name: string) => {
    try {
      const res = await fetch("/api/people/request-approver", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: id, dept: gwFwdCanonicalDept, role: gwNextPosRole, positionLabel: gwNextPosLabel,
          fromPos: gwCurrentPos, nextEmail: email, nextName: name, bu: req?.bu,
          branch: gwNeedsBranch ? gwBranchChoice : gwBranch, itemIds: claimActIds,
        }),
      })
      const d = await res.json().catch(() => ({}))
      return { ok: res.ok, error: d?.error }
    } catch { return { ok: false, error: "Network error" } }
  }

  const claimForward = async (final: boolean, ids?: string[]) => {
    setClaimFwdSaving(true)
    // Finalize/forward only the selected SO (per-SO forward). When nothing is
    // ticked, `ids` is undefined → the backend acts on all SO this actor owns.
    let res
    if (final) {
      // Finish (final position) → finalize this dept's selected splits centrally.
      res = await fetch(`/api/requests/${id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize_claim_dept", itemIds: ids })
      })
    } else {
      // Forward the selected SO subset to the next forced position (person free, position fixed).
      res = await fetch(`/api/requests/${id}/claim-forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextEmail: claimFwdSelected?.email, nextName: claimFwdSelected?.name, branch: gwNeedsBranch ? gwBranchChoice : undefined, itemIds: ids })
      })
    }
    if (res.ok) {
      // After approve/forward, go straight back to the Air Requests list
      // (no lingering half-state panel on this page).
      window.location.href = "/requests"
      return
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Action failed")
    }
    setClaimFwdSaving(false)
  }

  const claimForwardTo = async (email: string, name: string) => {
    setClaimFwdSaving(true)
    const res = await fetch(`/api/requests/${id}/claim-forward`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ final: false, nextEmail: email, nextName: name })
    })
    if (res.ok) {
      setClaimFwdDone(`forwarded:${name}`)
      const r = await fetch(`/api/requests/${id}`)
      if (r.ok) setReq(await r.json())
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Forward failed")
    }
    setClaimFwdSaving(false)
  }

  const act = async (action: string) => {
    setSubmitting("_")
    const body: any = { action, comment }
    if (req.status === "PENDING_SCM") {
      body.soClaimData = Object.fromEntries(
        pendingScmItems.filter((i: any) => {
          const d = soClaimDepts[i.id] || []; return d.length > 0 && d.reduce((s: number, x: any) => s + x.pct, 0) === 100
        }).map((i: any) => [i.id, soClaimDepts[i.id]])
      )
      body.soClaimComments = soClaimComments
    }
    if (req.status === "PENDING_LOGISTICS" && action === "approve") {
      body.itemActuals = itemActuals
      body.itemLogistics = itemLogistics
    }
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      const updated = await res.json()
      setReq(updated)
      if ((req.status === "PENDING_SCM" || req.status === "PENDING_LOGISTICS") && action === "approve") {
        window.location.href = "/approvals"
        return
      }
    } else {
      const err = await res.json()
      alert(err.error || "Error")
    }
    setSubmitting(null); setComment("")
  }

  const approveSo = async (soItemId: string) => {
    setSubmitting(soItemId)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_so", itemId: soItemId })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null)
  }

  const rejectSo = async (soItemId: string) => {
    setSubmitting(soItemId)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject_so", itemId: soItemId, comment: rejectSoComment })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
  }

  const saveLogistics = async () => {
    setSubmitting("log")
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_logistics", itemActuals, itemLogistics })
    })
    if (res.ok) setReq(await res.json())
    else { const err = await res.json(); alert(err.error || "Error") }
    setSubmitting(null)
  }



  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>
  if (!req) return <div className="text-center py-20 text-gray-400">Not found</div>

  const activeItems = req.items?.filter((i: any) => i.itemStatus !== "REJECTED") || []
  const pendingScmItems = req?.status === "PENDING_SCM" ? activeItems.filter((i: any) => i.itemStatus === "PENDING") : activeItems
  const forwardedScmItems = req?.status === "PENDING_SCM" ? activeItems.filter((i: any) => i.itemStatus === "PASSED") : []
  const isScmItemReady = (i: any) => {
    const d = soClaimDepts[i.id] || []
    return d.length > 0 &&
      d.reduce((s: number, x: any) => s + x.pct, 0) === 100 &&
      d.every((x: any) => x.reason && String(x.reason).trim())
  }
  const readyScmStyles = [...new Set(pendingScmItems.filter((i: any) => isScmItemReady(i)).map((i: any) => i.style as string))]
    .filter(style => pendingScmItems.filter((i: any) => i.style === style).every((i: any) => isScmItemReady(i)))
  const readyScmItemIds = pendingScmItems.filter((i: any) => readyScmStyles.includes(i.style)).map((i: any) => i.id as string)
  const vpMerPassedItems = req?.status === "PENDING_VP_MER" ? activeItems.filter((i: any) => i.itemStatus === "VP_MER_PASSED") : []
  const scmPassedAtVpMer = req?.status === "PENDING_VP_MER" ? activeItems.filter((i: any) => i.itemStatus === "PASSED") : []
  // Logistics items: PRES_PASSED (ready for logistics) and LOG_PASSED (already processed)
  const pendingLogItems = presPassedItems
  const forwardedLogItems = logPassedItems

  return (
    <div className="space-y-5">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[260px]">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-gray-800 text-sm">Approving...</p>
              <p className="text-xs text-gray-400 mt-1">Please do not close this page.</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{req.documentNo}</h1>
        {req.crNo && isNykClaimRole && (
          <span className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
            CR NO: {req.crNo}
          </span>
        )}
        {(() => {
          const merAtts = (req.attachments || []).filter((a: any) => ["MER_USER","VP_MER"].includes(a.uploadedBy?.role) && !a.itemId)
          if (merAtts.length > 0) {
            return merAtts.map((att: any) => (
              <span key={att.id} className="flex items-center gap-1 text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full whitespace-nowrap font-medium">
                <a href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer" className="hover:underline">
                  📎 {att.fileName}
                </a>
              </span>
            ))
          }
          return (
            <span className="flex items-center gap-1 text-xs bg-gray-100 border border-gray-200 text-gray-400 px-2 py-0.5 rounded-full cursor-not-allowed select-none">
              📎 MER file
            </span>
          )
        })()}
        {role === "ADMIN" && (
          <button onClick={async () => {
            setRecalculating(true)
            const res = await fetch(`/api/requests/${id}/recalculate`, { method: "POST" })
            const data = await res.json()
            setRecalculating(false)
            if (res.ok) {
              const r = await fetch(`/api/requests/${id}`).then(r => r.json())
              setReq(r)
              alert(`Recalculated ${data.updated} item(s)`)
            } else {
              alert("Recalculate failed")
            }
          }} disabled={recalculating} className="ml-auto text-xs text-blue-600 border border-blue-300 px-3 py-1 rounded-lg hover:bg-blue-50 disabled:opacity-50">
            {recalculating ? "Calculating..." : "⟳ Recalculate"}
          </button>
        )}
      </div>

      {/* Freight Cost Summary — visible to all roles EXCEPT the forced-position
          claim screen (that panel has its own dept-scoped summary strip). */}
      {(() => {
        // President has its own summary card; the claim panel has its own strip.
        if (showGwFinishForward || isPresidentGW || isPresidentRole) return null
        const isClaimDeptRole = isDvmClaim || isVpClaim || isClaimNextApprover || isClaimP1ForForward
        const summaryItems = isClaimDeptRole && myClaimItems.length > 0 ? myClaimItems : (req.items || [])
        const allItems = summaryItems
        const estTotal = allItems.reduce((s: number, i: any) => s + (i.airFreight || 0), 0)
        const actTotal = allItems.reduce((s: number, i: any) => {
          if (!isClaimDeptRole || !claimDept) return s + (i.actualAirFreight || 0)
          const depts: any[] = Array.isArray(i.claimDepts) && i.claimDepts.length > 0 ? i.claimDepts : (i.claimDepartment ? [{ dept: i.claimDepartment, pct: 100 }] : [])
          const match = depts.find((d: any) => d.dept === claimDept)
          return s + (match ? (i.actualAirFreight || 0) * match.pct / 100 : (i.actualAirFreight || 0))
        }, 0)
        const hasActual = allItems.some((i: any) => i.actualAirFreight > 0)
        const totalSo = allItems.length
        const fmtThb = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 })
        if (estTotal === 0 && actTotal === 0) return null
        return (
          <div className="flex flex-wrap items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-3">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider shrink-0">Air Freight Summary</div>
            <div className="w-px h-5 bg-gray-200 shrink-0" />
            <div className="flex flex-wrap gap-5">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Est. Air Freight</p>
                <p className="text-sm font-bold text-blue-700">{fmtThb(estTotal)} <span className="text-xs font-normal text-gray-400">THB</span></p>
              </div>
              {hasActual && (
                <>
                  <div className="w-px h-8 bg-gray-100 self-center" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Actual Air Freight</p>
                    <p className="text-sm font-bold text-green-700">{fmtThb(actTotal)} <span className="text-xs font-normal text-gray-400">THB</span></p>
                  </div>
                </>
              )}
            </div>
            <div className="ml-auto text-[11px] text-gray-400">{totalSo} SO(s)</div>
          </div>
        )
      })()}

      {/* Rejection Reason */}
      {req.rejectionReason && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="font-semibold">Rejection Reason: </span>{req.rejectionReason}
        </div>
      )}

      {/* Style Accordion */}
      {canAct && isStyleApprover && !isScmAtVpMer && !isPresidentRole && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">STYLES ({styleGroups.length})</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-4 text-xs font-medium">
                <span className="text-yellow-600">{styleGroups.filter(g => g.status === "PENDING" || (presidentNewFlow && g.status === "VP_MER_PASSED")).length} pending</span>
                <span className="text-green-600">{styleGroups.filter(g => g.status === "PASSED" || g.status === "PRES_PASSED" || (!presidentNewFlow && g.status === "VP_MER_PASSED")).length} approved</span>
                <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
              </div>
              {styleGroups.some(g => g.status === "PENDING" || (presidentNewFlow && g.status === "VP_MER_PASSED")) && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox"
                    checked={styleGroups.filter(g => g.status === "PENDING" || (presidentNewFlow && g.status === "VP_MER_PASSED")).every(g => selectedStyles.has(g.style))}
                    onChange={e => {
                      const pending = styleGroups.filter(g => g.status === "PENDING" || (presidentNewFlow && g.status === "VP_MER_PASSED")).map(g => g.style)
                      setSelectedStyles(e.target.checked ? new Set(pending) : new Set())
                    }}
                    className="w-4 h-4"
                  />
                  Select All
                </label>
              )}
              {selectedStyles.size > 0 && (
                <>
                <button onClick={approveSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? "..." : `Approve Selected (${selectedStyles.size})`}
                </button>
                <button onClick={rejectSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {submitting ? "..." : `Reject Selected (${selectedStyles.size})`}
                </button>
                </>
              )}
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isBackScm = backToScmStyleOpen === g.style
            const isSub = submitting === g.style
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${g.status === "PASSED" ? "border-green-200" : g.status === "REJECTED" ? "border-red-200" : isBackScm ? "border-orange-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${g.status === "PASSED" ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : "bg-white"}`}>
                  {g.status === "PENDING" && (
                    <input type="checkbox" className="w-4 h-4 shrink-0"
                      checked={selectedStyles.has(g.style)}
                      onChange={e => setSelectedStyles(prev => { const s = new Set(prev); e.target.checked ? s.add(g.style) : s.delete(g.style); return s })}
                    />
                  )}
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-800 shrink-0">{g.style}</span>
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Gross Weight = <span className="font-medium text-gray-700">{fmtNum((g as any).totalGross, 2)} KG</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">EST Airfreight = <span className="font-medium text-blue-600">{fmtNum((g as any).totalEst)} THB</span></span>
                      {(g as any).totalActual > 0 && <>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">Actual = <span className="font-medium text-green-600">{fmtNum((g as any).totalActual)} THB</span></span>
                      </>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{g.items.length} SO(s)</span>
                  {g.status === "PASSED" && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved — Forwarded</span>}
                  {g.status === "VP_MER_PASSED" && !presidentNewFlow && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">VP MER Approved — Pending President</span>}
                  {g.status === "PRES_PASSED" && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">President Approved</span>}
                  {g.status === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Rejected</span>}
                  {(g.status === "PENDING" || (presidentNewFlow && g.status === "VP_MER_PASSED")) && (
                    <div className="flex gap-2">
                      <button onClick={() => approveStyle(g.style)} disabled={isSub} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">{isSub && !isRej ? "..." : "Approve"}</button>
                      <button onClick={() => { setRejectingStyle(isRej ? null : g.style); setRejectComment("") }} disabled={isSub} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                      {req.status === "PENDING_VP_SCM" && (
                        <button onClick={() => { setBackToScmStyleOpen(isBackScm ? null : g.style); setBackToScmComment(""); setRejectingStyle(null) }} disabled={isSub || submitting === "_"}
                          className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                          Back to SCM
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isRej && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectStyle(g.style)} disabled={isSub || !rejectComment.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isSub ? "..." : "Confirm Reject"}</button>
                      <button onClick={() => { setRejectingStyle(null); setRejectComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isBackScm && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM — specify reason *</label>
                    <textarea value={backToScmComment} onChange={e => setBackToScmComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button
                        disabled={!backToScmComment.trim() || submitting === "_"}
                        onClick={async () => {
                          setSubmitting("_")
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "back_to_scm", comment: backToScmComment })
                          })
                          if (res.ok) { setReq(await res.json()) } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null); setBackToScmStyleOpen(null); setBackToScmComment("")
                        }}
                        className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                        {submitting === "_" ? "..." : "Confirm Back to SCM"}
                      </button>
                      <button onClick={() => { setBackToScmStyleOpen(null); setBackToScmComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","ACTUAL AIR FREIGHT (THB)","REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2">{item.customerPO}</td>
                            <td className="px-3 py-2">{item.description}</td>
                                                        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                            <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                            <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                            <td className="px-3 py-2">{item.reasonDelay}</td>
                            <td className="px-3 py-2">{item.factory}</td>
                            <td className="px-3 py-2">{item.country}</td>
                            <td className="px-3 py-2">{item.port}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

        </div>
      )}

      {/* VP SCM approve styles at PENDING_SCM (styles fully forwarded by SCM) */}
      {isVpScmAtScm && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">STYLE APPROVAL — VP SCM</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-4 text-xs font-medium">
                <span className="text-gray-400">{styleGroups.filter(g => g.status === "PENDING").length} waiting for SCM</span>
                <span className="text-blue-600">{styleGroups.filter(g => g.status === "PASSED").length} ready to approve</span>
                <span className="text-green-600">{styleGroups.filter(g => g.status === "VP_PASSED").length} approved</span>
                <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
              </div>
              {styleGroups.some(g => g.status === "PASSED") && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox"
                    checked={styleGroups.filter(g => g.status === "PASSED").every(g => selectedStyles.has(g.style))}
                    onChange={e => {
                      const ready = styleGroups.filter(g => g.status === "PASSED").map(g => g.style)
                      setSelectedStyles(e.target.checked ? new Set(ready) : new Set())
                    }}
                    className="w-4 h-4" />
                  Select All
                </label>
              )}
              {selectedStyles.size > 0 && (
                <>
                <button onClick={approveSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? "..." : `Approve Selected (${selectedStyles.size})`}
                </button>
                <button onClick={rejectSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {submitting ? "..." : `Reject Selected (${selectedStyles.size})`}
                </button>
                </>
              )}
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isBackScm = backToScmStyleOpen === g.style
            const isSub = submitting === g.style
            const isReady = g.status === "PASSED"
            const isApproved = ["VP_PASSED","PRES_PASSED","LOG_PASSED","CLAIM_PASSED","COMPLETED"].includes(g.status)
            const isWaiting = g.status === "PENDING"
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${isApproved ? "border-green-200" : isRej || g.status === "REJECTED" ? "border-red-200" : isBackScm ? "border-orange-200" : isWaiting ? "border-gray-200 opacity-60" : "border-blue-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isApproved ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : isBackScm ? "bg-orange-50" : isWaiting ? "bg-gray-50" : "bg-blue-50"}`}>
                  {isReady && (
                    <input type="checkbox" className="w-4 h-4 shrink-0"
                      checked={selectedStyles.has(g.style)}
                      onChange={e => setSelectedStyles(prev => { const n = new Set(prev); e.target.checked ? n.add(g.style) : n.delete(g.style); return n })} />
                  )}
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-800 shrink-0">{g.style}</span>
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Gross Weight = <span className="font-medium text-gray-700">{fmtNum((g as any).totalGross, 2)} KG</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">EST Airfreight = <span className="font-medium text-blue-600">{fmtNum((g as any).totalEst)} THB</span></span>
                      {(g as any).totalActual > 0 && <>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">Actual = <span className="font-medium text-green-600">{fmtNum((g as any).totalActual)} THB</span></span>
                      </>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{g.items.length} SO(s)</span>
                  {isWaiting && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">⏳ Waiting for SCM</span>}
                  {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>}
                  {g.status === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Rejected</span>}
                  {isReady && !isRej && !isBackScm && (
                    <div className="flex gap-2">
                      <button onClick={() => approveStyle(g.style)} disabled={isSub} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">{isSub ? "..." : "Approve"}</button>
                      <button onClick={() => { setRejectingStyle(g.style); setRejectComment(""); setBackToScmStyleOpen(null) }} disabled={isSub} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                      <button onClick={() => { setBackToScmStyleOpen(g.style); setBackToScmStyleComment(""); setRejectingStyle(null) }} disabled={isSub} className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">Back to SCM</button>
                    </div>
                  )}
                </div>
                {isRej && isReady && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectStyle(g.style)} disabled={isSub || !rejectComment.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isSub ? "..." : "Confirm Reject"}</button>
                      <button onClick={() => { setRejectingStyle(null); setRejectComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isBackScm && isReady && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM — specify reason *</label>
                    <textarea value={backToScmStyleComment} onChange={e => setBackToScmStyleComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button onClick={() => backToScmStyleFn(g.style)} disabled={isSub || !backToScmStyleComment.trim()} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">{isSub ? "..." : "Confirm Back to SCM"}</button>
                      <button onClick={() => { setBackToScmStyleOpen(null); setBackToScmStyleComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50"><tr>
                        {["SO","ORIG. DATE","PLAN DATE","CLAIM DEPT","DELAY REASON","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.claimDepartment || "-"}</td>
                            <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{item.grossWeight != null ? Number(item.grossWeight).toFixed(2) : "-"}</td>
                            <td className="px-3 py-2">{item.airFreight != null ? Number(item.airFreight).toLocaleString() : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* NYG President — FINAL approval: whole document, one button, no reject.
          Reached only after all claim depts approved + Logistics data complete. */}
      {isPresidentRole && (
        <PresidentFinalCard req={req} bu="NYG" submitting={submitting === "_pres"}
          onApprove={async () => {
            setSubmitting("_pres")
            const res = await fetch(`/api/requests/${id}/approve`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "president_approve" })
            })
            if (res.ok) { window.location.href = "/approvals" }
            else { const e = await res.json().catch(()=>({})); alert(e.error || "Error"); setSubmitting(null) }
          }} />
      )}

      {/* (legacy per-style President UI — disabled; President is now the final approver) */}
      {false && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">STYLE APPROVAL — PRESIDENT</h2>
            <div className="flex gap-4 text-xs font-medium">
              <span className="text-gray-400">{styleGroups.filter(g => g.status === "PENDING" || g.status === "PASSED").length} earlier stage</span>
              <span className="text-blue-600">{styleGroups.filter(g => g.status === "VP_PASSED").length} ready to approve</span>
              <span className="text-green-600">{styleGroups.filter(g => g.status === "PRES_PASSED").length} approved</span>
              <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isBackScm = backToScmStyleOpen === g.style
            const isSub = submitting === g.style
            const isReady = g.status === "VP_PASSED"
            const isApproved = ["PRES_PASSED","LOG_PASSED","CLAIM_PASSED","COMPLETED"].includes(g.status)
            const isWaiting = g.status === "PENDING" || g.status === "PASSED"
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${isApproved ? "border-green-200" : g.status === "REJECTED" ? "border-red-200" : isBackScm ? "border-orange-200" : isWaiting ? "border-gray-200 opacity-60" : "border-purple-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isApproved ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : isBackScm ? "bg-orange-50" : isWaiting ? "bg-gray-50" : "bg-purple-50"}`}>
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-800 shrink-0">{g.style}</span>
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Gross Weight = <span className="font-medium text-gray-700">{fmtNum((g as any).totalGross, 2)} KG</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">EST Airfreight = <span className="font-medium text-blue-600">{fmtNum((g as any).totalEst)} THB</span></span>
                      {(g as any).totalActual > 0 && <>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">Actual = <span className="font-medium text-green-600">{fmtNum((g as any).totalActual)} THB</span></span>
                      </>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{g.items.length} SO(s)</span>
                  {isWaiting && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {g.status === "PENDING" ? "⏳ Waiting for SCM" : "⏳ Waiting for VP SCM"}
                    </span>
                  )}
                  {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved — Sent to Logistics</span>}
                  {g.status === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Rejected</span>}
                  {isReady && !isRej && !isBackScm && (
                    <div className="flex gap-2">
                      <button onClick={() => approveStyle(g.style)} disabled={isSub} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">{isSub ? "..." : "Approve"}</button>
                      <button onClick={() => { setRejectingStyle(g.style); setRejectComment(""); setBackToScmStyleOpen(null) }} disabled={isSub} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                      <button onClick={() => { setBackToScmStyleOpen(g.style); setBackToScmStyleComment(""); setRejectingStyle(null) }} disabled={isSub} className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">Back to SCM</button>
                    </div>
                  )}
                </div>
                {isRej && isReady && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectStyle(g.style)} disabled={isSub || !rejectComment.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isSub ? "..." : "Confirm Reject"}</button>
                      <button onClick={() => { setRejectingStyle(null); setRejectComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isBackScm && isReady && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM — specify reason *</label>
                    <textarea value={backToScmStyleComment} onChange={e => setBackToScmStyleComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button onClick={() => backToScmStyleFn(g.style)} disabled={isSub || !backToScmStyleComment.trim()} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">{isSub ? "..." : "Confirm Back to SCM"}</button>
                      <button onClick={() => { setBackToScmStyleOpen(null); setBackToScmStyleComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50"><tr>
                        {["SO","ORIG. DATE","PLAN DATE","CLAIM DEPT","DELAY REASON","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.claimDepartment || "-"}</td>
                            <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{item.grossWeight != null ? Number(item.grossWeight).toFixed(2) : "-"}</td>
                            <td className="px-3 py-2">{item.airFreight != null ? Number(item.airFreight).toLocaleString() : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* GW Style Approval — VP_MER_GW (PENDING → VP_MER_PASSED) and PRESIDENT_GW (PENDING → PRES_PASSED) */}
      {/* GW President — FINAL approval: whole document, one button, no reject.
          Reached only after all claim depts approved + Logistics data filled. */}
      {isPresidentGW && (
        <PresidentFinalCard req={req} bu="GW" submitting={submitting === "_pres"}
          onApprove={async () => {
            setSubmitting("_pres")
            const res = await fetch(`/api/requests/${id}/approve`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "president_approve_gw" })
            })
            if (res.ok) { window.location.href = "/approvals" }
            else { const e = await res.json().catch(()=>({})); alert(e.error || "Error"); setSubmitting(null) }
          }} />
      )}

      {(isVpMerGW || isGmGW) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">STYLES ({styleGroups.length})</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">GW · {isVpMerGW ? "DPM" : "GM"}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-4 text-xs font-medium">
                <span className="text-yellow-600">{styleGroups.filter(g => g.status === "PENDING").length} pending</span>
                <span className="text-green-600">{styleGroups.filter(g => ["VP_MER_PASSED","PRES_PASSED"].includes(g.status)).length} approved</span>
                <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
              </div>
              {styleGroups.some(g => g.status === "PENDING") && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox"
                    checked={styleGroups.filter(g => g.status === "PENDING").every(g => selectedStyles.has(g.style))}
                    onChange={e => {
                      const pending = styleGroups.filter(g => g.status === "PENDING").map(g => g.style)
                      setSelectedStyles(e.target.checked ? new Set(pending) : new Set())
                    }}
                    className="w-4 h-4" />
                  Select All
                </label>
              )}
              {selectedStyles.size > 0 && (
                <>
                <button onClick={approveSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? "..." : `Approve Selected (${selectedStyles.size})`}
                </button>
                <button onClick={rejectSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {submitting ? "..." : `Reject Selected (${selectedStyles.size})`}
                </button>
                </>
              )}
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isSub = submitting === g.style
            const isApproved = ["VP_MER_PASSED","PRES_PASSED"].includes(g.status)
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${isApproved ? "border-green-200" : g.status === "REJECTED" ? "border-red-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isApproved ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : "bg-white"}`}>
                  {g.status === "PENDING" && (
                    <input type="checkbox" className="w-4 h-4 shrink-0"
                      checked={selectedStyles.has(g.style)}
                      onChange={e => setSelectedStyles(prev => { const s = new Set(prev); e.target.checked ? s.add(g.style) : s.delete(g.style); return s })} />
                  )}
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-800 shrink-0">{g.style}</span>
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Gross Weight = <span className="font-medium text-gray-700">{fmtNum((g as any).totalGross, 2)} KG</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">EST Airfreight = <span className="font-medium text-blue-600">{fmtNum((g as any).totalEst)} THB</span></span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{g.items.length} SO(s)</span>
                  {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>}
                  {g.status === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Rejected</span>}
                  {g.status === "PENDING" && !isRej && (
                    <div className="flex gap-2">
                      <button onClick={() => approveStyle(g.style)} disabled={isSub} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">{isSub ? "..." : "Approve"}</button>
                      <button onClick={() => { setRejectingStyle(isRej ? null : g.style); setRejectComment("") }} disabled={isSub} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                    </div>
                  )}
                </div>
                {isRej && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectStyle(g.style)} disabled={isSub || !rejectComment.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isSub ? "..." : "Confirm Reject"}</button>
                      <button onClick={() => { setRejectingStyle(null); setRejectComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","CLAIM DEPT","REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2">{item.customerPO}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                            <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                            <td className="px-3 py-2">{req.claimDepartment ?? "-"}</td>
                            <td className="px-3 py-2">{item.reasonDelay}</td>
                            <td className="px-3 py-2">{item.factory}</td>
                            <td className="px-3 py-2">{item.country}</td>
                            <td className="px-3 py-2">{item.port}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* SCM processes VP_MER_PASSED items at PENDING_VP_MER */}
      {isScmAtVpMer && (
        <div className="space-y-4 border border-blue-200 rounded-xl bg-blue-50/20 p-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-gray-800 text-base">SCM — Assign Claim Dept</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {vpMerPassedItems.filter((i: any) => isScmItemReady(i)).length}/{vpMerPassedItems.length} assigned
                {scmPassedAtVpMer.length > 0 && <span className="text-green-600 ml-2">· {scmPassedAtVpMer.length} forwarded</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Export */}
              <button type="button" onClick={() => {
                const rows = vpMerPassedItems.map((item: any) => ({
                  "SO": item.so, "SUB": item.sub || "", "STYLE": item.style,
                  "CUSTOMER PO": item.customerPO || "", "DESCRIPTION": item.description || "",
                  "ORIG. DATE": item.originalShipmentDate ? new Date(item.originalShipmentDate).toLocaleDateString("en-GB") : "",
                  "PLAN DATE": item.planShipmentDate ? new Date(item.planShipmentDate).toLocaleDateString("en-GB") : "",
                  "QTY ORIG": item.qtyOriginalShipment, "QTY AIR": item.qtyRequestAir,
                  "GROSS WEIGHT (KG)": item.grossWeight ?? "", "EST. AIR FREIGHT (THB)": item.airFreight ?? "",
                  "FACTORY": item.factory || "", "COUNTRY": item.country || "", "PORT": item.port || "",
                  "CLAIM DEPT": (soClaimDepts[item.id] || []).map((d: any) => `${d.dept}:${d.pct}%`).join(", "), "SCM DELAY REASON": soClaimComments[item.id] || ""
                }))
                const ws = XLSX.utils.json_to_sheet(rows)
                ws["!cols"] = [8,6,12,14,22,12,12,10,10,14,16,10,12,12,16,24].map(w => ({ wch: w }))
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, "SCM")
                XLSX.writeFile(wb, `scm-claim-dept_${req.documentNo}.xlsx`)
              }} className="flex items-center gap-1.5 border border-gray-300 bg-white text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50">
                ↓ Export Excel
              </button>
              {/* Import */}
              <label className="flex items-center gap-1.5 border border-gray-300 bg-white text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 cursor-pointer">
                ↑ Import Excel
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const buf = await file.arrayBuffer()
                  const wb2 = XLSX.read(buf, { type: "buffer" })
                  const ws2 = wb2.Sheets[wb2.SheetNames[0]]
                  const rows2 = XLSX.utils.sheet_to_json(ws2, { defval: "" }) as any[]
                  const newDepts: Record<string, {dept: string, pct: number}[]> = {}
                  const newComments: Record<string, string> = {}
                  rows2.forEach((row: any) => {
                    const so = String(row["SO"] || "").trim()
                    const sub = String(row["SUB"] || "").trim()
                    const deptRaw = String(row["CLAIM DEPT"] || "").trim()
                    const reason = String(row["SCM DELAY REASON"] || "").trim()
                    const found = vpMerPassedItems.find((i: any) => i.so === so && (i.sub || "") === sub)
                    if (found) {
                      // Parse "DEPT:pct%" format or plain "DEPT" → [{dept, pct: 100}]
                      if (deptRaw) {
                        const parsed: {dept: string, pct: number}[] = deptRaw.split(",").map((s: string) => s.trim()).flatMap((s: string) => {
                          const m = s.match(/^([^:]+):(\d+)%?$/)
                          const d = m ? m[1].trim() : s; const p = m ? parseInt(m[2]) : 100
                          return CLAIM_DEPTS.includes(d) ? [{ dept: d, pct: p }] : []
                        })
                        if (parsed.length > 0) newDepts[(found as any).id] = parsed
                      }
                      if (reason) newComments[(found as any).id] = reason
                    }
                  })
                  if (Object.keys(newDepts).length > 0) setSoClaimDepts(p => ({ ...p, ...newDepts }))
                  if (Object.keys(newComments).length > 0) setSoClaimComments(p => ({ ...p, ...newComments }))
                  e.target.value = ""
                }} />
              </label>
              {/* Forward button */}
              {(() => {
                const readyStyles = [...new Set(vpMerPassedItems.filter((i: any) => isScmItemReady(i)).map((i: any) => i.style as string))]
                  .filter(style => vpMerPassedItems.filter((i: any) => i.style === style).every((i: any) => isScmItemReady(i)))
                const readyIds = vpMerPassedItems.filter((i: any) => readyStyles.includes(i.style)).map((i: any) => i.id as string)
                if (readyStyles.length === 0) return null
                return (
                  <button type="button" disabled={submitting === "_fwd_vpm"}
                    onClick={async () => {
                      setSubmitting("_fwd_vpm")
                      const depts: Record<string, {dept: string, pct: number}[]> = {}
                      const comments: Record<string, string> = {}
                      readyIds.forEach((iid: string) => {
                        depts[iid] = soClaimDepts[iid] || []
                        if (soClaimComments[iid]) comments[iid] = soClaimComments[iid]
                      })
                      const res = await fetch(`/api/requests/${id}/approve`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "approve", soClaimData: depts, soClaimComments: comments, comment: "" })
                      })
                      if (res.ok) {
                        const updated = await res.json()
                        if (updated.status !== "PENDING_VP_MER") { window.location.href = "/approvals" } else { setReq(updated) }
                      }
                      setSubmitting(null)
                    }}
                    className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                    {submitting === "_fwd_vpm" ? "..." : `Forward ${readyStyles.length} style(s) →`}
                  </button>
                )
              })()}
            </div>
          </div>

          {/* Flat table */}
          {vpMerPassedItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No style has been approved by VP MER yet</p>
          ) : (
            <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-blue-50/60 border-b border-blue-100">
                    <tr>
                      {["SO","SUB","STYLE","DESCRIPTION","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)","FACTORY","COUNTRY","PORT","CLAIM DEPT","SCM DELAY REASON"].map(h =>
                        <th key={h} className="px-3 py-2 text-left text-blue-700 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {vpMerPassedItems.map((item: any) => {
                      const dept = soClaimDepts[item.id] || []
                      const deptTotal = dept.reduce((s: number, d: any) => s + d.pct, 0)
                      return (
                        <tr key={item.id} className={isScmItemReady(item) ? "bg-green-50/40" : "bg-white hover:bg-blue-50/30"}>
                          <td className="px-3 py-2 font-semibold text-blue-900">{item.so}</td>
                          <td className="px-3 py-2 text-gray-500">{item.sub || "—"}</td>
                          <td className="px-3 py-2 text-gray-700">{item.style}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-48 truncate">{item.description || "—"}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2 text-blue-700">{item.grossWeight != null ? Number(item.grossWeight).toFixed(2) : "—"}</td>
                          <td className="px-3 py-2 text-blue-700">{item.airFreight != null ? Number(item.airFreight).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{item.factory || "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{item.country || "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{item.port || "—"}</td>
                          <td className="px-3 py-2 min-w-[200px]" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col gap-1">
                              {dept.map((d: any) => (
                                <span key={d.dept} className={`inline-flex items-start gap-0.5 text-[10px] rounded px-1.5 py-1 font-medium
                                  ${deptTotal === 100 ? "bg-green-100 text-green-800 border border-green-300" : "bg-amber-100 text-amber-800 border border-amber-300"}`}>
                                  <span className="flex-1">
                                    <span className="font-semibold">{CLAIM_DEPT_LABEL[d.dept] || d.dept} {d.pct}%</span>
                                    {d.reason && <span className="block text-[9px] opacity-70 mt-0.5">{d.reason}</span>}
                                  </span>
                                  <button type="button" onClick={() => setSoClaimDepts(p => {
                                    const n = {...p}; n[item.id] = (n[item.id] || []).filter((x: any) => x.dept !== d.dept)
                                    if (n[item.id].length === 0) delete n[item.id]; return n
                                  })} className="hover:text-red-500 ml-0.5 leading-none shrink-0">✕</button>
                                </span>
                              ))}
                              {deptTotal > 0 && deptTotal !== 100 && <span className="text-[10px] text-red-500 font-bold">{deptTotal}%</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="text" placeholder="SCM delay reason..."
                              value={soClaimComments[item.id] || ""}
                              onChange={e => setSoClaimComments(p => ({ ...p, [item.id]: e.target.value }))}
                              className="border border-blue-200 rounded-lg px-2 py-1 text-xs w-48 focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logistics: NYG = HAWB flow, GW = Excel upload */}
      {isLogisticsRole && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">LOGISTICS</h2>
            {/* Excel export/import — top-right of the Logistics frame */}
            <div className="flex items-center gap-2">
              <button onClick={async () => {
                if (!confirm("Clear all Logistics data (HAWB, INV, Actual Air) for this document?")) return
                setImportingLg(true)
                try {
                  const res = await fetch(`/api/requests/${id}/logistics-clear`, { method: "POST" })
                  if (res.ok) {
                    // Clear local logistics state too so nothing lingers in the UI
                    setSoInvMap({}); setItemLogistics({}); setItemActuals({}); setHawbGroups([])
                    const rr = await fetch(`/api/requests/${id}`); if (rr.ok) setReq(await rr.json())
                    setHawbRefreshKey(k => k + 1)
                  } else { alert("Failed to clear data") }
                } finally { setImportingLg(false) }
              }} className="text-xs bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium whitespace-nowrap">
                🗑 Clear data
              </button>
              <button onClick={async () => {
                const XLSX = await import("xlsx")
                // Full MER template columns; LG fills INV NO. / Actual Airfreight (= HAWB total) / HAWB#.
                const headers = ["No_Document","Brand name","BU","STYLE","SO","SUB","CUSTOMER PO","DESCRIPTION","WEIGHT(KG)","Original Shipment Date","Plan Shipment Date","QTY Original Shipment (pcs)","QTY Request ship Air (pcs)","Reason delay","Factory","Country","Port","INV NO.","Actual Airfreight","HAWB#","CLAIM DEPT 1","%CLAIM1","REASON 1","CLAIM DEPT 2","%CLAIM2","REASON 2","CLAIM DEPT 3","%CLAIM3","REASON 3"]
                const rows = presPassedItems.map((i: any) => {
                  const d: any[] = getSplits(i)
                  return [
                    req?.documentNo || "", req?.brandName || "", "GW", i.style || "", i.so || "", i.sub || "", i.customerPO || "",
                    i.description || "", i.grossWeight ?? "", fmtDate(i.originalShipmentDate), fmtDate(i.planShipmentDate),
                    i.qtyOriginalShipment ?? "", i.qtyRequestAir ?? "", i.reasonDelay || "", i.factory || "", i.country || "", i.port || "",
                    i.invoiceNo || "", i.actualAirFreight ?? "", i.hawbNo || "",
                    d[0]?.dept || "", d[0]?.pct ?? "", d[0]?.reason || "",
                    d[1]?.dept || "", d[1]?.pct ?? "", d[1]?.reason || "",
                    d[2]?.dept || "", d[2]?.pct ?? "", d[2]?.reason || "",
                  ]
                })
                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
                ws["!cols"] = [16,16,6,14,12,8,14,24,10,20,20,22,22,16,14,12,12,16,16,16,14,8,16,14,8,16,14,8,16].map(w => ({ wch: w }))
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, "GW")
                XLSX.writeFile(wb, `${req?.documentNo || id}_LG.xlsx`)
              }} className="text-xs bg-slate-100 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 font-medium whitespace-nowrap">
                ⬇ Export
              </button>
              <label className={`text-xs px-3 py-1.5 rounded-lg border font-medium cursor-pointer whitespace-nowrap ${importingLg ? "opacity-50 pointer-events-none bg-gray-50 border-gray-200 text-gray-400" : "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"}`}>
                {importingLg ? "Importing..." : "⬆ Import"}
                <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importingLg}
                  onChange={async e => {
                    const file = e.target.files?.[0]; e.target.value = ""
                    if (!file) return
                    setImportingLg(true)
                    try {
                      const XLSX = await import("xlsx")
                      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
                      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" })
                      const soToId: Record<string, string> = {}
                      presPassedItems.forEach((i: any) => { soToId[String(i.so).trim()] = i.id })
                      const groups: Record<string, { total: number; items: { id: string; inv: string }[] }> = {}
                      for (const r of rows) {
                        const hawb = String(r["HAWB#"] || "").trim()
                        const so = String(r["SO"] || "").trim()
                        const iid = soToId[so]
                        if (!hawb || !iid) continue
                        const total = parseFloat(String(r["Actual Airfreight"] || "").replace(/,/g, "")) || 0
                        const inv = String(r["INV NO."] || "").trim()
                        if (!groups[hawb]) groups[hawb] = { total: 0, items: [] }
                        if (total > groups[hawb].total) groups[hawb].total = total
                        groups[hawb].items.push({ id: iid, inv })
                      }
                      if (Object.keys(groups).length === 0) { alert("No matching HAWB# / SO data found"); setImportingLg(false); return }
                      let created = 0
                      for (const [hawbNo, g] of Object.entries(groups)) {
                        if (g.total <= 0 || g.items.length === 0) continue
                        const itemInvoices: Record<string, string> = {}
                        g.items.forEach(it => { if (it.inv) itemInvoices[it.id] = it.inv })
                        const res = await fetch(`/api/requests/${id}/hawb`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ hawbNo, totalCharge: g.total, itemIds: g.items.map(x => x.id), itemInvoices }),
                        })
                        if (res.ok) created++
                      }
                      const rr = await fetch(`/api/requests/${id}`); if (rr.ok) setReq(await rr.json())
                      setHawbRefreshKey(k => k + 1)
                      alert(`Successfully created ${created} HAWB from Excel`)
                    } catch (err) { console.error(err); alert("Import failed — check the Excel file") }
                    finally { setImportingLg(false) }
                  }} />
              </label>
            </div>
          </div>

          {/* HAWB-based flow (NYG + GW) */}
          {(isLogisticsRole || isLogisticsGW) && (
            <HawbSection
              requestId={id as string}
              presPassedItems={presPassedItems}
              refreshSignal={hawbRefreshKey}
              reqInfo={req ? { documentNo: req.documentNo, brandName: req.brandName, buName: req.buName } : undefined}
              onReqRefresh={async () => {
                const res = await fetch(`/api/requests/${id}`)
                if (res.ok) setReq(await res.json())
              }}
            />
          )}

          {/* Preview table — shows DB state after upload */}
          {pendingLogItems.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>{["SO","STYLE","QTY AIR","QTY ACTUAL","EST. (THB)","ACTUAL (THB)","INVOICE NO","HAWB #","BOOKING DATE"].map(h =>
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingLogItems.map((item: any) => {
                    const ready = item.invoiceNo && item.bookingDate && item.actualAirFreight != null
                    return (
                      <tr key={item.id} className={ready ? "bg-green-50" : "hover:bg-gray-50"}>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{item.so}</td>
                        <td className="px-3 py-2">{item.style}</td>
                        <td className="px-3 py-2">{item.qtyRequestAir}</td>
                        <td className="px-3 py-2">{item.qtyActualShip ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-gray-400">{fmtNum(item.airFreight)}</td>
                        <td className="px-3 py-2 font-semibold text-green-700">{item.actualAirFreight != null ? fmtNum(item.actualAirFreight) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2">{item.invoiceNo ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{item.invoiceNo}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2">{item.hawbNo ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{item.hawbNo}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{item.bookingDate ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{fmtDate(item.bookingDate)}</span> : <span className="text-gray-300">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Confirm button — reads ready items from DB state */}
          {(() => {
            const readyItems = pendingLogItems.filter((i: any) => i.invoiceNo && i.bookingDate && i.actualAirFreight != null)
            const canConfirm = readyItems.length > 0
            // Build itemActuals + itemLogistics from DB state for the approve call
            const dbActuals: Record<string, string> = {}
            const dbLogistics: Record<string, { invoiceNo: string; bookingDate: string }> = {}
            for (const item of readyItems) {
              dbActuals[item.id] = String(item.actualAirFreight)
              dbLogistics[item.id] = {
                invoiceNo: item.invoiceNo,
                bookingDate: item.bookingDate ? new Date(item.bookingDate).toISOString().split("T")[0] : ""
              }
            }
            return (
              <div className="space-y-1">
                <p className="text-xs text-gray-400">{readyItems.length}/{pendingLogItems.length} SO ready to forward</p>
                <button
                  disabled={submitting === "_" || !canConfirm}
                  onClick={async () => {
                    setSubmitting("_")
                    const res = await fetch(`/api/requests/${id}/approve`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "approve", itemActuals: dbActuals, itemLogistics: dbLogistics })
                    })
                    if (res.ok) {
                      const updated = await res.json()
                      setReq(updated)
                      if (!updated.items?.some((i: any) => i.itemStatus === "PRES_PASSED")) {
                        window.location.href = "/approvals"
                      }
                    } else { const err = await res.json(); alert(err.error || "Error") }
                    setSubmitting(null)
                  }}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting === "_" ? "..." : `Confirm & Forward ${readyItems.length} SO to Claim`}
                </button>
              </div>
            )
          })()}
        </div>
      )}

      {/* PROCUREMENT decision gate — full-screen modal popup */}
      {isProcureDvm && !procureDecision && !claimFwdDone && !showGwFinishForward && (() => {
        const fmtThb = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 })
        const activeItems = myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED")
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-5xl w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto">
              <div>
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">PROCUREMENT APPROVAL</p>
                <p className="text-xs text-gray-400">{activeItems.length} item(s) pending review</p>
              </div>
              {/* Items preview */}
              <div className="border border-gray-100 rounded-xl overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{["SO","STYLE","DESCRIPTION","PLAN DATE","QTY ORIG","QTY AIR","GROSS WT (KG)","EST. FREIGHT (THB)","ACTUAL (THB)","INVOICE NO","HAWB#","REASON","FACTORY","COUNTRY","PORT"].map(h =>
                      <th key={h} className="px-3 py-2 text-left text-gray-400 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {activeItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2 font-semibold text-gray-800">{item.so}{item.sub ? `/${item.sub}` : ""}</td>
                        <td className="px-3 py-2 text-gray-600">{item.style}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={item.description}>{item.description || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{item.planShipmentDate ? new Date(item.planShipmentDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "-"}</td>
                        <td className="px-3 py-2">{item.qtyOriginalShipment ?? "-"}</td>
                        <td className="px-3 py-2 font-medium">{item.qtyRequestAir}</td>
                        <td className="px-3 py-2">{item.grossWeight != null ? Number(item.grossWeight).toLocaleString("en-US",{maximumFractionDigits:2}) : "-"}</td>
                        <td className="px-3 py-2 text-blue-700 font-medium">{item.airFreight != null ? fmtThb(item.airFreight) : "-"}</td>
                        <td className="px-3 py-2 text-green-700 font-semibold">{item.actualAirFreight != null ? fmtThb(item.actualAirFreight) : ""}</td>
                        <td className="px-3 py-2 text-gray-600">{item.invoiceNo || ""}</td>
                        <td className="px-3 py-2 text-gray-600">{item.hawbNo || ""}</td>
                        <td className="px-3 py-2 text-amber-700 max-w-[160px] truncate" title={item.reasonDelay || item.itemComment || ""}>{item.reasonDelay || item.itemComment || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{item.factory || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{item.country || "-"}</td>
                        <td className="px-3 py-2 text-gray-600">{item.port || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-right text-xs font-semibold text-gray-500">PROCUREMENT SUBTOTAL</td>
                      <td className="px-3 py-2 text-blue-700 font-bold text-xs">{fmtThb(activeItems.reduce((s: number, i: any) => s + (i.airFreight || 0), 0))}</td>
                      <td className="px-3 py-2 text-green-700 font-bold text-xs">{activeItems.some((i: any) => i.actualAirFreight != null) ? fmtThb(activeItems.reduce((s: number, i: any) => s + (i.actualAirFreight || 0), 0)) : ""}</td>
                      <td colSpan={6} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[10px] text-gray-400">* ACTUAL AIR FREIGHT shown in the document header is the total across all departments — figures above are PROCUREMENT only.</p>
              {/* Decision buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setProcureDecision("approve")}
                  className="bg-green-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-green-700 text-xs flex items-center justify-center gap-2 text-center transition-colors">
                  <span className="leading-none">✓</span>
                  <span className="tracking-wide">PURCHASING APPROVE</span>
                </button>
                <button onClick={() => setProcureDecision("forward")}
                  className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-700 text-xs flex items-center justify-center gap-2 text-center transition-colors">
                  <span className="leading-none">→</span>
                  <span className="tracking-wide">SOURCING APPROVE</span>
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Claim Forward Section — P1 roles only; CLAIM_NEXT_APPROVER uses inline forward inside per-SO section */}
      {isClaimP1ForForward && !claimFwdDone && !showGwFinishForward && (!isProcureDvm || procureDecision === "forward") && (() => {
        const estTotal = myClaimItems.reduce((s: number, i: any) => s + (i.airFreight || 0), 0)
        const actTotal = myClaimItems.reduce((s: number, i: any) => {
          if (!claimDept) return s + (i.actualAirFreight || 0)
          const depts: any[] = Array.isArray(i.claimDepts) && i.claimDepts.length > 0 ? i.claimDepts : (i.claimDepartment ? [{ dept: i.claimDepartment, pct: 100 }] : [])
          const match = depts.find((d: any) => d.dept === claimDept)
          return s + (match ? (i.actualAirFreight || 0) * match.pct / 100 : (i.actualAirFreight || 0))
        }, 0)
        const hasActual = myClaimItems.some((i: any) => i.actualAirFreight > 0)
        const fmtThb = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 })
        return (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {isProcureDvm && (
              <>
                <button onClick={() => setProcureDecision(null)} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">← Back</button>
                <div className="w-px h-4 bg-gray-200 shrink-0" />
              </>
            )}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest shrink-0">Forward to</p>

            {/* People search / selected */}
            <div className="relative flex items-center gap-2 flex-1 min-w-0">
              {!claimFwdSelected ? (
                <>
                  <div className="relative flex-1 min-w-0 max-w-xs">
                    <input value={claimFwdQ}
                      onChange={async e => {
                        const q = e.target.value; setClaimFwdQ(q); setClaimFwdOpen(true)
                        if (q.length < 2) { setClaimFwdResults([]); return }
                        setClaimFwdLoading(true)
                        try {
                          const r = await fetch(`/api/people?q=${encodeURIComponent(q)}`); const data = await r.json()
                          setClaimFwdResults(Array.isArray(data) ? data : [])
                        } catch { setClaimFwdResults([]) } finally { setClaimFwdLoading(false) }
                      }}
                      onFocus={() => setClaimFwdOpen(true)}
                      onBlur={() => setTimeout(() => setClaimFwdOpen(false), 200)}
                      placeholder="Search name or email..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    {claimFwdQ && (
                      <button type="button"
                        onMouseDown={e => { e.preventDefault(); setClaimFwdQ(""); setClaimFwdResults([]); setClaimFwdOpen(false) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 leading-none text-sm">✕</button>
                    )}
                    {claimFwdLoading && <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">...</span>}
                  </div>
                  {claimFwdOpen && claimFwdResults.length > 0 && (
                    <div className="absolute top-full left-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 w-80 overflow-hidden">
                      {claimFwdResults.map((p: any, i: number) => {
                        const initials = (p.name || "?").split(" ").slice(0, 2).map((n: string) => n[0] || "").join("").toUpperCase()
                        return (
                          <div key={i} onMouseDown={() => { setClaimFwdSelected({ name: p.name, email: p.email }); setClaimFwdResults([]); setClaimFwdOpen(false) }}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center shrink-0 select-none">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                              <p className="text-[11px] text-gray-400 truncate">{p.email}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                  <p className="text-xs font-semibold text-blue-800 truncate">{claimFwdSelected.name}</p>
                  <span className="text-[11px] text-blue-400 truncate hidden sm:inline">{claimFwdSelected.email}</span>
                  <button onClick={() => setClaimFwdSelected(null)} className="text-blue-300 hover:text-blue-600 shrink-0 ml-1">✕</button>
                </div>
              )}
            </div>

            {/* Forward button */}
            <button onClick={() => claimForward(false)} disabled={!claimFwdSelected || claimFwdSaving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0">
              {claimFwdSaving ? "Sending..." : "Forward →"}
            </button>

          </div>
        </div>
        )
      })()}
      {claimFwdDone && !isGWRequest && (
        <div className={`rounded-xl px-4 py-3 mb-4 text-sm font-medium flex items-center gap-2 ${claimFwdDone === "final" ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
          <span className="text-base">{claimFwdDone === "final" ? "✓" : "→"}</span>
          {claimFwdDone === "final" ? "Approved — document is moving forward. Accounting has been notified." : `Forwarded to ${claimFwdDone.replace("forwarded:","")} successfully.`}
        </div>
      )}
      {claimFwdDone === "final" && myClaimItems.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">DOWNLOAD PDF</p>
          <div className="flex flex-wrap gap-2">
            {myClaimItems.map((item: any) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <span className="text-xs text-gray-600">{item.so}</span>
                <PdfDownloadButton req={req} item={item} compact alwaysShow />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLAIM_NEXT_APPROVER per-SO approval (NYG legacy; GW uses the per-dept panel) */}
      {isClaimNextApprover && !isGWRequest && !claimFwdDone && !showGwFinishForward && (() => {
        // Use session claimDepartment (sourced from request.claimDepartment at login) to filter correct dept items
        const nextApproverDept = (session?.user as any)?.claimDepartment || (req as any).claimDepartment || null
        const nextItems = (req?.items || []).filter((i: any) =>
          (i.itemStatus === "LOG_PASSED" || i.itemStatus === "CLAIM_PASSED") &&
          (!nextApproverDept || i.claimDepartment === nextApproverDept)
        )
        if (nextItems.length === 0) return null
        const pendingItems = nextItems.filter((i: any) => i.itemStatus === "LOG_PASSED")
        const approvedCount = nextItems.filter((i: any) => i.itemStatus === "CLAIM_PASSED").length
        const allDone = pendingItems.length === 0 && approvedCount > 0
        const allSel = pendingItems.length > 0 && pendingItems.every((i: any) => nextSelected.has(i.id))
        return (
          <div className="space-y-3">
            {/* Header row 1: title + counts + select/approve buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-800">SO APPROVAL — {nextApproverDept || "CLAIM"} ({nextItems.length})</h2>
                {nextIntent && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${nextIntent === "done" || nextIntent === "send_boss" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {nextIntent === "done" ? "Approve & Done" : nextIntent === "send_boss" ? "Auto → Boss" : "Approve & Send to next"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                <span className={pendingItems.length > 0 ? "text-yellow-600" : "text-gray-300"}>{pendingItems.length} pending</span>
                <span className="text-green-600">{approvedCount} approved</span>
                {pendingItems.length > 0 && (
                  <button onClick={() => setNextSelected(allSel ? new Set() : new Set(pendingItems.map((i: any) => i.id)))}
                    className="text-blue-600 hover:underline">
                    {allSel ? "Deselect All" : `Select All (${pendingItems.length})`}
                  </button>
                )}
                {nextSelected.size > 0 && (
                  <button disabled={!!submitting} onClick={async () => {
                    const ids = Array.from(nextSelected)
                    const succeeded = new Set<string>()
                    for (const itemId of ids) {
                      setSubmitting(itemId)
                      const r = await fetch(`/api/requests/${id}/approve`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "approve_so_next", itemId })
                      })
                      if (r.ok) {
                        const updated = await r.json()
                        setReq(updated)
                        succeeded.add(itemId)
                      } else {
                        const err = await r.json().catch(() => ({}))
                        alert(err.error || `Approve failed (${r.status})`)
                        break
                      }
                    }
                    setNextSelected(prev => { const s = new Set(prev); succeeded.forEach(id => s.delete(id)); return s })
                    setSubmitting(null)
                  }} className="bg-green-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                    {submitting ? "..." : `Approve Selected (${nextSelected.size})`}
                  </button>
                )}
              </div>
            </div>

            {/* Person picker — shown when intent = "send", required before final action */}
            {nextIntent === "send" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700">Select the next person to approve</p>
                {!nextForwardTo ? (
                  <div className="relative">
                    <input value={nextFwdQ}
                      onChange={async e => {
                        const q = e.target.value; setNextFwdQ(q); setNextFwdOpen(true)
                        if (q.length < 2) { setNextFwdResults([]); return }
                        setNextFwdLoading(true)
                        try {
                          const r = await fetch(`/api/people?q=${encodeURIComponent(q)}`); const data = await r.json()
                          setNextFwdResults(Array.isArray(data) ? data : [])
                        } catch { setNextFwdResults([]) } finally { setNextFwdLoading(false) }
                      }}
                      onFocus={() => setNextFwdOpen(true)}
                      onBlur={() => setTimeout(() => setNextFwdOpen(false), 200)}
                      placeholder="Search name or email..."
                      className="w-full border border-blue-300 rounded-lg px-3 py-1.5 pr-7 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    {nextFwdQ && <button type="button" onMouseDown={e => { e.preventDefault(); setNextFwdQ(""); setNextFwdResults([]) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">✕</button>}
                    {nextFwdLoading && <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">...</span>}
                    {nextFwdOpen && nextFwdResults.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 w-full overflow-hidden">
                        {nextFwdResults.map((p: any, i: number) => (
                          <div key={i} onMouseDown={() => { setNextForwardTo({ name: p.name, email: p.email }); setNextFwdResults([]); setNextFwdQ(""); setNextFwdOpen(false) }}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 cursor-pointer">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                              {(p.name||"?").split(" ").slice(0,2).map((n: string) => n[0]||"").join("").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                              <p className="text-xs text-gray-400 truncate">{p.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-blue-200 text-blue-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                      {(nextForwardTo.name||"?").split(" ").slice(0,2).map((n: string) => n[0]||"").join("").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-800 truncate">{nextForwardTo.name}</p>
                      <p className="text-xs text-blue-400 truncate">{nextForwardTo.email}</p>
                    </div>
                    <button onClick={() => setNextForwardTo(null)} className="text-blue-300 hover:text-blue-600 shrink-0 text-sm">✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Final action bar — shown when all SOs approved */}
            {allDone && nextIntent !== "send_boss" && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-green-700">All items approved</p>
                {nextIntent === "done" && (
                  <button disabled={claimFwdSaving} onClick={() => claimForward(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                    {claimFwdSaving ? "Processing..." : "✓ Approve & Done"}
                  </button>
                )}
                {nextIntent === "send" && (
                  nextForwardTo ? (
                    <button disabled={claimFwdSaving} onClick={() => claimForwardTo(nextForwardTo.email, nextForwardTo.name)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                      {claimFwdSaving ? "Sending..." : `→ Forward to ${nextForwardTo.name}`}
                    </button>
                  ) : (
                    <span className="text-xs text-orange-600 font-medium">Select the next person first</span>
                  )
                )}
              </div>
            )}
            {allDone && nextIntent === "send_boss" && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-700">
                <span className="animate-pulse">•</span> Forwarding to supervisor...{vpProcureBoss ? ` (${vpProcureBoss.name})` : ""}
              </div>
            )}

            {nextItems.map((item: any) => {
              const isPending = item.itemStatus === "LOG_PASSED"
              const isPassed = item.itemStatus === "CLAIM_PASSED"
              const isSub = submitting === item.id
              const isExp = expanded.has(item.id)
              return (
                <div key={item.id} className={`rounded-xl border overflow-hidden ${isPassed ? "border-green-200" : "border-gray-200"}`}>
                  <div className={`flex flex-wrap items-center gap-2 px-4 py-3 ${isPassed ? "bg-green-50" : "bg-white"}`}>
                    <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                    {isPending && (
                      <input type="checkbox" className="w-4 h-4 shrink-0"
                        checked={nextSelected.has(item.id)}
                        onChange={e => setNextSelected(prev => { const s = new Set(prev); e.target.checked ? s.add(item.id) : s.delete(item.id); return s })}
                      />
                    )}
                    <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}{item.sub ? `/${item.sub}` : ""}</span>
                    <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                    {isPassed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved → VP</span>}
                    {isPending && (
                      <div className="flex items-center gap-2 ml-auto shrink-0">
                        <button disabled={isSub} onClick={async () => {
                          setSubmitting(item.id)
                          const r = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so_next", itemId: item.id })
                          })
                          if (r.ok) { r.json().then(setReq) }
                          else { const err = await r.json().catch(() => ({})); alert(err.error || `Approve failed (${r.status})`) }
                          setSubmitting(null)
                        }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                          {isSub ? "..." : "Approve"}
                        </button>
                        <button disabled={isSub} onClick={() => setBackToScmSo(item.id)}
                          className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 disabled:opacity-50">
                          Back to SCM
                        </button>
                      </div>
                    )}
                  </div>
                  {isExp && (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead className="bg-gray-50">
                          <tr>{["SO","STYLE","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)","ACTUAL (THB)","INVOICE NO","HAWB#","CLAIM DEPT","DELAY REASON","FACTORY","COUNTRY","PORT"].map(h =>
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}{item.sub ? `/${item.sub}` : ""}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                            <td className="px-3 py-2">{item.customerPO || "—"}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                            <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2 text-blue-700">{fmtNum(item.grossWeight, 2)}</td>
                            <td className="px-3 py-2 text-blue-700">{fmtNum(item.airFreight)}</td>
                            <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.invoiceNo || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.hawbNo || "—"}</td>
                            <td className="px-3 py-2">{item.claimDepartment || "—"}</td>
                            <td className="px-3 py-2">{item.reasonDelay || "—"}</td>
                            <td className="px-3 py-2">{item.factory || "—"}</td>
                            <td className="px-3 py-2">{item.country || "—"}</td>
                            <td className="px-3 py-2">{item.port || "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Initial decision popup for CLAIM_NEXT_APPROVER (non-PROCUREMENT depts) — shown once on page load */}
      {isClaimNextApprover && nextInitialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">CLAIM APPROVAL</p>
              <h3 className="font-bold text-gray-800 text-base">What should happen after approval is complete?</h3>
              <p className="text-xs text-gray-400 mt-1">Select first, then approve each SO one by one</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setNextIntent("send"); setNextInitialModal(false) }}
                className="w-full border border-blue-400 text-blue-700 bg-blue-50 px-4 py-3 rounded-xl font-semibold text-sm text-left flex items-start gap-3 hover:bg-blue-600 hover:text-white transition-colors group">
                <span className="text-lg leading-none mt-0.5">→</span>
                <div>
                  <p className="font-bold">Approve & Send to next</p>
                  <p className="text-xs text-blue-400 group-hover:text-blue-100 mt-0.5">Approve and forward to the next person to approve</p>
                </div>
              </button>
              <button onClick={() => { setNextIntent("done"); setNextInitialModal(false) }}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-green-700 text-sm text-left flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">✓</span>
                <div>
                  <p className="font-bold">Approve & Done</p>
                  <p className="text-xs text-green-200 mt-0.5">Approve and finish the process</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MER (GW) re-selects claim dept for SOs a claim dept sent back */}
      {role === "MER_GW" && isGWRequest && req.status === "PENDING_CLAIM_REJECT_GW" && (
        <div className="bg-white rounded-xl border border-red-200 p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-red-700">Claim Rejected — Re-select Claim Department</h2>
            <p className="text-xs text-gray-500 mt-0.5">A claim department sent these SO(s) back. Adjust the claim department / % (total must = 100) and resubmit.</p>
          </div>
          {(req.items || []).filter((i: any) => i.itemStatus === "CLAIM_REJECT_GW").map((item: any) => {
            const rows = reassign[item.id] || getSplits(item).map((s: any) => ({ dept: s.dept, pct: String(s.pct ?? ""), reason: s.reason || "" }))
            const setRows = (r: any[]) => setReassign(p => ({ ...p, [item.id]: r }))
            const total = rows.reduce((a: number, r: any) => a + (Number(r.pct) || 0), 0)
            const isSub = submitting === item.id
            return (
              <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-semibold text-gray-800">{item.so} · {item.style}</span>
                  {item.itemComment && <span className="text-xs text-red-600">Reason: {item.itemComment}</span>}
                </div>
                {rows.map((r: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <select value={r.dept} onChange={e => { const n = [...rows]; n[idx] = { ...r, dept: e.target.value }; setRows(n) }}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                      <option value="">Select dept...</option>
                      {["SCM NYK", "SCM NYG", "GW", "SUPPLIER"].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="number" value={r.pct} onChange={e => { const n = [...rows]; n[idx] = { ...r, pct: e.target.value }; setRows(n) }}
                      placeholder="%" className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                    <input value={r.reason} onChange={e => { const n = [...rows]; n[idx] = { ...r, reason: e.target.value }; setRows(n) }}
                      placeholder="Reason" className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                    {rows.length > 1 && <button onClick={() => setRows(rows.filter((_: any, i: number) => i !== idx))} className="text-red-400 hover:text-red-600 text-sm">✕</button>}
                  </div>
                ))}
                <div className="flex items-center gap-3 flex-wrap">
                  {rows.length < 4 && <button onClick={() => setRows([...rows, { dept: "", pct: "", reason: "" }])} className="text-xs text-blue-600 hover:underline">+ Add split</button>}
                  <span className={`text-xs font-medium ${total === 100 ? "text-green-600" : "text-red-600"}`}>Total: {total}%</span>
                  <button
                    disabled={isSub || total !== 100 || rows.some((r: any) => !r.dept)}
                    onClick={async () => {
                      setSubmitting(item.id)
                      const res = await fetch(`/api/requests/${id}/approve`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "resubmit_claim_gw", itemId: item.id, claimDepts: rows.map((r: any) => ({ dept: r.dept, pct: Number(r.pct) || 0, reason: r.reason || null })) })
                      })
                      if (res.ok) { setReq(await res.json()); setReassign(p => { const n = { ...p }; delete n[item.id]; return n }) }
                      else { const e = await res.json(); alert(e.error || "Error") }
                      setSubmitting(null)
                    }}
                    className="ml-auto px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-40">
                    {isSub ? "..." : "Resubmit to Claim"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* GW per-department Finish / Forward panel (independent per dept) */}
      {showGwFinishForward && (
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">CLAIM — {gwFwdCanonicalDept}</h2>
            </div>
            {/* Actions (right, small — same as GM) */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-yellow-600 font-medium">{gwFwdItems.length} SO pending{claimSelIds.length ? ` · ${claimSelIds.length} selected` : ""}</span>
              <button onClick={() => setClaimTableView(v => !v)}
                className="text-xs text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1 hover:bg-gray-50 font-medium">
                {claimTableView ? "▤ Card view" : "▤ Table view"}
              </button>
              <button onClick={exportClaimExcel}
                className="text-xs text-green-700 border border-green-300 rounded-lg px-2.5 py-1 hover:bg-green-50 font-medium">
                ⬇ Export Excel
              </button>
              {gwFwdItems.length > 0 && (
                <button onClick={() => setDvmSelected(claimSelIds.length === gwFwdItems.length ? new Set() : new Set(gwFwdItems.map((i: any) => i.id)))}
                  className="text-xs text-blue-600 hover:underline">
                  {claimSelIds.length === gwFwdItems.length ? "Clear" : `Select All (${gwFwdItems.length})`}
                </button>
              )}
              <button onClick={() => { setClaimFwdSelected(null); setClaimFwdQ(""); setGwModalOpen(true) }} disabled={claimFwdSaving}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-40">
                {claimFwdSaving ? "..." : (claimSelIds.length ? `✓ Approve Selected (${claimSelIds.length})` : `✓ Approve All (${gwFwdItems.length})`)}
              </button>
              <button onClick={() => { setBackReason(""); setBackModalOpen(true) }} disabled={claimFwdSaving}
                className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-40">
                ↩ {isGWRequest ? "Back to MER" : "Back to SCM"}{claimSelIds.length ? ` (${claimSelIds.length})` : ""}
              </button>
            </div>
          </div>
          {/* Quick summary — see totals + tap SO to select all */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Select SO to approve</p>
              <div className="relative mt-1">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m21 21-4.3-4.3" /></svg>
                <input value={soPick}
                  onChange={e => { setSoPick(e.target.value); setSoPickMsg("") }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return
                    const q = soPick.trim(); if (!q) return
                    // Exact SO only — type the full SO number, then Enter to select.
                    const matches = gwFwdItems.filter((i: any) => String(i.so).toLowerCase() === q.toLowerCase())
                    if (matches.length === 0) { setSoPickMsg(`No SO "${q}" — type the full SO`); return }
                    setDvmSelected(prev => { const n = new Set(prev); matches.forEach((i: any) => n.add(i.id)); return n })
                    setSoPickMsg(`✓ +${matches.length} added`); setSoPick("")
                  }}
                  placeholder="Type SO + Enter"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <p className={`text-[10px] mt-0.5 font-medium ${soPickMsg.startsWith("✓") ? "text-green-600" : soPickMsg ? "text-red-500" : "text-gray-400"}`}>
                {soPickMsg || (claimSelIds.length ? `${claimSelIds.length} selected` : " ")}
              </p>
            </div>
            <div className="px-4 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Estimate Air Freight (THB)</p>
              <p className="text-lg font-bold text-gray-700 tabular-nums">{claimTotals.myEst.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 tabular-nums">of {claimTotals.est.toLocaleString()}</p>
            </div>
            <div className="px-4 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Actual Air Freight (THB)</p>
              <p className="text-lg font-bold text-blue-700 tabular-nums">{claimTotals.amt.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 tabular-nums">of {claimTotals.actual.toLocaleString()}</p>
            </div>
          </div>
          {/* Attach supporting files — by DOCUMENT */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 gap-2 flex-wrap">
            <span className="text-xs text-gray-600">Attach supporting files (by document)</span>
            <label className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border font-medium ${uploadingItem === "_req" ? "opacity-50 pointer-events-none bg-gray-50 border-gray-200 text-gray-400" : "border-blue-300 text-blue-600 hover:bg-blue-50"}`}>
              {uploadingItem === "_req" ? "Uploading..." : "📎 Attach File"}
              <input type="file" className="hidden" multiple disabled={uploadingItem === "_req"}
                onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ""; for (const f of files) await attachFileFn(f) }} />
            </label>
          </div>
          {/* Flat table view — all SO at once, no expand */}
          {claimTableView && (() => {
            // Full column set — MER-uploaded fields + Logistics fields + claim.
            const RIGHT = new Set(["QTY ORIG", "QTY AIR", "GROSS (KG)", "EST. (THB)", "ACTUAL (THB)", "CLAIM %", "MY EST (THB)", "MY CLAIM (THB)"])
            const cols: { h: string; get: (it: any) => any }[] = [
              { h: "SO", get: it => it.so },
              { h: "SUB", get: it => it.sub || "-" },
              { h: "STYLE", get: it => it.style },
              { h: "CUSTOMER PO", get: it => it.customerPO || "-" },
              { h: "DESCRIPTION", get: it => it.description || "-" },
              { h: "GMT TYPE", get: it => it.gmtType || "-" },
              { h: "ORIG. DATE", get: it => fmtDate(it.originalShipmentDate) },
              { h: "PLAN DATE", get: it => fmtDate(it.planShipmentDate) },
              { h: "QTY ORIG", get: it => fmtNum(it.qtyOriginalShipment) },
              { h: "QTY AIR", get: it => fmtNum(it.qtyRequestAir) },
              { h: "GROSS (KG)", get: it => it.grossWeight != null ? fmtNum(it.grossWeight, 2) : "-" },
              { h: "EST. (THB)", get: it => fmtNum(it.airFreight) },
              { h: "FACTORY", get: it => it.factory || "-" },
              { h: "COUNTRY", get: it => it.country || "-" },
              { h: "PORT", get: it => it.port || "-" },
              { h: "DELAY REASON", get: it => it.reasonDelay || "-" },
              { h: "HAWB#", get: it => it.hawbNo || "-" },
              { h: "INVOICE", get: it => it.invoiceNo || "-" },
              { h: "BOOKING DATE", get: it => fmtDate(it.bookingDate) },
              { h: "ACTUAL (THB)", get: it => fmtNum(it.actualAirFreight) },
              { h: "CLAIM %", get: it => `${claimRow(it).pct}%` },
              { h: "MY EST (THB)", get: it => fmtNum(claimRow(it).myEst) },
              { h: "MY CLAIM (THB)", get: it => fmtNum(claimRow(it).amt) },
            ]
            return (
            <div className="border border-gray-200 rounded-xl overflow-auto max-h-[70vh]">
              <table className="text-xs w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 w-8 sticky left-0 top-0 bg-gray-50 z-30"></th>
                    {cols.map(c => (
                      <th key={c.h} className={`px-3 py-2 font-medium text-gray-500 whitespace-nowrap sticky top-0 bg-gray-50 ${RIGHT.has(c.h) ? "text-right" : "text-left"} ${c.h === "SO" ? "left-8 z-30" : "z-20"}`}>{c.h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* TOTAL on top */}
                  <tr className="border-b-2 border-gray-200 bg-gray-100 font-semibold">
                    <td className="sticky left-0 bg-gray-100 z-10"></td>
                    {cols.map(c => (
                      <td key={c.h} className={`px-3 py-2 ${RIGHT.has(c.h) ? "text-right tabular-nums" : ""} ${c.h === "ACTUAL (THB)" ? "text-green-700" : ""} ${c.h === "MY CLAIM (THB)" ? "text-blue-700" : ""} ${c.h === "SO" ? "sticky left-8 bg-gray-100 z-10 text-gray-700" : ""}`}>
                        {c.h === "SO" ? "TOTAL" : c.h === "QTY AIR" ? fmtNum(claimTotals.qty) : c.h === "EST. (THB)" ? fmtNum(claimTotals.est) : c.h === "ACTUAL (THB)" ? fmtNum(claimTotals.actual) : c.h === "MY EST (THB)" ? fmtNum(claimTotals.myEst) : c.h === "MY CLAIM (THB)" ? fmtNum(claimTotals.amt) : ""}
                      </td>
                    ))}
                  </tr>
                  {gwFwdItemsSorted.map((item: any) => { const sel = dvmSelected.has(item.id); return (
                      <tr key={item.id} className={`hover:bg-gray-50 ${sel ? "bg-blue-50/40" : "bg-white"}`}>
                        <td className={`px-2 py-1.5 text-center sticky left-0 z-10 ${sel ? "bg-blue-50/40" : "bg-white"}`}>
                          <input type="checkbox" checked={sel}
                            onChange={e => setDvmSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-600" />
                        </td>
                        {cols.map(c => (
                          <td key={c.h}
                            className={`px-3 py-1.5 ${RIGHT.has(c.h) ? "text-right tabular-nums" : "whitespace-nowrap"} ${c.h === "ACTUAL (THB)" ? "text-green-700 font-semibold" : ""} ${c.h === "MY CLAIM (THB)" ? "text-blue-700 font-semibold" : ""} ${c.h === "SO" ? `font-semibold text-gray-800 sticky left-8 z-10 ${sel ? "bg-blue-50/40" : "bg-white"}` : ""} ${c.h === "DESCRIPTION" ? "max-w-[180px] truncate" : ""}`}
                            title={c.h === "DESCRIPTION" || c.h === "DELAY REASON" ? String(c.get(item)) : undefined}>
                            {c.get(item)}
                          </td>
                        ))}
                      </tr>
                  )})}
                </tbody>
              </table>
            </div>
            )
          })()}
          {/* SO list — checkbox + expandable full detail (same template as SCM NYK) */}
          {!claimTableView && (
          <div className="space-y-2">
            {gwFwdItemsSorted.map((item: any) => {
              const sp = getSplits(item).find((s: any) => gwFwdSplitDepts.includes(s.dept))
              const actual = item.actualAirFreight ?? 0
              const pctV = Number(sp?.pct) || 0
              const amt = Math.round(actual * pctV / 100)
              const myEst = Math.round((Number(item.airFreight) || 0) * pctV / 100)
              const isExp = expanded.has(item.id)
              return (
                <div key={item.id} className={`rounded-xl border overflow-hidden ${dvmSelected.has(item.id) ? "border-blue-300 bg-blue-50/40" : "border-gray-200 bg-white"}`}>
                  <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3">
                    <input type="checkbox" checked={dvmSelected.has(item.id)}
                      onChange={e => setDvmSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                      className="w-4 h-4 rounded border-gray-300 shrink-0 cursor-pointer accent-blue-600" />
                    <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                    <span className="font-bold text-gray-800">{item.so}</span>
                    <span className="text-xs text-gray-500">{item.style} · qty {item.qtyRequestAir}</span>
                    <div className="ml-auto flex items-center gap-4 text-xs flex-wrap">
                      <span className="text-gray-500">HAWB# <b className="text-gray-700">{item.hawbNo || "-"}</b></span>
                      <span className="text-gray-500">Estimate <b className="text-gray-700">{myEst.toLocaleString()}</b> ({pctV}%)</span>
                      <span className="text-blue-700 font-semibold">Actual {amt.toLocaleString()}</span>
                    </div>
                  </div>
                  {isExp && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead className="bg-gray-50">
                            <tr>{["SO","STYLE","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)","ACTUAL (THB)","INVOICE NO","HAWB#","BOOKING DATE","DELAY REASON","FACTORY","COUNTRY","PORT"].map(h =>
                              <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">{item.so}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                              <td className="px-3 py-2">{item.customerPO}</td>
                              <td className="px-3 py-2">{item.description}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                              <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                              <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                              <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                              <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                              <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                              <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{item.hawbNo || "-"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                              <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                              <td className="px-3 py-2">{item.factory}</td>
                              <td className="px-3 py-2">{item.country}</td>
                              <td className="px-3 py-2">{item.port}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Claim Split</p>
                        <ClaimSplitTable item={item} highlightDept={gwFwdCanonicalDept} showCrNo={isNykClaimRole} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}
          {/* Helper note (buttons moved to the header row above) */}
          <p className="text-[11px] text-gray-400">
            {gwIsLastPos ? "Final position — approve to finish the process." : <>Approve, then forward to the next position: <b className="text-gray-600">{gwNextPosLabel}</b></>}
          </p>
        </div>
      )}

      {/* Claim action popup — forward to next approver OR finish the process */}
      {gwModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => !claimFwdSaving && setGwModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-base font-bold text-gray-800">Approve — {gwFwdCanonicalDept} <span className="font-normal text-gray-400 text-sm">({claimActIds.length} SO)</span></h3>
            </div>
            {!gwIsLastPos && (
              // Forced next position — must pick a person (name free, position fixed).
              // Procurement step 0 also forces choosing a branch (Purchasing / Sourcing).
              <div className="space-y-3">
                {gwNeedsBranch && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-gray-600">Route to <span className="text-red-500">*</span></p>
                    <div className="flex gap-2">
                      {PROCUREMENT_BRANCHES.map((b: string) => (
                        <button key={b} onClick={() => setGwBranchChoice(b)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium border ${gwBranchChoice === b ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(!gwNeedsBranch || gwBranchChoice) && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-blue-800">Please select <span className="text-blue-900 underline">{gwNextPosLabel}</span> for approve <span className="text-red-500">*</span></p>
                    <PersonPicker label={gwNextPosLabel || "Next"} selected={claimFwdSelected} onSelect={setClaimFwdSelected} placeholder={`Search a name for ${gwNextPosLabel}...`} position={gwNextPosLabel || undefined} positionRole={gwNextPosRole} requestId={String(id)} bu={req?.bu} onRequestAdd={requestNewApprover} />
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={() => setGwModalOpen(false)} disabled={claimFwdSaving}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">Cancel</button>
              {gwIsLastPos ? (
                <button onClick={async () => { await claimForward(true, claimActIds); setGwModalOpen(false) }} disabled={claimFwdSaving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40">
                  {claimFwdSaving ? "..." : `Done — Finish process${claimSelIds.length ? ` (${claimSelIds.length})` : ""}`}
                </button>
              ) : (
                <button onClick={async () => { await claimForward(false, claimActIds); setGwModalOpen(false) }} disabled={!claimFwdSelected || (gwNeedsBranch && !gwBranchChoice) || claimFwdSaving}
                  title={!claimFwdSelected ? `Select a person for ${gwNextPosLabel}` : ""}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
                  {claimFwdSaving ? "..." : `Forward →${claimSelIds.length ? ` (${claimSelIds.length})` : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back to MER / SCM — reason modal (replaces window.prompt) */}
      {backModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => !claimFwdSaving && setBackModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-lg">↩</div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Send back to {isGWRequest ? "MER" : "SCM"}</h3>
                <p className="text-xs text-gray-400">{claimActIds.length} SO · will re-assign the claim department</p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Reason <span className="text-red-500">*</span></label>
              <textarea value={backReason} onChange={e => setBackReason(e.target.value)} rows={3} autoFocus
                placeholder="Why are these SO sent back?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
              <button onClick={() => setBackModalOpen(false)} disabled={claimFwdSaving}
                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-40">Cancel</button>
              <button disabled={!backReason.trim() || claimFwdSaving}
                onClick={async () => {
                  const reason = backReason.trim(); if (!reason) return
                  setClaimFwdSaving(true)
                  const backAction = isGWRequest ? "claim_back_to_mer_gw" : "back_to_scm_so"
                  let ok = true
                  for (const iid of claimActIds) {
                    const res = await fetch(`/api/requests/${id}/approve`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: backAction, itemId: iid, comment: reason }),
                    })
                    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Error"); ok = false; break }
                  }
                  if (ok) window.location.href = "/requests"
                  else setClaimFwdSaving(false)
                }}
                className="px-4 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40">
                {claimFwdSaving ? "Sending..." : `Send back (${claimActIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
      {claimFwdDone && isGWRequest && (
        <div className={`rounded-xl px-4 py-3 mb-4 text-sm font-medium flex items-center gap-2 ${claimFwdDone === "final" ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
          <span className="text-base">{claimFwdDone === "final" ? "✓" : "→"}</span>
          {claimFwdDone === "final" ? "Your department is approved. The document proceeds once all departments and logistics are done." : `Forwarded to ${claimFwdDone.replace("forwarded:", "")} successfully.`}
        </div>
      )}

      {/* DVM CLAIM per-SO approval — priority-based sequential */}
      {/* Unified claim UI: every non-NYK dept uses the forced-position panel above.
          This DVM-style panel is reserved for SCM NYK (its 3-role CR/EVP sub-flow)
          and any truly-legacy DVM_* role — never for a forced-position entry role. */}
      {isDvmClaim && !showGwFinishForward && (isNykClaimRole || (!fwdEntryRole && role !== "CLAIM_NEXT_APPROVER")) && (!isProcureDvm || procureDecision === "approve") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isProcureDvm && (
                <button onClick={() => setProcureDecision(null)} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">← Back</button>
              )}
              <h2 className="font-semibold text-gray-800">SO APPROVAL — {isGwClaimP1Role ? (gwClaimDepts[0] || "Claim") : `DVM ${claimDept}`} ({myClaimItems.length})</h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-yellow-600">{myClaimItems.filter((i:any) => isGwClaimP1Role ? ["PRES_PASSED","LOG_PASSED"].includes(i.itemStatus) : i.itemStatus === "LOG_PASSED").length} pending</span>
              <span className="text-green-600">{myClaimItems.filter((i:any) => i.itemStatus === "CLAIM_PASSED").length} forwarded to VP</span>
              <span className="text-red-600">{myClaimItems.filter((i:any) => i.itemStatus === "REJECTED").length} rejected</span>
              {(() => {
                const myTurnItems = myClaimItems.filter((i: any) => {
                  if (!(isGwClaimP1Role ? ["PRES_PASSED","LOG_PASSED"].includes(i.itemStatus) : i.itemStatus === "LOG_PASSED")) return false
                  const appr: any[] = i.claimApprovals || []
                  if (appr.some((a: any) => a.userId === myUserId)) return false
                  // NYK: SCM_NYK (CR user) never approves; EVP only after the Approver.
                  if (role === "SCM_NYK") return false
                  if (role === "SCM_NYK_EVP" && !appr.some((a: any) => a.user?.role === "SCM_NYK_APPROVER")) return false
                  const lower = myPriority !== null ? claimApproversList.filter((u: any) => u.priority !== null && u.priority < myPriority) : []
                  return lower.every((u: any) => appr.some((a: any) => a.userId === u.id))
                })
                if (myTurnItems.length === 0) return null
                const allSel = myTurnItems.every((i: any) => dvmSelected.has(i.id))
                return (
                  <button onClick={() => setDvmSelected(allSel ? new Set() : new Set(myTurnItems.map((i: any) => i.id)))}
                    className="text-blue-600 hover:underline">
                    {allSel ? "Deselect All" : `Select All (${myTurnItems.length})`}
                  </button>
                )
              })()}
              {/* Batch actions in the header (next to Select All) — same as other approve pages */}
              {dvmSelected.size > 0 && (
                <>
                  <button
                    disabled={submitting !== null || (role === "SCM_NYK_APPROVER" && (!nykCr || !nykEvp))}
                    title={role === "SCM_NYK_APPROVER" && (!nykCr || !nykEvp) ? "Select the CR-entry person and the VP/EVP approver first" : ""}
                    onClick={async () => {
                      if (role === "SCM_NYK_APPROVER" && (!nykCr || !nykEvp)) { alert("Select the CR-entry person and the VP/EVP approver first."); return }
                      const ids = [...dvmSelected]
                      setSubmitting("_batch")
                      if (isGwClaimP1Role) {
                        // GW: one batch request → server approves all + notifies once (fast).
                        const res = await fetch(`/api/requests/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "batch_approve_claim_gw", itemIds: ids, evpEmail: nykEvp?.email, crEmail: nykCr?.email }) })
                        if (res.ok) { window.location.href = "/requests"; return }
                        const e = await res.json().catch(() => ({})); alert(e.error || "Error"); setSubmitting(null)
                      } else {
                        // NYG DVM: per-SO approve.
                        let ok = true
                        for (const itemId of ids) {
                          const res = await fetch(`/api/requests/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId, crNo: role === "SCM_NYK" ? (crNoInput.trim() || req.crNo || undefined) : undefined }) })
                          if (!res.ok) { const e = await res.json(); alert(e.error || "Error"); ok = false; break }
                        }
                        if (ok) { window.location.href = "/requests"; return }
                        setDvmSelected(new Set()); setSubmitting(null)
                      }
                    }}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                    {submitting !== null ? "..." : `✓ Approve (${dvmSelected.size})`}
                  </button>
                  <button disabled={submitting !== null}
                    onClick={async () => {
                      const reason = window.prompt(`Reason for sending ${dvmSelected.size} SO back${isGWRequest ? " to MER" : " to SCM"}:`)
                      if (reason == null || !reason.trim()) return
                      const ids = [...dvmSelected]
                      setSubmitting("_batch")
                      const backAction = isGwClaimP1Role ? (isGWRequest ? "claim_back_to_mer_gw" : "back_to_scm_so") : "reject_so"
                      let ok = true
                      for (const itemId of ids) {
                        const res = await fetch(`/api/requests/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: backAction, itemId, comment: reason.trim() }) })
                        if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Error"); ok = false; break }
                      }
                      if (ok) { window.location.href = "/requests"; return }
                      setDvmSelected(new Set()); setSubmitting(null)
                    }}
                    className="px-3 py-1.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50">
                    {isGWRequest ? `↩ Back to MER (${dvmSelected.size})` : `↩ Back to SCM (${dvmSelected.size})`}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Attach supporting files — by DOCUMENT (GW claim) */}
          {isGwClaimP1Role && (
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 gap-2 flex-wrap">
              <span className="text-xs text-gray-600">Attach supporting files (by document)</span>
              <label className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border font-medium ${uploadingItem === "_req" ? "opacity-50 pointer-events-none bg-gray-50 border-gray-200 text-gray-400" : "border-blue-300 text-blue-600 hover:bg-blue-50"}`}>
                {uploadingItem === "_req" ? "Uploading..." : "📎 Attach File"}
                <input type="file" className="hidden" multiple disabled={uploadingItem === "_req"}
                  onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ""; for (const f of files) await attachFileFn(f) }} />
              </label>
            </div>
          )}

          {/* SCM NYK Approver picks WHO enters the CR + WHO is the VP/EVP approver.
              On approve, only these two are alerted (magic link resolves to them). */}
          {role === "SCM_NYK_APPROVER" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
              <p className="text-[11px] text-amber-800 leading-relaxed">Choose who will handle this SCM NYK claim, then approve. Only these two people are alerted:</p>
              <PersonPicker label="CR-entry person" selected={nykCr} onSelect={setNykCr} placeholder="Who enters the CR NO..." position="SCM NYK User" positionRole="SCM_NYK" bu={req?.bu} requestId={String(id)} />
              <PersonPicker label="VP / EVP approver" selected={nykEvp} onSelect={setNykEvp} placeholder="Who approves (EVP)..." position="SCM NYK EVP" positionRole="SCM_NYK_EVP" bu={req?.bu} requestId={String(id)} />
              {(!nykCr || !nykEvp) && <p className="text-[11px] text-amber-600">⚠ Select both before approving.</p>}
            </div>
          )}

          {/* CR NO — one per DOCUMENT. Flow: Approver approves first → then the CR
              user (in parallel with the EVP) enters the CR NO. Locked until the
              Approver has approved every SCM NYK SO. */}
          {role === "SCM_NYK" && (() => {
            const nykSOs = (req.items || []).filter((i: any) => i.itemStatus !== "REJECTED" && getSplits(i).some((s: any) => s.dept === "SCM NYK" && s.status !== "REJECTED"))
            const approverAllDone = nykSOs.length > 0 && nykSOs.every((i: any) => (i.claimApprovals || []).some((a: any) => a.user?.role === "SCM_NYK_APPROVER"))
            const awaitingCount = nykSOs.filter((i: any) => !(i.claimApprovals || []).some((a: any) => a.user?.role === "SCM_NYK_APPROVER")).length
            const crLocked = !approverAllDone && !req.crNo
            return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="text-[11px] text-blue-700 leading-relaxed">
                {crLocked
                  ? <>⏳ Waiting for the <b>SCM NYK Approver</b> to approve first — you can enter the CR NO once all SOs are approved{awaitingCount > 0 ? ` (${awaitingCount} SO remaining)` : ""}</>
                  : <>💡 Once you have the CR number, enter it here once for the entire document (runs in parallel with the EVP approval)</>}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-blue-800 shrink-0">CR NO <span className="text-red-500">*</span></label>
                <input
                  value={crNoInput}
                  onChange={e => setCrNoInput(e.target.value)}
                  disabled={crLocked || !!req.crNo || savingCr}
                  placeholder={req.crNo ? req.crNo : crLocked ? "Waiting for the SCM NYK Approver…" : "Enter CR NO once you have the number"}
                  className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-500 ${!crNoInput.trim() && !req.crNo ? "border-blue-200 bg-white" : "border-blue-200 bg-white"}`}
                />
                {req.crNo
                  ? <span className="text-xs text-green-700 font-medium shrink-0 whitespace-nowrap">✓ Saved: {req.crNo}</span>
                  : <button
                      onClick={async () => {
                        if (!crNoInput.trim()) return
                        setSavingCr(true)
                        const res = await fetch(`/api/requests/${id}/approve`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "finalize_cr_gw", crNo: crNoInput.trim() })
                        })
                        if (res.ok) { setReq(await res.json()); setCrNoInput("") }
                        else { const e = await res.json(); alert(e.error || "Error") }
                        setSavingCr(false)
                      }}
                      disabled={crLocked || !crNoInput.trim() || savingCr}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0 whitespace-nowrap">
                      {savingCr ? "..." : "Save CR NO"}
                    </button>}
              </div>
            </div>
            )
          })()}

          {/* Priority order reference */}
          {claimApproversList.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-600">Approval order:</span>
              {claimApproversList.map((u: any, idx: number) => (
                <span key={u.id} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-gray-300">→</span>}
                  <span className={`px-2 py-0.5 rounded-full font-medium ${u.id === myUserId ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.priority != null ? `${u.priority}. ` : ""}{u.name || u.email}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Quick-select: type the full SO + Enter to tick it */}
          {myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED").length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m21 21-4.3-4.3" /></svg>
                <input value={soPick}
                  onChange={e => { setSoPick(e.target.value); setSoPickMsg("") }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return
                    const q = soPick.trim(); if (!q) return
                    const matches = myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED" && String(i.so).toLowerCase() === q.toLowerCase())
                    if (matches.length === 0) { setSoPickMsg(`No SO "${q}" — type the full SO`); return }
                    setDvmSelected(prev => { const n = new Set(prev); matches.forEach((i: any) => n.add(i.id)); return n })
                    setSoPickMsg(`✓ +${matches.length} added`); setSoPick("")
                  }}
                  placeholder="Type SO + Enter to select"
                  className="w-56 border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {soPickMsg && <span className={`text-xs font-medium ${soPickMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{soPickMsg}</span>}
            </div>
          )}
          {myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED").map((item: any) => {
            const isSub = submitting === item.id
            const itemAttachments = (req.attachments || []).filter((a: any) => a.itemId === item.id)
            const isUploading = uploadingItem === item.id
            // GW claim runs in parallel with LG → items sit at PRES_PASSED (not LOG_PASSED).
            const isPending = isGwClaimP1Role ? ["PRES_PASSED", "LOG_PASSED"].includes(item.itemStatus) : item.itemStatus === "LOG_PASSED"
            const isPassed = item.itemStatus === "CLAIM_PASSED"
            // Who has approved this item so far
            const itemApprovals: any[] = item.claimApprovals || []
            const iHaveApproved = itemApprovals.some((a: any) => a.userId === myUserId)
            // SCM NYK accepted this SO but CR NO not yet entered (awaiting finalize).
            const awaitingCr = isGwClaimP1Role && getSplits(item).some((s: any) => gwClaimDepts.includes(s.dept) && (s.status === "DEPT_ACCEPTED" || s.status === "APPROVER_PASSED"))
            // Can I approve? All lower-priority approvers must have approved first
            const lowerApprovers = myPriority !== null
              ? claimApproversList.filter((u: any) => u.priority !== null && u.priority < myPriority)
              : []
            const lowerApproved = lowerApprovers.every((u: any) => itemApprovals.some((a: any) => a.userId === u.id))
            // NYK: SCM_NYK (CR user) never approves; SCM_NYK_EVP only after the Approver.
            const approverApprovedThisItem = (item.claimApprovals || []).some((a: any) => a.user?.role === "SCM_NYK_APPROVER")
            const nykBlocked = role === "SCM_NYK" || (role === "SCM_NYK_EVP" && !approverApprovedThisItem)
            // SCM NYK Approver must pick BOTH the CR-entry person and EVP approver first.
            const nykSelectionMissing = role === "SCM_NYK_APPROVER" && (!nykCr || !nykEvp)
            const canApproveNow = isPending && !iHaveApproved && lowerApproved && !nykBlocked
            // Next approver info
            const nextApprover = claimApproversList.find((u: any) =>
              !itemApprovals.some((a: any) => a.userId === u.id)
            )
            const isMyTurn = canApproveNow
            const isP1 = myPriority === 1 || (myPriority === null && claimApproversList.length === 1)
            const isExp = expanded.has(item.id)
            return (
              <div key={item.id} className={`rounded-xl border overflow-hidden ${isPassed ? "border-green-200" : iHaveApproved ? "border-blue-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isPassed ? "bg-green-50" : iHaveApproved ? "bg-blue-50" : "bg-white"}`}>
                  {isMyTurn && (
                    <input type="checkbox" checked={dvmSelected.has(item.id)}
                      onChange={e => setDvmSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                      className="w-4 h-4 rounded border-gray-300 shrink-0 cursor-pointer" />
                  )}
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>


                  {isPassed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">All approved → VP</span>}
                  {isPending && !iHaveApproved && !canApproveNow && nextApprover && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Waiting: {nextApprover.name || nextApprover.email}
                    </span>
                  )}
                  {iHaveApproved && !isPassed && (
                    awaitingCr
                      ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap font-medium">Accepted · Awaiting CR</span>
                      : <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">You approved ✓</span>
                  )}

                  {/* Attach — priority 1 only (NYG per-SO; GW uses by-document attach above) */}
                  {isP1 && isPending && !isGwClaimP1Role && (
                    <label className={`cursor-pointer text-xs px-2 py-1 rounded border ${isUploading ? "opacity-50 pointer-events-none" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                      {isUploading ? "Uploading..." : "📎 Attach"}
                      <input type="file" className="hidden" disabled={isUploading}
                        onChange={e => { if (e.target.files?.[0]) attachFileFn(e.target.files[0], item.id); e.target.value = "" }} />
                    </label>
                  )}

                  {/* Approve button — only if it's my turn */}
                  {isMyTurn && (
                    <div className="flex items-center gap-2">
                      <button onClick={async () => {
                          if (role === "SCM_NYK_APPROVER" && (!nykCr || !nykEvp)) { alert("Select the CR-entry person and the VP/EVP approver first."); return }
                          setSubmitting(item.id)
                          const approveAction = isGWRequest ? "approve_so_claim_gw" : "approve_so"
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: approveAction, itemId: item.id, crNo: role === "SCM_NYK" ? (crNoInput.trim() || req.crNo || undefined) : undefined, evpEmail: nykEvp?.email, crEmail: nykCr?.email })
                          })
                          if (res.ok) { window.location.href = "/requests"; return }
                          else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null)
                        }} disabled={isSub || nykSelectionMissing}
                        title={nykSelectionMissing ? "Select the CR-entry person and the VP/EVP approver first" : ""}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSub ? "..." : "Approve"}
                      </button>
                      {!isGwClaimP1Role && (
                        <button onClick={() => { setBackToScmSo(backToScmSo === item.id ? null : item.id); setBackToScmSoComment("") }} disabled={isSub}
                          className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">Back to SCM</button>
                      )}
                      {isGwClaimP1Role && (
                        <button onClick={() => { setRejectingSo(rejectingSo === item.id ? null : item.id); setRejectSoComment("") }} disabled={isSub}
                          className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">{isGWRequest ? "Back to MER" : "Back to SCM"}</button>
                      )}
                    </div>
                  )}
                </div>
                {/* Attachments list */}
                {itemAttachments.length > 0 && (
                  <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex flex-wrap gap-2">
                    {itemAttachments.map((att: any) => (
                      <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs bg-white border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100 font-medium">
                        📎 {att.fileName}
                        <span className="text-gray-400 font-normal">· {att.uploadedBy?.name}</span>
                      </a>
                    ))}
                  </div>
                )}
                {rejectingSo === item.id && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">{isGwClaimP1Role ? (isGWRequest ? "Reason for sending back to MER *" : "Reason for sending back to SCM *") : "Reject reason *"}</label>
                    <textarea value={rejectSoComment} onChange={e => setRejectSoComment(e.target.value)} rows={2}
                      placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button disabled={isSub || !rejectSoComment.trim()}
                        onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: isGwClaimP1Role ? (isGWRequest ? "claim_back_to_mer_gw" : "back_to_scm_so") : "reject_so", itemId: item.id, comment: rejectSoComment })
                          })
                          if (res.ok) { window.location.href = "/requests"; return } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
                        }}
                        className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-40">
                        {isSub ? "..." : (isGwClaimP1Role ? (isGWRequest ? "Confirm — Back to MER" : "Confirm — Back to SCM") : "Confirm Reject")}
                      </button>
                      <button onClick={() => setRejectingSo(null)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {backToScmSo === item.id && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM reason *</label>
                    <textarea value={backToScmSoComment} onChange={e => setBackToScmSoComment(e.target.value)} rows={2}
                      placeholder="Enter reason..." className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button disabled={isSub || !backToScmSoComment.trim()}
                        onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "back_to_scm_so", itemId: item.id, comment: backToScmSoComment })
                          })
                          if (res.ok) { setReq(await res.json()) } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null); setBackToScmSo(null); setBackToScmSoComment("")
                        }}
                        className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-40">
                        {isSub ? "..." : "Confirm Back to SCM"}
                      </button>
                      <button onClick={() => { setBackToScmSo(null); setBackToScmSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 p-3 space-y-3">
                    <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","STYLE","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)","ACTUAL (THB)","INVOICE NO","HAWB#","BOOKING DATE","DELAY REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                          <td className="px-3 py-2">{item.customerPO}</td>
                          <td className="px-3 py-2">{item.description}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                          <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                          <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.hawbNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                          <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                          <td className="px-3 py-2">{item.factory}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Claim Split</p>
                      <ClaimSplitTable item={item} highlightDept={claimDept || null} showCrNo={isNykClaimRole} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* VP CLAIM per-SO approval */}
      {isVpClaim && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">SO APPROVAL — VP {claimDept} ({myClaimItems.length})</h2>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-yellow-600">{myClaimItems.filter((i:any) => i.itemStatus === "CLAIM_PASSED").length} pending</span>
              <span className="text-green-600">{myClaimItems.filter((i:any) => i.itemStatus === "COMPLETED").length} approved</span>
              <span className="text-red-600">{myClaimItems.filter((i:any) => i.itemStatus === "REJECTED").length} rejected</span>
              {(() => {
                const myTurnItems = myClaimItems.filter((i: any) => {
                  if (i.itemStatus !== "CLAIM_PASSED") return false
                  const appr: any[] = (i.claimApprovals || []).filter((a: any) => claimApproversList.some((u: any) => u.id === a.userId))
                  if (appr.some((a: any) => a.userId === myUserId)) return false
                  const lower = myPriority !== null ? claimApproversList.filter((u: any) => u.priority !== null && u.priority < myPriority) : []
                  return lower.every((u: any) => appr.some((a: any) => a.userId === u.id))
                })
                if (myTurnItems.length === 0) return null
                const allSel = myTurnItems.every((i: any) => vpSelected.has(i.id))
                return (
                  <button onClick={() => setVpSelected(allSel ? new Set() : new Set(myTurnItems.map((i: any) => i.id)))}
                    className="text-blue-600 hover:underline">
                    {allSel ? "Deselect All" : `Select All (${myTurnItems.length})`}
                  </button>
                )
              })()}
            </div>
          </div>

          {/* SCM attachments (doc-level) */}
          {(() => {
            const scmAtts = (req.attachments || []).filter((a: any) => a.uploadedBy?.role === "SCM_USER" && !a.itemId)
            if (scmAtts.length === 0) return null
            return (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500">SCM:</span>
                {scmAtts.map((att: any) => (
                  <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-100 font-medium whitespace-nowrap">
                    📎 {att.fileName}
                  </a>
                ))}
              </div>
            )
          })()}

          {/* Priority order reference */}
          {claimApproversList.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-600">Approval order:</span>
              {claimApproversList.map((u: any, idx: number) => (
                <span key={u.id} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-gray-300">→</span>}
                  <span className={`px-2 py-0.5 rounded-full font-medium ${u.id === myUserId ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.priority != null ? `${u.priority}. ` : ""}{u.name || u.email}
                  </span>
                </span>
              ))}
            </div>
          )}

          {myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED").map((item: any) => {
            const isSub = submitting === item.id
            const itemAttachments = (req.attachments || []).filter((a: any) => a.itemId === item.id)
            const isUploading = uploadingItem === item.id
            const isPending = item.itemStatus === "CLAIM_PASSED"
            const isPassed = item.itemStatus === "COMPLETED"
            // Filter approvals to only VP-tier approvers in this group
            const itemApprovals: any[] = (item.claimApprovals || []).filter((a: any) =>
              claimApproversList.some((u: any) => u.id === a.userId)
            )
            const iHaveApproved = itemApprovals.some((a: any) => a.userId === myUserId)
            const lowerApprovers = myPriority !== null
              ? claimApproversList.filter((u: any) => u.priority !== null && u.priority < myPriority)
              : []
            const lowerApproved = lowerApprovers.every((u: any) => itemApprovals.some((a: any) => a.userId === u.id))
            const canApproveNow = isPending && !iHaveApproved && lowerApproved
            const nextApprover = claimApproversList.find((u: any) =>
              !itemApprovals.some((a: any) => a.userId === u.id)
            )
            const isMyTurn = canApproveNow
            const isP1 = myPriority === 1 || (myPriority === null && claimApproversList.length === 1)
            const isExp = expanded.has(item.id)
            return (
              <div key={item.id} className={`rounded-xl border overflow-hidden ${isPassed ? "border-green-200" : iHaveApproved ? "border-blue-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isPassed ? "bg-green-50" : iHaveApproved ? "bg-blue-50" : "bg-white"}`}>
                  {isMyTurn && (
                    <input type="checkbox" checked={vpSelected.has(item.id)}
                      onChange={e => setVpSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                      className="w-4 h-4 rounded border-gray-300 shrink-0 cursor-pointer" />
                  )}
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>

                  {isPassed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Completed</span>}
                  {isPending && !iHaveApproved && !canApproveNow && nextApprover && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Waiting: {nextApprover.name || nextApprover.email}
                    </span>
                  )}
                  {iHaveApproved && !isPassed && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">You approved ✓</span>
                  )}

                  {/* PDF download when completed */}
                  {isPassed && <PdfDownloadButton req={req} item={item} compact alwaysShow />}

                  {/* Attach — priority 1 only */}
                  {isP1 && isPending && (
                    <label className={`cursor-pointer text-xs px-2 py-1 rounded border ${isUploading ? "opacity-50 pointer-events-none" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                      {isUploading ? "Uploading..." : "📎 Attach"}
                      <input type="file" className="hidden" disabled={isUploading}
                        onChange={e => { if (e.target.files?.[0]) attachFileFn(e.target.files[0], item.id); e.target.value = "" }} />
                    </label>
                  )}

                  {/* Approve / Back to SCM — only when it's my turn */}
                  {isMyTurn && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId: item.id })
                          })
                          if (res.ok) {
                            setReq(await res.json())
                            setVpSelected(prev => { const n = new Set(prev); n.delete(item.id); return n })
                          } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null)
                        }} disabled={isSub}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {isSub ? "..." : "Approve"}
                      </button>
                      <button onClick={() => { setBackToScmSo(backToScmSo === item.id ? null : item.id); setBackToScmSoComment("") }} disabled={isSub}
                        className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">Back to SCM</button>
                    </div>
                  )}
                </div>
                {itemAttachments.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
                    {itemAttachments.map((att: any) => (
                      <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full hover:bg-gray-100 font-medium">
                        📎 {att.fileName}
                        <span className="text-gray-400 font-normal">· {att.uploadedBy?.name}</span>
                      </a>
                    ))}
                  </div>
                )}
                {backToScmSo === item.id && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM — specify reason *</label>
                    <textarea value={backToScmSoComment} onChange={e => setBackToScmSoComment(e.target.value)} rows={2}
                      placeholder="Enter reason..." className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button disabled={isSub || !backToScmSoComment.trim()}
                        onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "back_to_scm_so", itemId: item.id, comment: backToScmSoComment })
                          })
                          if (res.ok) { setReq(await res.json()) } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null); setBackToScmSo(null); setBackToScmSoComment("")
                        }}
                        className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-40">
                        {isSub ? "..." : "Confirm Back to SCM"}
                      </button>
                      <button onClick={() => { setBackToScmSo(null); setBackToScmSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 p-3 space-y-3">
                    <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","STYLE","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)","ACTUAL (THB)","INVOICE NO","HAWB#","BOOKING DATE","DELAY REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                          <td className="px-3 py-2">{item.customerPO}</td>
                          <td className="px-3 py-2">{item.description}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                          <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                          <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.hawbNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                          <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                          <td className="px-3 py-2">{item.factory}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Claim Split</p>
                      <ClaimSplitTable item={item} highlightDept={claimDept || null} showCrNo={isNykClaimRole} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* VP batch approve panel */}
          {vpSelected.size > 0 && (
            <div className="sticky bottom-4 bg-white border border-blue-300 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap z-10">
              <span className="text-sm font-semibold text-blue-700">{vpSelected.size} SO selected</span>
              <button
                disabled={submitting !== null}
                onClick={async () => {
                  const ids = [...vpSelected]
                  let updated: any = req
                  for (const itemId of ids) {
                    setSubmitting(itemId)
                    const res = await fetch(`/api/requests/${id}/approve`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "approve_so", itemId })
                    })
                    if (res.ok) updated = await res.json()
                  }
                  setReq(updated)
                  setVpSelected(new Set())
                  setSubmitting(null)
                }}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {submitting !== null ? "Approving..." : `Approve ${vpSelected.size} SO(s)`}
              </button>
              <button onClick={() => setVpSelected(new Set())}
                className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* GW CLAIM: per-SO approve/reject at PENDING_CLAIM_GW */}
      {isClaimGW && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">SO APPROVAL — CLAIM GW</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">GW</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-yellow-600">{(req.items||[]).filter((i:any) => i.itemStatus === "LOG_PASSED").length} pending</span>
              <span className="text-green-600">{(req.items||[]).filter((i:any) => i.itemStatus === "COMPLETED").length} approved</span>
              <span className="text-red-600">{(req.items||[]).filter((i:any) => i.itemStatus === "REJECTED").length} rejected</span>
              {(() => {
                const pendingItems = (req.items||[]).filter((i:any) => i.itemStatus === "LOG_PASSED")
                const allSelected = pendingItems.length > 0 && pendingItems.every((i:any) => claimGwSelected.has(i.id))
                return pendingItems.length > 0 && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 font-normal ml-2">
                    <input type="checkbox" checked={allSelected}
                      onChange={e => setClaimGwSelected(e.target.checked ? new Set(pendingItems.map((i:any) => i.id)) : new Set())}
                      className="w-4 h-4 rounded border-gray-300" />
                    Select All
                  </label>
                )
              })()}
            </div>
          </div>
          {claimGwSelected.size > 0 && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <span className="text-sm font-medium text-green-700">{claimGwSelected.size} SO selected</span>
              <button
                disabled={submitting === "_batch"}
                onClick={async () => {
                  setSubmitting("_batch")
                  const ids = [...claimGwSelected]
                  const res = await fetch(`/api/requests/${id}/approve`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "batch_approve_so", itemIds: ids })
                  })
                  if (res.ok) { setReq(await res.json()); setClaimGwSelected(new Set()) }
                  else { const err = await res.json(); alert(err.error || "Error") }
                  setSubmitting(null)
                }}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {submitting === "_batch" ? "..." : `Approve ${claimGwSelected.size} SO`}
              </button>
              <button onClick={() => setClaimGwSelected(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}
          {req.claimDepartment && (
            <div className="text-sm text-gray-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Claim Department: <span className="font-semibold text-emerald-700">{req.claimDepartment === "SUPPLIER_IN" ? "Supplier (Internal)" : req.claimDepartment === "SUPPLIER_OUT" ? "Supplier (External)" : req.claimDepartment}</span>
            </div>
          )}
          {(req.items||[]).filter((i:any) => ["LOG_PASSED","COMPLETED","REJECTED"].includes(i.itemStatus)).map((item: any) => {
            const isSub = submitting === item.id || submitting === "_batch"
            const isRejRow = rejectingSo === item.id
            const isPending = item.itemStatus === "LOG_PASSED"
            const isPassed = item.itemStatus === "COMPLETED"
            const isExp = expanded.has(item.id)
            const isSel = claimGwSelected.has(item.id)
            return (
              <div key={item.id} className={`rounded-xl border overflow-hidden ${isSel ? "border-green-400 ring-1 ring-green-300" : isPassed ? "border-green-200" : item.itemStatus === "REJECTED" ? "border-red-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isSel ? "bg-green-50" : isPassed ? "bg-green-50" : item.itemStatus === "REJECTED" ? "bg-red-50" : "bg-white"}`}>
                  {isPending && (
                    <input type="checkbox" checked={isSel}
                      onChange={e => setClaimGwSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                      className="w-4 h-4 rounded border-gray-300 shrink-0" />
                  )}
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                  {isPassed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Completed</span>}
                  {item.itemStatus === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Rejected</span>}
                  {isPassed && <PdfDownloadButton req={req} item={item} compact alwaysShow />}
                  {isPending && !isRejRow && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId: item.id })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null)
                        }} disabled={isSub}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {isSub ? "..." : "Approve"}
                      </button>
                    </div>
                  )}
                </div>
                {isRejRow && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectSoComment} onChange={e => setRejectSoComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "reject_so", itemId: item.id, comment: rejectSoComment })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
                        }} disabled={isSub || !rejectSoComment.trim()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                        {isSub ? "..." : "Confirm Reject"}
                      </button>
                      <button onClick={() => { setRejectingSo(null); setRejectSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","STYLE","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                          <td className="px-3 py-2">{item.customerPO}</td>
                          <td className="px-3 py-2">{item.description}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                          <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                          <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                          <td className="px-3 py-2">{item.factory}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* SCM_GW: approve/reject SCM_GW_PENDING items */}
      {isScmGW && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">SO APPROVAL — SCM GW</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">SCM GW</span>
            <span className="text-xs text-gray-500">{scmGwItems.length} pending</span>
          </div>
          {role === "SCM_NYK" && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <label className="text-xs font-semibold text-blue-800 shrink-0">CR NO <span className="text-red-500">*</span></label>
              <input
                value={crNoInput}
                onChange={e => setCrNoInput(e.target.value)}
                placeholder={req.crNo ? req.crNo : "Enter CR NO before Approve"}
                className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${!crNoInput.trim() && !req.crNo ? "border-red-300 bg-red-50" : "border-blue-200 bg-white"}`}
              />
              {(crNoInput.trim() || req.crNo) && (
                <span className="text-xs text-green-700 font-medium shrink-0">✓ {req.crNo && !crNoInput.trim() ? `Saved: ${req.crNo}` : ""}</span>
              )}
            </div>
          )}
          {scmGwItems.map((item: any) => {
            const isSub = submitting === item.id
            const isRejRow = rejectingSo === item.id
            const isExp = expanded.has(item.id)
            const canApproveNyk = role !== "SCM_NYK" || !!(crNoInput.trim() || req.crNo)
            return (
              <div key={item.id} className="rounded-xl border border-orange-200 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 bg-orange-50">
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                  <ClaimSplitBadges item={item} />
                  {!isRejRow && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId: item.id, crNo: crNoInput.trim() || req.crNo || undefined })
                          })
                          if (!res.ok) { const err = await res.json(); alert(err.error || "Error"); setSubmitting(null); return }
                          setReq(await res.json())
                          setSubmitting(null)
                        }} disabled={isSub || !canApproveNyk}
                        title={!canApproveNyk ? "Please enter CR NO before Approve" : ""}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSub ? "..." : "Approve → Accounting"}
                      </button>
                    </div>
                  )}
                </div>
                {isRejRow && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectSoComment} onChange={e => setRejectSoComment(e.target.value)} rows={2} className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "reject_so", itemId: item.id, comment: rejectSoComment })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
                        }} disabled={isSub || !rejectSoComment.trim()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                        {isSub ? "..." : "Confirm Reject"}
                      </button>
                      <button onClick={() => { setRejectingSo(null); setRejectSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 p-3 space-y-3">
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead className="bg-gray-50">
                          <tr>{["SO","STYLE","DESCRIPTION","QTY ORIG","QTY AIR","INVOICE NO","BOOKING DATE","COUNTRY","PORT"].map(h =>
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2">{item.style}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                            <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                            <td className="px-3 py-2">{item.country}</td>
                            <td className="px-3 py-2">{item.port}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Claim Split</p>
                      <ClaimSplitTable item={item} highlightDept={role === "SCM_NYK" ? "NYK" : role === "SCM_NYG" ? "NYG" : null} showCrNo={isNykClaimRole} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}


      {/* ACCOUNTING: read-only view — notified when all departments approved */}
      {isAccounting && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">ACCOUNTING — Document ready for review</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">READ ONLY</span>
            <span className="text-xs text-gray-500">{accountingItems.length} SO</span>
          </div>
          <p className="text-xs text-gray-400">All claim departments have approved — Accounting can review/download documents (no approval needed)</p>
          {req.crNo && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
              <span className="text-xs font-semibold text-blue-800">CR NO:</span>
              <span className="text-sm font-bold text-blue-900">{req.crNo}</span>
            </div>
          )}
          {accountingItems.map((item: any) => {
            const isExp = expanded.has(item.id)
            return (
              <div key={item.id} className="rounded-xl border border-blue-200 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 bg-blue-50">
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                  <ClaimSplitBadges item={item} />
                </div>
                {isExp && (
                  <div className="border-t border-gray-100 p-3 space-y-3">
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead className="bg-gray-50">
                          <tr>{["SO","STYLE","DESCRIPTION","QTY ORIG","QTY AIR","INV NO","BOOKING DATE","COUNTRY","PORT"].map(h =>
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2">{item.style}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                            <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                            <td className="px-3 py-2">{item.country}</td>
                            <td className="px-3 py-2">{item.port}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Claim Split</p>
                      <ClaimSplitTable item={item} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* LOGISTICS PARALLEL — Air Waybill Entry (outside canAct so LOGISTICS role can see it) */}
      {lgDraftSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[220px]">
            <svg className="animate-spin h-10 w-10 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-orange-700 font-semibold text-base">Saving...</p>
          </div>
        </div>
      )}
      {showAwbEntry && (
        <div className="space-y-4 border border-orange-200 rounded-xl bg-orange-50/30 p-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-orange-800">Logistics — Air Waybill Entry</p>
              <p className="text-xs text-orange-500 mt-0.5">Enter INV NO. in the table, press Enter to go to the next row · then organize HAWB below</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button"
                onClick={async () => {
                  if (!confirm("Clear all Logistics data (HAWB, INV, Actual Air) for this document?")) return
                  setImportingLg(true)
                  try {
                    const res = await fetch(`/api/requests/${id}/logistics-clear`, { method: "POST" })
                    if (res.ok) {
                      setSoInvMap({}); setItemLogistics({}); setItemActuals({}); setHawbGroups([])
                      const rr = await fetch(`/api/requests/${id}`); if (rr.ok) setReq(await rr.json())
                      setHawbRefreshKey(k => k + 1)
                    } else { alert("Failed to clear data") }
                  } finally { setImportingLg(false) }
                }}
                className="text-xs bg-red-50 border border-red-200 text-red-600 px-3 py-1 rounded-lg hover:bg-red-100 font-medium whitespace-nowrap">
                🗑 Clear data
              </button>
              <button type="button"
                onClick={async () => {
                  const XLSX = await import("xlsx")
                  const isGW = req.bu === "GW"
                  const fmtD = (v: any) => { if (!v) return ""; const d = new Date(v); if (isNaN(d.getTime())) return ""; return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}` }
                  const DEPT_LABEL: Record<string,string> = { NYK: "SCM NYK", NYG: "SCM NYG" }
                  const headers = ["No_Document","CR NO","Brand name","BU","STYLE","SO","SUB","CUSTOMER PO","DESCRIPTION","WEIGHT(KG)","Original Shipment Date","Plan Shipment Date","QTY Original Shipment (pcs)","QTY Request ship Air (pcs)","Reason delay","Factory","Country","Port","INV NO.","HAWB#","Total HAWB#","CLAIM DEPT 1","%CLAIM1","ACTUAL AIRFREIGHT1","REASON 1","CLAIM DEPT 2","%CLAIM2","ACTUAL AIRFREIGHT2","REASON 2","CLAIM DEPT 3","%CLAIM3","ACTUAL AIRFREIGHT3","REASON 3"]
                  const rows = allLgItems.map((item: any) => {
                    const invNo = soInvMap[item.id] || ""
                    const hawbGrp = hawbGroups.find(g => invNo && g.invNos.includes(invNo))
                    const hawbNo = hawbGrp?.hawbNo || ""
                    const af = hawbGrp && parseFloat(hawbGrp.totalCost) > 0
                      ? Math.round(item.qtyRequestAir * getHawbCalc(hawbGrp).avgPerUnit * 100) / 100
                      : (typeof item.actualAirFreight === "number" ? item.actualAirFreight : 0)
                    const d: any[] = Array.isArray(item.claimDepts) && item.claimDepts.length > 0 ? item.claimDepts : []
                    // Actual airfreight split per claim dept = SO actual × dept% (blank if no data yet)
                    const deptAmt = (pct: any) => (af > 0 && pct) ? Math.round(af * (Number(pct) / 100) * 100) / 100 : ""
                    return [
                      req.documentNo, (req as any).crNo || "", req.brandName || "", isGW ? "GW" : "NYG",
                      item.style || "", item.so || "", (item as any).sub || "", item.customerPO || "",
                      item.description || "", item.grossWeight ?? "",
                      fmtD(item.originalShipmentDate), fmtD(item.planShipmentDate),
                      item.qtyOriginalShipment ?? item.qtyRequestAir ?? "", item.qtyRequestAir ?? "",
                      item.reasonDelay || "", item.factory || "",
                      item.country || "", item.port || "",
                      invNo, hawbNo, hawbGrp?.totalCost || "",
                      d[0]?.dept ? (DEPT_LABEL[d[0].dept] || d[0].dept) : "", d[0]?.pct ?? "", deptAmt(d[0]?.pct), d[0]?.reason || "",
                      d[1]?.dept ? (DEPT_LABEL[d[1].dept] || d[1].dept) : "", d[1]?.pct ?? "", deptAmt(d[1]?.pct), d[1]?.reason || "",
                      d[2]?.dept ? (DEPT_LABEL[d[2].dept] || d[2].dept) : "", d[2]?.pct ?? "", deptAmt(d[2]?.pct), d[2]?.reason || "",
                    ]
                  })
                  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
                  ws["!cols"] = [16,14,16,6,14,12,8,14,24,10,20,20,22,22,16,14,12,12,16,16,20,14,8,18,16,14,8,18,16,14,8,18,16].map(w => ({ wch: w }))
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, isGW ? "GW" : "NYG")
                  XLSX.writeFile(wb, `${req.documentNo}_LG.xlsx`)
                }}
                className="text-xs border border-orange-300 text-orange-700 px-3 py-1 rounded-lg hover:bg-orange-50 font-medium">
                ⬇ Export Template
              </button>
              <label className="text-xs border border-orange-300 text-orange-700 px-3 py-1 rounded-lg hover:bg-orange-50 font-medium cursor-pointer">
                ⬆ Import Excel
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return
                    const XLSX = await import("xlsx")
                    const buf = await f.arrayBuffer()
                    const wb = XLSX.read(buf, { type: "array" })
                    const ws = wb.Sheets[wb.SheetNames[0]]
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
                    const updates: Record<string, string> = {}
                    const hawbMap: Record<string, { hawbNo: string; invNos: Set<string>; totalCost: string }> = {}
                    rows.forEach((row: any) => {
                      const soNo = String(row["SO"] || row["SO No."] || "").trim()
                      const subNo = String(row["SUB"] || "").trim()
                      const inv = String(row["INV NO."] || row["Invoice No"] || "").trim()
                      const hawbNo = String(row["HAWB#"] || "").trim()
                      const hawbCost = String(row["Total HAWB#"] || row["HAWB Total Cost (THB)"] || "").trim()
                      if (!soNo || !inv) return
                      const found = allLgItems.find((i: any) => i.so === soNo && (i.sub || "") === subNo)
                      if (found) updates[(found as any).id] = inv
                      if (hawbNo && inv) {
                        if (!hawbMap[hawbNo]) hawbMap[hawbNo] = { hawbNo, invNos: new Set(), totalCost: hawbCost }
                        hawbMap[hawbNo].invNos.add(inv)
                      }
                    })
                    if (Object.keys(updates).length > 0) setSoInvMap(p => ({ ...p, ...updates }))
                    if (Object.keys(hawbMap).length > 0) {
                      setHawbGroups(Object.values(hawbMap).map(h => ({
                        id: Math.random().toString(36).slice(2),
                        hawbNo: h.hawbNo,
                        bookingDate: "",
                        totalCost: h.totalCost,
                        invNos: [...h.invNos]
                      })))
                    }
                    e.target.value = ""
                  }} />
              </label>
              <button type="button" onClick={saveLgHawb} disabled={lgDraftSaving || hawbGroups.length === 0}
                className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                {lgDraftSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Required attachments (GW) — must attach INV / AWB / Expense before Save */}
          {isLgGwEntry && (
            <div className="bg-white rounded-xl border border-orange-200 p-3">
              <p className="text-xs font-semibold text-orange-800 mb-2">Attach files (required before Save): INV · AWB · Expense</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {LG_REQUIRED_FILES.map(f => {
                  const att = (req?.attachments || []).find((a: any) => a.category === f.key)
                  return (
                    <div key={f.key} className={`rounded-lg border p-2 flex items-center justify-between gap-2 ${att ? "border-green-300 bg-green-50" : "border-gray-300 bg-gray-50"}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700">{f.label} {att ? "✓" : <span className="text-red-500">*</span>}</p>
                        {att ? (
                          <a href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline truncate block">{att.fileName}</a>
                        ) : <p className="text-[10px] text-gray-400">Not attached</p>}
                      </div>
                      <label className="text-[10px] px-2 py-1 rounded border border-orange-300 text-orange-700 hover:bg-orange-50 cursor-pointer whitespace-nowrap shrink-0">
                        {att ? "Change" : "Attach"}
                        <input type="file" className="hidden" disabled={lgDraftSaving}
                          onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) uploadLgFile(file, f.key) }} />
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          )}


          {/* INV Assignment Table */}
          <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
            {/* Quick-assign header */}
            <div className="bg-orange-50/80 border-b border-orange-200 px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-orange-700 mb-1">INV NO.</label>
                  <input
                    id="lg-quick-inv"
                    type="text"
                    value={lgQuickInv}
                    placeholder="Type INV..."
                    onChange={e => setLgQuickInv(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && lgQuickInv.trim()) {
                        e.preventDefault()
                        if (lgSelectedSoIds.size > 0) {
                          setSoInvMap(p => {
                            const n = { ...p }
                            lgSelectedSoIds.forEach(id => { n[id] = lgQuickInv.trim() })
                            return n
                          })
                          setLgSelectedSoIds(new Set())
                          setLgQuickInv("")
                        } else {
                          const el = document.getElementById("lg-quick-so") as HTMLInputElement | null
                          el?.focus(); el?.select()
                        }
                      }
                    }}
                    onBlur={() => {
                      // Clear selection when leaving INV field without assigning
                    }}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
                {lgQuickInv.trim() && (
                  <div className="relative">
                    <label className="block text-xs font-semibold text-orange-700 mb-1">SO No. <span className="font-normal text-orange-400">(type+Enter or click a row)</span></label>
                    <div className="relative">
                      <input
                        id="lg-quick-so"
                        type="text"
                        value={lgQuickSo}
                        placeholder="Search SO..."
                        autoComplete="off"
                        onChange={e => setLgQuickSo(e.target.value)}
                        onKeyDown={e => {
                          if (e.key !== "Enter") return
                          e.preventDefault()
                          const q = lgQuickSo.trim()
                          if (!q) return
                          // Assign the INV to EVERY row of this SO (1 SO can have many rows).
                          const rows = allLgItems.filter((i: any) => i.so === q)
                          if (rows.length) {
                            setSoInvMap(p => { const n = { ...p }; rows.forEach((r: any) => { n[r.id] = lgQuickInv.trim() }); return n })
                            setLgQuickSo("")
                          }
                        }}
                        className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                      />
                      {lgQuickSo.trim() && (
                        <div className="absolute top-full mt-1 left-0 bg-white border border-orange-200 rounded-xl shadow-lg z-20 min-w-64 max-h-48 overflow-y-auto">
                          {(() => {
                            const matching = allLgItems.filter((i: any) => i.so.includes(lgQuickSo.trim()))
                            const sos = [...new Set(matching.map((i: any) => i.so))]
                            if (sos.length === 0) return <p className="text-xs text-gray-400 px-3 py-2">SO not found</p>
                            return sos.map((so: any) => {
                              const rows = allLgItems.filter((i: any) => i.so === so)
                              const allAssigned = rows.every((r: any) => soInvMap[(r as any).id] === lgQuickInv.trim())
                              return (
                                <button key={so} type="button"
                                  onClick={() => {
                                    setSoInvMap(p => {
                                      const n = { ...p }
                                      rows.forEach((r: any) => { if (allAssigned) delete n[(r as any).id]; else n[(r as any).id] = lgQuickInv.trim() })
                                      return n
                                    })
                                    setLgQuickSo("")
                                    document.getElementById("lg-quick-so")?.focus()
                                  }}
                                  className={`flex items-center justify-between w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-orange-50 last:border-0 ${allAssigned ? "bg-orange-50" : ""}`}>
                                  <span><span className="font-semibold">{so}</span><span className="text-gray-400 ml-2">{rows[0]?.style}</span><span className="text-orange-400 ml-2">· {rows.length} row{rows.length > 1 ? "s" : ""}</span></span>
                                  {allAssigned && <span className="text-orange-600 font-bold">✓</span>}
                                </button>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {lgQuickInv.trim() && (
                  <button type="button" onClick={() => { setLgQuickInv(""); setLgQuickSo("") }}
                    className="text-xs text-gray-400 hover:text-red-500 pb-1.5">✕ Clear</button>
                )}
              </div>
              {lgQuickInv.trim() && (() => {
                const assignedInThisInv = allLgItems.filter((i: any) => soInvMap[(i as any).id] === lgQuickInv.trim())
                return assignedInThisInv.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-orange-600 font-medium">{lgQuickInv}:</span>
                    {assignedInThisInv.map((i: any) => (
                      <span key={(i as any).id} className="inline-flex items-center gap-1 text-xs bg-orange-600 text-white px-2.5 py-0.5 rounded-full">
                        {i.so}
                        <button type="button"
                          onClick={() => setSoInvMap(p => { const n = { ...p }; delete n[(i as any).id]; return n })}
                          className="hover:opacity-70 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-orange-400">Click a row or type an SO to add it to {lgQuickInv}</p>
                )
              })()}
            </div>

            {/* Table — frozen header, height-capped so the horizontal scrollbar is visible */}
            <div className="overflow-auto max-h-[60vh] border border-orange-100 rounded-lg">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="px-3 py-2 sticky top-0 left-0 z-20 bg-orange-50 border-b border-orange-100">
                      <input type="checkbox"
                        checked={allLgItems.length > 0 && allLgItems.every((i: any) => lgSelectedSoIds.has(i.id) || !!soInvMap[i.id])}
                        onChange={e => setLgSelectedSoIds(e.target.checked ? new Set(allLgItems.map((i: any) => i.id)) : new Set())}
                        className="accent-orange-500" />
                    </th>
                    {["SO No.","Sub","Style","Customer PO","Description","QTY Orig","QTY Air","Weight (KG)","Est. Freight (THB)","Country","Port","Factory","INV NO.","Actual Freight (THB)"].map(h =>
                      <th key={h} className={`px-3 py-2 text-left text-orange-700 font-medium sticky top-0 bg-orange-50 border-b border-orange-100 ${h === "SO No." ? "left-10 z-20" : "z-10"}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50">
                  {allLgItems.map((item: any, idx: number) => {
                    const invNo = soInvMap[item.id] || ""
                    const isQuickHighlight = lgQuickInv.trim() && invNo === lgQuickInv.trim()
                    const hawbGroup = hawbGroups.find(g => invNo && g.invNos.includes(invNo))
                    const actual = hawbGroup ? (() => {
                      const { avgPerUnit } = getHawbCalc(hawbGroup)
                      return parseFloat(hawbGroup.totalCost) > 0 ? item.qtyRequestAir * avgPerUnit : null
                    })() : null
                    return (
                      <tr key={item.id}
                        onClick={() => {
                          if (!lgQuickInv.trim()) return
                          setSoInvMap(p => {
                            if (p[item.id] === lgQuickInv.trim()) { const n = { ...p }; delete n[item.id]; return n }
                            return { ...p, [item.id]: lgQuickInv.trim() }
                          })
                        }}
                        className={`transition-colors
                          ${isQuickHighlight ? "bg-orange-100 hover:bg-orange-150" : "hover:bg-orange-50/40"}
                          ${lgQuickInv.trim() ? "cursor-pointer" : ""}
                        `}>
                        <td className={`px-3 py-2 sticky left-0 z-10 ${isQuickHighlight ? "bg-orange-100" : "bg-white"}`} onClick={e => e.stopPropagation()}>
                          <input type="checkbox"
                            checked={lgSelectedSoIds.has(item.id) || !!invNo}
                            onChange={e => {
                              if (lgQuickInv.trim()) {
                                // INV is typed → assign/unassign directly
                                setSoInvMap(p => {
                                  const n = { ...p }
                                  if (e.target.checked) n[item.id] = lgQuickInv.trim()
                                  else delete n[item.id]
                                  return n
                                })
                              } else {
                                setLgSelectedSoIds(p => { const n = new Set(p); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })
                              }
                            }}
                            className="accent-orange-500" />
                        </td>
                        <td className={`px-3 py-2 font-semibold text-orange-900 sticky left-10 z-10 ${isQuickHighlight ? "bg-orange-100" : "bg-white"}`}>{item.so}</td>
                        <td className="px-3 py-2 text-gray-500">{item.sub || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{item.style}</td>
                        <td className="px-3 py-2 text-gray-500">{item.customerPO || "—"}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-48 truncate">{item.description || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{item.qtyOriginalShipment}</td>
                        <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                        <td className="px-3 py-2 text-blue-700">{item.grossWeight != null ? Number(item.grossWeight).toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-blue-700">{item.airFreight != null ? Number(item.airFreight).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{item.country || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{item.port || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{item.factory || "—"}</td>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <input
                              id={`lg-inv-${item.id}`}
                              type="text"
                              value={invNo}
                              placeholder="INV-0000"
                              onChange={e => setSoInvMap(p => ({ ...p, [item.id]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key !== "Enter") return
                                e.preventDefault()
                                const nextItem = allLgItems[idx + 1]
                                if (nextItem) {
                                  const nextInput = document.getElementById(`lg-inv-${(nextItem as any).id}`) as HTMLInputElement | null
                                  nextInput?.focus(); nextInput?.select()
                                }
                              }}
                              className={`border rounded-lg px-2.5 py-1 text-xs w-36 focus:ring-1 focus:ring-orange-400 focus:outline-none
                                ${invNo ? "border-orange-400 bg-orange-50 font-medium" : "border-orange-200"}`}
                            />
                            {invNo && (
                              <button type="button"
                                onClick={() => setSoInvMap(p => { const n = { ...p }; delete n[item.id]; return n })}
                                className="text-gray-300 hover:text-red-400 text-sm leading-none shrink-0">×</button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {actual != null
                            ? <span className="font-semibold text-green-700">{actual.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* HAWB Section — shown when at least one INV NO. is filled */}
          {uniqueInvNos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">Air Waybill (HAWB)</p>
                {hawbGroups.length === 0 && <span className="text-xs text-orange-400">Press "+ Add HAWB" then tick to select INV</span>}
              </div>

              {hawbGroups.map((group, gi) => {
                const { items, totalQty, avgPerUnit, totalCost, hasOverride } = getHawbCalc(group)
                const hasCost = totalCost > 0
                return (
                  <div key={group.id} className="bg-white rounded-xl border border-orange-200 overflow-hidden shadow-sm">
                    {/* Header: HAWB No. + Date + Cost inline */}
                    <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-bold text-orange-800 shrink-0">HAWB #{gi + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-gray-500 shrink-0">HAWB No.</label>
                          <input type="text" value={group.hawbNo} placeholder="123-12345678"
                            onChange={e => updateHawb(group.id, { hawbNo: e.target.value })}
                            className="border border-orange-300 rounded-lg px-2.5 py-1 text-xs w-36 focus:ring-1 focus:ring-orange-400 focus:outline-none" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-gray-500 shrink-0">Total Cost (THB)</label>
                          <input type="number" value={group.totalCost} placeholder="0" min="0"
                            onChange={e => updateHawb(group.id, { totalCost: e.target.value })}
                            className="border border-orange-300 rounded-lg px-2.5 py-1 text-xs w-32 focus:ring-1 focus:ring-orange-400 focus:outline-none" />
                        </div>
                        {items.length > 0 && hasCost && (
                          <span className="text-xs text-orange-600 font-medium">
                            {totalQty.toLocaleString()} pcs · avg {avgPerUnit.toFixed(4)} THB/pc
                          </span>
                        )}
                        <button type="button" onClick={() => removeHawbGroup(group.id)}
                          className="ml-auto text-xs text-red-400 hover:text-red-600 font-medium shrink-0">Delete</button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* INV checklist */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">Select INV in this HAWB</label>
                        <div className="space-y-1.5">
                          {uniqueInvNos.map(invNo => {
                            const isSelected = group.invNos.includes(invNo)
                            const isTaken = !isSelected && assignedHawbInvNos.has(invNo)
                            const soCount = allLgItems.filter((i: any) => soInvMap[i.id] === invNo).length
                            const qty = allLgItems.filter((i: any) => soInvMap[i.id] === invNo).reduce((s: number, i: any) => s + (Number(i.qtyRequestAir) || 0), 0)
                            return (
                              <label key={invNo}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors
                                  ${isSelected ? "bg-orange-50 border-orange-300" : ""}
                                  ${isTaken ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50" : ""}
                                  ${!isSelected && !isTaken ? "border-gray-200 hover:bg-orange-50/50 hover:border-orange-200 cursor-pointer" : ""}`}>
                                <input type="checkbox" checked={isSelected} disabled={isTaken}
                                  onChange={() => toggleInvInHawb(group.id, invNo)}
                                  className="accent-orange-500 w-4 h-4 shrink-0" />
                                <span className="flex-1 flex items-center gap-3">
                                  <span className={`text-sm font-semibold ${isSelected ? "text-orange-900" : isTaken ? "text-gray-400" : "text-gray-700"}`}>{invNo}</span>
                                  <span className="text-xs text-gray-400">{soCount} SO · {qty.toLocaleString()} pcs</span>
                                  {isTaken && <span className="text-xs text-gray-400 italic">Already in another HAWB</span>}
                                </span>
                                {isSelected && <span className="text-xs font-medium text-orange-600 shrink-0">✓ Selected</span>}
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      {/* Calc summary table */}
                      {items.length > 0 ? (
                        <div>
                          {hasCost && !hasOverride && (
                            <p className="text-xs text-orange-700 mb-2">
                              Avg/unit = {totalCost.toLocaleString()} ÷ {totalQty} pcs = <strong>THB {avgPerUnit.toFixed(4)}</strong>
                            </p>
                          )}
                          {hasOverride && (
                            <p className="text-xs text-blue-700 mb-2">
                              Per-item Actual Freight entry mode · total = <strong>THB {totalCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
                              <button type="button" onClick={() => {
                                const cleared: Record<string, string> = { ...soActualOverride }
                                items.forEach((i: any) => { delete cleared[i.id] })
                                setSoActualOverride(cleared)
                              }} className="ml-2 text-red-400 hover:text-red-600">× Clear values</button>
                            </p>
                          )}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs rounded-lg overflow-hidden border border-orange-100 whitespace-nowrap">
                              <thead className="bg-orange-100/60">
                                <tr>
                                  {["SO No.","INV NO.","Style","QTY Air","Actual Freight (THB)"].map(h =>
                                    <th key={h} className="px-3 py-1.5 text-left text-orange-700 font-medium">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-orange-50">
                                {items.map((item: any) => {
                                  const calcVal = hasCost && !hasOverride ? item.qtyRequestAir * avgPerUnit : null
                                  const displayVal = soActualOverride[item.id] !== undefined ? soActualOverride[item.id] : (calcVal !== null ? calcVal.toFixed(2) : "")
                                  return (
                                    <tr key={item.id} className="bg-white/80">
                                      <td className="px-3 py-1.5 font-medium">{item.so}</td>
                                      <td className="px-3 py-1.5 text-gray-500">{soInvMap[item.id] || "—"}</td>
                                      <td className="px-3 py-1.5 text-gray-500">{item.style}</td>
                                      <td className="px-3 py-1.5">{item.qtyRequestAir}</td>
                                      <td className="px-3 py-1.5">
                                        <input
                                          type="number"
                                          value={displayVal}
                                          placeholder="0.00"
                                          min="0"
                                          step="0.01"
                                          onChange={e => setSoActualOverride(p => ({ ...p, [item.id]: e.target.value }))}
                                          className={`w-32 border rounded-lg px-2 py-0.5 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none font-semibold
                                            ${soActualOverride[item.id] !== undefined ? "border-blue-300 bg-blue-50 text-blue-800" : "border-orange-200 text-orange-800 bg-transparent"}`}
                                        />
                                      </td>
                                    </tr>
                                  )
                                })}
                                <tr className="bg-orange-50 font-semibold text-orange-900">
                                  <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-orange-600">Total</td>
                                  <td className="px-3 py-1.5">{totalQty}</td>
                                  <td className="px-3 py-1.5">{totalCost > 0 ? totalCost.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-center text-gray-400 py-2">Tick INV above to view SO list and calculate Freight</p>
                      )}
                    </div>
                  </div>
                )
              })}

              <button type="button" onClick={addHawbGroup}
                className="w-full border-2 border-dashed border-orange-300 rounded-xl py-2.5 text-sm text-orange-600 hover:bg-orange-50 hover:border-orange-400 transition-colors font-medium">
                + Add Air Waybill (HAWB)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {canAct && !isStyleApprover && !isClaimApprover && !isVpScmAtScm && !isScmAtVpMer && !isPresidentRole && !isLogisticsRole && !isGWApprover && role !== "PRESIDENT" && role !== "LOGISTICS" && !role.startsWith("DVM_") && !role.startsWith("CLAIM_") && !CLAIM_VP_ROLES_LOCAL.includes(role) && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <h2 className="font-semibold text-gray-800">ACTIONS</h2>
            {isGWRequest && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">GW</span>}
          </div>

          {/* GW — claim dept info for CLAIM_GW */}
          {isGWRequest && req.claimDepartment && role === "CLAIM_GW" && (
            <div className="text-sm text-gray-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Claim Department: <span className="font-semibold text-emerald-700">{req.claimDepartment === "SUPPLIER_IN" ? "Supplier (Internal)" : req.claimDepartment === "SUPPLIER_OUT" ? "Supplier (External)" : req.claimDepartment}</span>
            </div>
          )}

          {/* SCM */}
          {req.status === "PENDING_SCM" && (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Assign Claim Department</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pendingScmItems.filter((i: any) => isScmItemReady(i)).length}/{pendingScmItems.length} ready
                    {forwardedScmItems.length > 0 && <span className="text-green-600 ml-2">· {forwardedScmItems.length} forwarded</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Export */}
                  <button type="button" onClick={async () => {
                    const rows = pendingScmItems.map((item: any) => {
                      const d = soClaimDepts[item.id] || []
                      return {
                        "SO": item.so, "SUB": item.sub || "", "STYLE": item.style,
                        "CUSTOMER PO": item.customerPO || "", "DESCRIPTION": item.description || "",
                        "QTY ORIG": item.qtyOriginalShipment, "QTY AIR": item.qtyRequestAir,
                        "FACTORY": item.factory || "", "COUNTRY": item.country || "", "PORT": item.port || "",
                        "MER REASON": item.reasonDelay || "",
                        "CLAIM DEPT 1": d[0]?.dept ? (CLAIM_DEPT_LABEL[d[0].dept] || d[0].dept) : "", "%CLAIM1": d[0]?.pct ?? "", "REASON 1": d[0]?.reason || "",
                        "CLAIM DEPT 2": d[1]?.dept ? (CLAIM_DEPT_LABEL[d[1].dept] || d[1].dept) : "", "%CLAIM2": d[1]?.pct ?? "", "REASON 2": d[1]?.reason || "",
                        "CLAIM DEPT 3": d[2]?.dept ? (CLAIM_DEPT_LABEL[d[2].dept] || d[2].dept) : "", "%CLAIM3": d[2]?.pct ?? "", "REASON 3": d[2]?.reason || ""
                      } as Record<string, any>
                    })
                    // exceljs writes real Excel dropdown (data validation); SheetJS cannot.
                    const ExcelJSMod: any = await import("exceljs")
                    const ExcelJS = ExcelJSMod.default || ExcelJSMod
                    const wb = new ExcelJS.Workbook()
                    const ws = wb.addWorksheet("SCM")
                    const headers = ["SO","SUB","STYLE","CUSTOMER PO","DESCRIPTION","QTY ORIG","QTY AIR","FACTORY","COUNTRY","PORT","MER REASON","CLAIM DEPT 1","%CLAIM1","REASON 1","CLAIM DEPT 2","%CLAIM2","REASON 2","CLAIM DEPT 3","%CLAIM3","REASON 3"]
                    const widths = [8,6,12,14,22,10,10,10,12,12,20,16,7,16,16,7,16,16,7,16]
                    ws.columns = headers.map((h, i) => ({ header: h, key: h, width: widths[i] }))
                    ws.getColumn(11).hidden = true // MER REASON (Reason delay from MER) — hidden, data kept
                    ws.getRow(1).font = { bold: true }
                    rows.forEach((r: Record<string, any>) => ws.addRow(r))
                    // Dropdown on all 3 CLAIM DEPT columns → L / O / R
                    const listFormula = `"${CLAIM_DEPTS.join(",")}"`
                    for (let r = 2; r <= rows.length + 1; r++) {
                      for (const col of ["L", "O", "R"]) {
                        ws.getCell(`${col}${r}`).dataValidation = {
                          type: "list", allowBlank: true, formulae: [listFormula],
                          showErrorMessage: true, errorStyle: "error", errorTitle: "Invalid claim dept",
                          error: `Please select from the list: ${CLAIM_DEPTS.join(", ")}`,
                        }
                      }
                    }
                    const buf = await wb.xlsx.writeBuffer()
                    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url; a.download = `scm-claim-dept_${req.documentNo}.xlsx`; a.click()
                    URL.revokeObjectURL(url)
                  }} className="flex items-center gap-1 border border-gray-300 bg-white text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50">
                    ↓ Export Excel
                  </button>
                  {/* Import */}
                  <label className="flex items-center gap-1 border border-gray-300 bg-white text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 cursor-pointer">
                    ↑ Import Excel
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return
                      const buf = await file.arrayBuffer()
                      const wb2 = XLSX.read(buf, { type: "buffer" })
                      const ws2 = wb2.Sheets[wb2.SheetNames[0]]
                      const rows2 = XLSX.utils.sheet_to_json(ws2, { defval: "" }) as any[]
                      const labelToCode = Object.fromEntries(Object.entries(CLAIM_DEPT_LABEL).map(([k, v]) => [v, k]))
                      const newDepts: Record<string, {dept: string, pct: number, reason: string}[]> = {}
                      const newComments: Record<string, string> = {}
                      const errorList: {so: string, issues: string[]}[] = []
                      rows2.forEach((row: any) => {
                        const so = String(row["SO"] || "").trim()
                        const sub = String(row["SUB"] || "").trim()
                        if (!so) return
                        const soLabel = sub ? `${so}/${sub}` : so
                        const found = pendingScmItems.find((i: any) => i.so === so && (i.sub || "") === sub)
                        const issues: string[] = []
                        if (!found) { issues.push("This SO was not found in the list"); errorList.push({ so: soLabel, issues }); return }
                        const slots = [1,2,3].map(n => ({
                          raw: String(row[`CLAIM DEPT ${n}`] || "").trim(),
                          pct: Number(row[`%CLAIM${n}`] || row[`%Claim${n}`] || row[`%${n}`] || 0),
                          reason: String(row[`REASON ${n}`] || "").trim(),
                          n
                        }))
                        const filledSlots = slots.filter(s => s.raw)
                        filledSlots.forEach(s => {
                          const code = labelToCode[s.raw] || s.raw
                          if (!CLAIM_DEPTS.includes(code)) issues.push(`CLAIM DEPT ${s.n}: "${s.raw}" is not recognized`)
                          if (!s.pct) issues.push(`CLAIM DEPT ${s.n} (${s.raw}): missing %CLAIM${s.n}`)
                          if (!s.reason) issues.push(`CLAIM DEPT ${s.n} (${s.raw}): missing REASON ${s.n}`)
                        })
                        if (filledSlots.length > 0) {
                          const total = filledSlots.reduce((sum, s) => sum + s.pct, 0)
                          if (total !== 100) issues.push(`% totals ${total}% — must total 100%`)
                        }
                        if (issues.length > 0) { errorList.push({ so: soLabel, issues }); return }
                        const parsed = filledSlots.flatMap(s => {
                          const dept = labelToCode[s.raw] || s.raw
                          return CLAIM_DEPTS.includes(dept) && s.pct > 0 ? [{ dept, pct: s.pct, reason: s.reason }] : []
                        })
                        if (parsed.length > 0) newDepts[(found as any).id] = parsed
                        const r1 = String(row["SCM REASON"] || row["REASON 1"] || "").trim()
                        if (r1) newComments[(found as any).id] = r1
                      })
                      if (errorList.length > 0) { setImportErrors(errorList); e.target.value = ""; return }
                      if (Object.keys(newDepts).length > 0) setSoClaimDepts(p => ({ ...p, ...newDepts }))
                      if (Object.keys(newComments).length > 0) setSoClaimComments(p => ({ ...p, ...newComments }))
                      e.target.value = ""
                    }} />
                  </label>
                  {/* VP SCM — dropdown from master */}
                  <div>
                    {vpScmUsers.length === 0 ? (
                      <p className="text-xs text-red-400">No VP SCM found in Master</p>
                    ) : vpScmUsers.length === 1 ? (
                      <div className="flex items-center gap-1.5 border border-green-400 bg-green-50 rounded-lg px-3 py-1.5 text-xs min-w-[180px]">
                        <span className="text-green-800 font-medium">{vpScmUsers[0].name}</span>
                        <span className="text-green-500 ml-auto">Auto</span>
                      </div>
                    ) : (
                      <select
                        value={vpScmSelectedEmail}
                        onChange={e => {
                          const u = vpScmUsers.find((u: any) => u.email === e.target.value)
                          setVpScmSelectedEmail(e.target.value)
                          setVpScmSelectedName(u?.name || "")
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:ring-1 focus:ring-blue-400 focus:outline-none min-w-[180px] bg-white">
                        <option value="">-- Select VP SCM --</option>
                        {vpScmUsers.map((u: any) => (
                          <option key={u.id} value={u.email}>{u.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {/* Forward button */}
                  {readyScmStyles.length > 0 && (
                    <button type="button" disabled={scmForwarding || !vpScmSelectedEmail}
                      onClick={async () => {
                        setScmForwarding(true)
                        const depts: Record<string, {dept: string, pct: number}[]> = {}
                        const comments: Record<string, string> = {}
                        const dvms: Record<string, string> = {}
                        readyScmItemIds.forEach((iid: string) => {
                          depts[iid] = soClaimDepts[iid] || []
                          if (soClaimComments[iid]) comments[iid] = soClaimComments[iid]
                          if (soDvmAssigned[iid]) dvms[iid] = soDvmAssigned[iid]
                        })
                        const res = await fetch(`/api/requests/${id}/approve`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "approve", soClaimData: depts, soClaimComments: comments, soDvmData: dvms, comment: "", assignedVpScm: vpScmSelectedEmail })
                        })
                        if (res.ok) {
                          const updated = await res.json()
                          if (updated.status !== "PENDING_SCM") { window.location.href = "/approvals" } else { setReq(updated); setScmForwarding(false) }
                        } else { setScmForwarding(false) }
                      }}
                      title={!vpScmSelectedEmail ? "Please select VP SCM first" : ""}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed
                        ${vpScmSelectedEmail
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-200 text-gray-400 border border-dashed border-gray-400"}`}>
                      {vpScmSelectedEmail
                        ? `Forward ${readyScmStyles.length} style(s) → VP SCM`
                        : `⚠ Select VP SCM first (${readyScmStyles.length} style(s) ready)`}
                    </button>
                  )}
                </div>
              </div>

              {/* Import error popup */}
              {importErrors.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setImportErrors([])}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 text-lg">⚠</span>
                        <p className="font-semibold text-gray-800 text-sm">Import failed — found {importErrors.length} error(s)</p>
                      </div>
                      <button onClick={() => setImportErrors([])} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                    </div>
                    <div className="overflow-y-auto max-h-96 px-5 py-3 space-y-3">
                      {importErrors.map((e, i) => (
                        <div key={i} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                          <p className="text-xs font-bold text-red-700 mb-1.5">SO {e.so}</p>
                          <ul className="space-y-0.5">
                            {e.issues.map((iss, j) => (
                              <li key={j} className="text-xs text-red-600 flex items-start gap-1.5">
                                <span className="shrink-0 mt-0.5">•</span>
                                <span>{iss}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                      <button onClick={() => setImportErrors([])}
                        className="bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                        Got it — fix the Excel and try Import again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Forwarding overlay */}
              {scmForwarding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[260px] max-w-sm text-center">
                    <svg className="animate-spin h-10 w-10 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <div>
                      <p className="text-green-700 font-bold text-base">Sending to VP SCM</p>
                      <p className="text-gray-400 text-xs mt-1">Please wait a moment, do not close or reload this page</p>
                    </div>
                  </div>
                </div>
              )}

              {claimFwdSaving && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[260px] max-w-sm text-center">
                    <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <div>
                      <p className="text-blue-700 font-bold text-base">Sending</p>
                      <p className="text-gray-400 text-xs mt-1">Please wait a moment, do not close or reload this page</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick-assign panel */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quick Assign</p>
                  <button type="button" onClick={() => { setScmRows([{dept:"", pct:"", reason:""}]); setScmSelectedIds(new Set()) }}
                    className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Clear
                  </button>
                </div>

                {/* Dept rows — up to 3 */}
                <div className="space-y-1.5">
                  {scmRows.map((row, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-3 text-right shrink-0">{idx+1}</span>
                      <select value={row.dept}
                        onChange={e => setScmRows(p => p.map((r, i) => i === idx ? {...r, dept: e.target.value} : r))}
                        className={`border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none w-36
                          ${row.dept ? "border-blue-400 bg-blue-50 text-blue-800 font-semibold" : "border-gray-300 text-gray-500"}`}>
                        <option value="">-- CLAIM DEPT --</option>
                        {CLAIM_DEPTS.filter(d => !scmRows.some((r, i) => i !== idx && r.dept === d)).map(d =>
                          <option key={d} value={d}>{CLAIM_DEPT_LABEL[d] || d}</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">%</span>
                        <input type="number" min="1" max="100" placeholder="0" value={row.pct}
                          onChange={e => setScmRows(p => p.map((r, i) => i === idx ? {...r, pct: e.target.value} : r))}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-14 text-center focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                      </div>
                      <input type="text" placeholder="Reason (required)..." value={row.reason}
                        onChange={e => setScmRows(p => p.map((r, i) => i === idx ? {...r, reason: e.target.value} : r))}
                        className={`rounded-lg px-2 py-1.5 text-xs w-44 focus:ring-1 focus:outline-none border
                          ${row.dept && !row.reason.trim() ? "border-red-400 bg-red-50 focus:ring-red-400" : "border-gray-300 focus:ring-blue-400"}`} />
                      {scmRows.length > 1 && (
                        <button type="button" onClick={() => setScmRows(p => p.filter((_, i) => i !== idx))}
                          className="text-gray-300 hover:text-red-500 text-sm leading-none">✕</button>
                      )}
                    </div>
                  ))}
                  {/* + Add row button */}
                  {scmRows.length < 3 && (
                    <button type="button"
                      onClick={() => setScmRows(p => [...p, {dept:"", pct:"", reason:""}])}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 pl-5">
                      + Add dept
                    </button>
                  )}
                </div>

                {/* % total indicator */}
                {(() => {
                  const filled = scmRows.filter(r => r.dept && r.pct)
                  const total = filled.reduce((s, r) => s + Number(r.pct), 0)
                  if (filled.length === 0) return null
                  return (
                    <p className={`text-[11px] font-semibold pl-5 ${total === 100 ? "text-green-600" : "text-red-500"}`}>
                      Total {total}% {total === 100 ? "✓ Ready to Stamp" : "— must total 100%"}
                    </p>
                  )
                })()}

                {/* SO + Stamp row */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200">
                  <span className="text-xs text-gray-500 shrink-0">SO</span>
                  {/* SO autocomplete */}
                  {(() => {
                    const q = scmSoInput.trim().toLowerCase()
                    const soSuggestions: string[] = q.length >= 2
                      ? Array.from(new Set<string>(pendingScmItems.filter((i: any) =>
                          (i.so || "").toLowerCase().includes(q)
                        ).map((i: any) => String(i.so)))).slice(0, 8)
                      : []
                    const selectSo = (soNum: string) => {
                      const found = pendingScmItems.filter((i: any) => i.so === soNum)
                      if (found.length > 0) {
                        setScmSelectedIds(p => { const n = new Set(p); found.forEach((i: any) => n.add(i.id)); return n })
                        setScmSoInput("")
                      }
                    }
                    return (
                      <div className="relative">
                        <input id="scm-so-input" type="text" autoComplete="off"
                          placeholder={scmSelectedIds.size > 0 ? `${scmSelectedIds.size} selected` : "Type SO + Enter to select..."}
                          value={scmSoInput} onChange={e => setScmSoInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Escape") { setScmSoInput(""); return }
                            if (e.key !== "Enter") return
                            e.preventDefault()
                            if (soSuggestions.length === 1) { selectSo(soSuggestions[0]); return }
                            const tokens = scmSoInput.split(/[\s,]+/).map(t => t.trim()).filter(Boolean)
                            if (!tokens.length) return
                            const foundItems = tokens.flatMap(token => {
                              const [soNum, sub = ""] = token.includes("/") ? token.split("/") : [token, ""]
                              return pendingScmItems.filter((i: any) => i.so === soNum && (sub === "" || (i.sub || "") === sub))
                            })
                            if (foundItems.length > 0) {
                              setScmSelectedIds(p => { const n = new Set(p); foundItems.forEach((i: any) => n.add(i.id)); return n })
                              setScmSoInput("")
                            }
                          }}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-56 focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                        {soSuggestions.length > 0 && (
                          <div className="absolute z-50 top-full left-0 mt-0.5 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                            {soSuggestions.map(soNum => {
                              const soItems = pendingScmItems.filter((i: any) => i.so === soNum)
                              const alreadySelected = soItems.every((i: any) => scmSelectedIds.has(i.id))
                              const styles = [...new Set(soItems.map((i: any) => i.style as string))].join(", ")
                              return (
                                <button key={soNum} type="button"
                                  onMouseDown={e => { e.preventDefault(); selectSo(soNum) }}
                                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-blue-50 text-left transition-colors border-b border-gray-100 last:border-0
                                    ${alreadySelected ? "bg-green-50 text-green-700" : "text-gray-800"}`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    {alreadySelected && <span className="text-green-500 font-bold shrink-0">✓</span>}
                                    <span className="font-semibold shrink-0">{soNum}</span>
                                    <span className="text-gray-400 truncate">{styles}</span>
                                  </div>
                                  <span className="text-gray-400 shrink-0">{soItems.length} item{soItems.length > 1 ? "s" : ""}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {(() => {
                    const filled = scmRows.filter(r => r.dept && r.pct)
                    const total = filled.reduce((s, r) => s + Number(r.pct), 0)
                    const missingReason = filled.some(r => !r.reason.trim())
                    const canStamp = scmSelectedIds.size > 0 && filled.length > 0 && total === 100 && !missingReason
                    return (
                      <button type="button" disabled={!canStamp}
                        title={total !== 100 ? "% total must equal 100" : missingReason ? "Please enter Reason for every dept" : scmSelectedIds.size === 0 ? "Select SO first" : ""}
                        onClick={() => {
                          const deptsToApply = filled.map(r => ({ dept: r.dept, pct: Number(r.pct), reason: r.reason.trim() }))
                          const combinedReason = filled.map(r => r.reason.trim()).filter(Boolean).join("; ")
                          setSoClaimDepts(p => { const n = {...p}; scmSelectedIds.forEach(sid => { n[sid] = deptsToApply }); return n })
                          if (combinedReason) setSoClaimComments(p => { const n = {...p}; scmSelectedIds.forEach(sid => { n[sid] = combinedReason }); return n })
                          setScmSelectedIds(new Set())
                          setScmRows([{dept:"", pct:"", reason:""}])
                        }}
                        className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        Stamp{scmSelectedIds.size > 0 ? ` (${scmSelectedIds.size})` : ""}
                      </button>
                    )
                  })()}
                  {scmSelectedIds.size > 0 && (
                    <button type="button" onClick={() => setScmSelectedIds(new Set())}
                      className="text-xs text-gray-400 hover:text-red-500 underline">Cancel</button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">① Enter CLAIM DEPT + % + Reason (up to 3 sets, % total = 100) → ② Type SO + Enter → ③ Stamp</p>
              </div>

              {/* Flat table */}
              {pendingScmItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No items</p>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 w-8">
                            <input type="checkbox" className="accent-blue-500"
                              checked={pendingScmItems.length > 0 && pendingScmItems.every((i: any) => scmSelectedIds.has(i.id))}
                              onChange={e => setScmSelectedIds(e.target.checked ? new Set(pendingScmItems.map((i: any) => i.id)) : new Set())} />
                          </th>
                          {["SO","SUB","STYLE","DESCRIPTION","QTY ORIG","QTY AIR","FACTORY","COUNTRY","PORT","MER REASON",
                            "CLAIM DEPT 1","%CLAIM1","REASON 1",
                            "CLAIM DEPT 2","%CLAIM2","REASON 2",
                            "CLAIM DEPT 3","%CLAIM3","REASON 3",""].map(h =>
                            <th key={h} className={`px-3 py-2 text-left text-gray-500 font-medium ${h.startsWith("%") ? "text-center" : ""}`}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pendingScmItems.map((item: any) => {
                          const dept = soClaimDepts[item.id] || []
                          const deptTotal = dept.reduce((s: number, d: any) => s + d.pct, 0)
                          const isItemReady = dept.length > 0 && deptTotal === 100
                          const isSel = scmSelectedIds.has(item.id)
                          return (
                            <tr key={item.id} className={isSel ? "bg-blue-50" : isItemReady ? "bg-green-50/40" : dept.length > 0 ? "bg-amber-50/40" : "bg-red-50/30"}>
                              <td className="px-3 py-2">
                                <input type="checkbox" className="accent-blue-500" checked={isSel}
                                  onChange={e => setScmSelectedIds(p => { const n = new Set(p); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })} />
                              </td>
                              <td className="px-3 py-2 font-semibold text-gray-800">{item.so}</td>
                              <td className="px-3 py-2 text-gray-500">{item.sub || "—"}</td>
                              <td className="px-3 py-2 text-gray-700">{item.style}</td>
                              <td className="px-3 py-2 text-gray-500 max-w-40 truncate">{item.description || "—"}</td>
                              <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                              <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                              <td className="px-3 py-2 text-gray-500">{item.factory || "—"}</td>
                              <td className="px-3 py-2 text-gray-500">{item.country || "—"}</td>
                              <td className="px-3 py-2 text-gray-500">{item.port || "—"}</td>
                              <td className="px-3 py-2 text-orange-600">{item.reasonDelay || "—"}</td>
                              {[0,1,2].map(n => {
                                const d = dept[n]
                                const cellColor = d ? (isItemReady ? "text-green-800" : deptTotal !== 100 ? "text-amber-700" : "text-gray-700") : "text-gray-300"
                                return [
                                  <td key={`dept${n}`} className={`px-3 py-2 text-xs font-medium ${cellColor} min-w-[100px]`}>
                                    {d ? (CLAIM_DEPT_LABEL[d.dept] || d.dept) : "—"}
                                  </td>,
                                  <td key={`pct${n}`} className={`px-3 py-2 text-xs text-center font-medium ${cellColor}`}>
                                    {d ? `${d.pct}%` : "—"}
                                  </td>,
                                  <td key={`reason${n}`} className="px-3 py-2 min-w-[120px]">
                                    {d ? (
                                      <input type="text" value={d.reason || ""}
                                        onChange={e => setSoClaimDepts(p => {
                                          const n2 = {...p}
                                          n2[item.id] = (n2[item.id] || []).map((x: any, i: number) => i === n ? {...x, reason: e.target.value} : x)
                                          return n2
                                        })}
                                        className={`rounded px-2 py-0.5 text-xs w-28 focus:ring-1 focus:outline-none border
                                          ${!d.reason || !String(d.reason).trim() ? "border-red-400 bg-red-50 focus:ring-red-400" : "border-gray-200 focus:ring-blue-400"}`} />
                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                  </td>
                                ]
                              })}
                              <td className="px-3 py-2">
                                {dept.length > 0 && (
                                  <button type="button"
                                    onClick={() => {
                                      setSoClaimDepts(p => { const n = { ...p }; delete n[item.id]; return n })
                                      setSoClaimComments(p => { const n = { ...p }; delete n[item.id]; return n })
                                    }}
                                    className="text-gray-300 hover:text-red-500 text-sm leading-none transition-colors" title="Clear this row">
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* LOGISTICS — file upload */}
          {req.status === "PENDING_LOGISTICS" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm font-semibold text-gray-700">LOGISTICS UPLOAD</label>
                <a href={req?.bu === "GW" ? "/api/template?bu=GW" : "/api/template?bu=NYG"} download className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">⬇ Download Template</a>
              </div>
              <div className="border-2 border-dashed border-blue-200 rounded-xl p-4 bg-blue-50 text-center space-y-2">
                <p className="text-xs text-blue-600">Upload the Excel with Invoice No / QTY Actual / Actual Air Freight / Booking Date filled in</p>
                <input type="file" accept=".xlsx,.xls" disabled={submitting === "_log_upload"}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return
                    setSubmitting("_log_upload")
                    const form = new FormData(); form.append("file", f)
                    const res = await fetch(`/api/requests/${id}/logistics-upload`, { method: "POST", body: form })
                    const data = await res.json()
                    if (res.ok) { setReq(data.request); alert(`Upload successful: matched ${data.matched} SO` + (data.unmatched?.length ? ` · SO not found: ${data.unmatched.join(", ")}` : "")) }
                    else alert(data.error || "Upload failed")
                    setSubmitting(null); e.target.value = ""
                  }}
                  className="block mx-auto text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50" />
              </div>
              {pendingLogItems.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>{["SO","STYLE","QTY AIR","QTY ACTUAL","ACTUAL (THB)","INVOICE NO","BOOKING DATE"].map(h =>
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pendingLogItems.map((item: any) => {
                        const ready = item.invoiceNo && item.bookingDate && item.actualAirFreight != null
                        return (
                          <tr key={item.id} className={ready ? "bg-green-50" : "hover:bg-gray-50"}>
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2">{item.style}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{item.qtyActualShip ?? <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 font-semibold text-green-700">{item.actualAirFreight != null ? fmtNum(item.actualAirFreight) : <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2">{item.invoiceNo ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{item.invoiceNo}</span> : <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.bookingDate ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{fmtDate(item.bookingDate)}</span> : <span className="text-gray-300">—</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {req.status === "PENDING_LOGISTICS" && !presPassedItems.some((i: any) => i.actualAirFreight != null) && (
            <p className="text-xs text-red-500">Please create HAWB and calculate Air Freight before Confirm</p>
          )}

          <div className="flex gap-2">
            {req.status !== "PENDING_SCM" && (
            <button onClick={() => act("approve")}
              disabled={submitting === "_" ||
                (req.status === "PENDING_LOGISTICS" && !presPassedItems.some((i: any) => i.actualAirFreight != null))}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {submitting === "_" ? "..." : "Confirm"}
            </button>
            )}
            {canReject && (
              <button onClick={() => act("reject")} disabled={submitting === "_"}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {submitting === "_" ? "..." : "Reject"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Logistics edit — upload Excel to update data after PENDING_LOGISTICS */}
      {role === "LOGISTICS" && (req.status === "PENDING_CLAIM" || req.status === "PENDING_VP_CLAIM" || req.status === "PENDING_VP_NYK") && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 border-b pb-2">LOGISTICS DATA <span className="text-xs font-normal text-gray-400 ml-1">(editable by re-upload)</span></h2>
          <div className="border-2 border-dashed border-blue-200 rounded-xl p-4 bg-blue-50 text-center space-y-2">
            <p className="text-xs text-blue-600">Upload a new Excel to edit Invoice No / Actual Air Freight / Booking Date</p>
            <input type="file" accept=".xlsx,.xls" disabled={submitting === "_log_edit"}
              onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return
                setSubmitting("_log_edit")
                const form = new FormData(); form.append("file", f)
                const res = await fetch(`/api/requests/${id}/logistics-upload`, { method: "POST", body: form })
                const data = await res.json()
                if (res.ok) { setReq(data.request); alert(`Update successful: ${data.matched} SO`) }
                else alert(data.error || "Upload failed")
                setSubmitting(null); e.target.value = ""
              }}
              className="block mx-auto text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50" />
          </div>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>{["SO","STYLE","QTY AIR","QTY ACTUAL","ACTUAL (THB)","INVOICE NO","BOOKING DATE"].map(h =>
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeItems.map((item: any) => (
                  <tr key={item.id} className={item.invoiceNo ? "bg-green-50" : "hover:bg-gray-50"}>
                    <td className="px-3 py-2 font-medium">{item.so}</td>
                    <td className="px-3 py-2">{item.style}</td>
                    <td className="px-3 py-2">{item.qtyRequestAir}</td>
                    <td className="px-3 py-2">{item.qtyActualShip ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 font-semibold text-green-700">{item.actualAirFreight != null ? fmtNum(item.actualAirFreight) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2">{item.invoiceNo ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.bookingDate ? fmtDate(item.bookingDate) : <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Items table — hidden when LG or SCM entry section is active, or when DVM/Claim role is acting (they have their own SO approval table) */}
      {!(canAct && isStyleApprover) && !isLgParallelAtScm && !isScmAtVpMer && !isScmAtPendingScm && !isDvmClaim && !isClaimNextApprover && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800">ITEMS ({req.items?.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead className="bg-gray-50 border-b">
                <tr>{([["STYLE","min-w-[110px]"],["SO","min-w-[90px]"],["CUSTOMER PO","min-w-[110px]"],["DESCRIPTION","min-w-[160px]"],["ORIG. DATE","min-w-[90px]"],["PLAN DATE","min-w-[90px]"],["QTY ORIG","min-w-[75px]"],["QTY AIR","min-w-[70px]"],["GROSS WEIGHT (KG)","min-w-[110px]"],["EST. AIR FREIGHT (THB)","min-w-[120px]"],["ACTUAL AIR FREIGHT (THB)","min-w-[130px]"],["CLAIM DEPT","min-w-[110px]"],["REASON","min-w-[120px]"],["FACTORY","min-w-[70px]"],["COUNTRY","min-w-[110px]"],["PORT","min-w-[110px]"],["STATUS","min-w-[110px]"]] as [string,string][]).map(([h,w]) =>
                  <th key={h} className={`px-2 py-2 text-left text-gray-600 whitespace-nowrap ${w}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y text-gray-800">
                {req.items?.map((item: any) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.itemStatus === "REJECTED" ? "opacity-40" : ""}`}>
                    {["style","so","customerPO","description","originalShipmentDate","planShipmentDate","qtyOriginalShipment","qtyRequestAir","grossWeight","airFreight","actualAirFreight","claimDepartment","reasonDelay","factory","country","port"].map(f => (
                      <td key={f} className="px-2 py-1.5 whitespace-nowrap">
                        {f.includes("Date") ? fmtDate(item[f])
                          : f === "grossWeight" ? fmtNum(item[f], 2)
                          : f === "airFreight" || f === "actualAirFreight" ? fmtNum(item[f])
                          : f === "claimDepartment" ? (isGWRequest ? (getSplits(item).map((s: any) => `${s.dept} ${s.pct}%`).join(", ") || "-") : (item[f] ?? "-"))
                          : item[f] ?? "-"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      {(() => {
                        const pendingLabel = isGWRequest
                          ? (req.status === "PENDING_PRESIDENT_GW" ? "President GW" : "DPM GW")
                          : "VP MER"
                        const SD: Record<string, [string, string]> = {
                          PENDING: [pendingLabel, "bg-yellow-100 text-yellow-700"],
                          VP_MER_PASSED: ["SCM", "bg-blue-100 text-blue-700"],
                          PASSED: ["VP SCM", "bg-indigo-100 text-indigo-700"],
                          VP_PASSED: ["President", "bg-purple-100 text-purple-700"],
                          PRES_PASSED: ["Logistics", "bg-cyan-100 text-cyan-700"],
                          LOG_PASSED: ["Claim", "bg-teal-100 text-teal-700"],
                          CLAIM_PASSED: ["VP Claim", "bg-violet-100 text-violet-700"],
                          COMPLETED: ["Done", "bg-green-100 text-green-700"],
                          REJECTED: ["Rejected", "bg-red-100 text-red-700"],
                        }
                        const [label, cls] = SD[item.itemStatus] || ["Pending", "bg-yellow-100 text-yellow-700"]
                        return <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${cls}`}>{label}</span>
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attachments */}
      {(() => {
        const allAttachments: any[] = req.attachments || []
        const canAttach = role === "MER_USER" || role === "SCM_USER"
        const canDelete = role === "MER_USER" || role === "MER_GW"
        const isUploadingReq = uploadingItem === "_req"
        // LG file categories → grouped as a "LOGISTICS FILES" folder, split by type.
        const LG_CATS: Record<string, { label: string; icon: string }> = {
          INV: { label: "Invoice", icon: "🧾" },
          AWB: { label: "Air Waybill", icon: "✈️" },
          EXPENSE: { label: "Expense", icon: "💰" },
        }
        const lgAtts = allAttachments.filter((a: any) => a.category && LG_CATS[a.category])
        const otherAtts = allAttachments.filter((a: any) => !(a.category && LG_CATS[a.category]))
        const attRow = (att: any) => (
          <div key={att.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-gray-50">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg shrink-0">📎</span>
              <div className="min-w-0">
                <a href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-blue-700 hover:underline truncate block">
                  {att.fileName}
                </a>
                <p className="text-xs text-gray-400">
                  {att.uploadedBy?.name}
                  {att.claimDept && <span className="ml-1">({att.claimDept})</span>}
                  {att.itemId && <span className="ml-1 text-gray-300">· SO attached</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <span className="text-xs text-gray-400">{fmtDT(att.createdAt)}</span>
              {canDelete && (
                <button
                  disabled={deletingAtt === att.id}
                  onClick={async () => {
                    if (!confirm(`Delete file "${att.fileName}"?`)) return
                    setDeletingAtt(att.id)
                    await fetch(`/api/attachments/${att.id}`, { method: "DELETE" })
                    setReq((prev: any) => ({ ...prev, attachments: prev.attachments.filter((a: any) => a.id !== att.id) }))
                    setDeletingAtt(null)
                  }}
                  className="text-red-400 hover:text-red-600 text-xs font-medium disabled:opacity-40">
                  {deletingAtt === att.id ? "..." : "✕"}
                </button>
              )}
            </div>
          </div>
        )
        return (
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">ATTACHMENTS {allAttachments.length > 0 && <span className="text-xs font-normal text-gray-400 ml-1">({allAttachments.length})</span>}</h2>
              {canAttach && (
                <label className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border font-medium ${isUploadingReq ? "opacity-50 pointer-events-none bg-gray-50 border-gray-200 text-gray-400" : "border-blue-300 text-blue-600 hover:bg-blue-50"}`}>
                  {isUploadingReq ? "Uploading..." : "📎 Attach File"}
                  <input type="file" className="hidden" multiple disabled={isUploadingReq}
                    onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ""; for (const f of files) await attachFileFn(f) }} />
                </label>
              )}
            </div>
            {allAttachments.length === 0
              ? <p className="text-center py-5 text-xs text-gray-300">No attachments</p>
              : <div>
                  {otherAtts.length > 0 && (
                    <div className="divide-y divide-gray-50">{otherAtts.map(attRow)}</div>
                  )}
                  {lgAtts.length > 0 && (
                    <div className="border-t border-gray-100">
                      <div className="px-5 py-2 bg-indigo-50 text-xs font-semibold text-indigo-700 flex items-center gap-1">
                        📁 LOGISTICS FILES <span className="text-indigo-300 font-normal">({lgAtts.length})</span>
                      </div>
                      {["INV", "AWB", "EXPENSE"].filter(cat => lgAtts.some((a: any) => a.category === cat)).map(cat => (
                        <div key={cat}>
                          <div className="px-5 py-1.5 bg-gray-50 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                            {LG_CATS[cat].icon} {LG_CATS[cat].label}
                          </div>
                          <div className="divide-y divide-gray-50">
                            {lgAtts.filter((a: any) => a.category === cat).map(attRow)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            }
          </div>
        )
      })()}

      {/* Approval History */}
      {(() => {
        const logs: any[] = req.approvalLogs || []
        // Split into rounds — new round starts after each BACK_TO_SCM
        const rounds: any[][] = []
        let cur: any[] = []
        for (const log of logs) {
          cur.push(log)
          if (log.action === "BACK_TO_SCM") { rounds.push(cur); cur = [] }
        }
        if (cur.length > 0) rounds.push(cur)
        const latestRound = rounds[rounds.length - 1] || []
        const prevRounds = rounds.slice(0, rounds.length - 1)
        const logRow = (log: any) => (
          <div key={log.id} className="px-5 py-3 flex justify-between">
            <div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${log.action === "APPROVE" ? "bg-green-100 text-green-700" : log.action === "REJECT" ? "bg-red-100 text-red-700" : log.action === "BACK_TO_SCM" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{log.action}</span>
              <span className="text-xs text-gray-500 ml-2">{log.user?.name} ({log.user?.role})</span>
              {log.comment && <p className="text-xs text-gray-400 mt-0.5">{log.comment}</p>}
              <p className="text-xs text-gray-300 mt-0.5">{STATUS_LABELS[log.fromStatus]} → {STATUS_LABELS[log.toStatus]}</p>
            </div>
            <span className="text-xs text-gray-400">{fmtDT(log.createdAt)}</span>
          </div>
        )
        return (
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">APPROVAL HISTORY</h2>
            </div>
            {logs.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">No history yet</p>}
            <div className="divide-y">{latestRound.map(logRow)}</div>
            {prevRounds.length > 0 && (
              <details className="border-t">
                <summary className="px-5 py-2 text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  Previous rounds ({prevRounds.length}) — click to expand
                </summary>
                {prevRounds.map((round, ri) => (
                  <div key={ri} className="border-t border-dashed border-gray-200">
                    <div className="px-5 py-1.5 bg-gray-50 text-xs text-gray-400 font-medium">Round {ri + 1}</div>
                    <div className="divide-y">{round.map(logRow)}</div>
                  </div>
                ))}
              </details>
            )}
          </div>
        )
      })()}
    </div>
  )
}
