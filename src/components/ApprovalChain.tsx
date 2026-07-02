"use client"

import { getSplits } from "@/lib/claim"

// Visual approval progress chain.
//  - Doc-level (pass `items`): overall document stage + aggregated claim depts.
//  - Per-SO (pass `soItem`): that SO's own progress + its own claim dept splits.
//  - GW: after President, Logistics ∥ Claim run in parallel; claim shows per-dept.

type Node = { key: string; label: string; ord: number }

const GW_PRE: Node[] = [
  { key: "PENDING_VP_MER_GW", label: "DPM", ord: 0 },
  { key: "PENDING_GM_GW", label: "GM", ord: 1 },
  { key: "PENDING_PRESIDENT_GW", label: "President", ord: 2 },
]
const GW_ORD: Record<string, number> = {
  PENDING_VP_MER_GW: 0, PENDING_GM_GW: 1, PENDING_PRESIDENT_GW: 2,
  PENDING_LOGISTICS_GW: 3, PENDING_CLAIM_GW: 4, PENDING_ACCOUNTING: 5, COMPLETED: 6,
}
// Per-SO item status → GW chain ordinal (approval stages share the doc stage).
const GW_ITEM_ORD: Record<string, number> = {
  PRES_PASSED: 3, LOG_PASSED: 4, ACCOUNTING_PENDING: 5, COMPLETED: 6,
}

const NYG_STAGES: Node[] = [
  { key: "PENDING_VP_MER", label: "VP MER", ord: 0 },
  { key: "PENDING_PRESIDENT", label: "President", ord: 1 },
  { key: "PENDING_SCM", label: "SCM", ord: 2 },
  { key: "PENDING_VP_SCM", label: "VP SCM", ord: 3 },
  { key: "PENDING_LOGISTICS", label: "Logistics", ord: 4 },
  { key: "PENDING_CLAIM", label: "Claim", ord: 5 },
  { key: "PENDING_VP_CLAIM", label: "VP Claim", ord: 6 },
]

function Chip({ state, label, sm }: { state: "done" | "active" | "pending"; label: React.ReactNode; sm?: boolean }) {
  const cls = state === "done" ? "bg-green-100 text-green-700 border-green-300"
    : state === "active" ? "bg-amber-100 text-amber-800 border-amber-400 font-semibold ring-1 ring-amber-300"
    : "bg-gray-50 text-gray-400 border-gray-200"
  const icon = state === "done" ? "✓" : state === "active" ? "●" : "○"
  return (
    <span className={`inline-flex items-center gap-1 ${sm ? "text-[10px] px-1.5" : "text-[11px] px-2"} py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      <span className="text-[9px] leading-none">{icon}</span>{label}
    </span>
  )
}

const Bar = ({ done }: { done: boolean }) => <span className={`w-4 h-px mx-0.5 shrink-0 ${done ? "bg-green-300" : "bg-gray-200"}`} />

export function ApprovalChain({ status, bu, items, soItem, sm }: { status: string; bu: string; items?: any[]; soItem?: any; sm?: boolean }) {
  const rejected = soItem ? soItem.itemStatus === "REJECTED" : status === "REJECTED"
  const completed = soItem ? soItem.itemStatus === "COMPLETED" : status === "COMPLETED"
  const claimSource: any[] = soItem ? [soItem] : (Array.isArray(items) ? items : [])

  // ── NYG: linear chain ──
  if (bu !== "GW") {
    const cur = completed ? 99 : soItem ? nygItemOrd(soItem, status) : (NYG_STAGES.find(s => s.key === status)?.ord ?? -1)
    return (
      <div className="flex items-center gap-0 overflow-x-auto py-1">
        {NYG_STAGES.map((s, i) => (
          <div key={s.key} className="flex items-center shrink-0">
            <Chip sm={sm} state={rejected ? "pending" : completed || s.ord < cur ? "done" : s.ord === cur ? "active" : "pending"} label={s.label} />
            {i < NYG_STAGES.length - 1 && <Bar done={completed || s.ord < cur} />}
          </div>
        ))}
        {rejected && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">✕ Rejected</span>}
        {completed && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Completed</span>}
      </div>
    )
  }

  // ── GW: DPM→GM→President, then Logistics ∥ Claim (parallel) ──
  const cur = completed ? 6 : soItem ? (GW_ITEM_ORD[soItem.itemStatus] ?? (GW_ORD[status] ?? -1)) : (GW_ORD[status] ?? -1)
  const stateFor = (ord: number): "done" | "active" | "pending" =>
    completed || cur > ord ? "done" : cur === ord ? "active" : "pending"
  const parallelState: "done" | "active" | "pending" = completed || cur >= 5 ? "done" : cur >= 3 ? "active" : "pending"

  // Per-department claim status.
  const map: Record<string, { total: number; done: number }> = {}
  for (const it of claimSource) for (const s of getSplits(it)) {
    if (!map[s.dept]) map[s.dept] = { total: 0, done: 0 }
    map[s.dept].total++
    if (s.status === "DEPT_APPROVED" || s.status === "COMPLETED") map[s.dept].done++
  }
  const claimReached = completed || cur >= 3 // doc/SO has reached the Logistics∥Claim stage
  const claimDepts = Object.entries(map).map(([dept, c]) => ({ dept, done: c.done === c.total }))

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
      {GW_PRE.map(s => (
        <div key={s.key} className="flex items-center shrink-0">
          <Chip sm={sm} state={rejected ? "pending" : stateFor(s.ord)} label={s.label} />
          <Bar done={completed || cur > s.ord} />
        </div>
      ))}
      {/* Logistics ∥ Claim — adjacent (no line) = parallel */}
      <Chip sm={sm} state={rejected ? "pending" : parallelState} label="Logistics" />
      <Chip sm={sm} state={rejected ? "pending" : parallelState} label="Claim" />
      {claimDepts.map(d => {
        // 3 states: done (green ✓), reached-but-pending (amber ●), not-yet-reached (gray ○)
        const cls = d.done ? "bg-green-100 text-green-700 border-green-300"
          : claimReached ? "bg-amber-50 text-amber-700 border-amber-300"
          : "bg-gray-50 text-gray-400 border-gray-200"
        const icon = d.done ? "✓" : claimReached ? "●" : "○"
        return (
          <span key={d.dept}
            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${cls}`}>
            {icon} {d.dept}
          </span>
        )
      })}
      {rejected && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">✕ Rejected</span>}
      {completed && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Completed</span>}
    </div>
  )
}

// NYG per-SO item status → chain ordinal.
function nygItemOrd(item: any, docStatus: string): number {
  const m: Record<string, number> = {
    VP_MER_PASSED: 1, PASSED: 3, VP_PASSED: 1, PRES_PASSED: 4, LOG_PASSED: 5, CLAIM_PASSED: 6, COMPLETED: 7,
  }
  if (item.itemStatus === "PENDING") return NYG_STAGES.find(s => s.key === docStatus)?.ord ?? 0
  return m[item.itemStatus] ?? 0
}
