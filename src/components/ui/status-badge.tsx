import { STATUS_LABELS } from "@/types"
export function StatusBadge({ status }: { status: string }) {
  const cls = status.startsWith("PENDING") ? "bg-yellow-100 text-yellow-700"
    : status === "COMPLETED" ? "bg-green-100 text-green-700"
    : status === "REJECTED" ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-700"
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${cls}`}>{STATUS_LABELS[status] || status}</span>
}
