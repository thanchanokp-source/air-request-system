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

export const SUPPLIER_DEPTS = ["SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]
// GW-side claim depts that need NO approval (the CLAIM_GW role no longer approves):
// "GW" + all SUPPLIER variants are treated as already approved everywhere — never
// alerted, never block, no approve button. They flow straight to Accounting.
// Only SCM NYK / SCM NYG still approve.
export const NO_APPROVAL_GW_DEPTS = ["GW", ...SUPPLIER_DEPTS]
const isNoApprovalGwDept = (d: string) => NO_APPROVAL_GW_DEPTS.includes(d)

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

// ── Per-department forward model (both BU) ─────────────────────────
// Each claim department handles its own SO(s) independently: it can FINISH
// (finalize its splits) or FORWARD to a chosen person, recursively. Forward
// state is stored per (request, dept) in the ClaimForward table.
//
// Canonical dept = the value we store in ClaimForward.dept and match against a
// split's `dept`. SUPPLIER expands to its sub-values when finalizing splits.
export function ownerCanonicalDept(role: string, claimDept?: string | null): string | null {
  if (role === "CLAIM_GW") return claimDept === "SUPPLIER" ? "SUPPLIER" : "GW"
  if (role === "SCM_NYG") return "SCM NYG"
  if (role === "SCM_NYK" || role === "SCM_NYK_APPROVER" || role === "SCM_NYK_EVP") return "SCM NYK"
  // Commercial claim = MER's team (DVM MER / VP MER) → canonical dept COMMERCIAL.
  if (role === "DVM_MER" || role === "VP_MER") return "COMMERCIAL"
  if (role.startsWith("DVM_")) return role.replace("DVM_", "")
  if (role.startsWith("CLAIM_") && role !== "CLAIM_NEXT_APPROVER") return role.replace("CLAIM_", "")
  return null
}

// Master roles that hold the ENTRY (auto-notified) position of a claim dept — used to
// resolve WHO is currently pending at entry (before any forward). PRODUCTION also needs
// the factory G-group, PROCUREMENT needs procurementType=PURCHASING (handled by caller).
export function claimEntryDisplayRoles(dept: string): string[] {
  switch (dept) {
    case "COMMERCIAL": return ["DVM_MER"]
    case "PRODUCTION": return ["CLAIM_PRODUCTION"]
    case "PROCUREMENT": return ["CLAIM_PROCUREMENT"]
    case "NYK":
    case "SCM NYK": return ["SCM_NYK_APPROVER"]
    case "SCM NYG": return ["SCM_NYG"]
    case "GW":
    case "SUPPLIER":
    case "SUPPLIER_IN":
    case "SUPPLIER_OUT": return ["CLAIM_GW"]
    default: return [`DVM_${dept}`, `CLAIM_${dept}`]
  }
}

// Display label for a claim dept (UI only — the stored dept value is unchanged).
// SCM NYK → "NYK" (both BU), SCM NYG → "NYG" (GW). Others shown as-is.
export function deptLabel(dept: string): string {
  if (dept === "SCM NYK") return "NYK"
  if (dept === "SCM NYG") return "NYG"
  return dept
}

// Split dept values covered by a canonical dept (SUPPLIER has sub-tags).
export function expandClaimDept(dept: string): string[] {
  if (dept === "SUPPLIER") return ["SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]
  return [dept]
}

// ── Forced-position claim chains ───────────────────────────────────
// Each claim department approves through a FIXED sequence of positions. At each
// step the current approver must forward to the NEXT position (person chosen by
// free name search, but the position is enforced). The LAST position finishes
// the process. Single-position depts (GW / SUPPLIER) finish immediately.
//   SCM NYK keeps its own 3-role sub-flow (not a linear chain) — excluded here.
export type ClaimPosition = { label: string; factoryBased?: boolean; branch?: boolean; role?: string; priority?: number; procurementType?: string }
export const CLAIM_CHAINS: Record<string, ClaimPosition[]> = {
  // ── GW ── (roles map each position to the exact User.role so the person picker
  // can filter precisely; VP PROD appends the factory-group suffix _G1G3 / _G2G4.)
  "SCM NYG": [
    { label: "SCM NYG", role: "SCM_NYG" },
    { label: "VP SCM NYG", role: "SCM_NYG_VP" },
    { label: "VP PROD", factoryBased: true, role: "SCM_NYG_VP_PROD" },
    { label: "SCM EVP", role: "SCM_NYG_EVP" },
  ],
  "GW": [{ label: "GW" }],
  "SUPPLIER": [{ label: "SUPPLIER" }],
  // ── NYG ── positions map to master by role + priority (+ factory G group /
  // procurementType) so the next-person dropdown filters precisely. Master encoding:
  //   Commercial  = CLAIM_COMMERCIAL  (priority 1 = DPM/DVM entry, 2 = VP)
  //   Production   = CLAIM_PRODUCTION  (priority 1 = VP, 2 = EVP) × claimDept G1G3/G2G4
  //   Procurement  = CLAIM_PROCUREMENT (priority 1 = DPM/DVM ×Purchasing/Sourcing, 2 = VP)
  // Commercial claim reuses MER's team (no dedicated Claim-Commercial role, so one
  // person needn't hold two roles): DVM MER (entry, the upload approver) → VP MER.
  "COMMERCIAL": [
    { label: "DVM Merchandise", role: "DVM_MER" },
    { label: "VP Merchandise", role: "VP_MER" },
  ],
  "PRODUCTION": [
    { label: "VP PROD", factoryBased: true, role: "CLAIM_PRODUCTION", priority: 1 },
    { label: "EVP", factoryBased: true, role: "CLAIM_PRODUCTION", priority: 2 },
  ],
  // Purchasing (entry, auto) chooses: forward to Sourcing (pos 1) OR approve-self and
  // skip straight to VP (pos 2). Sourcing then forwards to VP. All CLAIM_PROCUREMENT.
  "PROCUREMENT": [
    { label: "DPM/DVM", role: "CLAIM_PROCUREMENT", priority: 1, branch: true, procurementType: "PURCHASING" },
    { label: "Sourcing", role: "CLAIM_PROCUREMENT", priority: 1, procurementType: "SOURCING" },
    // VP procurement = the dedicated VP_PROCUREMENT role (matches the auto-forward boss
    // lookup + PENDING_VP_CLAIM notify). NOT CLAIM_PROCUREMENT priority 2.
    { label: "VP", role: "VP_PROCUREMENT" },
  ],
}

export const PROCUREMENT_BRANCHES = ["Purchasing", "Sourcing"]

// ── Claim dept → approver roles ────────────────────────────────────
// Some NYG claim departments are approved by an EXISTING position instead of a dedicated
// claim role. "COMMERCIAL" claims route to MER's DVM (entry) then VP (final) — the same
// people who approve the MER upload — so there's no separate Claim-Commercial role.
// Depts not listed fall back to the standard DVM_<dept>/CLAIM_<dept> (entry) + VP_<dept>.
// Overrides for depts whose approver roles differ from the default DVM_/CLAIM_/VP_
// naming. Commercial claim is handled by MER's team (DVM MER entry / VP MER) so the
// same people who approve the upload approve the claim — no extra role per person.
export const CLAIM_DEPT_ROLE_MAP: Record<string, { entry: string[]; vp: string[] }> = {
  COMMERCIAL: { entry: ["DVM_MER"], vp: ["VP_MER"] },
}
export function claimEntryRoles(dept: string): string[] {
  return CLAIM_DEPT_ROLE_MAP[dept]?.entry ?? [`DVM_${dept}`, `CLAIM_${dept}`]
}
export function claimVpRoles(dept: string): string[] {
  return CLAIM_DEPT_ROLE_MAP[dept]?.vp ?? [`VP_${dept}`]
}
// Which claim dept + step (entry vs VP) can a person act on, given the roles they hold and
// the SO's split depts? Forward-direction only (dept → roles) so DVM_MER (which also serves
// the upload stage) is never mis-mapped. Prefers a dept still at the entry step.
export function actingClaimForSO(heldRoles: string[], splitDepts: string[]): { dept: string; isVp: boolean } | null {
  const held = new Set(heldRoles)
  for (const d of splitDepts) if (claimEntryRoles(d).some(r => held.has(r))) return { dept: d, isVp: false }
  for (const d of splitDepts) if (claimVpRoles(d).some(r => held.has(r))) return { dept: d, isVp: true }
  return null
}

// Does the position at `pos` require choosing a branch (Purchasing / Sourcing)?
export function positionHasBranch(dept: string, pos: number): boolean {
  return !!chainFor(dept)[pos]?.branch
}

export function chainFor(dept: string): ClaimPosition[] {
  return CLAIM_CHAINS[dept] || [{ label: dept }]
}

// VP PROD group from the Factory column value: 1 & 3 → "G1/G3", 2 & 4 → "G2/G4".
export function vpProdGroup(factory: string | null | undefined): string | null {
  const s = String(factory || "")
  const g13 = /[13]/.test(s)
  const g24 = /[24]/.test(s)
  if (g13 && !g24) return "G1/G3"
  if (g24 && !g13) return "G2/G4"
  return null // unknown or mixed
}

// Does a person's claimDepartment COVER the target factory G-group? A value of "ALL"
// (or one that carries both a 1/3 and a 2/4 digit) means the person handles EVERY
// factory group — e.g. one EVP responsible for both G1/G3 and G2/G4. Otherwise the
// group must match exactly. Use this instead of `vpProdGroup(x) === g` everywhere.
export function prodGroupCovers(userDept: string | null | undefined, target: string | null | undefined): boolean {
  if (!target) return true
  const s = String(userDept || "").toUpperCase()
  if (!s) return false
  if (s === "ALL") return true
  if (/[13]/.test(s) && /[24]/.test(s)) return true // covers both groups
  return vpProdGroup(userDept) === target
}

// Precise selection spec for a position: the master fields the person picker must
// match (role + priority + factory G group + procurementType). Used to filter the
// next-approver dropdown to exactly the right people.
export type PosSpec = { role: string; priority?: number; group?: string | null; procurementType?: string | null; label: string }
export function positionSpec(dept: string, pos: number, factory?: string | null): PosSpec | null {
  const c = chainFor(dept)[pos]
  if (!c) return null
  return {
    role: c.role || "",
    priority: c.priority,
    group: c.factoryBased ? vpProdGroup(factory) : null,
    procurementType: c.procurementType ?? null,
    label: c.label,
  }
}
export function nextPositionSpec(dept: string, currentPos: number, factory?: string | null): PosSpec | null {
  return positionSpec(dept, currentPos + 1, factory)
}

// The label for the NEXT position after `currentPos` (null = chain finished here).
// factory-based → append G-group; after a branch step → prefix the branch name.
export function nextPositionLabel(dept: string, currentPos: number, factory?: string | null, branch?: string | null): string | null {
  const chain = chainFor(dept)
  const next = chain[currentPos + 1]
  if (!next) return null
  if (next.factoryBased) {
    const g = vpProdGroup(factory)
    return g ? `${next.label} (${g})` : `${next.label} (select factory group)`
  }
  // The step right after a branch-choice position is the "<branch> Approver".
  if (chain[currentPos]?.branch && branch) return `${branch} ${next.label}`
  return next.label
}

// The exact User.role for the NEXT position (for precise person filtering).
// Factory-based positions append the group suffix (_G1G3 / _G2G4). Returns null
// when the position has no mapped role or the factory group is unknown → the
// picker then falls back to loose token matching.
export function nextPositionRole(dept: string, currentPos: number, factory?: string | null): string | null {
  const chain = chainFor(dept)
  const next = chain[currentPos + 1]
  if (!next || !next.role) return null
  if (next.factoryBased) {
    const g = vpProdGroup(factory)
    if (g === "G1/G3") return `${next.role}_G1G3`
    if (g === "G2/G4") return `${next.role}_G2G4`
    return null
  }
  return next.role
}

// Is `currentPos` the last position of the dept's chain (→ finish, no forward)?
export function isLastPosition(dept: string, currentPos: number): boolean {
  return currentPos >= chainFor(dept).length - 1
}

// Does this item have a split for `dept` still awaiting finalization?
export function itemHasPendingDept(item: any, dept: string): boolean {
  const depts = expandClaimDept(dept)
  return getSplits(item).some(s => depts.includes(s.dept) && s.status !== GW_DEPT_APPROVED && s.status !== SPLIT_STATUS.COMPLETED && s.status !== SPLIT_STATUS.REJECTED)
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
  return getSplits(item).some(s => depts.includes(s.dept) && !isNoApprovalGwDept(s.dept) && s.status !== GW_DEPT_APPROVED && s.status !== SPLIT_STATUS.REJECTED)
}

// Does this item have a split for one of `depts` still awaiting the FIRST
// approval (not yet accepted)? Used to gate the per-SO Approve action.
export function hasApprovableGwSplit(item: any, depts: string[]): boolean {
  return getSplits(item).some(s => depts.includes(s.dept) && !isNoApprovalGwDept(s.dept) && (s.status == null || s.status === SPLIT_STATUS.CLAIM_PENDING))
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
  // GW + SUPPLIER claims need NO approval — treat them as already approved so they
  // never block the doc (it flows straight to Accounting via the President step).
  const st = splits.map(s =>
    (isNoApprovalGwDept(s.dept) && s.status !== SPLIT_STATUS.REJECTED)
      ? GW_DEPT_APPROVED : s.status)
  if (st.some(s => s === SPLIT_STATUS.REJECTED)) return "REJECTED" // reject one portion → SO rejected
  // claim not fully approved yet (incl. NYK approver-done but EVP/CR incomplete)
  if (st.some(s => s == null || s === SPLIT_STATUS.CLAIM_PENDING || s === GW_DEPT_ACCEPTED || s === GW_NYK_APPROVER_PASSED)) return "PRES_PASSED"
  // claim fully approved + Logistics data filled → President's FINAL approval
  // (President moved to the end); President then sends it to Accounting.
  return lgDone ? "PRESIDENT_PENDING" : "PRES_PASSED"
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
// `lgDone` = Logistics has entered Actual Air Freight. Claim runs in PARALLEL with LG:
// even when every claim dept is fully approved, the SO only advances to President once
// LG's Actual is in. If claim is done but LG isn't, the SO waits (CLAIM_PASSED = holding).
export function deriveNygItemStatus(splits: ClaimSplit[], lgDone: boolean = true): string {
  if (splits.length === 0) return "LOG_PASSED"
  const st = splits.map(s => s.status)
  if (st.every(s => s === NYG_SPLIT.REJECTED)) return "REJECTED"
  // Any split still waiting on its DVM/entry (or NYK approver-done but EVP/CR incomplete)
  // → whole item stays at the claim (entry) stage.
  if (st.some(s => s == null || s === SPLIT_STATUS.CLAIM_PENDING || s === GW_NYK_APPROVER_PASSED)) return "LOG_PASSED"
  // At least one VP/EVP step outstanding → VP stage.
  if (st.some(s => s === NYG_SPLIT.CLAIM_PASSED)) return "CLAIM_PASSED"
  // Every claim dept fully approved → President ONLY if LG's Actual is in; else hold.
  return lgDone ? "PRESIDENT_PENDING" : "CLAIM_PASSED"
}
