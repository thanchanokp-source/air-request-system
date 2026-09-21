import { STATUS_LABELS } from "@/types"
export function StatusBadge({ status, bu }: { status: string; bu?: string }) {
  const cls = status.startsWith("PENDING") ? "bg-yellow-100 text-yellow-700"
    : status === "COMPLETED" ? "bg-green-100 text-green-700"
    : status === "REJECTED" ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-700"
  // NYG NYK-Direct docs ride the shared SCM-NYK/GW claim engine (status PENDING_CLAIM_GW). The doc is
  // still NYG — show "(NYK)" instead of the shared "(GW)" so a NYG doc never looks like a GW doc.
  const label = (status === "PENDING_CLAIM_GW" && String(bu).toUpperCase() === "NYG")
    ? "Pending Claim (NYK)"
    : (STATUS_LABELS[status] || status)
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${cls}`}>{label}</span>
}
