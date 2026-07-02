"use client"

// Visual approval progress chain: passed stages show a check, the current stage
// is highlighted, upcoming stages are muted. Rejected shows a red state.

type Stage = { key: string; label: string }

const GW_STAGES: Stage[] = [
  { key: "PENDING_VP_MER_GW", label: "DPM" },
  { key: "PENDING_GM_GW", label: "GM" },
  { key: "PENDING_PRESIDENT_GW", label: "President" },
  { key: "PENDING_LOGISTICS_GW", label: "Logistics" },
  { key: "PENDING_CLAIM_GW", label: "Claim" },
  { key: "PENDING_ACCOUNTING", label: "Accounting" },
]

const NYG_STAGES: Stage[] = [
  { key: "PENDING_VP_MER", label: "VP MER" },
  { key: "PENDING_PRESIDENT", label: "President" },
  { key: "PENDING_SCM", label: "SCM" },
  { key: "PENDING_VP_SCM", label: "VP SCM" },
  { key: "PENDING_LOGISTICS", label: "Logistics" },
  { key: "PENDING_CLAIM", label: "Claim" },
  { key: "PENDING_VP_CLAIM", label: "VP Claim" },
]

export function ApprovalChain({ status, bu }: { status: string; bu: string }) {
  const stages = bu === "GW" ? GW_STAGES : NYG_STAGES
  const rejected = status === "REJECTED"
  const completed = status === "COMPLETED"
  // Index of the current stage; if completed, everything is done.
  const currentIdx = completed ? stages.length : stages.findIndex(s => s.key === status)

  return (
    <div className="flex items-center flex-wrap gap-y-2 overflow-x-auto py-1">
      {stages.map((s, i) => {
        const done = completed || (currentIdx > -1 && i < currentIdx)
        const active = !completed && i === currentIdx
        const cls = rejected
          ? "bg-gray-100 text-gray-400 border-gray-200"
          : done
          ? "bg-green-100 text-green-700 border-green-300"
          : active
          ? "bg-amber-100 text-amber-800 border-amber-400 font-semibold ring-1 ring-amber-300"
          : "bg-gray-50 text-gray-400 border-gray-200"
        return (
          <div key={s.key} className="flex items-center shrink-0">
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] leading-none">
                {done ? "✓" : active ? "●" : "○"}
              </span>
              {s.label}
            </span>
            {i < stages.length - 1 && (
              <span className={`w-4 h-px mx-0.5 ${done ? "bg-green-300" : "bg-gray-200"}`} />
            )}
          </div>
        )
      })}
      {rejected && (
        <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">✕ Rejected</span>
      )}
      {completed && (
        <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Completed</span>
      )}
    </div>
  )
}
