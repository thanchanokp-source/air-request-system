// One source of truth for a Pull RM doc's branch: SCM request, Purchasing request, Sample (MER) or
// PPC request. Falls back to the documentNo prefix for older docs
// (MER_ = Sample, PPC_ = PPC, PULL_ = Purchasing, else SCM).
export type PullReqType = "SCM" | "PURCHASING" | "SAMPLE" | "PPC"

export function pullReqType(r: any): PullReqType {
  const no = String(r?.documentNo || "").toUpperCase()
  if (r?.requestType === "PPC" || no.startsWith("PPC")) return "PPC"
  if (r?.requestType === "SAMPLE" || no.startsWith("MER")) return "SAMPLE"
  if (r?.requestType === "PURCHASING" || no.startsWith("PULL")) return "PURCHASING"
  return "SCM"
}

// Branches that behave like the MER sample flow: requester keys free-text lines, Purchasing fills the
// shipment data, then the doc auto-approves straight to Logistics (no approval chain).
export const isSampleLike = (t: PullReqType) => t === "SAMPLE" || t === "PPC"
