// Who may EDIT the master data pages (Rate / Description). Roles + an explicit email
// allowlist for people granted master-data-manager access without changing their role.
// Single source of truth — used by both the client pages and the API routes.
export const MASTER_EDITOR_EMAILS = ["jariya.t@nanyangtextile.com"]

export function canEditMaster(user: any): boolean {
  const role = user?.role
  const email = String(user?.email || "").toLowerCase()
  return ["ADMIN", "LOGISTICS", "LOGISTICS_GW"].includes(role) || MASTER_EDITOR_EMAILS.includes(email)
}
