"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"

// Air weight breaks (kg minimums) → the Q column key used for the rate.
const BREAK_ORDER = [45, 100, 250, 300, 500, 1000, 2000, 8000]
const breakKey = (w: any) => { const W = Number(w) || 0; let b = 45; for (const x of BREAK_ORDER) if (x <= W) b = x; return "Q" + b }

export default function LogisticsPage() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const canUse = isAdmin || roles.includes("LOGISTICS_IMPORT")
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [airRates, setAirRates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "PENDING_LOGISTICS"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line
  useEffect(() => { fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setAirRates(d.rows || [])).catch(() => {}) }, [])

  // Estimate Air freight = gross × rate(port) + origin cost by incoterm.
  //   base = gross × rate  (gross = per-unit weight × pull qty, also picks the Q-break tier)
  //   EX-WORK → + Orig Cost (EXW) · FCA → + Orig Cost (FCA) · other incoterms → + 0
  const airEst = (it: any) => {
    const w = Number(it.weight) || 0                    // chargeable weight (kg), used DIRECTLY (no ×qty)
    const routes = airRates.filter(r => r.origin === it.port)
    if (!it.port || !w || !routes.length) return null
    const bk = breakKey(w)                              // 150kg → Q100
    const cand = routes.map(r => ({ rate: Number(r.rates?.[bk]), exw: Number(r.origCostExw) || 0, fca: Number(r.origCostFca) || 0 })).filter(x => x.rate && !isNaN(x.rate))
    if (!cand.length) return null
    const best = cand.reduce((a, b) => (b.rate > a.rate ? b : a)) // same port → max rate
    const inc = String(it.incoterm || "").toUpperCase()
    const add = inc === "EX-WORK" ? best.exw : inc === "FCA" ? best.fca : 0
    return { bk, rate: best.rate, gross: w, add, est: Math.round((best.rate * w + add) * 100) / 100 }
  }

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const raw = (it: any, k: string, fb = "") => edits[it.id]?.[k] ?? (it[k] != null ? String(it[k]) : fb)

  const save = async (rq: any) => {
    for (const it of rq.items) {
      if (!airEst(it)) return alert(`No air rate for air port "${it.port}" at this weight (SO ${it.soNoDoc}). Check the Air Port / weight.`)
    }
    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({
        id: it.id,
        airFreightCost: airEst(it)?.est ?? null,
        seaFreightCost: raw(it, "seaFreightCost") || null,
        incotermCost: raw(it, "incotermCost") || null,
        leadTimeAir: raw(it, "leadTimeAir"),
        leadTimeSea: raw(it, "leadTimeSea"),
      }))
      // Branch by origin: SCM request → SCM confirms air next; PC request → PC decides air next.
      const nextStatus = rq.requestType === "PURCHASING" ? "PENDING_PC_DECISION" : "PENDING_SCM_DECISION"
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates, status: nextStatus }),
      })
      if (r.ok) { setEdits({}); setOpenId(null); await load() } else alert("Error")
    } finally { setBusy(null) }
  }

  // Export the open doc → styled workbook. GREY columns = reference data Purchase already filled
  // (Country/Port/Incoterm/Weight + auto Estimate Air); GREEN columns = the fields LG fills in.
  const exportXlsx = async () => {
    if (!openReq) return
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Logistics")
    const headers = [
      "SO", "PO No", "Customer", "Style", "Material", "PULL", "Country", "Air Port", "Sea Port",
      "Incoterm", "Weight(kg)", "Need Date", "Cartons", "Est Air(USD)",
      "Air L/T", "Sea L/T", "Incoterm Cost", "Sea Freight", "_ItemID",
    ]
    const widths = [12, 14, 18, 14, 26, 10, 18, 16, 18, 11, 11, 13, 9, 13, 12, 12, 13, 12, 26]
    const REF_C = "FFEAECEE", FILL_C = "FFE2EFDA" // grey (from Purchase) / green (LG fills)
    const FILL_FROM = 14 // 0-based index where the green (fill-in) block starts (Air L/T)
    const FILL_TO = 17   // .. ends (Sea Freight)
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
    openReq.items.forEach((it: any) => {
      const e = airEst(it)
      ws.addRow([
        it.soNoDoc, it.poNoDoc || "", it.customerName || "", it.style || "", it.itemName || it.itemCode || "",
        it.pullMaterialQty ?? "", it.country || "", it.port || "", it.seaPort || "",
        it.incoterm || "", it.weight ?? "", it.needDate ? String(it.needDate).slice(0, 10) : "", it.cartons ?? "", e ? e.est : "",
        raw(it, "leadTimeAir"), raw(it, "leadTimeSea"), raw(it, "incotermCost"), raw(it, "seaFreightCost"), it.id,
      ])
    })
    ws.getColumn(headers.length).hidden = true // _ItemID
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `${openReq.documentNo}_logistics.xlsx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // Import the filled workbook → populate the LG fields (edits) by _ItemID; user reviews then Saves.
  const importXlsx = async (file: File) => {
    const XLSX = await import("xlsx")
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
    const ws = wb.Sheets["Logistics"] || wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
    const pick = (row: any, ...keys: string[]) => { for (const k of keys) if (row[k] !== undefined && row[k] !== "") return String(row[k]).trim(); return "" }
    const next: Record<string, Record<string, string>> = {}
    let applied = 0
    for (const row of rows) {
      const id = pick(row, "_ItemID")
      if (!id) continue
      next[id] = {
        leadTimeAir: pick(row, "Air L/T"),
        leadTimeSea: pick(row, "Sea L/T"),
        incotermCost: pick(row, "Incoterm Cost"),
        seaFreightCost: pick(row, "Sea Freight"),
      }
      applied++
    }
    setEdits(p => ({ ...p, ...next }))
    alert(`Imported ${applied} row(s). Estimate Air stays auto-calculated. Review, then click "Save → Send to SCM".`)
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Logistics Import / Admin only</p></div>

  const cinp = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
  const cinpN = cinp + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  const openReq = reqs.find(r => r.id === openId)

  return (
    <div className="p-5 max-w-[1500px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Logistics — Pull Material</h1>
        <p className="text-sm text-gray-500">Est Air คำนวณอัตโนมัติจาก Port + weight (Rate_LG) · LG กรอก Air/Sea L/T + cost → ส่งต่อ SCM</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        openReq ? (
          /* ── Document detail — vertical form per item ── */
          <div className="space-y-4">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-500 hover:text-gray-700">← Back to list</button>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div><span className="font-bold text-blue-700 text-lg">{openReq.documentNo}</span>
                <span className="text-xs text-gray-500"> · {openReq.requesterName} · {openReq.items.length} items</span></div>
              <div className="flex items-center gap-2">
                <button onClick={exportXlsx}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50">⬇ Export Excel</button>
                <label className="px-3 py-2 rounded-lg text-sm font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 cursor-pointer">⬆ Import
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importXlsx(f) }} />
                </label>
                <button onClick={() => save(openReq)} disabled={busy === openReq.id} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
                  {busy === openReq.id ? "..." : "Save → Send to SCM"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300" /> ข้อมูลจาก Purchase</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 border border-sky-300" /> 🔒 Est Air (auto)</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> LG กรอก</span>
            </div>

            {/* Excel-like horizontal rows */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="text-sm border-collapse min-w-[1500px] w-full">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
                    <th className="px-2 py-2 text-left font-semibold sticky left-0 bg-gray-100 z-10 border-b border-gray-200">SO</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Material</th>
                    <th className="px-2 py-2 text-right font-semibold bg-gray-100 border-b border-gray-200">PULL</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Country</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Air Port</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Sea Port</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Incoterm</th>
                    <th className="px-2 py-2 text-right font-semibold bg-gray-100 border-b border-gray-200">Weight</th>
                    <th className="px-2 py-2 text-right font-semibold bg-gray-100 border-b border-gray-200">Cons.</th>
                    <th className="px-2 py-2 text-left font-semibold bg-gray-100 border-b border-gray-200">Need Date</th>
                    <th className="px-2 py-2 text-right font-semibold bg-gray-100 border-b border-gray-200">Cartons</th>
                    <th className="px-2 py-2 text-right font-semibold bg-sky-50 border-b border-sky-200 text-sky-700">🔒 Est Air</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Air L/T</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Sea L/T</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Incoterm Cost</th>
                    <th className="px-2 py-2 text-left font-semibold bg-emerald-50 border-b border-emerald-200">Sea Freight</th>
                  </tr>
                </thead>
                <tbody>
                  {openReq.items.map((it: any, idx: number) => {
                    const e = airEst(it)
                    const rowBg = idx % 2 ? "bg-gray-50/40" : "bg-white"
                    return [
                      <tr key={it.id} className={`${rowBg} align-top border-b border-gray-100`}>
                        <td className={`px-2 py-1.5 sticky left-0 z-10 ${rowBg}`}>
                          <span className="text-[11px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: MAROON }}>{it.soNoDoc}</span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[200px] truncate" title={it.itemName || it.itemCode || ""}>{it.itemName || it.itemCode || "-"}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700 whitespace-nowrap">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{it.country || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{it.port || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{it.seaPort || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{it.incoterm || "-"}</td>
                        <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">{fmt(it.weight)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">{fmt(it.consumption)}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{fmtDate(it.needDate)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">{fmt(it.cartons)}</td>
                        <td className="px-2 py-1.5 text-right bg-sky-50/40 whitespace-nowrap">
                          {e ? <span className="font-bold text-sky-800" title={`rate ${e.rate} (${e.bk}) × ${fmt(e.gross)} kg${e.add ? ` + ${String(it.incoterm).toUpperCase() === "FCA" ? "FCA" : "EXW"} ${fmt(e.add)}` : ""}`}>{fmt(e.est)}</span>
                            : <span className="text-[11px] text-amber-600" title={`No air rate for "${it.port || "-"}" at this weight`}>⚠ no rate</span>}
                        </td>
                        <td className="px-2 py-1.5 min-w-[110px]"><input value={raw(it, "leadTimeAir")} onChange={ev => setVal(it.id, "leadTimeAir", ev.target.value)} placeholder="3 days" className={cinp} /></td>
                        <td className="px-2 py-1.5 min-w-[110px]"><input value={raw(it, "leadTimeSea")} onChange={ev => setVal(it.id, "leadTimeSea", ev.target.value)} placeholder="30 days" className={cinp} /></td>
                        <td className="px-2 py-1.5 min-w-[100px]"><input type="number" value={raw(it, "incotermCost")} onChange={ev => setVal(it.id, "incotermCost", ev.target.value)} placeholder="0" className={cinpN} /></td>
                        <td className="px-2 py-1.5 min-w-[100px]"><input type="number" value={raw(it, "seaFreightCost")} onChange={ev => setVal(it.id, "seaFreightCost", ev.target.value)} placeholder="0" className={cinpN} /></td>
                      </tr>,
                      it.pickupAddress && (
                        <tr key={`${it.id}-addr`} className={rowBg}>
                          <td className={`px-2 pb-2 sticky left-0 z-10 ${rowBg}`} />
                          <td colSpan={15} className="px-2 pb-2">
                            <span className="text-[11px] font-semibold text-amber-700">📍 {it.incoterm} Pickup address:</span> <span className="text-xs text-gray-700">{it.pickupAddress}</span>
                          </td>
                        </tr>
                      ),
                    ]
                  }).flat().filter(Boolean)}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── List of documents ── */
          reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No documents at this stage</div> :
            <div className="bg-white rounded-xl border overflow-hidden divide-y divide-gray-100">
              {reqs.map(rq => {
                const ports = [...new Set(rq.items.map((i: any) => i.port).filter(Boolean))].join(", ")
                return (
                  <button key={rq.id} onClick={() => setOpenId(rq.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 text-left">
                    <div>
                      <div className="font-semibold text-blue-700">{rq.documentNo}</div>
                      <div className="text-xs text-gray-400">{rq.requesterName} · {rq.items.length} items · Port: {ports || "-"}</div>
                    </div>
                    <span className="text-gray-300">›</span>
                  </button>
                )
              })}
            </div>
        )}
    </div>
  )
}
