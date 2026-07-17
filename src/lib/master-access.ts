// Who may EDIT the master data pages (Rate / Description). Roles + an explicit email
// allowlist for people granted master-data-manager access without changing their role.
// Single source of truth — used by both the client pages and the API routes.
export const MASTER_EDITOR_EMAILS = ["jariya.t@nanyangtextile.com"]

export function canEditMaster(user: any): boolean {
  const role = user?.role
  const email = String(user?.email || "").toLowerCase()
  return ["ADMIN", "LOGISTICS", "LOGISTICS_GW"].includes(role) || MASTER_EDITOR_EMAILS.includes(email)
}

// People granted an admin-like cross-BU VIEW (the NYG/GW toggle on Air Requests + Approvals)
// without being ADMIN. Email allowlist — edit here to add/remove.
export const CROSS_BU_VIEW_EMAILS = ["jariya.t@nanyangtextile.com"]
export function canViewBothBu(user: any): boolean {
  return CROSS_BU_VIEW_EMAILS.includes(String(user?.email || "").toLowerCase())
}
