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
