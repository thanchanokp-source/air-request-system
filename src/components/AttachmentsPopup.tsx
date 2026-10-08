"use client"
import React, { useState } from "react"

// Attachments of ONE document, grouped by stage (MER / SCM / LG / Claim / Supplier claim), plus the
// document PDF the system generates (every SO, with the approval signatures — VP MER, VP SCM, …).
// Used by AIR REQUESTS and APPROVALS (📎 chip on the document header).
export const ATT_STAGES = ["MER", "SCM", "LG", "Claim"] as const
export const attStageOf = (a: any): string => {
  const cat = String(a?.category || "").toUpperCase()
  if (cat.startsWith("SUPPLIER_CLAIM")) return "Claim"
  if (["INV", "AWB", "EXPENSE", "COMBINE"].includes(cat) || cat.startsWith("HAWB")) return "LG"
  const r = String(a?.uploadedBy?.role || "")
  if (r === "SCM_USER" || r === "VP_SCM" || r === "DPM_SCM" || r === "SCM_PULL") return "SCM"
  if (r.startsWith("LOGISTICS")) return "LG"
  if (r.startsWith("CLAIM") || r.startsWith("DVM_PRO") || r.startsWith("VP_PRO") || r.startsWith("SCM_NY")) return "Claim"
  return "MER" // MER_*/DVM_MER/VP_MER/ADMIN/GW-merch and any fallback
}
const ATT_META: Record<string, string> = { MER: "bg-blue-600", SCM: "bg-green-600", LG: "bg-orange-500", Claim: "bg-purple-600" }

/** 📎 chip for a document header — always shown (the generated PDF is always available) */
export function AttachChip({ doc, onOpen }: { doc: any; onOpen: () => void }) {
  const n = (doc?.attachments || []).length
  return (
    <button onClick={e => { e.stopPropagation(); onOpen() }} title="เอกสารแนบ + PDF เอกสาร (มีลายเซ็น)"
      className="flex items-center gap-1.5 text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2.5 py-0.5 rounded-full font-medium shrink-0 hover:bg-orange-100 whitespace-nowrap">
      <span>📎</span>attach file
      <span className="text-[10px] font-bold text-white bg-orange-600 rounded-full min-w-[16px] h-4 px-1 grid place-items-center">{n + 1}</span>
    </button>
  )
}

export default function AttachmentsPopup({ doc, onClose }: { doc: any; onClose: () => void }) {
  const [busy, setBusy] = useState<"" | "view" | "dl">("")
  const atts: any[] = doc?.attachments || []

  // The document PDF: every non-rejected SO, with the approval signatures (snapshot at approval,
  // else the approver's master signature) — the same output as Document for Logistics & Accounting.
  const makePdf = async (mode: "view" | "dl") => {
    setBusy(mode)
    try {
      const [fullReq, sigs] = await Promise.all([
        fetch(`/api/requests/${doc.id}`).then(r => r.json()),
        fetch("/api/signature/masters").then(r => r.json()).catch(() => ({})),
      ])
      const items = (fullReq.items || []).filter((i: any) => i.itemStatus !== "REJECTED")
      if (!items.length) { alert("ไม่มี SO ในเอกสารนี้"); return }
      const [{ pdf }, { CombinedPdfDocument }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/request-pdf")])
      const element = React.createElement(CombinedPdfDocument as any, { pages: items.map((item: any) => ({ req: fullReq, item })), masterSigs: sigs?.signatures || {} })
      const blob = await (pdf(element as any) as any).toBlob()
      const url = URL.createObjectURL(blob)
      if (mode === "view") window.open(url, "_blank")
      else { const a = document.createElement("a"); a.href = url; a.download = `${fullReq.documentNo}.pdf`; document.body.appendChild(a); a.click(); a.remove() }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) { console.error(e); alert("สร้าง PDF ไม่สำเร็จ") } finally { setBusy("") }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[86vh] overflow-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b sticky top-0 bg-white">
          <span className="text-sm font-bold text-gray-900">📎 เอกสารแนบ · {doc.documentNo}</span>
          <span className="text-xs text-gray-400">{atts.length} ไฟล์ + PDF เอกสาร</span>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500" aria-label="ปิด">✕</button>
        </div>
        <div className="p-4 space-y-3">
          {/* generated document PDF (with signatures) */}
          <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white" style={{ background: "#6b1a1a" }}>
              เอกสารจากระบบ<span className="ml-auto text-[11px] bg-white/25 rounded-full px-2 normal-case">PDF + ลายเซ็น</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 text-sm border-t">
              <span>🧾</span>
              <span className="font-medium flex-1 min-w-0 truncate text-gray-800">{doc.documentNo}.pdf <span className="text-[11px] text-gray-400 font-normal">· ทุก SO · ลายเซ็น VP MER / ผู้อนุมัติ</span></span>
              <button onClick={() => makePdf("view")} disabled={!!busy} className="text-[11px] font-semibold disabled:opacity-50" style={{ color: "#6b1a1a" }}>{busy === "view" ? "กำลังสร้าง…" : "เปิด ↗"}</button>
              <button onClick={() => makePdf("dl")} disabled={!!busy} className="text-[11px] font-semibold text-gray-600 disabled:opacity-50">{busy === "dl" ? "…" : "↓ ดาวน์โหลด"}</button>
            </div>
          </div>

          {ATT_STAGES.map(stage => {
            const files = atts.filter((a: any) => attStageOf(a) === stage)
            return (
              <div key={stage} className="border rounded-xl overflow-hidden">
                <div className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white ${files.length ? ATT_META[stage] : "bg-gray-400"}`}>
                  {stage}<span className="ml-auto text-[11px] bg-white/25 rounded-full px-2 normal-case">{files.length}</span>
                </div>
                {files.length ? files.map((a: any) => (
                  <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm border-t hover:bg-gray-50">
                    <span>📄</span>
                    {a.category && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border">{String(a.category).startsWith("SUPPLIER_CLAIM") ? "SUPPLIER CLAIM" : a.category}</span>}
                    <span className="font-medium truncate flex-1 min-w-0 text-gray-800">{a.fileName}</span>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">{a.uploadedBy?.name || ""}</span>
                    <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "#6b1a1a" }}>เปิด ↗</span>
                  </a>
                )) : <div className="px-3 py-2.5 text-xs text-gray-400 border-t">— ยังไม่มีไฟล์ —</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
