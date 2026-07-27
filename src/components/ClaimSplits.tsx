"use client"

import { getSplits, splitAirCost, totalPct, type ClaimSplit } from "@/lib/claim"

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  CLAIM_PENDING: { text: "Pending", cls: "bg-gray-100 text-gray-600" },
  CLAIM_PASSED:  { text: "Awaiting VP",     cls: "bg-violet-100 text-violet-700" },
  DEPT_ACCEPTED: { text: "Awaiting CR",      cls: "bg-amber-100 text-amber-700" },
  DEPT_APPROVED: { text: "Approved", cls: "bg-green-100 text-green-700" },
  COMPLETED:     { text: "Done",      cls: "bg-green-100 text-green-700" },
  REJECTED:      { text: "Reject",    cls: "bg-red-100 text-red-700" },
}

// Compact inline badges — one chip per claim split (dept + %).
// showReason: also surface the SCM delay code + detail per split (so approvers see it).
export function ClaimSplitBadges({ item, showReason = false }: { item: any; showReason?: boolean }) {
  const splits = getSplits(item)
  if (splits.length === 0) return <span className="text-gray-300">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {splits.map((s: ClaimSplit, i: number) => {
        const detail = (s as any).reasonDetail as string | undefined
        return (
          <span key={i} className="inline-flex flex-col gap-0.5 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="font-medium">{s.dept}</span>
              <span className="text-gray-400">{s.pct}%</span>
            </span>
            {showReason && s.reason && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 max-w-[16rem]">
                <span className="font-semibold whitespace-nowrap">{s.reason}</span>
                {detail && <span className="text-amber-700 truncate" title={detail}>· {detail}</span>}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

// Full breakdown table — dept, %, air cost, reason, status.
export function ClaimSplitTable({ item, highlightDept, showCrNo = false }: { item: any; highlightDept?: string | null; showCrNo?: boolean }) {
  const splits = getSplits(item)
  if (splits.length === 0) return <span className="text-gray-300 text-xs">No claim data</span>
  const sumPct = totalPct(splits)
  const sumCost = splits.reduce((a, s) => a + splitAirCost(item, s), 0)
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead className="bg-gray-50">
          <tr>
            {["CLAIM DEPT", "% CLAIM", "AIR COST (THB)", "DELAY CODE / DETAIL", ...(showCrNo ? ["CR NO"] : []), "STATUS"].map(h => (
              <th key={h} className="px-3 py-1.5 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {splits.map((s: ClaimSplit, i: number) => {
            const st = s.status ? STATUS_LABEL[s.status] : null
            const hl = highlightDept && s.dept === highlightDept
            return (
              <tr key={i} className={hl ? "bg-amber-50" : ""}>
                <td className="px-3 py-1.5 font-medium">{s.dept}</td>
                <td className="px-3 py-1.5">{s.pct}%</td>
                <td className="px-3 py-1.5 font-semibold text-green-700">{fmt(splitAirCost(item, s))}</td>
                <td className="px-3 py-1.5 text-gray-500">
                  {s.reason ? <span className="font-medium text-gray-700">{s.reason}</span> : "-"}
                  {(s as any).reasonDetail && <span className="block text-[10px] text-gray-400">{(s as any).reasonDetail}</span>}
                </td>
                {showCrNo && <td className="px-3 py-1.5 font-medium text-blue-700">{s.crNo || "-"}</td>}
                <td className="px-3 py-1.5">{st ? <span className={`px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span> : "-"}</td>
              </tr>
            )
          })}
          <tr className="bg-gray-50 border-t font-semibold">
            <td className="px-3 py-1.5">Total</td>
            <td className={`px-3 py-1.5 ${sumPct !== 100 ? "text-red-600" : ""}`}>{sumPct}%</td>
            <td className="px-3 py-1.5 text-green-700">{fmt(sumCost)}</td>
            <td className="px-3 py-1.5" colSpan={showCrNo ? 3 : 2}>{sumPct !== 100 ? "⚠ Total must = 100%" : ""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
