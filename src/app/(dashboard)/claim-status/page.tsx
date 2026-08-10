"use client"
import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { getSplits, deptLabel, claimSplitState } from "@/lib/claim"
import { viewableBus, requestInBu } from "@/lib/bu"

// Cross-document CLAIM STATUS overview (Option B). Read-only matrix: one row per
// document, one column per claim department, each cell coloured Accepted / In
// progress / Rejected — so you can see which department has/hasn't approved
// across ALL documents without opening each one. Purely additive.

type CellState = "approved" | "pending" | "rejected"
type DeptAgg = { approved: number; pending: number; rejected: number; total: number }

// Collapse dept variants to ONE column key: SUPPLIER sub-tags → SUPPLIER, and the
// GW/NYG "SCM NYK"/"SCM NYG" vs plain "NYK"/"NYG" spellings → the same NYK/NYG column.
const canonDept = (d: string) => {
  if (d === "SUPPLIER_IN" || d === "SUPPLIER_OUT") return "SUPPLIER"
  if (d === "SCM NYK") return "NYK"
  if (d === "SCM NYG") return "NYG"
  return d
}
const DEPT_ORDER_GW = ["NYK", "NYG", "GW", "SUPPLIER"]
const DEPT_ORDER_NYG = ["COMMERCIAL", "PROCUREMENT", "NYK", "PRODUCTION"]

const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }

// Per-doc: dept (canonical) → tally of split states across all its SOs.
function docDeptMap(doc: any): Record<string, DeptAgg> {
  const map: Record<string, DeptAgg> = {}
  for (const it of doc?.items || []) {
    // The SO's overall status can override the per-split status (which historical/admin imports
    // leave null even though the doc is done): COMPLETED/ACCOUNTING = accepted; REJECTED/sent-back
    // = rejected. Otherwise fall back to the per-split claim status.
    const itemRejected = it.itemStatus === "REJECTED" || it.itemStatus === "CLAIM_REJECT_GW"
    const itemDone = it.itemStatus === "COMPLETED" || it.itemStatus === "ACCOUNTING_PENDING"
    for (const sp of getSplits(it)) {
      const dept = canonDept(sp.dept)
      const st: CellState = itemRejected ? "rejected" : itemDone ? "approved" : claimSplitState(sp.dept, sp.status).s
      const m = (map[dept] ||= { approved: 0, pending: 0, rejected: 0, total: 0 })
      m[st]++; m.total++
    }
  }
  return map
}
// One dept's cell state from its tally.
const cellStateOf = (a: DeptAgg): CellState =>
  a.total > 0 && a.approved === a.total ? "approved" : a.pending > 0 ? "pending" : "rejected"

const CHIP: Record<CellState, string> = {
  approved: "bg-green-100 text-green-700 border-green-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
}
const DOT: Record<CellState, string> = { approved: "bg-green-500", pending: "bg-amber-500", rejected: "bg-red-500" }
const WORD: Record<CellState, string> = { approved: "Accepted", pending: "In progress", rejected: "Rejected" }

export default function ClaimStatusPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const { bus: buTabs } = viewableBus(session?.user)
  const showBuToggle = buTabs.length > 1
  const [activeBu, setActiveBu] = useState("NYG")
  const buInit = useRef(false)
  useEffect(() => {
    if (buInit.current || !session?.user) return
    setActiveBu(buTabs[0] || "NYG"); buInit.current = true
  }, [session, buTabs])

  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [deptF, setDeptF] = useState("")     // filter to one department
  const [statusF, setStatusF] = useState("") // approved | pending | rejected

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => { setRequests(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  // Show EVERY submitted document in this BU (not only claim-stage ones) so nothing is missing.
  // Docs not yet at the claim stage have no per-dept breakdown → Overall "In progress", cells "–".
  // Only unsubmitted drafts are hidden.
  const docs = requests
    .filter(r => requestInBu(r, activeBu) && (!r.isTest || role === "ADMIN") && r.status !== "DRAFT")
    .map(r => ({ r, map: docDeptMap(r) }))

  // Columns = preferred order filtered to depts actually present, + any extras.
  const preferred = activeBu === "GW" ? DEPT_ORDER_GW : DEPT_ORDER_NYG
  const present = new Set<string>()
  docs.forEach(x => Object.keys(x.map).forEach(d => present.add(d)))
  const cols = [...preferred.filter(d => present.has(d)), ...[...present].filter(d => !preferred.includes(d)).sort()]

  // Overall doc state across its involved depts. No dept data (older/imported docs)
  // → fall back to the document status: COMPLETED = Accepted, else In progress.
  const docStateOf = (map: Record<string, DeptAgg>, status?: string): CellState => {
    const states = Object.values(map).map(cellStateOf)
    if (states.length === 0) return status === "COMPLETED" ? "approved" : "pending"
    if (states.every(s => s === "approved")) return "approved"
    if (states.some(s => s === "pending")) return "pending"
    return "rejected"
  }

  // Apply filters.
  const rows = docs.filter(({ r, map }) => {
    if (q && !String(r.documentNo || "").toLowerCase().includes(q.toLowerCase())) return false
    if (deptF && !map[deptF]) return false
    if (statusF) {
      const s = deptF ? cellStateOf(map[deptF]) : docStateOf(map, r.status)
      if (s !== statusF) return false
    }
    return true
  })

  const tally = { approved: 0, pending: 0, rejected: 0 }
  rows.forEach(({ r, map }) => { tally[docStateOf(map, r.status)]++ })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">CLAIM STATUS</h1>
        {showBuToggle && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {buTabs.map(bu => (
              <button key={bu} onClick={() => { setActiveBu(bu); setDeptF("") }}
                className={`px-3 py-1 rounded-md text-sm font-medium ${activeBu === bu ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"}`}>{bu}</button>
            ))}
          </div>
        )}
        <p className="text-sm text-gray-400">Which department has accepted / rejected each document</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        {([["approved", "Fully accepted"], ["pending", "In progress"], ["rejected", "Has rejected"]] as [CellState, string][]).map(([s, label]) => (
          <div key={s} className={`rounded-xl border p-4 ${CHIP[s]} bg-opacity-40`}>
            <p className="text-2xl font-bold tabular-nums">{tally[s]}</p>
            <p className="text-xs font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-gray-200 rounded-xl px-4 py-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search document no..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        <select value={deptF} onChange={e => setDeptF(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value="">All departments</option>
          {cols.map(d => <option key={d} value={d}>{deptLabel(d)}</option>)}
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value="">All statuses</option>
          <option value="approved">Accepted</option>
          <option value="pending">In progress</option>
          <option value="rejected">Rejected</option>
        </select>
        {(q || deptF || statusF) && (
          <button onClick={() => { setQ(""); setDeptF(""); setStatusF("") }}
            className="text-xs text-gray-500 hover:text-gray-800 underline">Clear</button>
        )}
        <span className="ml-auto text-xs text-gray-400">{rows.length} document(s)</span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[11px] text-gray-500">
        {(["approved", "pending", "rejected"] as CellState[]).map(s => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${DOT[s]}`} />{WORD[s]}</span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-gray-400">–  not involved</span>
      </div>

      {/* Matrix */}
      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">No documents at the claim stage in {activeBu}.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap">Document</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap">Created</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap">Overall</th>
                {cols.map(d => <th key={d} className="px-3 py-2.5 text-center font-medium text-gray-500 whitespace-nowrap">{deptLabel(d)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ r, map }) => {
                const overall = docStateOf(map, r.status)
                return (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={`/requests/${r.id}`} className="font-medium text-blue-700 hover:underline">{r.documentNo}</Link>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{fmtDate(r.createdAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${CHIP[overall]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${DOT[overall]}`} />{WORD[overall]}
                      </span>
                    </td>
                    {cols.map(d => {
                      const a = map[d]
                      if (!a) return <td key={d} className="px-3 py-2 text-center text-gray-300">–</td>
                      const cs = cellStateOf(a)
                      return (
                        <td key={d} className="px-3 py-2 text-center">
                          <span title={`${a.approved} accepted · ${a.pending} pending · ${a.rejected} rejected (of ${a.total})`}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${CHIP[cs]}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${DOT[cs]}`} />
                            {cs === "approved" ? "✓" : `${a.approved}/${a.total}`}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
