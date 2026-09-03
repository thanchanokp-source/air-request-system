// Pull Material — PC (Purchasing) branch approver is a SINGLE person, routed by BU.
// (The SCM branch stays role-based: PULL_DVM_SCM → VP_SCM → PULL_PRESIDENT.)
// Edit this map to change who approves each BU. Usable on both server (notify) and client (approval UI).
export const PC_APPROVER_BY_BU: Record<string, string> = {
  EA:  "jariya.t@nanyangtextile.com",
  TRM: "jariya.t@nanyangtextile.com",
  NYG: "jariya.t@nanyangtextile.com",
  GW:  "jariya.t@nanyangtextile.com",
}

export function pcApprover(bu: string | null | undefined): string | null {
  return (bu && PC_APPROVER_BY_BU[bu]) || null
}
