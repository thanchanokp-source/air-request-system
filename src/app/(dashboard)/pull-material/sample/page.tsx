"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON } from "../_StageWork"

type Row = { id: string; brand?: string; supplier?: string; qty?: string; remark?: string; createdBy?: string; createdAt?: string }

export default function Page() {
  const { data: session, status: auth } = useSession()
  const me = String((session?.user as any)?.email || (session?.user as any)?.name || "")
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [nw, setNw] = useState({ brand: "", supplier: "", qty: "", remark: "" })
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({})
  const [busy, setBusy] = useState(false)

  const load = async () => { setLoading(true); try { const d = await fetch("/api/pull-material/samples").then(r => r.json()); setRows(d.rows || []) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!nw.brand.trim() && !nw.supplier.trim() && !nw.qty.trim() && !nw.remark.trim()) return
    setBusy(true)
    try { const r = await fetch("/api/pull-material/samples", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nw) }); if (r.ok) { setNw({ brand: "", supplier: "", qty: "", remark: "" }); await load() } else alert("Error") } finally { setBusy(false) }
  }
  const save = async (id: string) => {
    const e = edits[id]; if (!e) return
    setBusy(true)
    try { const r = await fetch("/api/pull-material/samples", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...e }) }); if (r.ok) { setEdits(p => { const n = { ...p }; delete n[id]; return n }); await load() } else alert("แก้ไขได้เฉพาะรายการที่คุณสร้าง") } finally { setBusy(false) }
  }
  const del = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return
    setBusy(true)
    try { const r = await fetch(`/api/pull-material/samples?id=${id}`, { method: "DELETE" }); if (r.ok) await load(); else alert("ลบได้เฉพาะรายการที่คุณสร้าง") } finally { setBusy(false) }
  }
  const val = (r: Row, k: keyof Row) => (edits[r.id]?.[k] ?? r[k] ?? "") as string
  const setVal = (r: Row, k: keyof Row, v: string) => setEdits(p => {
    const base = p[r.id] || { brand: r.brand, supplier: r.supplier, qty: r.qty, remark: r.remark }
    return { ...p, [r.id]: { ...base, [k]: v } }
  })
  const mine = (r: Row) => isAdmin || (!!me && r.createdBy === me)

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>

  const qq = q.trim().toLowerCase()
  const shown = qq ? rows.filter(r => `${r.brand} ${r.supplier} ${r.qty} ${r.remark}`.toLowerCase().includes(qq)) : rows
  const inp = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-200"

  return (
    <div className="p-5 max-w-[1000px] mx-auto space-y-4">
      <div><h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>SAMPLE</h1></div>

      {/* Add row */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">เพิ่มรายการ</p>
        <div className="grid sm:grid-cols-5 gap-2">
          <input value={nw.brand} onChange={e => setNw(p => ({ ...p, brand: e.target.value }))} placeholder="Brand" className={inp} />
          <input value={nw.supplier} onChange={e => setNw(p => ({ ...p, supplier: e.target.value }))} placeholder="Supplier" className={inp} />
          <input value={nw.qty} onChange={e => setNw(p => ({ ...p, qty: e.target.value }))} placeholder="Qty" className={inp} />
          <input value={nw.remark} onChange={e => setNw(p => ({ ...p, remark: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") add() }} placeholder="Remark" className={inp} />
          <button onClick={add} disabled={busy} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>+ เพิ่ม</button>
        </div>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหา brand / supplier / remark…" className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500"><tr>
            {["BRAND", "SUPPLIER", "QTY", "REMARK", "โดย", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr> :
              shown.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">ยังไม่มีข้อมูล</td></tr> :
                shown.map(r => {
                  const editable = mine(r)
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 ${edits[r.id] ? "bg-green-50" : ""}`}>
                      <td className="px-3 py-1.5"><input disabled={!editable} value={val(r, "brand")} onChange={e => setVal(r, "brand", e.target.value)} className={inp + (editable ? "" : " bg-gray-50 text-gray-500")} /></td>
                      <td className="px-3 py-1.5"><input disabled={!editable} value={val(r, "supplier")} onChange={e => setVal(r, "supplier", e.target.value)} className={inp + (editable ? "" : " bg-gray-50 text-gray-500")} /></td>
                      <td className="px-3 py-1.5"><input disabled={!editable} value={val(r, "qty")} onChange={e => setVal(r, "qty", e.target.value)} className={inp + (editable ? "" : " bg-gray-50 text-gray-500")} /></td>
                      <td className="px-3 py-1.5"><input disabled={!editable} value={val(r, "remark")} onChange={e => setVal(r, "remark", e.target.value)} className={inp + (editable ? "" : " bg-gray-50 text-gray-500")} /></td>
                      <td className="px-3 py-1.5 text-xs text-gray-400 whitespace-nowrap">{r.createdBy || "-"}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right">
                        {editable && edits[r.id] && <button onClick={() => save(r.id)} disabled={busy} className="px-3 py-1 rounded-lg text-white text-xs font-semibold bg-green-600 mr-1 disabled:opacity-50">💾 Save</button>}
                        {editable && <button onClick={() => del(r.id)} disabled={busy} className="text-gray-300 hover:text-red-500 px-2">✕</button>}
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
