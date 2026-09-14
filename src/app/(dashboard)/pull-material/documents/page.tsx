"use client"

import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"
import { courierUsd, destForBu, EXCHANGE_RATE, seaUsd } from "@/lib/pull-courier"

// Pre cost from the AIR master (same formula as EST: rate at weight-break × weight + origin cost),
// but broken out PER FORWARDER so LG can pick which FWD this doc actually shipped with.
const PC_BREAKS = [45, 100, 250, 300, 500, 1000, 2000, 8000]
const pcBreakKey = (w: number) => { let b = 45; for (const x of PC_BREAKS) if (x <= w) b = x; return "Q" + b }
const pcLaos = (x: string) => x === "LAOS" || x === "VTE" || x === "VIENTIANE"
const pcDestMatch = (a: any, b: any) => { const A = String(a || "BKK").toUpperCase(), B = String(b || "BKK").toUpperCase(); return A === B || (pcLaos(A) && pcLaos(B)) }
function airPreCostOptions(airRows: any[], port: any, dest: string, weight: any, incoterm: any): { fwd: string; airline: string; cost: number }[] {
  const w = Number(weight) || 0
  if (!w || !port) return []
  const bk = pcBreakKey(w)
  const inc = String(incoterm || "").toUpperCase()
  const P = String(port).toUpperCase()
  const opts = (airRows || []).map((r: any) => {
    if (String(r.origin || "").toUpperCase() !== P || !pcDestMatch(dest, r.destination)) return null
    const rate = Number((r.rates || {})[bk])
    if (!rate || isNaN(rate)) return null
    const add = inc === "EX-WORK" ? (Number(r.origCostExw) || 0) : inc === "FCA" ? (Number(r.origCostFca) || 0) : 0
    return { fwd: r.fwd || "-", airline: r.airline || "", cost: Math.round((rate * w + add) * 100) / 100 }
  }).filter(Boolean) as { fwd: string; airline: string; cost: number }[]
  // De-dupe by FWD+airline, keep the row as-is (a port can list a FWD once per airline).
  const seen = new Set<string>()
  return opts.filter(o => { const k = `${o.fwd}|${o.airline}`; if (seen.has(k)) return false; seen.add(k); return true })
}

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
  // #4 batch fill: filter by port + ETC range, multi-select docs, fill actual across many at once.
  const [portF, setPortF] = useState("ALL")
  const [etcFrom, setEtcFrom] = useState("")
  const [etcTo, setEtcTo] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState<Record<string, string>>({})
  const [bulkBusy, setBulkBusy] = useState(false)
  // edits[docId] = { hawbNo, mawbNo, invoiceNo, actualAir } — ONE set per document (1 shipment / 1 doc).
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const [uploading, setUploading] = useState("")
  const [exporting, setExporting] = useState(false)
  const [courierRates, setCourierRates] = useState<any[]>([])
  const [seaRates, setSeaRates] = useState<any[]>([])
  const [airRates, setAirRates] = useState<any[]>([])
  const [editFwd, setEditFwd] = useState(false) // toggle the FWD picker for Pre cost
  useEffect(() => {
    fetch("/api/pull-material/courier-rates").then(r => r.json()).then(d => setCourierRates(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/sea-rates").then(r => r.json()).then(d => setSeaRates(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setAirRates(d.rows || [])).catch(() => {})
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

  // LG returns the doc to Purchasing (wrong attachment). Requires a reason; bumps the revise counter.
  const returnToPurchase = async (rq: any) => {
    const reason = prompt(`ตีกลับ ${rq.documentNo} ให้จัดซื้อแก้ไข\nระบุเหตุผล (เช่น ไฟล์แนบไม่ถูกต้อง):`)
    if (reason == null) return
    if (!reason.trim()) return alert("ต้องระบุเหตุผล")
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnToPurchase: true, returnReason: reason.trim() }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setOpenId(null); await load(); alert(`↩️ ตีกลับให้จัดซื้อแล้ว (Revise ครั้งที่ ${d.reviseCount})`) }
      else alert(d.error || "ตีกลับไม่สำเร็จ")
    } finally { setBusy(false) }
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
    if (!confirm(`Save ${rq.documentNo}?\nระบบจะเช็คว่ามี rate อย่างน้อย 1 mode (air/sea/courier) — ถ้าครบจะเด้งไป Approval ให้อัตโนมัติ`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setOpenId(null); await load(); alert("✅ บันทึกแล้ว — เด้งไป Approval เรียบร้อย") }
      else alert(d.error || "บันทึกไม่สำเร็จ (ยังไม่มี rate?)")
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

  // On opening a doc: auto-fill Pre cost from the AIR master (by weight), unless it's already set/edited.
  useEffect(() => {
    if (!openId || !airRates.length) { setEditFwd(false); return }
    const rq = reqs.find(r => r.id === openId)
    if (!rq || rq.status === "PENDING_LG_RATE") return
    if (rq.preCost != null || edits[openId]?.preCost !== undefined) { setEditFwd(false); return }
    const its = rq.items || []
    const d0 = its.find((x: any) => x.airFreightCost != null) || its[0] || {}
    const opts = airPreCostOptions(airRates, d0.port, destForBu(rq.bu), d0.weight, d0.incoterm)
    if (!opts.length) { setEditFwd(false); return }
    const def = rq.preCostFwd ? (opts.find(o => o.fwd === rq.preCostFwd) || opts[0]) : opts.reduce((a, b) => (b.cost > a.cost ? b : a))
    setEdits(p => ({ ...p, [openId]: { ...(p[openId] || {}), preCost: String(def.cost), preCostFwd: def.fwd } }))
    setEditFwd(false)
  }, [openId, airRates]) // eslint-disable-line

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
          preCost: raw(rq, "preCost") === "" ? null : raw(rq, "preCost"),
          preCostFwd: raw(rq, "preCostFwd") || null,
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

  // Save DRAFT — record LG's in-progress values (esp. Pre cost negotiated with the supplier) WITHOUT
  // closing the doc. Status stays as-is so LG can keep editing / finalize later.
  const saveDraft = async (rq: any) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hawbNo: raw(rq, "hawbNo") || null,
          mawbNo: raw(rq, "mawbNo") || null,
          flightEtd: rawDate(rq, "flightEtd") || null,
          flightEta: rawDate(rq, "flightEta") || null,
          poInvoices: buildPoInvoices(rq),
          preCost: raw(rq, "preCost") === "" ? null : raw(rq, "preCost"),
          preCostFwd: raw(rq, "preCostFwd") || null,
          actualAir: raw(rq, "actualAir") === "" ? null : raw(rq, "actualAir"),
          localChargeTh: raw(rq, "localChargeTh") === "" ? null : raw(rq, "localChargeTh"),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setEdits(p => { const n = { ...p }; delete n[rq.id]; return n }); await load(); alert("💾 บันทึก draft แล้ว (ยังไม่ปิดงาน)") }
      else alert(d.error || "บันทึก draft ไม่สำเร็จ")
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
  // #4 list-level export: all currently-shown docs (or the selected ones) → one workbook, one row per PO.
  const exportExcelList = async (docs: any[]) => {
    if (!docs.length) return alert("ไม่มีเอกสารให้ export")
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
        { header: "MAWB NO", key: "mawb", width: 16 }, { header: "HAWB NO", key: "hawb", width: 16 }, { header: "FLIGHT ETD", key: "etd", width: 14 }, { header: "FLIGHT ETA", key: "eta", width: 14 },
        { header: "PRE COST", key: "pre", width: 12 }, { header: "ACTUAL AIR", key: "act", width: 12 }, { header: "LOCAL CHARGE (TH)", key: "local", width: 14 },
      ]
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E9E9" } }
      const dstr = (v: any) => (v ? String(v).slice(0, 10) : "")
      const earliestD = (arr: any[]) => { const t = arr.map(v => (v ? new Date(v).getTime() : NaN)).filter(n => !isNaN(n)); return t.length ? new Date(Math.min(...t)).toISOString().slice(0, 10) : "" }
      for (const rq of docs) {
        const its: any[] = rq.items || []
        const d0 = its[0] || {}
        const pkgs = Array.isArray(rq.packages) ? rq.packages : []
        const pkgStr = pkgs.length ? pkgs.map((p: any) => `${fmt(p.qty)} ${p.uom}`).join(", ") : (d0.cartons ? String(fmt(d0.cartons)) : "")
        const dimStr = (d0.boxW || d0.boxL || d0.boxH) ? `${d0.boxW || "-"}x${d0.boxL || "-"}x${d0.boxH || "-"} cm` : ""
        const estTotal = its.reduce((a: number, i: any) => a + (Number(i.airFreightCost) || 0), 0)
        const byPo: Record<string, { qty: number; uoms: Set<string> }> = {}
        its.forEach(it => { const po = it.poNoDoc || "-"; const g = (byPo[po] ||= { qty: 0, uoms: new Set() }); g.qty += Number(it.pullMaterialQty) || 0; if (it.bomUom) g.uoms.add(it.bomUom) })
        Object.keys(byPo).forEach(po => ws.addRow({
          doc: rq.documentNo, bu: rq.bu, requester: rq.requesterName || "",
          po, qty: byPo[po].qty, uom: [...byPo[po].uoms].join(", "), inv: (rq.poInvoices || {})[po] || rq.invoiceNo || "",
          country: d0.country || "", port: d0.port || "", seaport: d0.seaPort || "", city: d0.city || "", incoterm: d0.incoterm || "", weight: d0.weight != null ? Number(d0.weight) : "",
          needDate: dstr(d0.needDate), shipDate: earliestD(its.map(i => i.shipmentDate)), mrd: earliestD(its.flatMap(i => [i.shipmentDate, i.mrdDate, i.mrdNeedDate, i.mrd2])), etc: dstr(d0.etc),
          package: pkgStr, dimension: dimStr, address: d0.pickupAddress || "", remark: rq.remark || "",
          est: estTotal || "", lt: d0.leadTimeAir || "",
          mawb: rq.mawbNo || "", hawb: rq.hawbNo || "", etd: dstr(rq.flightEtd), eta: dstr(rq.flightEta),
          pre: rq.preCost != null ? Number(rq.preCost) : "", act: rq.actualAir != null ? Number(rq.actualAir) : "", local: rq.localChargeTh != null ? Number(rq.localChargeTh) : "",
        }))
      }
      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      const a = document.createElement("a"); a.href = url; a.download = `PullRM_LG_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) { alert("Export Excel ไม่สำเร็จ: " + String((e as any)?.message || e).slice(0, 160)) } finally { setExporting(false) }
  }

  // #4 bulk fill: apply the shared LG values to every selected doc at once. complete=true also closes them.
  const bulkApply = async (complete: boolean) => {
    const ids = [...selectedIds]
    if (!ids.length) return alert("เลือกเอกสารก่อน")
    const g = (k: string) => (bulk[k] ?? "").trim()
    if (complete && !g("actualAir")) return alert("กรอก Actual Air Freight ก่อนปิดงาน")
    const anyVal = ["mawbNo", "hawbNo", "flightEtd", "flightEta", "preCost", "actualAir", "localChargeTh"].some(k => g(k) !== "")
    if (!anyVal) return alert("ยังไม่ได้กรอกค่าที่จะใส่")
    if (!confirm(`${complete ? "บันทึก + ปิดงาน" : "บันทึก draft"} ${ids.length} เอกสาร ด้วยค่าชุดเดียวกัน?`)) return
    setBulkBusy(true)
    try {
      for (const id of ids) {
        const body: any = {}
        if (g("mawbNo") !== "") body.mawbNo = g("mawbNo")
        if (g("hawbNo") !== "") body.hawbNo = g("hawbNo")
        if (g("flightEtd") !== "") body.flightEtd = g("flightEtd")
        if (g("flightEta") !== "") body.flightEta = g("flightEta")
        if (g("preCost") !== "") body.preCost = g("preCost")
        if (g("actualAir") !== "") body.actualAir = g("actualAir")
        if (g("localChargeTh") !== "") body.localChargeTh = g("localChargeTh")
        if (complete) body.status = "COMPLETED"
        await fetch(`/api/pull-material/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {})
      }
      setBulkOpen(false); setBulk({}); setSelectedIds(new Set()); await load()
      alert(`✅ ${complete ? "ปิดงาน" : "บันทึก draft"} ${ids.length} เอกสารแล้ว`)
    } finally { setBulkBusy(false) }
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
  // #4 helpers: a doc's ports + its ETC dates (from items PC entered).
  const docPorts = (r: any) => [...new Set((r.items || []).map((i: any) => i.port).filter(Boolean))] as string[]
  const docEtcs = (r: any) => (r.items || []).map((i: any) => (i.etc ? String(i.etc).slice(0, 10) : "")).filter(Boolean) as string[]
  const allPorts = [...new Set(reqs.filter(inTab).flatMap(docPorts))].sort()
  const matchPort = (r: any) => portF === "ALL" || docPorts(r).includes(portF)
  const matchEtc = (r: any) => {
    if (!etcFrom && !etcTo) return true
    const es = docEtcs(r); if (!es.length) return false
    return es.some(e => (!etcFrom || e >= etcFrom) && (!etcTo || e <= etcTo))
  }
  const shown = reqs.filter(r => inTab(r) && (typeF === "ALL" || (r.requestType || "SCM") === typeF) && matchPort(r) && matchEtc(r))
  const selectableShown = shown.filter(r => r.status !== "COMPLETED") // can't bulk-fill an already-closed doc
  const allSelected = selectableShown.length > 0 && selectableShown.every(r => selectedIds.has(r.id))
  const toggleSel = (id: string) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(selectableShown.map(r => r.id)))

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

          {lgTab === "actual" && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">Port</label>
                <select value={portF} onChange={e => { setPortF(e.target.value); setSelectedIds(new Set()) }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                  <option value="ALL">ทุก Port</option>
                  {allPorts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">ETC ตั้งแต่</label>
                <input type="date" value={etcFrom} onChange={e => { setEtcFrom(e.target.value); setSelectedIds(new Set()) }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">ถึง</label>
                <input type="date" value={etcTo} onChange={e => { setEtcTo(e.target.value); setSelectedIds(new Set()) }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white" />
              </div>
              {(portF !== "ALL" || etcFrom || etcTo) && <button onClick={() => { setPortF("ALL"); setEtcFrom(""); setEtcTo("") }} className="px-2 py-1.5 text-xs text-gray-500 underline">ล้าง filter</button>}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => exportExcelList(selectedIds.size ? shown.filter(r => selectedIds.has(r.id)) : shown)} disabled={exporting}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50">{exporting ? "…" : `📊 Export Excel${selectedIds.size ? ` (${selectedIds.size})` : " (ทั้งหมด)"}`}</button>
              </div>
            </div>
          )}

          {lgTab === "actual" && selectableShown.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-red-700" />
                <span className="text-gray-600">เลือกทั้งหมด ({selectableShown.length})</span>
              </label>
              {selectedIds.size > 0 && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-700 font-medium">เลือก {selectedIds.size} ใบ</span>
                  <button onClick={() => setBulkOpen(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: MAROON }}>✍️ กรอกหลายใบพร้อมกัน</button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 underline">ยกเลิกที่เลือก</button>
                </>
              )}
            </div>
          )}

          {loading ? <p className="text-sm text-gray-400">Loading…</p> :
            shown.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">{lgTab === "nomaster" ? "ไม่มีเอกสารที่รอเติม Air rate 🎉" : "ไม่มีเอกสารที่รอกรอก Actual"}</div> :
              <div className="space-y-2.5">
                {shown.map(rq => {
                  const estTotal = rq.items.reduce((sm: number, i: any) => sm + (Number(i.airFreightCost) || 0), 0)
                  const pos = [...new Set(rq.items.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
                  const done = rq.status === "COMPLETED" || rq.actualAir != null
                  const canSelect = lgTab === "actual" && rq.status !== "COMPLETED"
                  const ports = [...new Set(rq.items.map((i: any) => i.port).filter(Boolean))].join(", ")
                  const etc0 = (rq.items.find((i: any) => i.etc) || {}).etc
                  return (
                    <div key={rq.id} className={`flex items-stretch gap-2 bg-white rounded-2xl border shadow-sm hover:shadow-md transition ${selectedIds.has(rq.id) ? "border-red-300 ring-1 ring-red-200" : "border-gray-100 hover:border-gray-200"}`}>
                      {canSelect && (
                        <label className="flex items-center pl-4 cursor-pointer" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(rq.id)} onChange={() => toggleSel(rq.id)} className="w-4 h-4 accent-red-700" />
                        </label>
                      )}
                      <button onClick={() => setOpenId(rq.id)} className="flex-1 flex items-center justify-between gap-3 px-5 py-4 text-left min-w-0">
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
                          <div className="text-xs text-gray-400 mt-0.5">{rq.requesterName} · PO {pos || "-"}{ports ? ` · Port ${ports}` : ""}{etc0 ? ` · ETC ${String(etc0).slice(0, 10)}` : ""}</div>
                        </div>
                        <span className="shrink-0 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>Open →</span>
                      </button>
                    </div>
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
        const seaM = seaUsd(seaRates, d0.seaPort || d0.port, d0.country)
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
                  <button onClick={() => forwardApproval(rq)} disabled={busy} title="เติม rate ครบแล้ว → Save แล้วเด้งไป Approval"
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: "#16a34a" }}>{busy ? "…" : "💾 Save"}</button>
                )}
                <button onClick={() => recompute(rq)} disabled={recomputing} title="คำนวณ freight ใหม่ (dest by BU + origin cost)"
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 disabled:opacity-50">{recomputing ? "…" : "🔄 Recompute"}</button>
                <button onClick={() => openPreview(rq)} disabled={pdfing}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">{pdfing ? "…" : "🔍 Preview PDF"}</button>
                {rq.status !== "PENDING_LG_RATE" && rq.status !== "COMPLETED" && (
                  <button onClick={() => returnToPurchase(rq)} disabled={busy} title="ไฟล์แนบไม่ถูกต้อง → ตีกลับให้จัดซื้อแก้"
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50">{busy ? "…" : "↩️ ตีกลับจัดซื้อ"}</button>
                )}
                {rq.status !== "PENDING_LG_RATE" && (
                  <button onClick={() => saveDraft(rq)} disabled={busy} title="บันทึกค่าที่กรอกไว้ (รวม Pre cost) โดยยังไม่ปิดงาน"
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">{busy ? "…" : "📝 Save draft"}</button>
                )}
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
                      { key: "dhl", label: "📦 Courier · DHL", freight: dhl, inco: null, total: dhl, lt: null, actual: null, local: null, accent: "#b45309", link: addCourier("DHL"), over: cwt > 100 },
                      { key: "fedex", label: "📦 Courier · FedEx", freight: fedex, inco: null, total: fedex, lt: null, actual: null, local: null, accent: "#7c3aed", link: addCourier("FEDEX"), over: cwt > 100 },
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
                                  <div className="flex justify-between border-t border-gray-100 pt-1"><span className="text-gray-500 font-semibold">Total Freight</span>{m.total != null ? <span className="font-bold text-gray-900">{fmt(m.total)}</span> : (m as any).over ? <span className="text-gray-400 text-[10px]">&gt; 100kg</span> : <a href={m.link} className="text-amber-600 text-[10px] font-semibold underline hover:text-amber-700" title="ไปเพิ่ม rate ในหน้า Master Rate">no master → เพิ่ม</a>}</div>
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

              {/* LG entry — HAWB / INV / Actual (once per doc). LOCKED (grey) while No Master: LG must fill
                  the rate + Save (→ Approval) first; actual is entered later after the doc is approved. */}
              {(() => { const locked = rq.status === "PENDING_LG_RATE"
                const pcOpts = airPreCostOptions(airRates, d0.port, destForBu(rq.bu), d0.weight, d0.incoterm)
                const pcFwd = raw(rq, "preCostFwd")
                return (
              <div className="space-y-4">
                <div className={`bg-white rounded-2xl border shadow-sm p-5 ${locked ? "border-gray-200 bg-gray-50" : "border-gray-100"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-gray-800">Logistics — Actual</div>
                    {locked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-semibold">🔒 เติม rate ก่อน</span>}
                  </div>
                  <div className={`space-y-3 ${locked ? "opacity-50 pointer-events-none select-none" : ""}`}>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">MAWB NO</label>
                      <input disabled={locked} value={raw(rq, "mawbNo")} onChange={e => setVal(rq.id, "mawbNo", e.target.value)} placeholder="MAWB…" className={inp} /></div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">HAWB NO</label>
                      <input disabled={locked} value={raw(rq, "hawbNo")} onChange={e => setVal(rq.id, "hawbNo", e.target.value)} placeholder="HAWB…" className={inp} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[11px] font-semibold text-green-700 block mb-1">FLIGHT ETD</label>
                        <input disabled={locked} type="date" value={rawDate(rq, "flightEtd")} onChange={e => setVal(rq.id, "flightEtd", e.target.value)} className={inp} /></div>
                      <div><label className="text-[11px] font-semibold text-green-700 block mb-1">FLIGHT ETA</label>
                        <input disabled={locked} type="date" value={rawDate(rq, "flightEta")} onChange={e => setVal(rq.id, "flightEta", e.target.value)} className={inp} /></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-amber-700">PRE COST (USD) <span className="font-normal text-gray-400">· auto จาก Air master (ตามน้ำหนัก){pcFwd ? ` · FWD ${pcFwd}` : ""}</span></label>
                        {pcOpts.length > 0 && <button type="button" onClick={() => setEditFwd(v => !v)} className="text-[11px] text-amber-700 underline hover:text-amber-800">{editFwd ? "ปิด" : "✏️ แก้ไข FWD"}</button>}
                      </div>
                      <input disabled={locked} type="number" value={raw(rq, "preCost")} onChange={e => setVal(rq.id, "preCost", e.target.value)} placeholder="0" className={inp} />
                      {editFwd && pcOpts.length > 0 && (
                        <select disabled={locked} value={pcFwd} onChange={e => { const o = pcOpts.find(x => x.fwd === e.target.value); if (o) { setVal(rq.id, "preCostFwd", o.fwd); setVal(rq.id, "preCost", String(o.cost)) } }}
                          className={inp + " mt-1.5"}>
                          {!pcOpts.some(o => o.fwd === pcFwd) && <option value={pcFwd}>{pcFwd || "— เลือก FWD —"}</option>}
                          {pcOpts.map(o => <option key={`${o.fwd}|${o.airline}`} value={o.fwd}>{o.fwd}{o.airline ? ` (${o.airline})` : ""} — {fmt(o.cost)} USD</option>)}
                        </select>
                      )}
                    </div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">ACTUAL AIR FREIGHT <span className="text-red-500">*</span></label>
                      <input disabled={locked} type="number" value={raw(rq, "actualAir")} onChange={e => setVal(rq.id, "actualAir", e.target.value)} placeholder="0" className={inp} /></div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">LOCAL CHARGE (TH)</label>
                      <input disabled={locked} type="number" value={raw(rq, "localChargeTh")} onChange={e => setVal(rq.id, "localChargeTh", e.target.value)} placeholder="0" className={inp} /></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className={estTotal ? "text-gray-500" : "text-amber-600 font-medium"}>{estTotal ? `Est ${fmt(estTotal)} USD` : "⚠️ ไม่มี rate — เพิ่ม Master Rate"}</span>
                    {actTotal > 0 && <span className={`px-2 py-0.5 rounded-full font-medium ${diff > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))}</span>}
                  </div>
                  <div className={`mt-3 pt-3 border-t border-gray-100 ${locked ? "opacity-50 pointer-events-none select-none" : ""}`}>
                    <label className="text-[11px] font-semibold text-green-700 block mb-1">แนบไฟล์ (HAWB / INV / เอกสาร — แนบได้หลายไฟล์)</label>
                    <input type="file" multiple disabled={locked || uploading === rq.id}
                      onChange={e => { uploadAtt(rq, e.target.files); e.currentTarget.value = "" }}
                      className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50" />
                    {uploading === rq.id
                      ? <p className="text-[11px] text-gray-400 mt-1">กำลังอัปโหลด…</p>
                      : (rq.attachments || []).length > 0 && <p className="text-[11px] text-gray-400 mt-1">แนบแล้ว {rq.attachments.length} ไฟล์ (ดูรายการด้านบน)</p>}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">{locked ? "🔒 เอกสารนี้ยังไม่มี rate — เติม Master Rate แล้วกด 💾 Save (มุมขวาบน) เพื่อเด้งไป Approval ก่อน แล้วจึงกลับมากรอก Actual ทีหลัง" : "กรอกครั้งเดียวต่อเอกสาร · Save แล้วกด “Preview PDF” เพื่อออกเอกสาร"}</p>
                </div>
              </div>
              )})()}
            </div>
          </div>
        )
      })()}

      {/* #4 bulk fill modal — apply the same LG values to every selected doc */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !bulkBusy && setBulkOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">กรอก {selectedIds.size} เอกสารพร้อมกัน</h3>
              <button onClick={() => setBulkOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="text-[11px] text-gray-400">ค่าที่กรอกจะใส่ให้ทุกเอกสารที่เลือก (เว้นว่าง = ไม่แตะ field นั้น) — เหมาะกับ port + ETC เดียวกัน rate เท่ากัน</p>
            <div className="space-y-2.5">
              {([["mawbNo", "MAWB NO", "text"], ["hawbNo", "HAWB NO", "text"], ["flightEtd", "FLIGHT ETD", "date"], ["flightEta", "FLIGHT ETA", "date"], ["preCost", "PRE COST (USD)", "number"], ["actualAir", "ACTUAL AIR FREIGHT", "number"], ["localChargeTh", "LOCAL CHARGE (TH)", "number"]] as const).map(([k, label, type]) => (
                <div key={k}>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1">{label}</label>
                  <input type={type} value={bulk[k] || ""} onChange={e => setBulk(p => ({ ...p, [k]: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => bulkApply(false)} disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">{bulkBusy ? "…" : "📝 บันทึก draft"}</button>
              <button onClick={() => bulkApply(true)} disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>{bulkBusy ? "…" : "💾 บันทึก + ปิดงาน"}</button>
            </div>
          </div>
        </div>
      )}

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
