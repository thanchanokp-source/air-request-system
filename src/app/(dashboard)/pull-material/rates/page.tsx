"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { MAROON, fmt } from "../_StageWork"

const AIR_BREAKS = ["M", "N", "Q45", "Q100", "Q250", "Q300", "Q500", "Q1000", "Q2000", "Q8000"]
const SEA_CT = ["40GP", "20GP", "LCL"]

export default function PullRatesPage() {
  const { data: session, status: auth } = useSession()
  // Admin + Logistics Import can edit rates (LOGISTICS_IMPORT adds new port rates flagged by Purchase).
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN") || roles.includes("LOGISTICS_IMPORT")
  const [tab, setTab] = useState<"air" | "sea">("air")
  const [air, setAir] = useState<any[]>([])
  const [sea, setSea] = useState<any[]>([])
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  // ?prefill=<JSON [{type:'air'|'sea', country, port}]> → pre-create draft rows for ports Purchase
  // flagged as "Other" (from the "add missing port rate" email link). LG just fills the numbers.
  const params = useSearchParams()
  const prefilled = useRef(false)
  const load = async () => {
    const [a, s] = await Promise.all([
      fetch("/api/pull-material/air-rates").then(r => r.json()).catch(() => ({})),
      fetch("/api/pull-material/sea-rates").then(r => r.json()).catch(() => ({})),
    ])
    let airRows = a.rows || [], seaRows = s.rows || []
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
    aws.addRow(["COUNTRY", "ORIGIN", "DEST", "FWD", "A/L", "TT", ...AIR_BREAKS])
    air.forEach((r: any) => aws.addRow([r.country || "", r.origin || "", r.destination || "", r.fwd || "", r.airline || "", r.tt || "", ...AIR_BREAKS.map(b => r.rates?.[b] ?? "")]))
    style(aws)
    const sws = wb.addWorksheet("Sea Rate")
    sws.addRow(["COUNTRY", "PORT", ...SEA_CT])
    sea.forEach((r: any) => sws.addRow([r.country || "", r.port || "", ...SEA_CT.map(c => r.rates?.[c] ?? "")]))
    style(sws)
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const d = new Date()
    const a = document.createElement("a"); a.href = url; a.download = `PullRM_MasterRate_backup_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.xlsx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const cellVal = (row: any, k: string) => edits[row.id]?.[k] ?? (row.rates?.[k] != null ? String(row.rates[k]) : "")
  const setCell = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))

  const saveAll = async () => {
    const which = tab
    const src = which === "air" ? air : sea
    const newRows = src.filter((r: any) => r._new)
    const editedIds = Object.keys(edits).filter(id => !String(id).startsWith("new_"))
    if (!newRows.length && !editedIds.length) return
    setBusy(true)
    try {
      // Create the new port rows (from the "Other" flag) with whatever rate cells LG filled.
      for (const nr of newRows) {
        const rates = { ...(edits[nr.id] || {}) }
        const payload: any = which === "air"
          ? { create: true, origin: nr.origin, country: nr.country, destination: nr.destination || "BKK", fwd: nr.fwd, airline: nr.airline, tt: nr.tt, rates }
          : { create: true, country: nr.country, port: nr.port, rates }
        await fetch(`/api/pull-material/${which}-rates`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      }
      // Update the edited existing rows.
      await Promise.all(editedIds.map(id => {
        const row = src.find((r: any) => r.id === id)
        if (!row) return null
        const rates = { ...(row.rates || {}), ...edits[id] }
        return fetch(`/api/pull-material/${which}-rates`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, rates }) })
      }))
      await load()
    } finally { setBusy(false) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>

  const qq = q.trim().toLowerCase()
  const airRows = air.filter(r => !qq || `${r.origin} ${r.destination} ${r.fwd} ${r.airline}`.toLowerCase().includes(qq))
  const seaRows = sea.filter(r => !qq || `${r.country} ${r.port}`.toLowerCase().includes(qq))
  const newCount = (tab === "air" ? air : sea).filter((r: any) => r._new).length
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
            <button onClick={exportBackup} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-white disabled:opacity-50">⬇ Backup (Excel)</button>
            <button onClick={() => reload(tab)} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 disabled:opacity-50">↻ Reload from file</button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {([["air", `Air Rate (${air.length})`], ["sea", `Sea Rate (${sea.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { if (editCount && !confirm("Discard unsaved edits?")) return; setTab(k); setEdits({}) }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-current" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            style={tab === k ? { color: MAROON, borderColor: MAROON } : undefined}>{label}</button>
        ))}
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === "air" ? "🔍 Search origin / airline / fwd…" : "🔍 Search country / port…"}
        className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      <div className="bg-white rounded-xl border overflow-x-auto">
        {tab === "air" ? (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["COUNTRY", "ORIGIN", "DEST", "FWD", "A/L", "TT", ...AIR_BREAKS].map(h =>
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
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
                  {AIR_BREAKS.map(b => (
                    <td key={b} className="px-2 py-1 text-right">
                      {isAdmin
                        ? <input type="number" value={cellVal(r, b)} onChange={e => setCell(r.id, b, e.target.value)} className={cellInp} />
                        : (r.rates?.[b] != null ? fmt(r.rates[b]) : "-")}
                    </td>
                  ))}
                </tr>
              ))}
              {airRows.length === 0 && <tr><td colSpan={6 + AIR_BREAKS.length} className="px-3 py-10 text-center text-gray-400">No air rates {air.length === 0 && "— click Reload to load from file"}</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr>
              {["COUNTRY", "PORT", "40'GP (USD/CTR)", "20'GP (USD/CTR)", "LCL (USD/CBM)"].map(h =>
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {seaRows.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r._new ? "bg-amber-50" : edits[r.id] ? "bg-green-50" : ""}`}>
                  <td className="px-3 py-1.5 text-gray-600">{r.country}{r._new && <span className="ml-1 text-[9px] text-amber-700 font-bold">NEW</span>}</td>
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{r.port}</td>
                  {SEA_CT.map(c => (
                    <td key={c} className="px-2 py-1 text-right">
                      {isAdmin
                        ? <input type="number" value={cellVal(r, c)} onChange={e => setCell(r.id, c, e.target.value)} className={cellInp} />
                        : (r.rates?.[c] != null ? fmt(r.rates[c]) : "-")}
                    </td>
                  ))}
                </tr>
              ))}
              {seaRows.length === 0 && <tr><td colSpan={2 + SEA_CT.length} className="px-3 py-10 text-center text-gray-400">No sea rates {sea.length === 0 && "— click Reload to load from file"}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
