"use client"

import { getSplits } from "@/lib/claim"

// Visual approval progress chain.
//  - Passed stages: green check. Current stage: highlighted. Upcoming: muted.
//  - GW: after President, Logistics and Claim run in PARALLEL (shown stacked),
//    then converge at Accounting (read-only). Claim shows per-department status.

type Node = { key: string; label: string; ord: number }

// Linear stages before the parallel branch.
const GW_PRE: Node[] = [
  { key: "PENDING_VP_MER_GW", label: "DPM", ord: 0 },
  { key: "PENDING_GM_GW", label: "GM", ord: 1 },
  { key: "PENDING_PRESIDENT_GW", label: "President", ord: 2 },
]
const GW_ACCOUNTING: Node = { key: "PENDING_ACCOUNTING", label: "Accounting", ord: 5 }

const NYG_STAGES: Node[] = [
  { key: "PENDING_VP_MER", label: "VP MER", ord: 0 },
  { key: "PENDING_PRESIDENT", label: "President", ord: 1 },
  { key: "PENDING_SCM", label: "SCM", ord: 2 },
  { key: "PENDING_VP_SCM", label: "VP SCM", ord: 3 },
  { key: "PENDING_LOGISTICS", label: "Logistics", ord: 4 },
  { key: "PENDING_CLAIM", label: "Claim", ord: 5 },
  { key: "PENDING_VP_CLAIM", label: "VP Claim", ord: 6 },
]

const GW_ORD: Record<string, number> = {
  PENDING_VP_MER_GW: 0, PENDING_GM_GW: 1, PENDING_PRESIDENT_GW: 2,
  PENDING_LOGISTICS_GW: 3, PENDING_CLAIM_GW: 4, PENDING_ACCOUNTING: 5, COMPLETED: 6,
}

function Chip({ state, label }: { state: "done" | "active" | "pending"; label: React.ReactNode }) {
  const cls = state === "done" ? "bg-green-100 text-green-700 border-green-300"
    : state === "active" ? "bg-amber-100 text-amber-800 border-amber-400 font-semibold ring-1 ring-amber-300"
    : "bg-gray-50 text-gray-400 border-gray-200"
  const icon = state === "done" ? "✓" : state === "active" ? "●" : "○"
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      <span className="text-[9px] leading-none">{icon}</span>{label}
    </span>
  )
}

const Link = ({ done }: { done: boolean }) => <span className={`w-4 h-px mx-0.5 shrink-0 ${done ? "bg-green-300" : "bg-gray-200"}`} />

export function ApprovalChain({ status, bu, items }: { status: string; bu: string; items?: any[] }) {
  const rejected = status === "REJECTED"
  const completed = status === "COMPLETED"

  // ── NYG: simple linear chain ──
  if (bu !== "GW") {
    const stages = NYG_STAGES
    const cur = completed ? 99 : (stages.find(s => s.key === status)?.ord ?? -1)
    return (
      <div className="flex items-center flex-wrap gap-y-2 overflow-x-auto py-1">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-center shrink-0">
            <Chip state={rejected ? "pending" : completed || s.ord < cur ? "done" : s.ord === cur ? "active" : "pending"} label={s.label} />
            {i < stages.length - 1 && <Link done={completed || s.ord < cur} />}
          </div>
        ))}
        {rejected && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">✕ Rejected</span>}
        {completed && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Completed</span>}
      </div>
    )
  }

  // ── GW: linear (DPM→GM→President) then PARALLEL (Logistics ∥ Claim) → Accounting ──
  const cur = GW_ORD[status] ?? -1
  const stateFor = (ord: number): "done" | "active" | "pending" =>
    completed || cur > ord ? "done" : cur === ord ? "active" : "pending"
  // Logistics & Claim are parallel: both active while doc is at logistics/claim stage (ord 3-4),
  // both done once past claim (accounting/completed).
  const parallelState: "done" | "active" | "pending" = completed || cur >= 5 ? "done" : cur >= 3 ? "active" : "pending"

  // Per-department claim status (aggregate splits across items).
  let claimDepts: { dept: string; done: boolean }[] = []
  if (Array.isArray(items) && items.length) {
    const map: Record<string, { total: number; done: number }> = {}
    for (const it of items) for (const s of getSplits(it)) {
      if (!map[s.dept]) map[s.dept] = { total: 0, done: 0 }
      map[s.dept].total++
      if (s.status === "DEPT_APPROVED" || s.status === "COMPLETED") map[s.dept].done++
    }
    claimDepts = Object.entries(map).map(([dept, c]) => ({ dept, done: c.done === c.total }))
  }

  return (
    <div className="flex items-center flex-wrap gap-y-2 overflow-x-auto py-1">
      {GW_PRE.map(s => (
        <div key={s.key} className="flex items-center shrink-0">
          <Chip state={rejected ? "pending" : stateFor(s.ord)} label={s.label} />
          <Link done={completed || cur > s.ord} />
        </div>
      ))}
      {/* Parallel branch: Logistics ∥ Claim */}
      <div className="flex flex-col gap-1 border border-dashed border-gray-300 rounded-lg px-2 py-1 shrink-0">
        <span className="text-[9px] text-gray-400 leading-none">parallel</span>
        <Chip state={rejected ? "pending" : parallelState} label="Logistics" />
        <div className="flex items-center gap-1 flex-wrap">
          <Chip state={rejected ? "pending" : parallelState} label="Claim" />
          {claimDepts.map(d => (
            <span key={d.dept}
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${d.done ? "bg-green-100 text-green-700 border-green-300" : "bg-amber-50 text-amber-700 border-amber-300"}`}>
              {d.done ? "✓" : "●"} {d.dept}
            </span>
          ))}
        </div>
      </div>
      <Link done={completed || cur >= 5} />
      <Chip state={rejected ? "pending" : stateFor(5)} label="Accounting (read)" />
      {rejected && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">✕ Rejected</span>}
      {completed && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Completed</span>}
    </div>
  )
}
