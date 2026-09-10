"use client"

import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"
import { courierUsd, destForBu, EXCHANGE_RATE, seaUsd } from "@/lib/pull-courier"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const canUse = isAdmin || roles.includes("LOGISTICS_IMPORT")
  const [bu, setBu] = useState("ALL")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pdfing, setPdfing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING">("ALL")
  const [lgTab, setLgTab] = useState<"actual" | "nomaster">("actual")
  // edits[docId] = { hawbNo, mawbNo, invoiceNo, actualAir } — ONE set per document (1 shipment / 1 doc).
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const [uploading, setUploading] = useState("")
  const [exporting, setExporting] = useState(false)
  const [courierRates, setCourierRates] = useState<any[]>([])
  const [seaRates, setSeaRates] = useState<any[]>([])
  useEffect(() => {
    fetch("/api/pull-material/courier-rates").then(r => r.json()).then(d => setCourierRates(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/sea-rates").then(r => r.json()).then(d => setSeaRates(d.rows || [])).catch(() => {})
  }, [])
  const [recomputing, setRecomputing] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const recompute = async (rq: any) => {
    setRecomputing(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}/recompute`, { method: "POST" })
      if (r.ok) await load()
      else { const d = await r.json().catch(() => ({})); alert(d.error || "recompute failed") }
    } finally { setRecomputing(false) }
  }

  // Admin: pull EVERY doc still missing an Air rate back to LG (PENDING_LG_RATE) + email LG.
  const backfill = async () => {
    if (!confirm("ดึงเอกสารทั้งหมดที่ยังไม่มี Air rate กลับมาให้ LG เติม (PENDING_LG_RATE) + ส่งอีเมลแจ้ง LG?\n\nระบบจะ recompute ก่อน — เอกสารที่ master มี rate แล้วจะไม่ถูกดึงกลับ")) return
    setBackfilling(true)
    try {
      const r = await fetch(`/api/pull-material/backfill-lg-rate`, { method: "POST" })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { await load(); alert(`✅ ดึงกลับ ${d.count} เอกสาร${d.count ? ":\n" + (d.docs || []).join("\n") : " (ไม่มีเอกสารที่ขาด rate)"}`) }
      else alert(d.error || "backfill ไม่สำเร็จ")
    } finally { setBackfilling(false) }
  }

  // Forward a PENDING_LG_RATE doc onward (server re-checks a rate exists in ≥1 mode first).
  // Target stage depends on where it came from: SCM request → SCM decision; PC request → DPM (VP Purchasing).
  const forwardApproval = async (rq: any) => {
    const next = (rq.requestType || "SCM") === "SCM" ? "PENDING_SCM_DECISION" : "PENDING_VP_PUR"
    if (!confirm(`ส่งต่อ ${rq.documentNo}?\nระบบจะเช็คว่ามี rate อย่างน้อย 1 mode (air/sea/courier) ก่อน`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setOpenId(null); await load(); alert("✅ ส่งต่อ Approval แล้ว") }
      else alert(d.error || "ส่งต่อไม่สำเร็จ")
    } finally { setBusy(false) }
  }

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
      const bus = bu === "ALL" ? BUS : [bu]
      const results = await Promise.all(bus.map(b => fetch(`/api/pull-material?bu=${b}`).then(r => r.json()).catch(() => ({}))))
      const all = results.flatMap((d: any) => d.requests || [])
      setReqs(all.filter((r: any) => r.status === "APPROVED" || r.status === "COMPLETED" || r.status === "PENDING_LG_RATE"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const raw = (rq: any, k: string) => edits[rq.id]?.[k] ?? (rq[k] != null ? String(rq[k]) : "")
  // Date fields → normalize to YYYY-MM-DD for <input type=date>.
  const rawDate = (rq: any, k: string) => edits[rq.id]?.[k] ?? (rq[k] ? String(rq[k]).slice(0, 10) : "")
  // Per-PO invoice (stored in rq.poInvoices map); edits are keyed "poinv:<po>".
  const poInv = (rq: any, po: string) => edits[rq.id]?.["poinv:" + po] ?? ((rq.poInvoices || {})[po] || "")
  const buildPoInvoices = (rq: any) => { const m: Record<string, string> = { ...(rq.poInvoices || {}) }; Object.entries(edits[rq.id] || {}).forEach(([k, v]) => { if (k.startsWith("poinv:")) { const po = k.slice(6); if (v) m[po] = v; else delete m[po] } }); return m }

  // Save the actual (HAWB / INV / Actual Air) → closes the doc (COMPLETED) so it shows done in Tracking.
  const save = async (rq: any) => {
    if (!String(raw(rq, "actualAir")).trim()) return alert("กรอก Actual Air Freight ก่อนบันทึก")
    if (!confirm(`บันทึก Actual และปิดงาน ${rq.documentNo}?\n\nActual Air: ${raw(rq, "actualAir")}\nHAWB: ${raw(rq, "hawbNo") || "-"}\n\nสถานะเอกสารจะเปลี่ยนเป็น COMPLETED`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hawbNo: raw(rq, "hawbNo") || null,
          mawbNo: raw(rq, "mawbNo") || null,
          invoiceNo: raw(rq, "invoiceNo") || null,
          flightEtd: rawDate(rq, "flightEtd") || null,
          flightEta: rawDate(rq, "flightEta") || null,
          poInvoices: buildPoInvoices(rq),
          actualAir: raw(rq, "actualAir") === "" ? null : raw(rq, "actualAir"),
          localChargeTh: raw(rq, "localChargeTh") === "" ? null : raw(rq, "localChargeTh"),
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
  // Export this document to Excel — ONE row per PO (QTY AIR + LG actuals + shipment info).
  const exportExcel = async (rq: any) => {
    setExporting(true)
    try {
      const ExcelJS: any = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Pull RM by PO")
      ws.columns = [
        { header: "DOCUMENT NO", key: "doc", width: 22 }, { header: "BU", key: "bu", width: 8 }, { header: "REQUESTER", key: "requester", width: 18 },
        { header: "PO NO", key: "po", width: 16 }, { header: "QTY AIR", key: "qty", width: 12 }, { header: "UOM", key: "uom", width: 10 }, { header: "INVOICE NO", key: "inv", width: 18 },
        { header: "COUNTRY", key: "country", width: 14 }, { header: "AIR PORT", key: "port", width: 10 }, { header: "SEA PORT", key: "seaport", width: 10 }, { header: "CITY", key: "city", width: 14 }, { header: "INCOTERM", key: "incoterm", width: 10 }, { header: "WEIGHT (KG)", key: "weight", width: 12 },
        { header: "NEED DATE", key: "needDate", width: 13 }, { header: "SHIPMENT DATE", key: "shipDate", width: 14 }, { header: "MRD", key: "mrd", width: 13 }, { header: "ETC", key: "etc", width: 13 },
        { header: "PACKAGE", key: "package", width: 16 }, { header: "DIMENSION", key: "dimension", width: 16 }, { header: "PICKUP/VENDOR ADDRESS", key: "address", width: 40 }, { header: "REMARK", key: "remark", width: 24 },
        { header: "EST AIR", key: "est", width: 12 }, { header: "L/T AIR", key: "lt", width: 10 },
        { header: "HAWB NO", key: "hawb", width: 16 }, { header: "MAWB NO", key: "mawb", width: 16 }, { header: "FLIGHT ETD", key: "etd", width: 14 }, { header: "FLIGHT ETA", key: "eta", width: 14 }, { header: "ACTUAL AIR", key: "act", width: 12 },
      ]
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E9E9" } }
      const its: any[] = rq.items || []
      const d0 = its[0] || {}
      const dstr = (v: any) => (v ? String(v).slice(0, 10) : "")
      const earliestD = (arr: any[]) => { const t = arr.map(v => (v ? new Date(v).getTime() : NaN)).filter(n => !isNaN(n)); return t.length ? new Date(Math.min(...t)).toISOString().slice(0, 10) : "" }
      const pkgs = Array.isArray(rq.packages) ? rq.packages : []
      const pkgStr = pkgs.length ? pkgs.map((p: any) => `${fmt(p.qty)} ${p.uom}`).join(", ") : (d0.cartons ? String(fmt(d0.cartons)) : "")
      const dimStr = (d0.boxW || d0.boxL || d0.boxH) ? `${d0.boxW || "-"}x${d0.boxL || "-"}x${d0.boxH || "-"} cm` : ""
      const estTotal = its.reduce((a: number, i: any) => a + (Number(i.airFreightCost) || 0), 0)
      const byPo: Record<string, { qty: number; uoms: Set<string> }> = {}
      its.forEach(it => { const po = it.poNoDoc || "-"; const g = (byPo[po] ||= { qty: 0, uoms: new Set() }); g.qty += Number(it.pullMaterialQty) || 0; if (it.bomUom) g.uoms.add(it.bomUom) })
      Object.keys(byPo).forEach(po => ws.addRow({
        doc: rq.documentNo, bu: rq.bu, requester: rq.requesterName || "",
        po, qty: byPo[po].qty, uom: [...byPo[po].uoms].join(", "), inv: poInv(rq, po) || raw(rq, "invoiceNo"),
        country: d0.country || "", port: d0.port || "", seaport: d0.seaPort || "", city: d0.city || "", incoterm: d0.incoterm || "", weight: d0.weight != null ? Number(d0.weight) : "",
        needDate: dstr(d0.needDate), shipDate: earliestD(its.map(i => i.shipmentDate)), mrd: earliestD(its.flatMap(i => [i.shipmentDate, i.mrdDate, i.mrdNeedDate, i.mrd2])), etc: dstr(d0.etc),
        package: pkgStr, dimension: dimStr, address: d0.pickupAddress || "", remark: rq.remark || "",
        est: estTotal || "", lt: d0.leadTimeAir || "",
        hawb: raw(rq, "hawbNo"), mawb: raw(rq, "mawbNo"), etd: rawDate(rq, "flightEtd"), eta: rawDate(rq, "flightEta"), act: raw(rq, "actualAir") === "" ? "" : Number(raw(rq, "actualAir")),
      }))
      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      const a = document.createElement("a"); a.href = url; a.download = `${rq.documentNo}_byPO.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) { alert("Export Excel ไม่สำเร็จ: " + String((e as any)?.message || e).slice(0, 160)) } finally { setExporting(false) }
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
  // Two LG tabs: "actual" = approved docs waiting for actual air entry; "nomaster" = docs still missing Air rate.
  const inTab = (r: any) => lgTab === "nomaster" ? r.status === "PENDING_LG_RATE" : r.status !== "PENDING_LG_RATE"
  const nNoMaster = reqs.filter(r => r.status === "PENDING_LG_RATE").length
  const nActual = reqs.length - nNoMaster
  const shown = reqs.filter(r => inTab(r) && (typeF === "ALL" || (r.requestType || "SCM") === typeF))

  return (
    <div className="p-5 md:p-8 max-w-[1100px] mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>Logistics Document — Pull Material</h1>
          <p className="text-sm text-gray-400 mt-0.5">เอกสารที่อนุมัติแล้ว — LG กรอก Actual Air / INV / HAWB ครั้งเดียวต่อเอกสาร แล้ว Save + ดาวน์โหลด PDF</p></div>
        {isAdmin && !openReq && (
          <button onClick={backfill} disabled={backfilling}
            className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: MAROON }} title="ดึงเอกสารที่ยังไม่มี Air rate กลับมาให้ LG เติม + แจ้งอีเมล">
            {backfilling ? "กำลังดึง…" : "🔄 ดึงเอกสารที่ไม่มี rate กลับมา"}
          </button>
        )}
      </div>

      {!openReq && (
        <>
          <div className="flex gap-2 border-b border-gray-200">
            {([["actual", "📥 รอกรอก Actual", nActual], ["nomaster", "⚠️ No Master", nNoMaster]] as const).map(([v, label, n]) => (
              <button key={v} onClick={() => { setLgTab(v); setOpenId(null) }}
                className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${lgTab === v ? "" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                style={lgTab === v ? { color: v === "nomaster" ? "#b91c1c" : MAROON, borderColor: v === "nomaster" ? "#b91c1c" : MAROON } : undefined}>
                {label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] ${v === "nomaster" && n > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>{n}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">{["ALL", ...BUS].map(b => (
            <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: b === "ALL" ? MAROON : buColor(b) } : undefined}>{b === "ALL" ? "ALL BU" : b}</button>
          ))}</div>
          <div className="flex gap-1.5">
            {([["ALL", "ทั้งหมด"], ["SCM", "SCM request"], ["PURCHASING", "PC request"]] as const).map(([v, label]) => {
              const n = reqs.filter(r => inTab(r) && (v === "ALL" || (r.requestType || "SCM") === v)).length
              return (
                <button key={v} onClick={() => setTypeF(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${typeF === v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                  style={typeF === v ? { background: MAROON } : undefined}>{label} <span className="opacity-70">({n})</span></button>
              )
            })}
          </div>

          {loading ? <p className="text-sm text-gray-400">Loading…</p> :
            shown.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">{lgTab === "nomaster" ? "ไม่มีเอกสารที่รอเติม Air rate 🎉" : "ไม่มีเอกสารที่รอกรอก Actual"}</div> :
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
                          {rq.status === "PENDING_LG_RATE"
                            ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold border border-red-200">⚠️ รอเติม Air rate (ยังไม่ส่ง approval)</span>
                            : done
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
        const totalOrigin = its.reduce((s: number, it: any) => s + (Number(it.originCost) || 0), 0)
        const totalFreight = estTotal - totalOrigin
        const seaM = seaUsd(seaRates, d0.seaPort || d0.port)
        const seaFreight = seaM ? seaM.cost : (its.reduce((a: number, it: any) => a + (Number(it.seaFreightCost) || 0), 0) || (d0.estSea ? Number(d0.estSea) : 0)) || null
        const earliest = (arr: any[]) => { const t = arr.map(v => (v ? new Date(v).getTime() : NaN)).filter(n => !isNaN(n)); return t.length ? new Date(Math.min(...t)) : null }
        const localCh = raw(rq, "localChargeTh") === "" ? null : Number(raw(rq, "localChargeTh")) || null
        return (
          <div className="space-y-5">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">← Back</button>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{rq.documentNo}</h1>
                <span className="text-xs text-gray-400">by {rq.requesterName} · {fmtDate(rq.createdAt)}</span>
                {rq.status === "PENDING_LG_RATE" && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-300">⚠️ รอ LG เติม Air rate</span>}
              </div>
              <div className="flex gap-2 shrink-0">
                {rq.status === "PENDING_LG_RATE" && (
                  <button onClick={() => forwardApproval(rq)} disabled={busy} title="เติม rate ครบแล้ว → ส่งต่อ Approval"
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: "#16a34a" }}>{busy ? "…" : "🚀 ส่งต่อ Approval"}</button>
                )}
                <button onClick={() => recompute(rq)} disabled={recomputing} title="คำนวณ freight ใหม่ (dest by BU + origin cost)"
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 disabled:opacity-50">{recomputing ? "…" : "🔄 Recompute"}</button>
                <button onClick={() => openPreview(rq)} disabled={pdfing}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">{pdfing ? "…" : "🔍 Preview PDF"}</button>
                <button onClick={() => exportExcel(rq)} disabled={exporting}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50">{exporting ? "…" : "📊 Export Excel (ราย PO)"}</button>
                {rq.status !== "PENDING_LG_RATE" && (
                  <button onClick={() => save(rq)} disabled={busy}
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>{busy ? "…" : "💾 Save"}</button>
                )}
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
                    <Info label="Brand Name" value={[...new Set(its.map((i: any) => i.brand).filter(Boolean))].join(", ")} />
                    <Info label="Supplier Name" value={[...new Set(its.map((i: any) => i.vendorName).filter(Boolean))].join(", ") || rq.vendorContact} />
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
                    <Info label="Weight (kg)" value={d0.weight != null ? fmt(d0.weight) : "-"} />
                    <Info label="ETC" value={d0.etc ? fmtDate(d0.etc) : "-"} />
                    <Info label="Need date (in-house)" value={d0.needDate ? fmtDate(d0.needDate) : "-"} />
                    <Info label="MRD" value={fmtDate(earliest(its.flatMap((it: any) => [it.shipmentDate, it.mrdDate, it.mrdNeedDate, it.mrd2])))} />
                    <Info label="Shipment Date" value={fmtDate(earliest(its.map((it: any) => it.shipmentDate)))} />
                    <Info label="Package" value={pkgStr} />
                    <Info label="Dimension" value={dimStr} />
                    {rq.remark && <Info label="Remark" value={rq.remark} />}
                    {d0.pickupAddress && <div className="col-span-2 sm:col-span-4"><Info label="Supplier / Pickup address" value={d0.pickupAddress} /></div>}
                  </div>

                  {/* Shipping mode comparison (same as approval) */}
                  {(() => {
                    const cdest = destForBu(rq.bu), cwt = Number(d0.weight) || 0
                    const dhl = courierUsd(courierRates, d0.port, cdest, cwt, "DHL")
                    const fedex = courierUsd(courierRates, d0.port, cdest, cwt, "FEDEX")
                    const rlink = (tab: string, port: any) => `/pull-material/rates?tab=${tab}&port=${encodeURIComponent(port || "")}&country=${encodeURIComponent(d0.country || "")}`
                    // For "no master": deep-link that PRE-CREATES a draft row (port+country filled) → LG only fills the numbers.
                    const addLink = (type: "air" | "sea", port: any) => `/pull-material/rates?prefill=${encodeURIComponent(JSON.stringify([{ type, country: d0.country || "", port: port || "" }]))}`
                    const addCourier = (carrier: string) => `/pull-material/rates?prefill=${encodeURIComponent(JSON.stringify([{ type: "courier", country: d0.country || "", port: d0.port || "", carrier }]))}`
                    const modes = [
                      { key: "air", label: "✈️ Air", freight: totalFreight || null, inco: totalOrigin || null, total: estTotal || null, lt: d0.leadTimeAir || null, actual: actTotal || null, local: localCh, accent: "#6b1a1a", link: addLink("air", d0.port) },
                      { key: "sea", label: seaM ? `🚢 Sea (${seaM.container})` : "🚢 Sea", freight: seaFreight || null, inco: null, total: seaFreight || null, lt: d0.leadTimeSea || null, actual: null, local: null, accent: "#0369a1", link: addLink("sea", d0.seaPort || d0.port) },
                      { key: "dhl", label: "📦 Courier · DHL", freight: dhl, inco: null, total: dhl, lt: null, actual: null, local: null, accent: "#b45309", link: addCourier("DHL"), over: cwt > 30 },
                      { key: "fedex", label: "📦 Courier · FedEx", freight: fedex, inco: null, total: fedex, lt: null, actual: null, local: null, accent: "#7c3aed", link: addCourier("FEDEX"), over: cwt > 30 },
                    ]
                    const cheapest = Math.min(...modes.filter(m => m.total).map(m => m.total as number))
                    const money = (v: number | null) => v != null ? `${fmt(v)}` : <span className="text-gray-300">–</span>
                    return (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-bold text-gray-600">เปรียบเทียบวิธีขนส่ง (Freight · Incoterm · Total · Lead time) <span className="font-normal text-gray-400">· USD</span></div>
                          <div className="text-[11px] text-gray-400">Exchange rate = {EXCHANGE_RATE} (Courier THB→USD)</div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {modes.map(m => {
                            const best = m.total && m.total === cheapest
                            return (
                              <div key={m.key} className={`rounded-xl border p-3 ${best ? "ring-2 ring-emerald-300 border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"}`}>
                                <div className="text-xs font-semibold mb-1.5" style={{ color: m.accent }}>{m.label}{best && <span className="ml-1 text-[10px] text-emerald-600">ถูกสุด</span>}</div>
                                <div className="space-y-1 text-[11px]">
                                  <div className="flex justify-between"><span className="text-gray-400">Freight</span><span className="font-medium text-gray-700">{money(m.freight)}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-400">Incoterm</span><span className="font-medium text-gray-700">{money(m.inco)}</span></div>
                                  <div className="flex justify-between border-t border-gray-100 pt-1"><span className="text-gray-500 font-semibold">Total Freight</span>{m.total != null ? <span className="font-bold text-gray-900">{fmt(m.total)}</span> : (m as any).over ? <span className="text-gray-400 text-[10px]">&gt; 30kg</span> : <a href={m.link} className="text-amber-600 text-[10px] font-semibold underline hover:text-amber-700" title="ไปเพิ่ม rate ในหน้า Master Rate">no master → เพิ่ม</a>}</div>
                                  <div className="flex justify-between"><span className="text-gray-400">L/T</span><span className="font-medium text-gray-700">{m.lt || <span className="text-gray-300">–</span>}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-400">Actual Air</span><span className="font-medium text-gray-700">{money(m.actual)}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-400">Local Charge (TH)</span><span className="font-medium text-gray-700">{money(m.local)}</span></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="border rounded-xl overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500"><tr>{["PO NO", "QTY AIR", "UOM", "INVOICE NO"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {Object.keys(byPo).map(po => (
                          <tr key={po} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{po}</td>
                            <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(byPo[po].qty)}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{[...byPo[po].uoms].join(", ") || "-"}</td>
                            <td className="px-3 py-1 min-w-[160px]">
                              <input value={poInv(rq, po)} onChange={e => setVal(rq.id, "poinv:" + po, e.target.value)} placeholder="INV ต่อ PO นี้…"
                                className="border border-green-300 bg-green-50/40 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-2 focus:ring-green-200" />
                            </td>
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
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[11px] font-semibold text-green-700 block mb-1">FLIGHT ETD</label>
                        <input type="date" value={rawDate(rq, "flightEtd")} onChange={e => setVal(rq.id, "flightEtd", e.target.value)} className={inp} /></div>
                      <div><label className="text-[11px] font-semibold text-green-700 block mb-1">FLIGHT ETA</label>
                        <input type="date" value={rawDate(rq, "flightEta")} onChange={e => setVal(rq.id, "flightEta", e.target.value)} className={inp} /></div>
                    </div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">ACTUAL AIR FREIGHT <span className="text-red-500">*</span></label>
                      <input type="number" value={raw(rq, "actualAir")} onChange={e => setVal(rq.id, "actualAir", e.target.value)} placeholder="0" className={inp} /></div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">LOCAL CHARGE (TH)</label>
                      <input type="number" value={raw(rq, "localChargeTh")} onChange={e => setVal(rq.id, "localChargeTh", e.target.value)} placeholder="0" className={inp} /></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className={estTotal ? "text-gray-500" : "text-amber-600 font-medium"}>{estTotal ? `Est ${fmt(estTotal)} USD` : "⚠️ ไม่มี rate — เพิ่ม Master Rate"}</span>
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
