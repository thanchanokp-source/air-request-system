"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, buColor } from "../_StageWork"
import { MultiSelect } from "@/components/ui/multi-select"
import { buildRequesters } from "@/lib/pull-requesters"

const INCOTERMS = ["FOB", "CIF", "EX-WORK", "FCA"]
// Incoterms that require a pickup / supplier address (buyer arranges pickup at origin).
const NEEDS_ADDRESS = ["EX-WORK", "FCA"]

// Air weight breaks (kg) → the Q-column key used for the rate (mirror of the Logistics page so the
// Est Air shown here matches what LG computes downstream).
const BREAK_ORDER = [45, 100, 250, 300, 500, 1000, 2000, 8000]
const breakKey = (w: number) => { let b = 45; for (const x of BREAK_ORDER) if (x <= w) b = x; return "Q" + b }

export default function PurchasePage() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const canUse = isAdmin || roles.includes("PURCHASING")
  const [bu, setBu] = useState("ALL")
  const [reqs, setReqs] = useState<any[]>([])
  const [airRows, setAirRows] = useState<any[]>([])
  const [seaRows, setSeaRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  // Fill-once form: one set of purchase fields applied to EVERY SO/PO in the doc (like Purchasing req).
  const [pForm, setPForm] = useState<Record<string, string>>({})
  const pf = (k: string) => pForm[k] ?? ""
  const setPf = (k: string, v: string) => setPForm(p => ({ ...p, [k]: v }))
  const [soQ, setSoQ] = useState("") // filter list by SO / document no
  const [docF, setDocF] = useState<string[]>([])
  const [poF, setPoF] = useState<string[]>([])
  const [reqF, setReqF] = useState<string[]>([])
  const [pcTab, setPcTab] = useState<"queue" | "revise" | "stats">("queue")
  const [uploadingPL, setUploadingPL] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const bus = bu === "ALL" ? BUS : [bu]
      const results = await Promise.all(bus.map(b => fetch(`/api/pull-material?bu=${b}`).then(r => r.json()).catch(() => ({}))))
      const all = results.flatMap((d: any) => d.requests || [])
      setReqs(all.filter((r: any) => r.status === "PENDING_PURCHASING" || r.status === "PC_REVISE"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

  useEffect(() => {
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setAirRows(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/sea-rates").then(r => r.json()).then(d => setSeaRows(d.rows || [])).catch(() => {})
  }, [])

  // On opening a doc: seed the fill-once form from item[0]'s current values (so a re-opened / returned doc
  // shows what was entered before). Weight = the doc's total (stored on item[0]).
  useEffect(() => {
    if (!openId) { setPForm({}); return }
    const rq = reqs.find(r => r.id === openId); if (!rq) return
    const it0 = (rq.items || []).find((i: any) => i.weight != null) || (rq.items || [])[0] || {}
    const dstr = (v: any) => (v ? String(v).slice(0, 10) : "")
    setPForm({
      country: it0.country || "", city: it0.city || "", port: it0.port || "", seaPort: it0.seaPort || "",
      incoterm: it0.incoterm || "", weight: it0.weight != null ? String(it0.weight) : "",
      needDate: dstr(it0.needDate), etc: dstr(it0.etc), pickupAddress: it0.pickupAddress || "",
      boxW: it0.boxW != null ? String(it0.boxW) : "", boxL: it0.boxL != null ? String(it0.boxL) : "", boxH: it0.boxH != null ? String(it0.boxH) : "",
    })
  }, [openId]) // eslint-disable-line

  // country → air ports / sea ports (cascade) + sea port → lead time (from the sheet)
  const { countries, airByCountry, seaByCountry, seaLtByPort } = useMemo(() => {
    const airByCountry: Record<string, Set<string>> = {}, seaByCountry: Record<string, Set<string>> = {}
    const seaLtByPort: Record<string, string> = {}
    // Normalize country case so "China" / "CHINA" group into ONE entry (ports merged).
    airRows.forEach(r => { const c = String(r.country || "").trim().toUpperCase(); if (c && r.origin) (airByCountry[c] ??= new Set()).add(r.origin) })
    seaRows.forEach(r => { const c = String(r.country || "").trim().toUpperCase(); if (c && r.port) (seaByCountry[c] ??= new Set()).add(r.port); if (r.port && r.leadTime) seaLtByPort[r.port] = r.leadTime })
    const countries = [...new Set([...Object.keys(airByCountry), ...Object.keys(seaByCountry)])].sort()
    return { countries, airByCountry, seaByCountry, seaLtByPort }
  }, [airRows, seaRows])

  // Toggle Regular / Irregular per doc (persists immediately; optimistic local update).
  const setDocMode = async (rqId: string, m: "REGULAR" | "IRREGULAR") => {
    setReqs(prev => prev.map(r => (r.id === rqId ? { ...r, mode: m } : r)))
    await fetch(`/api/pull-material/${rqId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m }) }).catch(() => {})
  }

  // Purchase attaches the packing list (and any supporting file) → sent along to LG.
  const uploadPackingList = async (rq: any, files: FileList) => {
    setUploadingPL(rq.id)
    try {
      let firstName = ""
      for (const f of Array.from(files)) {
        if (!firstName) firstName = f.name
        const fd = new FormData(); fd.append("file", f)
        await fetch(`/api/pull-material/${rq.id}/attachments`, { method: "POST", body: fd }).catch(() => {})
      }
      // Record the packing-list filename (informational, shown to LG).
      if (firstName) await fetch(`/api/pull-material/${rq.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packingListName: firstName }) }).catch(() => {})
      await load()
      alert("📎 แนบ Packing List แล้ว")
    } finally { setUploadingPL(null) }
  }

  // Destination factory (feeds the port→factory transport cost on the compare detail).
  // EA/TRM are fixed to their BU; NYG & GW pick G1/G2/G3/G4/GW.
  const factoryDefault = (rq: any) => rq.factory || (rq.bu === "EA" ? "EA" : rq.bu === "TRM" ? "TRM" : "")
  const factoryOptions = (rq: any) => (rq.bu === "EA" ? ["EA"] : rq.bu === "TRM" ? ["TRM"] : ["G1", "G2", "G3", "G4", "GW", "EA", "TRM"])
  const setFactory = async (rqId: string, f: string) => {
    setReqs(prev => prev.map(r => (r.id === rqId ? { ...r, factory: f } : r)))
    await fetch(`/api/pull-material/${rqId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ factory: f }) }).catch(() => {})
  }

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const valOf = (it: any, k: string) => {
    if (edits[it.id]?.[k] !== undefined) return edits[it.id][k]
    if (it[k] == null) return ""
    return (k === "shipmentDate" || k === "needDate" || k === "etc") ? String(it[k]).slice(0, 10) : String(it[k])
  }
  // MRD = the EARLIEST of the BOM date columns (shipment / MRD date / MRD need date / MRD2).
  const mrdOf = (it: any) => {
    const ds = [it.shipmentDate, it.mrdDate, it.mrdNeedDate, it.mrd2].map(v => (v ? new Date(v) : null)).filter(d => d && !isNaN(d.getTime())) as Date[]
    if (!ds.length) return "-"
    const min = new Date(Math.min(...ds.map(d => d.getTime())))
    return min.toLocaleDateString("en-GB")
  }
  // "__OTHER__" = user picked "Other" but hasn't typed a name yet (not a real value).
  const OTHER = "__OTHER__"
  const filled = (v: string) => !!v && v !== OTHER
  const clean = (v: string) => (v === OTHER ? "" : v)

  // AUTO from Master Rate — computed live once PC has entered Air Port + Weight (× pull qty).
  // Air is real (rate × gross, lead time = tt). Sea is per-container / FedEx & DHL masters are not
  // in the system yet → those stay "รอ master" until LG provides the data.
  const airAuto = (it: any) => {
    const w = Number(valOf(it, "weight")) || 0         // weight PC enters = the chargeable weight (kg), used DIRECTLY
    const port = clean(valOf(it, "port"))
    const routes = airRows.filter(r => r.origin === port)
    if (!port || !w || !routes.length) return null
    const bk = breakKey(w)                              // 150kg → Q100
    // same port → pick the MAXIMUM rate at that break.
    const cand = routes.map(r => ({ rate: Number(r.rates?.[bk]), tt: r.tt, exw: Number(r.origCostExw) || 0, fca: Number(r.origCostFca) || 0 })).filter(x => x.rate && !isNaN(x.rate))
    if (!cand.length) return null
    const best = cand.reduce((a, b) => (b.rate > a.rate ? b : a))
    // EX-WORK / FCA add the origin cost from the master; other incoterms add nothing.
    const inc = String(valOf(it, "incoterm") || "").toUpperCase()
    const add = inc === "EX-WORK" ? best.exw : inc === "FCA" ? best.fca : 0
    return { est: Math.round((best.rate * w + add) * 100) / 100, tt: best.tt || "-", bk, add }
  }
  // Est Air preview for the fill-once form (total weight + Port of Loading + Incoterm).
  const pcEst = () => {
    const w = Number(pf("weight")) || 0, port = clean(pf("port"))
    const routes = airRows.filter(r => r.origin === port)
    if (!port || !w || !routes.length) return null
    const bk = breakKey(w)
    const cand = routes.map(r => ({ rate: Number(r.rates?.[bk]), exw: Number(r.origCostExw) || 0, fca: Number(r.origCostFca) || 0 })).filter(x => x.rate && !isNaN(x.rate))
    if (!cand.length) return null
    const best = cand.reduce((a, b) => (b.rate > a.rate ? b : a))
    const inc = String(pf("incoterm") || "").toUpperCase()
    const add = inc === "EX-WORK" ? best.exw : inc === "FCA" ? best.fca : 0
    return { est: Math.round((best.rate * w + add) * 100) / 100, add }
  }

  const save = async (rq: any) => {
    // Fill-once validation — one set of values for the whole document.
    const cc = pf("country"), pp = pf("port"), sp = pf("seaPort"), inc = pf("incoterm")
    if (!filled(cc)) return alert("เลือก / พิมพ์ Country")
    if (!filled(pp) && !filled(sp)) return alert("เลือก Port of Loading (Air) หรือ Sea Port")
    if (!inc) return alert("เลือก Incoterm")
    if (NEEDS_ADDRESS.includes(inc) && !pf("pickupAddress").trim()) return alert(`${inc} ต้องระบุ Pickup address`)
    if (!pf("weight") || !(Number(pf("weight")) > 0)) return alert("กรอกน้ำหนักรวม (kg)")
    // Country / port typed but not in the freight master → LG will be emailed to add the rate.
    const oCountry = filled(cc) && !countries.includes(cc)
    const oPort = filled(pp) && !(airByCountry[cc] || new Set()).has(pp)
    const oSea = filled(sp) && !(seaByCountry[cc] || new Set()).has(sp)
    const otherPorts = (oCountry || oPort || oSea)
      ? [{ so: rq.items[0]?.soNoDoc || "", country: cc, port: oPort ? pp : "", seaPort: oSea ? sp : "", newCountry: oCountry }]
      : []
    if (otherPorts.length && !confirm(`Port/Country นี้ไม่มีใน master — Logistics จะได้รับอีเมลให้เพิ่ม rate\n\nส่งต่อ Logistics เลยไหม?`)) return

    setBusy(rq.id)
    try {
      // Apply the ONE set to every item; total weight goes on item[0] only (recomputePullAir reads it).
      const shared = {
        country: clean(cc), port: clean(pp), seaPort: clean(sp), incoterm: inc,
        pickupAddress: NEEDS_ADDRESS.includes(inc) ? pf("pickupAddress") : "",
        needDate: pf("needDate"), etc: pf("etc"),
        boxW: pf("boxW"), boxL: pf("boxL"), boxH: pf("boxH"),
      }
      const itemUpdates = rq.items.map((it: any, i: number) => ({ id: it.id, ...shared, weight: i === 0 ? pf("weight") : "" }))
      // No manual Logistics step anymore: server auto-computes Est Air + Air L/T, then goes straight to
      // the air decision (SCM or PC). LG only enters ACTUAL later, after approval.
      // A RETURNED doc (PC_REVISE) goes STRAIGHT back to LG (APPROVED) — no re-approval — per the flow.
      const next = rq.status === "PC_REVISE" ? "APPROVED" : (rq.requestType === "PURCHASING" ? "PENDING_PC_DECISION" : "PENDING_SCM_DECISION")
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates, status: next, otherPorts }),
      })
      if (r.ok) { setEdits({}); setOpenId(null); await load() } else alert("Error")
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Purchase / Admin only</p></div>

  const sel = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 disabled:bg-gray-50 disabled:text-gray-400"
  const selc = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 disabled:bg-gray-50 disabled:text-gray-400"
  // Dimension inputs: fixed width, centered, spinner arrows hidden so the digits stay visible.
  const dimc = "w-14 border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-red-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  // Number inputs (weight / cartons): full width, spinner arrows hidden so long numbers stay visible.
  const numc = selc + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  const openReq = reqs.find(r => r.id === openId)
  const allReady = !!(filled(pf("country")) && (filled(pf("port")) || filled(pf("seaPort"))) && pf("incoterm") && Number(pf("weight")) > 0
    && (!NEEDS_ADDRESS.includes(pf("incoterm")) || pf("pickupAddress").trim()))

  // Export the open doc's items to a styled workbook. Sheet "Purchase" = fill-in; the Country cell is a
  // dropdown validated against sheet "Countries" (master names) so imports always match the master.
  const exportXlsx = async () => {
    if (!openReq) return
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()

    // Sheet: master country list (dropdown source + reference)
    const cs = wb.addWorksheet("Countries")
    cs.addRow(["Country (from master)"]); cs.getCell("A1").font = { bold: true }
    cs.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } }
    cs.getColumn(1).width = 26
    countries.forEach(c => cs.addRow([c]))

    // Sheet: ports reference (per master country)
    const ps = wb.addWorksheet("Ports (ref)")
    const ph = ps.addRow(["Country", "Air Ports", "Sea Ports"])
    ph.eachCell(c => { c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } } })
    ps.columns = [{ width: 22 }, { width: 34 }, { width: 34 }] as any
    countries.forEach(c => ps.addRow([c, [...(airByCountry[c] || [])].sort().join(", "), [...(seaByCountry[c] || [])].sort().join(", ")]))

    // Hidden per-country port lists → cascading dropdowns (Air/Sea Port options filter by the chosen
    // Country) via named ranges + INDIRECT. One column per country; a named range AIR_<C> / SEA_<C>.
    const airWs = wb.addWorksheet("_air"); (airWs as any).state = "veryHidden"
    const seaWs = wb.addWorksheet("_sea"); (seaWs as any).state = "veryHidden"
    const colLetter = (n: number) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }
    const rangeName = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "_") // matches SUBSTITUTE($I," ","_")
    const okName = (nm: string) => /^[A-Za-z0-9_.]+$/.test(nm)
    countries.forEach((c, i) => {
      const col = colLetter(i), nm = rangeName(c)
      const air = [...(airByCountry[c] || [])].sort(), sea = [...(seaByCountry[c] || [])].sort()
      airWs.getCell(`${col}1`).value = nm; air.forEach((p, r) => { airWs.getCell(`${col}${r + 2}`).value = p })
      seaWs.getCell(`${col}1`).value = nm; sea.forEach((p, r) => { seaWs.getCell(`${col}${r + 2}`).value = p })
      if (okName(nm)) {
        if (air.length) wb.definedNames.add(`_air!$${col}$2:$${col}$${air.length + 1}`, `AIR_${nm}`)
        if (sea.length) wb.definedNames.add(`_sea!$${col}$2:$${col}$${sea.length + 1}`, `SEA_${nm}`)
      }
    })

    // Sheet: the fill-in form
    const ws = wb.addWorksheet("Purchase")
    const headers = ["SO", "PO No", "Customer", "Cust PO", "Style", "Material", "PULL", "Consumption", "Country *", "Air Port", "Sea Port", "Incoterm *", "Weight(kg) *", "Need Date", "Cartons", "Box W", "Box L", "Box H", "Pickup Addr", "Ship Date", "_ItemID"]
    const widths = [12, 14, 18, 12, 14, 28, 10, 12, 20, 16, 20, 12, 13, 13, 9, 8, 8, 8, 28, 14, 26]
    const REF_C = "FFEAECEE", FILL_C = "FFE2EFDA" // grey (read-only) / green (fill in)
    const FILL_FROM = 8, FILL_TO = 19 // Country .. Ship Date = green (PC fills)
    const hr = ws.addRow(headers); hr.height = 26
    headers.forEach((_, i) => {
      const c = hr.getCell(i + 1)
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: (i >= FILL_FROM && i <= FILL_TO) ? FILL_C : REF_C } }
      c.font = { bold: true, size: 10 }
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
      c.border = { top: { style: "thin", color: { argb: "FFBFBFBF" } }, bottom: { style: "thin", color: { argb: "FFBFBFBF" } }, left: { style: "thin", color: { argb: "FFBFBFBF" } }, right: { style: "thin", color: { argb: "FFBFBFBF" } } }
    })
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
    ws.views = [{ state: "frozen", ySplit: 1 }]
    const fmtD = (v: any) => { if (!v) return ""; const d = new Date(v); return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
    openReq.items.forEach((it: any) => {
      ws.addRow([
        it.soNoDoc, it.poNoDoc || "", it.customerName || "", it.customerPo || "", it.style || "",
        it.itemName || it.itemCode || "", it.pullMaterialQty ?? "", it.consumption ?? "",
        clean(valOf(it, "country")), clean(valOf(it, "port")), clean(valOf(it, "seaPort")),
        valOf(it, "incoterm"), valOf(it, "weight"),
        fmtD(valOf(it, "needDate")), valOf(it, "cartons"), valOf(it, "boxW"), valOf(it, "boxL"), valOf(it, "boxH"), valOf(it, "pickupAddress"),
        fmtD(valOf(it, "shipmentDate") || it.shipmentDate), it.id,
      ])
    })
    // Country (I) = dropdown from Countries sheet. Air Port (J) / Sea Port (K) = CASCADING dropdowns
    // that show only the ports of the chosen Country (via INDIRECT on the AIR_/SEA_ named ranges).
    for (let r = 2; r <= openReq.items.length + 1; r++) {
      ws.getCell(`I${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [`Countries!$A$2:$A$${countries.length + 1}`],
        showErrorMessage: true, errorTitle: "Invalid country", error: "Pick a country from the master (see Countries sheet)",
      } as any
      ws.getCell(`J${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [`INDIRECT("AIR_"&SUBSTITUTE($I${r}," ","_"))`],
      } as any
      ws.getCell(`K${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [`INDIRECT("SEA_"&SUBSTITUTE($I${r}," ","_"))`],
      } as any
    }
    ws.getColumn(headers.length).hidden = true // _ItemID (used to match on import)

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `${openReq.documentNo}_purchase.xlsx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // Import the filled workbook → populate the form (edits) by _ItemID; user reviews then Saves.
  const importXlsx = async (file: File) => {
    const XLSX = await import("xlsx")
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
    const ws = wb.Sheets["Purchase"] || wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
    const pick = (row: any, ...keys: string[]) => { for (const k of keys) if (row[k] !== undefined && row[k] !== "") return String(row[k]).trim(); return "" }
    const next: Record<string, Record<string, string>> = {}
    let applied = 0
    for (const row of rows) {
      const id = pick(row, "_ItemID")
      if (!id) continue
      next[id] = {
        country: pick(row, "Country *", "Country"),
        port: pick(row, "Air Port"),
        seaPort: pick(row, "Sea Port"),
        incoterm: pick(row, "Incoterm *", "Incoterm"),
        weight: pick(row, "Weight(kg) *", "Weight(kg)", "Weight"),
        needDate: pick(row, "Need Date").slice(0, 10),
        cartons: pick(row, "Cartons"),
        boxW: pick(row, "Box W"), boxL: pick(row, "Box L"), boxH: pick(row, "Box H"),
        pickupAddress: pick(row, "Pickup Addr", "Pickup Address"),
        shipmentDate: pick(row, "Ship Date").slice(0, 10),
      }
      applied++
    }
    setEdits(p => ({ ...p, ...next }))
    alert(`Imported ${applied} row(s). Review the form, then click "Save → Send to Logistics".`)
  }

  return (
    <div className="p-5 md:p-8 max-w-[1000px] mx-auto space-y-5">
      <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>รอจัดซื้อกรอก <span className="text-base font-normal text-gray-400">(งานจาก SCM)</span></h1>
        <p className="text-sm text-gray-400 mt-0.5">SCM ส่งมา → จัดซื้อกรอก Country / Air-Sea port / Incoterm / Weight → ส่งต่อ Logistics</p></div>

      <div className="flex gap-2 border-b border-gray-200">
        {([["queue", "📋 งานจัดซื้อ", reqs.filter(r => r.status === "PENDING_PURCHASING").length], ["revise", "↩️ ตีกลับให้แก้", reqs.filter(r => r.status === "PC_REVISE").length]] as const).map(([v, label, n]) => (
          <button key={v} onClick={() => { setPcTab(v); setOpenId(null) }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${pcTab === v ? "" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            style={pcTab === v ? { color: v === "revise" ? "#b91c1c" : MAROON, borderColor: v === "revise" ? "#b91c1c" : MAROON } : undefined}>
            {label}{n >= 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] ${v === "revise" && n > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>{n}</span>}
          </button>
        ))}
      </div>

      {(
      <>
      <div className="flex gap-1.5">{["ALL", ...BUS].map(b => (
        <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${bu === b ? "text-white border-transparent shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: b === "ALL" ? MAROON : buColor(b) } : undefined}>{b === "ALL" ? "ALL BU" : b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        openReq ? (
          <div className="space-y-5">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">← Back</button>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-bold text-lg text-gray-900">{openReq.documentNo}</div>
                <div className="text-xs text-gray-400">{openReq.requesterName} · {openReq.items.length} items</div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-500 font-medium">Mode:</span>
                  {(["REGULAR", "IRREGULAR"] as const).map(m => (
                    <button key={m} onClick={() => setDocMode(openReq.id, m)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${openReq.mode === m ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                      style={openReq.mode === m ? { background: m === "REGULAR" ? "#15803d" : "#b45309" } : undefined}>
                      {m === "REGULAR" ? "🟢 Regular" : "🟠 Irregular"}
                    </button>
                  ))}
                  <span className="text-[11px] text-gray-500 font-medium ml-2">Factory:</span>
                  <select value={factoryDefault(openReq)} onChange={e => setFactory(openReq.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-bold bg-white focus:outline-none focus:ring-2 focus:ring-red-200">
                    {factoryDefault(openReq) === "" && <option value="">— เลือกโรงงาน —</option>}
                    {factoryOptions(openReq).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-2.5 rounded-xl text-sm font-medium border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 cursor-pointer">
                    {uploadingPL === openReq.id ? "กำลังแนบ…" : "📎 แนบ Packing List"}
                    <input type="file" multiple className="hidden" disabled={uploadingPL === openReq.id}
                      onChange={e => { const fs = e.target.files; e.target.value = ""; if (fs?.length) uploadPackingList(openReq, fs) }} />
                  </label>
                  <button onClick={() => save(openReq)} disabled={busy === openReq.id || !allReady}
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition" style={{ background: MAROON }}>
                    {busy === openReq.id ? "Saving…" : (openReq.status === "PC_REVISE" ? "Save → ส่งกลับ LG" : "Save → Send to Logistics")}
                  </button>
                </div>
                {!allReady && <span className="text-[11px] text-amber-600">กรอก Country · Port · Incoterm · Weight (ครั้งเดียวใช้ทั้งใบ)</span>}
              </div>
            </div>

            {openReq.status === "PC_REVISE" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
                <div className="font-semibold text-red-700">↩️ เอกสารถูกตีกลับจาก LG (Revise ครั้งที่ {openReq.reviseCount || 1})</div>
                <div className="text-red-600 mt-0.5">เหตุผล: {openReq.lastReturnReason || "-"}</div>
                <div className="text-[11px] text-red-500 mt-1">แก้ไข/แนบไฟล์ให้ถูกต้อง แล้วกด “Save → ส่งกลับ LG” (ไม่ต้องผ่าน approver ใหม่)</div>
              </div>
            )}
            {(openReq.attachments || []).length > 0 && (
              <div className="text-[11px] text-gray-500">📎 ไฟล์แนบ: {(openReq.attachments || []).map((a: any) => a.filename || a.name).filter(Boolean).join(", ")}</div>
            )}

            {/* Fill-once form — one set of values for the whole document (like Purchasing req) */}
            {(() => {
              const c = pf("country")
              const airPorts = [...(airByCountry[c] || [])].sort()
              const seaPorts = [...(seaByCountry[c] || [])].sort()
              const est = pcEst()
              const poList = [...new Set(openReq.items.map((i: any) => i.poNoDoc).filter(Boolean))]
              const lab = "text-[11px] font-semibold text-gray-600 block mb-1"
              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm font-bold text-gray-800 flex items-center gap-2"><span className="w-1 h-4 rounded inline-block" style={{ background: MAROON }} />ข้อมูลจัดซื้อ <span className="text-[11px] font-normal text-gray-400">(ใช้ทั้งใบ · {openReq.items.length} SO · {poList.length} PO)</span></div>
                    {est && <span className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1">🔒 Est Air ≈ {fmt(est.est)} USD{est.add ? <span className="text-amber-600"> (+{pf("incoterm")})</span> : null}</span>}
                  </div>

                  <div>
                    <label className={lab}>น้ำหนักรวม (kg) <span className="text-red-500">*</span></label>
                    <input type="number" value={pf("weight")} onChange={e => setPf("weight", e.target.value)} placeholder="0"
                      className="w-40 border-2 border-red-300 rounded-xl px-4 py-2 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={{ color: MAROON }} />
                    <span className="ml-2 text-xs text-gray-500">รวมทั้งใบ ({poList.length} PO) — ใช้คิด Est Air</span>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><label className={lab}>Country <span className="text-red-500">*</span></label>
                      <Picker value={pf("country")} list={countries} sel={sel} placeholder="— country —"
                        onChange={v => { setPf("country", v); setPf("port", ""); setPf("seaPort", "") }} typePlaceholder="Type → notify LG" /></div>
                    <div><label className={lab}>Port of Loading (Air) <span className="text-red-500">*</span></label>
                      <Picker value={pf("port")} list={airPorts} sel={sel} disabled={!c}
                        placeholder={c ? (airPorts.length ? "— port of loading —" : "no air port") : "country first"}
                        onChange={v => setPf("port", v)} typePlaceholder="Type → notify LG" /></div>
                    <div><label className={lab}>Sea Port <span className="text-gray-300">(optional)</span></label>
                      <Picker value={pf("seaPort")} list={seaPorts} sel={sel} disabled={!c}
                        placeholder={c ? (seaPorts.length ? "— sea port —" : "no sea port") : "country first"}
                        onChange={v => setPf("seaPort", v)} typePlaceholder="Type → notify LG" /></div>
                    <div><label className={lab}>Incoterm <span className="text-red-500">*</span></label>
                      <select value={pf("incoterm")} onChange={e => setPf("incoterm", e.target.value)} className={sel}>
                        <option value="">—</option>{INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select></div>
                    <div><label className={lab}>Need date (in-house) <span className="text-red-500">*</span></label>
                      <input type="date" value={pf("needDate")} onChange={e => setPf("needDate", e.target.value)} className={sel} /></div>
                    <div><label className={lab}>ETC <span className="text-red-500">*</span></label>
                      <input type="date" value={pf("etc")} onChange={e => setPf("etc", e.target.value)} className={sel} /></div>
                    <div className="sm:col-span-3"><label className={lab}>Dimension ก×ย×ส (cm) <span className="text-gray-300">— ไม่บังคับ</span></label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={pf("boxW")} onChange={e => setPf("boxW", e.target.value)} placeholder="ก" className={dimc} />
                        <span className="text-gray-300">×</span>
                        <input type="number" value={pf("boxL")} onChange={e => setPf("boxL", e.target.value)} placeholder="ย" className={dimc} />
                        <span className="text-gray-300">×</span>
                        <input type="number" value={pf("boxH")} onChange={e => setPf("boxH", e.target.value)} placeholder="ส" className={dimc} />
                      </div></div>
                  </div>

                  {NEEDS_ADDRESS.includes(pf("incoterm")) && (
                    <div>
                      <label className="text-[11px] font-semibold text-amber-700 block mb-1">📍 {pf("incoterm")} Pickup address <span className="text-red-500">*</span></label>
                      <textarea value={pf("pickupAddress")} onChange={e => setPf("pickupAddress", e.target.value)} rows={2}
                        placeholder="ที่อยู่รับสินค้า / supplier address (บังคับสำหรับ EX-WORK / FCA)"
                        className="w-full border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                    </div>
                  )}

                  <details className="border border-gray-200 rounded-xl">
                    <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 rounded-t-xl select-none">📋 ดู SO / PO ในเอกสาร ({openReq.items.length} รายการ)</summary>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500"><tr>
                          {["SO", "PO No", "Material", "PULL", "MRD"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {openReq.items.map((it: any) => (
                            <tr key={it.id} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5"><span className="text-[11px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: MAROON }}>{it.soNoDoc}</span></td>
                              <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{it.poNoDoc || "-"}</td>
                              <td className="px-3 py-1.5 text-gray-700 max-w-[280px] truncate" title={it.itemName || it.itemCode || ""}>{it.itemName || it.itemCode || "-"}</td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                              <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{mrdOf(it)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              )
            })()}
          </div>
        ) : (() => {
          const term = soQ.trim().toLowerCase()
          const wantStatus = pcTab === "revise" ? "PC_REVISE" : "PENDING_PURCHASING"
          const base = reqs.filter(rq => rq.status === wantStatus)
          const { options: reqOptions, displayOf } = buildRequesters(base)
          const docNos = [...new Set(base.map(r => r.documentNo).filter(Boolean))].sort()
          const pos = [...new Set(base.flatMap(r => (r.items || []).map((i: any) => i.poNoDoc)).filter(Boolean))].sort()
          const shown = base.filter(rq => {
            if (docF.length && !docF.includes(rq.documentNo)) return false
            if (poF.length && !(rq.items || []).some((i: any) => poF.includes(i.poNoDoc))) return false
            if (reqF.length && !reqF.includes(displayOf(rq))) return false
            if (term && !(String(rq.documentNo || "").toLowerCase().includes(term) || rq.items.some((i: any) => String(i.soNoDoc || "").toLowerCase().includes(term)))) return false
            return true
          })
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-48"><MultiSelect label="Doc No…" options={docNos} value={docF} onChange={setDocF} /></div>
                <div className="w-48"><MultiSelect label="PO…" options={pos} value={poF} onChange={setPoF} /></div>
                <div className="w-48"><MultiSelect label="จัดซื้อ…" options={reqOptions} value={reqF} onChange={setReqF} /></div>
                <div className="relative w-56">
                  <input value={soQ} onChange={e => setSoQ(e.target.value)} placeholder="🔎 ค้นหา SO / เลขเอกสาร…"
                    className="w-full border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                  {soQ && <button onClick={() => setSoQ("")} className="absolute right-2.5 top-2 text-gray-300 hover:text-gray-500">✕</button>}
                </div>
              </div>
              {base.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">{pcTab === "revise" ? "ไม่มีเอกสารที่ถูกตีกลับ 🎉" : "No documents at this stage"}</div> :
                shown.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">ไม่พบเอกสารที่ตรงกับ “{soQ}”</div> :
                <div className="space-y-2.5">
                  {shown.map(rq => (
                    <button key={rq.id} onClick={() => setOpenId(rq.id)}
                      className={`w-full flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition text-left ${rq.status === "PC_REVISE" ? "border-red-200" : "border-gray-100 hover:border-gray-200"}`}>
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-2">{rq.documentNo}
                          {rq.status === "PC_REVISE" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">↩️ REVISE #{rq.reviseCount || 1}</span>}
                          {rq.mode === "REGULAR"
                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">🟢 REGULAR</span>
                            : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">🟠 IRREGULAR</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{rq.requesterName} · {rq.items.length} items · {[...new Set(rq.items.map((i: any) => i.soNoDoc))].join(", ")}</div>
                        {rq.status === "PC_REVISE" && rq.lastReturnReason && <div className="text-[11px] text-red-600 mt-1">เหตุผลตีกลับ: {rq.lastReturnReason}</div>}
                      </div>
                      <span className="text-gray-300 text-lg">›</span>
                    </button>
                  ))}
                </div>}
            </div>
          )
        })()}
      </>
      )}
    </div>
  )
}

// Revise stats moved to its own page: /pull-material/revise-stats

function Chip({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 truncate" title={String(value ?? "")}>{value || "-"}</div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-semibold text-gray-500 block mb-1.5">{label}</label>{children}</div>
}

// Dropdown from the master list + an "Other" choice. Picking Other reveals an amber input to type a
// value not in the master; that value is flagged on Save so Logistics is emailed to add its rate.
const OTHER_VAL = "__OTHER__"
function Picker({ value, list, onChange, disabled, placeholder, typePlaceholder, sel }:
  { value: string; list: string[]; onChange: (v: string) => void; disabled?: boolean; placeholder: string; typePlaceholder: string; sel: string }) {
  const inList = !!value && list.includes(value)
  const isOther = !!value && !inList // custom typed value OR the "__OTHER__" sentinel
  return (
    <>
      <select value={inList ? value : (isOther ? OTHER_VAL : "")} disabled={disabled}
        onChange={e => onChange(e.target.value)} className={sel}>
        <option value="">{placeholder}</option>
        <option value={OTHER_VAL}>➕ Other (not in list) — type &amp; notify LG</option>
        {list.length > 0 && <option value="" disabled>──────────</option>}
        {list.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      {isOther && (
        <div className="mt-2">
          <input type="text" autoFocus value={value === OTHER_VAL ? "" : value}
            onChange={e => onChange(e.target.value || OTHER_VAL)}
            placeholder={typePlaceholder}
            className={`${sel} border-amber-400 bg-amber-50 focus:ring-amber-200`} />
          <p className="text-[11px] text-amber-700 mt-1">⚠ ไม่มีในระบบ — LG จะได้รับอีเมลให้เพิ่ม rate ตอนกด Save</p>
        </div>
      )}
    </>
  )
}
