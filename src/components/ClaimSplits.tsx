"use client"

import { getSplits, splitAirCost, totalPct, type ClaimSplit } from "@/lib/claim"

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  CLAIM_PENDING: { text: "รอ DVM",   cls: "bg-gray-100 text-gray-600" },
  CLAIM_PASSED:  { text: "รอ VP",    cls: "bg-violet-100 text-violet-700" },
  SCM_PENDING:   { text: "รอ SCM",   cls: "bg-orange-100 text-orange-700" },
  ACCT_PENDING:  { text: "รอ Acct",  cls: "bg-blue-100 text-blue-700" },
  COMPLETED:     { text: "เสร็จ",     cls: "bg-green-100 text-green-700" },
  REJECTED:      { text: "Reject",   cls: "bg-red-100 text-red-700" },
}

// Compact inline badges — one chip per claim split (dept + %).
export function ClaimSplitBadges({ item }: { item: any }) {
  const splits = getSplits(item)
  if (splits.length === 0) return <span className="text-gray-300">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {splits.map((s: ClaimSplit, i: number) => (
        <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap">
          <span className="font-medium">{s.dept}</span>
          <span className="text-gray-400">{s.pct}%</span>
        </span>
      ))}
    </div>
  )
}

// Full breakdown table — dept, %, air cost, reason, status.
export function ClaimSplitTable({ item, highlightDept }: { item: any; highlightDept?: string | null }) {
  const splits = getSplits(item)
  if (splits.length === 0) return <span className="text-gray-300 text-xs">ไม่มีข้อมูล claim</span>
  const sumPct = totalPct(splits)
  const sumCost = splits.reduce((a, s) => a + splitAirCost(item, s), 0)
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead className="bg-gray-50">
          <tr>
            {["CLAIM DEPT", "% CLAIM", "ค่า AIR (THB)", "REASON", "STATUS"].map(h => (
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
                <td className="px-3 py-1.5 text-gray-500">{s.reason || "-"}</td>
                <td className="px-3 py-1.5">{st ? <span className={`px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span> : "-"}</td>
              </tr>
            )
          })}
          <tr className="bg-gray-50 border-t font-semibold">
            <td className="px-3 py-1.5">รวม</td>
            <td className={`px-3 py-1.5 ${sumPct !== 100 ? "text-red-600" : ""}`}>{sumPct}%</td>
            <td className="px-3 py-1.5 text-green-700">{fmt(sumCost)}</td>
            <td className="px-3 py-1.5" colSpan={2}>{sumPct !== 100 ? "⚠ ผลรวมต้อง = 100%" : ""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
