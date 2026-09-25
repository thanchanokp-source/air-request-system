"use client"

import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL, buColor, fmtDate, fmt } from "../_StageWork"
import { pcApprover } from "@/lib/pull-approvers"
import { pullReqType } from "@/lib/pull-reqtype"
import { buildRequesters } from "@/lib/pull-requesters"
import { MultiSelect } from "@/components/ui/multi-select"
import { exportPullReport } from "@/lib/pull-report-xlsx"

// Pipeline steps branch by request type. Each status maps to the CURRENT (in-progress) step index;
// steps before it are done. cur >= steps.length → fully done.
const PC_STEPS = ["PC Req", "DVM App", "LG"]
const SCM_STEPS = ["SCM Req", "Purchase", "SCM Decision", "SCM App·1", "SCM App·2", "LG"]
const PC_CUR: Record<string, number> = { PENDING_PURCHASING: 1, PENDING_PC_DECISION: 1, PENDING_VP_PUR: 1, PENDING_DVM_PUR: 1, APPROVED: 2, COMPLETED: 3 }
const SCM_CUR: Record<string, number> = { PENDING_PURCHASING: 1, PENDING_LOGISTICS: 1, PENDING_SCM_DECISION: 2, PENDING_DVM_SCM: 3, PENDING_VP_SCM: 4, PENDING_FINAL: 4, APPROVED: 5, COMPLETED: 6 }

// Human status per request type (what stage it's WAITING on).
//   PC:  Waiting DVM approve → Waiting for LG → Completed
//   SCM: Waiting Purchase → Waiting SCM air decision → Waiting SCM approve → Waiting for LG → Completed
function pullStatus(rq: any): string {
  const s = rq.status
  if (s === "COMPLETED") return "Completed"
  if (s === "APPROVED") return "Waiting for LG"
  if (s === "RECALLED") return "Recalled"
  if (s === "REJECTED") return "Rejected"
  if (s === "NO_AIR") return "No air"
  if ((rq.requestType || "SCM") === "PURCHASING") return "Waiting DVM approve"
  if (s === "PENDING_PURCHASING") return "Waiting Purchase"
  if (s === "PENDING_SCM_DECISION") return "Waiting SCM air decision"
  if (["PENDING_DVM_SCM", "PENDING_VP_SCM", "PENDING_FINAL"].includes(s)) return "Waiting SCM approve"
  if (s === "PENDING_LOGISTICS") return "Waiting for LG"
  return STATUS_LABEL[s] || s
}

export default function Page() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const isScmPull = roles.includes("SCM_PULL")
  const isPurchasing = roles.includes("PURCHASING")
  const isLgImport = roles.includes("LOGISTICS_IMPORT")
  const isMer = roles.some((r: string) => /^(MER_|DVM_MER|VP_MER)/.test(r))
  const canUse = isAdmin || isScmPull || isPurchasing || isLgImport || isMer
  // Who may see BOTH types (with the tab): admin, LG (handles both), or a person holding both roles.
  // A pure SCM / pure Purchasing user sees ONLY their own request type.
  const canSeeBoth = isAdmin || isLgImport || (isScmPull && isPurchasing)
  const userId = (session?.user as any)?.id
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [statusF, setStatusF] = useState("")
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING" | "SAMPLE">("ALL")
  const [docF, setDocF] = useState<string[]>([])
  const [poF, setPoF] = useState<string[]>([])
  const [reqF, setReqF] = useState<string[]>([])
  const [pdfing, setPdfing] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState("")
  const [viewRq, setViewRq] = useState<any>(null)   // read-only document view (like DVM Purchase)
  const [exporting, setExporting] = useState(false) // full-data Excel report of whatever is filtered
  const [editRq, setEditRq] = useState<any>(null)   // edit a recalled doc before resubmit
  const [editForm, setEditForm] = useState<any>({})
  const [editPkgs, setEditPkgs] = useState<{ uom: string; qty: string }[]>([])
  const [cities, setCities] = useState<any[]>([])
  useEffect(() => { fetch("/api/pull-material/cities").then(r => r.json()).then(d => setCities(d.rows || [])).catch(() => {}) }, [])

  const openEdit = (rq: any) => {
    const its = rq.items || []
    const d0 = its.find((x: any) => x.weight != null) || its[0] || {}
    setEditForm({ country: d0.country || "", port: d0.port || "", city: d0.city || "", incoterm: d0.incoterm || "", pickup: d0.pickupAddress || "", needDate: d0.needDate ? String(d0.needDate).slice(0, 10) : "", weight: d0.weight != null ? String(d0.weight) : "", remark: rq.remark || "" })
    setEditPkgs(Array.isArray(rq.packages) && rq.packages.length ? rq.packages.map((p: any) => ({ uom: p.uom, qty: String(p.qty) })) : [{ uom: "", qty: "" }])
    setEditRq(rq)
  }
  const saveEdit = async () => {
    const f = editForm
    if (!String(f.country).trim()) return alert("กรอก Country")
    if (!String(f.port).trim()) return alert("กรอก Air Port")
    if (!f.incoterm) return alert("เลือก Incoterm")
    if (["EX-WORK", "FCA"].includes(f.incoterm) && !String(f.pickup).trim()) return alert(`${f.incoterm} ต้องระบุ Pickup address`)
    if (!(Number(f.weight) > 0)) return alert("กรอกน้ำหนัก (kg)")
    const pkgs = editPkgs.map(p => ({ uom: p.uom.trim(), qty: Number(p.qty) || 0 })).filter(p => p.uom && p.qty > 0)
    if (!pkgs.length) return alert("เพิ่ม Package อย่างน้อย 1 บรรทัด")
    if (!confirm(`บันทึกการแก้ไข ${editRq.documentNo} และส่งเข้า flow อีกครั้ง (Resubmit)?`)) return
    setBusy(editRq.id)
    try {
      const its = editRq.items || []
      const itemUpdates = its.map((it: any, i: number) => ({
        id: it.id, country: f.country, port: f.port, city: f.city, incoterm: f.incoterm,
        pickupAddress: ["EX-WORK", "FCA"].includes(f.incoterm) ? f.pickup : "",
        needDate: f.needDate || null, cartons: pkgs.reduce((s, x) => s + x.qty, 0),
        weight: i === 0 ? Number(f.weight) : null,
      }))
      const start = (editRq.requestType || "SCM") === "PURCHASING" ? "PENDING_VP_PUR" : "PENDING_PURCHASING"
      const r = await fetch(`/api/pull-material/${editRq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates, packages: pkgs, remark: f.remark || null, status: start }),
      })
      if (r.ok) { setEditRq(null); await load() } else { const d = await r.json().catch(() => ({})); alert(d.error || "Error") }
    } finally { setBusy(null) }
  }

  // Build the document PDF and open it in a preview popup (with a Download button inside).
  const openPdf = async (rq: any) => {
    setPdfing(rq.id)
    try {
      const [{ pdf }, { PullMaterialPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/pull-material-pdf")])
      const blob = await pdf(React.createElement(PullMaterialPdf, { req: rq }) as any).toBlob()
      const url = URL.createObjectURL(blob)
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
      setPreviewName(`${rq.documentNo}.pdf`)
    } catch (e) { console.error(e); alert("PDF generation failed") } finally { setPdfing(null) }
  }
  const closePdf = () => setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
  const downloadPdf = () => { if (!previewUrl) return; const a = document.createElement("a"); a.href = previewUrl; a.download = previewName; document.body.appendChild(a); a.click(); document.body.removeChild(a) }

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

  // Creator (or admin) can RECALL a document that hasn't been approved yet — withdraws it
  // from the flow (soft, non-destructive) instead of deleting.
  const recall = async (rq: any) => {
    const reason = prompt(`Recall ${rq.documentNo}\n\nEveryone who worked on it (Purchasing / LG / SCM) will be notified.\nEnter the reason for recall:`)
    if (reason === null) return
    if (!reason.trim()) { alert("A reason is required to recall."); return }
    setBusy(rq.id)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RECALLED", recallReason: reason.trim() }),
      })
      if (r.ok) await load()
      else { const d = await r.json().catch(() => ({})); alert(d.error || "Recall failed") }
    } finally { setBusy(null) }
  }

  // Hard delete — admin only. Removes the document + its items/attachments (cascade). Irreversible.
  const del = async (rq: any) => {
    if (!confirm(`⚠️ ลบเอกสาร ${rq.documentNo} ถาวร?\n\nจะลบ items + ไฟล์แนบทั้งหมด กู้คืนไม่ได้\nยืนยันเฉพาะเมื่อแน่ใจจริงๆ`)) return
    setBusy(rq.id)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, { method: "DELETE" })
      if (r.ok) await load()
      else { const d = await r.json().catch(() => ({})); alert(d.error || "Delete failed") }
    } finally { setBusy(null) }
  }

  // Resubmit a recalled document → back into the normal flow (PC → DVM approve · SCM → Purchasing),
  // which re-sends the stage emails as usual.
  const resubmit = async (rq: any) => {
    const start = (rq.requestType || "SCM") === "PURCHASING" ? "PENDING_VP_PUR" : "PENDING_PURCHASING"
    const to = start === "PENDING_VP_PUR" ? "DVM Purchase (approval)" : "Purchasing"
    if (!confirm(`ส่ง ${rq.documentNo} เข้า flow อีกครั้ง?\nจะกลับไปที่ขั้น "${to}" และแจ้งเมลตามปกติ`)) return
    setBusy(rq.id)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: start }),
      })
      if (r.ok) await load()
      else { const d = await r.json().catch(() => ({})); alert(d.error || "Resubmit failed") }
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Pull RM / Admin only</p></div>

  // Non-admin single-role users are locked to their own request type; only "canSeeBoth" uses the tab.
  const effType: "ALL" | "SCM" | "PURCHASING" | "SAMPLE" = canSeeBoth ? typeF : (isPurchasing ? "PURCHASING" : isScmPull ? "SCM" : "ALL")
  // Filter option lists (from the loaded docs, respecting the type tab).
  const scopeReqs = reqs.filter(rq => effType === "ALL" || pullReqType(rq) === effType)
  const docNos = [...new Set(scopeReqs.map(r => r.documentNo).filter(Boolean))].sort()
  const pos = [...new Set(scopeReqs.flatMap(r => (r.items || []).map((i: any) => i.poNoDoc)).filter(Boolean))].sort()
  // Requester filter + display: buildRequesters strips the @domain, MERGES the same person even when the
  // name was stored inconsistently ("sudarat" vs "sudarat.r" vs a full email), and picks the cleanest name.
  // One source of truth so the list, the filter and the card all show ONE consistent name per person.
  const { options: requesters, displayOf } = buildRequesters(scopeReqs)
  const shown = scopeReqs.filter(rq => {
    if (statusF && rq.status !== statusF) return false
    if (docF.length && !docF.includes(rq.documentNo)) return false
    if (poF.length && !(rq.items || []).some((i: any) => poF.includes(i.poNoDoc))) return false
    if (reqF.length && !reqF.includes(displayOf(rq))) return false
    return true
  })

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>TRACKING DOCUMENT</h1></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {/* Request type tab — only for admin / LG / dual-role. Pure SCM or PC users are auto-locked. */}
      {canSeeBoth && (
      <div className="flex gap-1.5">
        {([["ALL", "ทั้งหมด"], ["SCM", "SCM request"], ["PURCHASING", "Purchasing request"], ["SAMPLE", "🧪 Sample"]] as const).map(([v, label]) => {
          const n = v === "ALL" ? reqs.length : reqs.filter(r => pullReqType(r) === v).length
          return (
            <button key={v} onClick={() => setTypeF(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${typeF === v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
              style={typeF === v ? { background: MAROON } : undefined}>{label} <span className="opacity-70">({n})</span></button>
          )
        })}
      </div>
      )}

      {/* Filters — separate boxes (Doc No · PO · Status) */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="w-52"><MultiSelect label="Doc No…" options={docNos} value={docF} onChange={setDocF} /></div>
        <div className="w-52"><MultiSelect label="PO…" options={pos} value={poF} onChange={setPoF} /></div>
        <div className="w-52"><MultiSelect label="Requester…" options={requesters} value={reqF} onChange={setReqF} /></div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">All statuses</option>
          {Object.keys(STATUS_LABEL).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {(docF.length || poF.length || reqF.length || statusF || typeF !== "ALL") && <button onClick={() => { setDocF([]); setPoF([]); setReqF([]); setStatusF(""); setTypeF("ALL") }} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg">Clear</button>}
        <span className="text-xs text-gray-400 ml-auto">{shown.length} / {reqs.length}</span>
        {/* Full data report (1 row per PO, all est/actual/mode/FWD columns) for the current filter. */}
        <button onClick={async () => { setExporting(true); try { await exportPullReport(shown) } finally { setExporting(false) } }}
          disabled={exporting || shown.length === 0}
          className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50"
          title="ดาวน์โหลดข้อมูลทั้งหมดตามตัวกรองเป็น Excel">
          {exporting ? "กำลังสร้าง…" : `📊 Export Excel (${shown.length})`}
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        shown.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">{reqs.length === 0 ? "No documents yet" : "No documents match the filter"}</div> :
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {["Document", "PO", "Progress", "Status", ""].map((h, i) =>
                    <th key={i} className="px-4 py-2.5 font-medium whitespace-nowrap text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map(rq => {
                  const rowPos = [...new Set((rq.items || []).map((i: any) => i.poNoDoc).filter(Boolean))] as string[]
                  const isPC = (rq.requestType || "SCM") === "PURCHASING"
                  const steps = isPC ? PC_STEPS : SCM_STEPS
                  const cur = isPC ? (PC_CUR[rq.status] ?? 1) : (SCM_CUR[rq.status] ?? 1)
                  const stopped = ["RECALLED", "REJECTED", "NO_AIR"].includes(rq.status)
                  const done = cur >= steps.length
                  const waitName = rq.status === "APPROVED" ? "Logistics"
                    : (isPC && rq.status === "PENDING_VP_PUR") ? (pcApprover(rq.bu)?.split("@")[0] || "DVM Purchase")
                    : (steps[cur] || "")
                  const waitDays = Math.max(0, Math.floor((Date.now() - new Date(rq.updatedAt || rq.createdAt).getTime()) / 86400000))
                  return (
                    <tr key={rq.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-blue-700">{rq.documentNo}</div>
                        <div className="text-[11px] text-gray-400">{displayOf(rq)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-[220px] truncate" title={rowPos.join(", ")}>{rowPos.join(", ") || "-"}</td>
                      <td className="px-4 py-3">
                        {stopped ? <span className="text-xs text-gray-400">— {STATUS_LABEL[rq.status] || rq.status}</span> : (
                          <div style={{ minWidth: steps.length * 62 }}>
                            {/* dots + connectors */}
                            <div className="flex items-center">
                              {steps.map((s, i) => (
                                <React.Fragment key={s}>
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ background: i < cur ? "#2f7d54" : i === cur ? MAROON : "#e3dccf", boxShadow: i === cur ? `0 0 0 4px ${MAROON}22` : undefined }} />
                                  {i < steps.length - 1 && <span className="h-0.5 flex-1 min-w-[14px]" style={{ background: i < cur ? "#2f7d54" : "#e3dccf" }} />}
                                </React.Fragment>
                              ))}
                            </div>
                            {/* labels under each dot */}
                            <div className="flex mt-1">
                              {steps.map((s, i) => (
                                <span key={s} className={`flex-1 text-[8.5px] uppercase tracking-wide ${i === 0 ? "text-left" : i === steps.length - 1 ? "text-right" : "text-center"}`}
                                  style={{ color: i < cur ? "#2f7d54" : i === cur ? MAROON : "#b7ada1", fontWeight: i === cur ? 800 : 500 }}>{s}</span>
                              ))}
                            </div>
                            {/* waiting-for line — one long line, no wrap */}
                            {!done && (
                              <div className="mt-2 text-[11px] flex items-center gap-1.5 whitespace-nowrap" style={{ color: "#a9600d" }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                                <span>รอ <b>{waitName}</b> · <span className="font-semibold">{waitDays} วัน</span></span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span title={rq.status === "RECALLED" ? `Recalled by ${rq.recalledBy || "-"}: ${rq.recallReason || ""}` : undefined}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${rq.status === "RECALLED" || rq.status === "REJECTED" ? "bg-orange-100 text-orange-700" : rq.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {pullStatus(rq)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => setViewRq(rq)} title="View document (read-only)"
                          className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:text-red-800 hover:border-red-300 mr-1">👁 View</button>
                        {/* Printable sheet at ANY stage — the PDF simply shows blanks for what is not
                            filled in yet (LG actual, INV per PO …). */}
                        <button onClick={() => openPdf(rq)} disabled={pdfing === rq.id} title="Preview / download PDF"
                          className="text-xs px-2.5 py-1 rounded-lg text-white disabled:opacity-50 mr-1" style={{ background: MAROON }}>{pdfing === rq.id ? "…" : "🔍 PDF"}</button>
                        {(isAdmin || rq.createdById === userId) && !["APPROVED", "COMPLETED", "RECALLED"].includes(rq.status) && (
                          <button onClick={() => recall(rq)} disabled={busy === rq.id} title="Recall (creator only)"
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-amber-700 hover:border-amber-300 disabled:opacity-50">↩ Recall</button>
                        )}
                        {(isAdmin || rq.createdById === userId) && rq.status === "RECALLED" && (
                          <button onClick={() => openEdit(rq)} disabled={busy === rq.id} title="Edit & resubmit"
                            className="text-xs px-2.5 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: MAROON }}>✎ แก้ไข & Resubmit</button>
                        )}
                        {isAdmin && (
                          <button onClick={() => del(rq)} disabled={busy === rq.id} title="ลบเอกสารถาวร (admin เท่านั้น)"
                            className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 ml-1">🗑 ลบ</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}

      {/* PDF preview popup */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closePdf}>
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold text-gray-700">📄 {previewName}</span>
              <div className="flex items-center gap-2">
                <button onClick={downloadPdf} className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>↓ Download PDF</button>
                <button onClick={closePdf} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">ปิด</button>
              </div>
            </div>
            <iframe src={previewUrl} title="PDF preview" className="flex-1 w-full" />
          </div>
        </div>
      )}

      {/* Read-only document view (like DVM Purchase) */}
      {viewRq && (() => {
        const rq = viewRq, its = rq.items || []
        const d0 = its.find((x: any) => x.airFreightCost != null) || its[0] || {}
        const byPo: Record<string, { qty: number; uoms: Set<string> }> = {}
        its.forEach((it: any) => { const po = it.poNoDoc || "-"; const g = (byPo[po] ||= { qty: 0, uoms: new Set() }); g.qty += Number(it.pullMaterialQty) || 0; if (it.bomUom) g.uoms.add(it.bomUom) })
        const qtyAir = its.reduce((s: number, it: any) => s + (Number(it.pullMaterialQty) || 0), 0)
        const estTotal = its.reduce((s: number, it: any) => s + (Number(it.airFreightCost) || 0), 0)
        const pkgs = Array.isArray(rq.packages) ? rq.packages : []
        const pkgStr = pkgs.length ? pkgs.map((p: any) => `${fmt(p.qty)} ${p.uom}`).join(", ") : (d0.cartons ? String(fmt(d0.cartons)) : "")
        const dimStr = (d0.boxW || d0.boxL || d0.boxH) ? `${d0.boxW || "-"}×${d0.boxL || "-"}×${d0.boxH || "-"} cm` : ""
        const Info = ({ label, value }: { label: string; value: any }) => <div><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-gray-800 text-sm">{value || "-"}</div></div>
        const vIsPC = (rq.requestType || "SCM") === "PURCHASING"
        const vSteps = vIsPC ? ["Requester", "DVM Purchase", "Logistics"] : ["Requester", "Purchase", "SCM Decision", "SCM Approve·1", "SCM Approve·2", "Logistics"]
        const vCur = vIsPC ? (PC_CUR[rq.status] ?? 1) : (SCM_CUR[rq.status] ?? 1)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewRq(null)}>
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <div><span className="font-bold text-lg text-gray-900">{rq.documentNo}</span> <span className="text-xs text-gray-400">· {displayOf(rq)} · {pullStatus(rq)}</span></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openPdf(rq)} disabled={pdfing === rq.id}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: MAROON }}>{pdfing === rq.id ? "…" : "🔍 PDF"}</button>
                  <button onClick={() => setViewRq(null)} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">ปิด</button>
                </div>
              </div>
              <div className="overflow-y-auto p-5">
               <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="text-sm font-bold text-gray-800 mb-3">📄 Document</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Info label="BU" value={rq.bu} /><Info label="Requester" value={displayOf(rq)} />
                    {rq.remark && <div className="col-span-2"><Info label="Remark" value={rq.remark} /></div>}
                  </div>
                  {(rq.attachments || []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                      {rq.attachments.map((a: any) => <a key={a.id} href={`/api/pull-material/attachments/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] bg-sky-50 border border-sky-200 text-sky-800 rounded-full px-2.5 py-1 hover:bg-sky-100">📎 <span className="max-w-[200px] truncate">{a.fileName}</span></a>)}
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="text-sm font-bold text-gray-800 mb-3">Items</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 rounded-xl bg-gray-50 p-3">
                    <Info label="Country" value={d0.country} /><Info label="Port" value={d0.port || d0.seaPort} /><Info label="City" value={d0.city} /><Info label="Incoterm" value={d0.incoterm} />
                    <Info label="QTY Air" value={fmt(qtyAir)} /><Info label="Est Air" value={estTotal ? `${fmt(estTotal)} USD` : "-"} /><Info label="L/T Air" value={d0.leadTimeAir} /><Info label="Weight (kg)" value={d0.weight != null ? fmt(d0.weight) : "-"} />
                    <Info label="Need date" value={d0.needDate ? fmtDate(d0.needDate) : "-"} /><Info label="Package" value={pkgStr} /><Info label="Dimension" value={dimStr} />
                    {["EX-WORK", "FCA"].includes(d0.incoterm) && <Info label="Pickup address" value={d0.pickupAddress} />}
                  </div>
                  <div className="border rounded-xl overflow-x-auto">
                    <table className="w-full text-xs"><thead className="bg-gray-50 text-gray-500"><tr>{["PO NO", "QTY AIR", "UOM"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-gray-50">{Object.keys(byPo).map(po => (<tr key={po}><td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{po}</td><td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(byPo[po].qty)}</td><td className="px-3 py-1.5 whitespace-nowrap">{[...byPo[po].uoms].join(", ") || "-"}</td></tr>))}</tbody>
                    </table>
                  </div>
                  {(rq.actualAir != null || rq.hawbNo || rq.invoiceNo) && (
                    <div className="grid grid-cols-3 gap-3 mt-4 rounded-xl bg-green-50/50 border border-green-100 p-3">
                      <Info label="HAWB NO" value={rq.hawbNo} /><Info label="Invoice NO" value={rq.invoiceNo} /><Info label="Actual Air" value={rq.actualAir != null ? fmt(rq.actualAir) : "-"} />
                    </div>
                  )}
                  {rq.approverSignature && (
                    <div className="mt-4 flex justify-end"><div className="text-center"><img src={rq.approverSignature} alt="signature" className="h-12 mx-auto object-contain" /><div className="border-t border-gray-300 pt-1 text-[11px] text-gray-500 w-44">Approved · DVM Purchase<br />{rq.approverName || ""}</div></div></div>
                  )}
                </div>
                </div>

                {/* Approval steps (read-only) */}
                <div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="text-sm font-bold text-gray-800 mb-4">Approval steps</div>
                    <div className="space-y-0">
                      {vSteps.map((s, i) => {
                        const sDone = i < vCur, sNow = i === vCur
                        const who = i === 0 ? displayOf(rq) : (sNow && vIsPC && rq.status === "PENDING_VP_PUR") ? (pcApprover(rq.bu)?.split("@")[0] || "") : ""
                        return (
                          <div key={s} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${sDone ? "bg-green-500 text-white" : sNow ? "bg-amber-400 text-white" : "bg-gray-200 text-gray-400"}`}>{sDone ? "✓" : sNow ? "●" : "○"}</div>
                              {i < vSteps.length - 1 && <div className={`w-0.5 flex-1 min-h-[26px] ${sDone ? "bg-green-400" : "bg-gray-200"}`} />}
                            </div>
                            <div className="pb-4">
                              <div className={`text-sm font-semibold ${sNow ? "text-amber-700" : sDone ? "text-gray-700" : "text-gray-400"}`}>{s}</div>
                              {who && <div className="text-[11px] text-gray-500">{who}</div>}
                              {sNow && <div className="text-[11px] text-amber-600">รออนุมัติ</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
               </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Edit (recalled doc) → Save & Resubmit */}
      {editRq && (() => {
        const inp = "w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
        const lab = "text-[11px] font-semibold text-gray-600 block mb-1"
        const setF = (k: string, v: any) => setEditForm((p: any) => ({ ...p, [k]: v }))
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditRq(null)}>
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <div><span className="font-bold text-gray-900">✎ แก้ไข {editRq.documentNo}</span> <span className="text-xs text-gray-400">แล้วส่งเข้า flow อีกครั้ง</span></div>
                <button onClick={() => setEditRq(null)} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">ปิด</button>
              </div>
              <div className="overflow-y-auto p-5 space-y-3">
                <div>
                  <label className={lab}>เมือง / City (จาก Master Purchase)</label>
                  <select className={inp} value={cities.find(c => c.city === editForm.city && c.port === editForm.port)?.id || ""}
                    onChange={e => { const c = cities.find(x => x.id === e.target.value); if (c) setEditForm((p: any) => ({ ...p, city: c.city, country: c.country || p.country, port: c.port || p.port })) }}>
                    <option value="">— เลือกเมือง (เติม country/port) —</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.city} · {c.port} · {c.country}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lab}>Country *</label><input className={inp} value={editForm.country || ""} onChange={e => setF("country", e.target.value)} /></div>
                  <div><label className={lab}>Air Port *</label><input className={inp} value={editForm.port || ""} onChange={e => setF("port", e.target.value)} /></div>
                  <div><label className={lab}>Incoterm *</label>
                    <select className={inp} value={editForm.incoterm || ""} onChange={e => setF("incoterm", e.target.value)}>
                      <option value="">—</option>{["FOB", "CIF", "EX-WORK", "FCA"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className={lab}>Need date</label><input type="date" className={inp} value={editForm.needDate || ""} onChange={e => setF("needDate", e.target.value)} /></div>
                  <div><label className={lab}>Weight (kg) *</label><input type="number" className={inp} value={editForm.weight || ""} onChange={e => setF("weight", e.target.value)} /></div>
                </div>
                {["EX-WORK", "FCA"].includes(editForm.incoterm) && (
                  <div><label className={lab}>📍 {editForm.incoterm} Pickup address *</label><textarea rows={2} className={inp} value={editForm.pickup || ""} onChange={e => setF("pickup", e.target.value)} /></div>
                )}
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className={lab + " !mb-0"}>Package *</label>
                    <button type="button" onClick={() => setEditPkgs(p => [...p, { uom: "", qty: "" }])} className="text-xs font-semibold px-2 py-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50">+ เพิ่ม</button>
                  </div>
                  <div className="space-y-2">
                    {editPkgs.map((pk, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" placeholder="UOM" value={pk.uom} onChange={e => setEditPkgs(p => p.map((x, j) => j === i ? { ...x, uom: e.target.value } : x))} />
                        <input type="number" className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right" placeholder="จำนวน" value={pk.qty} onChange={e => setEditPkgs(p => p.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                        <button type="button" onClick={() => setEditPkgs(p => p.length > 1 ? p.filter((_, j) => j !== i) : [{ uom: "", qty: "" }])} className="text-gray-300 hover:text-red-500 px-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div><label className={lab}>Remark</label><textarea rows={2} className={inp} value={editForm.remark || ""} onChange={e => setF("remark", e.target.value)} /></div>
                <p className="text-[11px] text-gray-400">แก้ข้อมูลจัดซื้อ (PO/material เดิม) · Est Air จะคำนวณใหม่ · กดแล้วส่งเข้า flow + แจ้งเมลตามปกติ</p>
              </div>
              <div className="px-5 py-3 border-t flex justify-end gap-2">
                <button onClick={() => setEditRq(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">ยกเลิก</button>
                <button onClick={saveEdit} disabled={busy === editRq.id} className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>{busy === editRq.id ? "…" : "💾 บันทึก & Resubmit"}</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
