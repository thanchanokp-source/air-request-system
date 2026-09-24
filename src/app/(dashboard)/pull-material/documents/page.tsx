"use client"

import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"
import { courierUsd, destForBu, seaUsd, pullLandedCost, cheapestMode, modeTotals, SHIP_MODE_LABEL, EXCHANGE_RATE, type ShipMode } from "@/lib/pull-courier"
import { pullReqType } from "@/lib/pull-reqtype"
import LandedCostCompare from "@/components/pull/LandedCostCompare"
import { FWD_SHEET, parseFwdRow } from "@/lib/pull-fwd-template"

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
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING" | "SAMPLE">("ALL")
  // Queue tabs: docs LG still owes an actual for (default) · already entered · missing master rate.
  const [lgTab, setLgTab] = useState<"actual" | "done" | "nomaster">("actual")
  const [q, setQ] = useState("")            // free text: doc / PO / SO / requester / HAWB / INV
  const [brandF, setBrandF] = useState("ALL")
  const [vendorF, setVendorF] = useState("ALL")
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
  const [truckRates, setTruckRates] = useState<any[]>([])
  const [editFwd, setEditFwd] = useState(false) // toggle the FWD picker for Pre cost
  // ── Shipping mode — LG has the FINAL say. The approver's pick arrives on the doc (approvedMode);
  // LG may change it here WITHOUT a re-approval (the change is logged + emailed to the approver).
  const [lgMode, setLgMode] = useState<ShipMode | null>(null)
  const [lgModeReason, setLgModeReason] = useState("")
  const [modeBusy, setModeBusy] = useState(false)
  // ── Actual currency ─────────────────────────────────────────────────────────────────────────
  // LG normally types the actual in THB; Est/landed cost is USD. The two ACTUAL boxes are shown in
  // whichever unit LG picks, and are ALWAYS converted to USD before saving (DB keeps USD only).
  const [actCur, setActCur] = useState<"THB" | "USD">("THB")
  const r2 = (n: number) => Math.round(n * 100) / 100
  const usdOf = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : (actCur === "THB" ? r2(n / EXCHANGE_RATE) : n) }
  const showOf = (usd: any) => { const n = Number(usd); return isNaN(n) ? "" : String(actCur === "THB" ? r2(n * EXCHANGE_RATE) : r2(n)) }
  // Value for the two money inputs, in the CURRENTLY selected unit (edits are kept in that unit).
  const money = (rq: any, k: string) => edits[rq.id]?.[k] ?? (rq[k] != null ? showOf(rq[k]) : "")
  // Switching unit converts whatever is already typed, so nothing is lost mid-entry.
  const switchCur = (rq: any, to: "THB" | "USD") => {
    if (to === actCur) return
    const f = to === "THB" ? EXCHANGE_RATE : 1 / EXCHANGE_RATE
    setEdits(p => {
      const cur = { ...(p[rq.id] || {}) }
      for (const k of ["actualAir", "localChargeTh"]) {
        const v = cur[k]
        if (v !== undefined && v !== "" && !isNaN(Number(v))) cur[k] = String(r2(Number(v) * f))
      }
      return { ...p, [rq.id]: cur }
    })
    setActCur(to)
  }

  // ── Phase 2 — forwarder template (AIR only): mail it out, import the filled file back.
  const [forwarders, setForwarders] = useState<any[]>([])
  const [fwdName, setFwdName] = useState("")
  const [fwdEmail, setFwdEmail] = useState("")
  const [fwdNote, setFwdNote] = useState("")
  const [fwdBusy, setFwdBusy] = useState(false)
  useEffect(() => {
    fetch("/api/pull-material/courier-rates").then(r => r.json()).then(d => setCourierRates(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/sea-rates").then(r => r.json()).then(d => setSeaRates(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setAirRates(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/truck-rates").then(r => r.json()).then(d => setTruckRates(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/forwarders").then(r => r.json()).then(d => setForwarders(d.rows || [])).catch(() => {})
  }, [])
  const [backfilling, setBackfilling] = useState(false)

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
  const uploadAtt = async (rq: any, files: FileList | null, category = "", source = "LG") => {
    if (!files || !files.length) return
    setUploading(rq.id)
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append("file", f)
        if (category) fd.append("category", category)
        if (source) fd.append("source", source)
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
    // Default Pre cost = the FWD from the master route as captured in the sheet (each origin+dest has one
    // main FWD → opts[0]). LG can still switch via "แก้ไข FWD". Honours a previously-saved FWD choice.
    const def = rq.preCostFwd ? (opts.find(o => o.fwd === rq.preCostFwd) || opts[0]) : opts[0]
    setEdits(p => ({ ...p, [openId]: { ...(p[openId] || {}), preCost: String(def.cost), preCostFwd: def.fwd } }))
    setEditFwd(false)
  }, [openId, airRates]) // eslint-disable-line

  // No-Master flow: when LG opens a PENDING_LG_RATE doc, AUTO-recompute freight from the master (in case LG
  // just added the missing rate) — so Est refreshes on its own, no "Recompute" button needed.
  useEffect(() => {
    if (!openId) return
    const rq = reqs.find(r => r.id === openId)
    if (!rq || rq.status !== "PENDING_LG_RATE") return
    fetch(`/api/pull-material/${openId}/recompute`, { method: "POST" }).then(r => { if (r.ok) load() }).catch(() => {})
  }, [openId]) // eslint-disable-line

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const raw = (rq: any, k: string) => edits[rq.id]?.[k] ?? (rq[k] != null ? String(rq[k]) : "")
  // Date fields → normalize to YYYY-MM-DD for <input type=date>.
  const rawDate = (rq: any, k: string) => edits[rq.id]?.[k] ?? (rq[k] ? String(rq[k]).slice(0, 10) : "")
  // Per-PO invoice (stored in rq.poInvoices map); edits are keyed "poinv:<po>".
  const poInv = (rq: any, po: string) => edits[rq.id]?.["poinv:" + po] ?? ((rq.poInvoices || {})[po] || "")
  const buildPoInvoices = (rq: any) => { const m: Record<string, string> = { ...(rq.poInvoices || {}) }; Object.entries(edits[rq.id] || {}).forEach(([k, v]) => { if (k.startsWith("poinv:")) { const po = k.slice(6); if (v) m[po] = v; else delete m[po] } }); return m }

  // Landed cost of a doc — same helper the compare box uses, so LG and Approval can never disagree.
  const landedOf = (rq: any) => {
    const its = rq?.items || []
    const d0 = its.find((x: any) => x.airFreightCost != null) || its[0] || {}
    return { d0, lc: pullLandedCost({ airRows: airRates, seaRows: seaRates, courierRows: courierRates, truckRows: truckRates, port: d0.port, seaPort: d0.seaPort, country: d0.country, weight: d0.weight, incoterm: d0.incoterm, bu: rq?.bu, factory: rq?.factory || d0.factory }) }
  }

  // Opening a doc → start from the mode in force: LG's own last pick, else what the approver approved,
  // else the cheapest priced mode. AIR is what the user asked for in the first place.
  useEffect(() => {
    const rq = reqs.find(r => r.id === openId)
    if (!rq) { setLgMode(null); setLgModeReason(""); return }
    const { lc } = landedOf(rq)
    setLgMode((rq.shipMode as ShipMode) || (rq.approvedMode as ShipMode) || cheapestMode(lc) || "AIR")
    setLgModeReason(rq.shipModeReason || "")
  }, [openId, reqs, airRates, seaRates, courierRates, truckRates]) // eslint-disable-line

  // FWD name (as spelled in the rate master) → email from MASTER FWD. Ignores case/spaces/dots so
  // "B.F.I" in the rate sheet still finds the "BFI" contact.
  const fwdKey = (s: any) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const fwdEmailOf = (name: any) => forwarders.find((f: any) => fwdKey(f.name) === fwdKey(name))?.email || ""

  // Opening a doc → prefill the FWD box: what was used before, else the FWD behind the Pre cost,
  // and its email from the contact master.
  useEffect(() => {
    const rq = reqs.find(r => r.id === openId)
    if (rq) setActCur(rq.actualCurrency === "USD" ? "USD" : "THB")
    if (!rq) { setFwdName(""); setFwdEmail(""); setFwdNote(""); return }
    const name = rq.fwdName || rq.preCostFwd || ""
    setFwdName(name)
    setFwdEmail(rq.fwdEmail || fwdEmailOf(name) || "")
    setFwdNote("")
  }, [openId, reqs, forwarders]) // eslint-disable-line

  // Mail the forwarder this shipment's template (grey = our data, green = what they fill in).
  const sendFwd = async (rq: any) => {
    if (!fwdEmail.trim()) return alert("กรอกอีเมล Forwarder ก่อน")
    if (!confirm(`ส่งเมลพร้อมไฟล์ให้ ${fwdName || "FWD"} (${fwdEmail}) สำหรับ ${rq.documentNo}?`)) return
    setFwdBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}/fwd-request`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fwdName: fwdName.trim(), fwdEmail: fwdEmail.trim(), note: fwdNote.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { await load(); alert(`ส่งแล้ว → ${(d.sentTo || []).join(", ")}`) } else alert(d.error || "ส่งไม่สำเร็จ")
    } catch (e) { alert("Error: " + String((e as any)?.message || e).slice(0, 160)) } finally { setFwdBusy(false) }
  }

  // Import the workbook the FWD returned → fill the LG form (review, then Save) + keep the file on
  // the doc as an attachment. Row is matched by the hidden _DOCID column, else the only data row.
  const importFwd = async (rq: any, file: File) => {
    setFwdBusy(true)
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const ws = wb.Sheets[FWD_SHEET] || wb.Sheets[wb.SheetNames[0]]
      if (!ws) return alert("อ่านไฟล์ไม่ได้ — ไม่พบ sheet")
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
      const hit = rows.find(r => String(r._DOCID || "").trim() === rq.id)
        || rows.filter(r => Object.values(r).some(v => String(v).trim() !== ""))[rows.length > 1 ? rows.length - 1 : 0]
      if (!hit) return alert("ไม่พบข้อมูลในไฟล์")
      if (hit._DOCID && String(hit._DOCID).trim() !== rq.id) {
        if (!confirm("ไฟล์นี้เป็นของเอกสารอื่น (DOCID ไม่ตรง) — ยืนยันจะ import เข้าเอกสารนี้?")) return
      }
      const vals = parseFwdRow(hit)
      if (!Object.keys(vals).length) return alert("ไฟล์ยังไม่มีข้อมูลในคอลัมน์สีเขียว")
      setEdits(p => ({ ...p, [rq.id]: { ...(p[rq.id] || {}), ...Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, String(v)])), actualSource: "FWD" } }))
      // Keep the returned file on the document (LG source, category FWD).
      const fd = new FormData(); fd.append("file", file); fd.append("category", "FWD"); fd.append("source", "LG")
      await fetch(`/api/pull-material/${rq.id}/attachments`, { method: "POST", body: fd }).catch(() => {})
      await load()
      alert(`Import สำเร็จ ${Object.keys(vals).length} ช่อง — ตรวจค่าด้านล่างแล้วกด Save`)
    } catch (e) { alert("Import ไม่สำเร็จ: " + String((e as any)?.message || e).slice(0, 160)) } finally { setFwdBusy(false) }
  }

  // LG confirms / overrides the shipping mode — FINAL say, no re-approval. Logged + the approver is
  // emailed whenever it differs from the mode that was approved.
  const saveMode = async (rq: any) => {
    if (!lgMode) return
    if (lgMode !== "AIR" && !lgModeReason.trim()) return alert("เอกสารนี้ผู้ขอร้องขอ AIR — เลือก mode อื่นต้องระบุเหตุผล")
    const { d0, lc } = landedOf(rq)
    const t = modeTotals(lc)
    if (rq.approvedMode && rq.approvedMode !== lgMode &&
      !confirm(`เปลี่ยน mode จากที่อนุมัติไว้ (${rq.approvedMode}) → ${lgMode}?\n\nระบบจะบันทึกประวัติและแจ้งเมลผู้อนุมัติ (ไม่ต้องอนุมัติใหม่)`)) return
    setModeBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipMode: lgMode, shipModeReason: lgModeReason.trim() || null, shipModeSource: "LG",
          shipModeEst: { estAir: t.AIR, estSea: t.SEA, estCourier: t.COURIER, chosenEst: t[lgMode],
            port: d0.port, seaPort: d0.seaPort, weightKg: d0.weight, brand: d0.brand, carrier: lgMode === "COURIER" ? "DHL" : null },
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { await load(); alert(`บันทึก mode ขนส่งแล้ว: ${lgMode}`) } else alert(d.error || "บันทึกไม่สำเร็จ")
    } catch (e) { alert("Error: " + String((e as any)?.message || e).slice(0, 160)) } finally { setModeBusy(false) }
  }

  // Save the actual (HAWB / INV / Actual Air) → closes the doc (COMPLETED) so it shows done in Tracking.
  const save = async (rq: any) => {
    if (!String(money(rq, "actualAir")).trim()) return alert("กรอก Actual Air Freight ก่อนบันทึก")
    if (!confirm(`บันทึก Actual และปิดงาน ${rq.documentNo}?\n\nActual: ${money(rq, "actualAir")} ${actCur}${actCur === "THB" ? ` (= ${usdOf(money(rq, "actualAir"))} USD)` : ""}\nHAWB: ${raw(rq, "hawbNo") || "-"}\n\nสถานะเอกสารจะเปลี่ยนเป็น COMPLETED`)) return
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
          cfmInHouseDate: rawDate(rq, "cfmInHouseDate") || null,
          poInvoices: buildPoInvoices(rq),
          preCost: raw(rq, "preCost") === "" ? null : raw(rq, "preCost"),
          preCostFwd: raw(rq, "preCostFwd") || null,
          // Always stored in USD; actualCurrency records the unit LG typed.
          actualAir: money(rq, "actualAir") === "" ? null : usdOf(money(rq, "actualAir")),
          localChargeTh: money(rq, "localChargeTh") === "" ? null : usdOf(money(rq, "localChargeTh")),
          actualCurrency: actCur,
          // Phase 2: values imported from the forwarder's workbook (blank when LG typed them).
          ...(raw(rq, "fwdRemark") ? { fwdRemark: raw(rq, "fwdRemark") } : {}),
          ...(raw(rq, "actualSource") ? { actualSource: raw(rq, "actualSource") } : {}),
          status: "COMPLETED",
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        // Keep a printable record on the document itself (like Air Claim) — regenerated on every save,
        // so the newest file always matches what was just entered.
        try {
          const blob = await buildPdfBlob(rq)
          const fd = new FormData()
          fd.append("file", new File([blob], `${rq.documentNo}_LG_actual.pdf`, { type: "application/pdf" }))
          fd.append("category", "SUMMARY"); fd.append("source", "LG")
          await fetch(`/api/pull-material/${rq.id}/attachments`, { method: "POST", body: fd })
        } catch (e) { console.error("attach pdf failed", e) }
        setEdits(p => { const n = { ...p }; delete n[rq.id]; return n }); setOpenId(null); await load()
      }
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
          cfmInHouseDate: rawDate(rq, "cfmInHouseDate") || null,
          poInvoices: buildPoInvoices(rq),
          preCost: raw(rq, "preCost") === "" ? null : raw(rq, "preCost"),
          preCostFwd: raw(rq, "preCostFwd") || null,
          // Always stored in USD; actualCurrency records the unit LG typed.
          actualAir: money(rq, "actualAir") === "" ? null : usdOf(money(rq, "actualAir")),
          localChargeTh: money(rq, "localChargeTh") === "" ? null : usdOf(money(rq, "localChargeTh")),
          actualCurrency: actCur,
          // Phase 2: values imported from the forwarder's workbook (blank when LG typed them).
          ...(raw(rq, "fwdRemark") ? { fwdRemark: raw(rq, "fwdRemark") } : {}),
          ...(raw(rq, "actualSource") ? { actualSource: raw(rq, "actualSource") } : {}),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setEdits(p => { const n = { ...p }; delete n[rq.id]; return n }); await load(); alert("💾 บันทึก draft แล้ว (ยังไม่ปิดงาน)") }
      else alert(d.error || "บันทึก draft ไม่สำเร็จ")
    } catch (e) { alert("Error: " + String((e as any)?.message || e).slice(0, 160)) } finally { setBusy(false) }
  }

  // Build the document PDF (PC + LG data + attachment list) and open it in a preview popup.
  // The doc as it stands on screen (saved values + anything LG just typed) — money always in USD.
  const mergedDoc = (rq: any) => ({
    ...rq,
    hawbNo: raw(rq, "hawbNo") || null, mawbNo: raw(rq, "mawbNo") || null, invoiceNo: raw(rq, "invoiceNo") || null,
    flightEtd: rawDate(rq, "flightEtd") || null, flightEta: rawDate(rq, "flightEta") || null,
    cfmInHouseDate: rawDate(rq, "cfmInHouseDate") || null,
    preCost: raw(rq, "preCost") === "" ? null : Number(raw(rq, "preCost")),
    preCostFwd: raw(rq, "preCostFwd") || null,
    actualAir: money(rq, "actualAir") === "" ? null : usdOf(money(rq, "actualAir")),
    localChargeTh: money(rq, "localChargeTh") === "" ? null : usdOf(money(rq, "localChargeTh")),
    actualCurrency: actCur, shipMode: lgMode || rq.shipMode || rq.approvedMode || "AIR",
    poInvoices: buildPoInvoices(rq),
  })

  // Render the LG document to a PDF blob (same layout as the Preview popup).
  const buildPdfBlob = async (rq: any) => {
    const [{ pdf }, { PullMaterialPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/pull-material-pdf")])
    return await pdf(React.createElement(PullMaterialPdf, { req: mergedDoc(rq) }) as any).toBlob()
  }

  const openPreview = async (rq: any) => {
    setPdfing(true)
    try {
      const blob = await buildPdfBlob(rq)
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

  // #4 bulk fill: only the MAWB NO is shared across many docs (one master AWB per consolidation) —
  // HAWB / Pre cost / Actual / Local charge differ per document, so bulk only applies the MAWB.
  const bulkApply = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return alert("เลือกเอกสารก่อน")
    const mawb = (bulk["mawbNo"] ?? "").trim()
    if (!mawb) return alert("กรอกเลข MAWB ก่อน")
    if (!confirm(`ใส่ MAWB "${mawb}" ให้ ${ids.length} เอกสารที่เลือก?`)) return
    setBulkBusy(true)
    try {
      for (const id of ids) {
        await fetch(`/api/pull-material/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mawbNo: mawb }) }).catch(() => {})
      }
      setBulkOpen(false); setBulk({}); setSelectedIds(new Set()); await load()
      alert(`✅ ใส่ MAWB ให้ ${ids.length} เอกสารแล้ว`)
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
  // "Actual entered" = closed (COMPLETED) or the figure is already saved as a draft → it leaves the
  // working queue and lives under the "กรอกแล้ว" tab, so the first tab only shows real work left.
  const actualDone = (r: any) => r.status === "COMPLETED" || r.actualAir != null
  const inTab = (r: any) =>
    lgTab === "nomaster" ? r.status === "PENDING_LG_RATE"
      : lgTab === "done" ? (r.status !== "PENDING_LG_RATE" && actualDone(r))
        : (r.status !== "PENDING_LG_RATE" && !actualDone(r))
  const nNoMaster = reqs.filter(r => r.status === "PENDING_LG_RATE").length
  const nDone = reqs.filter(r => r.status !== "PENDING_LG_RATE" && actualDone(r)).length
  const nActual = reqs.length - nNoMaster - nDone
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
  // Brand / supplier come from the BOM lines; a doc can carry more than one of each.
  const docBrands = (r: any) => [...new Set((r.items || []).map((i: any) => i.brand).filter(Boolean))] as string[]
  const docVendors = (r: any) => [...new Set((r.items || []).map((i: any) => i.vendorName).filter(Boolean))] as string[]
  const allBrands = [...new Set(reqs.filter(inTab).flatMap(docBrands))].sort()
  const allVendors = [...new Set(reqs.filter(inTab).flatMap(docVendors))].sort()
  const matchBrand = (r: any) => brandF === "ALL" || docBrands(r).includes(brandF)
  const matchVendor = (r: any) => vendorF === "ALL" || docVendors(r).includes(vendorF)
  // One search box over everything LG actually looks a doc up by.
  const matchQ = (r: any) => {
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    const hay = [r.documentNo, r.requesterName, r.requesterEmail, r.hawbNo, r.mawbNo, r.invoiceNo, r.fwdName,
      ...(r.items || []).flatMap((i: any) => [i.poNoDoc, i.soNoDoc, i.brand, i.vendorName, i.itemName, i.itemCode, i.port])]
    return hay.some((v: any) => String(v || "").toLowerCase().includes(needle))
  }
  const shown = reqs.filter(r => inTab(r) && (typeF === "ALL" || pullReqType(r) === typeF) && matchPort(r) && matchEtc(r) && matchBrand(r) && matchVendor(r) && matchQ(r))
  const selectableShown = shown.filter(r => r.status !== "COMPLETED") // can't bulk-fill an already-closed doc
  const allSelected = selectableShown.length > 0 && selectableShown.every(r => selectedIds.has(r.id))
  const toggleSel = (id: string) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(selectableShown.map(r => r.id)))

  return (
    <div className="p-5 md:p-8 max-w-[1100px] mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>LOGISTICS</h1></div>
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
            {([["actual", "📥 รอกรอก Actual", nActual], ["done", "✅ กรอกแล้ว", nDone], ["nomaster", "⚠️ No Master", nNoMaster]] as const).map(([v, label, n]) => (
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
            {([["ALL", "ทั้งหมด"], ["SCM", "SCM request"], ["PURCHASING", "PC request"], ["SAMPLE", "🧪 Sample"]] as const).map(([v, label]) => {
              const n = reqs.filter(r => inTab(r) && (v === "ALL" || pullReqType(r) === v)).length
              return (
                <button key={v} onClick={() => setTypeF(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${typeF === v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                  style={typeF === v ? { background: MAROON } : undefined}>{label} <span className="opacity-70">({n})</span></button>
              )
            })}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">ค้นหา</label>
                <input value={q} onChange={e => { setQ(e.target.value); setSelectedIds(new Set()) }}
                  placeholder="🔍 เลขเอกสาร / PO / SO / Brand / Supplier / HAWB / INV / ผู้ขอ…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">Brand</label>
                <select value={brandF} onChange={e => { setBrandF(e.target.value); setSelectedIds(new Set()) }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white max-w-[190px]">
                  <option value="ALL">ทุก Brand</option>
                  {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">Supplier</label>
                <select value={vendorF} onChange={e => { setVendorF(e.target.value); setSelectedIds(new Set()) }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white max-w-[220px]">
                  <option value="ALL">ทุก Supplier</option>
                  {allVendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
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
              {(portF !== "ALL" || etcFrom || etcTo || q || brandF !== "ALL" || vendorF !== "ALL") &&
                <button onClick={() => { setPortF("ALL"); setEtcFrom(""); setEtcTo(""); setQ(""); setBrandF("ALL"); setVendorF("ALL") }} className="px-2 py-1.5 text-xs text-gray-500 underline">ล้าง filter</button>}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-400">{shown.length} ใบ</span>
                <button onClick={() => exportExcelList(selectedIds.size ? shown.filter(r => selectedIds.has(r.id)) : shown)} disabled={exporting}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50">{exporting ? "…" : `📊 Export Excel${selectedIds.size ? ` (${selectedIds.size})` : " (ทั้งหมด)"}`}</button>
              </div>
            </div>

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
            shown.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">{lgTab === "nomaster" ? "ไม่มีเอกสารที่รอเติม Air rate 🎉" : lgTab === "done" ? "ยังไม่มีเอกสารที่กรอก Actual แล้ว" : "ไม่มีเอกสารที่รอกรอก Actual 🎉"}</div> :
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
        const actTotal = money(rq, "actualAir") === "" ? 0 : usdOf(money(rq, "actualAir"))  // USD
        const diff = actTotal - estTotal
        const pkgs = Array.isArray(rq.packages) ? rq.packages : []
        const pkgStr = pkgs.length ? pkgs.map((p: any) => `${fmt(p.qty)} ${p.uom}`).join(", ") : (d0.cartons ? String(fmt(d0.cartons)) : "")
        const dimStr = (d0.boxW || d0.boxL || d0.boxH) ? `${d0.boxW || "-"}×${d0.boxL || "-"}×${d0.boxH || "-"} cm` : ""
        const seaM = seaUsd(seaRates, d0.seaPort || d0.port, d0.country)
        const earliest = (arr: any[]) => { const t = arr.map(v => (v ? new Date(v).getTime() : NaN)).filter(n => !isNaN(n)); return t.length ? new Date(Math.min(...t)) : null }
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
                  {(rq.attachments || []).length > 0 && (() => {
                    const CATL: Record<string, string> = { INV: "INV", PACKING: "Packing", AWB: "AWB", CUSTOMS: "ใบขน", COMBINED: "รวม", FWD: "FWD file", SUMMARY: "ใบสรุป LG (PDF)" }
                    const grp = (s: string) => (rq.attachments || []).filter((a: any) => a.source === s || (!a.source && s === "PC"))
                    return (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="text-[11px] font-semibold text-gray-500 uppercase mb-2">แนบไฟล์ ({rq.attachments.length})</div>
                        <div className="space-y-2">
                          {([["PC", "📄 จัดซื้อ (PC)"], ["LG", "🚚 Logistics (LG)"]] as const).map(([s, label]) => {
                            const g = grp(s); if (!g.length) return null
                            return (
                              <div key={s}>
                                <div className="text-[10px] text-gray-400 font-semibold mb-1">{label}</div>
                                <div className="flex flex-wrap gap-1.5">{g.map((a: any) => (
                                  <a key={a.id} href={`/api/pull-material/attachments/${a.id}`} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[11px] bg-sky-50 border border-sky-200 text-sky-800 rounded-full px-2.5 py-1 hover:bg-sky-100">
                                    {a.category && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-200 text-sky-800">{CATL[a.category] || a.category}</span>}
                                    📎 <span className="max-w-[200px] truncate" title={a.fileName}>{a.fileName}</span></a>
                                ))}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
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

                  {/* Full LANDED-COST compare (Air / Courier / Sea + Market) — all USD, shared with request & approval.
                      "no master" rows still deep-link to the rate page so LG can add the missing rate. */}
                  {(() => {
                    const cwt = Number(d0.weight) || 0
                    const noAir = !airRates.some((r: any) => String(r.origin || "").toUpperCase() === String(d0.port || "").toUpperCase())
                    const addLink = (type: "air" | "sea", port: any) => `/pull-material/rates?prefill=${encodeURIComponent(JSON.stringify([{ type, country: d0.country || "", port: port || "" }]))}`
                    const addCourier = (carrier: string) => `/pull-material/rates?prefill=${encodeURIComponent(JSON.stringify([{ type: "courier", country: d0.country || "", port: d0.port || "", carrier }]))}`
                    return (
                      <div className="mb-4 space-y-2">
                        <LandedCostCompare airRows={airRates} seaRows={seaRates} courierRows={courierRates} truckRows={truckRates}
                          port={d0.port} seaPort={d0.seaPort} country={d0.country} weight={d0.weight} incoterm={d0.incoterm} bu={rq.bu} factory={raw(rq, "factory") || d0.factory}
                          value={rq.status === "COMPLETED" ? (rq.shipMode as ShipMode) || null : lgMode}
                          onChange={rq.status === "COMPLETED" ? undefined : setLgMode}
                          requestedMode="AIR" needDate={d0.needDate} leadTimeAir={d0.leadTimeAir} leadTimeSea={d0.leadTimeSea} />

                        {/* LG = final say. Shows what the approver approved, lets LG change it (reason + log). */}
                        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <span className="text-[11px] text-sky-900">
                              ✅ Approver อนุมัติ: <b>{rq.approvedMode ? SHIP_MODE_LABEL[rq.approvedMode as ShipMode] : "—"}</b>
                              {rq.approvedEst != null && <span className="text-sky-700"> · {fmt(rq.approvedEst)} USD</span>}
                            </span>
                            <span className="text-[11px] text-sky-900">
                              🚚 LG เลือก: <b>{lgMode ? SHIP_MODE_LABEL[lgMode] : "—"}</b>
                            </span>
                            {rq.approvedMode && lgMode && rq.approvedMode !== lgMode && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">LG เปลี่ยนจาก {rq.approvedMode} → {lgMode}</span>
                            )}
                            {rq.status !== "COMPLETED" && (
                              <button onClick={() => saveMode(rq)} disabled={modeBusy}
                                className="ml-auto px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50" style={{ background: "#0369a1" }}>
                                {modeBusy ? "…" : "💾 ยืนยัน mode (LG ชี้ขาด)"}
                              </button>
                            )}
                          </div>
                          {rq.status !== "COMPLETED" && lgMode && lgMode !== "AIR" && (
                            <input value={lgModeReason} onChange={e => setLgModeReason(e.target.value)}
                              placeholder="เหตุผลที่ไม่ส่ง AIR ตามที่ผู้ขอร้องขอ (บังคับ)…"
                              className="mt-2 w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200" />
                          )}
                          <p className="mt-1.5 text-[10px] text-sky-700">เปลี่ยนได้โดยไม่ต้องอนุมัติใหม่ · ระบบบันทึกประวัติทุกครั้งและแจ้งเมลผู้อนุมัติเมื่อต่างจากที่อนุมัติไว้</p>
                        </div>
                        {(noAir || !seaM || (cwt > 0 && cwt <= 100 && !courierUsd(courierRates, d0.port, destForBu(rq.bu), cwt, "DHL"))) && (
                          <div className="flex flex-wrap gap-3 text-[11px]">
                            {noAir && <a href={addLink("air", d0.port)} className="text-amber-600 font-semibold underline hover:text-amber-700">✈️ เพิ่ม Air rate</a>}
                            {!seaM && <a href={addLink("sea", d0.seaPort || d0.port)} className="text-amber-600 font-semibold underline hover:text-amber-700">🚢 เพิ่ม Sea rate</a>}
                            {cwt > 0 && cwt <= 100 && !courierUsd(courierRates, d0.port, destForBu(rq.bu), cwt, "DHL") && <a href={addCourier("DHL")} className="text-amber-600 font-semibold underline hover:text-amber-700">📦 เพิ่ม Courier rate</a>}
                          </div>
                        )}
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
                // Mode in force decides the wording: a courier parcel has a TRACKING NO, not a HAWB.
                const curMode: ShipMode = (lgMode || rq.shipMode || rq.approvedMode || "AIR") as ShipMode
                const isCourier = curMode === "COURIER"
                const pcOpts = airPreCostOptions(airRates, d0.port, destForBu(rq.bu), d0.weight, d0.incoterm)
                const pcFwd = raw(rq, "preCostFwd")
                return (
              <div className="space-y-4">
                {/* ── Phase 2 — Forwarder (AIR only) ───────────────────────────────────────────
                    LG mails the FWD a template of this shipment, the FWD returns it filled in and LG
                    imports it here. Typing the actual by hand (Phase 1) still works at any time. */}
                {!locked && curMode === "AIR" && (
                  <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-bold text-gray-800">📧 Forwarder — ขอ Actual</div>
                      {rq.fwdSentAt && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">ส่งแล้ว {fmtDate(rq.fwdSentAt)}{rq.fwdSentCount > 1 ? ` (${rq.fwdSentCount} ครั้ง)` : ""}</span>}
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-amber-700 block mb-1">FWD</label>
                        <input list="pull-fwd-list" value={fwdName} onChange={e => { const v = e.target.value; setFwdName(v); const em = fwdEmailOf(v); if (em) setFwdEmail(em) }}
                          placeholder="ชื่อ Forwarder…" className={inp} />
                        <datalist id="pull-fwd-list">{forwarders.map((f: any) => <option key={f.id} value={f.name}>{f.email}</option>)}</datalist>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-amber-700 block mb-1">อีเมล FWD <span className="text-red-500">*</span></label>
                        <input value={fwdEmail} onChange={e => setFwdEmail(e.target.value)} placeholder="forwarder@company.com" className={inp} />
                        {/* New FWD in the rate master that nobody has an address for yet — say so instead of
                            failing at send time. Typing it here saves it into MASTER FWD automatically. */}
                        {fwdName && !fwdEmailOf(fwdName) && (
                          <p className="mt-1 text-[10px] text-amber-700">⚠️ “{fwdName}” ยังไม่มีอีเมลใน MASTER FWD — พิมพ์อีเมลที่นี่ ระบบจะจำให้ครั้งต่อไป</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-amber-700 block mb-1">ข้อความเพิ่มเติม (ถ้ามี)</label>
                        <input value={fwdNote} onChange={e => setFwdNote(e.target.value)} placeholder="เช่น ขอด่วนภายในวันนี้…" className={inp} />
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button onClick={() => sendFwd(rq)} disabled={fwdBusy}
                          className="px-3 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-50" style={{ background: "#b45309" }}>
                          {fwdBusy ? "…" : rq.fwdSentAt ? "📧 ส่งซ้ำพร้อมไฟล์" : "📧 ส่งเมล + ไฟล์ให้ FWD"}
                        </button>
                        <label className={`px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 cursor-pointer ${fwdBusy ? "opacity-50 pointer-events-none" : ""}`}>
                          ⬆️ Import ไฟล์จาก FWD
                          <input type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) importFwd(rq, f) }} />
                        </label>
                      </div>
                      {rq.fwdImportedAt && (
                        <p className="text-[11px] text-emerald-700">✓ Import แล้ว {fmtDate(rq.fwdImportedAt)} · ที่มาของ Actual: <b>{rq.actualSource || "FWD"}</b></p>
                      )}
                      <p className="text-[10px] text-gray-400">ไฟล์ที่ส่งไปมีคอลัมน์เทา = ข้อมูลเอกสาร · คอลัมน์เขียว = ให้ FWD กรอก · Import แล้วค่าจะเติมในฟอร์มด้านล่าง ตรวจก่อนกด Save</p>
                    </div>
                  </div>
                )}

                <div className={`bg-white rounded-2xl border shadow-sm p-5 ${locked ? "border-gray-200 bg-gray-50" : "border-gray-100"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-gray-800">Logistics — Actual</div>
                    {locked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-semibold">🔒 เติม rate ก่อน</span>}
                  </div>
                  <div className={`space-y-3 ${locked ? "opacity-50 pointer-events-none select-none" : ""}`}>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">MAWB NO</label>
                      <input disabled={locked} value={raw(rq, "mawbNo")} onChange={e => setVal(rq.id, "mawbNo", e.target.value)} placeholder="MAWB…" className={inp} /></div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">{isCourier ? "TRACKING NO (Courier)" : "HAWB NO"}</label>
                      <input disabled={locked} value={raw(rq, "hawbNo")} onChange={e => setVal(rq.id, "hawbNo", e.target.value)} placeholder={isCourier ? "Tracking no…" : "HAWB…"} className={inp} /></div>
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
                      <input disabled={locked} type="number" value={raw(rq, "preCost")} onChange={e => setVal(rq.id, "preCost", e.target.value)} placeholder="0" className={inp + " bg-sky-50 border-sky-200 focus:ring-sky-200"} />
                      {editFwd && pcOpts.length > 0 && (
                        <select disabled={locked} value={pcFwd} onChange={e => { const o = pcOpts.find(x => x.fwd === e.target.value); if (o) { setVal(rq.id, "preCostFwd", o.fwd); setVal(rq.id, "preCost", String(o.cost)) } }}
                          className={inp + " mt-1.5"}>
                          {!pcOpts.some(o => o.fwd === pcFwd) && <option value={pcFwd}>{pcFwd || "— เลือก FWD —"}</option>}
                          {pcOpts.map(o => <option key={`${o.fwd}|${o.airline}`} value={o.fwd}>{o.fwd}{o.airline ? ` (${o.airline})` : ""} — {fmt(o.cost)} USD</option>)}
                        </select>
                      )}
                    </div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">CFM IN-HOUSE DATE <span className="font-normal text-gray-400">(วันยืนยันเข้าโรงงาน)</span></label>
                      <input disabled={locked} type="date" value={rawDate(rq, "cfmInHouseDate")} onChange={e => setVal(rq.id, "cfmInHouseDate", e.target.value)} className={inp} /></div>
                    {/* LEGACY doc: the actual was typed before the THB/USD switch existed, so a THB amount
                        is sitting in a USD field (Est 497 vs Actual 7,769 = ~32x). One click re-reads the
                        stored numbers AS THB; pressing Save then stores the proper USD value. */}
                    {(() => {
                      const act = Number(rq.actualAir) || 0
                      const looksThb = !rq.actualCurrency && act > 0 && (estTotal > 0 ? act >= estTotal * 5 : act >= 3000)
                      if (!looksThb || locked) return null
                      return (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                          <p className="text-[11px] text-amber-800 font-semibold">⚠️ ตัวเลข Actual ของใบนี้น่าจะเป็น THB (สูงกว่า Est ~{Math.round(act / (estTotal || 1))} เท่า)</p>
                          <button type="button"
                            onClick={() => {
                              setActCur("THB")
                              setEdits(p => ({ ...p, [rq.id]: { ...(p[rq.id] || {}), actualAir: String(act), ...(rq.localChargeTh != null ? { localChargeTh: String(rq.localChargeTh) } : {}) } }))
                            }}
                            className="mt-2 px-3 py-1.5 rounded-lg text-white text-[11px] font-bold" style={{ background: "#b45309" }}>
                            อ่านค่านี้เป็น THB → แปลงเป็น USD (÷ {EXCHANGE_RATE})
                          </button>
                          <p className="mt-1.5 text-[10px] text-amber-700">กดแล้วตรวจตัวเลขด้านล่าง แล้วกด Save เพื่อบันทึกเป็น USD</p>
                        </div>
                      )
                    })()}

                    {/* Unit switch for the two ACTUAL money boxes. LG usually types THB; the system stores
                        USD (typed THB / 32.5) so Actual and Est are always comparable. */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-semibold text-green-700">หน่วยที่กรอก</span>
                      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                        {(["THB", "USD"] as const).map(c => (
                          <button key={c} type="button" disabled={locked} onClick={() => switchCur(rq, c)}
                            className={`px-3 py-1 text-[11px] font-bold ${actCur === c ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            style={actCur === c ? { background: MAROON } : undefined}>{c}</button>
                        ))}
                      </div>
                    </div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">{curMode === "AIR" ? "ACTUAL AIR FREIGHT" : `ACTUAL FREIGHT (${curMode})`} ({actCur}) <span className="text-red-500">*</span></label>
                      <input disabled={locked} type="number" value={money(rq, "actualAir")} onChange={e => setVal(rq.id, "actualAir", e.target.value)} placeholder="0" className={inp} />
                      <p className="mt-1 text-[10px] text-gray-400">{money(rq, "actualAir") !== "" ? (actCur === "THB" ? `≈ ${fmt(usdOf(money(rq, "actualAir")))} USD` : `≈ ${fmt(Number(money(rq, "actualAir")) * EXCHANGE_RATE)} THB`) + ` @ ${EXCHANGE_RATE}` : `เก็บเป็น USD เสมอ (หาร ${EXCHANGE_RATE} ให้อัตโนมัติ)`}</p></div>
                    <div><label className="text-[11px] font-semibold text-green-700 block mb-1">LOCAL CHARGE (TH) ({actCur})</label>
                      <input disabled={locked} type="number" value={money(rq, "localChargeTh")} onChange={e => setVal(rq.id, "localChargeTh", e.target.value)} placeholder="0" className={inp} />
                      {money(rq, "localChargeTh") !== "" && <p className="mt-1 text-[10px] text-gray-400">{actCur === "THB" ? `≈ ${fmt(usdOf(money(rq, "localChargeTh")))} USD` : `≈ ${fmt(Number(money(rq, "localChargeTh")) * EXCHANGE_RATE)} THB`}</p>}</div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className={estTotal ? "text-gray-500" : "text-amber-600 font-medium"}>{estTotal ? `Est ${fmt(estTotal)} USD` : "⚠️ ไม่มี rate — เพิ่ม Master Rate"}</span>
                    {actTotal > 0 && <span className={`px-2 py-0.5 rounded-full font-medium ${diff > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))}</span>}
                  </div>
                  <div className={`mt-3 pt-3 border-t border-gray-100 ${locked ? "opacity-50 pointer-events-none select-none" : ""}`}>
                    <label className="text-[11px] font-semibold text-green-700 block mb-1.5">แนบไฟล์ (LG) — เลือกประเภท</label>
                    <div className="flex flex-wrap gap-2">
                      {([["AWB", "＋ AWB"], ["CUSTOMS", "＋ ใบขน"], ["COMBINED", "＋ รวม (ไฟล์เดียวหลายเอกสาร)"]] as const).map(([cat, label]) => (
                        <label key={cat} className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 ${locked || uploading === rq.id ? "opacity-50 pointer-events-none" : ""}`}>
                          {label}
                          <input type="file" multiple hidden disabled={locked || uploading === rq.id}
                            onChange={e => { uploadAtt(rq, e.target.files, cat, "LG"); e.currentTarget.value = "" }} />
                        </label>
                      ))}
                    </div>
                    {uploading === rq.id
                      ? <p className="text-[11px] text-gray-400 mt-1.5">กำลังอัปโหลด…</p>
                      : <p className="text-[11px] text-gray-400 mt-1.5">INV / Packing แนบจากฝั่งจัดซื้อ · AWB / ใบขน แนบที่นี่ (ย้อนหลังได้) · ถ้าเอกสารมารวมเป็นไฟล์เดียว เลือก “รวม” — ดูไฟล์ที่แนบด้านบน</p>}
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
              <h3 className="font-bold text-gray-900">ใส่ MAWB ให้ {selectedIds.size} เอกสาร</h3>
              <button onClick={() => setBulkOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="text-[11px] text-gray-400">เฉพาะเลข <b>MAWB</b> เท่านั้นที่ใช้ร่วมกันได้หลายเอกสาร (master AWB ต่อ 1 เที่ยวบิน) — HAWB / Pre cost / Actual / Local charge ต่างกันต่อเอกสาร ให้กรอกในแต่ละเอกสารเอง</p>
            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">MAWB NO</label>
              <input type="text" value={bulk["mawbNo"] || ""} onChange={e => setBulk(p => ({ ...p, mawbNo: e.target.value }))} placeholder="เช่น 618-12345678"
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-200" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setBulkOpen(false)} disabled={bulkBusy}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">ยกเลิก</button>
              <button onClick={() => bulkApply()} disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>{bulkBusy ? "…" : "💾 ใส่ MAWB ให้ทุกเอกสาร"}</button>
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
