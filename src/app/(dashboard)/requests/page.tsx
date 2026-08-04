"use client"
import { useEffect, useState, useRef, Fragment } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { MultiSelect } from "@/components/ui/multi-select"
import { getSplits, deptLabel } from "@/lib/claim"
import { viewableBus, requestInBu, BU_META } from "@/lib/bu"
import { ApprovalChain } from "@/components/ApprovalChain"

const STATUS_LABELS: Record<string, string> = {
  PENDING_DVM_MER: "Pending DVM Merchandise",
  PENDING_VP_MER: "Pending VP Merchandise", PENDING_SCM: "Pending SCM",
  PENDING_VP_SCM: "Pending VP SCM", PENDING_PRESIDENT: "Pending President",
  PENDING_LOGISTICS: "Pending Logistics", PENDING_CLAIM: "Pending Claim",
  PENDING_VP_CLAIM: "Pending VP Claim",
  PENDING_VP_NYK: "Pending VP NYK",
  PENDING_VP_MER_GW: "Pending DPM (GW)", PENDING_GM_GW: "Pending GM (GW)", PENDING_PRESIDENT_GW: "Pending President (GW)",
  PENDING_LOGISTICS_GW: "Pending Logistics (GW)", PENDING_CLAIM_GW: "Pending Claim (GW)",
  COMPLETED: "Completed", REJECTED: "Rejected"
}

const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

const SoBadge = ({ s, docStatus }: { s: string; docStatus: string }) => {
  const completed = s === "COMPLETED" || (docStatus === "COMPLETED" && s !== "REJECTED")
  const rejected = s === "REJECTED" || docStatus === "REJECTED"
  const cls = completed ? "bg-green-100 text-green-700" : rejected ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
  const lbl = completed ? "Completed" : rejected ? "Rejected" : "Pending"
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>{lbl}</span>
}

// Current SO status, labelled by POSITION (PENDING_MER → … → COMPLETED). The LG ∥ Claim phase is
// combined: an SO whose Actual air freight is NOT entered yet shows "PENDING_LG_BOOKING/CLAIM"
// (LG still has to book/enter). Once the Actual is filled but the claim isn't fully approved, it
// drops to "PENDING_CLAIM" (LG done — only claim left). Needs the row for actualAirFreight.
const getSoCurrentStep = (row: any): string => {
  const itemStatus = row?.itemStatus, docStatus = row?.request?.status || ""
  if (itemStatus === "REJECTED") return "REJECTED"
  if (itemStatus === "COMPLETED" || itemStatus === "ACCOUNTING_PENDING") return "COMPLETED"
  if (itemStatus === "PRESIDENT_PENDING") return "PENDING_PRESIDENT" // claim + LG done → final
  const airEntered = row?.actualAirFreight != null
  // LG ∥ Claim parallel phase.
  const claimPhase = ["VP_PASSED", "PRES_PASSED", "LOG_PASSED"].includes(itemStatus)
    || ["PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_CLAIM_GW"].includes(docStatus)
  if (claimPhase) return airEntered ? "PENDING_CLAIM" : "PENDING_LG_BOOKING/CLAIM"
  // Claim already approved for this SO → only Logistics booking may remain, else waiting President.
  if (itemStatus === "CLAIM_PASSED") return airEntered ? "PENDING_PRESIDENT" : "PENDING_LG_BOOKING/CLAIM"
  if (itemStatus === "PASSED") return "PENDING_VP_SCM"
  if (itemStatus === "VP_MER_PASSED") return "PENDING_SCM"
  if (itemStatus === "SCM_GW_PENDING") return "PENDING_SCM"
  if (itemStatus === "PENDING") {
    if (docStatus === "PENDING_PRESIDENT" || docStatus === "PENDING_PRESIDENT_GW") return "PENDING_PRESIDENT"
    if (docStatus === "PENDING_SCM") return "PENDING_SCM"
    if (docStatus === "PENDING_VP_SCM") return "PENDING_VP_SCM"
    if (["PENDING_VP_MER", "PENDING_VP_MER_EA", "PENDING_VP_MER_TRM", "PENDING_VP_MER_GW", "PENDING_DPM_GW", "PENDING_GM_GW"].includes(docStatus)) return "PENDING_VP_MER"
    return "PENDING_MER" // DVM/ADVM merch (first approver)
  }
  return "-"
}

// Aggregate status for a group of SO (a whole document or one style) so you can
// see at a glance where it stands: Done / Pending / Rejected / Back to. (Both BU.)
function soAggBadge(rows: any[]): { label: string; cls: string } | null {
  if (!rows || rows.length === 0) return null
  const st = rows.map(r => r.itemStatus)
  if (st.some(s => s === "REJECTED")) return { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" }
  if (st.some(s => s === "CLAIM_REJECT_GW")) return { label: "Back to Merchandise", cls: "bg-orange-100 text-orange-700 border-orange-200" }
  if (st.every(s => s === "COMPLETED" || s === "ACCOUNTING_PENDING")) return { label: "Done", cls: "bg-green-100 text-green-700 border-green-200" }
  return { label: "Pending", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" }
}
const AggBadge = ({ rows }: { rows: any[] }) => {
  const b = soAggBadge(rows)
  if (!b) return null
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap shrink-0 ${b.cls}`}>{b.label}</span>
}

const STEP_COLORS: Record<string, string> = {
  "PENDING_MER": "bg-yellow-100 text-yellow-700",
  "PENDING_VP_MER": "bg-amber-100 text-amber-700",
  "PENDING_SCM": "bg-orange-100 text-orange-700",
  "PENDING_VP_SCM": "bg-orange-100 text-orange-800",
  "PENDING_LG_BOOKING/CLAIM": "bg-blue-100 text-blue-700",
  "PENDING_CLAIM": "bg-indigo-100 text-indigo-700",
  "PENDING_PRESIDENT": "bg-purple-100 text-purple-700",
  "COMPLETED": "bg-green-100 text-green-700",
  "REJECTED": "bg-red-100 text-red-700",
}

const CurrentStepBadge = ({ row }: { row: any }) => {
  const step = getSoCurrentStep(row)
  const cls = STEP_COLORS[step] || "bg-gray-100 text-gray-500"
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${cls}`}>{step}</span>
}


export default function RequestsPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const userId = (session?.user as any)?.id || ""
  // Which BU(s) this viewer may browse (central logic — forward-ready for TRM/EA).
  // ADMIN + jariya → every BU; a 2-BU person → their 2 BUs; single-BU → just theirs (badge).
  const { bus: buTabs } = viewableBus(session?.user)
  const showBuToggle = buTabs.length > 1
  const [activeBu, setActiveBu] = useState<string>("NYG")
  // Session loads after first render — default the active BU to the viewer's first allowed BU.
  const buInit = useRef(false)
  useEffect(() => {
    if (buInit.current || !session?.user) return
    setActiveBu(buTabs[0] || "NYG")
    buInit.current = true
  }, [session, buTabs])
  const [requests, setRequests] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [brandF, setBrandF] = useState<string[]>([])
  const [styleF, setStyleF] = useState<string[]>([])
  const [soF, setSoF] = useState<string[]>([])
  const [cpF, setCpF] = useState<string[]>([])
  const [portF, setPortF] = useState<string[]>([])
  const [countryF, setCountryF] = useState<string[]>([])
  const [claimF, setClaimF] = useState<string[]>([])
  const [invoiceF, setInvoiceF] = useState<string[]>([])
  const [hawbF, setHawbF] = useState<string[]>([])
  const [stageF, setStageF] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set())
  const [deletingAtt, setDeletingAtt] = useState<string | null>(null)
  const [claimDir, setClaimDir] = useState<any[]>([])
  // Recall straight from the list — Admin/Jariya any status (except at-MER/draft), creator only in the merch window.
  const myEmail = String((session?.user as any)?.email || "").toLowerCase()
  const [recallDoc, setRecallDoc] = useState<any>(null)
  const [recallReason, setRecallReason] = useState("")
  const [recalling, setRecalling] = useState(false)
  // Statuses the CREATOR may still recall from — the merch-review window before VP MER / GM approves.
  const MER_RECALL_WINDOW = ["PENDING_DVM_MER", "PENDING_VP_MER", "PENDING_DVM_MER_EA", "PENDING_VP_MER_EA", "PENDING_DVM_MER_TRM", "PENDING_VP_MER_TRM", "PENDING_VP_MER_GW", "PENDING_GM_GW"]
  const canRecallDoc = (req: any) => {
    if (!req) return false
    const isAdminRecaller = role === "ADMIN" || myEmail === "jariya.t@nanyangtextile.com"
    const isCreator = !!myEmail && !!req?.createdBy?.email && myEmail === String(req.createdBy.email).toLowerCase()
    // Admin/Jariya: any stage except at-MER/draft. Creator: only within the merch-review window.
    if (isAdminRecaller) return !["PENDING_MER", "PENDING_MER_GW", "DRAFT"].includes(req.status)
    return isCreator && MER_RECALL_WINDOW.includes(req.status)
  }
  const doRecall = async () => {
    if (!recallDoc) return
    setRecalling(true)
    const res = await fetch(`/api/requests/${recallDoc.id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recall", comment: recallReason.trim() }),
    })
    if (res.ok) { setRecallDoc(null); setRecallReason(""); const d = await fetch("/api/requests").then(r => r.json()); setRequests(d) }
    else { const e = await res.json().catch(() => ({})); alert(e.error || "Recall failed") }
    setRecalling(false)
  }

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => { setRequests(d); setLoading(false) })
    fetch("/api/users/claim-directory").then(r => r.json()).then(d => setClaimDir(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // TEST documents (admin test uploads) are hidden from everyone except ADMIN in browse views.
  const buRequests = requests.filter(r => requestInBu(r, activeBu) && (!r.isTest || role === "ADMIN"))

  const allRows = buRequests.flatMap(r =>
    (r.items || []).map((item: any) => ({ ...item, request: r }))
  )

  // EA amounts are stored in USD (est = gross × USD rate); every other BU in THB. Just label the unit.
  const isEaBu = activeBu === "EA"
  const money = (v: number, _req?: any) => `${fmtNum(v || 0)} ${isEaBu ? "USD" : "THB"}`

  // ── Stage helpers — shared by the Pending-by-Stage tiles AND the Stage filter. President
  // moved to the END (final approver, after Logistics ∥ Claim). ──
  const POSITIONS = activeBu === "GW" ? [
    { key: "PENDING_VP_MER_GW", label: "DPM" },
    { key: "PENDING_GM_GW", label: "GM" },
    { key: "PENDING_LOGISTICS_GW", label: "LOGISTICS" },
    { key: "PENDING_CLAIM_GW", label: "CLAIM" },
    { key: "PENDING_PRESIDENT_GW", label: "PRESIDENT" },
  ] : [
    { key: "PENDING_DVM_MER", label: "DVM Merchandise" },
    { key: "PENDING_VP_MER", label: "VP Merchandise" },
    { key: "PENDING_SCM", label: "SCM" },
    { key: "PENDING_VP_SCM", label: "VP SCM" },
    { key: "PENDING_LOGISTICS", label: "LOGISTICS" },
    { key: "PENDING_CLAIM", label: "CLAIM" },
    { key: "PENDING_PRESIDENT", label: "PRESIDENT" },
  ]
  const KEY_LABEL: Record<string, string> = Object.fromEntries(POSITIONS.map(p => [p.key, p.label]))
  const ITEM_TO_STEP: Record<string, string> = activeBu === "GW" ? {
    PRES_PASSED: "PENDING_LOGISTICS_GW", LOG_PASSED: "PENDING_CLAIM_GW",
    SCM_GW_PENDING: "PENDING_SCM_GW", PRESIDENT_PENDING: "PENDING_PRESIDENT_GW",
  } : {
    DVM_MER_PASSED: "PENDING_VP_MER", VP_MER_PASSED: "PENDING_SCM", PASSED: "PENDING_VP_SCM",
    VP_PASSED: "PENDING_LOGISTICS", PRES_PASSED: "PENDING_LOGISTICS", LOG_PASSED: "PENDING_CLAIM",
    PRESIDENT_PENDING: "PENDING_PRESIDENT", CLAIM_PASSED: "PENDING_CLAIM",
  }
  // The stage key(s) an SO row currently sits at (GW's parallel PRES_PASSED can be BOTH LG + Claim).
  const rowStageKeys = (row: any): string[] => {
    const st = row.itemStatus
    if (st === "REJECTED" || st === "COMPLETED" || st === "ACCOUNTING_PENDING") return []
    if (activeBu === "GW" && st === "PRES_PASSED" && row.request.status === "PENDING_CLAIM_GW") {
      const keys: string[] = []
      if (row.actualAirFreight == null) keys.push("PENDING_LOGISTICS_GW")
      if (getSplits(row).some((s: any) => s.status !== "DEPT_APPROVED" && s.status !== "REJECTED")) keys.push("PENDING_CLAIM_GW")
      return keys
    }
    if (st === "PENDING") {
      const s = row.request.status
      const key = activeBu === "GW" ? s
        : s === "PENDING_DVM_MER_EA" || s === "PENDING_DVM_MER_TRM" ? "PENDING_DVM_MER"
        : s === "PENDING_VP_MER_EA" || s === "PENDING_VP_MER_TRM" ? "PENDING_VP_MER"
        : s
      return [key]
    }
    const k = ITEM_TO_STEP[st]
    const keys = k ? [k] : []
    // NYG/EA/TRM: LG runs PARALLEL with Claim — a claim-phase SO whose LG isn't sent yet is ALSO at
    // Logistics (same rule as the LOGISTICS tile), so the Stage filter matches the tile count.
    if (activeBu !== "GW" && !row.request.logisticsSent
      && ["PENDING_PRESIDENT", "PENDING_CLAIM", "PENDING_VP_CLAIM"].includes(row.request.status)
      && !keys.includes("PENDING_LOGISTICS")) keys.push("PENDING_LOGISTICS")
    return keys
  }
  // Which claim department(s) an SO is still waiting on — for the "Claim: <dept>" sub-filter.
  const rowClaimDepts = (row: any): string[] => {
    const depts = getSplits(row).map((s: any) => s.dept).filter(Boolean)
    return depts.length ? depts : (row.claimDepartment ? [row.claimDepartment] : [])
  }

  const applyFilters = (rows: any[], opts: {
    brand?: string[], style?: string[], so?: string[], cp?: string[],
    port?: string[], country?: string[], claim?: string[], invoice?: string[], hawb?: string[], stage?: string[]
  }) => rows.filter(row => {
    const r = row.request
    const statusMatch = !statusFilter.length || statusFilter.some(s =>
      (s === "COMPLETED" && row.itemStatus === "COMPLETED") ||
      (s === "REJECTED" && row.itemStatus === "REJECTED") ||
      (s === "PENDING" && row.itemStatus !== "COMPLETED" && row.itemStatus !== "REJECTED")
    )
    const stageMatch = !opts.stage?.length || (() => {
      const keys = rowStageKeys(row)
      if (keys.some(k => opts.stage!.includes(KEY_LABEL[k]))) return true
      // Claim sub-filter: "Claim: <dept>" matches a claim-stage SO waiting on that dept.
      if (keys.includes("PENDING_CLAIM") || keys.includes("PENDING_CLAIM_GW"))
        return rowClaimDepts(row).some(d => opts.stage!.includes(`Claim: ${d}`))
      return false
    })()
    return statusMatch && stageMatch &&
      (!opts.brand?.length || opts.brand.includes(r.brandName)) &&
      (!opts.style?.length || opts.style.includes(row.style)) &&
      (!opts.so?.length || opts.so.includes(row.so)) &&
      (!opts.cp?.length || opts.cp.includes(row.customerPO)) &&
      (!opts.port?.length || opts.port.includes(row.port)) &&
      (!opts.country?.length || opts.country.includes(row.country)) &&
      (!opts.claim?.length || getSplits(row).some((s: any) => opts.claim!.includes(s.dept)) || opts.claim.includes(row.claimDepartment)) &&
      (!opts.invoice?.length || opts.invoice.includes(row.invoiceNo)) &&
      (!opts.hawb?.length || opts.hawb.includes(row.hawbNo))
  })
  const uniq = (arr: (string | null | undefined)[]) => [...new Set(arr.filter(Boolean) as string[])].sort()

  // Cascading options: each dropdown shows options available given all OTHER active filters
  const brands   = uniq(allRows.map(r => r.request.brandName))
  const styles   = uniq(applyFilters(allRows, { brand: brandF, so: soF, cp: cpF, port: portF, country: countryF, claim: claimF, invoice: invoiceF }).map(r => r.style))
  const sos      = uniq(applyFilters(allRows, { brand: brandF, style: styleF, cp: cpF, port: portF, country: countryF, claim: claimF, invoice: invoiceF }).map(r => r.so))
  const cps      = uniq(applyFilters(allRows, { brand: brandF, style: styleF, so: soF, port: portF, country: countryF, claim: claimF, invoice: invoiceF }).map(r => r.customerPO))
  const ports    = uniq(applyFilters(allRows, { brand: brandF, style: styleF, so: soF, cp: cpF, country: countryF, claim: claimF, invoice: invoiceF }).map(r => r.port))
  const countries = uniq(applyFilters(allRows, { brand: brandF, style: styleF, so: soF, cp: cpF, port: portF, claim: claimF, invoice: invoiceF }).map(r => r.country))
  const invoices = uniq(applyFilters(allRows, { brand: brandF, style: styleF, so: soF, cp: cpF, port: portF, country: countryF, claim: claimF }).map(r => r.invoiceNo))
  const hawbs    = uniq(applyFilters(allRows, { brand: brandF, style: styleF, so: soF, cp: cpF, port: portF, country: countryF, claim: claimF, invoice: invoiceF }).map(r => r.hawbNo))

  const filtered = applyFilters(allRows, { brand: brandF, style: styleF, so: soF, cp: cpF, port: portF, country: countryF, claim: claimF, invoice: invoiceF, hawb: hawbF, stage: stageF })
  // Stage filter options: the pipeline stages + a "Claim: <dept>" sub-option per claim department.
  const claimDeptOpts = activeBu === "GW" ? ["SCM NYK", "SCM NYG", "GW", "SUPPLIER"] : ["COMMERCIAL", "PROCUREMENT", "NYK", "PRODUCTION"]
  const stageOptions = [...POSITIONS.map(p => p.label), ...claimDeptOpts.map(d => `Claim: ${d}`)]

  const docGroups = buRequests.map(req => {
    const reqRows = filtered.filter(row => row.request.id === req.id)
    if (!reqRows.length) return null
    const styleMap: Record<string, any[]> = {}
    for (const row of reqRows) {
      const s = row.style || "(no style)"
      if (!styleMap[s]) styleMap[s] = []
      styleMap[s].push(row)
    }
    const estTotal = reqRows.reduce((s: number, r: any) => s + (r.airFreight || 0), 0)
    const actTotal = reqRows.reduce((s: number, r: any) => s + (r.actualAirFreight || 0), 0)
    return { request: req, styles: Object.entries(styleMap).map(([style, rows]) => ({ style, rows })), total: reqRows.length, estTotal, actTotal }
  }).filter(Boolean) as { request: any, styles: { style: string, rows: any[] }[], total: number, estTotal: number, actTotal: number }[]

  const toggleDoc = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleStyle = (k: string) => setExpandedStyles(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const deleteRequest = async (reqId: string) => {
    if (!confirm("Delete this request?")) return
    const res = await fetch(`/api/requests/${reqId}`, { method: "DELETE" })
    if (res.ok) setRequests(prev => prev.filter(r => r.id !== reqId))
  }

  const curUnit = isEaBu ? "USD" : "THB"
  const SO_COLS = [
    ["SO",""],["BU",""],["CUSTOMER PO",""],["ORIG. DATE","min-w-[90px]"],["PLAN DATE","min-w-[90px]"],
    ["QTY ORIG",""],["QTY AIR",""],["GROSS WEIGHT (KG)","min-w-[110px]"],
    [`EST. AIR FREIGHT (${curUnit})`,"min-w-[120px]"],[`ACTUAL AIR FREIGHT (${curUnit})`,"min-w-[130px]"],
    ["FACTORY",""],["COUNTRY",""],["CLAIM DEPT","min-w-[100px]"],["INVOICE NO","min-w-[100px]"],
    ["SO STATUS","min-w-[90px]"],["CURRENT STEP","min-w-[110px]"]
  ] as [string,string][]

  const [claimExpanded, setClaimExpanded] = useState(false)

  // CLAIM box breakdown = who each pending SO is still waiting on.
  const claimByDept: Record<string, number> = {}
  for (const r of allRows) {
    const st = r.itemStatus
    if (st === "REJECTED" || st === "COMPLETED") continue
    if (activeBu === "GW") {
      // Parallel stage: count each split still awaiting approval (per dept).
      if (st !== "PRES_PASSED" && st !== "LOG_PASSED") continue
      getSplits(r).forEach((s: any) => {
        if (s.status !== "DEPT_APPROVED" && s.status !== "REJECTED") {
          claimByDept[s.dept] = (claimByDept[s.dept] || 0) + 1
        }
      })
    } else {
      if (st !== "LOG_PASSED") continue
      const dept = r.claimDepartment || r.request?.claimDepartment || "Unassigned"
      claimByDept[dept] = (claimByDept[dept] || 0) + 1
    }
  }

  // President is the final approver — once approved, the SO is at Accounting (a
  // terminal notify step), so count it as done, not pending.
  const DONE_ST = (s: string) => s === "COMPLETED" || s === "ACCOUNTING_PENDING"
  // Count tiles follow the active filters (use `filtered`, not `allRows`) so the numbers
  // match what's shown below when a filter is applied.
  const totalCompleted = filtered.filter(r => DONE_ST(r.itemStatus)).length
  const totalRejected = filtered.filter(r => r.itemStatus === "REJECTED").length
  const totalPending = filtered.filter(r => !DONE_ST(r.itemStatus) && r.itemStatus !== "REJECTED").length

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">AIR REQUESTS</h1>
          {showBuToggle ? (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              {buTabs.map(bu => (
                <button key={bu} onClick={() => setActiveBu(bu)}
                  className={`px-4 py-1.5 transition-colors ${activeBu === bu ? BU_META[bu].active : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {BU_META[bu].label}
                </button>
              ))}
            </div>
          ) : (
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${activeBu === "GW" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
              {activeBu}
            </span>
          )}
        </div>
        {/* Actions grouped on the right (New Request next to Import History) */}
        <div className="flex items-center gap-2">
          {(role === "MER_USER" || role === "MER_GW" || role === "MER_EA" || role === "MER_TRM" || role === "ADMIN") && (
            <Link href="/requests/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              + New Request
            </Link>
          )}
          {role === "ADMIN" && (
            <Link href="/import-history" className="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              📥 Import History
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="border rounded-xl p-3 sm:p-4 bg-green-50 border-green-200 flex items-center gap-2 sm:gap-4">
          <div className="text-2xl sm:text-3xl font-bold text-green-600">{totalCompleted}</div>
          <div><div className="text-xs sm:text-sm font-semibold text-green-700">COMPLETED</div><div className="text-xs text-green-500">transactions</div></div>
        </div>
        <div className="border rounded-xl p-3 sm:p-4 bg-yellow-50 border-yellow-200 flex items-center gap-2 sm:gap-4">
          <div className="text-2xl sm:text-3xl font-bold text-yellow-600">{totalPending}</div>
          <div><div className="text-xs sm:text-sm font-semibold text-yellow-700">PENDING</div><div className="text-xs text-yellow-500">transactions</div></div>
        </div>
        <div className="border rounded-xl p-3 sm:p-4 bg-red-50 border-red-200 flex items-center gap-2 sm:gap-4">
          <div className="text-2xl sm:text-3xl font-bold text-red-600">{totalRejected}</div>
          <div><div className="text-xs sm:text-sm font-semibold text-red-700">REJECTED</div><div className="text-xs text-red-500">transactions</div></div>
        </div>
      </div>

      <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Pending by Stage</span>
        <div className="flex-1 border-t border-blue-100"></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${POSITIONS.length}, minmax(0,1fr))` }}>
        {POSITIONS.map(({ key, label }) => {
          const ITEM_TO_STEP: Record<string, string> = activeBu === "GW" ? {
            PRES_PASSED: "PENDING_LOGISTICS_GW",
            LOG_PASSED: "PENDING_CLAIM_GW",
            SCM_GW_PENDING: "PENDING_SCM_GW",
            PRESIDENT_PENDING: "PENDING_PRESIDENT_GW", // claim + LG done → President (final)
          } : {
            DVM_MER_PASSED: "PENDING_VP_MER", // DVM approved → now at VP Merchandise
            VP_MER_PASSED: "PENDING_SCM",
            PASSED: "PENDING_VP_SCM",
            VP_PASSED: "PENDING_LOGISTICS",
            PRES_PASSED: "PENDING_LOGISTICS",
            LOG_PASSED: "PENDING_CLAIM",
            PRESIDENT_PENDING: "PENDING_PRESIDENT", // claim + LG done → President (final)
            CLAIM_PASSED: "PENDING_CLAIM",
          }
          const count = filtered.filter(r => {
            const st = r.itemStatus
            // Done (Completed / President-approved → Accounting) never counts in a pending stage.
            if (st === "REJECTED" || st === "COMPLETED" || st === "ACCOUNTING_PENDING") return false
            // GW parallel stage (PRES_PASSED): an SO waits on LG and/or Claim, so it
            // is counted under BOTH boxes for whichever side is still outstanding.
            if (activeBu === "GW" && st === "PRES_PASSED" && r.request.status === "PENDING_CLAIM_GW") {
              if (key === "PENDING_LOGISTICS_GW") return r.actualAirFreight == null
              if (key === "PENDING_CLAIM_GW") return getSplits(r).some((s: any) => s.status !== "DEPT_APPROVED" && s.status !== "REJECTED")
              return false
            }
            // NYG/EA/TRM: LG runs PARALLEL with Claim. An SO in the claim/president window whose LG
            // isn't sent yet is still "waiting on Logistics" (the chain shows it) → count it under
            // LOGISTICS too, in ADDITION to its claim stage (same rule as the LG queue visibility).
            if (activeBu !== "GW" && key === "PENDING_LOGISTICS") {
              return !r.request.logisticsSent && ["PENDING_PRESIDENT", "PENDING_CLAIM", "PENDING_VP_CLAIM"].includes(r.request.status)
            }
            let step: string | undefined
            if (st === "PENDING") {
              // A PENDING item's stage IS the document's current status. Map EA merch
              // statuses onto the shared NYG bucket keys.
              step = activeBu === "GW"
                ? r.request.status // PENDING_VP_MER_GW / PENDING_GM_GW / PENDING_PRESIDENT_GW
                : r.request.status === "PENDING_DVM_MER_EA" ? "PENDING_DVM_MER"
                : r.request.status === "PENDING_VP_MER_EA" ? "PENDING_VP_MER"
                : r.request.status === "PENDING_DVM_MER_TRM" ? "PENDING_DVM_MER"
                : r.request.status === "PENDING_VP_MER_TRM" ? "PENDING_VP_MER"
                : r.request.status
            } else {
              step = ITEM_TO_STEP[st]
            }
            return step === key
          }).length
          const isClaim = key === "PENDING_CLAIM" || key === "PENDING_CLAIM_GW"
          return (
            <div key={key} className={`border rounded-xl p-3 sm:p-4 border-blue-200 bg-blue-50 ${isClaim ? "cursor-pointer" : ""}`}
              onClick={() => isClaim && setClaimExpanded(p => !p)}>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{count}</div>
              <div className="text-[10px] sm:text-xs font-semibold mt-0.5 flex items-center gap-1 text-blue-700">
                {label} {isClaim && <span className="text-xs">{claimExpanded ? "▲" : "▼"}</span>}
              </div>
              {isClaim && claimExpanded && count > 0 && (
                <div className="mt-2 space-y-1 border-t border-blue-200 pt-2">
                  {Object.entries(claimByDept).map(([dept, n]) => (
                    <div key={dept} className="flex justify-between text-xs">
                      <span className="text-blue-600">{deptLabel(dept)}</span>
                      <span className="font-semibold text-blue-700">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500">FILTERS</p>
          {!!(stageF.length || statusFilter.length || brandF.length || styleF.length || soF.length || cpF.length || portF.length || countryF.length || claimF.length || invoiceF.length || hawbF.length) && (
            <button onClick={() => { setStageF([]); setStatusFilter([]); setBrandF([]); setStyleF([]); setSoF([]); setCpF([]); setPortF([]); setCountryF([]); setClaimF([]); setInvoiceF([]); setHawbF([]) }}
              className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 font-medium">
              Clear All
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-1.5">
          <MultiSelect label="All Stage" options={stageOptions} value={stageF} onChange={setStageF} />
          <MultiSelect label="All Status" options={["COMPLETED","PENDING","REJECTED"]} value={statusFilter} onChange={setStatusFilter} />
          <MultiSelect label="All Brand" options={brands} value={brandF} onChange={setBrandF} />
          <MultiSelect label="All Style" options={styles} value={styleF} onChange={setStyleF} />
          <MultiSelect label="SO..." options={sos} value={soF} onChange={setSoF} />
          <MultiSelect label="Customer PO..." options={cps} value={cpF} onChange={setCpF} />
          <MultiSelect label="All Country" options={countries} value={countryF} onChange={setCountryF} />
          <MultiSelect label="Claim Dept" options={activeBu === "GW" ? ["SCM NYK","SCM NYG","GW","SUPPLIER"] : ["COMMERCIAL","PROCUREMENT","NYK","PRODUCTION"]} value={claimF} onChange={setClaimF} />
          <MultiSelect label="Invoice No..." options={invoices} value={invoiceF} onChange={setInvoiceF} />
          <MultiSelect label="HAWB#..." options={hawbs} value={hawbF} onChange={setHawbF} />
        </div>
      </div>

      <div className="space-y-3">
        {loading && <div className="bg-white rounded-xl border p-10 text-center text-gray-400">Loading...</div>}
        {!loading && docGroups.length === 0 && (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No results found</div>
        )}
        {!loading && docGroups.map(dg => {
          const isDocExp = expanded.has(dg.request.id)
          return (
            <div key={dg.request.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Document header */}
              <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 cursor-pointer hover:bg-gray-50 select-none bg-gray-50 border-b border-gray-100 min-w-0" onClick={() => toggleDoc(dg.request.id)}>
                <span className="text-gray-400 text-xs w-4 shrink-0">{isDocExp ? "▼" : "▶"}</span>
                <Link href={`/requests/${dg.request.id}`} onClick={e => e.stopPropagation()}
                  className="font-bold text-blue-700 hover:underline text-sm shrink-0">{dg.request.documentNo}</Link>
                <AggBadge rows={dg.styles.flatMap((s: any) => s.rows)} />
                <span className="text-xs text-gray-500 truncate shrink-0">{dg.request.bu || dg.request.buName}</span>
                {(dg.request.createdBy?.name || dg.request.createdBy?.email) && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" title="Uploaded by / Requested by">
                    👤 {dg.request.createdBy.name || dg.request.createdBy.email}
                  </span>
                )}
                {dg.request.createdAt && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" title="วันที่สร้างเอกสาร">
                    📅 {new Date(dg.request.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
                {dg.request.status === "REJECTED" && dg.request.approvalLogs?.[0] && (
                  <span className="text-xs text-red-500 shrink-0">by {dg.request.approvalLogs[0].user?.name}</span>
                )}
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ml-auto">EST {money(dg.estTotal, dg.request)}</span>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">ACT {money(dg.actTotal, dg.request)}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{dg.styles.length} style(s) · {dg.total} transactions</span>
                {(() => {
                  // Collapse multiple attachment chips → first file + "+N" so the row stays on ONE line.
                  const atts = (dg.request.attachments || []).filter((a: any) => ["MER_USER","MER_GW","MER_EA","MER_TRM","VP_MER","ADMIN"].includes(a.uploadedBy?.role) && !["INV","AWB","EXPENSE","COMBINE"].includes(a.category))
                  if (!atts.length) return null
                  const first = atts[0]
                  return (
                    <>
                      <a href={`/api/attachments/${first.id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        title={first.fileName}
                        className="flex items-center gap-1 text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-medium shrink-0 max-w-[130px] hover:bg-orange-100">
                        <span className="shrink-0">📎</span><span className="truncate">{first.fileName}</span>
                      </a>
                      {atts.length > 1 && (
                        <Link href={`/requests/${dg.request.id}`} onClick={e => e.stopPropagation()}
                          title={atts.slice(1).map((a: any) => a.fileName).join("\n")}
                          className="text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-medium shrink-0 hover:bg-orange-100 whitespace-nowrap">
                          +{atts.length - 1}
                        </Link>
                      )}
                    </>
                  )
                })()}
                {canRecallDoc(dg.request) && (
                  <button onClick={e => { e.stopPropagation(); setRecallDoc(dg.request); setRecallReason("") }}
                    className="text-[11px] text-purple-700 border border-purple-300 px-2 py-0.5 rounded-full hover:bg-purple-50 font-medium shrink-0 whitespace-nowrap">
                    ↩ Recall
                  </button>
                )}
              </div>

              {/* Style groups */}
              {isDocExp && (
                <div className="divide-y divide-gray-100">
                  {dg.styles.map(sg => {
                    const styleKey = `${dg.request.id}||${sg.style}`
                    const isStyleExp = expandedStyles.has(styleKey)
                    return (
                      <div key={styleKey}>
                        <div className="flex items-center gap-3 px-6 py-2.5 cursor-pointer hover:bg-blue-50/30 select-none" onClick={() => toggleStyle(styleKey)}>
                          <span className="text-gray-300 text-xs w-4">{isStyleExp ? "▼" : "▶"}</span>
                          <span className="font-semibold text-gray-700 text-sm">{sg.style}</span>
                          <AggBadge rows={sg.rows} />
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sg.rows.length} transactions</span>
                        </div>
                        {isStyleExp && (
                          <div className="overflow-x-auto border-t border-gray-50">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>{SO_COLS.filter(([h]) => !(dg.request.bu === "GW" && h === "SCM FILE")).map(([h, w]) =>
                                  <th key={h} className={`px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap ${w}`}>{h}</th>
                                )}</tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {sg.rows.map((row: any) => (
                                  <Fragment key={row.id}>
                                  <tr className={`hover:bg-blue-50/30 ${row.itemStatus === "REJECTED" ? "opacity-50" : ""}`}>
                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{row.so}</td>
                                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-600">{row.request.bu || row.request.buName || "-"}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{row.customerPO || "-"}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(row.originalShipmentDate)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(row.planShipmentDate)}</td>
                                    <td className="px-3 py-2">{row.qtyOriginalShipment}</td>
                                    <td className="px-3 py-2 font-semibold">{row.qtyRequestAir}</td>
                                    <td className="px-3 py-2 text-blue-700">{fmtNum(row.grossWeight, 2)}</td>
                                    <td className="px-3 py-2 text-blue-700">{fmtNum(row.airFreight)}</td>
                                    <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(row.actualAirFreight)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{row.factory}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{row.country}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      {getSplits(row).length > 0
                                        ? getSplits(row).map((s: any) => `${deptLabel(s.dept)}${s.pct != null ? ` ${s.pct}%` : ""}`).join(" · ")
                                        : "-"}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">{row.invoiceNo || "-"}</td>
                                    <td className="px-3 py-2"><SoBadge s={row.itemStatus} docStatus={row.request.status} /></td>
                                    <td className="px-3 py-2"><CurrentStepBadge row={row} /></td>
                                  </tr>
                                  <tr className="bg-gray-50/40">
                                    <td colSpan={20} className="px-6 py-1.5">
                                      <ApprovalChain status={row.request.status} bu={dg.request.bu || "NYG"} soItem={row} claimForwards={dg.request.claimForwards} approvers={claimDir} req={dg.request} sm />
                                    </td>
                                  </tr>
                                  </Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400">{docGroups.length} document(s) · {filtered.length} transactions</p>

      {/* Recall — reason modal (from the list) */}
      {recallDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !recalling && setRecallDoc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Recall document</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">{recallDoc.documentNo}</h2>
              <p className="text-xs text-gray-500 mt-1">ดึงเอกสารกลับมาที่ Merchandise เพื่อแก้ไข แล้ว Re-submit ใหม่ — คนที่ถือเอกสารอยู่จะได้รับการแจ้งเตือน</p>
              {["COMPLETED", "REJECTED"].includes(recallDoc.status) && (
                <p className="text-[11px] text-red-600 font-medium mt-2 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                  ⚠ เอกสารนี้{recallDoc.status === "COMPLETED" ? "เสร็จแล้ว" : "ถูก reject"} — recall จะรีเซ็ตข้อมูล claim / logistics / actual แล้วเริ่ม flow ใหม่
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">เหตุผล (optional)</label>
              <textarea value={recallReason} onChange={e => setRecallReason(e.target.value)} rows={3} disabled={recalling}
                placeholder="ระบุเหตุผลการ recall (จะแสดงในเมลแจ้งเตือน)..."
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRecallDoc(null)} disabled={recalling}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">ยกเลิก</button>
              <button onClick={doRecall} disabled={recalling}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                {recalling ? "กำลัง Recall..." : "↩ Confirm Recall"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
