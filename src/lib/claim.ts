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

// Where a GW split goes right after CLAIM_GW approves the SO.
export function initialGwSplitStatus(dept: string): string {
  return GW_SCM_DEPTS.includes(dept) ? SPLIT_STATUS.SCM_PENDING : SPLIT_STATUS.ACCT_PENDING
}

// Coarse item.itemStatus derived from the per-split statuses.
// Sequential processing: all SCM splits clear before the doc moves to Accounting.
export function deriveGwItemStatus(splits: ClaimSplit[]): string {
  if (splits.length === 0) return "LOG_PASSED"
  const st = splits.map(s => s.status)
  if (st.every(s => s === SPLIT_STATUS.COMPLETED)) return "COMPLETED"
  if (st.every(s => s === SPLIT_STATUS.REJECTED)) return "REJECTED"
  if (st.some(s => s === SPLIT_STATUS.SCM_PENDING)) return "SCM_GW_PENDING"
  if (st.some(s => s === SPLIT_STATUS.ACCT_PENDING)) return "ACCOUNTING_PENDING"
  if (st.some(s => s == null || s === SPLIT_STATUS.CLAIM_PENDING)) return "LOG_PASSED"
  return "LOG_PASSED"
}

// Apply CLAIM_GW's SO approval: route every split to SCM or Accounting.
export function routeSplitsAfterClaimGw(splits: ClaimSplit[]): ClaimSplit[] {
  return splits.map(s => ({ ...s, status: initialGwSplitStatus(s.dept) }))
}

// SCM (NYK/NYG) approves its own portion: that dept's split → Accounting.
export function approveScmSplit(splits: ClaimSplit[], dept: string, crNo?: string): ClaimSplit[] {
  return splits.map(s =>
    s.dept === dept && s.status === SPLIT_STATUS.SCM_PENDING
      ? { ...s, status: SPLIT_STATUS.ACCT_PENDING, crNo: crNo ?? s.crNo }
      : s
  )
}

// Accounting closes every remaining Accounting-pending split.
export function completeAcctSplits(splits: ClaimSplit[]): ClaimSplit[] {
  return splits.map(s =>
    s.status === SPLIT_STATUS.ACCT_PENDING ? { ...s, status: SPLIT_STATUS.COMPLETED } : s
  )
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
  // Any split still waiting on its DVM → whole item stays at the DVM (claim) stage.
  if (st.some(s => s == null || s === SPLIT_STATUS.CLAIM_PENDING)) return "LOG_PASSED"
  // All DVMs done, at least one VP outstanding → VP stage.
  if (st.some(s => s === NYG_SPLIT.CLAIM_PASSED)) return "CLAIM_PASSED"
  return "COMPLETED"
}
