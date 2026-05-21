"use client"
import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { StatusBadge } from "@/components/ui/status-badge"
import { ROLE_ACTIONS, STATUS_LABELS, STYLE_APPROVER_STATUSES } from "@/types"
import { PdfDownloadButton } from "@/components/pdf-download-button"

const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtDT = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

const CLAIM_DEPTS = ["COMMERCIAL", "PROCUREMENT", "NYK", "PRODUCTION"]

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
  const [soClaimSelected, setSoClaimSelected] = useState<Set<string>>(new Set())
  const [batchClaimDept, setBatchClaimDept] = useState("")
  const [batchComment, setBatchComment] = useState("")
  const [soClaimComments, setSoClaimComments] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [rejectingStyle, setRejectingStyle] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState("")
  const [rejectingSo, setRejectingSo] = useState<string | null>(null)
  const [rejectSoComment, setRejectSoComment] = useState("")
  const [backToScmSo, setBackToScmSo] = useState<string | null>(null)
  const [backToScmSoComment, setBackToScmSoComment] = useState("")
  const [backToScmComment, setBackToScmComment] = useState("")
  const [backToScmStyleOpen, setBackToScmStyleOpen] = useState<string | null>(null)
  const [backToScmStyleComment, setBackToScmStyleComment] = useState("")
  const [uploadingItem, setUploadingItem] = useState<string | null>(null)
  const [dvmSelected, setDvmSelected] = useState<Set<string>>(new Set())

   useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then(r => r.json())
      .then(d => {
        setReq(d)
        setLoading(false)
        if (d.status === "PENDING_SCM" && d.items) {
          const depts: Record<string, string> = {}
          const comments: Record<string, string> = {}
          d.items.forEach((item: any) => {
            if (item.claimDepartment) depts[item.id] = item.claimDepartment
            if (item.itemComment) comments[item.id] = item.itemComment
          })
          if (Object.keys(depts).length > 0) setSoClaimDepts(depts)
          if (Object.keys(comments).length > 0) setSoClaimComments(comments)
        }
        if (d.status === "PENDING_LOGISTICS" && d.items) {
          const logistics: Record<string, { invoiceNo: string; bookingDate: string }> = {}
          const actuals: Record<string, string> = {}
          d.items.filter((i: any) => i.itemStatus === "PENDING").forEach((item: any) => {
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
  const canAct = req && ROLE_ACTIONS[role]?.includes(req.status)
  const isStyleApprover = req && STYLE_APPROVER_STATUSES.includes(req.status)
  const CLAIM_VP_ROLES_LOCAL = ["VP_COMMERCIAL", "VP_PROCUREMENT", "VP_NYK", "VP_PRODUCTION"]
  const isDvmClaim = canAct && (req?.status === "PENDING_CLAIM") && (role.startsWith("DVM_") || role.startsWith("CLAIM_"))
  const isVpClaim = canAct && (req?.status === "PENDING_VP_CLAIM") && CLAIM_VP_ROLES_LOCAL.includes(role)
  const isClaimApprover = isDvmClaim || isVpClaim
  const claimDept = role.startsWith("DVM_") ? role.replace("DVM_", "") : role.startsWith("CLAIM_") ? role.replace("CLAIM_", "") : CLAIM_VP_ROLES_LOCAL.includes(role) ? role.replace("VP_", "") : ""
  // keep claimDeptRole as alias for backward-compat references inside JSX
  const claimDeptRole = claimDept
  const myClaimItems = req?.items?.filter((i: any) => i.claimDepartment === claimDept) || []
  const isVpScmAtScm = role === "VP_SCM" && req?.status === "PENDING_SCM"
  const canReject = canAct && !isStyleApprover && !isClaimApprover && req.status !== "PENDING_SCM" && req.status !== "PENDING_LOGISTICS"

  const styleGroups = useMemo(() => {
    if (!req?.items) return []
    const groups: Record<string, any[]> = {}
    for (const item of req.items) {
      if (!groups[item.style]) groups[item.style] = []
      groups[item.style].push(item)
    }
    return Object.entries(groups).map(([style, items]) => {
      const nonRej = items.filter((i: any) => i.itemStatus !== "REJECTED")
      const status = nonRej.length === 0 ? "REJECTED"
        : nonRej.every((i: any) => i.itemStatus === "VP_PASSED") ? "VP_PASSED"
        : nonRej.every((i: any) => i.itemStatus === "PASSED") ? "PASSED"
        : "PENDING"
      return { style, items, status }
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
  const pendingLogItems = req?.status === "PENDING_LOGISTICS" ? activeItems.filter((i: any) => i.itemStatus === "PENDING") : activeItems
  const forwardedLogItems = req?.status === "PENDING_LOGISTICS" ? activeItems.filter((i: any) => i.itemStatus === "PASSED") : []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{req.documentNo}</h1>
        <StatusBadge status={req.status} />
        {role === "MER_USER" && req.status === "PENDING_VP_MER" && (
          <button onClick={async () => {
            if (!confirm("Delete this request?")) return
            const res = await fetch(`/api/requests/${id}`, { method: "DELETE" })
            if (res.ok) router.push("/requests")
          }} className="ml-auto text-sm text-red-500 border border-red-300 px-3 py-1 rounded-lg hover:text-red-700">
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
      {canAct && isStyleApprover && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">STYLES ({styleGroups.length})</h2>
            <div className="flex gap-4 text-xs font-medium">
              <span className="text-yellow-600">{styleGroups.filter(g => g.status === "PENDING").length} pending</span>
              <span className="text-green-600">{styleGroups.filter(g => g.status === "PASSED").length} approved</span>
              <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isBackScm = backToScmStyleOpen === g.style
            const isSub = submitting === g.style
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${g.status === "PASSED" ? "border-green-200" : g.status === "REJECTED" ? "border-red-200" : isBackScm ? "border-orange-200" : "border-gray-200"}`}>
                <div className={`flex items-center gap-3 px-4 py-3 ${g.status === "PASSED" ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : "bg-white"}`}>
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 flex-1">{g.style}</span>
                  <span className="text-xs text-gray-400">{g.items.length} SO(s)</span>
                  {g.status === "PASSED" && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>}
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
                        <tr>{["SO","CUSTOMER PO","DESCRIPTION","GMT","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","ACTUAL AIR FREIGHT (THB)","REASON","FACTORY","COUNTRY","PORT"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
                            <td className="px-3 py-2">{item.customerPO}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2">{item.gmtType}</td>
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
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">STYLE APPROVAL — VP SCM</h2>
            <div className="flex gap-4 text-xs font-medium">
              <span className="text-gray-400">{styleGroups.filter(g => g.status === "PENDING").length} waiting for SCM</span>
              <span className="text-blue-600">{styleGroups.filter(g => g.status === "PASSED").length} ready to approve</span>
              <span className="text-green-600">{styleGroups.filter(g => g.status === "VP_PASSED").length} approved</span>
              <span className="text-red-600">{styleGroups.filter(g => g.status === "REJECTED").length} rejected</span>
            </div>
          </div>
          {styleGroups.map(g => {
            const isExp = expanded.has(g.style)
            const isRej = rejectingStyle === g.style
            const isBackScm = backToScmStyleOpen === g.style
            const isSub = submitting === g.style
            const isReady = g.status === "PASSED"
            const isApproved = g.status === "VP_PASSED"
            const isWaiting = g.status === "PENDING"
            return (
              <div key={g.style} className={`rounded-xl border overflow-hidden ${isApproved ? "border-green-200" : isRej || g.status === "REJECTED" ? "border-red-200" : isBackScm ? "border-orange-200" : isWaiting ? "border-gray-200 opacity-60" : "border-blue-200"}`}>
                <div className={`flex items-center gap-3 px-4 py-3 ${isApproved ? "bg-green-50" : g.status === "REJECTED" ? "bg-red-50" : isBackScm ? "bg-orange-50" : isWaiting ? "bg-gray-50" : "bg-blue-50"}`}>
                  <button onClick={() => toggleExpand(g.style)} className="text-gray-400 hover:text-gray-700 w-5 text-center">{isExp ? "▼" : "▶"}</button>
                  <span className="font-semibold text-gray-800 flex-1">{g.style}</span>
                  <span className="text-xs text-gray-400">{g.items.length} SO(s)</span>
                  {isWaiting && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Waiting for SCM</span>}
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
                        {["SO","CLAIM DEPT","DELAY REASON","QTY AIR","GROSS WEIGHT (KG)","EST. FREIGHT (THB)"].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.so}</td>
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

      {/* DVM CLAIM per-SO approval with checkbox forwarding */}
      {isDvmClaim && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">SO APPROVAL — DVM {claimDept} ({myClaimItems.length})</h2>
            <div className="flex gap-4 text-xs font-medium">
              <span className="text-yellow-600">{myClaimItems.filter((i:any) => i.itemStatus === "PENDING").length} pending</span>
              <span className="text-green-600">{myClaimItems.filter((i:any) => i.itemStatus === "PASSED").length} forwarded</span>
              <span className="text-red-600">{myClaimItems.filter((i:any) => i.itemStatus === "REJECTED").length} rejected</span>
            </div>
          </div>

          {/* Select all / deselect all */}
          {myClaimItems.some((i: any) => i.itemStatus === "PENDING") && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => {
                const pendingIds = myClaimItems.filter((i: any) => i.itemStatus === "PENDING").map((i: any) => i.id)
                setDvmSelected(prev => prev.size === pendingIds.length ? new Set() : new Set(pendingIds))
              }} className="text-xs text-blue-600 hover:underline">
                {dvmSelected.size === myClaimItems.filter((i: any) => i.itemStatus === "PENDING").length ? "Deselect All" : "Select All Pending"}
              </button>
            </div>
          )}

          {myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED").map((item: any) => {
            const isRej = rejectingSo === item.id
            const isSub = submitting === item.id
            const itemAttachments = (req.attachments || []).filter((a: any) => a.itemId === item.id)
            const isUploading = uploadingItem === item.id
            const isPending = item.itemStatus === "PENDING"
            const isPassed = item.itemStatus === "PASSED"
            const isChecked = dvmSelected.has(item.id)
            return (
              <div key={item.id} className={`rounded-xl border overflow-hidden ${isPassed ? "border-green-200" : "border-gray-200"}`}>
                <div className={`flex items-center gap-3 px-4 py-3 ${isPassed ? "bg-green-50" : "bg-white"}`}>
                  {/* Checkbox — only for PENDING items */}
                  {isPending ? (
                    <input type="checkbox" checked={isChecked}
                      onChange={e => setDvmSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(item.id) : n.delete(item.id); return n })}
                      className="w-4 h-4 rounded border-gray-300 shrink-0" />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <span className="font-semibold text-gray-800 w-28">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                  {isPassed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Forwarded to VP</span>}
                  {/* Attach file button */}
                  <label className={`cursor-pointer text-xs px-2 py-1 rounded border ${isUploading ? "opacity-50 pointer-events-none" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    {isUploading ? "Uploading..." : "📎 Attach"}
                    <input type="file" className="hidden" disabled={isUploading}
                      onChange={e => { if (e.target.files?.[0]) attachFileFn(e.target.files[0], item.id); e.target.value = "" }} />
                  </label>
                  {isPending && !isPassed && (
                    <div className="flex gap-2">
                      <button onClick={() => { setBackToScmSo(backToScmSo === item.id ? null : item.id); setBackToScmSoComment(""); setRejectingSo(null) }} disabled={isSub}
                        className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                        Back to SCM
                      </button>
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
                        <span className="text-gray-400 font-normal">· {att.uploadedBy?.name} ({att.claimDept || att.uploadedBy?.role})</span>
                      </a>
                    ))}
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
              </div>
            )
          })}

          {/* Forward selected SOs to VP */}
          {dvmSelected.size > 0 && (
            <div className="border border-violet-300 rounded-lg p-3 bg-violet-50 flex items-center gap-3">
              <span className="text-xs font-semibold text-violet-700">{dvmSelected.size} SO(s) selected</span>
              <button
                disabled={submitting === "_dvm"}
                onClick={async () => {
                  setSubmitting("_dvm")
                  const res = await fetch(`/api/requests/${id}/approve`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "forward_dvm_sos", itemIds: [...dvmSelected], comment: "" })
                  })
                  if (res.ok) {
                    const updated = await res.json()
                    if (updated.status !== "PENDING_CLAIM") {
                      window.location.href = "/approvals"
                    } else {
                      setReq(updated)
                      setDvmSelected(new Set())
                    }
                  } else { const err = await res.json(); alert(err.error || "Error") }
                  setSubmitting(null)
                }}
                className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50">
                {submitting === "_dvm" ? "..." : `Forward ${dvmSelected.size} SO(s) to VP`}
              </button>
              <button type="button" onClick={() => setDvmSelected(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* VP CLAIM per-SO approval */}
      {isVpClaim && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">SO APPROVAL — VP {claimDept} ({myClaimItems.length})</h2>
            <div className="flex gap-4 text-xs font-medium">
              <span className="text-yellow-600">{myClaimItems.filter((i:any) => i.itemStatus === "PENDING").length} pending</span>
              <span className="text-green-600">{myClaimItems.filter((i:any) => i.itemStatus === "PASSED").length} approved</span>
              <span className="text-red-600">{myClaimItems.filter((i:any) => i.itemStatus === "REJECTED").length} rejected</span>
            </div>
          </div>

          {/* Show all attachments for the request so VP can review documents */}
          {(req.attachments || []).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-2">ATTACHMENTS (SCM / MER / DVM)</p>
              <div className="flex flex-wrap gap-2">
                {(req.attachments || []).map((att: any) => (
                  <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs bg-white border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100 font-medium">
                    📎 {att.fileName}
                    <span className="text-gray-400 font-normal">· {att.uploadedBy?.name} ({att.claimDept || att.uploadedBy?.role})</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {myClaimItems.filter((i: any) => i.itemStatus !== "REJECTED").map((item: any) => {
            const isRej = rejectingSo === item.id
            const isSub = submitting === item.id
            const itemAttachments = (req.attachments || []).filter((a: any) => a.itemId === item.id)
            const isUploading = uploadingItem === item.id
            return (
              <div key={item.id} className={`rounded-xl border overflow-hidden ${item.itemStatus === "PASSED" ? "border-green-200" : "border-gray-200"}`}>
                <div className={`flex items-center gap-3 px-4 py-3 ${item.itemStatus === "PASSED" ? "bg-green-50" : "bg-white"}`}>
                  <span className="font-semibold text-gray-800 w-28">{item.so}</span>
                  <span className="text-xs text-gray-500 flex-1">{item.style} · {item.description} · qty {item.qtyRequestAir}</span>
                  {item.itemStatus === "PASSED" && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>}
                  <label className={`cursor-pointer text-xs px-2 py-1 rounded border ${isUploading ? "opacity-50 pointer-events-none" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    {isUploading ? "Uploading..." : "📎 Attach"}
                    <input type="file" className="hidden" disabled={isUploading}
                      onChange={e => { if (e.target.files?.[0]) attachFileFn(e.target.files[0], item.id); e.target.value = "" }} />
                  </label>
                  {item.itemStatus === "PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={() => approveSo(item.id)} disabled={isSub}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {isSub && !isRej ? "..." : "Approve"}
                      </button>
                      <button onClick={() => { setRejectingSo(isRej ? null : item.id); setRejectSoComment("") }} disabled={isSub}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50">
                        Reject
                      </button>
                      <button onClick={() => { setBackToScmSo(backToScmSo === item.id ? null : item.id); setBackToScmSoComment(""); setRejectingSo(null) }} disabled={isSub}
                        className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                        Back to SCM
                      </button>
                    </div>
                  )}
                </div>
                {itemAttachments.length > 0 && (
                  <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex flex-wrap gap-2">
                    {itemAttachments.map((att: any) => (
                      <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs bg-white border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100 font-medium">
                        📎 {att.fileName}
                        <span className="text-gray-400 font-normal">· {att.uploadedBy?.name} ({att.claimDept || att.uploadedBy?.role})</span>
                      </a>
                    ))}
                  </div>
                )}
                {isRej && (
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
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      {canAct && !isStyleApprover && !isClaimApprover && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">ACTIONS</h2>

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
                <button type="button" onClick={() => setSoClaimSelected(
                  soClaimSelected.size === pendingScmItems.length ? new Set() : new Set(pendingScmItems.map((i: any) => i.id))
                )} className="text-xs text-blue-600 hover:underline">
                  {soClaimSelected.size === pendingScmItems.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      {["SO","STYLE","DESCRIPTION","GMT","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","FACTORY","COUNTRY","PORT","CLAIM DEPT","SCM DELAY REASON"].map(h =>
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingScmItems.map((item: any) => {
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
                          <td className="px-3 py-2">{item.gmtType}</td>
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

              {/* Batch assign panel */}
              {soClaimSelected.size > 0 && (
                <div className="border border-blue-300 rounded-lg p-3 bg-blue-50 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-blue-700">{soClaimSelected.size} SO selected</span>
                    <select value={batchClaimDept} onChange={e => setBatchClaimDept(e.target.value)}
                      className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400">
                      <option value="">-- Select Claim Dept --</option>
                      {CLAIM_DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
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
                      {["SO","STYLE","GMT","QTY AIR","EST. (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE"].map(h =>
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
                          <td className="px-3 py-2">{item.gmtType}</td>
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
                  {["SO","STYLE","GMT","QTY AIR","EST. (THB)","ACTUAL (THB)","INVOICE NO","BOOKING DATE"].map(h =>
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
                      <td className="px-3 py-2">{item.gmtType}</td>
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
                <tr>{([["STYLE","min-w-[110px]"],["SO","min-w-[90px]"],["CUSTOMER PO","min-w-[110px]"],["DESCRIPTION","min-w-[160px]"],["GMT","min-w-[60px]"],["ORIG. DATE","min-w-[90px]"],["PLAN DATE","min-w-[90px]"],["QTY ORIG","min-w-[75px]"],["QTY AIR","min-w-[70px]"],["GROSS WEIGHT (KG)","min-w-[110px]"],["EST. AIR FREIGHT (THB)","min-w-[120px]"],["ACTUAL AIR FREIGHT (THB)","min-w-[130px]"],["CLAIM DEPT","min-w-[110px]"],["REASON","min-w-[120px]"],["FACTORY","min-w-[70px]"],["COUNTRY","min-w-[110px]"],["PORT","min-w-[110px]"],["STATUS","min-w-[75px]"],["","min-w-[60px]"]] as [string,string][]).map(([h,w]) =>
                  <th key={h} className={`px-2 py-2 text-left text-gray-600 whitespace-nowrap ${w}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {req.items?.map((item: any) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.itemStatus === "REJECTED" ? "opacity-40" : ""}`}>
                    {["style","so","customerPO","description","gmtType","originalShipmentDate","planShipmentDate","qtyOriginalShipment","qtyRequestAir","grossWeight","airFreight","actualAirFreight","claimDepartment","reasonDelay","factory","country","port"].map(f => (
                      <td key={f} className="px-2 py-1.5 whitespace-nowrap">
                        {f.includes("Date") ? fmtDate(item[f])
                          : f === "grossWeight" ? fmtNum(item[f], 2)
                          : f === "airFreight" || f === "actualAirFreight" ? fmtNum(item[f])
                          : item[f] ?? "-"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.itemStatus === "PASSED" ? "bg-green-100 text-green-700" : item.itemStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {item.itemStatus === "PASSED" ? "Approved" : item.itemStatus === "REJECTED" ? "Rejected" : "Pending"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <PdfDownloadButton req={req} item={item} compact />
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
