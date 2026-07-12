"use client"
import { useEffect, useState, useMemo, useRef } from "react"
import * as XLSX from "xlsx"

export default function MasterRatePage() {
  const [rates, setRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ brand: "", country: "", ratePerKg: "" })
  const [newData, setNewData] = useState({ brand: "", country: "", ratePerKg: "" })
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    fetch("/api/master/port").then(r => r.json()).then(d => { setRates(Array.isArray(d) ? d : []); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rates
    return rates.filter(r => `${r.brand} ${r.country}`.toLowerCase().includes(s))
  }, [rates, q])

  const startEdit = (p: any) => { setEditId(p.id); setEditData({ brand: p.brand, country: p.country, ratePerKg: String(p.ratePerKg) }) }

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
    setSaving(false); setAdding(false); setNewData({ brand: "", country: "", ratePerKg: "" }); load()
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
        brand: String(pick(r, ["brand", "customer"]) || "").trim(),
        country: String(pick(r, ["country"]) || "").trim(),
        ratePerKg: Number(String(pick(r, ["rate"]) || "0").replace(/[^0-9.]/g, "")) || 0,
      })).filter(r => r.brand && r.country)
      if (!rows.length) { alert("No valid rows found (need Brand, Country, Rate columns)"); setImporting(false); return }
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
          <p className="text-xs text-gray-400 mt-0.5">Air freight rate by Brand + Country (THB/KG) — Est. Air Freight = Gross Weight × Rate</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onImport} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50">
            {importing ? "Importing…" : "⬆ Import Excel"}
          </button>
          <button onClick={() => setAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ ADD</button>
        </div>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search brand or country…"
        className="w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-blue-800">NEW RATE</h3>
          <div className="grid grid-cols-3 gap-3">
            {([["brand","CUSTOMER / BRAND"],["country","COUNTRY"],["ratePerKg","RATE/KG (THB)"]] as [string,string][]).map(([k,l]) => (
              <div key={k}>
                <label className="text-xs text-gray-500">{l}</label>
                <input value={(newData as any)[k]} onChange={e => setNewData(p => ({...p,[k]:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addRate} disabled={saving || !newData.brand || !newData.country}
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
              {["CUSTOMER / BRAND","COUNTRY","RATE/KG (THB)","ACTIONS"].map(h =>
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={4} className="text-center py-10 text-gray-400">Loading...</td></tr>}
            {!loading && filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                {editId === p.id ? (
                  <>
                    <td className="px-4 py-2"><input value={editData.brand} onChange={e => setEditData(d => ({...d,brand:e.target.value}))} className="border rounded px-2 py-1 text-sm w-full" /></td>
                    <td className="px-4 py-2"><input value={editData.country} onChange={e => setEditData(d => ({...d,country:e.target.value}))} className="border rounded px-2 py-1 text-sm w-full" /></td>
                    <td className="px-4 py-2"><input type="number" step="0.01" value={editData.ratePerKg} onChange={e => setEditData(d => ({...d,ratePerKg:e.target.value}))} className="border rounded px-2 py-1 text-sm w-28" /></td>
                    <td className="px-4 py-2 flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50">{saving ? "..." : "SAVE"}</button>
                      <button onClick={() => setEditId(null)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300">CANCEL</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.brand}</td>
                    <td className="px-4 py-3 text-gray-700">{p.country}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{p.ratePerKg.toLocaleString()}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => startEdit(p)} className="text-xs text-blue-600 hover:underline">EDIT</button>
                      <button onClick={() => deleteRate(p.id)} className="text-xs text-red-500 hover:underline">DELETE</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400">{rates.length ? "No match" : "No rates — Import Excel or click + ADD"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">* Import accepts columns: CUSTOMER/BRAND · COUNTRY · RATE AIR FREIGHT. Re-importing updates existing brand+country rates.</p>
    </div>
  )
}
