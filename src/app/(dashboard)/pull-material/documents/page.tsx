"use client"

import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const canUse = isAdmin || roles.includes("LOGISTICS_IMPORT")
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pdfing, setPdfing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING">("ALL")
  // edits[docId] = { hawbNo, mawbNo, invoiceNo, actualAir } — ONE set per document (1 shipment / 1 doc).
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const [uploading, setUploading] = useState("")

  // LG attaches supporting files (HAWB / INV / docs) to the document.
  const uploadAtt = async (rq: any, files: FileList | null) => {
    if (!files || !files.length) return
    setUploading(rq.id)
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append("file", f)
        await fetch(`/api/pull-material/${rq.id}/attachments`, { method: "POST", body: fd }).catch(() => {})
      }
      await load()
    } finally { setUploading("") }
  }

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "APPROVED" || r.status === "COMPLETED"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const raw = (rq: any, k: string) => edits[rq.id]?.[k] ?? (rq[k] != null ? String(rq[k]) : "")

  // Save the actual (HAWB / INV / Actual Air) → closes the doc (COMPLETED) so it shows done in Tracking.
  const save = async (rq: any) => {
    if (!String(raw(rq, "actualAir")).trim()) return alert("กรอก Actual Air Freight ก่อนบันทึก")
    if (!confirm(`บันทึก Actual และปิดงาน ${rq.documentNo}?\n\nActual Air: ${raw(rq, "actualAir")}\nHAWB: ${raw(rq, "hawbNo") || "-"}\nINV: ${raw(rq, "invoiceNo") || "-"}\n\nสถานะเอกสารจะเปลี่ยนเป็น COMPLETED`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hawbNo: raw(rq, "hawbNo") || null,
          mawbNo: raw(rq, "mawbNo") || null,
          invoiceNo: raw(rq, "invoiceNo") || null,
          actualAir: raw(rq, "actualAir") === "" ? null : raw(rq, "actualAir"),
          status: "COMPLETED",
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setEdits(p => { const n = { ...p }; delete n[rq.id]; return n }); setOpenId(null); await load() }
      else alert(`บันทึกไม่สำเร็จ (HTTP ${r.status}): ${d.error || "อาจยังไม่ได้รัน prisma db push (column actualAir/invoiceNo/hawbNo)"}`)
    } catch (e) { alert("Error: " + String((e as any)?.message || e).slice(0, 160)) } finally { setBusy(false) }
  }

  // Build the document PDF (PC + LG data + attachment list) and open it in a preview popup.
  const openPreview = async (rq: any) => {
    setPdfing(true)
    try {
      const merged = { ...rq, hawbNo: raw(rq, "hawbNo") || null, mawbNo: raw(rq, "mawbNo") || null, invoiceNo: raw(rq, "invoiceNo") || null, actualAir: raw(rq, "actualAir") === "" ? null : Number(raw(rq, "actualAir")) }
      const [{ pdf }, { PullMaterialPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/pull-material-pdf")])
      const blob = await pdf(React.createElement(PullMaterialPdf, { req: merged }) as any).toBlob()
      const url = URL.createObjectURL(blob)
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
      setPreviewName(`${rq.documentNo}.pdf`)
    } catch (e) { console.error(e); alert("PDF generation failed") } finally { setPdfing(false) }
  }
  const closePreview = () => { setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null }) }
  const downloadPreview = () => {
    if (!previewUrl) return
    const a = document.createElement("a"); a.href = previewUrl; a.download = previewName
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Logistics Import / Admin only</p></div>

  const inp = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  const Info = ({ label, value }: { label: string; value: any }) => <div><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-gray-800 text-sm">{value || "-"}</div></div>
  const openReq = reqs.find(r => r.id === openId)
  const shown = reqs.filter(r => typeF === "ALL" || (r.requestType || "SCM") === typeF)

  return (
    <div className="p-5 md:p-8 max-w-[1100px] mx-auto space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>Logistics Document — Pull Material</h1>
        <p className="text-sm text-gray-400 mt-0.5">เอกสารที่อนุมัติแล้ว — LG กรอก Actual Air / INV / HAWB ครั้งเดียวต่อเอกสาร แล้ว Save + ดาวน์โหลด PDF</p></div>

      {!openReq && (
        <>
          <div className="flex gap-1.5">{BUS.map(b => (
            <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
          ))}</div>
          <div className="flex gap-1.5">
            {([["ALL", "ทั้งหมด"], ["SCM", "SCM request"], ["PURCHASING", "PC request"]] as const).map(([v, label]) => {
              const n = v === "ALL" ? reqs.length : reqs.filter(r => (r.requestType || "SCM") === v).length
              return (
                <button key={v} onClick={() => setTypeF(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${typeF === v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                  style={typeF === v ? { background: MAROON } : undefined}>{label} <span className="opacity-70">({n})</span></button>
              )
            })}
          </div>

          {loading ? <p className="text-sm text-gray-400">Loading…</p> :
            shown.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">No approved documents</div> :
              <div className="space-y-2.5">
                {shown.map(rq => {
                  const estTotal = rq.items.reduce((sm: number, i: any) => sm + (Number(i.airFreightCost) || 0), 0)
                  const pos = [...new Set(rq.items.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
                  const done = rq.status === "COMPLETED" || rq.actualAir != null
                  return (
                    <button key={rq.id} onClick={() => setOpenId(rq.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition text-left">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{rq.documentNo}</span>
                          {done
                            ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ Actual entered</span>
                            : <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">รอกรอก Actual</span>}
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Est {fmt(estTotal)} USD</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{rq.requesterName} · PO {pos || "-"}</div>
                      </div>
                      <span className="shrink-0 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>Open →</span>
                    </button>
                  )
                })}
              </div>}
        </>
      )}

      {openReq && (() => {
        const rq = openReq
        const its = rq.items || []
        const d0 = its.find((x: any) => x.airFreightCost != null) || its[0] || {}
        const byPo: Record<string, { qty: number; uoms: Set<string> }> = {}
        its.forEach((it: any) => { const po = it.poNoDoc || "-"; const g = (byPo[po] ||= { qty: 0, uoms: new Set() }); g.qty += Number(it.pullMaterialQty) || 0; if (it.bomUom) g.uoms.add(it.bomUom) })
        const qtyAir = its.reduce((sm: number, it: any) => sm + (Number(it.pullMaterialQty) || 0), 0)
        const estTotal = its.reduce((sm: number, it: any) => sm + (Number(it.airFreightCost) || 0), 0)
        const actTotal = raw(rq, "actualAir") === "" ? 0 : Number(raw(rq, "actualAir")) || 0
        const diff = actTotal - estTotal
        const pkgs = Array.isArray(rq.packages) ? rq.packages : []
        const pkgStr = pkgs.length ? pkgs.map((p: any) => `${fmt(p.qty)} ${p.uom}`).join(", ") : (d0.cartons ? String(fmt(d0.cartons)) : "")
        const dimStr = (d0.boxW || d0.boxL || d0.boxH) ? `${d0.boxW || "-"}×${d0.boxL || "-"}×${d0.boxH || "-"} cm` : ""
        return (
          <div className="space-y-5">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">← Back</button>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{rq.documentNo}</h1>
                <span className="text-xs text-gray-400">by {rq.requesterName} · {fmtDate(rq.createdAt)}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openPreview(rq)} disabled={pdfing}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">{pdfing ? "…" : "🔍 Preview PDF"}</button>
                <button onClick={() => save(rq)} disabled={busy}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>{busy ? "…" : "💾 Save"}</button>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {/* Document */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="text-sm font-bold text-gray-800 mb-3">📄 Document</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Info label="BU" value={rq.bu} />
                    <Info label="Requester" value={rq.requesterName} />
                  </div>
                  {(rq.attachments || []).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase mb-2">แนบไฟล์ ({rq.attachments.length})</div>
                      <div className="flex flex-wrap gap-1.5">
                        {rq.attachments.map((a: any) => (
                          <a key={a.id} href={`/api/pull-material/attachments/${a.id}`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] bg-sky-50 border border-sky-200 text-sky-800 rounded-full px-2.5 py-1 hover:bg-sky-100">📎 <span className="max-w-[220px] truncate" title={a.fileName}>{a.fileName}</span></a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Items summary (like DVM Purchase) */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="text-sm font-bold text-gray-800 mb-3">Items</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 rounded-xl bg-gray-50 p-3">
                    <Info label="Country" value={d0.country} />
                    <Info label="Port" value={d0.port || d0.seaPort} />
                    <Info label="City" value={d0.city} />
                    <Info label="Incoterm" value={d0.incoterm} />
                    <Info label="QTY Air" value={fmt(qtyAir)} />
                    <Info label="Est Air" value={estTotal ? `${fmt(estTotal)} USD` : "-"} />
                    <Info label="L/T Air" value={d0.leadTimeAir} />
                    <Info label="Weight (kg)" value={d0.weight != null ? fmt(d0.weight) : "-"} />
                    <Info label="Need date" value={d0.needDate ? fmtDate(d0.needDate) : "-"} />
                    <Info label="Package" value={pkgStr} />
                    <Info label="Dimension" value={dimStr} />
                    {["EX-WORK", "FCA"].includes(d0.incoterm) && <Info label="Pickup address" value={d0.pickupAddress} />}
                    {rq.remark && <div className="col-span-2 sm:col-span-4"><Info label="Remark" value={rq.remark} /></div>}
                  </div>
                  <div className="border rounded-xl overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500"><tr>{["PO NO", "QTY AIR", "UOM"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {Object.keys(byPo).map(po => (
                          <tr key={po} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{po}</td>
                            <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(byPo[po].qty)}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{[...byPo[po].uoms].join(", ") || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* LG entry — HAWB / INV / Actual (once per doc) */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="text-sm font-bold text-gray-800 mb-3">Logistics — Actual</div>
                  <div className="space-y-3">
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">HAWB NO</label>
                      <input value={raw(rq, "hawbNo")} onChange={e => setVal(rq.id, "hawbNo", e.target.value)} placeholder="HAWB…" className={inp} /></div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">MAWB NO</label>
                      <input value={raw(rq, "mawbNo")} onChange={e => setVal(rq.id, "mawbNo", e.target.value)} placeholder="MAWB…" className={inp} /></div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">INVOICE NO</label>
                      <input value={raw(rq, "invoiceNo")} onChange={e => setVal(rq.id, "invoiceNo", e.target.value)} placeholder="INV…" className={inp} /></div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">ACTUAL AIR FREIGHT <span className="text-red-500">*</span></label>
                      <input type="number" value={raw(rq, "actualAir")} onChange={e => setVal(rq.id, "actualAir", e.target.value)} placeholder="0" className={inp} /></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Est {fmt(estTotal)} USD</span>
                    {actTotal > 0 && <span className={`px-2 py-0.5 rounded-full font-medium ${diff > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))}</span>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <label className="text-[11px] font-semibold text-green-700 block mb-1">แนบไฟล์ (HAWB / INV / เอกสาร — แนบได้หลายไฟล์)</label>
                    <input type="file" multiple disabled={uploading === rq.id}
                      onChange={e => { uploadAtt(rq, e.target.files); e.currentTarget.value = "" }}
                      className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50" />
                    {uploading === rq.id
                      ? <p className="text-[11px] text-gray-400 mt-1">กำลังอัปโหลด…</p>
                      : (rq.attachments || []).length > 0 && <p className="text-[11px] text-gray-400 mt-1">แนบแล้ว {rq.attachments.length} ไฟล์ (ดูรายการด้านบน)</p>}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">กรอกครั้งเดียวต่อเอกสาร · Save แล้วกด “Preview PDF” เพื่อออกเอกสาร</p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* PDF preview popup */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closePreview}>
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold text-gray-700">📄 {previewName}</span>
              <div className="flex items-center gap-2">
                <button onClick={downloadPreview} className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>↓ Download PDF</button>
                <button onClick={closePreview} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">ปิด</button>
              </div>
            </div>
            <iframe src={previewUrl} title="PDF preview" className="flex-1 w-full" />
          </div>
        </div>
      )}
    </div>
  )
}
