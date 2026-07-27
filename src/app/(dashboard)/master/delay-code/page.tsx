"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { canEditDelayCode } from "@/lib/master-access"

export default function MasterDelayCodePage() {
  const { data: session } = useSession()
  const canEdit = canEditDelayCode(session?.user)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ code: "", definitions: "" })
  const [adding, setAdding] = useState(false)
  const [newData, setNewData] = useState({ code: "", definitions: "" })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetch("/api/master/delay-code").then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const startEdit = (it: any) => { setEditId(it.id); setEditData({ code: it.code, definitions: (it.definitions || []).join("\n") }) }
  const saveEdit = async () => {
    setSaving(true)
    const res = await fetch(`/api/master/delay-code/${editId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: editData.code, definitions: editData.definitions }),
    })
    setSaving(false)
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Save failed"); return }
    setEditId(null); load()
  }
  const del = async (id: string) => {
    if (!confirm("Delete this delay code?")) return
    const res = await fetch(`/api/master/delay-code/${id}`, { method: "DELETE" })
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Delete failed"); return }
    load()
  }
  const add = async () => {
    setSaving(true)
    const res = await fetch("/api/master/delay-code", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newData.code, definitions: newData.definitions }),
    })
    setSaving(false)
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Add failed"); return }
    setAdding(false); setNewData({ code: "", definitions: "" }); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MASTER DELAY CODE</h1>
          <p className="text-xs text-gray-400 mt-0.5">SCM delay reasons — code + detail definitions (dropdown source for claim assignment)</p>
        </div>
        {canEdit
          ? <button onClick={() => setAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ ADD</button>
          : <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full font-medium">👁 Read only</span>}
      </div>

      {canEdit && adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-blue-800">NEW DELAY CODE</h3>
          <div>
            <label className="text-xs text-gray-500">CODE</label>
            <input value={newData.code} onChange={e => setNewData(p => ({ ...p, code: e.target.value }))}
              placeholder="e.g. 2C_Buy Not Ready" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-500">DETAIL DEFINITIONS (one per line)</label>
            <textarea value={newData.definitions} onChange={e => setNewData(p => ({ ...p, definitions: e.target.value }))}
              rows={4} placeholder={"2.1 Fabric approval, trim approval\n2.2 Fabric lab dip, ..."} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1 font-mono" />
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={saving || !newData.code} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? "..." : "SAVE"}</button>
            <button onClick={() => setAdding(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">CANCEL</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{["CODE", "DETAIL DEFINITIONS", ...(canEdit ? ["ACTIONS"] : [])].map(h =>
              <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {loading && <tr><td colSpan={canEdit ? 3 : 2} className="text-center py-10 text-gray-400">Loading...</td></tr>}
            {!loading && items.map(it => (
              <tr key={it.id} className="hover:bg-gray-50">
                {canEdit && editId === it.id ? (
                  <>
                    <td className="px-4 py-2"><input value={editData.code} onChange={e => setEditData(d => ({ ...d, code: e.target.value }))} className="border rounded px-2 py-1 text-sm w-full" /></td>
                    <td className="px-4 py-2"><textarea value={editData.definitions} onChange={e => setEditData(d => ({ ...d, definitions: e.target.value }))} rows={4} className="border rounded px-2 py-1 text-xs w-full font-mono" /></td>
                    <td className="px-4 py-2 flex gap-2"><button onClick={saveEdit} disabled={saving} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50">{saving ? "..." : "SAVE"}</button><button onClick={() => setEditId(null)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300">CANCEL</button></td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{it.code}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{(it.definitions || []).map((d: string, i: number) => <div key={i}>{d}</div>)}</td>
                    {canEdit && <td className="px-4 py-3 flex gap-2"><button onClick={() => startEdit(it)} className="text-xs text-blue-600 hover:underline">EDIT</button><button onClick={() => del(it.id)} className="text-xs text-red-500 hover:underline">DELETE</button></td>}
                  </>
                )}
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={canEdit ? 3 : 2} className="text-center py-10 text-gray-400">No delay codes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
