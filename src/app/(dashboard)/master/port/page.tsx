"use client"
import { useEffect, useState, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"
import { canEditMaster } from "@/lib/master-access"

export default function MasterRatePage() {
  const { data: session } = useSession()
  const canEdit = canEditMaster(session?.user)   // Admin/Logistics + granted emails; MER = read-only
  const [rates, setRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ country: "", ratePerKg: "", bu: "ALL", currency: "THB" })
  const [newData, setNewData] = useState({ country: "", ratePerKg: "", bu: "ALL", currency: "THB" })
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  // FX rates (EA currency conversion) — 1 USD = ? THB / ? VND.
  const [fx, setFx] = useState({ thbPerUsd: "", vndPerUsd: "" })
  const [fxSaving, setFxSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    fetch("/api/master/port").then(r => r.json()).then(d => { setRates(Array.isArray(d) ? d : []); setLoading(false) })
  }
  useEffect(() => {
    load()
    fetch("/api/master/fx").then(r => r.json()).then(d => setFx({ thbPerUsd: d.thbPerUsd ? String(d.thbPerUsd) : "", vndPerUsd: d.vndPerUsd ? String(d.vndPerUsd) : "" })).catch(() => {})
  }, [])
  const saveFx = async () => {
    setFxSaving(true)
    await fetch("/api/master/fx", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thbPerUsd: Number(fx.thbPerUsd) || 0, vndPerUsd: Number(fx.vndPerUsd) || 0 }) })
    setFxSaving(false); load()
  }
  const vndPerThb = (Number(fx.vndPerUsd) || 0) > 0 && (Number(fx.thbPerUsd) || 0) > 0 ? (Number(fx.vndPerUsd) / Number(fx.thbPerUsd)) : 0
  // Effective THB/kg for a rate row (USD rows convert via FX); + VND for reference.
  const asThb = (r: any) => r.currency === "USD" ? (r.ratePerKg || 0) * (Number(fx.thbPerUsd) || 0) : (r.ratePerKg || 0)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rates
    return rates.filter(r => `${r.country}`.toLowerCase().includes(s))
  }, [rates, q])

  const startEdit = (p: any) => { setEditId(p.id); setEditData({ country: p.country, ratePerKg: String(p.ratePerKg), bu: p.bu || "ALL", currency: p.currency || "THB" }) }

  const saveEdit = async () => {
    setSaving(true)
    await fetch(`/api/master/port/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editData, ratePerKg: Number(editData.ratePerKg) }) })
    setSaving(false); setEditId(null); load()
  }
  const deleteRate = async (id: string) => {
    if (!confirm("Delete this rate?")) return
    await fetch(`/api/master/port/${id}`, { method: "DELETE" }); load()
  }
  const addRate = async () => {
    setSaving(true)
    await fetch("/api/master/port", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newData, ratePerKg: Number(newData.ratePerKg) }) })
    setSaving(false); setAdding(false); setNewData({ country: "", ratePerKg: "", bu: "ALL", currency: "THB" }); load()
  }
  // Inline per-row USD entry: typing a USD rate + Enter/blur stores the row as a USD rate (auto → THB/VND).
  const saveUsd = async (p: any, raw: string) => {
    const val = String(raw).trim()
    const cur = p.currency === "USD" ? String(p.ratePerKg) : ""
    if (val === cur || val === "") return
    const n = Number(val); if (isNaN(n)) return
    await fetch(`/api/master/port/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: p.country, bu: p.bu || "ALL", ratePerKg: n, currency: "USD" }) })
    load()
  }

  // Import from the Rate-Country Excel (columns: CUSTOMER/BRAND · COUNTRY · RATE AIR FREIGHT).
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImporting(true)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" })
      const pick = (row: any, keys: string[]) => {
        const k = Object.keys(row).find(k => keys.some(x => k.toLowerCase().includes(x)))
        return k ? row[k] : ""
      }
      const rows = raw.map(r => ({
        country: String(pick(r, ["country"]) || "").trim(),
        ratePerKg: Number(String(pick(r, ["rate"]) || "0").replace(/[^0-9.]/g, "")) || 0,
      })).filter(r => r.country)
      if (!rows.length) { alert("No valid rows found (need Country, Rate columns)"); setImporting(false); return }
      const res = await fetch("/api/master/port", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) })
      const d = await res.json()
      alert(`Imported ${d.saved ?? 0} / ${d.total ?? rows.length} rows`)
      load()
    } catch (err: any) {
      alert("Import failed: " + (err?.message || err))
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MASTER RATE</h1>
          <p className="text-xs text-gray-400 mt-0.5">Air freight rate by Country (THB/KG) — Est. Air Freight = Gross Weight × Rate</p>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onImport} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50">
              {importing ? "Importing…" : "⬆ Import Excel"}
            </button>
            <button onClick={() => setAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ ADD</button>
          </div>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full font-medium">👁 Read only</span>
        )}
      </div>

      {/* FX rates — EA quotes freight in USD; these convert USD→THB (calc) and drive the VND display toggle. */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-indigo-800">💱 อัตราแลกเปลี่ยน (USD) — สำหรับ EA</h3>
          {vndPerThb > 0 && <span className="text-xs text-indigo-500">1 THB ≈ {vndPerThb.toLocaleString(undefined, { maximumFractionDigits: 2 })} VND</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs text-gray-500">1 USD = ? THB</label>
            <input type="number" step="0.0001" value={fx.thbPerUsd} onChange={e => setFx(p => ({ ...p, thbPerUsd: e.target.value }))} disabled={!canEdit}
              className="block w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
          <div><label className="text-xs text-gray-500">1 USD = ? VND</label>
            <input type="number" step="0.0001" value={fx.vndPerUsd} onChange={e => setFx(p => ({ ...p, vndPerUsd: e.target.value }))} disabled={!canEdit}
              className="block w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
          {canEdit && <button onClick={saveFx} disabled={fxSaving} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{fxSaving ? "..." : "SAVE FX"}</button>}
        </div>
        <p className="text-[11px] text-indigo-400">เปลี่ยน FX แล้วเอกสาร EA ที่ทำเสร็จไม่เปลี่ยน (snapshot ตอนสร้าง) — มีผลกับเอกสาร/rate ที่คำนวณใหม่เท่านั้น</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search country…"
        className="w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-blue-800">NEW RATE</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500">COUNTRY</label>
              <input value={newData.country} onChange={e => setNewData(p => ({ ...p, country: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">BU</label>
              <select value={newData.bu} onChange={e => setNewData(p => ({ ...p, bu: e.target.value, currency: e.target.value === "EA" ? "USD" : "THB" }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1">
                <option value="ALL">ALL (shared)</option>
                <option value="NYG">NYG</option><option value="GW">GW</option><option value="EA">EA</option><option value="TRM">TRM</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">CURRENCY</label>
              <select value={newData.currency} onChange={e => setNewData(p => ({ ...p, currency: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1">
                <option value="THB">THB</option><option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">RATE/KG ({newData.currency})</label>
              <input type="number" step="0.0001" value={newData.ratePerKg} onChange={e => setNewData(p => ({ ...p, ratePerKg: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRate} disabled={saving || !newData.country}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? "..." : "SAVE"}</button>
            <button onClick={() => setAdding(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">CANCEL</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-400">{filtered.length} of {rates.length} rates</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["COUNTRY","BU","RATE/KG","USD/KG","= THB","≈ VND",...(canEdit ? ["ACTIONS"] : [])].map(h =>
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={canEdit ? 7 : 6} className="text-center py-10 text-gray-400">Loading...</td></tr>}
            {!loading && filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                {canEdit && editId === p.id ? (
                  <>
                    <td className="px-4 py-2"><input value={editData.country} onChange={e => setEditData(d => ({...d,country:e.target.value}))} className="border rounded px-2 py-1 text-sm w-full" /></td>
                    <td className="px-4 py-2"><select value={editData.bu} onChange={e => setEditData(d => ({...d,bu:e.target.value}))} className="border rounded px-2 py-1 text-sm"><option value="ALL">ALL</option><option value="NYG">NYG</option><option value="GW">GW</option><option value="EA">EA</option><option value="TRM">TRM</option></select></td>
                    <td className="px-4 py-2 flex items-center gap-1">
                      <input type="number" step="0.0001" value={editData.ratePerKg} onChange={e => setEditData(d => ({...d,ratePerKg:e.target.value}))} className="border rounded px-2 py-1 text-sm w-24" />
                      <select value={editData.currency} onChange={e => setEditData(d => ({...d,currency:e.target.value}))} className="border rounded px-1 py-1 text-xs"><option value="THB">THB</option><option value="USD">USD</option></select>
                    </td>
                    <td className="px-4 py-2 text-gray-400" colSpan={3}>—</td>
                    <td className="px-4 py-2 flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50">{saving ? "..." : "SAVE"}</button>
                      <button onClick={() => setEditId(null)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300">CANCEL</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.country}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.bu === "ALL" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"}`}>{p.bu || "ALL"}</span></td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{(p.ratePerKg || 0).toLocaleString()} <span className="text-xs text-gray-400">{p.currency || "THB"}</span></td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <input type="number" step="0.0001" defaultValue={p.currency === "USD" ? p.ratePerKg : ""} placeholder="USD"
                          onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }}
                          onBlur={e => saveUsd(p, e.currentTarget.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-24 focus:ring-1 focus:ring-indigo-400 focus:outline-none" />
                      ) : (p.currency === "USD" ? (p.ratePerKg || 0).toLocaleString() : "—")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.currency === "USD" ? asThb(p).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{vndPerThb > 0 ? (asThb(p) * vndPerThb).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</td>
                    {canEdit && (
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => startEdit(p)} className="text-xs text-blue-600 hover:underline">EDIT</button>
                        <button onClick={() => deleteRate(p.id)} className="text-xs text-red-500 hover:underline">DELETE</button>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={canEdit ? 7 : 6} className="text-center py-10 text-gray-400">{rates.length ? "No match" : (canEdit ? "No rates — Import Excel or click + ADD" : "No rates yet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">* Import accepts columns: COUNTRY · RATE AIR FREIGHT. Re-importing updates the existing country rate (last one wins).</p>
    </div>
  )
}
