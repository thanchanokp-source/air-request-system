"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { StatusBadge } from "@/components/ui/status-badge"
import Link from "next/link"
import { CLAIM_VP_ROLES } from "@/types"
import { MultiSelect } from "@/components/ui/multi-select"
import { getSplits, gwDeptsForRole, hasPendingGwSplit, hasApprovableGwSplit, splitAirCost, actingClaimForSO, deptSplitStatus, itemHasReassignSplit, vpProdGroup, prodGroupCovers } from "@/lib/claim"
import { roleBu, requestInBu, BU_META, BUS } from "@/lib/bu"
import { ClaimSplitBadges } from "@/components/ClaimSplits"

const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

export default function ApprovalsPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const userEmail = session?.user?.email || ""
  const userId = (session?.user as any)?.id || ""
  const isGwRole = ["VP_MER_GW", "DPM_GW", "GM_GW", "PRESIDENT_GW", "LOGISTICS_GW", "CLAIM_GW", "SCM_NYK_APPROVER", "SCM_NYK_EVP", "SCM_NYK", "SCM_NYG", "ACCOUNTING"].includes(role)
  const claimDeptOptions = isGwRole ? ["SCM NYK", "SCM NYG", "GW", "SUPPLIER"] : ["COMMERCIAL", "PROCUREMENT", "NYK", "PRODUCTION"]
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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
  const [personQ, setPersonQ] = useState("")
  const [buApprovalView, setBuApprovalView] = useState<string>("ALL")
  // Doc-level stage label (for the Stage filter). SCM + VP SCM share PENDING_SCM; LG ∥ Claim shared.
  const docStageLabel = (r: any): string => {
    const s = r.status
    if (["PENDING_DVM_MER", "PENDING_DVM_MER_EA", "PENDING_DVM_MER_TRM", "PENDING_MER", "PENDING_MER_GW"].includes(s)) return "PENDING_MER"
    if (["PENDING_VP_MER", "PENDING_VP_MER_EA", "PENDING_VP_MER_TRM", "PENDING_VP_MER_GW", "PENDING_DPM_GW"].includes(s)) return "PENDING_VP_MER"
    if (s === "PENDING_GM_GW") return "PENDING_GM_GW"
    if (s === "PENDING_SCM") return "PENDING_SCM/VP_SCM"
    if (s === "PENDING_VP_SCM") return "PENDING_VP_SCM"
    if (["PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_CLAIM_GW", "PENDING_LOGISTICS", "PENDING_LOGISTICS_GW"].includes(s)) return "PENDING_LG_BOOKING/CLAIM"
    if (["PENDING_PRESIDENT", "PENDING_PRESIDENT_GW"].includes(s)) return "PENDING_PRESIDENT"
    if (s === "PENDING_ACCOUNTING") return "PENDING_ACCOUNTING"
    return s
  }

  const [approverDir, setApproverDir] = useState<any[]>([]) // role→people, for the admin person-search
  useEffect(() => {
    fetch("/api/requests?mine=true").then(r => r.json()).then(d => { setRequests(d); setLoading(false) })
    fetch("/api/users/claim-directory").then(r => r.json()).then(d => setApproverDir(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])
  // Roles that are the CURRENT approver(s) at a doc's stage (for the person-search to match
  // role-based approvers — LG/SCM/President — not just the per-doc assigned people).
  const stageRolesOf = (s: string): string[] => {
    if (["PENDING_DVM_MER", "PENDING_DVM_MER_EA", "PENDING_DVM_MER_TRM"].includes(s)) return ["DVM_MER", "DVM_MER_EA", "DVM_MER_TRM"]
    if (["PENDING_VP_MER", "PENDING_VP_MER_EA", "PENDING_VP_MER_TRM"].includes(s)) return ["VP_MER", "VP_MER_EA", "VP_MER_TRM"]
    if (["PENDING_VP_MER_GW", "PENDING_DPM_GW"].includes(s)) return ["VP_MER_GW", "DPM_GW"]
    if (s === "PENDING_GM_GW") return ["GM_GW"]
    if (s === "PENDING_SCM") return ["SCM_USER", "VP_SCM"]
    if (s === "PENDING_VP_SCM") return ["VP_SCM"]
    if (["PENDING_CLAIM", "PENDING_VP_CLAIM"].includes(s)) return ["LOGISTICS", "DVM_MER", "CLAIM_PRODUCTION", "CLAIM_PROCUREMENT", "SCM_NYK_APPROVER", "SCM_NYG"]
    if (s === "PENDING_CLAIM_GW") return ["LOGISTICS_GW", "SCM_NYK_APPROVER", "SCM_NYG", "CLAIM_GW"]
    if (["PENDING_PRESIDENT", "PENDING_PRESIDENT_GW"].includes(s)) return ["PRESIDENT", "PRESIDENT_GW", "LOGISTICS", "LOGISTICS_GW"]
    return []
  }

  // Derive claim dept from role
  const claimDept = role.startsWith("DVM_") ? role.replace("DVM_", "")
    : role.startsWith("CLAIM_") ? role.replace("CLAIM_", "")
    : CLAIM_VP_ROLES.includes(role) ? role.replace("VP_", "")
    : ""
  const userClaimDept = (session?.user as any)?.claimDepartment || null
  const userBu = (session?.user as any)?.bu || null

  // Multi-role: a person may hold claim roles beyond their primary login role
  // (User.roles[]). Derive every NYG claim dept they can act on so a person who is
  // (e.g.) VP MER AND a claim approver sees the doc again at the claim step.
  const myRoles: string[] = [role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  // Which BU(s) this person's queue can span (their roles' BUs; bu==="ALL" → every BU).
  // SCM_NYK_* are shared (BOTH) → pin no BU. Approvals stays a PERSONAL queue, so admins/
  // jariya are NOT auto-granted all BUs here — only people whose roles truly span >1 BU get
  // the filter toggle. Forward-ready for TRM/EA via the central role→BU map.
  const myBuSet = new Set(myRoles.map(roleBu).filter(b => b && b !== "BOTH") as string[])
  const buTabs = (session?.user as any)?.bu === "ALL" ? [...BUS] : BUS.filter(b => myBuSet.has(b))
  const showBuToggle = buTabs.length > 1
  // Claim SO this person can act on via any held role (NYG only; GW has its own roles).
  // Forward-direction via actingClaimForSO so mapped depts work (e.g. COMMERCIAL → DVM MER
  // sees it at the entry step, VP MER at the VP step).
  const heldClaimItems = (r: any) => {
    if (r.bu === "GW") return []
    const fwds: any[] = Array.isArray(r.claimForwards) ? r.claimForwards : []
    return (r.items || []).filter((i: any) => {
      if (["REJECTED", "COMPLETED", "ACCOUNTING_PENDING"].includes(i.itemStatus)) return false
      const act = actingClaimForSO(myRoles, getSplits(i).map((s: any) => s.dept))
      if (!act) return false
      // COMMERCIAL claim = the SPECIFIC merch people picked on this doc (DVM MER entry / VP MER VP),
      // not every DVM_MER/VP_MER. Scope it to the assigned person so others don't see it.
      if (act.dept === "COMMERCIAL") {
        const wantEmail = act.isVp ? r.assignedVpMer : r.assignedDvmMer
        if (wantEmail && String(wantEmail).toLowerCase() !== String(userEmail || "").toLowerCase()) return false
      }
      // Check the SPLIT status of the dept THIS user acts on (not the whole item) — so
      // once they approve their dept, the SO drops from their queue even if OTHER depts
      // on the same SO are still pending.
      const ss = deptSplitStatus(i, act.dept)
      const statusOk = act.isVp ? ss === "CLAIM_PASSED" : (ss == null || ss === "CLAIM_PENDING")
      if (!statusOk) return false
      // Forced-position forward: if this SO was forwarded within my dept, only the CURRENT
      // holder (the latest forward's recipient) keeps it in queue — whoever forwarded it
      // away no longer sees it. Not-yet-forwarded SO stay with the entry owner.
      const mine = fwds.filter((f: any) => f.dept === act.dept && Array.isArray(f.itemIds) && f.itemIds.includes(i.id))
      if (mine.length) {
        const latest = mine.sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0))[0]
        return String(latest.nextEmail || "").toLowerCase() === String(userEmail || "").toLowerCase()
      }
      return true
    })
  }

  // SCM NYK has 2 approvers → whoever approves first "owns" the doc; hide it from
  // the OTHER approver's queue. Owner = who has ≥1 SCM_NYK_APPROVER approval on it.
  const nykOwnedByOther = (r: any) => (r.items || []).some((i: any) => (i.claimApprovals || []).some((a: any) => a.role === "SCM_NYK_APPROVER" && a.userId && a.userId !== userId))
  const nykOwnedByMe = (r: any) => (r.items || []).some((i: any) => (i.claimApprovals || []).some((a: any) => a.role === "SCM_NYK_APPROVER" && a.userId === userId))

  // Filter documents by item-status (per-style forwarding — each role acts on specific itemStatus)
  const matchesPrimary = (r: any) => {
    const items = r.items || []
    if (myRoles.includes("DVM_MER") && r.status === "PENDING_DVM_MER" && !r.pendingRate && items.some((i: any) => i.itemStatus === "PENDING")) return true
    if (myRoles.includes("VP_MER") && r.status === "PENDING_VP_MER" && !r.pendingRate && items.some((i: any) => i.itemStatus === "PENDING") && (!r.assignedVpMer || r.assignedVpMer === userEmail)) return true
    // EA top-3 approvers (same as NYG DVM/VP MER, own statuses)
    if (myRoles.includes("DVM_MER_EA") && r.status === "PENDING_DVM_MER_EA" && !r.pendingRate && items.some((i: any) => i.itemStatus === "PENDING")) return true
    if (myRoles.includes("VP_MER_EA") && r.status === "PENDING_VP_MER_EA" && !r.pendingRate && items.some((i: any) => i.itemStatus === "PENDING")) return true
    // TRM top-3 approvers (same as NYG DVM/VP MER, own statuses)
    if (myRoles.includes("DVM_MER_TRM") && r.status === "PENDING_DVM_MER_TRM" && !r.pendingRate && items.some((i: any) => i.itemStatus === "PENDING")) return true
    if (myRoles.includes("VP_MER_TRM") && r.status === "PENDING_VP_MER_TRM" && !r.pendingRate && items.some((i: any) => i.itemStatus === "PENDING")) return true
    // Match via held roles so one person can be SCM User in NYG AND another role in GW.
    if (myRoles.includes("SCM_USER")) {
      if ((r.status === "PENDING_VP_MER" && items.some((i: any) => i.itemStatus === "VP_MER_PASSED")) ||
          (r.status === "PENDING_SCM" && items.some((i: any) => i.itemStatus === "PENDING")) ||
          // A claim approver (PROCUREMENT/Sourcing) sent a split back to SCM to re-pick the dept.
          items.some((i: any) => itemHasReassignSplit(i))) return true
    }
    if (myRoles.includes("VP_SCM") && r.status === "PENDING_SCM" && items.some((i: any) => i.itemStatus === "PASSED")) return true
    // President (NYG) — FINAL approver (items at PRESIDENT_PENDING). Match via held roles
    // so one person who is President of BOTH BUs sees NYG docs here.
    if (myRoles.includes("PRESIDENT") && r.status === "PENDING_PRESIDENT") return items.some((i: any) => i.itemStatus === "PRESIDENT_PENDING")
    // LG booking work is NO LONGER shown in APPROVALS — it lives on the dedicated LG BOOKING page
    // (/logistics, grouped by brand). A Logistics person still sees APPROVALS only when they are an
    // actual approver via some OTHER role (handled by the other branches here). Admin is separate
    // (isAdminViewer above shows every in-flight doc). NYG/EA/TRM LG booking branches intentionally removed.
    if ((role.startsWith("DVM_") || role.startsWith("CLAIM_")) && !role.endsWith("_GW")) {
      return items.some((i: any) => i.itemStatus === "LOG_PASSED" && i.claimDepartment === claimDept)
    }
    if (CLAIM_VP_ROLES.includes(role)) {
      return items.some((i: any) => i.itemStatus === "CLAIM_PASSED" && i.claimDepartment === claimDept)
    }
    if ((myRoles.includes("DPM_GW") || myRoles.includes("VP_MER_GW")) && (r.status === "PENDING_VP_MER_GW" || r.status === "PENDING_DPM_GW") && !r.pendingRate && r.bu === "GW" && items.some((i: any) => i.itemStatus === "PENDING") && (!r.assignedVpMer || r.assignedVpMer === userEmail || r.status === "PENDING_DPM_GW")) return true
    if (myRoles.includes("GM_GW") && r.status === "PENDING_GM_GW" && r.bu === "GW" && items.some((i: any) => i.itemStatus === "PENDING")) return true
    // President (GW) is now the FINAL approver — items sit at PRESIDENT_PENDING
    // (claim + logistics already complete) awaiting the whole-doc approval.
    if (myRoles.includes("PRESIDENT_GW") && r.status === "PENDING_PRESIDENT_GW" && r.bu === "GW") return items.some((i: any) => i.itemStatus === "PRESIDENT_PENDING")
    // GW LG booking also moved to the LG BOOKING page — removed from APPROVALS (see NYG note above).
    // SCM NYK 3-role claim works in BOTH BU (dept "SCM NYK" in GW, "NYK" in NYG).
    // TWO approvers split work BY BRAND — both see the doc; each approves their own
    // brand's SO. An SO drops (for everyone) once ANY approver approves it. So we do NOT
    // lock the whole doc to the first approver — show while ANY SO still awaits an approver.
    if (myRoles.includes("SCM_NYK_APPROVER")) {
      const myDepts = gwDeptsForRole("SCM_NYK_APPROVER", userClaimDept)
      if (items.some((i: any) => ["PRES_PASSED", "LOG_PASSED"].includes(i.itemStatus) && hasApprovableGwSplit(i, myDepts))) return true
    }
    // CR user: once they've entered the CR NO for the doc, their job is done → drop it.
    if (myRoles.includes("SCM_NYK") && !r.crNo) {
      const myDepts = gwDeptsForRole("SCM_NYK", userClaimDept)
      if (items.some((i: any) => ["PRES_PASSED", "LOG_PASSED"].includes(i.itemStatus) && hasPendingGwSplit(i, myDepts))) return true
    }
    // EVP: drops once they've approved the NYK split (even if CR still pending).
    if (myRoles.includes("SCM_NYK_EVP")) {
      const myDepts = gwDeptsForRole("SCM_NYK_EVP", userClaimDept)
      if (items.some((i: any) => ["PRES_PASSED", "LOG_PASSED"].includes(i.itemStatus) && hasPendingGwSplit(i, myDepts)
        && !(i.claimApprovals || []).some((a: any) => a.role === "SCM_NYK_EVP"))) return true
    }
    // CLAIM_GW / SCM_NYG are GW-only claim roles. Match via held roles so a person who is
    // (e.g.) SCM User in NYG can ALSO be Claim-SCM NYG in GW on the same account.
    const gwClaimRole = myRoles.find((rr: string) => rr === "CLAIM_GW" || rr === "SCM_NYG")
    if (gwClaimRole) {
      const myDepts = gwDeptsForRole(gwClaimRole, userClaimDept)
      if (r.bu === "GW" && items.some((i: any) => ["PRES_PASSED", "LOG_PASSED"].includes(i.itemStatus) && hasPendingGwSplit(i, myDepts))) return true
    }
    // MER GW: a claim dept sent an SO back → MER must re-select the claim dept + resubmit.
    if (role === "MER_GW") return r.bu === "GW" && items.some((i: any) => i.itemStatus === "CLAIM_REJECT_GW")
    return false
  }
  // Forced-position forward recipient (logged in via a ClaimForward magic link →
  // role CLAIM_NEXT_APPROVER, session email = the recipient's real email). Show the
  // SO forwarded TO them that still await their action, scoped by email match.
  const myClaimToken = (session?.user as any)?.claimNextToken || null
  const claimNextItems = (r: any) => {
    if (role !== "CLAIM_NEXT_APPROVER") return []
    const fwds: any[] = Array.isArray(r.claimForwards) ? r.claimForwards : []
    const mine = fwds.filter((f: any) => String(f.nextEmail || "").toLowerCase() === String(userEmail || "").toLowerCase())
    if (!mine.length) return []
    const myIds = new Set<string>(mine.flatMap((f: any) => Array.isArray(f.itemIds) ? f.itemIds : []))
    // Empty itemIds across my rows = whole-department scope (legacy rows stored []).
    const wholeDept = myIds.size === 0
    const dept = (session?.user as any)?.claimDepartment || null
    return (r.items || []).filter((i: any) => {
      if (["REJECTED", "COMPLETED", "ACCOUNTING_PENDING"].includes(i.itemStatus)) return false
      if (!wholeDept && !myIds.has(i.id)) return false
      if (!dept) return !wholeDept
      const onDept = getSplits(i).some((s: any) => s.dept === dept)
      if (wholeDept && !onDept) return false
      const ss = deptSplitStatus(i, dept)
      return ss == null || ss === "CLAIM_PENDING" || ss === "CLAIM_PASSED" // not yet finalized
    })
  }

  // Show a doc only if this person can ACT on it — their primary stage matches, they own a
  // claim SO via any held role, or they're the current forward recipient.
  // EXCEPTION: ADMIN sees EVERY in-flight document (oversight) — Approvals doubles as an
  // all-docs monitor for admin, not just their personal action queue.
  const isAdminViewer = role === "ADMIN"
  const TERMINAL_ST = ["COMPLETED", "REJECTED", "DRAFT"]
  const myRequests = isAdminViewer
    ? requests.filter(r => !TERMINAL_ST.includes(r.status) && (r.items || []).some((i: any) => i.itemStatus !== "REJECTED"))
    : requests.filter(r => matchesPrimary(r) || heldClaimItems(r).length > 0 || claimNextItems(r).length > 0)

  // Show only items relevant to this role
  const primaryItems = (r: any) => {
    const items = r.items || []
    if (myRoles.includes("DVM_MER") && r.status === "PENDING_DVM_MER") return items.filter((i: any) => i.itemStatus === "PENDING")
    if (myRoles.includes("VP_MER") && r.status === "PENDING_VP_MER") return items.filter((i: any) => i.itemStatus === "PENDING")
    if (myRoles.includes("DVM_MER_EA") && r.status === "PENDING_DVM_MER_EA") return items.filter((i: any) => i.itemStatus === "PENDING")
    if (myRoles.includes("VP_MER_EA") && r.status === "PENDING_VP_MER_EA") return items.filter((i: any) => i.itemStatus === "PENDING")
    if (myRoles.includes("DVM_MER_TRM") && r.status === "PENDING_DVM_MER_TRM") return items.filter((i: any) => i.itemStatus === "PENDING")
    if (myRoles.includes("VP_MER_TRM") && r.status === "PENDING_VP_MER_TRM") return items.filter((i: any) => i.itemStatus === "PENDING")
    if (myRoles.includes("SCM_USER") && r.bu !== "GW" && (r.status === "PENDING_SCM" || r.status === "PENDING_VP_MER")) {
      if (r.status === "PENDING_VP_MER") return items.filter((i: any) => i.itemStatus === "VP_MER_PASSED")
      return items.filter((i: any) => i.itemStatus === "PENDING")
    }
    if (myRoles.includes("VP_SCM") && r.status === "PENDING_SCM") return items.filter((i: any) => i.itemStatus === "PASSED")
    if (myRoles.includes("PRESIDENT") || myRoles.includes("PRESIDENT_GW")) return items.filter((i: any) => i.itemStatus === "PRESIDENT_PENDING")
    if (myRoles.includes("LOGISTICS") && r.bu !== "GW") return items.filter((i: any) => i.itemStatus !== "REJECTED")
    if (myRoles.includes("LOGISTICS_TRM") && r.bu === "TRM") return items.filter((i: any) => i.itemStatus !== "REJECTED")
    if ((role.startsWith("DVM_") || role.startsWith("CLAIM_")) && !role.endsWith("_GW")) {
      return items.filter((i: any) => i.itemStatus === "LOG_PASSED" && i.claimDepartment === claimDept)
    }
    if (CLAIM_VP_ROLES.includes(role)) {
      return items.filter((i: any) => i.itemStatus === "CLAIM_PASSED" && i.claimDepartment === claimDept)
    }
    if ((myRoles.includes("DPM_GW") || myRoles.includes("VP_MER_GW")) && (r.status === "PENDING_VP_MER_GW" || r.status === "PENDING_DPM_GW")) return items.filter((i: any) => i.itemStatus === "PENDING")
    if (myRoles.includes("GM_GW") && r.status === "PENDING_GM_GW") return items.filter((i: any) => i.itemStatus === "PENDING")
    if (myRoles.includes("MER_GW") && r.bu === "GW") return items.filter((i: any) => i.itemStatus === "CLAIM_REJECT_GW")
    if (myRoles.includes("LOGISTICS_GW") && r.bu === "GW") return items.filter((i: any) => i.itemStatus === "PRES_PASSED")
    if (myRoles.includes("SCM_NYK_APPROVER")) {
      const myDepts = gwDeptsForRole("SCM_NYK_APPROVER", userClaimDept)
      return items.filter((i: any) => ["PRES_PASSED", "LOG_PASSED"].includes(i.itemStatus) && hasApprovableGwSplit(i, myDepts))
    }
    const gwClaimRoleP = myRoles.find((rr: string) => ["CLAIM_GW", "SCM_NYK", "SCM_NYK_EVP", "SCM_NYG"].includes(rr))
    if (gwClaimRoleP) {
      const myDepts = gwDeptsForRole(gwClaimRoleP, userClaimDept)
      return items.filter((i: any) => ["PRES_PASSED", "LOG_PASSED"].includes(i.itemStatus) && hasPendingGwSplit(i, myDepts))
    }
    return items.filter((i: any) => i.itemStatus !== "REJECTED")
  }

  // Union of primary-role items + claim SO owned via any held role (multi-role).
  const isProdClaimer = myRoles.includes("CLAIM_PRODUCTION") || myRoles.includes("VP_PRODUCTION")
  const getRelevantItems = (r: any) => {
    // Admin monitor: show every non-rejected SO of the doc (not scoped to a role's stage).
    if (isAdminViewer) return (r.items || []).filter((i: any) => i.itemStatus !== "REJECTED")
    const prim = primaryItems(r)
    const seen = new Set(prim.map((i: any) => i.id))
    const extra = [...heldClaimItems(r), ...claimNextItems(r)].filter((i: any) => {
      if (seen.has(i.id)) return false
      seen.add(i.id); return true
    })
    let out = [...prim, ...extra]
    // Claim-Production is scoped BY BU then FACTORY G-GROUP: NYG splits per G (rushan G1/G3,
    // pk G2/G4); EA has ONE approver (theerawee, no G-split). Show a PRODUCTION SO only if
    // this claimer's BU covers the doc's BU AND (no G on the SO → all-G approver, or the G matches).
    if (isProdClaimer) {
      out = out.filter((i: any) => {
        const onProd = i.claimDepartment === "PRODUCTION" || getSplits(i).some((s: any) => s.dept === "PRODUCTION")
        if (!onProd) return true
        if (userBu && userBu !== "ALL" && !requestInBu(r, userBu)) return false // theerawee(EA) vs rushan/pk(NYG)
        const g = vpProdGroup(i.factory)
        return !g || prodGroupCovers(userClaimDept, g)
      })
    }
    return out
  }

  const allRows = myRequests.flatMap(r =>
    getRelevantItems(r).map((item: any) => ({ ...item, request: r }))
  )

  const brands = [...new Set(allRows.map(r => r.request.brandName).filter(Boolean))].sort()
  const styles = [...new Set(allRows.map(r => r.style).filter(Boolean))].sort()
  const sos = [...new Set(allRows.map(r => r.so).filter(Boolean))].sort()
  const cps = [...new Set(allRows.map(r => r.customerPO).filter(Boolean))].sort()
  const ports = [...new Set(allRows.map(r => r.port).filter(Boolean))].sort()
  const countries = [...new Set(allRows.map(r => r.country).filter(Boolean))].sort()
  const invoices = [...new Set(allRows.map(r => r.invoiceNo).filter(Boolean))].sort()
  const hawbs = [...new Set(allRows.map(r => r.hawbNo).filter(Boolean))].sort()

  // Stage options scoped to the CURRENT BU tab (don't show GW-only stages while viewing NYG, etc.)
  const stageOptions = [...new Set(myRequests
    .filter(r => !showBuToggle || buApprovalView === "ALL" || requestInBu(r, buApprovalView))
    .map(r => docStageLabel(r)))].sort()
  const filtered = allRows.filter(row => {
    const r = row.request
    return (!stageF.length || stageF.includes(docStageLabel(r))) &&
      (!brandF.length || brandF.includes(r.brandName)) &&
      (!styleF.length || styleF.includes(row.style)) &&
      (!soF.length || soF.includes(row.so)) &&
      (!cpF.length || cpF.includes(row.customerPO)) &&
      (!portF.length || portF.includes(row.port)) &&
      (!countryF.length || countryF.includes(row.country)) &&
      (!claimF.length || getSplits(row).some((s: any) => claimF.includes(s.dept)) || claimF.includes(row.claimDepartment)) &&
      (!invoiceF.length || invoiceF.includes(row.invoiceNo)) &&
      (!hawbF.length || hawbF.includes(row.hawbNo))
  })

  // Admin person-search: find every in-flight doc that a given person is on / assigned to (creator,
  // any picked approver, or a claim-forward recipient). The doc's status badge shows WHAT is pending.
  const pq = personQ.trim().toLowerCase()
  const personMatch = (r: any) => {
    if (!pq) return true
    // 1) People explicitly on the doc (creator / assigned approver / forward recipient).
    const fields = [r.createdBy?.email, r.createdBy?.name, r.assignedDvmMer, r.assignedVpMer, r.assignedVpScm,
      (r as any).assignedScmNykEvp, (r as any).assignedScmNykCr, (r as any).lgForwardEmail, (r as any).lgForwardName,
      ...((r.claimForwards || []) as any[]).flatMap(f => [f.nextEmail, f.nextName])]
    if (fields.some(x => String(x || "").toLowerCase().includes(pq))) return true
    // 2) Role-based CURRENT approvers (LG/SCM/President/claim depts) — resolve from the directory
    // by the doc's current-stage roles + BU, so searching an LG/approver name finds their docs.
    const roles = stageRolesOf(r.status)
    if (!roles.length) return false
    const docBu = r.bu || "NYG"
    return approverDir.some((u: any) => {
      const held = [u.role, ...(Array.isArray(u.roles) ? u.roles : [])]
      if (!held.some((x: string) => roles.includes(x))) return false
      if (u.bu && u.bu !== "ALL" && u.bu !== docBu) return false // LG/merch are BU-scoped
      return String(u.name || "").toLowerCase().includes(pq) || String(u.email || "").toLowerCase().includes(pq)
    })
  }
  const docGroups = myRequests
    .filter(r => filtered.some(f => f.request.id === r.id))
    // Cross-BU person can filter the queue by BU via the toggle (ALL = both).
    .filter(r => !showBuToggle || buApprovalView === "ALL" || requestInBu(r, buApprovalView))
    .filter(personMatch)

  const isClaimRole = role === "CLAIM_GW" || role === "SCM_NYK" || role === "SCM_NYK_APPROVER" || role === "SCM_NYK_EVP" || role === "SCM_NYG"
  const myDepts = isClaimRole ? gwDeptsForRole(role, userClaimDept) : []
  // Sum of this SO's air-freight portion for the current claim role's departments.
  const myClaimForItem = (item: any) =>
    getSplits(item).filter((s: any) => myDepts.includes(s.dept)).reduce((sum: number, s: any) => sum + splitAirCost(item, s), 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">APPROVALS</h1>
            <p className="text-xs text-gray-400 mt-0.5">{docGroups.length} document(s) {isAdminViewer ? "in progress (admin view — all pending docs)" : "pending your action"}</p>
          </div>
          {showBuToggle && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold self-start">
              {["ALL", ...buTabs].map(bu => (
                <button key={bu} onClick={() => setBuApprovalView(bu)}
                  className={`px-3 py-1.5 transition-colors ${buApprovalView === bu ? (bu === "ALL" ? "bg-gray-700 text-white" : BU_META[bu].active) : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {bu === "ALL" ? "All BU" : BU_META[bu].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin-only: find every pending doc that a given person is on (assigned/creator/forward). */}
      {isAdminViewer && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500">🔎 ค้นหาว่าเอกสารค้างที่ใคร</span>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <input value={personQ} onChange={e => setPersonQ(e.target.value)} placeholder="พิมพ์ชื่อ / อีเมลของผู้อนุมัติ…"
              className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm" />
            {personQ && <button onClick={() => setPersonQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>}
          </div>
          {pq && <span className="text-xs text-gray-500">พบ <b className="text-indigo-600">{docGroups.length}</b> เอกสาร (ดู STATUS ว่าค้างขั้นไหน · กด Open เข้าไปจัดการ)</span>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500">FILTERS</p>
          {(stageF.length || brandF.length || styleF.length || soF.length || cpF.length || portF.length || countryF.length || claimF.length || invoiceF.length || hawbF.length) && (
            <button onClick={() => { setStageF([]); setBrandF([]); setStyleF([]); setSoF([]); setCpF([]); setPortF([]); setCountryF([]); setClaimF([]); setInvoiceF([]); setHawbF([]) }}
              className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 font-medium">
              Clear All
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-10 gap-1.5">
          <MultiSelect label="All Stage" options={stageOptions} value={stageF} onChange={setStageF} />
          <MultiSelect label="All Brand" options={brands} value={brandF} onChange={setBrandF} />
          <MultiSelect label="All Style" options={styles} value={styleF} onChange={setStyleF} />
          <MultiSelect label="SO..." options={sos} value={soF} onChange={setSoF} />
          <MultiSelect label="Customer PO..." options={cps} value={cpF} onChange={setCpF} />
          <MultiSelect label="All Country" options={countries} value={countryF} onChange={setCountryF} />
          <MultiSelect label="Claim Dept" options={claimDeptOptions} value={claimF} onChange={setClaimF} />
          <MultiSelect label="Invoice No..." options={invoices} value={invoiceF} onChange={setInvoiceF} />
          <MultiSelect label="HAWB#..." options={hawbs} value={hawbF} onChange={setHawbF} />
        </div>
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Loading...</div>}
      {!loading && docGroups.length === 0 && (
        <div className="text-center py-20 text-gray-400">No pending approvals</div>
      )}

      <div className="space-y-4">
        {docGroups.map(req => {
          const reqItems = filtered.filter(f => f.request.id === req.id)
          const estTotal = reqItems.reduce((s: number, i: any) => s + (i.airFreight || 0), 0)
          const actTotal = reqItems.reduce((s: number, i: any) => s + (i.actualAirFreight || 0), 0)
          // Claim amount per department across this whole document (THB).
          const deptSums: Record<string, number> = {}
          reqItems.forEach((i: any) => getSplits(i).forEach((s: any) => {
            deptSums[s.dept] = (deptSums[s.dept] || 0) + splitAirCost(i, s)
          }))
          const myDocTotal = reqItems.reduce((s: number, i: any) => s + myClaimForItem(i), 0)
          // Show a CR NO column when this doc has an NYK claim (CR is a NYK-only field).
          const hasNyk = reqItems.some((i: any) => getSplits(i).some((s: any) => s.dept === "NYK" || s.dept === "SCM NYK"))
          return (
            <div key={req.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <Link href={`/requests/${req.id}`} className="font-semibold text-blue-600 hover:underline text-sm shrink-0">{req.documentNo}</Link>
                  <span className="text-xs text-gray-500 truncate">{req.buName}</span>
                  <StatusBadge status={req.status} />
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">EST {fmtNum(estTotal)} THB</span>
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">ACT {fmtNum(actTotal)} THB</span>
                  {Object.entries(deptSums).map(([dept, sum]) => (
                    <span key={dept} className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{dept} {fmtNum(sum)} THB</span>
                  ))}
                  {isClaimRole && (
                    <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">My Claim {fmtNum(myDocTotal)} THB</span>
                  )}
                </div>
                <Link href={`/requests/${req.id}`} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium shrink-0 ml-auto">
                  Open →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>{["SO","STYLE","BRAND","SUB","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","ACTUAL AIR FREIGHT (THB)",...(isClaimRole ? ["MY CLAIM (THB)"] : []),"FACTORY","COUNTRY","CLAIM DEPT",...(hasNyk ? ["CR NO"] : []),"INVOICE NO","HAWB#","PO GARMENT"].map(h =>
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reqItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-medium">{item.so}</td>
                        <td className="px-3 py-1.5">{item.style}</td>
                        <td className="px-3 py-1.5">{item.brand || "-"}</td>
                        <td className="px-3 py-1.5">{item.sub || "-"}</td>
                        <td className="px-3 py-1.5">{item.customerPO || "-"}</td>
                        <td className="px-3 py-1.5">{item.description}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                        <td className="px-3 py-1.5">{item.qtyOriginalShipment}</td>
                        <td className="px-3 py-1.5 font-semibold">{item.qtyRequestAir}</td>
                        <td className="px-3 py-1.5 text-blue-700">{fmtNum(item.grossWeight, 2)}</td>
                        <td className="px-3 py-1.5 text-blue-700">{fmtNum(item.airFreight)}</td>
                        <td className="px-3 py-1.5 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                        {isClaimRole && <td className="px-3 py-1.5 font-bold text-red-700 whitespace-nowrap">{fmtNum(myClaimForItem(item))} THB</td>}
                        <td className="px-3 py-1.5 whitespace-nowrap">{item.factory}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{item.country}</td>
                        <td className="px-3 py-1.5"><ClaimSplitBadges item={item} showReason /></td>
                        {hasNyk && <td className="px-3 py-1.5 whitespace-nowrap font-medium text-indigo-700">{req.crNo || "-"}</td>}
                        <td className="px-3 py-1.5 whitespace-nowrap">{item.invoiceNo || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{item.hawbNo || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap font-medium text-purple-700">{item.poGarment || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
