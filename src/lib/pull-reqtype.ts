// One source of truth for a Pull RM doc's branch: SCM request, Purchasing request, or Sample (MER).
// Falls back to the documentNo prefix for older docs (MER_ = Sample, PULL_ = Purchasing, else SCM).
export type PullReqType = "SCM" | "PURCHASING" | "SAMPLE"

export function pullReqType(r: any): PullReqType {
  const no = String(r?.documentNo || "").toUpperCase()
  if (r?.requestType === "SAMPLE" || no.startsWith("MER")) return "SAMPLE"
  if (r?.requestType === "PURCHASING" || no.startsWith("PULL")) return "PURCHASING"
  return "SCM"
}
