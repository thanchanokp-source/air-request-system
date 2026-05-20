"use client"
import { useEffect, useState } from "react"

export default function MasterPortPage() {
  const [ports, setPorts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ country: "", port: "", ratePerKg: "" })
  const [newData, setNewData] = useState({ country: "", port: "", ratePerKg: "" })
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetch("/api/master/port").then(r => r.json()).then(d => { setPorts(d); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const startEdit = (p: any) => {
    setEditId(p.id)
    setEditData({ country: p.country, port: p.port, ratePerKg: String(p.ratePerKg) })
  }

  const saveEdit = async () => {
    setSaving(true)
    await fetch(`/api/master/port/${editId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editData, ratePerKg: Number(editData.ratePerKg) })
    })
    setSaving(false); setEditId(null); load()
  }

  const deletePort = async (id: string) => {
    if (!confirm("Delete this port rate?")) return
    await fetch(`/api/master/port/${id}`, { method: "DELETE" })
    load()
  }

  const addPort = async () => {
    setSaving(true)
    await fetch("/api/master/port", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newData, ratePerKg: Number(newData.ratePerKg) })
    })
    setSaving(false); setAdding(false); setNewData({ country: "", port: "", ratePerKg: "" }); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">MASTER PORT RATE</h1>
        <button onClick={() => setAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + ADD PORT
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-blue-800">NEW PORT RATE</h3>
          <div className="grid grid-cols-3 gap-3">
            {([["country","COUNTRY"],["port","AIR PORT"],["ratePerKg","RATE/KG (THB)"]] as [string,string][]).map(([k,l]) => (
              <div key={k}>
                <label className="text-xs text-gray-500">{l}</label>
                <input value={(newData as any)[k]} onChange={e => setNewData(p => ({...p,[k]:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addPort} disabled={saving || !newData.country || !newData.port}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "..." : "SAVE"}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
              CANCEL
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["COUNTRY","AIR PORT","RATE/KG (THB)","LAST UPDATED","ACTIONS"].map(h =>
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading...</td></tr>}
            {!loading && ports.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                {editId === p.id ? (
                  <>
                    <td className="px-4 py-2"><input value={editData.country} onChange={e => setEditData(d => ({...d,country:e.target.value}))} className="border rounded px-2 py-1 text-sm w-full" /></td>
                    <td className="px-4 py-2"><input value={editData.port} onChange={e => setEditData(d => ({...d,port:e.target.value}))} className="border rounded px-2 py-1 text-sm w-full" /></td>
                    <td className="px-4 py-2"><input type="number" value={editData.ratePerKg} onChange={e => setEditData(d => ({...d,ratePerKg:e.target.value}))} className="border rounded px-2 py-1 text-sm w-32" /></td>
                    <td className="px-4 py-2 text-gray-400">-</td>
                    <td className="px-4 py-2 flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50">{saving ? "..." : "SAVE"}</button>
                      <button onClick={() => setEditId(null)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300">CANCEL</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-gray-700">{p.country}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.port}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{p.ratePerKg.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.updatedAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => startEdit(p)} className="text-xs text-blue-600 hover:underline">EDIT</button>
                      <button onClick={() => deletePort(p.id)} className="text-xs text-red-500 hover:underline">DELETE</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!loading && ports.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">No port rates — click + ADD PORT to start</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">* Rate ที่บันทึกจะถูก snapshot ตอน submit request — การแก้ไขไม่กระทบ request เดิม</p>
    </div>
  )
}
