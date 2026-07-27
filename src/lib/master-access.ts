// Who may EDIT the master data pages (Rate / Description). Roles + an explicit email
// allowlist for people granted master-data-manager access without changing their role.
// Single source of truth — used by both the client pages and the API routes.
export const MASTER_EDITOR_EMAILS = ["jariya.t@nanyangtextile.com"]

export function canEditMaster(user: any): boolean {
  const role = user?.role
  const email = String(user?.email || "").toLowerCase()
  return ["ADMIN", "LOGISTICS", "LOGISTICS_GW"].includes(role) || MASTER_EDITOR_EMAILS.includes(email)
}

// Delay-code master is owned by SCM (they define the reasons) → SCM may also edit it,
// on top of the standard master editors. Does NOT grant Rate/Description edit.
export function canEditDelayCode(user: any): boolean {
  const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
  return canEditMaster(user) || roles.includes("SCM_USER")
}

// People granted an admin-like cross-BU VIEW (the NYG/GW toggle on Air Requests + Approvals)
// without being ADMIN. Email allowlist — edit here to add/remove.
export const CROSS_BU_VIEW_EMAILS = ["jariya.t@nanyangtextile.com"]
export function canViewBothBu(user: any): boolean {
  return CROSS_BU_VIEW_EMAILS.includes(String(user?.email || "").toLowerCase())
}
