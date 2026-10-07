import { getSplits, claimEntryRoles } from "@/lib/claim"

// Resolve WHO a document is currently waiting on → their name(s). Mirrors the weekly-reminder routing
// (notify.ts sendWeeklyStuckAlerts) but returns display NAMES for the dashboard "อยู่ที่ใคร" column.
export type ApproverDir = { email: string | null; name: string | null; role: string | null; roles: string[]; bu: string | null }

// Role-based stages (no per-doc assignee) → all holders of the role, BU-scoped.
const STATUS_ROLES: Record<string, string[]> = {
  PENDING_SCM: ["SCM_USER"], PENDING_VP_SCM: ["VP_SCM"], PENDING_PRESIDENT: ["PRESIDENT"],
  PENDING_LOGISTICS: ["LOGISTICS"],
  PENDING_DPM_GW: ["DPM_GW", "VP_MER_GW"], PENDING_GM_GW: ["GM_GW"], PENDING_PRESIDENT_GW: ["PRESIDENT_GW"],
  PENDING_LOGISTICS_GW: ["LOGISTICS_GW"],
  PENDING_ACCOUNTING: ["ACCOUNTING"], ACCOUNTING_PENDING: ["ACCOUNTING"],
}

export function pendingApproverNames(doc: any, users: ApproverDir[]): string[] {
  const bu = doc.bu || "NYG"
  const st = doc.status
  const nameOfEmail = (e: any) => {
    if (!e) return null
    const u = users.find(x => String(x.email || "").toLowerCase() === String(e).toLowerCase())
    return u?.name || String(e)
  }
  const namesForRoles = (roles: string[], buScope = true): string[] => {
    const set = new Set<string>()
    for (const u of users) {
      const held = [u.role, ...(u.roles || [])].filter(Boolean) as string[]
      if (!held.some(r => roles.includes(r))) continue
      const isNyk = held.some(r => r.startsWith("SCM_NYK")) // NYK is cross-BU
      if (!buScope || isNyk || !u.bu || u.bu === "ALL" || u.bu === bu) { const n = u.name || u.email; if (n) set.add(n) }
    }
    return [...set]
  }

  // Assigned (per-doc) stages → the specific person picked.
  if (["PENDING_DVM_MER", "PENDING_DVM_MER_EA", "PENDING_DVM_MER_TRM"].includes(st) && doc.assignedDvmMer) return [nameOfEmail(doc.assignedDvmMer)!]
  if (["PENDING_VP_MER", "PENDING_VP_MER_EA", "PENDING_VP_MER_TRM", "PENDING_VP_MER_GW"].includes(st) && doc.assignedVpMer) return [nameOfEmail(doc.assignedVpMer)!]
  if (st === "PENDING_VP_SCM" && doc.assignedVpScm) return [nameOfEmail(doc.assignedVpScm)!]

  // Claim stages → forwarded holder(s) per dept + entry-role people for not-yet-forwarded depts + LG.
  if (["PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_CLAIM_GW"].includes(st)) {
    const NO_APPROVAL = ["SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]   // GW approves again
    const done = ["DEPT_APPROVED", "COMPLETED", "REJECTED"]
    const pendingDepts = new Set<string>()
    for (const it of (doc.items || [])) for (const s of getSplits(it)) if (s.dept && !done.includes(String(s.status || "")) && !NO_APPROVAL.includes(s.dept) && !(s.dept === "GW" && !(s as any).reapprove)) pendingDepts.add(s.dept)
    const set = new Set<string>()
    const forwardedDepts = new Set<string>()
    // Current holder per SO = FRONTIER forward (max position covering that SO), not every forward —
    // older forwards in a chain (amphron → sahaphat → rushan) have already handed the SO on.
    const pendingSoByDept = new Map<string, Set<string>>()
    for (const it of (doc.items || [])) for (const s of getSplits(it)) {
      if (s.dept && pendingDepts.has(s.dept)) { if (!pendingSoByDept.has(s.dept)) pendingSoByDept.set(s.dept, new Set()); pendingSoByDept.get(s.dept)!.add(it.id) }
    }
    for (const [dep, soIds] of pendingSoByDept) for (const soId of soIds) {
      const rows = (doc.claimForwards || []).filter((f: any) => f.dept === dep &&
        (!Array.isArray(f.itemIds) || f.itemIds.length === 0 || f.itemIds.includes(soId)))
      if (!rows.length) continue
      const latest = rows.sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))[0]
      const n = latest?.nextName || nameOfEmail(latest?.nextEmail); if (n) { set.add(n); forwardedDepts.add(dep) }
    }
    const roleSet = new Set<string>()
    for (const d of pendingDepts) {
      if (forwardedDepts.has(d)) continue
      if (d === "COMMERCIAL") { const n = nameOfEmail(doc.assignedDvmMer || doc.assignedVpMer); if (n) set.add(n); continue }
      if (d === "GW" && bu === "GW") {   // GW claim: DPM of the doc → GM
        const st = (doc.items || []).flatMap((it: any) => getSplits(it)).filter((s: any) => s.dept === "GW" && s.reapprove).map((s: any) => s.status)
        if (st.some((x: any) => x == null || x === "CLAIM_PENDING")) { const n = doc.assignedVpMer ? nameOfEmail(doc.assignedVpMer) : null; if (n) set.add(n); else { roleSet.add("DPM_GW"); roleSet.add("VP_MER_GW") } }
        if (st.includes("GW_DPM_PASSED")) roleSet.add("GM_GW")
        continue
      }
      for (const r of claimEntryRoles(d)) roleSet.add(r)
    }
    if (roleSet.size) for (const n of namesForRoles([...roleSet])) set.add(n)
    if (!doc.logisticsSent) {
      const lgRoles = bu === "GW" ? ["LOGISTICS_GW"] : bu === "TRM" ? ["LOGISTICS_TRM"] : ["LOGISTICS"]
      for (const n of namesForRoles(lgRoles)) set.add(n)
    }
    return [...set].filter(Boolean)
  }

  // PENDING_SCM spans SCM-assign then VP-SCM-approve.
  if (st === "PENDING_SCM") {
    const its = doc.items || []
    const set = new Set<string>()
    if (its.some((i: any) => i.itemStatus === "PENDING")) for (const n of namesForRoles(["SCM_USER"])) set.add(n)
    if (its.some((i: any) => i.itemStatus === "PASSED")) {
      if (doc.assignedVpScm) { const n = nameOfEmail(doc.assignedVpScm); if (n) set.add(n) }
      else for (const n of namesForRoles(["VP_SCM"])) set.add(n)
    }
    return [...set].filter(Boolean)
  }

  if (st === "PENDING_LOGISTICS" && bu === "TRM") return namesForRoles(["LOGISTICS_TRM"])
  const roles = STATUS_ROLES[st]
  if (roles) return namesForRoles(roles)
  return []
}
