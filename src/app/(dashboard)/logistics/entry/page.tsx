"use client"
import { useEffect, useMemo, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"

// LG BOOKING — combined Air Waybill Entry for the SOs ticked on the landing page (may span several
// documents). Same UI as the per-document page (Ship Date & QTY → Attach → INV grouping → HAWB with
// Total Cost → generated Actual), only here one HAWB can pull INVs across documents. On save the data
// is fanned out per document (save_logistics_draft / approve for GW), so each doc advances on its own.
const num = (n: any, d = 0) => n != null ? Number(n).toLocaleString("en-US", { maximumFractionDigits: d }) : "—"
const toDateInput = (v: any) => { if (!v) return ""; const d = new Date(v); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10) }

type HawbGroup = { id: string; hawbNo: string; bookingDate: string; totalCost: string; invNos: string[] }

export default function LgEntryPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const roles: string[] = [role, ...(((session?.user as any)?.roles) || [])]
  const allowed = role === "ADMIN" || roles.some(r => ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM"].includes(r))

  const [entryIds, setEntryIds] = useState<string[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Entry state (keyed by itemId → cross-document safe)
  const [soInvMap, setSoInvMap] = useState<Record<string, string>>({})
  const [soShipData, setSoShipData] = useState<Record<string, { qty?: string; date?: string }>>({})
  const [soActualOverride, setSoActualOverride] = useState<Record<string, string>>({})
  const [hawbGroups, setHawbGroups] = useState<HawbGroup[]>([])
  const [lgQuickInv, setLgQuickInv] = useState("")
  const [lgQuickSo, setLgQuickSo] = useState("")
  const [lgSelectedSoIds, setLgSelectedSoIds] = useState<Set<string>>(new Set())
  const [prefilled, setPrefilled] = useState(false)

  // Forward
  const [fwOpen, setFwOpen] = useState(false)
  const [fwList, setFwList] = useState<string[]>([""]) // multiple recipients (add more)
  const [fwNote, setFwNote] = useState("")
  const [fwTargets, setFwTargets] = useState<any[]>([])

  const load = useCallback(async () => {
    const d = await fetch("/api/requests").then(r => r.json())
    setRequests(Array.isArray(d) ? d : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    try { setEntryIds(JSON.parse(sessionStorage.getItem("lg_entry_ids") || "[]")) } catch { setEntryIds([]) }
    load()
    fetch("/api/users/lg-forward-targets").then(r => r.json()).then(d => setFwTargets(Array.isArray(d) ? d : [])).catch(() => {})
  }, [load])

  const bookableOf = (bu: string) => bu === "GW" ? ["PRES_PASSED"] : ["LOG_PASSED", "CLAIM_PASSED", "PRES_PASSED"]

  // Selected bookable SOs, each carrying its parent document.
  const allLgItems = useMemo(() => {
    const idset = new Set(entryIds)
    const out: any[] = []
    for (const r of requests) {
      if (r.logisticsSent) continue
      const bookable = bookableOf(r.bu || "NYG")
      for (const it of (r.items || [])) {
        if (!idset.has(it.id)) continue
        if (!bookable.includes(it.itemStatus)) continue
        out.push({ ...it, request: r, brand: it.brand || r.brandName || "(no brand)" })
      }
    }
    return out
  }, [requests, entryIds])

  const docMap = useMemo(() => { const m: Record<string, any> = {}; for (const it of allLgItems) m[it.request.id] = it.request; return m }, [allLgItems])
  const involvedReqIds = useMemo(() => [...new Set(allLgItems.map(i => i.request.id))], [allLgItems])

  // Prefill from DB once (INV per SO + reconstruct HAWB groups from saved hawbNo).
  useEffect(() => {
    if (prefilled || allLgItems.length === 0) return
    const inv: Record<string, string> = {}
    const hawbRestore: Record<string, { hawbNo: string; invNos: Set<string>; total: number; bookingDate: string }> = {}
    for (const it of allLgItems) {
      if (it.invoiceNo) inv[it.id] = it.invoiceNo
      if (it.hawbNo && it.invoiceNo) {
        if (!hawbRestore[it.hawbNo]) hawbRestore[it.hawbNo] = { hawbNo: it.hawbNo, invNos: new Set(), total: 0, bookingDate: "" }
        hawbRestore[it.hawbNo].invNos.add(it.invoiceNo)
        hawbRestore[it.hawbNo].total += it.actualAirFreight || 0
        if (it.bookingDate && !hawbRestore[it.hawbNo].bookingDate) hawbRestore[it.hawbNo].bookingDate = toDateInput(it.bookingDate)
      }
    }
    setSoInvMap(inv)
    setHawbGroups(Object.values(hawbRestore).map(h => ({ id: Math.random().toString(36).slice(2), hawbNo: h.hawbNo, bookingDate: h.bookingDate, totalCost: String(Math.round(h.total)), invNos: [...h.invNos] })))
    setPrefilled(true)
  }, [allLgItems, prefilled])

  const liveQty = (item: any): number => {
    const typed = soShipData[item.id]?.qty
    if (typed != null && String(typed).trim() !== "") { const n = Number(String(typed).replace(/,/g, "")); if (!isNaN(n)) return n }
    return Number(item.qtyRequestAir) || 0
  }
  const getHawbCalc = (group: { totalCost: string; invNos: string[] }) => {
    const items = allLgItems.filter((i: any) => group.invNos.includes(soInvMap[i.id]))
    const totalQty = items.reduce((s: number, i: any) => s + liveQty(i), 0)
    const hasOverride = items.some((i: any) => soActualOverride[i.id] !== undefined && soActualOverride[i.id] !== "")
    const overrideTotal = hasOverride ? items.reduce((s: number, i: any) => s + (parseFloat(soActualOverride[i.id]) || 0), 0) : null
    const totalCost = overrideTotal !== null ? overrideTotal : (parseFloat(group.totalCost) || 0)
    const avgPerUnit = totalQty > 0 ? totalCost / totalQty : 0
    return { items, totalQty, totalCost, avgPerUnit, hasOverride, overrideTotal }
  }

  const uniqueInvNos = [...new Set(Object.values(soInvMap).filter(Boolean))]
  const assignedHawbInvNos = new Set(hawbGroups.flatMap(g => g.invNos))
  const addHawbGroup = () => setHawbGroups(p => [...p, { id: Math.random().toString(36).slice(2), hawbNo: "", bookingDate: "", totalCost: "", invNos: [] }])
  const removeHawbGroup = (gid: string) => setHawbGroups(p => p.filter(g => g.id !== gid))
  const updateHawb = (gid: string, data: Partial<HawbGroup>) => setHawbGroups(p => p.map(g => g.id === gid ? { ...g, ...data } : g))
  const toggleInvInHawb = (gid: string, invNo: string) => setHawbGroups(p => p.map(g => g.id !== gid ? g : { ...g, invNos: g.invNos.includes(invNo) ? g.invNos.filter(n => n !== invNo) : [...g.invNos, invNo] }))

  const isCalcItem = (it: any) => { const inv = soInvMap[it.id]; return !!inv && hawbGroups.some(g => g.invNos.includes(inv)) }
  const hasShipDate = (it: any) => !!(soShipData[it.id]?.date && String(soShipData[it.id]?.date).trim()) || !!it.planShipmentDate
  const LG_FILE_CATS = ["INV", "AWB", "EXPENSE", "COMBINE"]
  const lgFileCount = (r: any) => (r?.attachments || []).filter((a: any) => LG_FILE_CATS.includes(a.category)).length

  // Per-document readiness to advance (Send): all its bookable SOs are calculated in a HAWB w/ No,
  // have a ship date, booking dates filled, and ≥1 file attached.
  const docComplete = (reqId: string) => {
    const items = allLgItems.filter(i => i.request.id === reqId)
    if (items.length === 0) return false
    const allCalc = items.every(it => { const inv = soInvMap[it.id]; return !!inv && hawbGroups.some(g => g.hawbNo && g.invNos.includes(inv)) })
    if (!allCalc) return false
    if (!items.every(hasShipDate)) return false
    if (!items.every(it => liveQty(it) > 0)) return false // QTY Air must be filled
    const groups = hawbGroups.filter(g => g.invNos.some(inv => items.some(it => soInvMap[it.id] === inv)))
    if (groups.some(g => !g.bookingDate)) return false
    // Attachments are OPTIONAL — a document does not need its own file to be sent.
    return true
  }

  const buildPayload = () => {
    const itemLog: Record<string, any> = {}, itemAct: Record<string, string> = {}
    Object.entries(soInvMap).forEach(([id, inv]) => { itemLog[id] = { invoiceNo: inv || "", hawbNo: "", bookingDate: "" } })
    hawbGroups.forEach(group => {
      const { items, avgPerUnit } = getHawbCalc(group)
      items.forEach((it: any) => {
        itemLog[it.id] = { invoiceNo: soInvMap[it.id] || "", hawbNo: group.hawbNo || "", bookingDate: group.bookingDate }
        const ov = soActualOverride[it.id]
        itemAct[it.id] = ov !== undefined && ov !== "" ? String(parseFloat(ov) || 0) : String(Math.round(liveQty(it) * avgPerUnit * 100) / 100)
      })
    })
    const itemShip = Object.fromEntries(Object.entries(soShipData).map(([id, v]) => [id, { qtyRequestAir: v.qty, planShipmentDate: v.date }]))
    return { itemLog, itemAct, itemShip }
  }

  // Fan out the save per document. completeSet = docs to advance (lgComplete); others just draft.
  const persist = async (completeSet: Set<string>) => {
    const { itemLog, itemAct, itemShip } = buildPayload()
    for (const reqId of involvedReqIds) {
      const docItemIds = allLgItems.filter(i => i.request.id === reqId).map(i => i.id)
      const pick = (obj: any) => Object.fromEntries(Object.entries(obj).filter(([id]) => docItemIds.includes(id)))
      const complete = completeSet.has(reqId)
      const isGw = (docMap[reqId]?.bu || "NYG") === "GW"
      const action = complete && isGw ? "approve" : "save_logistics_draft"
      await fetch(`/api/requests/${reqId}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemLogistics: pick(itemLog), itemActuals: pick(itemAct), itemShipData: pick(itemShip), lgComplete: complete }),
      })
    }
  }

  const saveDraft = async () => { setSaving(true); await persist(new Set()); await load(); setSaving(false); alert("บันทึกร่างแล้ว (ยังไม่ส่ง)") }

  const send = async () => {
    // Every selected SO must have Plan Ship Date + QTY Air filled before Send.
    const missingDetail = allLgItems.filter(it => !hasShipDate(it) || !(liveQty(it) > 0))
    if (missingDetail.length) { alert(`กรอกรายละเอียดให้ครบก่อนส่ง — SO ที่ยังขาด Plan Ship Date / QTY Air:\n${[...new Set(missingDetail.map(i => i.so))].join(", ")}`); return }
    const ready = involvedReqIds.filter(docComplete)
    if (ready.length === 0) { alert("ยังไม่มีเอกสารพร้อมส่ง — SO ที่เลือกต้องอยู่ใน HAWB (มี HAWB No) และมี Booking Date ครบ"); return }
    if (!confirm(`ส่งต่อ ${ready.length} เอกสารที่พร้อม? (ที่เหลือบันทึกเป็นร่าง)`)) return
    setSaving(true); await persist(new Set(ready)); await load(); setSaving(false)
    alert(`ส่งต่อแล้ว ${ready.length} เอกสาร`)
  }

  // Export the SELECTED transactions (cross-document) as the MER-format sheet + SCM claim columns,
  // with LG's INV NO. / HAWB# / EXPENSE/HAWB (LG-specific header) prefilled — LG fills HAWB + Expense
  // then imports back.
  const exportXlsx = async () => {
    const ExcelJS = (await import("exceljs")).default
    const fmtD = (v: any) => { if (!v) return ""; const d = new Date(v); if (isNaN(d.getTime())) return ""; return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` }
    const DEPT_LABEL: Record<string, string> = { NYK: "SCM NYK", NYG: "SCM NYG" }
    // Port + CR NO removed. Header colours by role part: MER = blue, LG = orange, Claim/SCM = green.
    // GW's header differs when it reaches LG: LG column is "Actual Airfreight" (not EXPENSE/HAWB) and
    // its claim block has no per-dept ACTUAL AIRFREIGHTn. Pick the header set by the selection's BU.
    const isGwExport = allLgItems.length > 0 && allLgItems.every((i: any) => i.request.bu === "GW")
    const mixed = allLgItems.some((i: any) => i.request.bu === "GW") && allLgItems.some((i: any) => i.request.bu !== "GW")
    if (mixed && !confirm("เลือกปน GW กับ BU อื่น — จะ export ด้วยหัวแบบ NYG (EXPENSE/HAWB). ดำเนินการต่อ?")) return
    const base = ["No_Document", "Brand name", "BU", "STYLE", "SO", "SUB", "CUSTOMER PO", "DESCRIPTION", "WEIGHT(KG)", "Original Shipment Date", "Plan Shipment Date", "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)", "Factory", "Country"]
    const baseW = [16, 16, 6, 14, 12, 8, 14, 24, 10, 20, 20, 20, 20, 14, 12]
    const headers = isGwExport
      ? [...base, "INV NO.", "Actual Airfreight", "HAWB#", "CLAIM DEPT 1", "%CLAIM1", "REASON 1", "CLAIM DEPT 2", "%CLAIM2", "REASON 2", "CLAIM DEPT 3", "%CLAIM3", "REASON 3"]
      : [...base, "INV NO.", "HAWB#", "EXPENSE/HAWB", "CLAIM DEPT 1", "%CLAIM1", "ACTUAL AIRFREIGHT1", "REASON 1", "CLAIM DEPT 2", "%CLAIM2", "ACTUAL AIRFREIGHT2", "REASON 2", "CLAIM DEPT 3", "%CLAIM3", "ACTUAL AIRFREIGHT3", "REASON 3"]
    const widths = isGwExport
      ? [...baseW, 16, 18, 16, 14, 8, 16, 14, 8, 16, 14, 8, 16]
      : [...baseW, 16, 16, 18, 14, 8, 16, 16, 14, 8, 16, 16, 14, 8, 16, 16]
    const MER_C = "FFDDEBF7", LG_C = "FFFCE4D6", CLAIM_C = "FFE2EFDA" // blue / orange / green
    const lgStart = base.length, lgEnd = base.length + 2 // LG occupies 3 columns after the base block
    const colorOf = (i: number) => (i >= lgStart && i <= lgEnd) ? LG_C : (i > lgEnd ? CLAIM_C : MER_C)

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("LG")
    const hr = ws.addRow(headers)
    hr.height = 30
    headers.forEach((_, i) => {
      const c = hr.getCell(i + 1)
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorOf(i) } }
      c.font = { bold: true, size: 10 }
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
      c.border = { top: { style: "thin", color: { argb: "FFBFBFBF" } }, bottom: { style: "thin", color: { argb: "FFBFBFBF" } }, left: { style: "thin", color: { argb: "FFBFBFBF" } }, right: { style: "thin", color: { argb: "FFBFBFBF" } } }
    })
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
    ws.views = [{ state: "frozen", ySplit: 1 }]

    allLgItems.forEach((item: any) => {
      const invNo = soInvMap[item.id] || ""
      const hawbGrp = hawbGroups.find(g => invNo && g.invNos.includes(invNo))
      const hawbNo = hawbGrp?.hawbNo || ""
      const total = hawbGrp?.totalCost || ""
      const af = hawbGrp && parseFloat(hawbGrp.totalCost) > 0 ? Math.round(liveQty(item) * getHawbCalc(hawbGrp).avgPerUnit * 100) / 100 : (typeof item.actualAirFreight === "number" ? item.actualAirFreight : 0)
      const d: any[] = Array.isArray(item.claimDepts) && item.claimDepts.length > 0 ? item.claimDepts : []
      const deptAmt = (pct: any) => (af > 0 && pct) ? Math.round(af * (Number(pct) / 100) * 100) / 100 : ""
      const dept = (x: any) => x?.dept ? (DEPT_LABEL[x.dept] || x.dept) : ""
      // Delay reason = Delay Code + its Detail (both surfaced in the REASON column).
      const reason = (x: any) => [x?.reason, x?.reasonDetail].filter(Boolean).join(" - ")
      const isGW = (item.request.bu === "GW")
      const baseRow = [
        item.request.documentNo, item.request.brandName || "", isGW ? "GW" : (item.request.bu || "NYG"),
        item.style || "", item.so || "", item.sub || "", item.customerPO || "", item.description || "", item.grossWeight ?? "",
        fmtD(item.originalShipmentDate), fmtD(item.planShipmentDate), item.qtyOriginalShipment ?? item.qtyRequestAir ?? "", item.qtyRequestAir ?? "",
        item.factory || "", item.country || "",
      ]
      ws.addRow(isGwExport
        ? [...baseRow, invNo, total, hawbNo, dept(d[0]), d[0]?.pct ?? "", reason(d[0]), dept(d[1]), d[1]?.pct ?? "", reason(d[1]), dept(d[2]), d[2]?.pct ?? "", reason(d[2])]
        : [...baseRow, invNo, hawbNo, total, dept(d[0]), d[0]?.pct ?? "", deptAmt(d[0]?.pct), reason(d[0]), dept(d[1]), d[1]?.pct ?? "", deptAmt(d[1]?.pct), reason(d[1]), dept(d[2]), d[2]?.pct ?? "", deptAmt(d[2]?.pct), reason(d[2])])
    })

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `LG_Booking_${allLgItems.length}tx.xlsx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // Import back: read SO/SUB → INV NO., and HAWB# + EXPENSE/HAWB → rebuild the HAWB groups.
  const importXlsx = async (file: File) => {
    const XLSX = await import("xlsx")
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }) as any[]
    const updates: Record<string, string> = {}
    const hawbMap: Record<string, { hawbNo: string; invNos: Set<string>; totalCost: string }> = {}
    rows.forEach(row => {
      const soNo = String(row["SO"] || row["SO No."] || "").trim()
      const subNo = String(row["SUB"] || "").trim()
      const inv = String(row["INV NO."] || row["Invoice No"] || "").trim()
      const hawbNo = String(row["HAWB#"] || "").trim()
      const hawbCost = String(row["EXPENSE/HAWB"] || row["Actual Airfreight"] || row["Total HAWB#"] || row["HAWB Total Cost (THB)"] || "").trim()
      if (!soNo || !inv) return
      const found = allLgItems.find((i: any) => i.so === soNo && (i.sub || "") === subNo)
      if (found) updates[found.id] = inv
      if (hawbNo && inv) { if (!hawbMap[hawbNo]) hawbMap[hawbNo] = { hawbNo, invNos: new Set(), totalCost: hawbCost }; hawbMap[hawbNo].invNos.add(inv) }
    })
    if (Object.keys(updates).length > 0) setSoInvMap(p => ({ ...p, ...updates }))
    if (Object.keys(hawbMap).length > 0) setHawbGroups(Object.values(hawbMap).map(h => ({ id: Math.random().toString(36).slice(2), hawbNo: h.hawbNo, bookingDate: "", totalCost: h.totalCost, invNos: [...h.invNos] })))
    alert(`Import: อัปเดต INV ${Object.keys(updates).length} SO · HAWB ${Object.keys(hawbMap).length} กลุ่ม`)
  }

  // The same file is attached to every selected document, so a "file" here is a GROUP of attachment
  // ids (one per doc). Deleting removes them all at once.
  const deleteAtt = async (attIds: string[]) => {
    if (!confirm(`ลบไฟล์นี้? (จาก ${attIds.length} เอกสาร)`)) return
    setSaving(true)
    let err = ""
    for (const id of attIds) {
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" })
      if (!res.ok) err = (await res.json().catch(() => ({})))?.error || "ลบไม่สำเร็จ (ลบได้เฉพาะไฟล์ที่ตัวเองอัปโหลด)"
    }
    if (err) alert(err)
    await load(); setSaving(false)
  }

  // One attach action → attaches the file to EVERY selected document (so each doc satisfies the
  // "≥1 file before Send" rule without LG having to upload document by document).
  const uploadLgFileAll = async (file: File, category: string) => {
    setSaving(true)
    for (const reqId of involvedReqIds) {
      const form = new FormData(); form.append("file", file); form.append("category", category)
      await fetch(`/api/requests/${reqId}/attachments`, { method: "POST", body: form }).catch(() => {})
    }
    await load(); setSaving(false)
  }

  // BUs a Logistics person covers (from their roles + bu) — used to route each doc to the right recipient.
  const coveredBus = (u: any) => {
    const rs = [u?.role, ...(u?.roles || [])]
    const s = new Set<string>()
    if (rs.includes("LOGISTICS") || rs.includes("LOGISTICS_SUB")) s.add(u?.bu === "EA" ? "EA" : "NYG")
    if (rs.includes("LOGISTICS_GW")) s.add("GW")
    if (rs.includes("LOGISTICS_TRM")) s.add("TRM")
    if (s.size === 0 && u?.bu) s.add(u.bu)
    return s
  }

  const forward = async () => {
    const emails = [...new Set(fwList.filter(Boolean))]
    if (emails.length === 0) { alert("เลือกผู้รับก่อน"); return }
    setSaving(true)
    await persist(new Set()) // save partial first
    let ok = 0
    // Route each document to a selected recipient who covers that document's BU (fallback: first).
    for (const reqId of involvedReqIds) {
      const bu = docMap[reqId]?.bu || "NYG"
      const email = emails.find(e => { const u = fwTargets.find(t => t.email === e); return u && coveredBus(u).has(bu) }) || emails[0]
      const u = fwTargets.find(t => t.email === email)
      const res = await fetch(`/api/requests/${reqId}/lg-forward`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: email, toName: u?.name || email, note: fwNote.trim() || undefined }),
      })
      if (res.ok) ok++
    }
    setSaving(false); setFwOpen(false); setFwList([""]); setFwNote("")
    alert(`ส่งต่อแล้ว ${ok}/${involvedReqIds.length} เอกสาร (ให้ ${emails.length} คน)`)
  }

  if (!allowed) return <div className="text-center py-20 text-gray-400">เฉพาะ Logistics / Admin เท่านั้น</div>

  return (
    <div className="space-y-4 pb-24">
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3">
            <svg className="animate-spin h-9 w-9 text-orange-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
            <p className="text-orange-700 font-semibold">Saving...</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link href="/logistics" className="text-sm text-blue-600 hover:underline">← LG BOOKING</Link>
        <h1 className="text-xl font-bold text-gray-900">Air Waybill Entry ({allLgItems.length} transaction)</h1>
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Loading...</div>}
      {!loading && allLgItems.length === 0 && (
        <div className="text-center py-20 text-gray-400">ไม่มี SO ที่เลือก — กลับไป <Link href="/logistics" className="text-blue-600 underline">LG BOOKING</Link></div>
      )}

      {allLgItems.length > 0 && (
        <div className="space-y-4 border border-orange-200 rounded-xl bg-orange-50/30 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-orange-800">Logistics — Air Waybill Entry</p>
              <p className="text-xs text-orange-500 mt-0.5">① กรอก QTY/Ship Date → ② แนบไฟล์ → ③ ใส่ INV → ④ จัด HAWB (Total Cost → generate Actual)</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={exportXlsx} disabled={saving} className="bg-white border border-orange-300 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-50 disabled:opacity-50">⬇ Export</button>
              <label className={`bg-white border border-orange-300 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-50 cursor-pointer ${saving ? "opacity-50 pointer-events-none" : ""}`}>⬆ Import
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importXlsx(f) }} />
              </label>
              <button onClick={() => setFwOpen(true)} disabled={saving} className="bg-white border border-blue-300 text-blue-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50">↪ Forward</button>
              <button onClick={saveDraft} disabled={saving} className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Save Draft</button>
              <button onClick={send} disabled={saving} className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">Send →</button>
            </div>
          </div>

          {/* ① Ship Date & QTY Air */}
          <div className="bg-white rounded-xl border border-orange-300 p-3 space-y-2">
            <p className="text-xs font-semibold text-orange-800">① Ship Date &amp; QTY Air <span className="font-normal text-gray-500">(default = ค่าที่ MER กรอก · แก้ได้ · red = ยังไม่มี QTY)</span></p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50"><tr>
                  <th className="px-2 py-1 text-left">DOC</th><th className="px-2 py-1 text-left">SO</th><th className="px-2 py-1 text-left">SUB</th><th className="px-2 py-1 text-left">STYLE</th><th className="px-2 py-1 text-left">BRAND</th>
                  <th className="px-2 py-1 text-right">QTY Air</th><th className="px-2 py-1 text-left">Plan Ship Date</th>
                </tr></thead>
                <tbody>
                  {allLgItems.map((it: any) => {
                    const missingQty = !(liveQty(it) > 0)
                    return (
                      <tr key={it.id} className={`border-t border-gray-100 ${missingQty ? "bg-red-50" : ""}`}>
                        <td className="px-2 py-1"><Link href={`/requests/${it.request.id}`} className="text-blue-600 hover:underline">{it.request.documentNo}</Link></td>
                        <td className="px-2 py-1 font-medium">{it.so}</td>
                        <td className="px-2 py-1 text-gray-500">{it.sub || "-"}</td>
                        <td className="px-2 py-1 text-gray-500">{it.style}</td>
                        <td className="px-2 py-1 text-gray-500">{it.brand || it.request.brandName || "-"}</td>
                        <td className="px-2 py-1">
                          <input type="number" min="0" className="w-24 border border-gray-300 rounded px-2 py-1 text-right"
                            value={soShipData[it.id]?.qty ?? (it.qtyRequestAir || "")}
                            onChange={e => setSoShipData(p => ({ ...p, [it.id]: { ...p[it.id], qty: e.target.value } }))} />
                        </td>
                        <td className="px-2 py-1">
                          {(() => {
                            const dv = soShipData[it.id]?.date ?? toDateInput(it.planShipmentDate)
                            return (
                              <input type="date" className={`border rounded px-2 py-1 ${dv ? "border-gray-300" : "border-red-400 bg-red-50"}`}
                                value={dv}
                                onChange={e => setSoShipData(p => ({ ...p, [it.id]: { ...p[it.id], date: e.target.value } }))} />
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ② Attach files — one attach, applied to every selected document (OPTIONAL) */}
          {(() => {
            // One file may sit on several documents (attached to all selected) — group by name+category
            // so it shows ONCE, and delete removes every copy.
            const groups: Record<string, { rep: any; ids: string[] }> = {}
            involvedReqIds.forEach(id => (docMap[id]?.attachments || []).filter((a: any) => LG_FILE_CATS.includes(a.category)).forEach((a: any) => {
              const k = `${a.category}|${a.fileName}`
              if (!groups[k]) groups[k] = { rep: a, ids: [] }
              groups[k].ids.push(a.id)
            }))
            const fileGroups = Object.values(groups)
            const byCat = (cat: string) => fileGroups.filter(g => g.rep.category === cat)
            const chip = (g: any) => (
              <span key={`${g.rep.category}|${g.rep.fileName}`} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 max-w-full">
                <a href={`/api/attachments/${g.rep.id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">📎 {g.rep.fileName}</a>
                <button onClick={() => deleteAtt(g.ids)} title="ลบไฟล์" className="text-gray-400 hover:text-red-500 font-bold leading-none shrink-0">✕</button>
              </span>
            )
            const slots = [{ key: "INV", label: "INV" }, { key: "AWB", label: "AWB" }, { key: "EXPENSE", label: "Expense" }]
            return (
              <div className="bg-white rounded-xl border border-orange-200 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-800">② Attach files <span className="font-normal text-gray-500">(ไม่บังคับ · แนบครั้งเดียว ใช้กับทุกเอกสารที่เลือก)</span>{fileGroups.length > 0 && <span className="ml-1 text-green-600">✓ {fileGroups.length} file(s)</span>}</p>
                {/* Per-category slots */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {slots.map(s => {
                    const files = byCat(s.key)
                    return (
                      <div key={s.key} className={`rounded-lg border p-2 space-y-1.5 ${files.length ? "border-green-300 bg-green-50/40" : "border-gray-200 bg-gray-50"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-gray-700">{s.label} {files.length > 0 && <span className="text-green-600">✓{files.length}</span>}</p>
                          <label className="text-[10px] px-2 py-1 rounded border border-orange-300 text-orange-700 hover:bg-orange-50 cursor-pointer whitespace-nowrap shrink-0">＋ Attach
                            <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadLgFileAll(f, s.key) }} />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1">{files.length ? files.map(chip) : <span className="text-[10px] text-gray-400">— ไม่มีไฟล์ —</span>}</div>
                      </div>
                    )
                  })}
                </div>
                {/* Combine — multiple files */}
                <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-blue-800">Combine File <span className="font-normal text-gray-500">(หลายไฟล์ได้)</span> {byCat("COMBINE").length > 0 && <span className="text-green-600">✓{byCat("COMBINE").length}</span>}</p>
                    <label className="text-[10px] px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-100 cursor-pointer whitespace-nowrap shrink-0">＋ Add files
                      <input type="file" multiple className="hidden" onChange={async e => { const fs = Array.from(e.target.files || []); e.target.value = ""; for (const f of fs) await uploadLgFileAll(f, "COMBINE") }} />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1">{byCat("COMBINE").length ? byCat("COMBINE").map(chip) : <span className="text-[10px] text-gray-400">— ไม่มีไฟล์ —</span>}</div>
                </div>
              </div>
            )
          })()}

          {/* ③ INV assignment */}
          <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
            <div className="bg-orange-50/80 border-b border-orange-200 px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-orange-700 mb-1">③ INV NO.</label>
                  <input id="lg-quick-inv" value={lgQuickInv} placeholder="Type INV..." onChange={e => setLgQuickInv(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && lgQuickInv.trim()) {
                        e.preventDefault()
                        if (lgSelectedSoIds.size > 0) { setSoInvMap(p => { const n = { ...p }; lgSelectedSoIds.forEach(id => { n[id] = lgQuickInv.trim() }); return n }); setLgSelectedSoIds(new Set()); setLgQuickInv("") }
                        else { const el = document.getElementById("lg-quick-so") as HTMLInputElement | null; el?.focus() }
                      }
                    }}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:ring-2 focus:ring-orange-400 focus:outline-none" />
                </div>
                {lgQuickInv.trim() && (
                  <div className="relative">
                    <label className="block text-xs font-semibold text-orange-700 mb-1">SO No. <span className="font-normal text-orange-400">(type+Enter or click a row)</span></label>
                    <input id="lg-quick-so" value={lgQuickSo} placeholder="Search SO..." autoComplete="off" onChange={e => setLgQuickSo(e.target.value)}
                      onKeyDown={e => {
                        if (e.key !== "Enter") return; e.preventDefault()
                        const q = lgQuickSo.trim(); if (!q) return
                        const rows = allLgItems.filter((i: any) => i.so === q)
                        if (rows.length) { setSoInvMap(p => { const n = { ...p }; rows.forEach((r: any) => { n[r.id] = lgQuickInv.trim() }); return n }); setLgQuickSo("") }
                      }}
                      className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-orange-400 focus:outline-none" />
                    {lgQuickSo.trim() && (
                      <div className="absolute top-full mt-1 left-0 bg-white border border-orange-200 rounded-xl shadow-lg z-20 min-w-64 max-h-48 overflow-y-auto">
                        {(() => {
                          const sos = [...new Set(allLgItems.filter((i: any) => String(i.so).includes(lgQuickSo.trim())).map((i: any) => i.so))]
                          if (sos.length === 0) return <p className="text-xs text-gray-400 px-3 py-2">SO not found</p>
                          return sos.map((so: any) => {
                            const rows = allLgItems.filter((i: any) => i.so === so)
                            const allAssigned = rows.every((r: any) => soInvMap[r.id] === lgQuickInv.trim())
                            return (
                              <button key={so} onClick={() => { setSoInvMap(p => { const n = { ...p }; rows.forEach((r: any) => { if (allAssigned) delete n[r.id]; else n[r.id] = lgQuickInv.trim() }); return n }); setLgQuickSo("") }}
                                className={`flex items-center justify-between w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-orange-50 last:border-0 ${allAssigned ? "bg-orange-50" : ""}`}>
                                <span><span className="font-semibold">{so}</span><span className="text-gray-400 ml-2">{rows[0]?.style}</span><span className="text-orange-400 ml-2">· {rows.length} row{rows.length > 1 ? "s" : ""}</span></span>
                                {allAssigned && <span className="text-orange-600 font-bold">✓</span>}
                              </button>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                )}
                {lgQuickInv.trim() && <button onClick={() => { setLgQuickInv(""); setLgQuickSo("") }} className="text-xs text-gray-400 hover:text-red-500 pb-1.5">✕ Clear</button>}
              </div>
              {lgQuickInv.trim() && (() => {
                const assigned = allLgItems.filter((i: any) => soInvMap[i.id] === lgQuickInv.trim())
                return assigned.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-orange-600 font-medium">{lgQuickInv}:</span>
                    {assigned.map((i: any) => (
                      <span key={i.id} className="inline-flex items-center gap-1 text-xs bg-orange-600 text-white px-2.5 py-0.5 rounded-full">{i.so}
                        <button onClick={() => setSoInvMap(p => { const n = { ...p }; delete n[i.id]; return n })} className="hover:opacity-70 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                ) : <p className="text-xs text-orange-400">Click a row or type an SO to add it to {lgQuickInv}</p>
              })()}
            </div>

            <div className="overflow-auto max-h-[55vh]">
              <table className="w-full text-xs whitespace-nowrap">
                <thead><tr>
                  <th className="px-3 py-2 sticky top-0 z-10 bg-orange-50 border-b border-orange-100">
                    <input type="checkbox" checked={allLgItems.length > 0 && allLgItems.every((i: any) => lgSelectedSoIds.has(i.id) || !!soInvMap[i.id])}
                      onChange={e => {
                        if (lgQuickInv.trim()) { const v = lgQuickInv.trim(); setSoInvMap(p => { const n = { ...p }; if (e.target.checked) allLgItems.forEach((i: any) => { n[i.id] = v }); else allLgItems.forEach((i: any) => { if (n[i.id] === v) delete n[i.id] }); return n }) }
                        else setLgSelectedSoIds(e.target.checked ? new Set(allLgItems.map((i: any) => i.id)) : new Set())
                      }} className="accent-orange-500" />
                  </th>
                  {["DOC","SO No.","Sub","Style","Customer PO","Description","QTY Air","Weight (KG)","Est. Freight","Country","Factory","INV NO.","Actual Freight"].map(h =>
                    <th key={h} className="px-3 py-2 text-left text-orange-700 font-medium sticky top-0 bg-orange-50 border-b border-orange-100">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-orange-50">
                  {allLgItems.map((item: any, idx: number) => {
                    const invNo = soInvMap[item.id] || ""
                    const hl = lgQuickInv.trim() && invNo === lgQuickInv.trim()
                    const group = hawbGroups.find(g => invNo && g.invNos.includes(invNo))
                    const actual = group ? (() => { const { avgPerUnit } = getHawbCalc(group); return parseFloat(group.totalCost) > 0 || group.invNos.length ? liveQty(item) * avgPerUnit : null })() : null
                    return (
                      <tr key={item.id} onClick={() => { if (!lgQuickInv.trim()) return; setSoInvMap(p => p[item.id] === lgQuickInv.trim() ? (() => { const n = { ...p }; delete n[item.id]; return n })() : ({ ...p, [item.id]: lgQuickInv.trim() })) }}
                        className={`${hl ? "bg-orange-100" : "hover:bg-orange-50/40"} ${lgQuickInv.trim() ? "cursor-pointer" : ""}`}>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={lgSelectedSoIds.has(item.id) || !!invNo}
                            onChange={e => { if (lgQuickInv.trim()) { setSoInvMap(p => { const n = { ...p }; if (e.target.checked) n[item.id] = lgQuickInv.trim(); else delete n[item.id]; return n }) } else setLgSelectedSoIds(p => { const n = new Set(p); e.target.checked ? n.add(item.id) : n.delete(item.id); return n }) }}
                            className="accent-orange-500" />
                        </td>
                        <td className="px-3 py-2"><Link href={`/requests/${item.request.id}`} className="text-blue-600 hover:underline">{item.request.documentNo}</Link></td>
                        <td className="px-3 py-2 font-semibold text-orange-900">{item.so}</td>
                        <td className="px-3 py-2 text-gray-500">{item.sub || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{item.style}</td>
                        <td className="px-3 py-2 text-gray-500">{item.customerPO || "—"}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-48 truncate">{item.description || "—"}</td>
                        <td className="px-3 py-2 font-semibold">{liveQty(item)}</td>
                        <td className="px-3 py-2 text-blue-700">{item.grossWeight != null ? Number(item.grossWeight).toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-blue-700">{num(item.airFreight)}</td>
                        <td className="px-3 py-2 text-gray-500">{item.country || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{item.factory || "—"}</td>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <input id={`lg-inv-${item.id}`} value={invNo} placeholder="INV-0000"
                              onChange={e => setSoInvMap(p => ({ ...p, [item.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key !== "Enter") return; e.preventDefault(); const nx = allLgItems[idx + 1]; if (nx) { const el = document.getElementById(`lg-inv-${nx.id}`) as HTMLInputElement | null; el?.focus(); el?.select() } }}
                              className={`border rounded-lg px-2.5 py-1 text-xs w-32 focus:ring-1 focus:ring-orange-400 focus:outline-none ${invNo ? "border-orange-400 bg-orange-50 font-medium" : "border-orange-200"}`} />
                            {invNo && <button onClick={() => setSoInvMap(p => { const n = { ...p }; delete n[item.id]; return n })} className="text-gray-300 hover:text-red-400 text-sm leading-none">×</button>}
                          </div>
                        </td>
                        <td className="px-3 py-2">{actual != null ? <span className="font-semibold text-green-700">{actual.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span> : <span className="text-gray-300">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ④ HAWB */}
          {uniqueInvNos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">④ Air Waybill (HAWB)</p>
                {hawbGroups.length === 0 && <span className="text-xs text-orange-400">กด "+ Add HAWB" แล้วติ๊กเลือก INV</span>}
              </div>
              {hawbGroups.map((group, gi) => {
                const { items, totalQty, avgPerUnit, totalCost, hasOverride } = getHawbCalc(group)
                const hasCost = totalCost > 0
                return (
                  <div key={group.id} className="bg-white rounded-xl border border-orange-200 overflow-hidden shadow-sm">
                    <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-bold text-orange-800 shrink-0">HAWB #{gi + 1}</span>
                        <div className="flex items-center gap-1.5"><label className="text-xs text-gray-500">HAWB No.</label>
                          <input value={group.hawbNo} placeholder="123-12345678" onChange={e => updateHawb(group.id, { hawbNo: e.target.value })} className="border border-orange-300 rounded-lg px-2.5 py-1 text-xs w-36 focus:ring-1 focus:ring-orange-400 focus:outline-none" /></div>
                        <div className="flex items-center gap-1.5"><label className="text-xs text-gray-500">Booking Date <span className="text-red-500">*</span></label>
                          <input type="date" value={group.bookingDate} onChange={e => updateHawb(group.id, { bookingDate: e.target.value })} className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none ${group.bookingDate ? "border-orange-300" : "border-red-300 bg-red-50"}`} /></div>
                        <div className="flex items-center gap-1.5"><label className="text-xs text-gray-500">Total Cost (THB)</label>
                          <input type="number" value={group.totalCost} placeholder="0" min="0" onChange={e => updateHawb(group.id, { totalCost: e.target.value })} className="border border-orange-300 rounded-lg px-2.5 py-1 text-xs w-32 focus:ring-1 focus:ring-orange-400 focus:outline-none" /></div>
                        {items.length > 0 && hasCost && <span className="text-xs text-orange-600 font-medium">{totalQty.toLocaleString()} pcs · avg {avgPerUnit.toFixed(4)} THB/pc</span>}
                        <button onClick={() => removeHawbGroup(group.id)} className="ml-auto text-xs text-red-400 hover:text-red-600 font-medium">Delete</button>
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">Select INV in this HAWB</label>
                        <div className="space-y-1.5">
                          {uniqueInvNos.map(invNo => {
                            const isSel = group.invNos.includes(invNo)
                            const isTaken = !isSel && assignedHawbInvNos.has(invNo)
                            const soCount = allLgItems.filter((i: any) => soInvMap[i.id] === invNo).length
                            const qty = allLgItems.filter((i: any) => soInvMap[i.id] === invNo).reduce((s: number, i: any) => s + liveQty(i), 0)
                            return (
                              <label key={invNo} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${isSel ? "bg-orange-50 border-orange-300" : isTaken ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50" : "border-gray-200 hover:bg-orange-50/50 hover:border-orange-200 cursor-pointer"}`}>
                                <input type="checkbox" checked={isSel} disabled={isTaken} onChange={() => toggleInvInHawb(group.id, invNo)} className="accent-orange-500 w-4 h-4" />
                                <span className="flex-1 flex items-center gap-3"><span className={`text-sm font-semibold ${isSel ? "text-orange-900" : "text-gray-700"}`}>{invNo}</span><span className="text-xs text-gray-400">{soCount} SO · {qty.toLocaleString()} pcs</span>{isTaken && <span className="text-xs text-gray-400 italic">Already in another HAWB</span>}</span>
                                {isSel && <span className="text-xs font-medium text-orange-600">✓</span>}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      {items.length > 0 ? (
                        <div className="overflow-x-auto">
                          {hasCost && !hasOverride && <p className="text-xs text-orange-700 mb-2">Avg/unit = {totalCost.toLocaleString()} ÷ {totalQty} = <strong>THB {avgPerUnit.toFixed(4)}</strong></p>}
                          <table className="w-full text-xs border border-orange-100 whitespace-nowrap">
                            <thead className="bg-orange-100/60"><tr>{["DOC","SO No.","INV NO.","Style","QTY Air","Actual Freight (THB)"].map(h => <th key={h} className="px-3 py-1.5 text-left text-orange-700 font-medium">{h}</th>)}</tr></thead>
                            <tbody className="divide-y divide-orange-50">
                              {items.map((item: any) => {
                                const calcVal = hasCost && !hasOverride ? liveQty(item) * avgPerUnit : null
                                const disp = soActualOverride[item.id] !== undefined ? soActualOverride[item.id] : (calcVal !== null ? calcVal.toFixed(2) : "")
                                return (
                                  <tr key={item.id} className="bg-white/80">
                                    <td className="px-3 py-1.5 text-blue-600">{item.request.documentNo}</td>
                                    <td className="px-3 py-1.5 font-medium">{item.so}</td>
                                    <td className="px-3 py-1.5 text-gray-500">{soInvMap[item.id] || "—"}</td>
                                    <td className="px-3 py-1.5 text-gray-500">{item.style}</td>
                                    <td className="px-3 py-1.5">{liveQty(item)}</td>
                                    <td className="px-3 py-1.5"><input type="number" value={disp} placeholder="0.00" min="0" step="0.01" onChange={e => setSoActualOverride(p => ({ ...p, [item.id]: e.target.value }))} className={`w-32 border rounded-lg px-2 py-0.5 text-xs focus:outline-none font-semibold ${soActualOverride[item.id] !== undefined ? "border-blue-300 bg-blue-50 text-blue-800" : "border-orange-200 text-orange-800"}`} /></td>
                                  </tr>
                                )
                              })}
                              <tr className="bg-orange-50 font-semibold text-orange-900"><td colSpan={4} className="px-3 py-1.5 text-right text-orange-600">Total</td><td className="px-3 py-1.5">{totalQty}</td><td className="px-3 py-1.5">{totalCost > 0 ? totalCost.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="text-xs text-center text-gray-400 py-2">ติ๊กเลือก INV ด้านบนเพื่อคำนวณ Freight</p>}
                    </div>
                  </div>
                )
              })}
              <button onClick={addHawbGroup} className="w-full border-2 border-dashed border-orange-300 rounded-xl py-2.5 text-sm text-orange-600 hover:bg-orange-50 hover:border-orange-400 font-medium">+ Add Air Waybill (HAWB)</button>
            </div>
          )}
        </div>
      )}

      {/* Forward modal */}
      {fwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFwOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div><h3 className="font-semibold text-gray-800">↪ Forward ให้ผู้ใต้บังคับบัญชา</h3>
              <p className="text-xs text-gray-400 mt-0.5">บันทึกข้อมูลที่กรอกไว้ แล้วส่งลิงก์ {involvedReqIds.length} เอกสารเข้าอีเมล · เอกสารแต่ละ BU ส่งให้ผู้รับที่ครอบ BU นั้น</p></div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">ผู้รับ (LG จาก master — จัดกลุ่มตาม BU)</label>
              {(() => {
                // Only LG people who cover a BU in the selected documents are suggested; anyone else
                // (e.g. LG of another BU) can be typed in by hand.
                const docBus = [...new Set(involvedReqIds.map(id => docMap[id]?.bu || "NYG"))]
                const relevant = fwTargets.filter(t => [...coveredBus(t)].some(b => docBus.includes(b)))
                return (
                  <>
                    {fwList.map((email, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input list="lg-fw-targets" value={email} onChange={e => setFwList(p => p.map((x, idx) => idx === i ? e.target.value : x))}
                          placeholder="เลือกจากลิสต์ หรือพิมพ์อีเมล @nanyangtextile.com"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        {fwList.length > 1 && <button onClick={() => setFwList(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 px-1">✕</button>}
                      </div>
                    ))}
                    <datalist id="lg-fw-targets">
                      {relevant.map(u => <option key={u.email} value={u.email}>{u.name} — LG {[...coveredBus(u)].filter(b => docBus.includes(b)).join("/")}</option>)}
                    </datalist>
                  </>
                )
              })()}
              <button onClick={() => setFwList(p => [...p, ""])} className="text-xs text-blue-600 hover:underline font-medium">＋ เพิ่มผู้รับ</button>
            </div>
            <div><label className="text-xs font-medium text-gray-500">โน้ต (ไม่บังคับ)</label>
              <textarea value={fwNote} onChange={e => setFwNote(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFwOpen(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">ยกเลิก</button>
              <button onClick={forward} disabled={saving || !fwList.some(Boolean)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">บันทึก & ส่งต่อ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
