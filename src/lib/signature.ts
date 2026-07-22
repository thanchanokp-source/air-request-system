import { prisma } from "@/lib/prisma"

// Approve-type actions that require a signature (data-entry actions excluded).
export const SIG_APPROVE_ACTIONS = new Set([
  "approve", "approve_style", "president_approve", "president_approve_gw",
  "approve_so_next", "batch_approve_so", "batch_approve_claim_gw", "approve_so_claim_gw",
  "finalize_claim_dept", "approve_so",
])

// Human-readable signatory label per role (used on the stamped PDF).
export const SIG_ROLE_LABEL: Record<string, string> = {
  VP_MER: "VP Merchandise", DVM_MER: "DVM Merchandise", VP_MER_GW: "DPM (GW)", DPM_GW: "DPM (GW)", GM_GW: "GM (GW)",
  // EA merch approvers — backend roles reuse DVM_MER_EA/VP_MER_EA, but externally/print they are ADVM → DVM.
  DVM_MER_EA: "ADVM", VP_MER_EA: "DVM",
  PRESIDENT: "President", PRESIDENT_GW: "President (GW)", VP_SCM: "VP SCM", SCM_USER: "SCM",
  CLAIM_GW: "Claim (GW)", SCM_NYK: "SCM NYK", SCM_NYK_APPROVER: "SCM NYK Approver", SCM_NYK_EVP: "SCM NYK EVP",
  SCM_NYG: "SCM NYG", CLAIM_COMMERCIAL: "Commercial", CLAIM_PRODUCTION: "Production", CLAIM_PROCUREMENT: "Procurement",
  CLAIM_NEXT_APPROVER: "Claim Approver",
}

export function isSignatureData(v: any): v is string {
  return typeof v === "string" && v.startsWith("data:image")
}

// Snapshot the signer at the moment of approval (deduped per request+user+position).
// Never re-pulls from master, so already-signed documents keep the exact signature used.
export async function captureApprovalSignature(opts: {
  requestId: string; userId: string; userRole: string; name: string; email: string | null
  signatureData: string; positionLabel?: string; crNo?: string | null; branch?: string | null
}) {
  const positionLabel = opts.positionLabel || SIG_ROLE_LABEL[opts.userRole] || opts.userRole
  const data = {
    requestId: opts.requestId, userId: opts.userId, approverName: opts.name, approverEmail: opts.email,
    role: opts.userRole, positionLabel, signatureData: opts.signatureData, crNo: opts.crNo || null,
    branch: opts.branch || null, signedAt: new Date(),
  }
  try {
    const existing = await (prisma as any).approvalSignature.findFirst({ where: { requestId: opts.requestId, userId: opts.userId, positionLabel } })
    if (existing) await (prisma as any).approvalSignature.update({ where: { id: existing.id }, data })
    else await (prisma as any).approvalSignature.create({ data })
  } catch (e) { console.error("[signature] capture failed:", e) }
}
