"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate } from "../_StageWork"

const INCOTERMS = ["FOB", "CIF", "EX-WORK"]

export default function PurchasePage() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "PENDING_PURCHASING"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line

  // Country list from the freight-rate master (used later by LG for the rate).
  useEffect(() => {
    fetch("/api/master/port").then(r => r.json()).then((rows: any[]) => {
      const list = Array.from(new Set((rows || []).map(r => r.country).filter(Boolean))).sort()
      setCountries(list)
    }).catch(() => {})
  }, [])

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const valOf = (it: any, k: string) => {
    if (edits[it.id]?.[k] !== undefined) return edits[it.id][k]
    if (it[k] == null) return ""
    return (k === "shipmentDate") ? String(it[k]).slice(0, 10) : String(it[k])
  }

  const save = async (rq: any) => {
    for (const it of rq.items) {
      if (!valOf(it, "country")) return alert("Select a Country for every line.")
      if (!valOf(it, "incoterm")) return alert("Select an Incoterm for every line.")
      if (!valOf(it, "weight")) return alert("Enter the Weight for every line.")
    }
    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({
        id: it.id,
        country: valOf(it, "country"),
        incoterm: valOf(it, "incoterm"),
        weight: valOf(it, "weight"),
        shipmentDate: valOf(it, "shipmentDate"),
      }))
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates, status: "PENDING_LOGISTICS" }),
      })
      if (r.ok) { setEdits({}); await load() } else alert("Error")
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Under testing (Admin only)</p></div>

  return (
    <div className="p-5 max-w-[1500px] mx-auto space-y-4">
      <datalist id="pm-countries">{countries.map(c => <option key={c} value={c} />)}</datalist>
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Purchase — Pull Material</h1>
        <p className="text-sm text-gray-500">Pick Country + Incoterm, confirm/revise Weight (consumption shown as reference) → forward to Logistics</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: MAROON } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No documents at this stage</div> :
          reqs.map(rq => (
            <div key={rq.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                  <span className="text-xs text-gray-500"> · {rq.requesterName} · {rq.items.length} items</span></div>
                <button onClick={() => save(rq)} disabled={busy === rq.id} className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
                  {busy === rq.id ? "..." : "Save → Send to Logistics"}
                </button>
              </div>
              <div className="mt-3 border rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    {["SO", "Item Code", "Material", "PULL", "Consumption", "Gen. Weight", "Country *", "Incoterm *", "Weight (revise) *", "Ship Date"].map(h =>
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rq.items.map((it: any) => (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{it.soNoDoc}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.itemCode || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.itemName || "-"}</td>
                        <td className="px-3 py-1.5">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{fmt(it.consumption)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{fmt(it.weightGenerated)}</td>
                        <td className="px-3 py-1.5">
                          <input list="pm-countries" value={valOf(it, "country")} onChange={e => setVal(it.id, "country", e.target.value)}
                            placeholder="search…" className="w-32 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" />
                        </td>
                        <td className="px-3 py-1.5">
                          <select value={valOf(it, "incoterm")} onChange={e => setVal(it.id, "incoterm", e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-300">
                            <option value="">—</option>
                            {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" value={valOf(it, "weight")} onChange={e => setVal(it.id, "weight", e.target.value)} placeholder="0"
                            className="w-24 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="date" value={valOf(it, "shipmentDate")} onChange={e => setVal(it.id, "shipmentDate", e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
    </div>
  )
}
