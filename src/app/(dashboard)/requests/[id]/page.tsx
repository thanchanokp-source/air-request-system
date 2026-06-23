"use client"
import { useEffect, useState, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { StatusBadge } from "@/components/ui/status-badge"
import { ROLE_ACTIONS, STATUS_LABELS, STYLE_APPROVER_STATUSES } from "@/types"
import { PdfDownloadButton } from "@/components/pdf-download-button"

const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtDT = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

const CLAIM_DEPTS = ["COMMERCIAL", "PROCUREMENT", "NYK", "NYG", "PRODUCTION"]
const CLAIM_DEPT_LABEL: Record<string, string> = { NYK: "SCM NYK", NYG: "SCM NYG" }

export default function RequestDetailPage() {
  const { id } = useParams()
  const { data: session } = useSession()
  const router = useRouter()
  const [req, setReq] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [itemActuals, setItemActuals] = useState<Record<string, string>>({})
  const [itemLogistics, setItemLogistics] = useState<Record<string, { invoiceNo: string, bookingDate: string }>>({})
  const [logSelected, setLogSelected] = useState<Set<string>>(new Set())
  const [batchInvoice, setBatchInvoice] = useState("")
  const [batchBookingDate, setBatchBookingDate] = useState("")
  const [soClaimDepts, setSoClaimDepts] = useState<Record<string, string>>({})
  const [soDvmAssigned, setSoDvmAssigned] = useState<Record<string, string>>({})
  const [dvmUsers, setDvmUsers] = useState<Record<string, any[]>>({})
  const [soClaimSelected, setSoClaimSelected] = useState<Set<string>>(new Set())
  const [batchClaimDept, setBatchClaimDept] = useState("")
  const [batchDvm, setBatchDvm] = useState("")
  const [batchComment, setBatchComment] = useState("")
  const [soClaimComments, setSoClaimComments] = useState<Record<string, string>>({})

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set())
  const [rejectingStyle, setRejectingStyle] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState("")
  const [rejectingSo, setRejectingSo] = useState<string | null>(null)
  const [rejectSoComment, setRejectSoComment] = useState("")
  const [backToScmSo, setBackToScmSo] = useState<string | null>(null)
  const [backToScmSoComment, setBackToScmSoComment] = useState("")
  const [backToScmComment, setBackToScmComment] = useState("")
  const [backToScmStyleOpen, setBackToScmStyleOpen] = useState<string | null>(null)
  const [backToScmStyleComment, setBackToScmStyleComment] = useState("")
  const [scmStyleFilter, setScmStyleFilter] = useState("")
  const [uploadingItem, setUploadingItem] = useState<string | null>(null)
  const [dvmSelected, setDvmSelected] = useState<Set<string>>(new Set())
  const [vpSelected, setVpSelected] = useState<Set<string>>(new Set())
  const [logEditMode, setLogEditMode] = useState<Set<string>>(new Set())
  const [gwClaimDept, setGwClaimDept] = useState("")
  const [claimGwSelected, setClaimGwSelected] = useState<Set<string>>(new Set())
  const [claimApproversList, setClaimApproversList] = useState<any[]>([])
  const [recalculating, setRecalculating] = useState(false)
  const claimAutoSaveReady = useRef(false)

  // Auto-save SCM claim dept + comments to DB (debounced 1.5s)
  useEffect(() => {
    if (!claimAutoSaveReady.current || !id) return
    const deptEntries = Object.entries(soClaimDepts).filter(([, v]) => v)
    if (deptEntries.length === 0) return
    const timer = setTimeout(async () => {
      const dataToSave = Object.fromEntries(deptEntries)
      await fetch(`/api/requests/${id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_claim_progress", soClaimData: dataToSave, soClaimComments })
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [soClaimDepts, soClaimComments])

  useEffect(() => {
    const CLAIM_DEPTS_LIST = ["COMMERCIAL","PROCUREMENT","NYK","NYG","PRODUCTION"]
    Promise.all(CLAIM_DEPTS_LIST.map(dept =>
      fetch(`/api/users/by-role?role=DVM_${dept}`).then(r => r.json()).then(d => ({ dept, users: Array.isArray(d) ? d : [] }))
    )).then(results => {
      const map: Record<string, any[]> = {}
      results.forEach(({ dept, users }) => { map[dept] = users })
      setDvmUsers(map)
    })
  }, [])

   useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then(r => r.json())
      .then(d => {
        setReq(d)
        setLoading(false)
        if (d.claimDepartment) setGwClaimDept(d.claimDepartment)
        if (d.items) {
          const depts: Record<string, string> = {}
          const dvms: Record<string, string> = {}
          const comments: Record<string, string> = {}
          d.items.forEach((item: any) => {
            if (item.claimDepartment) depts[item.id] = item.claimDepartment
            if (item.assignedDvm) dvms[item.id] = item.assignedDvm
            const msg = item.reasonDelay || item.itemComment
            if (msg) comments[item.id] = msg
          })
          setSoDvmAssigned(dvms)
          claimAutoSaveReady.current = false
          setSoClaimDepts(depts)
          setSoClaimComments(comments)
          setTimeout(() => { claimAutoSaveReady.current = true }, 200)
        }
        // Pre-fill logistics data for PRES_PASSED items (and legacy PENDING at PENDING_LOGISTICS)
        const logItems = (d.items || []).filter((i: any) =>
          i.itemStatus === "PRES_PASSED" || i.itemStatus === "LOG_PASSED" ||
          (d.status === "PENDING_LOGISTICS" && i.itemStatus === "PENDING")
        )
        if (logItems.length > 0) {
          const logistics: Record<string, { invoiceNo: string; bookingDate: string }> = {}
          const actuals: Record<string, string> = {}
          logItems.forEach((item: any) => {
            if (item.invoiceNo || item.bookingDate) {
              logistics[item.id] = {
                invoiceNo: item.invoiceNo || "",
                bookingDate: item.bookingDate ? new Date(item.bookingDate).toISOString().split("T")[0] : ""
              }
            }
            if (item.actualAirFreight != null) actuals[item.id] = String(item.actualAirFreight)
          })
          if (Object.keys(logistics).length > 0) setItemLogistics(logistics)
          if (Object.keys(actuals).length > 0) setItemActuals(actuals)
        }
      })
      .catch(() => setLoading(false))
  }, [id])

  const role = (session?.user as any)?.role || ""
  const myPriority: number | null = (session?.user as any)?.priority ?? null
  const myUserId: string = (session?.user as any)?.id || ""
  const isGWRole = ["VP_MER_GW", "PRESIDENT_GW", "LOGISTICS_GW", "CLAIM_GW", "SCM_GW", "ACCOUNTING"].includes(role)
  const isGWRequest = req?.bu === "GW"

  useEffect(() => {
    if (!role) return
    const isDvm = role.startsWith("DVM_") || role.startsWith("CLAIM_")
    const isVp = ["VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION"].includes(role)
    if (isDvm || isVp) {
      const dept = isDvm ? role.replace("DVM_","").replace("CLAIM_","") : role.replace("VP_","")
      const groupRole = isDvm ? `DVM_${dept}` : `VP_${dept}`
      fetch(`/api/users/by-role?role=${groupRole}`).then(r => r.json()).then(setClaimApproversList)
    }
  }, [role])
  const canAct = req && ROLE_ACTIONS[role]?.includes(req.status) && (!isGWRole || isGWRequest)
  const isStyleApprover = req && STYLE_APPROVER_STATUSES.includes(req.status)
  const CLAIM_VP_ROLES_LOCAL = ["VP_COMMERCIAL", "VP_PROCUREMENT", "VP_NYK", "VP_PRODUCTION"]
  const claimDept = role.startsWith("DVM_") ? role.replace("DVM_", "") : role.startsWith("CLAIM_") ? role.replace("CLAIM_", "") : CLAIM_VP_ROLES_LOCAL.includes(role) ? role.replace("VP_", "") : ""
  const claimDeptRole = claimDept
  const isDvmClaim = (role.startsWith("DVM_") || role.startsWith("CLAIM_")) && (req?.items || []).some((i: any) => (i.itemStatus === "LOG_PASSED" || i.itemStatus === "CLAIM_PASSED") && i.claimDepartment === claimDept)
  const isVpClaim = CLAIM_VP_ROLES_LOCAL.includes(role) && (req?.items || []).some((i: any) => (i.itemStatus === "CLAIM_PASSED" || i.itemStatus === "COMPLETED") && i.claimDepartment === claimDept)
  const isClaimApprover = isDvmClaim || isVpClaim
  const myClaimItems = req?.items?.filter((i: any) => {
    if (!claimDept || i.claimDepartment !== claimDept) return false
    if (isDvmClaim) return i.itemStatus === "LOG_PASSED" || i.itemStatus === "CLAIM_PASSED" || i.itemStatus === "REJECTED"
    if (isVpClaim) return i.itemStatus === "CLAIM_PASSED" || i.itemStatus === "COMPLETED" || i.itemStatus === "REJECTED"
    return false
  }) || []
  const isVpScmAtScm = role === "VP_SCM" && req?.status === "PENDING_SCM"
  const isScmAtVpMer = role === "SCM_USER" && req?.status === "PENDING_VP_MER"
  const vpPassedItems = (req?.items || []).filter((i: any) => i.itemStatus === "VP_PASSED")
  const presPassedItems = (req?.items || []).filter((i: any) => i.itemStatus === "PRES_PASSED")
  const logPassedItems = (req?.items || []).filter((i: any) => i.itemStatus === "LOG_PASSED")
  const claimPassedItems = (req?.items || []).filter((i: any) => i.itemStatus === "CLAIM_PASSED")
  const isPresidentRole = role === "PRESIDENT" && vpPassedItems.length > 0
  const isLogisticsRole = role === "LOGISTICS" && presPassedItems.length > 0 && !isGWRequest
  const isVpMerGW = role === "VP_MER_GW" && req?.status === "PENDING_VP_MER_GW" && isGWRequest
  const isPresidentGW = role === "PRESIDENT_GW" && req?.status === "PENDING_PRESIDENT_GW" && isGWRequest
  const isLogisticsGW = role === "LOGISTICS_GW" && (req?.status === "PENDING_LOGISTICS_GW" || req?.status === "PENDING_PRESIDENT_GW") && presPassedItems.length > 0 && isGWRequest
  const userClaimDept = (session?.user as any)?.claimDepartment || null
  const isClaimGW = role === "CLAIM_GW" && (req?.status === "PENDING_CLAIM_GW" || req?.status === "PENDING_LOGISTICS_GW") && logPassedItems.length > 0 && isGWRequest && (!userClaimDept || req?.claimDepartment === userClaimDept)
  const scmGwItems = (req?.items || []).filter((i: any) => i.itemStatus === "SCM_GW_PENDING")
  const accountingGwItems = (req?.items || []).filter((i: any) => i.itemStatus === "ACCOUNTING_PENDING")
  const isScmGW = role === "SCM_GW" && req?.status === "PENDING_SCM_GW" && scmGwItems.length > 0 && isGWRequest
  const isAccountingGW = role === "ACCOUNTING" && req?.status === "PENDING_ACCOUNTING" && accountingGwItems.length > 0 && isGWRequest
  const isGWApprover = isVpMerGW || isPresidentGW || isLogisticsGW || isClaimGW || isScmGW || isAccountingGW
  const canReject = canAct && !isStyleApprover && !isClaimApprover && !isVpScmAtScm && !isScmAtVpMer && !isPresidentRole && !isLogisticsRole && !isGWApprover && !role.startsWith("DVM_") && !role.startsWith("CLAIM_") && !CLAIM_VP_ROLES_LOCAL.includes(role) && req.status !== "PENDING_SCM" && req.status !== "PENDING_LOGISTICS" && req.status !== "PENDING_LOGISTICS_GW"

  const styleGroups = useMemo(() => {
    if (!req?.items) return []
    const groups: Record<string, any[]> = {}
    for (const item of req.items) {
      if (!groups[item.style]) groups[item.style] = []
      groups[item.style].push(item)
    }
    return Object.entries(groups).map(([style, items]) => {
      const nonRej = items.filter((i: any) => i.itemStatus !== "REJECTED")
      const STATUS_ORDER = ["PENDING", "VP_MER_PASSED", "PASSED", "VP_PASSED", "PRES_PASSED", "LOG_PASSED", "CLAIM_PASSED", "COMPLETED"]
      const status = nonRej.length === 0 ? "REJECTED"
        : nonRej.every((i: any) => i.itemStatus === "COMPLETED") ? "COMPLETED"
        : nonRej.every((i: any) => i.itemStatus === "CLAIM_PASSED") ? "CLAIM_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "LOG_PASSED") ? "LOG_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "PRES_PASSED") ? "PRES_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "VP_PASSED") ? "VP_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "VP_MER_PASSED") ? "VP_MER_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "PASSED") ? "PASSED"
        : STATUS_ORDER[Math.min(...nonRej.map((i: any) => STATUS_ORDER.indexOf(i.itemStatus)).filter(x => x >= 0))] || "PENDING"
      const totalGross = nonRej.reduce((s: number, i: any) => s + (Number(i.grossWeight) || 0), 0)
      const totalEst = nonRej.reduce((s: number, i: any) => s + (Number(i.airFreight) || 0), 0)
      const totalActual = nonRej.reduce((s: number, i: any) => s + (Number(i.actualAirFreight) || 0), 0)
      return { style, items, status, totalGross, totalEst, totalActual }
    })
  }, [req])

  const toggleExpand = (style: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(style) ? n.delete(style) : n.add(style); return n })
  }

  const approveStyle = async (style: string) => {
    setSubmitting(style)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_style", style, comment: "" })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null)
  }

  const approveSelectedStyles = async () => {
    const toApprove = styleGroups.filter(g => (g.status === "PENDING" || g.status === "PASSED") && selectedStyles.has(g.style)).map(g => g.style)
    for (const style of toApprove) {
      setSubmitting(style)
      const res = await fetch(`/api/requests/${id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_style", style, comment: "" })
      })
      if (res.ok) setReq(await res.json())
    }
    setSubmitting(null)
    setSelectedStyles(new Set())
  }

  const rejectStyle = async (style: string) => {
    setSubmitting(style)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject_style", style, comment: rejectComment })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null); setRejectingStyle(null); setRejectComment("")
  }

  const backToScmStyleFn = async (style: string) => {
    setSubmitting(style)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "back_to_scm_style", style, comment: backToScmStyleComment })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null); setBackToScmStyleOpen(null); setBackToScmStyleComment("")
  }

  const attachFileFn = async (file: File, itemId?: string) => {
    setUploadingItem(itemId || "_req")
    try {
      const form = new FormData()
      form.append("file", file)
      if (itemId) { form.append("itemId", itemId); form.append("claimDept", claimDeptRole) }
      const res = await fetch(`/api/requests/${id}/attachments`, { method: "POST", body: form })
      if (res.ok) {
        const att = await res.json()
        setReq((prev: any) => ({ ...prev, attachments: [...(prev.attachments || []), att] }))
      } else { alert("Upload failed") }
    } finally { setUploadingItem(null) }
  }

  const act = async (action: string) => {
    setSubmitting("_")
    const body: any = { action, comment }
    if (req.status === "PENDING_SCM") {
      body.soClaimData = Object.fromEntries(
        pendingScmItems.filter((i: any) => soClaimDepts[i.id]).map((i: any) => [i.id, soClaimDepts[i.id]])
      )
      body.soClaimComments = soClaimComments
    }
    if (req.status === "PENDING_LOGISTICS" && action === "approve") {
      body.itemActuals = itemActuals
      body.itemLogistics = itemLogistics
    }
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      const updated = await res.json()
      setReq(updated)
      if ((req.status === "PENDING_SCM" || req.status === "PENDING_LOGISTICS") && action === "approve") {
        window.location.href = "/approvals"
        return
      }
    } else {
      const err = await res.json()
      alert(err.error || "Error")
    }
    setSubmitting(null); setComment("")
  }

  const approveSo = async (soItemId: string) => {
    setSubmitting(soItemId)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_so", itemId: soItemId })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null)
  }

  const rejectSo = async (soItemId: string) => {
    setSubmitting(soItemId)
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject_so", itemId: soItemId, comment: rejectSoComment })
    })
    if (res.ok) setReq(await res.json())
    setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
  }

  const saveLogistics = async () => {
    setSubmitting("log")
    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_logistics", itemActuals, itemLogistics })
    })
    if (res.ok) setReq(await res.json())
    else { const err = await res.json(); alert(err.error || "Error") }
    setSubmitting(null)
  }



  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>
  if (!req) return <div className="text-center py-20 text-gray-400">Not found</div>

  const activeItems = req.items?.filter((i: any) => i.itemStatus !== "REJECTED") || []
  const pendingScmItems = req?.status === "PENDING_SCM" ? activeItems.filter((i: any) => i.itemStatus === "PENDING") : activeItems
  const forwardedScmItems = req?.status === "PENDING_SCM" ? activeItems.filter((i: any) => i.itemStatus === "PASSED") : []
  const readyScmStyles = [...new Set(pendingScmItems.filter((i: any) => soClaimDepts[i.id]).map((i: any) => i.style as string))]
    .filter(style => pendingScmItems.filter((i: any) => i.style === style).every((i: any) => soClaimDepts[i.id]))
  const readyScmItemIds = pendingScmItems.filter((i: any) => readyScmStyles.includes(i.style)).map((i: any) => i.id as string)
  const vpMerPassedItems = req?.status === "PENDING_VP_MER" ? activeItems.filter((i: any) => i.itemStatus === "VP_MER_PASSED") : []
  const scmPassedAtVpMer = req?.status === "PENDING_VP_MER" ? activeItems.filter((i: any) => i.itemStatus === "PASSED") : []
  // Logistics items: PRES_PASSED (ready for logistics) and LOG_PASSED (already processed)
  const pendingLogItems = presPassedItems
  const forwardedLogItems = logPassedItems

  return (
    <div className="space-y-5">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[260px]">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-gray-800 text-sm">Approving...</p>
              <p className="text-xs text-gray-400 mt-1">Please do not close this page.</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{req.documentNo}</h1>
        {(() => {
          const merAtts = (req.attachments || []).filter((a: any) => ["MER_USER","VP_MER"].includes(a.uploadedBy?.role) && !a.itemId)
          if (merAtts.length > 0) {
            return merAtts.map((att: any) => (
              <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full hover:bg-orange-100 whitespace-nowrap font-medium">
                📎 {att.fileName}
              </a>
            ))
          }
          return (
            <span className="flex items-center gap-1 text-xs bg-gray-100 border border-gray-200 text-gray-400 px-2 py-0.5 rounded-full cursor-not-allowed select-none">
              📎 MER file
            </span>
          )
        })()}
        {role === "ADMIN" && (
          <button onClick={async () => {
            setRecalculating(true)
            const res = await fetch(`/api/requests/${id}/recalculate`, { method: "POST" })
            const data = await res.json()
            setRecalculating(false)
            if (res.ok) {
              const r = await fetch(`/api/requests/${id}`).then(r => r.json())
              setReq(r)
              alert(`Recalculated ${data.updated} item(s)`)
            } else {
              alert("Recalculate failed")
            }
          }} disabled={recalculating} className="ml-auto text-xs text-blue-600 border border-blue-300 px-3 py-1 rounded-lg hover:bg-blue-50 disabled:opacity-50">
            {recalculating ? "Calculating..." : "⟳ Recalculate"}
          </button>
        )}
        {((role === "MER_USER" && req.status === "PENDING_VP_MER") || (role === "MER_GW" && req.status === "PENDING_VP_MER_GW")) && (
          <button onClick={async () => {
            if (!confirm("Delete this request?")) return
            const res = await fetch(`/api/requests/${id}`, { method: "DELETE" })
            if (res.ok) router.push("/requests")
          }} className="text-sm text-red-500 border border-red-300 px-3 py-1 rounded-lg hover:text-red-700">
            Delete
          </button>
        )}
      </div>

      {/* Rejection Reason */}
      {req.rejectionReason && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="font-semibold">Rejection Reason: </span>{req.rejectionReason}
        </div>
      )}

      {/* Style Accordion */}
      {canAct && isStyleApprover && !isScmAtVpMer && !isPresidentRole && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">STYLES ({styleGroups.length})</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-4 text-xs font-medium">
                <span className="text-yellow-600">{styleGroups.filter(g => g.status === "PENDING").length} pending</span>
                <span className="text-green-600">{styleGroups.filter(g => g.status === "PASSED").length} approved</span>
                <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
              </div>
              {styleGroups.some(g => g.status === "PENDING") && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox"
                    checked={styleGroups.filter(g => g.status === "PENDING").every(g => selectedStyles.has(g.style))}
                    onChange={e => {
                      const pending = styleGroups.filter(g => g.status === "PENDING").map(g => g.style)
                      setSelectedStyles(e.target.checked ? new Set(pending) : new Set())
                    }}
                    className="w-4 h-4"
                  />
                  Select All
                </label>
              )}
              {selectedStyles.size > 0 && (
                <button onClick={approveSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? "..." : `Approve Selected (${selectedStyles.size})`}
                </button>
              )}
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isBackScm = backToScmStyleOpen === g.style
            const isSub = submitting === g.style
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${g.status === "PASSED" ? "border-green-200" : g.status === "REJECTED" ? "border-red-200" : isBackScm ? "border-orange-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${g.status === "PASSED" ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : "bg-white"}`}>
                  {g.status === "PENDING" && (
                    <input type="checkbox" className="w-4 h-4 shrink-0"
                      checked={selectedStyles.has(g.style)}
                      onChange={e => setSelectedStyles(prev => { const s = new Set(prev); e.target.checked ? s.add(g.style) : s.delete(g.style); return s })}
                    />
                  )}
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-800 shrink-0">{g.style}</span>
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Gross Weight = <span className="font-medium text-gray-700">{fmtNum((g as any).totalGross, 2)} KG</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">EST Airfreight = <span className="font-medium text-blue-600">{fmtNum((g as any).totalEst)} THB</span></span>
                      {(g as any).totalActual > 0 && <>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">Actual = <span className="font-medium text-green-600">{fmtNum((g as any).totalActual)} THB</span></span>
                      </>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{g.items.length} SO(s)</span>
                  {(g.status === "PASSED" || g.status === "VP_MER_PASSED") && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved — Forwarded to SCM</span>}
                  {g.status === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Rejected</span>}
                  {g.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={() => approveStyle(g.style)} disabled={isSub} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">{isSub && !isRej ? "..." : "Approve"}</button>
                      <button onClick={() => { setRejectingStyle(isRej ? null : g.style); setRejectComment("") }} disabled={isSub} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                      {(req.status === "PENDING_VP_SCM" || req.status === "PENDING_PRESIDENT") && (
                        <button onClick={() => { setBackToScmStyleOpen(isBackScm ? null : g.style); setBackToScmComment(""); setRejectingStyle(null) }} disabled={isSub || submitting === "_"}
                          className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                          Back to SCM
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isRej && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectStyle(g.style)} disabled={isSub || !rejectComment.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isSub ? "..." : "Confirm Reject"}</button>
                      <button onClick={() => { setRejectingStyle(null); setRejectComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isBackScm && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM — ระบุเหตุผล *</label>
                    <textarea value={backToScmComment} onChange={e => setBackToScmComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button
                        disabled={!backToScmComment.trim() || submitting === "_"}
                        onClick={async () => {
                          setSubmitting("_")
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "back_to_scm", comment: backToScmComment })
                          })
                          if (res.ok) { setReq(await res.json()) } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null); setBackToScmStyleOpen(null); setBackToScmComment("")
                        }}
                        className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                        {submitting === "_" ? "..." : "Confirm Back to SCM"}
                      </button>
                      <button onClick={() => { setBackToScmStyleOpen(null); setBackToScmComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","ACTUAL AIR FREIGHT (THB)","REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2">{item.customerPO}</td>
                            <td className="px-3 py-2">{item.description}</td>
                                                        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                            <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                            <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                            <td className="px-3 py-2">{item.reasonDelay}</td>
                            <td className="px-3 py-2">{item.factory}</td>
                            <td className="px-3 py-2">{item.country}</td>
                            <td className="px-3 py-2">{item.port}</td>
                          </tr>
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

      {/* VP SCM approve styles at PENDING_SCM (styles fully forwarded by SCM) */}
      {isVpScmAtScm && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">STYLE APPROVAL — VP SCM</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-4 text-xs font-medium">
                <span className="text-gray-400">{styleGroups.filter(g => g.status === "PENDING").length} waiting for SCM</span>
                <span className="text-blue-600">{styleGroups.filter(g => g.status === "PASSED").length} ready to approve</span>
                <span className="text-green-600">{styleGroups.filter(g => g.status === "VP_PASSED").length} approved</span>
                <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
              </div>
              {styleGroups.some(g => g.status === "PASSED") && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox"
                    checked={styleGroups.filter(g => g.status === "PASSED").every(g => selectedStyles.has(g.style))}
                    onChange={e => {
                      const ready = styleGroups.filter(g => g.status === "PASSED").map(g => g.style)
                      setSelectedStyles(e.target.checked ? new Set(ready) : new Set())
                    }}
                    className="w-4 h-4" />
                  Select All
                </label>
              )}
              {selectedStyles.size > 0 && (
                <button onClick={approveSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? "..." : `Approve Selected (${selectedStyles.size})`}
                </button>
              )}
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isBackScm = backToScmStyleOpen === g.style
            const isSub = submitting === g.style
            const isReady = g.status === "PASSED"
            const isApproved = ["VP_PASSED","PRES_PASSED","LOG_PASSED","CLAIM_PASSED","COMPLETED"].includes(g.status)
            const isWaiting = g.status === "PENDING"
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${isApproved ? "border-green-200" : isRej || g.status === "REJECTED" ? "border-red-200" : isBackScm ? "border-orange-200" : isWaiting ? "border-gray-200 opacity-60" : "border-blue-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isApproved ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : isBackScm ? "bg-orange-50" : isWaiting ? "bg-gray-50" : "bg-blue-50"}`}>
                  {isReady && (
                    <input type="checkbox" className="w-4 h-4 shrink-0"
                      checked={selectedStyles.has(g.style)}
                      onChange={e => setSelectedStyles(prev => { const n = new Set(prev); e.target.checked ? n.add(g.style) : n.delete(g.style); return n })} />
                  )}
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-800 shrink-0">{g.style}</span>
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Gross Weight = <span className="font-medium text-gray-700">{fmtNum((g as any).totalGross, 2)} KG</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">EST Airfreight = <span className="font-medium text-blue-600">{fmtNum((g as any).totalEst)} THB</span></span>
                      {(g as any).totalActual > 0 && <>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">Actual = <span className="font-medium text-green-600">{fmtNum((g as any).totalActual)} THB</span></span>
                      </>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{g.items.length} SO(s)</span>
                  {isWaiting && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">⏳ Waiting for SCM</span>}
                  {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>}
                  {g.status === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Rejected</span>}
                  {isReady && !isRej && !isBackScm && (
                    <div className="flex gap-2">
                      <button onClick={() => approveStyle(g.style)} disabled={isSub} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">{isSub ? "..." : "Approve"}</button>
                      <button onClick={() => { setRejectingStyle(g.style); setRejectComment(""); setBackToScmStyleOpen(null) }} disabled={isSub} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                      <button onClick={() => { setBackToScmStyleOpen(g.style); setBackToScmStyleComment(""); setRejectingStyle(null) }} disabled={isSub} className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">Back to SCM</button>
                    </div>
                  )}
                </div>
                {isRej && isReady && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectStyle(g.style)} disabled={isSub || !rejectComment.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isSub ? "..." : "Confirm Reject"}</button>
                      <button onClick={() => { setRejectingStyle(null); setRejectComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isBackScm && isReady && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM — ระบุเหตุผล *</label>
                    <textarea value={backToScmStyleComment} onChange={e => setBackToScmStyleComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button onClick={() => backToScmStyleFn(g.style)} disabled={isSub || !backToScmStyleComment.trim()} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">{isSub ? "..." : "Confirm Back to SCM"}</button>
                      <button onClick={() => { setBackToScmStyleOpen(null); setBackToScmStyleComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50"><tr>
                        {["SO","ORIG. DATE","PLAN DATE","CLAIM DEPT","DELAY REASON","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.claimDepartment || "-"}</td>
                            <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{item.grossWeight != null ? Number(item.grossWeight).toFixed(2) : "-"}</td>
                            <td className="px-3 py-2">{item.airFreight != null ? Number(item.airFreight).toLocaleString() : "-"}</td>
                          </tr>
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

      {/* President: approve/reject VP_PASSED styles (per-style forwarding) */}
      {isPresidentRole && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">STYLE APPROVAL — PRESIDENT</h2>
            <div className="flex gap-4 text-xs font-medium">
              <span className="text-gray-400">{styleGroups.filter(g => g.status === "PENDING" || g.status === "PASSED").length} earlier stage</span>
              <span className="text-blue-600">{styleGroups.filter(g => g.status === "VP_PASSED").length} ready to approve</span>
              <span className="text-green-600">{styleGroups.filter(g => g.status === "PRES_PASSED").length} approved</span>
              <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isBackScm = backToScmStyleOpen === g.style
            const isSub = submitting === g.style
            const isReady = g.status === "VP_PASSED"
            const isApproved = ["PRES_PASSED","LOG_PASSED","CLAIM_PASSED","COMPLETED"].includes(g.status)
            const isWaiting = g.status === "PENDING" || g.status === "PASSED"
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${isApproved ? "border-green-200" : g.status === "REJECTED" ? "border-red-200" : isBackScm ? "border-orange-200" : isWaiting ? "border-gray-200 opacity-60" : "border-purple-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isApproved ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : isBackScm ? "bg-orange-50" : isWaiting ? "bg-gray-50" : "bg-purple-50"}`}>
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-800 shrink-0">{g.style}</span>
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Gross Weight = <span className="font-medium text-gray-700">{fmtNum((g as any).totalGross, 2)} KG</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">EST Airfreight = <span className="font-medium text-blue-600">{fmtNum((g as any).totalEst)} THB</span></span>
                      {(g as any).totalActual > 0 && <>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">Actual = <span className="font-medium text-green-600">{fmtNum((g as any).totalActual)} THB</span></span>
                      </>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{g.items.length} SO(s)</span>
                  {isWaiting && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {g.status === "PENDING" ? "⏳ Waiting for SCM" : "⏳ Waiting for VP SCM"}
                    </span>
                  )}
                  {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved — Sent to Logistics</span>}
                  {g.status === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Rejected</span>}
                  {isReady && !isRej && !isBackScm && (
                    <div className="flex gap-2">
                      <button onClick={() => approveStyle(g.style)} disabled={isSub} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">{isSub ? "..." : "Approve"}</button>
                      <button onClick={() => { setRejectingStyle(g.style); setRejectComment(""); setBackToScmStyleOpen(null) }} disabled={isSub} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                      <button onClick={() => { setBackToScmStyleOpen(g.style); setBackToScmStyleComment(""); setRejectingStyle(null) }} disabled={isSub} className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">Back to SCM</button>
                    </div>
                  )}
                </div>
                {isRej && isReady && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectStyle(g.style)} disabled={isSub || !rejectComment.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isSub ? "..." : "Confirm Reject"}</button>
                      <button onClick={() => { setRejectingStyle(null); setRejectComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isBackScm && isReady && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM — ระบุเหตุผล *</label>
                    <textarea value={backToScmStyleComment} onChange={e => setBackToScmStyleComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button onClick={() => backToScmStyleFn(g.style)} disabled={isSub || !backToScmStyleComment.trim()} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">{isSub ? "..." : "Confirm Back to SCM"}</button>
                      <button onClick={() => { setBackToScmStyleOpen(null); setBackToScmStyleComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50"><tr>
                        {["SO","ORIG. DATE","PLAN DATE","CLAIM DEPT","DELAY REASON","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.claimDepartment || "-"}</td>
                            <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{item.grossWeight != null ? Number(item.grossWeight).toFixed(2) : "-"}</td>
                            <td className="px-3 py-2">{item.airFreight != null ? Number(item.airFreight).toLocaleString() : "-"}</td>
                          </tr>
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

      {/* GW Style Approval — VP_MER_GW (PENDING → VP_MER_PASSED) and PRESIDENT_GW (PENDING → PRES_PASSED) */}
      {(isVpMerGW || isPresidentGW) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">STYLES ({styleGroups.length})</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">GW · {isVpMerGW ? "VP MER" : "President"}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-4 text-xs font-medium">
                <span className="text-yellow-600">{styleGroups.filter(g => g.status === "PENDING").length} pending</span>
                <span className="text-green-600">{styleGroups.filter(g => ["VP_MER_PASSED","PRES_PASSED"].includes(g.status)).length} approved</span>
                <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
              </div>
              {styleGroups.some(g => g.status === "PENDING") && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox"
                    checked={styleGroups.filter(g => g.status === "PENDING").every(g => selectedStyles.has(g.style))}
                    onChange={e => {
                      const pending = styleGroups.filter(g => g.status === "PENDING").map(g => g.style)
                      setSelectedStyles(e.target.checked ? new Set(pending) : new Set())
                    }}
                    className="w-4 h-4" />
                  Select All
                </label>
              )}
              {selectedStyles.size > 0 && (
                <button onClick={approveSelectedStyles} disabled={!!submitting}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? "..." : `Approve Selected (${selectedStyles.size})`}
                </button>
              )}
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isSub = submitting === g.style
            const isApproved = ["VP_MER_PASSED","PRES_PASSED"].includes(g.status)
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${isApproved ? "border-green-200" : g.status === "REJECTED" ? "border-red-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isApproved ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : "bg-white"}`}>
                  {g.status === "PENDING" && (
                    <input type="checkbox" className="w-4 h-4 shrink-0"
                      checked={selectedStyles.has(g.style)}
                      onChange={e => setSelectedStyles(prev => { const s = new Set(prev); e.target.checked ? s.add(g.style) : s.delete(g.style); return s })} />
                  )}
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-800 shrink-0">{g.style}</span>
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Gross Weight = <span className="font-medium text-gray-700">{fmtNum((g as any).totalGross, 2)} KG</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">EST Airfreight = <span className="font-medium text-blue-600">{fmtNum((g as any).totalEst)} THB</span></span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{g.items.length} SO(s)</span>
                  {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>}
                  {g.status === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Rejected</span>}
                  {g.status === "PENDING" && !isRej && (
                    <div className="flex gap-2">
                      <button onClick={() => approveStyle(g.style)} disabled={isSub} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">{isSub ? "..." : "Approve"}</button>
                      <button onClick={() => { setRejectingStyle(isRej ? null : g.style); setRejectComment("") }} disabled={isSub} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                    </div>
                  )}
                </div>
                {isRej && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectStyle(g.style)} disabled={isSub || !rejectComment.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isSub ? "..." : "Confirm Reject"}</button>
                      <button onClick={() => { setRejectingStyle(null); setRejectComment("") }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","CLAIM DEPT","REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2">{item.customerPO}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                            <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                            <td className="px-3 py-2">{item.qtyRequestAir}</td>
                            <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                            <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                            <td className="px-3 py-2">{req.claimDepartment ?? "-"}</td>
                            <td className="px-3 py-2">{item.reasonDelay}</td>
                            <td className="px-3 py-2">{item.factory}</td>
                            <td className="px-3 py-2">{item.country}</td>
                            <td className="px-3 py-2">{item.port}</td>
                          </tr>
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

      {/* SCM processes VP_MER_PASSED items at PENDING_VP_MER */}
      {isScmAtVpMer && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">
            CLAIM DEPT — VP MER APPROVED
            <span className="text-xs font-normal text-gray-400 ml-2">
              {vpMerPassedItems.filter((i: any) => soClaimDepts[i.id]).length}/{vpMerPassedItems.length} assigned
              {scmPassedAtVpMer.length > 0 && <span className="text-green-600 ml-2">· {scmPassedAtVpMer.length} forwarded to VP SCM</span>}
            </span>
          </h2>

          {vpMerPassedItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี style ที่ VP MER approve มาหา SCM</p>
          ) : (
            <>
              {(() => {
                const readyVpMerStyles = [...new Set(vpMerPassedItems.filter((i: any) => soClaimDepts[i.id]).map((i: any) => i.style as string))]
                  .filter(style => vpMerPassedItems.filter((i: any) => i.style === style).every((i: any) => soClaimDepts[i.id]))
                const readyVpMerItemIds = vpMerPassedItems.filter((i: any) => readyVpMerStyles.includes(i.style)).map((i: any) => i.id as string)
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">เลือก SO ที่ต้องการ assign Claim Dept แล้วกด Forward</span>
                    <div className="flex items-center gap-3">
                      {readyVpMerStyles.length > 0 && (
                        <button type="button" disabled={submitting === "_fwd_vpm"}
                          onClick={async () => {
                            setSubmitting("_fwd_vpm")
                            const depts: Record<string, string> = {}
                            const comments: Record<string, string> = {}
                            readyVpMerItemIds.forEach((iid: string) => {
                              depts[iid] = soClaimDepts[iid]
                              if (soClaimComments[iid]) comments[iid] = soClaimComments[iid]
                            })
                            const res = await fetch(`/api/requests/${id}/approve`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "approve", soClaimData: depts, soClaimComments: comments, comment: "" })
                            })
                            if (res.ok) {
                              const updated = await res.json()
                              if (updated.status !== "PENDING_VP_MER") { window.location.href = "/approvals" } else { setReq(updated) }
                            }
                            setSubmitting(null)
                          }}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                          {submitting === "_fwd_vpm" ? "..." : `Forward ${readyVpMerStyles.length} ready style(s) →`}
                        </button>
                      )}
                      <button type="button" onClick={() => setSoClaimSelected(
                        soClaimSelected.size === vpMerPassedItems.length ? new Set() : new Set(vpMerPassedItems.map((i: any) => i.id))
                      )} className="text-xs text-blue-600 hover:underline">
                        {soClaimSelected.size === vpMerPassedItems.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                  </div>
                )
              })()}
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      {["SO","STYLE","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","FACTORY","COUNTRY","PORT","CLAIM DEPT","SCM DELAY REASON"].map(h =>
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vpMerPassedItems.map((item: any) => {
                      const assigned = soClaimDepts[item.id]
                      const selected = soClaimSelected.has(item.id)
                      return (
                        <tr key={item.id} className={`cursor-pointer ${selected ? "bg-blue-50" : assigned ? "bg-green-50" : "bg-red-50 hover:bg-red-100"}`}
                          onClick={() => setSoClaimSelected(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected}
                              onChange={e => setSoClaimSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                              className="w-4 h-4 rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.description}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2 text-blue-700 font-medium">{fmtNum(item.grossWeight, 2)}</td>
                          <td className="px-3 py-2 text-blue-700 font-medium">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2">{item.factory}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                          <td className="px-3 py-2">
                            {assigned
                              ? <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{assigned}</span>
                              : <span className="text-red-400 text-xs italic">-- Not assigned --</span>}
                          </td>
                          <td className="px-3 py-2 min-w-[200px]" onClick={e => e.stopPropagation()}>
                            {item.reasonDelay && (
                              <div className="mb-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">MER: {item.reasonDelay}</div>
                            )}
                            <input type="text" placeholder="SCM delay reason..."
                              value={soClaimComments[item.id] || ""}
                              onChange={e => setSoClaimComments(p => ({ ...p, [item.id]: e.target.value }))}
                              className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:ring-1 focus:ring-blue-400" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {soClaimSelected.size > 0 && (
                <div className="border border-blue-300 rounded-lg p-3 bg-blue-50 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-blue-700">{soClaimSelected.size} SO selected</span>
                    <select value={batchClaimDept} onChange={e => setBatchClaimDept(e.target.value)}
                      className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400">
                      <option value="">-- Select Claim Dept --</option>
                      {CLAIM_DEPTS.map(d => <option key={d} value={d}>{CLAIM_DEPT_LABEL[d] || d}</option>)}
                    </select>
                    <input type="text" placeholder="Comment / Delay reason..."
                      value={batchComment} onChange={e => setBatchComment(e.target.value)}
                      className="flex-1 min-w-[220px] border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400" />
                    <button type="button" disabled={!batchClaimDept || submitting === "_"}
                      onClick={async () => {
                        const newDepts: Record<string, string> = {}
                        const newComments: Record<string, string> = {}
                        soClaimSelected.forEach(itemId => {
                          newDepts[itemId] = batchClaimDept
                          if (batchComment) newComments[itemId] = batchComment
                        })
                        setSoClaimDepts(prev => ({ ...prev, ...newDepts }))
                        setSoClaimComments(prev => ({ ...prev, ...newComments }))
                        setSoClaimSelected(new Set())
                        setBatchClaimDept("")
                        setBatchComment("")
                        setSubmitting("_")
                        const res = await fetch(`/api/requests/${id}/approve`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "approve", soClaimData: newDepts, soClaimComments: newComments, comment: "" })
                        })
                        if (res.ok) {
                          const updated = await res.json()
                          if (updated.status !== "PENDING_VP_MER") {
                            window.location.href = "/approvals"
                          } else {
                            setReq(updated)
                          }
                        } else {
                          const err = await res.json(); alert(err.error || "Error")
                        }
                        setSubmitting(null)
                      }}
                      className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                      {submitting === "_" ? "..." : `Assign & Forward ${soClaimSelected.size} SO(s) to VP SCM`}
                    </button>
                    <button type="button" onClick={() => { setSoClaimSelected(new Set()); setBatchClaimDept(""); setBatchComment("") }}
                      className="text-sm text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Logistics: process PRES_PASSED items (per-style forwarding) */}
      {(isLogisticsRole || isLogisticsGW) && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 border-b pb-2">
            INVOICE / BOOKING DATE — LOGISTICS{isLogisticsGW ? <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium align-middle">GW</span> : ""}
            <span className="text-xs font-normal text-gray-400 ml-2">
              {pendingLogItems.filter((i: any) => itemLogistics[i.id]?.invoiceNo).length}/{pendingLogItems.length} ready
              {forwardedLogItems.length > 0 && <span className="text-green-600 ml-2">· {forwardedLogItems.length} forwarded to Claim</span>}
            </span>
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  {["SO","STYLE","QTY AIR","EST. (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE",""].map(h =>
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingLogItems.map((item: any) => {
                  const inv = itemLogistics[item.id]
                  const sel = logSelected.has(item.id)
                  const editing = logEditMode.has(item.id)
                  return (
                    <tr key={item.id} className={`cursor-pointer ${sel ? "bg-blue-50" : inv?.invoiceNo ? "bg-green-50" : "hover:bg-gray-50"}`}
                      onClick={() => setLogSelected(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={sel}
                          onChange={e => setLogSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                          className="w-4 h-4 rounded border-gray-300" />
                      </td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{item.so}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                                            <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                      <td className="px-3 py-2 text-gray-400">{fmtNum(item.airFreight)}</td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="number" value={itemActuals[item.id] || ""}
                          onChange={e => setItemActuals(p => ({...p,[item.id]:e.target.value}))}
                          placeholder="0" className="w-24 border border-blue-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {editing
                          ? <input type="text" autoFocus value={inv?.invoiceNo || ""}
                              onChange={e => setItemLogistics(p => ({ ...p, [item.id]: { ...p[item.id], invoiceNo: e.target.value } }))}
                              className="w-28 border border-blue-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400" />
                          : inv?.invoiceNo
                            ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{inv.invoiceNo}</span>
                            : <span className="text-gray-300 text-xs italic">--</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {editing
                          ? <input type="date" value={inv?.bookingDate || ""}
                              onChange={e => setItemLogistics(p => ({ ...p, [item.id]: { ...p[item.id], bookingDate: e.target.value } }))}
                              className="border border-blue-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400" />
                          : inv?.bookingDate
                            ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{inv.bookingDate}</span>
                            : <span className="text-gray-300 text-xs italic">--</span>}
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setLogEditMode(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editing ? "text-blue-600" : "text-gray-400"}`}
                          title={editing ? "Done" : "Edit"}>
                          {editing ? "✓" : "✏️"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {logSelected.size > 0 && (
            <div className="border border-blue-300 rounded-lg p-3 bg-blue-50 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-blue-700">{logSelected.size} SO selected</span>
                <input type="text" placeholder="Invoice No..."
                  value={batchInvoice} onChange={e => setBatchInvoice(e.target.value)}
                  className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 w-44" />
                <input type="date" value={batchBookingDate} onChange={e => setBatchBookingDate(e.target.value)}
                  className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400" />
                <button type="button" disabled={!batchInvoice}
                  onClick={() => {
                    setItemLogistics(prev => {
                      const updated = { ...prev }
                      logSelected.forEach(itemId => { updated[itemId] = { invoiceNo: batchInvoice, bookingDate: batchBookingDate } })
                      return updated
                    })
                    setLogSelected(new Set()); setBatchInvoice(""); setBatchBookingDate("")
                  }}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                  Assign to {logSelected.size} SO(s)
                </button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <button
              disabled={
                submitting === "_" ||
                !pendingLogItems.some((i: any) => itemLogistics[i.id]?.invoiceNo && itemLogistics[i.id]?.bookingDate && parseFloat(itemActuals[i.id] || "0") > 0) ||
                pendingLogItems.some((i: any) => itemLogistics[i.id]?.invoiceNo && !(parseFloat(itemActuals[i.id] || "0") > 0))
              }
              onClick={async () => {
                setSubmitting("_")
                const res = await fetch(`/api/requests/${id}/approve`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "approve", itemActuals, itemLogistics })
                })
                if (res.ok) {
                  const updated = await res.json()
                  setReq(updated)
                  if (!updated.items?.some((i: any) => i.itemStatus === "PRES_PASSED")) {
                    window.location.href = "/approvals"
                  }
                } else { const err = await res.json(); alert(err.error || "Error") }
                setSubmitting(null)
              }}
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {submitting === "_" ? "..." : "Confirm & Forward to Claim"}
            </button>
          </div>
        </div>
      )}

      {/* DVM CLAIM per-SO approval — priority-based sequential */}
      {isDvmClaim && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">SO APPROVAL — DVM {claimDept} ({myClaimItems.length})</h2>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-yellow-600">{myClaimItems.filter((i:any) => i.itemStatus === "LOG_PASSED").length} pending</span>
              <span className="text-green-600">{myClaimItems.filter((i:any) => i.itemStatus === "CLAIM_PASSED").length} forwarded to VP</span>
              <span className="text-red-600">{myClaimItems.filter((i:any) => i.itemStatus === "REJECTED").length} rejected</span>
              {(() => {
                const myTurnItems = myClaimItems.filter((i: any) => {
                  if (i.itemStatus !== "LOG_PASSED") return false
                  const appr: any[] = i.claimApprovals || []
                  if (appr.some((a: any) => a.userId === myUserId)) return false
                  const lower = myPriority !== null ? claimApproversList.filter((u: any) => u.priority !== null && u.priority < myPriority) : []
                  return lower.every((u: any) => appr.some((a: any) => a.userId === u.id))
                })
                if (myTurnItems.length === 0) return null
                const allSel = myTurnItems.every((i: any) => dvmSelected.has(i.id))
                return (
                  <button onClick={() => setDvmSelected(allSel ? new Set() : new Set(myTurnItems.map((i: any) => i.id)))}
                    className="text-blue-600 hover:underline">
                    {allSel ? "Deselect All" : `Select All (${myTurnItems.length})`}
                  </button>
                )
              })()}
            </div>
          </div>

          {/* Priority order reference */}
          {claimApproversList.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-600">Approval order:</span>
              {claimApproversList.map((u: any, idx: number) => (
                <span key={u.id} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-gray-300">→</span>}
                  <span className={`px-2 py-0.5 rounded-full font-medium ${u.id === myUserId ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.priority != null ? `${u.priority}. ` : ""}{u.name || u.email}
                  </span>
                </span>
              ))}
            </div>
          )}

          {myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED").map((item: any) => {
            const isSub = submitting === item.id
            const itemAttachments = (req.attachments || []).filter((a: any) => a.itemId === item.id)
            const isUploading = uploadingItem === item.id
            const isPending = item.itemStatus === "LOG_PASSED"
            const isPassed = item.itemStatus === "CLAIM_PASSED"
            // Who has approved this item so far
            const itemApprovals: any[] = item.claimApprovals || []
            const iHaveApproved = itemApprovals.some((a: any) => a.userId === myUserId)
            // Can I approve? All lower-priority approvers must have approved first
            const lowerApprovers = myPriority !== null
              ? claimApproversList.filter((u: any) => u.priority !== null && u.priority < myPriority)
              : []
            const lowerApproved = lowerApprovers.every((u: any) => itemApprovals.some((a: any) => a.userId === u.id))
            const canApproveNow = isPending && !iHaveApproved && lowerApproved
            // Next approver info
            const nextApprover = claimApproversList.find((u: any) =>
              !itemApprovals.some((a: any) => a.userId === u.id)
            )
            const isMyTurn = canApproveNow
            const isP1 = myPriority === 1 || (myPriority === null && claimApproversList.length === 1)
            const isExp = expanded.has(item.id)
            return (
              <div key={item.id} className={`rounded-xl border overflow-hidden ${isPassed ? "border-green-200" : iHaveApproved ? "border-blue-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isPassed ? "bg-green-50" : iHaveApproved ? "bg-blue-50" : "bg-white"}`}>
                  {isMyTurn && (
                    <input type="checkbox" checked={dvmSelected.has(item.id)}
                      onChange={e => setDvmSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                      className="w-4 h-4 rounded border-gray-300 shrink-0 cursor-pointer" />
                  )}
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>


                  {isPassed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">All approved → VP</span>}
                  {isPending && !iHaveApproved && !canApproveNow && nextApprover && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Waiting: {nextApprover.name || nextApprover.email}
                    </span>
                  )}
                  {iHaveApproved && !isPassed && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">You approved ✓</span>
                  )}

                  {/* Attach — priority 1 only */}
                  {isP1 && isPending && (
                    <label className={`cursor-pointer text-xs px-2 py-1 rounded border ${isUploading ? "opacity-50 pointer-events-none" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                      {isUploading ? "Uploading..." : "📎 Attach"}
                      <input type="file" className="hidden" disabled={isUploading}
                        onChange={e => { if (e.target.files?.[0]) attachFileFn(e.target.files[0], item.id); e.target.value = "" }} />
                    </label>
                  )}

                  {/* Approve button — only if it's my turn */}
                  {isMyTurn && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId: item.id })
                          })
                          if (res.ok) {
                            setReq(await res.json())
                            setDvmSelected(prev => { const n = new Set(prev); n.delete(item.id); return n })
                          } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null)
                        }} disabled={isSub}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {isSub ? "..." : "Approve"}
                      </button>
                      <button onClick={() => { setRejectingSo(item.id); setRejectSoComment(""); setBackToScmSo(null) }} disabled={isSub}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                      <button onClick={() => { setBackToScmSo(backToScmSo === item.id ? null : item.id); setBackToScmSoComment(""); setRejectingSo(null) }} disabled={isSub}
                        className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">Back to SCM</button>
                    </div>
                  )}
                </div>
                {/* Attachments list */}
                {itemAttachments.length > 0 && (
                  <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex flex-wrap gap-2">
                    {itemAttachments.map((att: any) => (
                      <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs bg-white border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100 font-medium">
                        📎 {att.fileName}
                        <span className="text-gray-400 font-normal">· {att.uploadedBy?.name}</span>
                      </a>
                    ))}
                  </div>
                )}
                {rejectingSo === item.id && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Reject reason *</label>
                    <textarea value={rejectSoComment} onChange={e => setRejectSoComment(e.target.value)} rows={2}
                      placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button disabled={isSub || !rejectSoComment.trim()}
                        onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "reject_so", itemId: item.id, comment: rejectSoComment })
                          })
                          if (res.ok) { setReq(await res.json()) } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
                        }}
                        className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-40">
                        {isSub ? "..." : "Confirm Reject"}
                      </button>
                      <button onClick={() => setRejectingSo(null)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {backToScmSo === item.id && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM reason *</label>
                    <textarea value={backToScmSoComment} onChange={e => setBackToScmSoComment(e.target.value)} rows={2}
                      placeholder="Enter reason..." className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button disabled={isSub || !backToScmSoComment.trim()}
                        onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "back_to_scm_so", itemId: item.id, comment: backToScmSoComment })
                          })
                          if (res.ok) { setReq(await res.json()) } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null); setBackToScmSo(null); setBackToScmSoComment("")
                        }}
                        className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-40">
                        {isSub ? "..." : "Confirm Back to SCM"}
                      </button>
                      <button onClick={() => { setBackToScmSo(null); setBackToScmSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","STYLE","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE","CLAIM DEPT","DELAY REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                          <td className="px-3 py-2">{item.customerPO}</td>
                          <td className="px-3 py-2">{item.description}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                          <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                          <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                          <td className="px-3 py-2">{item.claimDepartment || "-"}</td>
                          <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                          <td className="px-3 py-2">{item.factory}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {/* Batch approve panel */}
          {dvmSelected.size > 0 && (
            <div className="sticky bottom-4 bg-white border border-blue-300 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap z-10">
              <span className="text-sm font-semibold text-blue-700">{dvmSelected.size} SO selected</span>
              <button
                disabled={submitting !== null}
                onClick={async () => {
                  const ids = [...dvmSelected]
                  let updated: any = req
                  for (const itemId of ids) {
                    setSubmitting(itemId)
                    const res = await fetch(`/api/requests/${id}/approve`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "approve_so", itemId })
                    })
                    if (res.ok) updated = await res.json()
                  }
                  setReq(updated)
                  setDvmSelected(new Set())
                  setSubmitting(null)
                }}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {submitting !== null ? "Approving..." : `Approve ${dvmSelected.size} SO(s)`}
              </button>
              <button onClick={() => setDvmSelected(new Set())}
                className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* VP CLAIM per-SO approval */}
      {isVpClaim && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">SO APPROVAL — VP {claimDept} ({myClaimItems.length})</h2>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-yellow-600">{myClaimItems.filter((i:any) => i.itemStatus === "CLAIM_PASSED").length} pending</span>
              <span className="text-green-600">{myClaimItems.filter((i:any) => i.itemStatus === "COMPLETED").length} approved</span>
              <span className="text-red-600">{myClaimItems.filter((i:any) => i.itemStatus === "REJECTED").length} rejected</span>
              {(() => {
                const myTurnItems = myClaimItems.filter((i: any) => {
                  if (i.itemStatus !== "CLAIM_PASSED") return false
                  const appr: any[] = (i.claimApprovals || []).filter((a: any) => claimApproversList.some((u: any) => u.id === a.userId))
                  if (appr.some((a: any) => a.userId === myUserId)) return false
                  const lower = myPriority !== null ? claimApproversList.filter((u: any) => u.priority !== null && u.priority < myPriority) : []
                  return lower.every((u: any) => appr.some((a: any) => a.userId === u.id))
                })
                if (myTurnItems.length === 0) return null
                const allSel = myTurnItems.every((i: any) => vpSelected.has(i.id))
                return (
                  <button onClick={() => setVpSelected(allSel ? new Set() : new Set(myTurnItems.map((i: any) => i.id)))}
                    className="text-blue-600 hover:underline">
                    {allSel ? "Deselect All" : `Select All (${myTurnItems.length})`}
                  </button>
                )
              })()}
            </div>
          </div>

          {/* SCM attachments (doc-level) */}
          {(() => {
            const scmAtts = (req.attachments || []).filter((a: any) => a.uploadedBy?.role === "SCM_USER" && !a.itemId)
            if (scmAtts.length === 0) return null
            return (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500">SCM:</span>
                {scmAtts.map((att: any) => (
                  <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-100 font-medium whitespace-nowrap">
                    📎 {att.fileName}
                  </a>
                ))}
              </div>
            )
          })()}

          {/* Priority order reference */}
          {claimApproversList.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-600">Approval order:</span>
              {claimApproversList.map((u: any, idx: number) => (
                <span key={u.id} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-gray-300">→</span>}
                  <span className={`px-2 py-0.5 rounded-full font-medium ${u.id === myUserId ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.priority != null ? `${u.priority}. ` : ""}{u.name || u.email}
                  </span>
                </span>
              ))}
            </div>
          )}

          {myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED").map((item: any) => {
            const isSub = submitting === item.id
            const itemAttachments = (req.attachments || []).filter((a: any) => a.itemId === item.id)
            const isUploading = uploadingItem === item.id
            const isPending = item.itemStatus === "CLAIM_PASSED"
            const isPassed = item.itemStatus === "COMPLETED"
            // Filter approvals to only VP-tier approvers in this group
            const itemApprovals: any[] = (item.claimApprovals || []).filter((a: any) =>
              claimApproversList.some((u: any) => u.id === a.userId)
            )
            const iHaveApproved = itemApprovals.some((a: any) => a.userId === myUserId)
            const lowerApprovers = myPriority !== null
              ? claimApproversList.filter((u: any) => u.priority !== null && u.priority < myPriority)
              : []
            const lowerApproved = lowerApprovers.every((u: any) => itemApprovals.some((a: any) => a.userId === u.id))
            const canApproveNow = isPending && !iHaveApproved && lowerApproved
            const nextApprover = claimApproversList.find((u: any) =>
              !itemApprovals.some((a: any) => a.userId === u.id)
            )
            const isMyTurn = canApproveNow
            const isP1 = myPriority === 1 || (myPriority === null && claimApproversList.length === 1)
            const isExp = expanded.has(item.id)
            return (
              <div key={item.id} className={`rounded-xl border overflow-hidden ${isPassed ? "border-green-200" : iHaveApproved ? "border-blue-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isPassed ? "bg-green-50" : iHaveApproved ? "bg-blue-50" : "bg-white"}`}>
                  {isMyTurn && (
                    <input type="checkbox" checked={vpSelected.has(item.id)}
                      onChange={e => setVpSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                      className="w-4 h-4 rounded border-gray-300 shrink-0 cursor-pointer" />
                  )}
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>

                  {isPassed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Completed</span>}
                  {isPending && !iHaveApproved && !canApproveNow && nextApprover && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Waiting: {nextApprover.name || nextApprover.email}
                    </span>
                  )}
                  {iHaveApproved && !isPassed && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">You approved ✓</span>
                  )}

                  {/* PDF download when completed */}
                  {isPassed && <PdfDownloadButton req={req} item={item} compact alwaysShow />}

                  {/* Attach — priority 1 only */}
                  {isP1 && isPending && (
                    <label className={`cursor-pointer text-xs px-2 py-1 rounded border ${isUploading ? "opacity-50 pointer-events-none" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                      {isUploading ? "Uploading..." : "📎 Attach"}
                      <input type="file" className="hidden" disabled={isUploading}
                        onChange={e => { if (e.target.files?.[0]) attachFileFn(e.target.files[0], item.id); e.target.value = "" }} />
                    </label>
                  )}

                  {/* Approve/Reject/Back to SCM — only when it's my turn */}
                  {isMyTurn && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId: item.id })
                          })
                          if (res.ok) {
                            setReq(await res.json())
                            setVpSelected(prev => { const n = new Set(prev); n.delete(item.id); return n })
                          } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null)
                        }} disabled={isSub}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {isSub ? "..." : "Approve"}
                      </button>
                      <button onClick={() => { setRejectingSo(rejectingSo === item.id ? null : item.id); setRejectSoComment(""); setBackToScmSo(null) }} disabled={isSub}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                      <button onClick={() => { setBackToScmSo(backToScmSo === item.id ? null : item.id); setBackToScmSoComment(""); setRejectingSo(null) }} disabled={isSub}
                        className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">Back to SCM</button>
                    </div>
                  )}
                </div>
                {itemAttachments.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
                    {itemAttachments.map((att: any) => (
                      <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full hover:bg-gray-100 font-medium">
                        📎 {att.fileName}
                        <span className="text-gray-400 font-normal">· {att.uploadedBy?.name}</span>
                      </a>
                    ))}
                  </div>
                )}
                {rejectingSo === item.id && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectSoComment} onChange={e => setRejectSoComment(e.target.value)} rows={2}
                      placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={() => rejectSo(item.id)} disabled={isSub || !rejectSoComment.trim()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                        {isSub ? "..." : "Confirm Reject"}
                      </button>
                      <button onClick={() => { setRejectingSo(null); setRejectSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {backToScmSo === item.id && (
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-2">
                    <label className="text-xs font-medium text-orange-700">Back to SCM — ระบุเหตุผล *</label>
                    <textarea value={backToScmSoComment} onChange={e => setBackToScmSoComment(e.target.value)} rows={2}
                      placeholder="Enter reason..." className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    <div className="flex gap-2">
                      <button disabled={isSub || !backToScmSoComment.trim()}
                        onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "back_to_scm_so", itemId: item.id, comment: backToScmSoComment })
                          })
                          if (res.ok) { setReq(await res.json()) } else { const err = await res.json(); alert(err.error || "Error") }
                          setSubmitting(null); setBackToScmSo(null); setBackToScmSoComment("")
                        }}
                        className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-40">
                        {isSub ? "..." : "Confirm Back to SCM"}
                      </button>
                      <button onClick={() => { setBackToScmSo(null); setBackToScmSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","STYLE","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE","CLAIM DEPT","DELAY REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                          <td className="px-3 py-2">{item.customerPO}</td>
                          <td className="px-3 py-2">{item.description}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                          <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                          <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                          <td className="px-3 py-2">{item.claimDepartment || "-"}</td>
                          <td className="px-3 py-2">{item.reasonDelay || "-"}</td>
                          <td className="px-3 py-2">{item.factory}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {/* VP batch approve panel */}
          {vpSelected.size > 0 && (
            <div className="sticky bottom-4 bg-white border border-blue-300 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap z-10">
              <span className="text-sm font-semibold text-blue-700">{vpSelected.size} SO selected</span>
              <button
                disabled={submitting !== null}
                onClick={async () => {
                  const ids = [...vpSelected]
                  let updated: any = req
                  for (const itemId of ids) {
                    setSubmitting(itemId)
                    const res = await fetch(`/api/requests/${id}/approve`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "approve_so", itemId })
                    })
                    if (res.ok) updated = await res.json()
                  }
                  setReq(updated)
                  setVpSelected(new Set())
                  setSubmitting(null)
                }}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {submitting !== null ? "Approving..." : `Approve ${vpSelected.size} SO(s)`}
              </button>
              <button onClick={() => setVpSelected(new Set())}
                className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* GW CLAIM: per-SO approve/reject at PENDING_CLAIM_GW */}
      {isClaimGW && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">SO APPROVAL — CLAIM GW</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">GW</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-yellow-600">{(req.items||[]).filter((i:any) => i.itemStatus === "LOG_PASSED").length} pending</span>
              <span className="text-green-600">{(req.items||[]).filter((i:any) => i.itemStatus === "COMPLETED").length} approved</span>
              <span className="text-red-600">{(req.items||[]).filter((i:any) => i.itemStatus === "REJECTED").length} rejected</span>
              {(() => {
                const pendingItems = (req.items||[]).filter((i:any) => i.itemStatus === "LOG_PASSED")
                const allSelected = pendingItems.length > 0 && pendingItems.every((i:any) => claimGwSelected.has(i.id))
                return pendingItems.length > 0 && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 font-normal ml-2">
                    <input type="checkbox" checked={allSelected}
                      onChange={e => setClaimGwSelected(e.target.checked ? new Set(pendingItems.map((i:any) => i.id)) : new Set())}
                      className="w-4 h-4 rounded border-gray-300" />
                    เลือกทั้งหมด
                  </label>
                )
              })()}
            </div>
          </div>
          {claimGwSelected.size > 0 && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <span className="text-sm font-medium text-green-700">{claimGwSelected.size} SO selected</span>
              <button
                disabled={submitting === "_batch"}
                onClick={async () => {
                  setSubmitting("_batch")
                  const ids = [...claimGwSelected]
                  const res = await fetch(`/api/requests/${id}/approve`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "batch_approve_so", itemIds: ids })
                  })
                  if (res.ok) { setReq(await res.json()); setClaimGwSelected(new Set()) }
                  else { const err = await res.json(); alert(err.error || "Error") }
                  setSubmitting(null)
                }}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {submitting === "_batch" ? "..." : `Approve ${claimGwSelected.size} SO`}
              </button>
              <button onClick={() => setClaimGwSelected(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700">ยกเลิก</button>
            </div>
          )}
          {req.claimDepartment && (
            <div className="text-sm text-gray-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Claim Department: <span className="font-semibold text-emerald-700">{req.claimDepartment === "SUPPLIER_IN" ? "Supplier ใน" : req.claimDepartment === "SUPPLIER_OUT" ? "Supplier นอก" : req.claimDepartment}</span>
            </div>
          )}
          {(req.items||[]).filter((i:any) => ["LOG_PASSED","COMPLETED","REJECTED"].includes(i.itemStatus)).map((item: any) => {
            const isSub = submitting === item.id || submitting === "_batch"
            const isRejRow = rejectingSo === item.id
            const isPending = item.itemStatus === "LOG_PASSED"
            const isPassed = item.itemStatus === "COMPLETED"
            const isExp = expanded.has(item.id)
            const isSel = claimGwSelected.has(item.id)
            return (
              <div key={item.id} className={`rounded-xl border overflow-hidden ${isSel ? "border-green-400 ring-1 ring-green-300" : isPassed ? "border-green-200" : item.itemStatus === "REJECTED" ? "border-red-200" : "border-gray-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 ${isSel ? "bg-green-50" : isPassed ? "bg-green-50" : item.itemStatus === "REJECTED" ? "bg-red-50" : "bg-white"}`}>
                  {isPending && (
                    <input type="checkbox" checked={isSel}
                      onChange={e => setClaimGwSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                      className="w-4 h-4 rounded border-gray-300 shrink-0" />
                  )}
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                  {isPassed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Completed</span>}
                  {item.itemStatus === "REJECTED" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Rejected</span>}
                  {isPassed && <PdfDownloadButton req={req} item={item} compact alwaysShow />}
                  {isPending && !isRejRow && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId: item.id })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null)
                        }} disabled={isSub}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {isSub ? "..." : "Approve"}
                      </button>
                      <button onClick={() => { setRejectingSo(item.id); setRejectSoComment("") }} disabled={isSub}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                    </div>
                  )}
                </div>
                {isRejRow && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectSoComment} onChange={e => setRejectSoComment(e.target.value)} rows={2} placeholder="Enter reason..." className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "reject_so", itemId: item.id, comment: rejectSoComment })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
                        }} disabled={isSub || !rejectSoComment.trim()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                        {isSub ? "..." : "Confirm Reject"}
                      </button>
                      <button onClick={() => { setRejectingSo(null); setRejectSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","STYLE","CUSTOMER PO","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                          <td className="px-3 py-2">{item.customerPO}</td>
                          <td className="px-3 py-2">{item.description}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2">{fmtNum(item.grossWeight, 2)}</td>
                          <td className="px-3 py-2">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                          <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                          <td className="px-3 py-2">{item.factory}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* SCM_GW: approve/reject SCM_GW_PENDING items */}
      {isScmGW && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">SO APPROVAL — SCM GW</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">SCM GW</span>
            <span className="text-xs text-gray-500">{scmGwItems.length} pending</span>
          </div>
          {scmGwItems.map((item: any) => {
            const isSub = submitting === item.id
            const isRejRow = rejectingSo === item.id
            const isExp = expanded.has(item.id)
            return (
              <div key={item.id} className="rounded-xl border border-orange-200 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 bg-orange-50">
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                    Dept: {item.factory || item.claimDepartment || "-"}
                  </span>
                  {!isRejRow && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId: item.id })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null)
                        }} disabled={isSub}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {isSub ? "..." : "Approve → Accounting"}
                      </button>
                      <button onClick={() => { setRejectingSo(item.id); setRejectSoComment("") }} disabled={isSub}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                    </div>
                  )}
                </div>
                {isRejRow && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectSoComment} onChange={e => setRejectSoComment(e.target.value)} rows={2} className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "reject_so", itemId: item.id, comment: rejectSoComment })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
                        }} disabled={isSub || !rejectSoComment.trim()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                        {isSub ? "..." : "Confirm Reject"}
                      </button>
                      <button onClick={() => { setRejectingSo(null); setRejectSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","STYLE","DESCRIPTION","QTY ORIG","QTY AIR","INVOICE NO","BOOKING DATE","DEPT","% CLAIM","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{item.so}</td>
                          <td className="px-3 py-2">{item.style}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                          <td className="px-3 py-2">{item.factory || item.claimDepartment || "-"}</td>
                          <td className="px-3 py-2">{item.claimPercentage != null ? `${item.claimPercentage}%` : "-"}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ACCOUNTING: approve/reject ACCOUNTING_PENDING items */}
      {isAccountingGW && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">SO APPROVAL — ACCOUNTING</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">ACCOUNTING</span>
            <span className="text-xs text-gray-500">{accountingGwItems.length} pending</span>
          </div>
          {accountingGwItems.map((item: any) => {
            const isSub = submitting === item.id
            const isRejRow = rejectingSo === item.id
            const isExp = expanded.has(item.id)
            return (
              <div key={item.id} className="rounded-xl border border-teal-200 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 bg-teal-50">
                  <button onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-700 w-5 text-center shrink-0">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 w-28 shrink-0">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                    Dept: {item.factory || item.claimDepartment || "-"}
                  </span>
                  {!isRejRow && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "approve_so", itemId: item.id })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null)
                        }} disabled={isSub}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {isSub ? "..." : "Approve → Complete"}
                      </button>
                      <button onClick={() => { setRejectingSo(item.id); setRejectSoComment("") }} disabled={isSub}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">Reject</button>
                    </div>
                  )}
                </div>
                {isRejRow && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-100 space-y-2">
                    <label className="text-xs font-medium text-red-700">Rejection Reason *</label>
                    <textarea value={rejectSoComment} onChange={e => setRejectSoComment(e.target.value)} rows={2} className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                    <div className="flex gap-2">
                      <button onClick={async () => {
                          setSubmitting(item.id)
                          const res = await fetch(`/api/requests/${id}/approve`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "reject_so", itemId: item.id, comment: rejectSoComment })
                          })
                          if (res.ok) setReq(await res.json())
                          setSubmitting(null); setRejectingSo(null); setRejectSoComment("")
                        }} disabled={isSub || !rejectSoComment.trim()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                        {isSub ? "..." : "Confirm Reject"}
                      </button>
                      <button onClick={() => { setRejectingSo(null); setRejectSoComment("") }}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
                {isExp && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{["SO","STYLE","DESCRIPTION","QTY ORIG","QTY AIR","INVOICE NO","BOOKING DATE","DEPT","% CLAIM","ACTUAL (THB)","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{item.so}</td>
                          <td className="px-3 py-2">{item.style}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2">{item.invoiceNo || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                          <td className="px-3 py-2">{item.factory || item.claimDepartment || "-"}</td>
                          <td className="px-3 py-2">{item.claimPercentage != null ? `${item.claimPercentage}%` : "-"}</td>
                          <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      {canAct && !isStyleApprover && !isClaimApprover && !isVpScmAtScm && !isScmAtVpMer && !isPresidentRole && !isLogisticsRole && !isGWApprover && role !== "PRESIDENT" && role !== "LOGISTICS" && !role.startsWith("DVM_") && !role.startsWith("CLAIM_") && !CLAIM_VP_ROLES_LOCAL.includes(role) && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <h2 className="font-semibold text-gray-800">ACTIONS</h2>
            {isGWRequest && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">GW</span>}
          </div>

          {/* GW — claim dept info for CLAIM_GW */}
          {isGWRequest && req.claimDepartment && role === "CLAIM_GW" && (
            <div className="text-sm text-gray-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Claim Department: <span className="font-semibold text-emerald-700">{req.claimDepartment === "SUPPLIER_IN" ? "Supplier ใน" : req.claimDepartment === "SUPPLIER_OUT" ? "Supplier นอก" : req.claimDepartment}</span>
            </div>
          )}

          {/* SCM */}
          {req.status === "PENDING_SCM" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  CLAIM DEPT BY SO *
                  <span className="text-xs font-normal text-gray-400 ml-2">
                    {pendingScmItems.filter((i: any) => soClaimDepts[i.id]).length}/{pendingScmItems.length} assigned
                    {forwardedScmItems.length > 0 && <span className="text-green-600 ml-2">· {forwardedScmItems.length} forwarded to VP SCM</span>}
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  {readyScmStyles.length > 0 && (
                    <button type="button" disabled={submitting === "_fwd"}
                      onClick={async () => {
                        setSubmitting("_fwd")
                        const depts: Record<string, string> = {}
                        const comments: Record<string, string> = {}
                        const dvms: Record<string, string> = {}
                        readyScmItemIds.forEach((iid: string) => {
                          depts[iid] = soClaimDepts[iid]
                          if (soClaimComments[iid]) comments[iid] = soClaimComments[iid]
                          if (soDvmAssigned[iid]) dvms[iid] = soDvmAssigned[iid]
                        })
                        const res = await fetch(`/api/requests/${id}/approve`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "approve", soClaimData: depts, soClaimComments: comments, soDvmData: dvms, comment: "" })
                        })
                        if (res.ok) {
                          const updated = await res.json()
                          if (updated.status !== "PENDING_SCM") { window.location.href = "/approvals" } else { setReq(updated) }
                        }
                        setSubmitting(null)
                      }}
                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                      {submitting === "_fwd" ? "..." : `Forward ${readyScmStyles.length} ready style(s) →`}
                    </button>
                  )}
                  <button type="button" onClick={() => setSoClaimSelected(
                    soClaimSelected.size === pendingScmItems.length ? new Set() : new Set(pendingScmItems.map((i: any) => i.id))
                  )} className="text-xs text-blue-600 hover:underline">
                    {soClaimSelected.size === pendingScmItems.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
              </div>

              {(() => {
                const scmStyles: string[] = ([...new Set<string>(pendingScmItems.map((i: any) => i.style as string))]).sort()
                const displayedScmItems = scmStyleFilter ? pendingScmItems.filter((i: any) => i.style === scmStyleFilter) : pendingScmItems
                return <>
                  {scmStyles.length > 1 && (
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs text-gray-500 font-medium">Filter style:</span>
                      <button onClick={() => setScmStyleFilter("")}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${!scmStyleFilter ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
                        All ({pendingScmItems.length})
                      </button>
                      {scmStyles.map(s => {
                        const cnt = pendingScmItems.filter((i: any) => i.style === s).length
                        const assigned = pendingScmItems.filter((i: any) => i.style === s && soClaimDepts[i.id]).length
                        return (
                          <button key={s} onClick={() => setScmStyleFilter(scmStyleFilter === s ? "" : s)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${scmStyleFilter === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
                            {s} ({assigned}/{cnt})
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 w-8"></th>
                          {["SO","STYLE","DESCRIPTION","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","FACTORY","COUNTRY","PORT","CLAIM DEPT","DVM","SCM DELAY REASON"].map(h =>
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                    {displayedScmItems.map((item: any) => {
                      const assigned = soClaimDepts[item.id]
                      const selected = soClaimSelected.has(item.id)
                      return (
                        <tr key={item.id} className={`cursor-pointer ${selected ? "bg-blue-50" : assigned ? "bg-green-50" : "bg-red-50 hover:bg-red-100"}`}
                          onClick={() => setSoClaimSelected(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected}
                              onChange={e => setSoClaimSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                              className="w-4 h-4 rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.description}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                          <td className="px-3 py-2">{item.qtyOriginalShipment}</td>
                          <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2 text-blue-700 font-medium">{fmtNum(item.grossWeight, 2)}</td>
                          <td className="px-3 py-2 text-blue-700 font-medium">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2">{item.factory}</td>
                          <td className="px-3 py-2">{item.country}</td>
                          <td className="px-3 py-2">{item.port}</td>
                          <td className="px-3 py-2">
                            {assigned
                              ? <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{assigned}</span>
                              : <span className="text-red-400 text-xs italic">-- Not assigned --</span>}
                          </td>
                          <td className="px-3 py-2 min-w-[160px]" onClick={e => e.stopPropagation()}>
                            {assigned && (dvmUsers[assigned] || []).length > 0 ? (
                              <select value={soDvmAssigned[item.id] || ""}
                                onChange={e => setSoDvmAssigned(p => ({ ...p, [item.id]: e.target.value }))}
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:ring-1 focus:ring-blue-400">
                                <option value="">-- Select DVM --</option>
                                {(dvmUsers[assigned] || []).map((u: any) => (
                                  <option key={u.id} value={u.email}>{u.name}</option>
                                ))}
                              </select>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2 min-w-[200px]" onClick={e => e.stopPropagation()}>
                            {item.reasonDelay && (
                              <div className="mb-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                                MER: {item.reasonDelay}
                              </div>
                            )}
                            <input type="text" placeholder="SCM delay reason..."
                              value={soClaimComments[item.id] || ""}
                              onChange={e => setSoClaimComments(p => ({ ...p, [item.id]: e.target.value }))}
                              className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:ring-1 focus:ring-blue-400" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </>
              })()}

              {/* Batch assign panel */}
              {soClaimSelected.size > 0 && (
                <div className="border border-blue-300 rounded-lg p-3 bg-blue-50 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-blue-700">{soClaimSelected.size} SO selected</span>
                    <select value={batchClaimDept} onChange={e => { setBatchClaimDept(e.target.value); setBatchDvm("") }}
                      className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400">
                      <option value="">-- Select Claim Dept --</option>
                      {CLAIM_DEPTS.map(d => <option key={d} value={d}>{CLAIM_DEPT_LABEL[d] || d}</option>)}
                    </select>
                    {batchClaimDept && (dvmUsers[batchClaimDept] || []).length > 0 && (
                      <select value={batchDvm} onChange={e => setBatchDvm(e.target.value)}
                        className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400">
                        <option value="">-- Select DVM --</option>
                        {(dvmUsers[batchClaimDept] || []).map((u: any) => (
                          <option key={u.id} value={u.email}>{u.name}</option>
                        ))}
                      </select>
                    )}
                    <input type="text" placeholder="Comment / Delay reason..."
                      value={batchComment} onChange={e => setBatchComment(e.target.value)}
                      className="flex-1 min-w-[220px] border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400" />
                    <button type="button" disabled={!batchClaimDept || submitting === "_"}
                      onClick={async () => {
                        const newDepts: Record<string, string> = {}
                        const newComments: Record<string, string> = {}
                        soClaimSelected.forEach(itemId => {
                          newDepts[itemId] = batchClaimDept
                          if (batchComment) newComments[itemId] = batchComment
                        })
                        setSoClaimDepts(prev => ({ ...prev, ...newDepts }))
                        setSoClaimComments(prev => ({ ...prev, ...newComments }))
                        setSoClaimSelected(new Set())
                        setBatchClaimDept("")
                        setBatchComment("")
                        setSubmitting("_")
                        const res = await fetch(`/api/requests/${id}/approve`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "approve", soClaimData: newDepts, soClaimComments: newComments, comment: "" })
                        })
                        if (res.ok) {
                          const updated = await res.json()
                          if (updated.status !== "PENDING_SCM") {
                            window.location.href = "/approvals"
                          } else {
                            setReq(updated)
                          }
                        }
                        setSubmitting(null)
                      }}
                      className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                      {submitting === "_" ? "..." : `Assign & Forward ${soClaimSelected.size} SO(s)`}
                    </button>
                    <button type="button" onClick={() => { setSoClaimSelected(new Set()); setBatchClaimDept(""); setBatchComment("") }}
                      className="text-sm text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LOGISTICS */}
          {req.status === "PENDING_LOGISTICS" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  INVOICE / BOOKING DATE BY SO
                  <span className="text-xs font-normal text-gray-400 ml-2">
                    {pendingLogItems.filter((i: any) => itemLogistics[i.id]?.invoiceNo).length}/{pendingLogItems.length} assigned
                    {forwardedLogItems.length > 0 && <span className="text-green-600 ml-2">· {forwardedLogItems.length} forwarded to Claim</span>}
                  </span>
                </label>
                <button type="button" onClick={() => setLogSelected(
                  logSelected.size === pendingLogItems.length ? new Set() : new Set(pendingLogItems.map((i: any) => i.id))
                )} className="text-xs text-blue-600 hover:underline">
                  {logSelected.size === pendingLogItems.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      {["SO","STYLE","QTY AIR","EST. (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE"].map(h =>
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingLogItems.map((item: any) => {
                      const inv = itemLogistics[item.id]
                      const sel = logSelected.has(item.id)
                      return (
                        <tr key={item.id} className={`cursor-pointer ${sel ? "bg-blue-50" : inv?.invoiceNo ? "bg-green-50" : "hover:bg-gray-50"}`}
                          onClick={() => setLogSelected(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={sel}
                              onChange={e => setLogSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                              className="w-4 h-4 rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{item.so}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                                                    <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                          <td className="px-3 py-2 text-gray-400">{fmtNum(item.airFreight)}</td>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="number" value={itemActuals[item.id] || ""}
                              onChange={e => setItemActuals(p => ({...p,[item.id]:e.target.value}))}
                              placeholder="0" className="w-24 border border-blue-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {inv?.invoiceNo
                              ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{inv.invoiceNo}</span>
                              : <span className="text-gray-300 text-xs italic">--</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {inv?.bookingDate
                              ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{inv.bookingDate}</span>
                              : <span className="text-gray-300 text-xs italic">--</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {logSelected.size > 0 && (
                <div className="border border-blue-300 rounded-lg p-3 bg-blue-50 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-blue-700">{logSelected.size} SO selected</span>
                    <input type="text" placeholder="Invoice No..."
                      value={batchInvoice} onChange={e => setBatchInvoice(e.target.value)}
                      className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 w-44" />
                    <input type="date" value={batchBookingDate} onChange={e => setBatchBookingDate(e.target.value)}
                      className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400" />
                    <button type="button" disabled={!batchInvoice}
                      onClick={() => {
                        setItemLogistics(prev => {
                          const updated = { ...prev }
                          logSelected.forEach(itemId => { updated[itemId] = { invoiceNo: batchInvoice, bookingDate: batchBookingDate } })
                          return updated
                        })
                        setLogSelected(new Set()); setBatchInvoice(""); setBatchBookingDate("")
                      }}
                      className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                      Assign to {logSelected.size} SO(s)
                    </button>
                    <button type="button" onClick={() => { setLogSelected(new Set()); setBatchInvoice(""); setBatchBookingDate("") }}
                      className="text-sm text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {req.status === "PENDING_LOGISTICS" && !activeItems.some((i: any) =>
            itemLogistics[i.id]?.invoiceNo && itemLogistics[i.id]?.bookingDate && itemActuals[i.id]
          ) && (
            <p className="text-xs text-red-500">กรุณาใส่ Invoice No / Booking Date / Actual THB อย่างน้อย 1 SO ก่อน Confirm</p>
          )}

          <div className="flex gap-2">
            {req.status !== "PENDING_SCM" && (
            <button onClick={() => act("approve")}
              disabled={submitting === "_" ||
                (req.status === "PENDING_LOGISTICS" && !pendingLogItems.some((i: any) =>
                  itemLogistics[i.id]?.invoiceNo && itemLogistics[i.id]?.bookingDate && itemActuals[i.id]
                ))}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {submitting === "_" ? "..." : "Confirm"}
            </button>
            )}
            {canReject && (
              <button onClick={() => act("reject")} disabled={submitting === "_"}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {submitting === "_" ? "..." : "Reject"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Logistics edit section — visible to LOGISTICS even after doc moves to PENDING_CLAIM / VP_CLAIM */}
      {role === "LOGISTICS" && (req.status === "PENDING_CLAIM" || req.status === "PENDING_VP_CLAIM" || req.status === "PENDING_VP_NYK") && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 border-b pb-2">LOGISTICS DATA <span className="text-xs font-normal text-gray-400 ml-1">(แก้ไขเพิ่มเติมได้)</span></h2>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  {["SO","STYLE","QTY AIR","EST. (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE"].map(h =>
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeItems.map((item: any) => {
                  const inv = itemLogistics[item.id] ?? { invoiceNo: item.invoiceNo || "", bookingDate: item.bookingDate ? item.bookingDate.slice(0,10) : "" }
                  const sel = logSelected.has(item.id)
                  const complete = inv.invoiceNo && inv.bookingDate && itemActuals[item.id]
                  return (
                    <tr key={item.id} className={`cursor-pointer ${sel ? "bg-blue-50" : complete ? "bg-green-50" : "hover:bg-gray-50"}`}
                      onClick={() => setLogSelected(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={sel}
                          onChange={e => setLogSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                          className="w-4 h-4 rounded border-gray-300" />
                      </td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{item.so}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.style}</td>
                                            <td className="px-3 py-2 font-semibold">{item.qtyRequestAir}</td>
                      <td className="px-3 py-2 text-gray-400">{fmtNum(item.airFreight)}</td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="number" value={itemActuals[item.id] ?? (item.actualAirFreight ?? "")}
                          onChange={e => setItemActuals(p => ({...p,[item.id]:e.target.value}))}
                          placeholder="0" className="w-24 border border-blue-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {inv.invoiceNo
                          ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{inv.invoiceNo}</span>
                          : <span className="text-gray-300 text-xs italic">--</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {inv.bookingDate
                          ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{inv.bookingDate}</span>
                          : <span className="text-gray-300 text-xs italic">--</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {logSelected.size > 0 && (
            <div className="border border-blue-300 rounded-lg p-3 bg-blue-50">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-blue-700">{logSelected.size} SO selected</span>
                <input type="text" placeholder="Invoice No..."
                  value={batchInvoice} onChange={e => setBatchInvoice(e.target.value)}
                  className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 w-44" />
                <input type="date" value={batchBookingDate} onChange={e => setBatchBookingDate(e.target.value)}
                  className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400" />
                <button type="button" disabled={!batchInvoice}
                  onClick={() => {
                    setItemLogistics(prev => {
                      const updated = { ...prev }
                      logSelected.forEach(itemId => { updated[itemId] = { invoiceNo: batchInvoice, bookingDate: batchBookingDate } })
                      return updated
                    })
                    setLogSelected(new Set()); setBatchInvoice(""); setBatchBookingDate("")
                  }}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                  Assign to {logSelected.size} SO(s)
                </button>
                <button type="button" onClick={() => { setLogSelected(new Set()); setBatchInvoice(""); setBatchBookingDate("") }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2">Cancel</button>
              </div>
            </div>
          )}
          <button onClick={saveLogistics} disabled={submitting === "log"}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting === "log" ? "..." : "Save Logistics Data"}
          </button>
        </div>
      )}

      {/* Items table */}
      {!(canAct && isStyleApprover) && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800">ITEMS ({req.items?.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead className="bg-gray-50 border-b">
                <tr>{([["STYLE","min-w-[110px]"],["SO","min-w-[90px]"],["CUSTOMER PO","min-w-[110px]"],["DESCRIPTION","min-w-[160px]"],["ORIG. DATE","min-w-[90px]"],["PLAN DATE","min-w-[90px]"],["QTY ORIG","min-w-[75px]"],["QTY AIR","min-w-[70px]"],["GROSS WEIGHT (KG)","min-w-[110px]"],["EST. AIR FREIGHT (THB)","min-w-[120px]"],["ACTUAL AIR FREIGHT (THB)","min-w-[130px]"],["CLAIM DEPT","min-w-[110px]"],["REASON","min-w-[120px]"],["FACTORY","min-w-[70px]"],["COUNTRY","min-w-[110px]"],["PORT","min-w-[110px]"],["STATUS","min-w-[110px]"]] as [string,string][]).map(([h,w]) =>
                  <th key={h} className={`px-2 py-2 text-left text-gray-600 whitespace-nowrap ${w}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {req.items?.map((item: any) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.itemStatus === "REJECTED" ? "opacity-40" : ""}`}>
                    {["style","so","customerPO","description","originalShipmentDate","planShipmentDate","qtyOriginalShipment","qtyRequestAir","grossWeight","airFreight","actualAirFreight","claimDepartment","reasonDelay","factory","country","port"].map(f => (
                      <td key={f} className="px-2 py-1.5 whitespace-nowrap">
                        {f.includes("Date") ? fmtDate(item[f])
                          : f === "grossWeight" ? fmtNum(item[f], 2)
                          : f === "airFreight" || f === "actualAirFreight" ? fmtNum(item[f])
                          : f === "claimDepartment" ? (isGWRequest ? (req.claimDepartment ?? "-") : (item[f] ?? "-"))
                          : item[f] ?? "-"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      {(() => {
                        const pendingLabel = isGWRequest
                          ? (req.status === "PENDING_PRESIDENT_GW" ? "President GW" : "VP MER GW")
                          : "VP MER"
                        const SD: Record<string, [string, string]> = {
                          PENDING: [pendingLabel, "bg-yellow-100 text-yellow-700"],
                          VP_MER_PASSED: ["SCM", "bg-blue-100 text-blue-700"],
                          PASSED: ["VP SCM", "bg-indigo-100 text-indigo-700"],
                          VP_PASSED: ["President", "bg-purple-100 text-purple-700"],
                          PRES_PASSED: ["Logistics", "bg-cyan-100 text-cyan-700"],
                          LOG_PASSED: ["Claim", "bg-teal-100 text-teal-700"],
                          CLAIM_PASSED: ["VP Claim", "bg-violet-100 text-violet-700"],
                          COMPLETED: ["Done", "bg-green-100 text-green-700"],
                          REJECTED: ["Rejected", "bg-red-100 text-red-700"],
                        }
                        const [label, cls] = SD[item.itemStatus] || ["Pending", "bg-yellow-100 text-yellow-700"]
                        return <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${cls}`}>{label}</span>
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attachments */}
      {(() => {
        const allAttachments: any[] = req.attachments || []
        const canAttach = role === "MER_USER" || role === "SCM_USER"
        const isUploadingReq = uploadingItem === "_req"
        return (
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">ATTACHMENTS {allAttachments.length > 0 && <span className="text-xs font-normal text-gray-400 ml-1">({allAttachments.length})</span>}</h2>
              {canAttach && (
                <label className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border font-medium ${isUploadingReq ? "opacity-50 pointer-events-none bg-gray-50 border-gray-200 text-gray-400" : "border-blue-300 text-blue-600 hover:bg-blue-50"}`}>
                  {isUploadingReq ? "Uploading..." : "📎 Attach File"}
                  <input type="file" className="hidden" disabled={isUploadingReq}
                    onChange={e => { if (e.target.files?.[0]) attachFileFn(e.target.files[0]); e.target.value = "" }} />
                </label>
              )}
            </div>
            {allAttachments.length === 0
              ? <p className="text-center py-5 text-xs text-gray-300">No attachments</p>
              : <div className="divide-y divide-gray-50">
                  {allAttachments.map((att: any) => (
                    <div key={att.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg shrink-0">📎</span>
                        <div className="min-w-0">
                          <a href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                            className="text-sm font-medium text-blue-700 hover:underline truncate block">
                            {att.fileName}
                          </a>
                          <p className="text-xs text-gray-400">
                            {att.uploadedBy?.name}
                            {att.claimDept && <span className="ml-1">({att.claimDept})</span>}
                            {att.itemId && <span className="ml-1 text-gray-300">· SO attached</span>}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 ml-4">{fmtDT(att.createdAt)}</span>
                    </div>
                  ))}
                </div>
            }
          </div>
        )
      })()}

      {/* Approval History */}
      {(() => {
        const logs: any[] = req.approvalLogs || []
        // Split into rounds — new round starts after each BACK_TO_SCM
        const rounds: any[][] = []
        let cur: any[] = []
        for (const log of logs) {
          cur.push(log)
          if (log.action === "BACK_TO_SCM") { rounds.push(cur); cur = [] }
        }
        if (cur.length > 0) rounds.push(cur)
        const latestRound = rounds[rounds.length - 1] || []
        const prevRounds = rounds.slice(0, rounds.length - 1)
        const logRow = (log: any) => (
          <div key={log.id} className="px-5 py-3 flex justify-between">
            <div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${log.action === "APPROVE" ? "bg-green-100 text-green-700" : log.action === "REJECT" ? "bg-red-100 text-red-700" : log.action === "BACK_TO_SCM" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{log.action}</span>
              <span className="text-xs text-gray-500 ml-2">{log.user?.name} ({log.user?.role})</span>
              {log.comment && <p className="text-xs text-gray-400 mt-0.5">{log.comment}</p>}
              <p className="text-xs text-gray-300 mt-0.5">{STATUS_LABELS[log.fromStatus]} → {STATUS_LABELS[log.toStatus]}</p>
            </div>
            <span className="text-xs text-gray-400">{fmtDT(log.createdAt)}</span>
          </div>
        )
        return (
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">APPROVAL HISTORY</h2>
            </div>
            {logs.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">No history yet</p>}
            <div className="divide-y">{latestRound.map(logRow)}</div>
            {prevRounds.length > 0 && (
              <details className="border-t">
                <summary className="px-5 py-2 text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  Previous rounds ({prevRounds.length}) — click to expand
                </summary>
                {prevRounds.map((round, ri) => (
                  <div key={ri} className="border-t border-dashed border-gray-200">
                    <div className="px-5 py-1.5 bg-gray-50 text-xs text-gray-400 font-medium">Round {ri + 1}</div>
                    <div className="divide-y">{round.map(logRow)}</div>
                  </div>
                ))}
              </details>
            )}
          </div>
        )
      })()}
    </div>
  )
}
