"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt } from "../_StageWork"

export default function LogisticsPage() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [rates, setRates] = useState<Record<string, number>>({}) // country → rate for current bu
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "PENDING_LOGISTICS"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line

  // Freight rate per country for this BU (EA uses USD/kg, others THB/kg). Fallback to bu "ALL".
  useEffect(() => {
    fetch("/api/master/port").then(r => r.json()).then((rows: any[]) => {
      const m: Record<string, number> = {}
      ;(rows || []).forEach(r => {
        if (r.bu !== bu && r.bu !== "ALL") return
        const rate = bu === "EA" ? Number(r.rateUsd) || 0 : Number(r.ratePerKg) || 0
        if (m[r.country] == null || r.bu === bu) m[r.country] = rate // prefer exact-bu over ALL
      })
      setRates(m)
    }).catch(() => {})
  }, [bu])

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const raw = (it: any, k: string, fallback = "") => edits[it.id]?.[k] ?? (it[k] != null ? String(it[k]) : fallback)
  const dateVal = (it: any, k: string) => edits[it.id]?.[k] ?? (it[k] ? String(it[k]).slice(0, 10) : "")

  // airRate prefilled from country master; sea rate entered by LG.
  const airRateOf = (it: any) => edits[it.id]?.airRate ?? (rates[it.country] != null ? String(rates[it.country]) : "")
  const seaRateOf = (it: any) => edits[it.id]?.seaRate ?? ""
  const freight = (it: any, which: "air" | "sea") => {
    const w = Number(it.weight) || 0, q = Number(it.pullMaterialQty) || 0
    const rate = Number(which === "air" ? airRateOf(it) : seaRateOf(it)) || 0
    const ic = Number(raw(it, "incotermCost", "0")) || 0
    return Math.round((w * q * rate + ic) * 100) / 100
  }

  const save = async (rq: any) => {
    for (const it of rq.items) {
      if (!airRateOf(it)) return alert("Air rate missing — set the country freight rate in master, or enter it per line.")
      if (!dateVal(it, "inHouseAirDate") || !dateVal(it, "inHouseSeaDate")) return alert("Enter In-House Air & Sea dates for every line.")
    }
    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({
        id: it.id,
        airFreightCost: freight(it, "air"),
        seaFreightCost: freight(it, "sea"),
        incotermCost: raw(it, "incotermCost", "0"),
        leadTimeAir: raw(it, "leadTimeAir"),
        leadTimeSea: raw(it, "leadTimeSea"),
        inHouseAirDate: dateVal(it, "inHouseAirDate"),
        inHouseSeaDate: dateVal(it, "inHouseSeaDate"),
      }))
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates, status: "PENDING_SCM_DECISION" }),
      })
      if (r.ok) { setEdits({}); await load() } else alert("Error")
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Under testing (Admin only)</p></div>

  const inp = "border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-300"

  return (
    <div className="p-5 max-w-[1600px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Logistics — Pull Material</h1>
        <p className="text-sm text-gray-500">Freight = Weight × PULL qty × country rate + Incoterm cost. Enter rates, incoterm cost, lead time, in-house dates → send to SCM</p></div>
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
                  {busy === rq.id ? "..." : "Save → Send to SCM"}
                </button>
              </div>
              <div className="mt-3 border rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    {["SO", "PO No", "Item No", "Item Code", "Customer", "Cust PO", "Brand", "Style", "Consumption", "Material", "PULL", "Country", "Incoterm", "Weight", "Air rate/kg", "Sea rate/kg", "Incoterm cost",
                      "= Air Freight", "= Sea Freight", "Lead Air", "Lead Sea", "In-House Air *", "In-House Sea *"].map(h =>
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rq.items.map((it: any) => (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{it.soNoDoc}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{it.poNoDoc || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{it.itemNo || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{it.itemCode || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{it.customerName || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{it.customerPo || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{it.brand || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{it.style || "-"}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{fmt(it.consumption)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.itemName || it.itemCode}</td>
                        <td className="px-3 py-1.5">{fmt(it.pullMaterialQty)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.country || "-"}</td>
                        <td className="px-3 py-1.5">{it.incoterm || "-"}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(it.weight)}</td>
                        <td className="px-3 py-1.5"><input type="number" value={airRateOf(it)} onChange={e => setVal(it.id, "airRate", e.target.value)} className={`w-20 ${inp}`} /></td>
                        <td className="px-3 py-1.5"><input type="number" value={seaRateOf(it)} onChange={e => setVal(it.id, "seaRate", e.target.value)} className={`w-20 ${inp}`} /></td>
                        <td className="px-3 py-1.5"><input type="number" value={raw(it, "incotermCost")} onChange={e => setVal(it.id, "incotermCost", e.target.value)} className={`w-20 ${inp}`} /></td>
                        <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(freight(it, "air"))}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-blue-700">{fmt(freight(it, "sea"))}</td>
                        <td className="px-3 py-1.5"><input value={raw(it, "leadTimeAir")} onChange={e => setVal(it.id, "leadTimeAir", e.target.value)} placeholder="e.g. 3d" className={`w-16 ${inp}`} /></td>
                        <td className="px-3 py-1.5"><input value={raw(it, "leadTimeSea")} onChange={e => setVal(it.id, "leadTimeSea", e.target.value)} placeholder="e.g. 30d" className={`w-16 ${inp}`} /></td>
                        <td className="px-3 py-1.5"><input type="date" value={dateVal(it, "inHouseAirDate")} onChange={e => setVal(it.id, "inHouseAirDate", e.target.value)} className={inp} /></td>
                        <td className="px-3 py-1.5"><input type="date" value={dateVal(it, "inHouseSeaDate")} onChange={e => setVal(it.id, "inHouseSeaDate", e.target.value)} className={inp} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">Air rate/kg is prefilled from the country freight-rate master ({bu === "EA" ? "USD" : "THB"}). Sea rate is entered manually.</p>
            </div>
          ))}
    </div>
  )
}
