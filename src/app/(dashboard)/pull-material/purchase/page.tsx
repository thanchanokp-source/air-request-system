"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, buColor } from "../_StageWork"

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
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [airRows, setAirRows] = useState<any[]>([])
  const [seaRows, setSeaRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const [soQ, setSoQ] = useState("") // filter list by SO / document no

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "PENDING_PURCHASING"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

  useEffect(() => {
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setAirRows(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/sea-rates").then(r => r.json()).then(d => setSeaRows(d.rows || [])).catch(() => {})
  }, [])

  // country → air ports / sea ports (cascade)
  const { countries, airByCountry, seaByCountry } = useMemo(() => {
    const airByCountry: Record<string, Set<string>> = {}, seaByCountry: Record<string, Set<string>> = {}
    airRows.forEach(r => { const c = r.country || ""; if (c && r.origin) (airByCountry[c] ??= new Set()).add(r.origin) })
    seaRows.forEach(r => { const c = r.country || ""; if (c && r.port) (seaByCountry[c] ??= new Set()).add(r.port) })
    const countries = [...new Set([...Object.keys(airByCountry), ...Object.keys(seaByCountry)])].sort()
    return { countries, airByCountry, seaByCountry }
  }, [airRows, seaRows])

  // Toggle Regular / Irregular per doc (persists immediately; optimistic local update).
  const setDocMode = async (rqId: string, m: "REGULAR" | "IRREGULAR") => {
    setReqs(prev => prev.map(r => (r.id === rqId ? { ...r, mode: m } : r)))
    await fetch(`/api/pull-material/${rqId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m }) }).catch(() => {})
  }

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const valOf = (it: any, k: string) => {
    if (edits[it.id]?.[k] !== undefined) return edits[it.id][k]
    if (it[k] == null) return ""
    return (k === "shipmentDate" || k === "needDate") ? String(it[k]).slice(0, 10) : String(it[k])
  }
  // "__OTHER__" = user picked "Other" but hasn't typed a name yet (not a real value).
  const OTHER = "__OTHER__"
  const filled = (v: string) => !!v && v !== OTHER
  const clean = (v: string) => (v === OTHER ? "" : v)

  // AUTO from Master Rate — computed live once PC has entered Air Port + Weight (× pull qty).
  // Air is real (rate × gross, lead time = tt). Sea is per-container / FedEx & DHL masters are not
  // in the system yet → those stay "รอ master" until LG provides the data.
  const airAuto = (it: any) => {
    const w = Number(valOf(it, "weight")) || 0
    const qty = Number(it.pullMaterialQty) || 0
    const port = clean(valOf(it, "port"))
    const gross = w * qty
    const routes = airRows.filter(r => r.origin === port)
    if (!port || !gross || !routes.length) return null
    const bk = breakKey(gross)
    const cand = routes.map(r => ({ rate: Number(r.rates?.[bk]), tt: r.tt })).filter(x => x.rate && !isNaN(x.rate))
    if (!cand.length) return null
    const best = cand.reduce((a, b) => (b.rate > a.rate ? b : a))
    return { est: Math.round(best.rate * gross * 100) / 100, tt: best.tt || "-", bk }
  }

  const save = async (rq: any) => {
    for (const it of rq.items) {
      if (!filled(valOf(it, "country"))) return alert(`Select or type a Country for SO ${it.soNoDoc}.`)
      if (!filled(valOf(it, "port")) && !filled(valOf(it, "seaPort"))) return alert(`Select or type an Air Port or Sea Port for SO ${it.soNoDoc}.`)
      if (!valOf(it, "incoterm")) return alert(`Select an Incoterm for SO ${it.soNoDoc}.`)
      if (NEEDS_ADDRESS.includes(valOf(it, "incoterm")) && !valOf(it, "pickupAddress").trim())
        return alert(`${valOf(it, "incoterm")} needs a Pickup address for SO ${it.soNoDoc}.`)
      if (!valOf(it, "weight")) return alert(`Enter the Weight for SO ${it.soNoDoc}.`)
    }
    // Values PC typed as "Other" (not in the freight master) → LG must add their rate.
    const otherPorts = rq.items.map((it: any) => {
      const cc = valOf(it, "country"), pp = valOf(it, "port"), sp = valOf(it, "seaPort")
      const oCountry = filled(cc) && !countries.includes(cc)
      const oPort = filled(pp) && !(airByCountry[cc] || new Set()).has(pp)
      const oSea = filled(sp) && !(seaByCountry[cc] || new Set()).has(sp)
      return (oCountry || oPort || oSea)
        ? { so: it.soNoDoc, country: cc, port: oPort ? pp : "", seaPort: oSea ? sp : "", newCountry: oCountry }
        : null
    }).filter(Boolean)

    if (otherPorts.length && !confirm(`${otherPorts.length} item(s) use a port/country not in the master.\nLogistics will be emailed to add the rate.\n\nContinue and send to Logistics?`)) return

    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({
        id: it.id, country: clean(valOf(it, "country")), port: clean(valOf(it, "port")), seaPort: clean(valOf(it, "seaPort")),
        incoterm: valOf(it, "incoterm"), weight: valOf(it, "weight"), shipmentDate: valOf(it, "shipmentDate"),
        pickupAddress: NEEDS_ADDRESS.includes(valOf(it, "incoterm")) ? valOf(it, "pickupAddress") : "",
        needDate: valOf(it, "needDate"), cartons: valOf(it, "cartons"),
        boxW: valOf(it, "boxW"), boxL: valOf(it, "boxL"), boxH: valOf(it, "boxH"),
      }))
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates, status: "PENDING_LOGISTICS", otherPorts }),
      })
      if (r.ok) { setEdits({}); setOpenId(null); await load() } else alert("Error")
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Purchase / Admin only</p></div>

  const sel = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 disabled:bg-gray-50 disabled:text-gray-400"
  const selc = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 disabled:bg-gray-50 disabled:text-gray-400"
  const openReq = reqs.find(r => r.id === openId)
  const itemReady = (it: any) => filled(valOf(it, "country")) && (filled(valOf(it, "port")) || filled(valOf(it, "seaPort"))) && !!valOf(it, "incoterm") && !!valOf(it, "weight")
    && (!NEEDS_ADDRESS.includes(valOf(it, "incoterm")) || !!valOf(it, "pickupAddress").trim())
  const allReady = openReq ? openReq.items.every(itemReady) : false

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
      <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>Purchase</h1>
        <p className="text-sm text-gray-400 mt-0.5">Pick Country → choose Air / Sea port, Incoterm &amp; Weight → send to Logistics</p></div>

      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${bu === b ? "text-white border-transparent shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        openReq ? (
          <div className="space-y-5">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">← Back</button>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-bold text-lg text-gray-900">{openReq.documentNo}</div>
                <div className="text-xs text-gray-400">{openReq.requesterName} · {openReq.items.length} items</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 font-medium">Mode:</span>
                  {(["REGULAR", "IRREGULAR"] as const).map(m => (
                    <button key={m} onClick={() => setDocMode(openReq.id, m)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${openReq.mode === m ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                      style={openReq.mode === m ? { background: m === "REGULAR" ? "#15803d" : "#b45309" } : undefined}>
                      {m === "REGULAR" ? "🟢 Regular" : "🟠 Irregular"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <button onClick={exportXlsx}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50">⬇ Export Excel</button>
                  <label className="px-3 py-2.5 rounded-xl text-sm font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 cursor-pointer">⬆ Import
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importXlsx(f) }} />
                  </label>
                  <button onClick={() => save(openReq)} disabled={busy === openReq.id || !allReady}
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition" style={{ background: MAROON }}>
                    {busy === openReq.id ? "Saving…" : "Save → Send to Logistics"}
                  </button>
                </div>
                {!allReady && <span className="text-[11px] text-amber-600">Fill Country, Port, Incoterm &amp; Weight for every item</span>}
              </div>
            </div>

            {/* Excel-like horizontal rows: grey = reference (from BOM/PC), green = fields to fill in */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> จัดซื้อกรอก</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 border border-sky-300" /> 🔒 คำนวณอัตโนมัติจาก Master Rate (อ่านอย่างเดียว)</span>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="text-sm border-collapse min-w-[1720px] w-full">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
                    <th className="px-2 py-2 text-left font-semibold sticky left-0 bg-gray-100 z-10 border-b border-gray-200">SO</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">PO No</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Customer</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Cust PO</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Style</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">OU</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Material</th>
                    <th className="px-2 py-2 text-right font-semibold bg-gray-100 border-b border-gray-200">PULL</th>
                    <th className="px-2 py-2 text-right font-semibold bg-gray-100 border-b border-gray-200">Cons.</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Country *</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Air Port</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Sea Port</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Incoterm *</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Weight(kg) *</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Need Date</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Cartons</th>
                    <th className="px-2 py-2 text-center font-semibold bg-emerald-50 border-b border-emerald-200" title="กว้าง × ยาว × สูง (cm) — ไม่บังคับ">Dim W×L×H (cm)</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Ship Date</th>
                    <th className="px-2 py-2 text-right font-semibold bg-sky-50 border-b border-sky-200 text-sky-700" title="คำนวณอัตโนมัติจาก Master Rate">🔒 Air L/T</th>
                    <th className="px-2 py-2 text-right font-semibold bg-sky-50 border-b border-sky-200 text-sky-700" title="คำนวณอัตโนมัติจาก Master Rate">🔒 Est Air</th>
                    <th className="px-2 py-2 text-right font-semibold bg-sky-50 border-b border-sky-200 text-sky-700">🔒 Sea L/T</th>
                    <th className="px-2 py-2 text-right font-semibold bg-sky-50 border-b border-sky-200 text-sky-700">🔒 Est Sea</th>
                    <th className="px-2 py-2 text-right font-semibold bg-sky-50 border-b border-sky-200 text-sky-700">🔒 Est FedEx</th>
                    <th className="px-2 py-2 text-right font-semibold bg-sky-50 border-b border-sky-200 text-sky-700">🔒 Est DHL</th>
                  </tr>
                </thead>
                <tbody>
                  {openReq.items.map((it: any, idx: number) => {
                    const c = valOf(it, "country")
                    const airPorts = [...(airByCountry[c] || [])].sort()
                    const seaPorts = [...(seaByCountry[c] || [])].sort()
                    const rowBg = idx % 2 ? "bg-gray-50/40" : "bg-white"
                    return [
                      <tr key={it.id} className={`${rowBg} align-top border-b border-gray-100`}>
                        <td className={`px-2 py-1.5 sticky left-0 z-10 ${rowBg}`}>
                          <span className="text-[11px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: MAROON }}>{it.soNoDoc}</span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{it.poNoDoc || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-600 max-w-[140px] truncate" title={it.customerName || ""}>{it.customerName || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{it.customerPo || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{it.style || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap font-medium">{it.ou || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[180px] truncate" title={it.itemName || it.itemCode || ""}>{it.itemName || it.itemCode || "-"}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700 whitespace-nowrap">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                        <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">{fmt(it.consumption)}</td>
                        <td className="px-2 py-1.5 min-w-[150px]">
                          <Picker value={c} list={countries} sel={selc} placeholder="— country —"
                            onChange={v => { setVal(it.id, "country", v); setVal(it.id, "port", ""); setVal(it.id, "seaPort", "") }}
                            typePlaceholder="Type → notify LG" />
                        </td>
                        <td className="px-2 py-1.5 min-w-[140px]">
                          <Picker value={valOf(it, "port")} list={airPorts} sel={selc} disabled={!c}
                            placeholder={c ? (airPorts.length ? "— air —" : "no air port") : "country first"}
                            onChange={v => setVal(it.id, "port", v)} typePlaceholder="Type → notify LG" />
                        </td>
                        <td className="px-2 py-1.5 min-w-[140px]">
                          <Picker value={valOf(it, "seaPort")} list={seaPorts} sel={selc} disabled={!c}
                            placeholder={c ? (seaPorts.length ? "— sea —" : "no sea port") : "country first"}
                            onChange={v => setVal(it.id, "seaPort", v)} typePlaceholder="Type → notify LG" />
                        </td>
                        <td className="px-2 py-1.5 min-w-[110px]">
                          <select value={valOf(it, "incoterm")} onChange={e => setVal(it.id, "incoterm", e.target.value)} className={selc}>
                            <option value="">—</option>
                            {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 min-w-[90px]">
                          <input type="number" value={valOf(it, "weight")} onChange={e => setVal(it.id, "weight", e.target.value)} placeholder="0" className={selc} />
                        </td>
                        <td className="px-2 py-1.5 min-w-[130px]">
                          <input type="date" value={valOf(it, "needDate")} onChange={e => setVal(it.id, "needDate", e.target.value)} className={selc} title="ต้องการของเมื่อไหร่" />
                        </td>
                        <td className="px-2 py-1.5 min-w-[80px]">
                          <input type="number" value={valOf(it, "cartons")} onChange={e => setVal(it.id, "cartons", e.target.value)} placeholder="0" className={selc} />
                        </td>
                        <td className="px-2 py-1.5 min-w-[150px]">
                          <div className="flex items-center gap-1">
                            <input type="number" value={valOf(it, "boxW")} onChange={e => setVal(it.id, "boxW", e.target.value)} placeholder="ก" className={`${selc} px-1 text-center`} />
                            <span className="text-gray-300">×</span>
                            <input type="number" value={valOf(it, "boxL")} onChange={e => setVal(it.id, "boxL", e.target.value)} placeholder="ย" className={`${selc} px-1 text-center`} />
                            <span className="text-gray-300">×</span>
                            <input type="number" value={valOf(it, "boxH")} onChange={e => setVal(it.id, "boxH", e.target.value)} placeholder="ส" className={`${selc} px-1 text-center`} />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 min-w-[130px]">
                          <input type="date" value={valOf(it, "shipmentDate")} onChange={e => setVal(it.id, "shipmentDate", e.target.value)} className={selc} />
                        </td>
                        {(() => {
                          const a = airAuto(it)
                          const cell = "px-2 py-1.5 text-right bg-sky-50/50 whitespace-nowrap"
                          return <>
                            <td className={`${cell} text-sky-800`}>{a ? a.tt : <span className="text-gray-300">—</span>}</td>
                            <td className={`${cell} font-semibold text-sky-800`}>{a ? fmt(a.est) : <span className="text-gray-300">รอกรอก</span>}</td>
                            <td className={`${cell} text-gray-400`} title="Sea เป็นค่าต่อ container — รอสูตร/มาสเตอร์จาก LG">รอ master</td>
                            <td className={`${cell} text-gray-400`}>รอ master</td>
                            <td className={`${cell} text-gray-400`} title="ยังไม่มี master FedEx — รอ data จาก LG">รอ master</td>
                            <td className={`${cell} text-gray-400`} title="ยังไม่มี master DHL — รอ data จาก LG">รอ master</td>
                          </>
                        })()}
                      </tr>,
                      NEEDS_ADDRESS.includes(valOf(it, "incoterm")) && (
                        <tr key={`${it.id}-addr`} className={rowBg}>
                          <td className={`px-2 pb-2 sticky left-0 z-10 ${rowBg}`} />
                          <td colSpan={23} className="px-2 pb-2">
                            <div className="flex items-start gap-2">
                              <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap mt-1.5">📍 {valOf(it, "incoterm")} Pickup address *</span>
                              <textarea value={valOf(it, "pickupAddress")} onChange={e => setVal(it.id, "pickupAddress", e.target.value)} rows={2}
                                placeholder="ที่อยู่รับสินค้า / supplier address (บังคับสำหรับ EX-WORK / FCA)"
                                className="flex-1 border border-amber-300 bg-amber-50 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                          </td>
                        </tr>
                      ),
                    ]
                  }).flat().filter(Boolean)}
                </tbody>
              </table>
            </div>
          </div>
        ) : (() => {
          const term = soQ.trim().toLowerCase()
          const shown = term
            ? reqs.filter(rq =>
                String(rq.documentNo || "").toLowerCase().includes(term) ||
                rq.items.some((i: any) => String(i.soNoDoc || "").toLowerCase().includes(term)))
            : reqs
          return (
            <div className="space-y-3">
              <div className="relative max-w-md">
                <input value={soQ} onChange={e => setSoQ(e.target.value)} placeholder="🔎 ค้นหา SO / เลขเอกสาร…"
                  className="w-full border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                {soQ && <button onClick={() => setSoQ("")} className="absolute right-2.5 top-2 text-gray-300 hover:text-gray-500">✕</button>}
              </div>
              {reqs.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">No documents at this stage</div> :
                shown.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">ไม่พบเอกสารที่ตรงกับ “{soQ}”</div> :
                <div className="space-y-2.5">
                  {shown.map(rq => (
                    <button key={rq.id} onClick={() => setOpenId(rq.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition text-left">
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-2">{rq.documentNo}
                          {rq.mode === "REGULAR"
                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">🟢 REGULAR</span>
                            : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">🟠 IRREGULAR</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{rq.requesterName} · {rq.items.length} items · {[...new Set(rq.items.map((i: any) => i.soNoDoc))].join(", ")}</div>
                      </div>
                      <span className="text-gray-300 text-lg">›</span>
                    </button>
                  ))}
                </div>}
            </div>
          )
        })()}
    </div>
  )
}

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
