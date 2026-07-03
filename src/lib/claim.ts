// Shared helpers for multi-department claim splits (up to 3 per SO).
//
// Data model: item.claimDepts is a JSON array of splits:
//   [{ dept, pct, reason?, status?, crNo? }]
// item.claimDepartment / item.claimPercentage keep the FIRST split for
// backward compatibility with older code paths.
//
// air cost per split is NOT stored — it is derived from the item's actual
// air freight (or estimate) so it always reflects the latest number.

export type ClaimSplit = {
  dept: string
  pct: number
  reason?: string | null
  status?: string | null
  crNo?: string | null
}

// GW claim departments that route through SCM (NYK/NYG) before Accounting.
export const GW_SCM_DEPTS = ["NYK", "NYG"]

// Per-split status values
export const SPLIT_STATUS = {
  CLAIM_PENDING: "CLAIM_PENDING",     // waiting for CLAIM_GW to approve the SO
  SCM_PENDING: "SCM_PENDING",         // waiting for SCM_NYK / SCM_NYG
  ACCT_PENDING: "ACCT_PENDING",       // waiting for Accounting
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
} as const

// Read the splits off an item, falling back to the legacy single-dept fields.
export function getSplits(item: any): ClaimSplit[] {
  const raw = item?.claimDepts
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((s: any) => ({
      dept: String(s.dept || ""),
      pct: Number(s.pct) || 0,
      reason: s.reason ?? null,
      status: s.status ?? null,
      crNo: s.crNo ?? null,
    })).filter(s => s.dept)
  }
  if (item?.claimDepartment) {
    return [{
      dept: String(item.claimDepartment),
      pct: item.claimPercentage != null ? Number(item.claimPercentage) : 100,
      reason: null,
      status: null,
      crNo: null,
    }]
  }
  return []
}

// Air cost allocated to a split = (actual or estimated freight) × pct / 100.
export function splitAirCost(item: any, split: ClaimSplit): number {
  const total = item?.actualAirFreight ?? item?.airFreight ?? 0
  return Math.round((total * (split.pct || 0)) / 100 * 100) / 100
}

// Sum of percentages across splits (used for the =100 validation).
export function totalPct(splits: ClaimSplit[]): number {
  return splits.reduce((s, x) => s + (Number(x.pct) || 0), 0)
}

// ── GW claim: PARALLEL per-department ──────────────────────────────
// After President, Logistics (booking) runs parallel with Claim. Each claim
// department approves ONLY its own split, independently. Departments:
//   NYK → SCM_NYK (must enter CR NO)   NYG → SCM_NYG
//   GW / SUPPLIER* → CLAIM_GW
// When every split is DEPT_APPROVED → item goes to Accounting (read-only,
// notified). Accounting does NOT approve — it is the terminal/notify step.
export const GW_DEPT_APPROVED = "DEPT_APPROVED"

// GW claim department values (exactly as stored in the Excel CLAIM DEPT column).
export const GW_CLAIM_DEPTS = ["SCM NYK", "SCM NYG", "GW", "SUPPLIER"]

// Departments a GW claim role is responsible for (must match the Excel values).
// CLAIM_GW is one role split into GW vs SUPPLIER people via User.claimDepartment,
// so pass claimDept to scope a user to only their own splits.
export function gwDeptsForRole(role: string, claimDept?: string | null): string[] {
  // NYK claim exists in both BU: dept "SCM NYK" (GW) and "NYK" (NYG). A user is
  // only in one BU, so returning both is safe and keeps visibility working.
  if (role === "SCM_NYK" || role === "SCM_NYK_APPROVER" || role === "SCM_NYK_EVP") return ["SCM NYK", "NYK"]
  if (role === "SCM_NYG") return ["SCM NYG"]
  if (role === "CLAIM_GW") {
    if (claimDept === "GW") return ["GW"]
    if (claimDept === "SUPPLIER") return ["SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]
    // no/unknown tag → handle all GW+SUPPLIER (backward compatible)
    return ["GW", "SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]
  }
  return []
}

// SCM NYK accepts the claim FIRST (approve, incl. its VP chain) without a CR
// number, then comes back later to fill CR NO. This intermediate state means
// "accepted, awaiting CR" — the split is NOT yet final and the SO does not go
// to Accounting until CR is entered.
export const GW_DEPT_ACCEPTED = "DEPT_ACCEPTED"

// NYK sub-flow: SCM_NYK_APPROVER approves first, then in parallel SCM_NYK_EVP
// approves AND SCM_NYK (User) enters CR NO. Split is only DEPT_APPROVED when all
// three are done. This intermediate = approver done, waiting on EVP and/or CR.
export const GW_NYK_APPROVER_PASSED = "APPROVER_PASSED"

// Compute a NYK split's status from the three parallel conditions. `doneStatus`
// differs by BU: GW → DEPT_APPROVED (→ Accounting), NYG → COMPLETED.
export function nykSplitStatus(o: { approver: boolean; evp: boolean; cr: boolean }, doneStatus: string = GW_DEPT_APPROVED): string {
  if (o.approver && o.evp && o.cr) return doneStatus
  if (o.approver) return GW_NYK_APPROVER_PASSED
  return SPLIT_STATUS.CLAIM_PENDING
}

// Does this item have a split for one of `depts` NOT yet fully finalized?
// (includes DEPT_ACCEPTED so SCM NYK still sees the SO to come back for CR)
export function hasPendingGwSplit(item: any, depts: string[]): boolean {
  return getSplits(item).some(s => depts.includes(s.dept) && s.status !== GW_DEPT_APPROVED && s.status !== SPLIT_STATUS.REJECTED)
}

// Does this item have a split for one of `depts` still awaiting the FIRST
// approval (not yet accepted)? Used to gate the per-SO Approve action.
export function hasApprovableGwSplit(item: any, depts: string[]): boolean {
  return getSplits(item).some(s => depts.includes(s.dept) && (s.status == null || s.status === SPLIT_STATUS.CLAIM_PENDING))
}

// Mark this role's departments' splits with `targetStatus` (default APPROVED).
// Only affects splits still awaiting first approval (null/CLAIM_PENDING).
export function approveGwDeptSplits(splits: ClaimSplit[], depts: string[], crNo?: string, targetStatus: string = GW_DEPT_APPROVED): ClaimSplit[] {
  return splits.map(s =>
    depts.includes(s.dept) && (s.status == null || s.status === SPLIT_STATUS.CLAIM_PENDING)
      ? { ...s, status: targetStatus, crNo: crNo ?? s.crNo }
      : s
  )
}

// Force the given depts' splits to a specific status (used by the NYK sub-flow
// where status is computed from approver/EVP/CR conditions). Never touches REJECTED.
export function setGwSplitStatus(splits: ClaimSplit[], depts: string[], status: string, crNo?: string): ClaimSplit[] {
  return splits.map(s =>
    depts.includes(s.dept) && s.status !== SPLIT_STATUS.REJECTED
      ? { ...s, status, crNo: crNo ?? s.crNo }
      : s
  )
}

// Finalize SCM NYK's accepted splits once CR NO arrives: DEPT_ACCEPTED → APPROVED.
export function finalizeGwCr(splits: ClaimSplit[], depts: string[], crNo: string): ClaimSplit[] {
  return splits.map(s =>
    depts.includes(s.dept) && s.status === GW_DEPT_ACCEPTED
      ? { ...s, status: GW_DEPT_APPROVED, crNo: crNo || s.crNo }
      : s
  )
}

// Coarse item.itemStatus. Logistics ∥ Claim run in PARALLEL after President:
// the SO reaches Accounting only when the claim is fully approved AND Logistics
// has entered data (actualAirFreight). `lgDone` = actualAirFreight != null.
// While either side is incomplete the SO stays PRES_PASSED (the parallel stage).
export function deriveGwItemStatus(splits: ClaimSplit[], lgDone: boolean = true): string {
  if (splits.length === 0) return "PRES_PASSED"
  const st = splits.map(s => s.status)
  if (st.some(s => s === SPLIT_STATUS.REJECTED)) return "REJECTED" // reject one portion → SO rejected
  // claim not fully approved yet (incl. NYK approver-done but EVP/CR incomplete)
  if (st.some(s => s == null || s === SPLIT_STATUS.CLAIM_PENDING || s === GW_DEPT_ACCEPTED || s === GW_NYK_APPROVER_PASSED)) return "PRES_PASSED"
  // claim fully approved → wait for Logistics data before going to Accounting
  return lgDone ? "ACCOUNTING_PENDING" : "PRES_PASSED"
}

// ── NYG claim flow (per split: DVM → VP, per department) ───────────
// Per-split status for NYG:
//   null / CLAIM_PENDING → waiting DVM of that dept
//   CLAIM_PASSED         → DVM done, waiting VP of that dept
//   COMPLETED            → VP done
export const NYG_SPLIT = {
  CLAIM_PASSED: "CLAIM_PASSED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
} as const

// The NYG split status for one department (null = still waiting DVM).
export function deptSplitStatus(item: any, dept: string): string | null {
  const s = getSplits(item).find(x => x.dept === dept)
  return s ? (s.status ?? null) : null
}

// Set one dept's split to a new status; other splits untouched.
export function setDeptSplitStatus(splits: ClaimSplit[], dept: string, status: string): ClaimSplit[] {
  return splits.map(s => (s.dept === dept ? { ...s, status } : s))
}

// Coarse NYG item.itemStatus derived from all splits (sequential: all DVM, then all VP).
export function deriveNygItemStatus(splits: ClaimSplit[]): string {
  if (splits.length === 0) return "LOG_PASSED"
  const st = splits.map(s => s.status)
  if (st.every(s => s === NYG_SPLIT.COMPLETED)) return "COMPLETED"
  if (st.every(s => s === NYG_SPLIT.REJECTED)) return "REJECTED"
  // Any split still waiting on its DVM (or NYK approver-done but EVP/CR incomplete)
  // → whole item stays at the claim stage.
  if (st.some(s => s == null || s === SPLIT_STATUS.CLAIM_PENDING || s === GW_NYK_APPROVER_PASSED)) return "LOG_PASSED"
  // All DVMs done, at least one VP outstanding → VP stage.
  if (st.some(s => s === NYG_SPLIT.CLAIM_PASSED)) return "CLAIM_PASSED"
  return "COMPLETED"
}
