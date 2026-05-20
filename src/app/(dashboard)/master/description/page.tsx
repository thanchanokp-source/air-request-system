"use client"
import { useEffect, useState } from "react"

export default function MasterDescriptionPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: "", weightPerUnit: "" })
  const [newData, setNewData] = useState({ name: "", weightPerUnit: "" })
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetch("/api/master/description").then(r => r.json()).then(d => { setItems(d); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const startEdit = (item: any) => {
    setEditId(item.id)
    setEditData({ name: item.name, weightPerUnit: String(item.weightPerUnit) })
  }

  const saveEdit = async () => {
    setSaving(true)
    await fetch(`/api/master/description/${editId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editData, weightPerUnit: Number(editData.weightPerUnit) })
    })
    setSaving(false); setEditId(null); load()
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this description?")) return
    await fetch(`/api/master/description/${id}`, { method: "DELETE" })
    load()
  }

  const addItem = async () => {
    setSaving(true)
    await fetch("/api/master/description", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newData, weightPerUnit: Number(newData.weightPerUnit) })
    })
    setSaving(false); setAdding(false); setNewData({ name: "", weightPerUnit: "" }); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MASTER DESCRIPTION</h1>
          <p className="text-xs text-gray-400 mt-0.5">WT CHARGE/PC (KG) — ใช้คำนวณ Gross Weight</p>
        </div>
        <button onClick={() => setAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + ADD
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-blue-800">NEW DESCRIPTION</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">DESCRIPTION NAME</label>
              <input value={newData.name} onChange={e => setNewData(p => ({...p, name: e.target.value}))}
                placeholder="e.g. SHORTS, JACKET,Hoodie"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">WT CHARGE/PC (KG)</label>
              <input type="number" step="0.01" value={newData.weightPerUnit} onChange={e => setNewData(p => ({...p, weightPerUnit: e.target.value}))}
                placeholder="e.g. 0.28"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addItem} disabled={saving || !newData.name}
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
              {["DESCRIPTION","WT CHARGE/PC (KG)","ACTIONS"].map(h =>
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={3} className="text-center py-10 text-gray-400">Loading...</td></tr>}
            {!loading && items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                {editId === item.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input value={editData.name} onChange={e => setEditData(d => ({...d, name: e.target.value}))}
                        className="border rounded px-2 py-1 text-sm w-full" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" value={editData.weightPerUnit} onChange={e => setEditData(d => ({...d, weightPerUnit: e.target.value}))}
                        className="border rounded px-2 py-1 text-sm w-32" />
                    </td>
                    <td className="px-4 py-2 flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50">{saving ? "..." : "SAVE"}</button>
                      <button onClick={() => setEditId(null)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300">CANCEL</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-700">{item.weightPerUnit}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => startEdit(item)} className="text-xs text-blue-600 hover:underline">EDIT</button>
                      <button onClick={() => deleteItem(item.id)} className="text-xs text-red-500 hover:underline">DELETE</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={3} className="text-center py-10 text-gray-400">No descriptions — click + ADD to start</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">* ชื่อ Description ต้องตรงกับคอลัมน์ DESCRIPTION ใน Excel ที่ MER อัพโหลด</p>
    </div>
  )
}
