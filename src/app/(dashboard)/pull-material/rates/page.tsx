"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { MAROON, fmt } from "../_StageWork"
import { EXCHANGE_RATE } from "@/lib/pull-courier"

const AIR_BREAKS = ["M", "N", "Q45", "Q100", "Q250", "Q300", "Q500", "Q1000", "Q2000", "Q8000"]
const SEA_CT = ["40GP", "20GP", "LCL"]
const COURIER_KG = ["29KG", "30KG", "40KG", "45KG", "50KG", "75KG", "100KG"]
const kgKey = (b: string) => b.replace(/KG$/i, "").trim() // "0.5KG" → "0.5"

export default function PullRatesPage() {
  const { data: session, status: auth } = useSession()
  // Admin + Logistics Import can edit rates (LOGISTICS_IMPORT adds new port rates flagged by Purchase).
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN") || roles.includes("LOGISTICS_IMPORT")
  const [tab, setTab] = useState<"air" | "sea" | "courier" | "truck">("air")
  const [air, setAir] = useState<any[]>([])
  const [sea, setSea] = useState<any[]>([])
  const [courier, setCourier] = useState<any[]>([])
  const [truck, setTruck] = useState<any[]>([])
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const [sheetUrl, setSheetUrl] = useState("")

  // ?prefill=<JSON [{type:'air'|'sea', country, port}]> → pre-create draft rows for ports Purchase
  // flagged as "Other" (from the "add missing port rate" email link). LG just fills the numbers.
  const params = useSearchParams()
  const prefilled = useRef(false)
  const load = async () => {
    const [a, s, c, t] = await Promise.all([
      fetch("/api/pull-material/air-rates").then(r => r.json()).catch(() => ({})),
      fetch("/api/pull-material/sea-rates").then(r => r.json()).catch(() => ({})),
      fetch("/api/pull-material/courier-rates").then(r => r.json()).catch(() => ({})),
      fetch("/api/pull-material/truck-rates").then(r => r.json()).catch(() => ({})),
    ])
    setTruck(t.rows || [])
    let airRows = a.rows || [], seaRows = s.rows || [], courierRows = c.rows || []
    if (!prefilled.current) {
      const raw = params.get("prefill")
      if (raw) {
        try {
          const list = JSON.parse(raw) as any[]
          const airNew = list.filter(x => x.type === "air" && x.port).map((x, i) => ({ id: `new_air_${i}`, _new: true, origin: x.port, country: x.country || null, destination: "BKK", fwd: null, airline: null, tt: null, rates: {} }))
          const seaNew = list.filter(x => x.type === "sea" && x.port).map((x, i) => ({ id: `new_sea_${i}`, _new: true, country: x.country || null, forwarder: null, port: x.port, container: "LCL", rate: null, unit: null, remarks: null }))
          const courNew = list.filter(x => x.type === "courier" && x.port).map((x, i) => ({ id: `new_courier_${i}`, _new: true, origin: x.port, country: x.country || null, destination: "BKK", carrier: (x.carrier || "").toUpperCase(), rates: {} }))
          if (airNew.length) airRows = [...airNew, ...airRows]
          if (seaNew.length) seaRows = [...seaNew, ...seaRows]
          if (courNew.length) courierRows = [...courNew, ...courierRows]
          if (courNew.length && !airNew.length && !seaNew.length) setTab("courier")
          else if (seaNew.length && !airNew.length) setTab("sea"); else if (airNew.length) setTab("air")
        } catch { /* bad prefill → ignore */ }
      }
      prefilled.current = true
    }
    setAir(airRows); setSea(seaRows); setCourier(courierRows); setEdits({})
  }
  useEffect(() => { load() }, []) // eslint-disable-line
  // Deep-link from the compare box "no master" link → open the right tab + prefill the search with the port.
  useEffect(() => {
    const t = params.get("tab"); if (t === "air" || t === "sea" || t === "courier") setTab(t)
    const port = params.get("port"); if (port) setQ(port)
  }, []) // eslint-disable-line

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

    // SEA sheet = LONG format, kept as-is (one DB row per sheet line, exactly like the Excel):
    // COUNTRY / FREIGHT(forwarder) / PORT OF DISCHARGE / CONTAINER / FREIGHT RATE (USD) / UNIT / UPDATED / REMARKS.
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
      const iFwd = first(h => h === "FREIGHT", h => h.includes("FORWARD") || h === "FWD")
      const iCtr = first(h => h.includes("CONTAINER"), h => h.includes("CONT"), h => h === "CTR", h => h.includes("SIZE"), h => h.includes("TYPE"))
      const iRate = first(h => h.includes("FREIGHT RATE"), h => h.includes("RATE"), h => h.includes("USD"))
      const iUnit = H.findIndex(h => h === "UNIT")
      const iUpd = first(h => h.includes("UPDATED"), h => h.includes("UPDATE"))
      const iRem = H.findIndex(h => h.includes("REMARK"))
      seaDbg = `หัวคอลัมน์ SEA:\n${JSON.stringify(aoa[hIdx])}\nPORT=col${iPort} CONTAINER=col${iCtr} RATE=col${iRate}`
      if (iPort < 0 || iRate < 0) return { rows: [], breaks: [], extras: [], hasId: iPort >= 0 }
      const cleanNum = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return (v === "" || v == null || isNaN(n)) ? "" : n }
      const rows: any[] = []
      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r]; if (!row) continue
        const port = String(row[iPort] ?? "").trim(); if (!port) continue
        rows.push({
          country: iCountry >= 0 ? String(row[iCountry] ?? "").trim() : null, forwarder: iFwd >= 0 ? String(row[iFwd] ?? "").trim() : null,
          port, container: iCtr >= 0 ? String(row[iCtr] ?? "").trim() : null, rate: cleanNum(row[iRate]),
          unit: iUnit >= 0 ? String(row[iUnit] ?? "").trim() : null, updated: iUpd >= 0 ? String(row[iUpd] ?? "").trim() : null, remarks: iRem >= 0 ? String(row[iRem] ?? "").trim() : null,
        })
      }
      const breaks = rows.some((r: any) => r.rate !== "" && r.rate != null) ? ["RATE"] : []
      return { rows, breaks, extras: [], hasId: iPort >= 0 }
    }

    // TRUCK sheet ("IMPORT TRUCK") = port/airport → factory. Section-header rows set the port group;
    // data rows carry supplier / location / 20' / 40' / LCL 4-wheel / LCL 6-wheel.
    const parseTruck = (): { rows: any[] } | null => {
      const sheetName = sheetByName("IMPORT TRUCK") || sheetByName("TRUCK")
      if (!sheetName) return null
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" }) as any[][]
      const hIdx = aoa.findIndex(row => row.some(c => norm(c).includes("LCL")) || row.some(c => norm(c).includes("SUPPLIER")))
      if (hIdx < 0) return { rows: [] }
      const H = aoa[hIdx].map(norm)
      const first = (...tests: ((h: string) => boolean)[]) => { for (const t of tests) { const i = H.findIndex(t); if (i >= 0) return i } return -1 }
      const iSup = first(h => h.includes("SUPPLIER"))
      const iLoc = first(h => h.includes("LOCATION"))
      const iR20 = first(h => h.includes("20"))
      const iR40 = first(h => h.includes("40"))
      const iL1 = first(h => (h.includes("4") && (h.includes("ล้อ") || h.includes("LCL"))) || (h.includes("<1") || h.includes("< 1")))
      const iL2 = first(h => (h.includes("6") && (h.includes("ล้อ") || h.includes("LCL"))) || (h.includes(">1") || h.includes("> 1")))
      const iUpd = first(h => h.includes("UPDATE"))
      const groupOf = (s: string) => { const u = String(s || "").toUpperCase(); if (u.includes("AIRPORT") || u.includes("สนามบิน")) return "BKK_AIRPORT"; if (u.includes("LAEM") || u.includes("แหลมฉบัง")) return "LAEM_CHABANG"; if (u.includes("BANGKOK") || u.includes("กรุงเทพ") || u.includes("ท่าเรือ")) return "BANGKOK_PORT"; return "" }
      const clean = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return (v === "" || v == null || isNaN(n)) ? null : n }
      const rows: any[] = []
      let group = ""
      for (let r = hIdx + 1; r < aoa.length; r++) {
        const row = aoa[r]; if (!row) continue
        const line = row.map((c: any) => String(c ?? "")).join(" ")
        const g = groupOf(line)
        const sup = iSup >= 0 ? String(row[iSup] ?? "").trim() : ""
        const loc = iLoc >= 0 ? String(row[iLoc] ?? "").trim() : ""
        // A section header names a port group but has no supplier/location data.
        if (g && !sup && !loc) { group = g; continue }
        if (g && !group) group = g
        if (!loc || !group) continue
        rows.push({ portGroup: group, supplier: sup || null, location: loc, rate20: clean(row[iR20]), rate40: clean(row[iR40]), rateLcl1: clean(row[iL1]), rateLcl2: clean(row[iL2]), updated: iUpd >= 0 ? String(row[iUpd] ?? "").trim() : null })
      }
      return { rows }
    }

    let seaDbg = ""
    const air = parse(sheetByName("AIR RATE"), true)
    const sea = parseSeaLong()
    const cour = parseCourier()
    const truck = parseTruck()
    if (!air && !sea && !cour && !truck) return alert('ไม่พบชีท "AIR RATE" / "SEA RATE" / "COURIER" / "IMPORT TRUCK" ในไฟล์')

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
    const willAir = ok(air), willSea = ok(sea), willCour = ok(cour), willTruck = !!truck && truck.rows.length > 0
    if (!willAir && !willSea && !willCour && !willTruck) return alert(`ไม่ได้แทนที่อะไรเลย — ตรวจหัวคอลัมน์ในไฟล์:\n\n${report("AIR", air)}\n${report("SEA", sea)}\n${report("COURIER", cour)}`)

    const seaDebugMsg = !willSea && seaDbg ? `\n\n🔍 DEBUG SEA:\n${seaDbg}` : ""
    const truckMsg = truck ? `TRUCK: ${truck.rows.length} แถว` : "TRUCK: — ไม่มีชีท"
    const summary = `${report("AIR", air)}\n${report("SEA", sea)}\n${report("COURIER", cour)}\n${truckMsg}${seaDebugMsg}\n\nจะ “แทนที่” เฉพาะชีทที่ ✓ (ค่าเดิมของชีทนั้นถูกเขียนทับ)\nกด Backup ไว้ก่อนถ้าต้องการ · ดำเนินการต่อ?`
    if (!confirm(summary)) return
    setBusy(true)
    try {
      if (willAir) await fetch("/api/pull-material/air-rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: air!.rows }) })
      if (willSea) await fetch("/api/pull-material/sea-rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: sea!.rows }) })
      if (willCour) await fetch("/api/pull-material/courier-rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: cour!.rows }) })
      if (willTruck) await fetch("/api/pull-material/truck-rates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: truck!.rows }) })
      alert(`นำเข้าเสร็จ:\n${willAir ? report("AIR", air) + "\n" : ""}${willSea ? report("SEA", sea) + "\n" : ""}${willCour ? report("COURIER", cour) + "\n" : ""}${willTruck ? truckMsg : ""}`)
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
  // SEA is LONG format — each column is a plain row field (no rates JSON). Edits stored per key.
  const SEA_KEYS = ["country", "forwarder", "port", "container", "rate", "unit", "remarks"]
  const seaVal = (row: any, k: string) => edits[row.id]?.[k] ?? (row[k] != null ? String(row[k]) : "")

  // Insert a blank draft row for the current tab (LG adds a missing port manually).
  const addRow = () => {
    const id = `new_${tab}_${Date.now()}`
    if (tab === "air") setAir(p => [{ id, _new: true, origin: "", country: null, destination: "BKK", fwd: null, airline: null, tt: null, rates: {} }, ...p])
    else if (tab === "sea") setSea(p => [{ id, _new: true, country: null, forwarder: null, port: "", container: "LCL", rate: null, unit: null, remarks: null }, ...p])
    else if (tab === "courier") setCourier(p => [{ id, _new: true, origin: "", country: null, destination: "BKK", carrier: "DHL", rates: {} }, ...p])
  }

  const saveAll = async () => {
    const which = tab
    const src = which === "air" ? air : which === "sea" ? sea : courier
    const newRows = src.filter((r: any) => r._new)
    const editedIds = Object.keys(edits).filter(id => !String(id).startsWith("new_"))
    if (!newRows.length && !editedIds.length) return
    setBusy(true)
    // COURIER = per-kg tiers stored in THB (LG types USD in the table → ×EXCHANGE_RATE to store).
    if (which === "courier") {
      try {
        for (const nr of newRows) {
          const e = edits[nr.id] || {}
          const g = (k: string) => e[k] ?? (nr[k] != null ? String(nr[k]) : "")
          if (!g("origin").trim()) { alert("กรอก ORIGIN (air port) ก่อนบันทึกแถวใหม่"); setBusy(false); return }
          if (!g("carrier").trim()) { alert("เลือก CARRIER (DHL / FedEx) ก่อนบันทึก"); setBusy(false); return }
          const rates: Record<string, number> = {}
          for (const b of COURIER_KG) { const v = e[kgKey(b)]; if (v !== undefined && v !== "") { const n = Number(v); if (!isNaN(n)) rates[kgKey(b)] = Math.round(n * EXCHANGE_RATE * 100) / 100 } }
          await fetch(`/api/pull-material/courier-rates`, { method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ create: true, origin: g("origin"), country: g("country") || null, destination: g("destination") || "BKK", carrier: g("carrier"), rates }) })
        }
        await load()
      } finally { setBusy(false) }
      return
    }
    // SEA = LONG format: each row's columns are plain fields → save them directly (no rates JSON).
    if (which === "sea") {
      try {
        for (const nr of newRows) {
          const e = edits[nr.id] || {}
          const g = (k: string) => e[k] ?? (nr[k] != null ? String(nr[k]) : "")
          if (!g("port").trim()) { alert("กรอก PORT ก่อนบันทึกแถวใหม่"); setBusy(false); return }
          await fetch(`/api/pull-material/sea-rates`, { method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ create: true, country: g("country") || null, forwarder: g("forwarder") || null, port: g("port"), container: g("container") || null, rate: g("rate"), unit: g("unit") || null, remarks: g("remarks") || null }) })
        }
        await Promise.all(editedIds.map(id => {
          const e = edits[id]; const payload: any = { id }
          for (const k of SEA_KEYS) if (e[k] !== undefined) payload[k] = e[k]
          return fetch(`/api/pull-material/sea-rates`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        }))
        await load()
      } finally { setBusy(false) }
      return
    }
    // AIR (sea returns above): split an edits bag into rate breaks vs row-level fields (EXW/FCA cost + meta).
    const META_KEYS = ["origin", "country", "destination", "fwd", "airline", "tt"]
    try {
      const split = (e: Record<string, string> = {}) => {
        const rates: Record<string, string> = {}, fields: Record<string, string> = {}
        for (const [k, v] of Object.entries(e)) ((FIELD_KEYS.includes(k) || META_KEYS.includes(k)) ? fields : rates)[k] = v
        return { rates, fields }
      }
      // Create the new port rows (prefill OR manual "➕ เพิ่มแถว") with whatever cells LG filled.
      for (const nr of newRows) {
        const { rates, fields } = split(edits[nr.id])
        const g = (k: string) => (fields as any)[k] ?? nr[k]  // edits win over the draft defaults
        if (!String(g("origin") || "").trim()) { alert("กรอก ORIGIN ก่อนบันทึกแถวใหม่"); setBusy(false); return }
        const payload: any = { create: true, origin: g("origin"), country: g("country") || null, destination: g("destination") || "BKK", fwd: g("fwd") || null, airline: g("airline") || null, tt: g("tt") || null, rates, origCostExw: (fields as any).origCostExw, origCostFca: (fields as any).origCostFca }
        await fetch(`/api/pull-material/air-rates`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
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
  const seaRows = sea.filter(r => !qq || `${r.country} ${r.port} ${r.container} ${r.forwarder}`.toLowerCase().includes(qq))
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
            <button onClick={addRow} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 disabled:opacity-50">➕ เพิ่มแถว</button>
            <label className="px-3 py-2 rounded-lg text-sm font-semibold border border-blue-300 text-blue-700 bg-white cursor-pointer hover:bg-blue-50">⬆ Import Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importXlsx(f) }} />
            </label>
            <button onClick={exportBackup} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-white disabled:opacity-50">⬇ Backup (Excel)</button>
            <button onClick={() => { if (tab === "air" || tab === "sea") reload(tab) }} disabled={busy || tab === "courier" || tab === "truck"} title={tab === "courier" || tab === "truck" ? "ไม่มี seed — ใช้ Import Excel" : ""} className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 disabled:opacity-50">↻ Reload from seed</button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {([["air", `Air Rate (${air.length})`], ["sea", `Sea Rate (${sea.length})`], ["courier", `Courier (${courier.length})`], ["truck", `Truck (${truck.length})`]] as const).map(([k, label]) => (
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
              {["COUNTRY", "FREIGHT", "PORT OF DISCHARGE", "CONTAINER", "FREIGHT RATE (USD)", "UNIT", "UPDATED", "REMARKS"].map(h =>
                <th key={h} className={`px-3 py-2 font-medium whitespace-nowrap ${h.includes("RATE") ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {seaRows.map(r => {
                const seaInp = "w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-300"
                // New draft row → every column editable; existing row → only RATE editable inline (admin).
                const txt = (k: string, ph = "") => r._new
                  ? <input value={seaVal(r, k)} placeholder={ph} onChange={e => setCell(r.id, k, e.target.value)} className={seaInp} />
                  : <span>{r[k] || "-"}</span>
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 ${r._new ? "bg-amber-50" : edits[r.id] ? "bg-green-50" : ""}`}>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{txt("country")}{r._new && <span className="ml-1 text-[9px] text-amber-700 font-bold">NEW</span>}</td>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{txt("forwarder")}</td>
                    <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{r._new ? txt("port", "PORT*") : r.port}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r._new ? txt("container", "LCL") : (r.container || "-")}</td>
                    <td className="px-2 py-1 text-right font-medium" style={{ color: MAROON }}>
                      {isAdmin
                        ? <input type="number" value={seaVal(r, "rate")} onChange={e => setCell(r.id, "rate", e.target.value)} className={`${seaInp} text-right w-24`} />
                        : (r.rate != null ? fmt(r.rate) : "-")}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{txt("unit")}</td>
                    <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{r.updated || "-"}</td>
                    <td className="px-3 py-1.5 text-gray-400 max-w-[220px] truncate" title={r.remarks || ""}>{r._new ? txt("remarks") : (r.remarks || "-")}</td>
                  </tr>
                )
              })}
              {seaRows.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">No sea rates {sea.length === 0 && "— กด ➕ เพิ่มแถว หรือ Import Excel ที่มีชีท SEA RATE"}</td></tr>}
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
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r._new
                    ? <input value={fieldVal(r, "country")} placeholder="country" onChange={e => setCell(r.id, "country", e.target.value)} className="w-24 border border-gray-200 rounded px-1.5 py-0.5 text-xs" />
                    : (r.country || "-")}{r._new && <span className="ml-1 text-[9px] text-amber-700 font-bold">NEW</span>}</td>
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{r._new
                    ? <input value={fieldVal(r, "origin")} placeholder="ORIGIN*" onChange={e => setCell(r.id, "origin", e.target.value)} className="w-20 border border-gray-200 rounded px-1.5 py-0.5 text-xs" />
                    : r.origin}</td>
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
        ) : tab === "courier" ? (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["ORIGIN", "ORIGIN COUNTRY", "DEST", "BY COURIER"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
              {COURIER_KG.map(h => <th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {courierRows.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r._new ? "bg-amber-50" : ""}`}>
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{r._new
                    ? <input value={fieldVal(r, "origin")} placeholder="ORIGIN*" onChange={e => setCell(r.id, "origin", e.target.value)} className="w-20 border border-gray-200 rounded px-1.5 py-0.5 text-xs" />
                    : (r.origin || "-")}{r._new && <span className="ml-1 text-[9px] text-amber-700 font-bold">NEW</span>}</td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r._new
                    ? <input value={fieldVal(r, "country")} placeholder="country" onChange={e => setCell(r.id, "country", e.target.value)} className="w-24 border border-gray-200 rounded px-1.5 py-0.5 text-xs" />
                    : (r.country || "-")}</td>
                  <td className="px-3 py-1.5">{r.destination}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: MAROON }}>{r._new
                    ? <select value={fieldVal(r, "carrier")} onChange={e => setCell(r.id, "carrier", e.target.value)} className="border border-gray-200 rounded px-1 py-0.5 text-xs"><option value="DHL">DHL</option><option value="FEDEX">FedEx</option></select>
                    : (r.carrier || "-")}</td>
                  {COURIER_KG.map(b => (
                    <td key={b} className="px-2 py-1 text-right">
                      {r._new
                        ? <input type="number" value={cellVal(r, kgKey(b))} onChange={e => setCell(r.id, kgKey(b), e.target.value)} className={cellInp} title="ใส่เป็น USD" />
                        : (r.rates?.[kgKey(b)] != null ? fmt(Number(r.rates[kgKey(b)]) / EXCHANGE_RATE) : "-")}
                    </td>
                  ))}
                </tr>
              ))}
              {courierRows.length === 0 && <tr><td colSpan={4 + COURIER_KG.length} className="px-3 py-10 text-center text-gray-400">No courier rates {courier.length === 0 && "— กด ➕ เพิ่มแถว หรือ Import Excel ที่มีชีท COURIER"}</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["PORT GROUP", "SUPPLIER", "LOCATION", "20' <8T", "40' >8.1T", "LCL 4ล้อ <1T", "LCL 6ล้อ >1T", "UPDATED"].map((h, i) =>
                <th key={h} className={`px-3 py-2 font-medium whitespace-nowrap ${i >= 3 && i <= 6 ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {truck.filter((r: any) => !qq || `${r.portGroup} ${r.supplier} ${r.location}`.toLowerCase().includes(qq)).map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 whitespace-nowrap"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{r.portGroup}</span></td>
                  <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.supplier || "-"}</td>
                  <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{r.location}</td>
                  <td className="px-3 py-1.5 text-right">{r.rate20 != null ? fmt(r.rate20) : "-"}</td>
                  <td className="px-3 py-1.5 text-right">{r.rate40 != null ? fmt(r.rate40) : "-"}</td>
                  <td className="px-3 py-1.5 text-right font-medium" style={{ color: MAROON }}>{r.rateLcl1 != null ? fmt(r.rateLcl1) : "-"}</td>
                  <td className="px-3 py-1.5 text-right font-medium" style={{ color: MAROON }}>{r.rateLcl2 != null ? fmt(r.rateLcl2) : "-"}</td>
                  <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{r.updated || "-"}</td>
                </tr>
              ))}
              {truck.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">No truck rates — Import Excel ที่มีชีท "IMPORT TRUCK"</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
