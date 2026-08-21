"use client"
import { StageWork } from "../_StageWork"
export default function Page() {
  return <StageWork
    title="Approval — Pull Material"
    subtitle="DVM → VP → EVP (placeholder: approve skips the chain — approver master added later)"
    status="PENDING_APPROVAL"
    fields={[]}
    primary={{ label: "Approve", toStatus: "APPROVED", color: "#16a34a" }}
    secondary={{ label: "Send back to SCM", toStatus: "PENDING_SCM_DECISION" }}
  />
}
