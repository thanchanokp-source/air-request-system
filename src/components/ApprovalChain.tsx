"use client"

import { getSplits, chainFor, deptLabel, claimEntryDisplayRoles, vpProdGroup, NO_APPROVAL_GW_DEPTS } from "@/lib/claim"

// Visual approval progress chain.
//  - Doc-level (pass `items`): overall document stage + aggregated claim depts.
//  - Per-SO (pass `soItem`): that SO's own progress + its own claim dept splits.
//  - GW: after President, Logistics ∥ Claim run in parallel; claim shows per-dept.

type Node = { key: string; label: string; ord: number }

// New order: DPM → GM → (Logistics ∥ Claim) → President → Accounting.
const GW_PRE: Node[] = [
  { key: "PENDING_VP_MER_GW", label: "DPM", ord: 0 },
  { key: "PENDING_GM_GW", label: "GM", ord: 1 },
]
const GW_ORD: Record<string, number> = {
  PENDING_VP_MER_GW: 0, PENDING_GM_GW: 1,
  PENDING_CLAIM_GW: 2, PENDING_LOGISTICS_GW: 2, // parallel stage
  PENDING_PRESIDENT_GW: 3, PENDING_ACCOUNTING: 4, COMPLETED: 5,
}
// Per-SO item status → GW chain ordinal.
const GW_ITEM_ORD: Record<string, number> = {
  PRES_PASSED: 2, LOG_PASSED: 2, PRESIDENT_PENDING: 3, ACCOUNTING_PENDING: 4, COMPLETED: 5,
}

// New order: DVM MER → VP MER → SCM → VP SCM → Logistics → Claim → President (final).
const NYG_STAGES: Node[] = [
  { key: "PENDING_DVM_MER", label: "DVM Merchandise", ord: 0 },
  { key: "PENDING_VP_MER", label: "VP Merchandise", ord: 1 },
  { key: "PENDING_SCM", label: "SCM", ord: 2 },
  { key: "PENDING_VP_SCM", label: "VP SCM", ord: 3 },
  { key: "PENDING_LOGISTICS", label: "Logistics", ord: 4 },
  { key: "PENDING_CLAIM", label: "Claim", ord: 5 },
  { key: "PENDING_PRESIDENT", label: "President", ord: 6 },
]

function Chip({ state, label, sm }: { state: "done" | "active" | "pending"; label: React.ReactNode; sm?: boolean }) {
  const cls = state === "done" ? "bg-green-100 text-green-700 border-green-300"
    : state === "active" ? "bg-amber-100 text-amber-800 border-amber-400 font-semibold ring-1 ring-amber-300"
    : "bg-gray-50 text-gray-400 border-gray-200"
  const icon = state === "done" ? "✓" : state === "active" ? "●" : "○"
  return (
    <span className={`inline-flex items-center gap-1 ${sm ? "text-[10px] px-1.5" : "text-[11px] px-2"} py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      <span className="text-[9px] leading-none">{icon}</span>{label}
    </span>
  )
}

// The stage where the doc/SO was rejected — red, so you can see AT A GLANCE which position rejected.
function RejChip({ label, sm }: { label: React.ReactNode; sm?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${sm ? "text-[10px] px-1.5" : "text-[11px] px-2"} py-0.5 rounded-full border whitespace-nowrap bg-red-100 text-red-700 border-red-400 font-semibold ring-1 ring-red-300`}>
      <span className="text-[9px] leading-none">✕</span>{label}
    </span>
  )
}

const Bar = ({ done }: { done: boolean }) => <span className={`w-4 h-px mx-0.5 shrink-0 ${done ? "bg-green-300" : "bg-gray-200"}`} />

// Display name for an approver: prefer a real name, else the email's local part (before @).
const nameOf = (s?: string | null) => (s ? (s.includes("@") ? s.split("@")[0] : s) : "")

// Lowest-priority active person holding any of `roles` in this BU → email name.
function resolveRoleEmail(dir: any[] | undefined, roles: string[], bu?: string): string {
  if (!dir || !dir.length) return ""
  const cands = dir.filter((u: any) =>
    (!bu || u.bu === bu) &&
    (roles.includes(u.role) || (Array.isArray(u.roles) && u.roles.some((r: string) => roles.includes(r)))))
  cands.sort((a: any, b: any) => (a.priority ?? 99) - (b.priority ?? 99))
  return cands[0] ? nameOf(cands[0].email) || nameOf(cands[0].name) : ""
}

// Current linear-stage → {label, roles, assigned-email getter}. Claim stages are handled
// separately (per-department). assigned email (chosen at upload) wins over role lookup.
const STAGE_INFO: Record<string, { label: string; roles: string[]; assigned?: (req: any, soItem: any) => string | null | undefined }> = {
  PENDING_DVM_MER:    { label: "DVM Merchandise",  roles: ["DVM_MER"],     assigned: (r) => r?.assignedDvmMer },
  PENDING_VP_MER:     { label: "VP Merchandise",   roles: ["VP_MER"],      assigned: (r) => r?.assignedVpMer },
  PENDING_DVM_MER_EA: { label: "ADVM",             roles: ["DVM_MER_EA"],  assigned: (r) => r?.assignedDvmMer },
  PENDING_VP_MER_EA:  { label: "DVM",              roles: ["VP_MER_EA"],   assigned: (r) => r?.assignedVpMer },
  PENDING_SCM:        { label: "SCM",      roles: ["SCM_USER"] },
  PENDING_VP_SCM:     { label: "VP SCM",   roles: ["VP_SCM"],      assigned: (r) => r?.assignedVpScm },
  PENDING_LOGISTICS:  { label: "Logistics",roles: ["LOGISTICS"] },
  PENDING_PRESIDENT:  { label: "President",roles: ["PRESIDENT"] },
  PENDING_VP_MER_GW:  { label: "DPM",      roles: ["VP_MER_GW"],   assigned: (r) => r?.assignedVpMer },
  PENDING_GM_GW:      { label: "GM",       roles: ["GM_GW"] },
  PENDING_LOGISTICS_GW:{ label: "Logistics",roles: ["LOGISTICS_GW"] },
  PENDING_PRESIDENT_GW:{ label: "President",roles: ["PRESIDENT_GW"] },
}

// "Stage: who" for the current linear stage (empty for claim stages / terminal states).
function currentStageWho(status: string, bu: string, soItem: any, req: any, dir?: any[]): string {
  const info = STAGE_INFO[status]
  if (!info) return ""
  const who = nameOf(info.assigned?.(req, soItem)) || resolveRoleEmail(dir, info.roles, bu)
  return who ? `${info.label}: ${who}` : ""
}

// Resolve the ENTRY (auto-notified) approver's email name for a dept from the directory.
// PRODUCTION filters by the SO's factory G-group; PROCUREMENT by procurementType=PURCHASING.
function entryPersonOf(dept: string, dir: any[] | undefined, bu?: string, factory?: string | null): string {
  if (!dir || !dir.length) return ""
  const roles = claimEntryDisplayRoles(dept)
  let cands = dir.filter((u: any) =>
    (!bu || u.bu === bu) &&
    (roles.includes(u.role) || (Array.isArray(u.roles) && u.roles.some((r: string) => roles.includes(r)))))
  if (dept === "PRODUCTION") { const g = vpProdGroup(factory); cands = cands.filter((u: any) => vpProdGroup(u.claimDepartment) === g) }
  if (dept === "PROCUREMENT") cands = cands.filter((u: any) => u.procurementType === "PURCHASING")
  cands.sort((a: any, b: any) => (a.priority ?? 99) - (b.priority ?? 99))
  const u = cands[0]
  return u ? nameOf(u.email) || nameOf(u.name) : ""
}

// Per-dept "who are we waiting on now?" — the latest forward's person (name/email local-part),
// scoped to this SO; else the resolved ENTRY approver's email; else the position label.
function pendingWhoFor(depts: { dept: string; done: boolean }[], claimForwards: any[] | undefined, soId?: string,
  opts?: { dir?: any[]; bu?: string; factory?: string | null; assignedDvmMer?: string | null }) {
  return depts.filter(d => !d.done).map(d => {
    const rows = (claimForwards || []).filter((f: any) => f.dept === d.dept &&
      (!Array.isArray(f.itemIds) || f.itemIds.length === 0 || !soId || f.itemIds.includes(soId)))
    const latest = rows.sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0))[0]
    const person = nameOf(latest?.nextName) || nameOf(latest?.nextEmail)
      // COMMERCIAL claim = the merch person picked at upload (assignedDvmMer) — NYG or EA.
      || (d.dept === "COMMERCIAL" ? nameOf(opts?.assignedDvmMer) : "")
      || entryPersonOf(d.dept, opts?.dir, opts?.bu, opts?.factory)
    const dl = deptLabel(d.dept)
    const label = person || (chainFor(d.dept)[0]?.label ?? "")
    return label && label !== dl ? `${dl}: ${label}` : dl
  })
}

function WaitingLine({ items, days }: { items: string[]; days?: number | null }) {
  if (!items.length) return null
  return (
    <div className="mt-1 text-[10px] text-amber-700 flex items-center gap-1 flex-wrap">
      <span>⏳ Waiting:</span>
      {items.map((w, i) => <span key={i} className="bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">{w}</span>)}
      {days != null && <span className={`font-semibold ${days >= 7 ? "text-red-600" : days >= 3 ? "text-amber-600" : "text-gray-400"}`}>· รอ {days} วัน</span>}
    </div>
  )
}

export function ApprovalChain({ status, bu, items, soItem, sm, claimForwards, approvers, req }: { status: string; bu: string; items?: any[]; soItem?: any; sm?: boolean; claimForwards?: any[]; approvers?: any[]; req?: any }) {
  // Days the doc has sat in its current stage (updatedAt bumps on each stage change).
  const _ws = req?.updatedAt || req?.createdAt
  const waitDays = _ws ? Math.max(0, Math.floor((Date.now() - new Date(_ws).getTime()) / 86400000)) : null
  const rejected = soItem ? soItem.itemStatus === "REJECTED" : status === "REJECTED"
  const completed = soItem ? soItem.itemStatus === "COMPLETED" : status === "COMPLETED"
  const claimSource: any[] = soItem ? [soItem] : (Array.isArray(items) ? items : [])

  // Which stage rejected? Pull it from the REJECT approval log's fromStatus. When we have a
  // specific SO, match the log by "Style: <style>" in its comment; else take the latest REJECT.
  const rejectLog: any = (() => {
    if (!rejected) return null
    const logs: any[] = (req?.approvalLogs || []).filter((l: any) => l.action === "REJECT")
    if (!logs.length) return null
    const byStyle = soItem?.style
      ? logs.find((l: any) => typeof l.comment === "string" && l.comment.includes(`Style: ${soItem.style}`))
      : null
    return byStyle || logs[0]
  })()
  const rejectStageKey: string | null = rejectLog?.fromStatus || null
  // Reason to show on the trailing chip: the SO's own comment, else strip "Style: X - " off
  // the reject log's comment, else the doc-level reason.
  const rejectReason: string =
    (soItem?.itemComment && String(soItem.itemComment).trim())
    || (rejectLog?.comment ? String(rejectLog.comment).replace(/^Style:\s*[^\s-]+\s*-\s*/, "").trim() : "")
    || (req?.rejectionReason ? String(req.rejectionReason).trim() : "")

  // ── NYG: linear chain (Claim step expands into per-dept chips, like GW) ──
  if (bu !== "GW") {
    // EA re-uses the NYG chain (only the top-3 approvers differ) → map EA merch statuses to the
    // equivalent NYG stage so the progress chain renders correctly.
    const nyStatus = status === "PENDING_DVM_MER_EA" ? "PENDING_DVM_MER" : status === "PENDING_VP_MER_EA" ? "PENDING_VP_MER" : status
    const cur = completed ? 99 : soItem ? nygItemOrd(soItem, nyStatus) : (NYG_STAGES.find(s => s.key === nyStatus)?.ord ?? -1)
    const CLAIM_ORD = 5
    // Per-department claim status from this SO's (or aggregate) splits.
    const dmap: Record<string, { total: number; done: number }> = {}
    for (const it of claimSource) for (const s of getSplits(it)) {
      if (!dmap[s.dept]) dmap[s.dept] = { total: 0, done: 0 }
      dmap[s.dept].total++
      if (s.status === "COMPLETED" || s.status === "DEPT_APPROVED") dmap[s.dept].done++
    }
    const claimDepts = Object.entries(dmap).map(([dept, c]) => ({ dept, done: c.done === c.total }))
    const claimReached = completed || cur >= CLAIM_ORD
    // Logistics runs IN PARALLEL with Claim (not a linear step): green ONLY after LG presses
    // "Save & Send" (req.logisticsSent) — NOT on Save Draft (which also fills Actual freight).
    const lgDone = !!req?.logisticsSent
    // Who is each still-pending dept currently waiting on? NYK is handled separately
    // (3-role sub-flow: Approver → EVP + CR user), so exclude it from the generic resolver.
    const soId = soItem?.id
    const nonNyk = claimDepts.filter(d => d.dept !== "NYK" && d.dept !== "SCM NYK")
    const claimWho = claimReached && !completed
      ? pendingWhoFor(nonNyk, claimForwards, soId, { dir: approvers, bu, factory: soItem?.factory, assignedDvmMer: req?.assignedDvmMer })
      : []
    // NYK 3-role state: before the Action Approver approves → "NYK: Approver" (either of
    // the 2 can act, so don't name one); after → waiting on the EVP and/or CR user.
    const nykDept = claimDepts.find(d => (d.dept === "NYK" || d.dept === "SCM NYK") && !d.done)
    let nykWho = ""
    if (nykDept && claimReached && !completed) {
      const appr: any[] = soItem?.claimApprovals || []
      const approverDone = appr.some((a: any) => a.role === "SCM_NYK_APPROVER")
      if (!approverDone) {
        nykWho = "NYK: Approver"
      } else {
        const parts: string[] = []
        if (!appr.some((a: any) => a.role === "SCM_NYK_EVP")) parts.push(`EVP ${nameOf(req?.assignedScmNykEvp)}`.trim())
        if (!req?.crNo) parts.push(`CR ${nameOf(req?.assignedScmNykCr)}`.trim())
        nykWho = `NYK: ${parts.join(" + ") || "finalizing"}`
      }
    }
    const stageWho = !completed && !rejected ? currentStageWho(status, bu, soItem, req, approvers) : ""
    // LG runs parallel with Claim → surface it as pending until Actual is entered.
    const lgName = resolveRoleEmail(approvers, ["LOGISTICS"], bu)
    const lgWho = !completed && !rejected && claimReached && !lgDone ? `Logistics${lgName ? `: ${lgName}` : ""}` : ""
    const pendingWho = [...(stageWho ? [stageWho] : []), ...(lgWho ? [lgWho] : []), ...claimWho, ...(nykWho ? [nykWho] : [])]
    return (
      <div className="py-1">
        <div className="flex items-center gap-0 overflow-x-auto">
          {NYG_STAGES.map((s, i) => {
            const isClaim = s.key === "PENDING_CLAIM"
            const isLg = s.key === "PENDING_LOGISTICS"
            let chipState: "done" | "active" | "pending" = rejected ? "pending" : completed || s.ord < cur ? "done" : s.ord === cur ? "active" : "pending"
            // Logistics is data-driven (not ordinal): green only once Actual is entered.
            if (isLg) chipState = rejected ? "pending" : (completed || lgDone) ? "done" : (cur >= s.ord ? "active" : "pending")
            // Logistics ∥ Claim are parallel → no connecting line between them.
            const showBar = i < NYG_STAGES.length - 1 && !isLg
            return (
              <div key={s.key} className="flex items-center shrink-0">
                {isClaim && claimDepts.length > 0 ? (
                  // Expand the Claim step into per-department chips (GW-style).
                  <span className="inline-flex items-center gap-1">
                    {claimDepts.map(d => {
                      const cls = d.done ? "bg-green-100 text-green-700 border-green-300"
                        : claimReached ? "bg-amber-50 text-amber-700 border-amber-300"
                        : "bg-gray-50 text-gray-400 border-gray-200"
                      return (
                        <span key={d.dept} className={`inline-flex items-center gap-1 ${sm ? "text-[10px] px-1.5" : "text-[11px] px-2"} py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
                          <span className="text-[9px] leading-none">{d.done ? "✓" : claimReached ? "●" : "○"}</span>{deptLabel(d.dept)}
                        </span>
                      )
                    })}
                  </span>
                ) : rejected && s.key === rejectStageKey ? (
                  <RejChip sm={sm} label={s.label} />
                ) : (
                  <Chip sm={sm} state={chipState} label={s.label} />
                )}
                {showBar && <Bar done={completed || s.ord < cur} />}
              </div>
            )
          })}
          {rejected && <span title={rejectReason || undefined} className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium max-w-[260px] truncate inline-block align-bottom">✕ {rejectReason || "Rejected"}</span>}
          {completed && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Completed</span>}
        </div>
        <WaitingLine items={pendingWho} days={waitDays} />
      </div>
    )
  }

  // ── GW: DPM → GM → (Logistics ∥ Claim) → President → Accounting ──
  const cur = completed ? 5 : soItem ? (GW_ITEM_ORD[soItem.itemStatus] ?? (GW_ORD[status] ?? -1)) : (GW_ORD[status] ?? -1)
  const stateFor = (ord: number): "done" | "active" | "pending" =>
    completed || cur > ord ? "done" : cur === ord ? "active" : "pending"
  const parallelReached = completed || cur >= 2 // reached the Logistics∥Claim stage

  // Per-department claim status + overall claim/logistics completion.
  // GW + SUPPLIER need NO approval (backend auto-passes them via deriveGwItemStatus and
  // never alerts them). Their split stays CLAIM_PENDING in the DB, so treat them as DONE
  // here too → the chip shows green "✓" (not amber "Waiting") the moment the claim exists.
  const gwSplitDone = (s: any) =>
    s.status === "DEPT_APPROVED" || s.status === "COMPLETED"
    || (NO_APPROVAL_GW_DEPTS.includes(s.dept) && s.status !== "REJECTED")
  const map: Record<string, { total: number; done: number }> = {}
  for (const it of claimSource) for (const s of getSplits(it)) {
    if (!map[s.dept]) map[s.dept] = { total: 0, done: 0 }
    map[s.dept].total++
    if (gwSplitDone(s)) map[s.dept].done++
  }
  const claimDepts = Object.entries(map).map(([dept, c]) => ({ dept, done: c.done === c.total }))
  const allSplits = claimSource.flatMap(it => getSplits(it))
  const claimDone = allSplits.length > 0 && allSplits.every(gwSplitDone)
  const lgDone = !!req?.logisticsSent
  // "Claim" turns green when ALL claim depts approved; "Logistics" only after LG Save & Send.
  const claimChip: "done" | "active" | "pending" = completed || claimDone ? "done" : parallelReached ? "active" : "pending"
  const lgChip: "done" | "active" | "pending" = completed || lgDone ? "done" : parallelReached ? "active" : "pending"
  const gwNonNyk = claimDepts.filter(d => d.dept !== "NYK" && d.dept !== "SCM NYK")
  const gwClaimWho = parallelReached && !completed && !rejected
    ? pendingWhoFor(gwNonNyk, claimForwards, soItem?.id, { dir: approvers, bu, factory: soItem?.factory })
    : []
  // NYK 3-role state (same as NYG): Approver → EVP + CR user.
  const gwNyk = claimDepts.find(d => (d.dept === "NYK" || d.dept === "SCM NYK") && !d.done)
  let gwNykWho = ""
  if (gwNyk && parallelReached && !completed && !rejected) {
    const appr: any[] = soItem?.claimApprovals || []
    if (!appr.some((a: any) => a.role === "SCM_NYK_APPROVER")) {
      gwNykWho = "NYK: Approver"
    } else {
      const parts: string[] = []
      if (!appr.some((a: any) => a.role === "SCM_NYK_EVP")) parts.push(`EVP ${nameOf(req?.assignedScmNykEvp)}`.trim())
      if (!req?.crNo) parts.push(`CR ${nameOf(req?.assignedScmNykCr)}`.trim())
      gwNykWho = `NYK: ${parts.join(" + ") || "finalizing"}`
    }
  }
  const gwStageWho = !completed && !rejected ? currentStageWho(status, "GW", soItem, req, approvers) : ""
  const gwPendingWho = [...(gwStageWho ? [gwStageWho] : []), ...gwClaimWho, ...(gwNykWho ? [gwNykWho] : [])]

  return (
    <div className="py-1">
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {GW_PRE.map(s => (
        <div key={s.key} className="flex items-center shrink-0">
          {rejected && s.key === rejectStageKey
            ? <RejChip sm={sm} label={s.label} />
            : <Chip sm={sm} state={rejected ? "pending" : stateFor(s.ord)} label={s.label} />}
          <Bar done={completed || cur > s.ord} />
        </div>
      ))}
      {/* Logistics ∥ Claim — adjacent (no line) = parallel */}
      <Chip sm={sm} state={rejected ? "pending" : lgChip} label="Logistics" />
      <Chip sm={sm} state={rejected ? "pending" : claimChip} label="Claim" />
      {claimDepts.map(d => {
        const cls = d.done ? "bg-green-100 text-green-700 border-green-300"
          : parallelReached ? "bg-amber-50 text-amber-700 border-amber-300"
          : "bg-gray-50 text-gray-400 border-gray-200"
        const icon = d.done ? "✓" : parallelReached ? "●" : "○"
        return (
          <span key={d.dept}
            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${cls}`}>
            {icon} {deptLabel(d.dept)}
          </span>
        )
      })}
      {/* President = final approver (after parallel) */}
      <Bar done={completed || cur > 3} />
      <Chip sm={sm} state={rejected ? "pending" : stateFor(3)} label="President" />
      {status === "PENDING_MER_GW" && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300 font-medium">↩ Back to Merchandise</span>}
      {rejected && <span title={rejectReason || undefined} className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium max-w-[260px] truncate inline-block align-bottom">✕ {rejectReason || "Rejected"}</span>}
      {completed && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Completed</span>}
    </div>
    <WaitingLine items={gwPendingWho} days={waitDays} />
    </div>
  )
}

// NYG per-SO item status → chain ordinal (new order; President is last).
function nygItemOrd(item: any, docStatus: string): number {
  const m: Record<string, number> = {
    DVM_MER_PASSED: 1, VP_MER_PASSED: 2, PASSED: 3, VP_PASSED: 4, PRES_PASSED: 4, LOG_PASSED: 5,
    CLAIM_PASSED: 5, PRESIDENT_PENDING: 6, ACCOUNTING_PENDING: 7, COMPLETED: 8,
  }
  if (item.itemStatus === "PENDING") return NYG_STAGES.find(s => s.key === docStatus)?.ord ?? 0
  return m[item.itemStatus] ?? 0
}
