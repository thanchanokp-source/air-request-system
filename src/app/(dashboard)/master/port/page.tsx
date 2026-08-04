"use client"
import { useEffect, useState, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"
import { canEditMaster } from "@/lib/master-access"

// Two separate rates per country: THB/KG (NYG / GW / TRM) and USD/KG (EA). Est. Air Freight =
// Gross Weight × the rate of the document's BU (EA → USD, everyone else → THB).
export default function MasterRatePage() {
  const { data: session } = useSession()
  const canEdit = canEditMaster(session?.user)   // Admin/Logistics + granted emails; MER = read-only
  const [rates, setRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [newData, setNewData] = useState({ country: "", ratePerKg: "", rateUsd: "", bu: "ALL" })
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
    return rates.filter(r => `${r.country}`.toLowerCase().includes(s))
  }, [rates, q])

  const deleteRate = async (id: string) => {
    if (!confirm("Delete this rate?")) return
    await fetch(`/api/master/port/${id}`, { method: "DELETE" }); load()
  }
  const addRate = async () => {
    setSaving(true)
    await fetch("/api/master/port", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: newData.country, bu: newData.bu, ratePerKg: Number(newData.ratePerKg) || 0, rateUsd: Number(newData.rateUsd) || 0 }) })
    setSaving(false); setAdding(false); setNewData({ country: "", ratePerKg: "", rateUsd: "", bu: "ALL" }); load()
  }
  // Inline per-row edit: change one field (THB or USD) while preserving the other.
  const saveField = async (p: any, patch: any, raw: string) => {
    const key = Object.keys(patch)[0]
    const cur = String(p[key] ?? "")
    const val = String(raw).trim()
    if (val === cur || (val === "" && (cur === "0" || cur === ""))) return
    setSaving(true)
    await fetch(`/api/master/port/${p.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: p.country, bu: p.bu || "ALL", ratePerKg: p.ratePerKg || 0, rateUsd: p.rateUsd || 0, ...patch }),
    })
    setSaving(false); load()
  }

  // Import from the Rate-Country Excel (columns: COUNTRY · RATE AIR FREIGHT → shared THB rate).
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
          <p className="text-xs text-gray-400 mt-0.5">Air freight rate by Country — <b>THB/KG</b> (NYG / GW / TRM) · <b>USD/KG</b> (EA). Est. Air Freight = Gross Weight × Rate</p>
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
              <select value={newData.bu} onChange={e => setNewData(p => ({ ...p, bu: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1">
                <option value="ALL">ALL (shared)</option>
                <option value="NYG">NYG</option><option value="GW">GW</option><option value="EA">EA</option><option value="TRM">TRM</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">THB/KG</label>
              <input type="number" step="0.0001" value={newData.ratePerKg} onChange={e => setNewData(p => ({ ...p, ratePerKg: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">USD/KG <span className="text-gray-400">(EA)</span></label>
              <input type="number" step="0.0001" value={newData.rateUsd} onChange={e => setNewData(p => ({ ...p, rateUsd: e.target.value }))}
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
        <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-400">{filtered.length} of {rates.length} rates {canEdit && <span className="text-gray-300">· type in a cell and press Enter / click away to save</span>}</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["COUNTRY", "BU", "THB/KG", "USD/KG (EA)", ...(canEdit ? ["ACTIONS"] : [])].map(h =>
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-10 text-gray-400">Loading...</td></tr>}
            {!loading && filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.country}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.bu === "ALL" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"}`}>{p.bu || "ALL"}</span></td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <input type="number" step="0.0001" defaultValue={p.ratePerKg || ""} placeholder="THB"
                      onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }}
                      onBlur={e => saveField(p, { ratePerKg: Number(e.currentTarget.value) || 0 }, e.currentTarget.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                  ) : (p.ratePerKg ? `${(p.ratePerKg).toLocaleString()} THB` : "—")}
                </td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <input type="number" step="0.0001" defaultValue={p.rateUsd || ""} placeholder="USD"
                      onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }}
                      onBlur={e => saveField(p, { rateUsd: Number(e.currentTarget.value) || 0 }, e.currentTarget.value)}
                      className="border border-indigo-300 rounded px-2 py-1 text-sm w-28 bg-indigo-50/40 focus:ring-1 focus:ring-indigo-400 focus:outline-none" />
                  ) : (p.rateUsd ? `${(p.rateUsd).toLocaleString()} USD` : "—")}
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <button onClick={() => deleteRate(p.id)} className="text-xs text-red-500 hover:underline">DELETE</button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-10 text-gray-400">{rates.length ? "No match" : (canEdit ? "No rates — Import Excel or click + ADD" : "No rates yet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">* Import accepts columns: COUNTRY · RATE AIR FREIGHT (saved as the shared THB rate). Re-importing updates the existing country rate.</p>
    </div>
  )
}
