"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const canUse = isAdmin || roles.includes("LOGISTICS_IMPORT")
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // edits[itemId] = { invoiceNo, actualAir }
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "APPROVED" || r.status === "COMPLETED"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const raw = (it: any, k: string) => edits[it.id]?.[k] ?? (it[k] != null ? String(it[k]) : "")

  // Save the actual figures LG entered for this doc (Invoice No + Actual Air per line). Draft-save only —
  // it does not move the document's status.
  const save = async (rq: any) => {
    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({
        id: it.id,
        invoiceNo: raw(it, "invoiceNo") || null,
        actualAir: raw(it, "actualAir") === "" ? null : raw(it, "actualAir"),
      }))
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates }),
      })
      if (r.ok) { setEdits(p => { const n = { ...p }; rq.items.forEach((it: any) => delete n[it.id]); return n }); await load() }
      else alert("Error saving actual")
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Logistics Import / Admin only</p></div>

  const inp = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Logistics Document — Pull Material</h1>
        <p className="text-sm text-gray-500">เอกสารที่อนุมัติแล้ว (ต้องส่ง air) — LG กรอก <b>Actual</b> หลัง book/ได้ invoice จริง</p></div>

      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No approved documents yet</div> :
          reqs.map(rq => {
            const estTotal = rq.items.reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
            const actTotal = rq.items.reduce((s: number, i: any) => s + (raw(i, "actualAir") === "" ? 0 : Number(raw(i, "actualAir")) || 0), 0)
            const diff = actTotal - estTotal
            return (
              <div key={rq.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                    <span className="text-xs text-gray-500"> · {rq.requesterName} · {rq.items.length} items</span></div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Est {fmt(estTotal)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Actual {fmt(actTotal)}</span>
                    {actTotal > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diff > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))}
                      </span>
                    )}
                    <button onClick={() => save(rq)} disabled={busy === rq.id}
                      className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
                      {busy === rq.id ? "..." : "Save Actual"}
                    </button>
                  </div>
                </div>
                <div className="mt-3 border rounded-xl overflow-x-auto">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">SO</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Material</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 whitespace-nowrap">PULL</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 whitespace-nowrap">G.W.(kg)</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Country</th>
                      <th className="px-3 py-2 text-right font-medium text-blue-600 whitespace-nowrap">🔒 Est Air</th>
                      <th className="px-3 py-2 text-left font-medium text-green-700 whitespace-nowrap bg-green-50/60">Invoice No</th>
                      <th className="px-3 py-2 text-left font-medium text-green-700 whitespace-nowrap bg-green-50/60">Actual Air *</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {rq.items.map((it: any) => (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-semibold text-gray-800">{it.soNoDoc}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap max-w-[220px] truncate" title={it.itemName || it.itemCode}>{it.itemName || it.itemCode}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(it.grossWeightKg || it.weight)}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{it.country || "-"}</td>
                          <td className="px-3 py-1.5 text-right text-blue-700 font-medium">{fmt(it.airFreightCost)}</td>
                          <td className="px-3 py-1.5 bg-green-50/30"><input value={raw(it, "invoiceNo")} onChange={e => setVal(it.id, "invoiceNo", e.target.value)} placeholder="INV…" className={inp} /></td>
                          <td className="px-3 py-1.5 bg-green-50/30"><input type="number" value={raw(it, "actualAir")} onChange={e => setVal(it.id, "actualAir", e.target.value)} placeholder="0" className={inp} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">🟢 = ช่องที่ LG กรอก · Est Air = ค่าที่อนุมัติ (freeze) ไว้เทียบกับ Actual · กด Save Actual เพื่อบันทึก (draft — ยังไม่เปลี่ยนสถานะเอกสาร)</p>
              </div>
            )
          })}
    </div>
  )
}
