"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { MAROON, fmt } from "../_StageWork"
import { EXCHANGE_RATE } from "@/lib/pull-courier"

const AIR_BREAKS = ["M", "N", "Q45", "Q100", "Q250", "Q300", "Q500", "Q1000", "Q2000", "Q8000"]
const SEA_CT = ["40GP", "20GP", "LCL"]
const COURIER_KG = ["0.5KG", "1KG", "2KG", "3KG", "5KG", "10KG", "15KG", "20KG", "25KG", "30KG"]
const kgKey = (b: string) => b.replace(/KG$/i, "").trim() // "0.5KG" → "0.5"

export default function PullRatesPage() {
  const { data: session, status: auth } = useSession()
  // Admin + Logistics Import can edit rates (LOGISTICS_IMPORT adds new port rates flagged by Purchase).
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN") || roles.includes("LOGISTICS_IMPORT")
  const [tab, setTab] = useState<"air" | "sea" | "courier">("air")
  const [air, setAir] = useState<any[]>([])
  const [sea, setSea] = useState<any[]>([])
  const [courier, setCourier] = useState<any[]>([])
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const [sheetUrl, setSheetUrl] = useState("")

  // ?prefill=<JSON [{type:'air'|'sea', country, port}]> → pre-create draft rows for ports Purchase
  // flagged as "Other" (from the "add missing port rate" email link). LG just fills the numbers.
  const params = useSearchParams()
  const prefilled = useRef(false)
  const load = async () => {
    const [a, s, c] = await Promise.all([
      fetch("/api/pull-material/air-rates").then(r => r.json()).catch(() => ({})),
      fetch("/api/pull-material/sea-rates").then(r => r.json()).catch(() => ({})),
      fetch("/api/pull-material/courier-rates").then(r => r.json()).catch(() => ({})),
    ])
    let airRows = a.rows || [], seaRows = s.rows || []
    setCourier(c.rows || [])
    if (!prefilled.current) {
      const raw = params.get("prefill")
      if (raw) {
        try {
          const list = JSON.parse(raw) as any[]
          const airNew = list.filter(x => x.type === "air" && x.port).map((x, i) => ({ id: `new_air_${i}`, _new: true, origin: x.port, country: x.country || null, destination: "BKK", fwd: null, airline: null, tt: null, rates: {} }))
          const seaNew = list.filter(x => x.type === "sea" && x.port).map((x, i) => ({ id: `new_sea_${i}`, _new: true, country: x.country || null, port: x.port, rates: {} }))
          if (airNew.length) airRows = [...airNew, ...airRows]
          if (seaNew.length) seaRows = [...seaNew, ...seaRows]
          if (seaNew.length && !airNew.length) setTab("sea"); else if (airNew.length) setTab("air")
        } catch { /* bad prefill → ignore */ }
      }
      prefilled.current = true
    }
    setAir(airRows); setSea(seaRows); setEdits({})
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const reload = async (which: "air" | "sea") => {
    if (!confirm(`⚠ Reload ${which.toUpperCase()} rates from the bundled Rate_LG data?\nThis REPLACES the current ${which} master — any rows/rates added by LG will be LOST.\nClick "⬇ Backup (Excel)" first if you want to keep them. Continue?`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${which}-rates`, { method: "POST" }).then(r => r.json())
      alert(r.ok ? `Loaded ${r.count} ${which} rows` : (r.error || "Failed"))
      await load()
    } finally { setBusy(false) }
  }

  // Backup: download the CURRENT air + sea master (incl. rows LG added) as one Excel — so edits are
  // never lost if someone clicks "Reload from file" (which overwrites with the bundled seed).
  const exportBackup = async () => {
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    const style = (ws: any) => { const h = ws.getRow(1); h.font = { bold: true }; h.eachCell((c: any) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } } }) }
    const aws = wb.addWorksheet("Air Rate")
    aws.addRow(["COUNTRY", "ORIGIN", "DEST", "FWD", "A/L", "TT", "Orig Cost (EXW)", "Orig Cost (FCA)", ...AIR_BREAKS])
    air.forEach((r: any) => aws.addRow([r.country || "", r.origin || "", r.destination || "", r.fwd || "", r.airline || "", r.tt || "", r.origCostExw ?? "", r.origCostFca ?? "", ...AIR_BREAKS.map(b => r.rates?.[b] ?? "")]))
    style(aws)
    const sws = wb.addWorksheet("Sea Rate")
    sws.addRow(["COUNTRY", "PORT", "L/T", ...SEA_CT])
    sea.forEach((r: any) => sws.addRow([r.country || "", r.port || "", r.leadTime || "", ...SEA_CT.map(c => r.rates?.[c] ?? "")]))
    style(sws)
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const d = new Date()
    const a = document.createElement("a"); a.href = url; a.download = `PullRM_MasterRate_backup_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.xlsx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // Import a Rate_LG workbook (upload) → REPLACE the air &/or sea master. Reads by HEADER NAME so the
  // exact column order doesn't matter; picks up the new "Orig Cost (EXW)/(FCA)" columns for AIR.
  const importXlsx = async (file: File) => {
    const XLSX = await import("xlsx")
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
    const norm = (s: any) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase()
    const sheetByName = (want: string) => wb.SheetNames.find(n => norm(n) === want) || wb.SheetNames.find(n => norm(n).includes(want))

    // Find the header row (contains an ORIGIN/PORT cell) and map column index → field BY NAME. Column
    // order & extra columns don't matter; only a RENAMED header can go unmatched → we report that below.
    type Parsed = { rows: any[]; breaks: string[]; extras: string[]; hasId: boolean }
    const parse = (sheetName: string | undefined, isAir: boolean): Parsed | null => {
      if (!sheetName) return null
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" }) as any[][]
      const key = isAir ? "ORIGIN" : "PORT"
      const hIdx = aoa.findIndex(row => row.some(c => norm(c).includes(key)))
      if (hIdx < 0) return { rows: [], breaks: [], extras: [], hasId: false }
      const H = aoa[hIdx].map(norm)
      const col = (test: (h: string) => boolean) => H.findIndex(test)
      const breaks = isAir ? AIR_BREAKS : SEA_CT
      const breakCols: Record<string, number> = {}
      breaks.forEach(b => { const i = H.findIndex(h => h === norm(b) || h === norm(b).replace("Q", "")); if (i >= 0) breakCols[b] = i })
      const iOrigin = isAir ? col(h => h.includes("ORIGIN")) : col(h => h === "PORT" || h.includes("PORT"))
      const iCountry = col(h => h.includes("COUNTRY"))
      const iDest = col(h => h.includes("DESTINATION") || h === "DEST")
      const iFwd = col(h => h === "FWD")
      const iAl = col(h => h === "A/L" || h.includes("AIRLINE"))
      const iTt = col(h => h === "TT")
      const iExw = col(h => h.includes("EXW"))
      const iFca = col(h => h.includes("FCA"))
      // Sea lead time — a column named L/T, LEAD, TRANSIT, or (day/days).
      const iLt = col(h => h.includes("L/T") || h.includes("LEAD") || h.includes("TRANSIT") || h.includes("DAY"))
      const known = new Set([iOrigin, iCountry, iDest, iFwd, iAl, iTt, iExw, iFca, iLt, ...Object.values(breakCols)].filter(i => i >= 0))
      const extras = H.map((h, i) => (h && !known.has(i) ? h : "")).filter(Boolean) // header columns we ignored
      const rows: any[] = []
      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r]; if (!row) continue
        const idv = iOrigin >= 0 ? String(row[iOrigin] ?? "").trim() : ""
        if (!idv) continue
        const rates: Record<string, any> = {}
        for (const [b, ci] of Object.entries(breakCols)) rates[b] = row[ci]
        if (isAir) rows.push({ origin: idv, country: iCountry >= 0 ? row[iCountry] : null, destination: iDest >= 0 ? row[iDest] : "BKK", fwd: iFwd >= 0 ? row[iFwd] : null, airline: iAl >= 0 ? row[iAl] : null, tt: iTt >= 0 ? row[iTt] : null, origCostExw: iExw >= 0 ? row[iExw] : null, origCostFca: iFca >= 0 ? row[iFca] : null, rates })
        else rows.push({ country: iCountry >= 0 ? row[iCountry] : null, port: idv, leadTime: iLt >= 0 ? String(row[iLt] ?? "").trim() : null, rates })
      }
      return { rows, breaks: Object.keys(breakCols), extras, hasId: iOrigin >= 0 }
    }

    // Courier sheet: ORIGIN + BY COURIER (carrier) + per-kg tier columns (0.5KG..30KG).
    const parseCourier = (): Parsed | null => {
      const sheetName = sheetByName("COURIER")
      if (!sheetName) return null
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" }) as any[][]
      const hIdx = aoa.findIndex(row => row.some(c => norm(c).includes("ORIGIN")))
      if (hIdx < 0) return { rows: [], breaks: [], extras: [], hasId: false }
      const H = aoa[hIdx].map(norm)
      const iOrigin = H.findIndex(h => h.includes("ORIGIN"))
      const iCountry = H.findIndex(h => h.includes("COUNTRY"))
      const iDest = H.findIndex(h => h.includes("DESTINATION") || h === "DEST")
      const iCarrier = H.findIndex(h => h.includes("COURIER") || h.includes("CARRIER"))
      const breakCols: Record<string, number> = {}
      COURIER_KG.forEach(b => { const i = H.findIndex(h => h === norm(b) || h === norm(kgKey(b))); if (i >= 0) breakCols[b] = i })
      const known = new Set([iOrigin, iCountry, iDest, iCarrier, ...Object.values(breakCols)].filter(i => i >= 0))
      const extras = H.map((h, i) => (h && !known.has(i) ? h : "")).filter(Boolean)
      const rows: any[] = []
      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r]; if (!row) continue
        const idv = iOrigin >= 0 ? String(row[iOrigin] ?? "").trim() : ""
        if (!idv) continue
        const rates: Record<string, any> = {}
        for (const [b, ci] of Object.entries(breakCols)) rates[kgKey(b)] = row[ci]
        rows.push({ origin: idv, country: iCountry >= 0 ? row[iCountry] : null, destination: iDest >= 0 ? row[iDest] : "BKK", carrier: iCarrier >= 0 ? row[iCarrier] : "", rates })
      }
      return { rows, breaks: Object.keys(breakCols), extras, hasId: iOrigin >= 0 }
    }

    // SEA sheet is LONG format: COUNTRY / PORT OF DISCHARGE / CONTAINER / FREIGHT RATE (USD) — one row
    // per container type → pivot into rates { 40GP, 20GP, LCL } grouped by (country, port).
    const parseSeaLong = (): Parsed | null => {
      const sheetName = sheetByName("SEA RATE")
      if (!sheetName) return null
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" }) as any[][]
      const hIdx = aoa.findIndex(row => row.some(c => norm(c).includes("PORT")))
      if (hIdx < 0) return { rows: [], breaks: [], extras: [], hasId: false }
      const H = aoa[hIdx].map(norm)
      const first = (...tests: ((h: string) => boolean)[]) => { for (const t of tests) { const i = H.findIndex(t); if (i >= 0) return i } return -1 }
      const iPort = first(h => h.includes("PORT OF DISCHARGE"), h => h.includes("DISCHARGE"), h => h === "POD", h => h.includes("PORT"))
      const iCountry = H.findIndex(h => h.includes("COUNTRY"))
      const iCtr = first(h => h.includes("CONTAINER"), h => h.includes("CONT"), h => h === "CTR", h => h.includes("SIZE"), h => h.includes("TYPE"))
      const iRate = first(h => h.includes("FREIGHT RATE"), h => h.includes("RATE"), h => h.includes("USD"))
      const iRemarks = H.findIndex(h => h.includes("REMARK"))
      if (iPort < 0 || iCtr < 0 || iRate < 0) return { rows: [], breaks: [], extras: [], hasId: iPort >= 0 }
      const ctKey = (v: string) => { const u = norm(v).replace(/['\s]/g, ""); if (u.includes("40")) return "40GP"; if (u.includes("20")) return "20GP"; if (u.includes("LCL") || u.includes("CBM")) return "LCL"; return "" }
      const byPort = new Map<string, any>()
      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r]; if (!row) continue
        const port = String(row[iPort] ?? "").trim(); if (!port) continue
        const ck = ctKey(String(row[iCtr] ?? "")); if (!ck) continue
        const country = iCountry >= 0 ? String(row[iCountry] ?? "").trim() : ""
        const key = `${country}||${port}`
        const e = byPort.get(key) || { country: country || null, port, leadTime: null, rates: {} as Record<string, any>, remarks: iRemarks >= 0 ? row[iRemarks] : null }
        const rate = Number(row[iRate]); if (!isNaN(rate) && row[iRate] !== "") e.rates[ck] = rate
        byPort.set(key, e)
      }
      const rows = [...byPort.values()]
      const breaks = [...new Set(rows.flatMap((r: any) => Object.keys(r.rates)))]
      return { rows, breaks, extras: [], hasId: true }
    }

    const air = parse(sheetByName("AIR RATE"), true)
    // SEA: try the LONG format first (one row per container), fall back to the WIDE format (40'GP/20'GP/LCL cols).
    let sea = parseSeaLong()
    if (!sea || !sea.breaks.length) { const w = parse(sheetByName("SEA RATE"), false); if (w && w.breaks.length) sea = w }
    const cour = parseCourier()
    if (!air && !sea && !cour) return alert('ไม่พบชีท "AIR RATE" / "SEA RATE" / "COURIER" ในไฟล์')

    // A side is SAFE to replace only if it found the ID column AND ≥1 rate column AND ≥1 data row.
    // (Guards against a renamed header silently wiping the master with empty/garbage data.)
    const ok = (p: Parsed | null) => !!p && p.hasId && p.breaks.length > 0 && p.rows.length > 0
    const report = (name: string, p: Parsed | null) => {
      if (!p) return `${name}: — ไม่มีชีทนี้ (ข้าม)`
      if (!p.hasId) return `⚠ ${name}: ไม่เจอคอลัมน์ ${name === "SEA" ? "PORT" : "ORIGIN"} → ข้าม (เปลี่ยนชื่อหัวคอลัมน์?)`
      if (!p.breaks.length) return `⚠ ${name}: ไม่เจอคอลัมน์ราคา → ข้าม (เปลี่ยนชื่อหัวคอลัมน์?)`
      if (!p.rows.length) return `⚠ ${name}: 0 แถว → ข้าม (กันเขียนทับด้วยข้อมูลว่าง)`
      return `✓ ${name}: ${p.rows.length} แถว · ราคา ${p.breaks.join(",")}${p.extras.length ? `\n   คอลัมน์ที่ไม่ได้ใช้ (ข้าม): ${p.extras.join(", ")}` : ""}`
    }
    const willAir = ok(air), willSea = ok(sea), willCour = ok(cour)
    if (!willAir && !willSea && !willCour) return alert(`ไม่ได้แทนที่อะไรเลย — ตรวจหัวคอลัมน์ในไฟล์:\n\n${report("AIR", air)}\n${report("SEA", sea)}\n${report("COURIER", cour)}`)

    const summary = `${report("AIR", air)}\n${report("SEA", sea)}\n${report("COURIER", cour)}\n\nจะ “แทนที่” เฉพาะชีทที่ ✓ (ค่าเดิมของชีทนั้นถูกเขียนทับ)\nกด Backup ไว้ก่อนถ้าต้องการ · ดำเนินการต่อ?`
    if (!confirm(summary)) return
    setBusy(true)
    try {
      if (willAir) await fetch("/api/pull-material/air-rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: air!.rows }) })
      if (willSea) await fetch("/api/pull-material/sea-rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: sea!.rows }) })
      if (willCour) await fetch("/api/pull-material/courier-rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: cour!.rows }) })
      alert(`นำเข้าเสร็จ:\n${willAir ? report("AIR", air) + "\n" : ""}${willSea ? report("SEA", sea) + "\n" : ""}${willCour ? report("COURIER", cour) : ""}`)
      await load()
    } finally { setBusy(false) }
  }

  // Pull the master straight from a Google Sheet link: server downloads the workbook as .xlsx (proxy,
  // avoids CORS), then it goes through the SAME AIR/SEA importer as an uploaded file.
  const syncFromSheet = async () => {
    if (!sheetUrl.trim()) return alert("วางลิงก์ Google Sheet ก่อน")
    setBusy(true)
    try {
      const res = await fetch("/api/pull-material/sheet-proxy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: sheetUrl.trim() }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); return alert(e.error || "ดึงจาก Google Sheet ไม่ได้") }
      const blob = await res.blob()
      await importXlsx(new File([blob], "google_sheet.xlsx"))
    } catch (e: any) { alert(`ดึงไม่สำเร็จ: ${e?.message || e}`) }
    finally { setBusy(false) }
  }

  const cellVal = (row: any, k: string) => edits[row.id]?.[k] ?? (row.rates?.[k] != null ? String(row.rates[k]) : "")
  const setCell = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  // Row-level fields (not inside the rates JSON): origin cost per incoterm.
  const FIELD_KEYS = ["origCostExw", "origCostFca"]
  const fieldVal = (row: any, k: string) => edits[row.id]?.[k] ?? (row[k] != null ? String(row[k]) : "")

  const saveAll = async () => {
    const which = tab
    const src = which === "air" ? air : sea
    const newRows = src.filter((r: any) => r._new)
    const editedIds = Object.keys(edits).filter(id => !String(id).startsWith("new_"))
    if (!newRows.length && !editedIds.length) return
    setBusy(true)
    try {
      // Split an edits[id] bag into rate-break edits vs row-level field edits (EXW/FCA cost).
      const split = (e: Record<string, string> = {}) => {
        const rates: Record<string, string> = {}, fields: Record<string, string> = {}
        for (const [k, v] of Object.entries(e)) (FIELD_KEYS.includes(k) ? fields : rates)[k] = v
        return { rates, fields }
      }
      // Create the new port rows (from the "Other" flag) with whatever cells LG filled.
      for (const nr of newRows) {
        const { rates, fields } = split(edits[nr.id])
        const payload: any = which === "air"
          ? { create: true, origin: nr.origin, country: nr.country, destination: nr.destination || "BKK", fwd: nr.fwd, airline: nr.airline, tt: nr.tt, rates, ...fields }
          : { create: true, country: nr.country, port: nr.port, rates }
        await fetch(`/api/pull-material/${which}-rates`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      }
      // Update the edited existing rows.
      await Promise.all(editedIds.map(id => {
        const row = src.find((r: any) => r.id === id)
        if (!row) return null
        const { rates: rateEdits, fields } = split(edits[id])
        const payload: any = { id, ...fields }
        if (Object.keys(rateEdits).length) payload.rates = { ...(row.rates || {}), ...rateEdits }
        return fetch(`/api/pull-material/${which}-rates`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      }))
      await load()
    } finally { setBusy(false) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>

  const qq = q.trim().toLowerCase()
  const airRows = air.filter(r => !qq || `${r.origin} ${r.destination} ${r.fwd} ${r.airline}`.toLowerCase().includes(qq))
  const seaRows = sea.filter(r => !qq || `${r.country} ${r.port}`.toLowerCase().includes(qq))
  const courierRows = courier.filter(r => !qq || `${r.country} ${r.origin} ${r.carrier}`.toLowerCase().includes(qq))
  const newCount = (tab === "air" ? air : tab === "sea" ? sea : courier).filter((r: any) => r._new).length
  const editCount = Object.keys(edits).filter(id => !String(id).startsWith("new_")).length + newCount
  const cellInp = "w-16 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-red-300"

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Master Rate — Pull Material</h1>
          <p className="text-sm text-gray-500">Freight rates by PORT (from Rate_LG). AIR = per kg by weight break · SEA = per container / CBM. {isAdmin
            ? "Click a number to edit."
            : <span className="text-amber-600">🔒 อ่านอย่างเดียว — แก้ไขได้เฉพาะ Admin / Logistics Import (ถ้ากำลัง View as อยู่ ให้กลับเป็น Admin หรือ View as “Logistics Import”)</span>}</p></div>
        {isAdmin && (
          <div className="flex gap-2">
            {editCount > 0 && <button onClick={saveAll} disabled={busy} className="px-3 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 bg-green-600">💾 Save {editCount} row(s)</button>}
            <label className="px-3 py-2 rounded-lg text-sm font-semibold border border-blue-300 text-blue-700 bg-white cursor-pointer hover:bg-blue-50">⬆ Import Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importXlsx(f) }} />
            </label>
            <button onClick={exportBackup} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-white disabled:opacity-50">⬇ Backup (Excel)</button>
            <button onClick={() => { if (tab !== "courier") reload(tab) }} disabled={busy || tab === "courier"} title={tab === "courier" ? "courier ไม่มี seed — ใช้ Import Excel" : ""} className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 disabled:opacity-50">↻ Reload from seed</button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {([["air", `Air Rate (${air.length})`], ["sea", `Sea Rate (${sea.length})`], ["courier", `Courier (${courier.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { if (editCount && !confirm("Discard unsaved edits?")) return; setTab(k); setEdits({}) }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-current" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            style={tab === k ? { color: MAROON, borderColor: MAROON } : undefined}>{label}</button>
        ))}
      </div>

      {isAdmin && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-blue-800">🔗 Sync จาก Google Sheet:</span>
          <input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="วางลิงก์ Google Sheet ที่นี่ (แชร์เป็น ‘ใครมีลิงก์ก็ดูได้’)"
            className="flex-1 min-w-[240px] border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <button onClick={syncFromSheet} disabled={busy || !sheetUrl.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 disabled:opacity-40">
            {busy ? "กำลังดึง…" : "↻ ดึงเข้าระบบ"}
          </button>
          <span className="w-full text-[11px] text-blue-700/70">ระบบจะดาวน์โหลดทั้งไฟล์ (AIR RATE + SEA RATE รวม EXW/FCA) แล้วแทนที่ master ให้ · ต้องแชร์ Sheet เป็น Viewer แบบ “ใครมีลิงก์ก็ดูได้”</span>
        </div>
      )}

      <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === "air" ? "🔍 Search origin / airline / fwd…" : "🔍 Search country / port…"}
        className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      {tab === "courier" && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
          💱 ค่าในตารางแสดงเป็น <b>USD</b> แล้ว · default exchange rate = <b>{EXCHANGE_RATE}</b> (ต้นทางเป็น THB → หารด้วย {EXCHANGE_RATE})
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-x-auto">
        {tab === "sea" ? (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["COUNTRY", "PORT", "L/T", "40'GP (USD/CTR)", "20'GP (USD/CTR)", "LCL (USD/CBM)"].map(h =>
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {seaRows.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r._new ? "bg-amber-50" : edits[r.id] ? "bg-green-50" : ""}`}>
                  <td className="px-3 py-1.5 text-gray-600">{r.country}{r._new && <span className="ml-1 text-[9px] text-amber-700 font-bold">NEW</span>}</td>
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{r.port}</td>
                  <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.leadTime || "-"}</td>
                  {SEA_CT.map(c => (
                    <td key={c} className="px-2 py-1 text-right">
                      {isAdmin
                        ? <input type="number" value={cellVal(r, c)} onChange={e => setCell(r.id, c, e.target.value)} className={cellInp} />
                        : (r.rates?.[c] != null ? fmt(r.rates[c]) : "-")}
                    </td>
                  ))}
                </tr>
              ))}
              {seaRows.length === 0 && <tr><td colSpan={3 + SEA_CT.length} className="px-3 py-10 text-center text-gray-400">No sea rates {sea.length === 0 && "— click Reload to load from file"}</td></tr>}
            </tbody>
          </table>
        ) : tab === "air" ? (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["COUNTRY", "ORIGIN", "DEST", "FWD", "A/L", "TT"].map(h =>
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-amber-700">Orig Cost (EXW)</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-amber-700">Orig Cost (FCA)</th>
              {AIR_BREAKS.map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {airRows.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r._new ? "bg-amber-50" : edits[r.id] ? "bg-green-50" : ""}`}>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r.country || "-"}{r._new && <span className="ml-1 text-[9px] text-amber-700 font-bold">NEW</span>}</td>
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{r.origin}</td>
                  <td className="px-3 py-1.5">{r.destination}</td>
                  <td className="px-3 py-1.5">{r.fwd || "-"}</td>
                  <td className="px-3 py-1.5">{r.airline || "-"}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{r.tt || "-"}</td>
                  {FIELD_KEYS.map(fk => (
                    <td key={fk} className="px-2 py-1 text-right bg-amber-50/40">
                      {isAdmin
                        ? <input type="number" value={fieldVal(r, fk)} onChange={e => setCell(r.id, fk, e.target.value)} className={cellInp} />
                        : (r[fk] != null ? fmt(r[fk]) : "-")}
                    </td>
                  ))}
                  {AIR_BREAKS.map(b => (
                    <td key={b} className="px-2 py-1 text-right">
                      {isAdmin
                        ? <input type="number" value={cellVal(r, b)} onChange={e => setCell(r.id, b, e.target.value)} className={cellInp} />
                        : (r.rates?.[b] != null ? fmt(r.rates[b]) : "-")}
                    </td>
                  ))}
                </tr>
              ))}
              {airRows.length === 0 && <tr><td colSpan={8 + AIR_BREAKS.length} className="px-3 py-10 text-center text-gray-400">No air rates {air.length === 0 && "— click Import / Reload to load"}</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["ORIGIN", "ORIGIN COUNTRY", "DEST", "BY COURIER"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
              {COURIER_KG.map(h => <th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {courierRows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{r.origin || "-"}</td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r.country || "-"}</td>
                  <td className="px-3 py-1.5">{r.destination}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: MAROON }}>{r.carrier || "-"}</td>
                  {COURIER_KG.map(b => <td key={b} className="px-2 py-1 text-right">{r.rates?.[kgKey(b)] != null ? fmt(Number(r.rates[kgKey(b)]) / EXCHANGE_RATE) : "-"}</td>)}
                </tr>
              ))}
              {courierRows.length === 0 && <tr><td colSpan={4 + COURIER_KG.length} className="px-3 py-10 text-center text-gray-400">No courier rates {courier.length === 0 && "— Import Excel ที่มีชีท COURIER"}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
