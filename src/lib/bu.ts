// ── Business Units — single source of truth ──────────────────────────────────
// Add a new BU (e.g. TRM, EA) to BUS + BU_META below and it propagates everywhere:
// dashboard toggle, Air Requests / Approvals tabs, and the viewable-BU permission logic.
// Convention: role codes encode their BU by suffix (*_GW, *_TRM, *_EA). Bare NYG roles
// have no suffix. SCM_NYK_* are shared claim roles that live in EVERY BU.

import { canViewBothBu } from "./master-access"

export const BUS = ["NYG", "GW", "TRM", "EA"] as const
export type Bu = (typeof BUS)[number]

// Label + the active-tab color class for each BU toggle.
export const BU_META: Record<string, { label: string; active: string }> = {
  NYG: { label: "NYG", active: "bg-blue-600 text-white" },
  GW:  { label: "GW",  active: "bg-emerald-600 text-white" },
  TRM: { label: "TRM", active: "bg-purple-600 text-white" },
  EA:  { label: "EA",  active: "bg-rose-600 text-white" },
}

// A role → its BU. SCM_NYK_* exist in every BU (shared claim role) → "BOTH" (pins no BU).
export function roleBu(role: string): Bu | "BOTH" | null {
  if (!role) return null
  if (role.startsWith("SCM_NYK")) return "BOTH"
  if (role.endsWith("_GW") || role.startsWith("SCM_NYG")) return "GW"
  if (role.endsWith("_TRM")) return "TRM"
  if (role.endsWith("_EA")) return "EA"
  return "NYG" // legacy bare roles = NYG
}

// Does a request belong to `bu`? NYG legacy rows have bu === null → treated as NYG.
export function requestInBu(r: any, bu: string): boolean {
  if (bu === "ALL") return true
  if (bu === "NYG") return r?.bu === "NYG" || !r?.bu
  return r?.bu === bu
}

// The BUs a user may see (as toggles). ADMIN + the cross-BU allowlist (jariya) + bu==="ALL"
// see EVERY BU with an extra "All BU" option. Everyone else sees ONLY the BU(s) their roles
// imply (a 2-BU person gets 2 toggles, but no "All BU").
export function viewableBus(user: any): { bus: Bu[]; canAll: boolean } {
  if (!user) return { bus: [], canAll: false }
  const role = user.role || ""
  const roles: string[] = [role, ...(user.roles || [])].filter(Boolean)
  const bu = user.bu
  const canAll = role === "ADMIN" || bu === "ALL" || canViewBothBu(user)
  if (canAll) return { bus: [...BUS], canAll: true }
  const set = new Set<Bu>()
  for (const r of roles) {
    const b = roleBu(r)
    if (b && b !== "BOTH") set.add(b)
  }
  if (bu && bu !== "ALL" && (BUS as readonly string[]).includes(bu)) set.add(bu as Bu)
  if (set.size === 0) set.add("NYG")
  return { bus: BUS.filter(b => set.has(b)), canAll: false }
}
