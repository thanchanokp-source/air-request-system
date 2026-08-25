"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"

// Air weight breaks (kg minimums) → the Q column key used for the rate.
const BREAK_ORDER = [45, 100, 250, 300, 500, 1000, 2000, 8000]
const breakKey = (w: any) => { const W = Number(w) || 0; let b = 45; for (const x of BREAK_ORDER) if (x <= W) b = x; return "Q" + b }

export default function LogisticsPage() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [airRates, setAirRates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "PENDING_LOGISTICS"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line
  useEffect(() => { fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setAirRates(d.rows || [])).catch(() => {}) }, [])

  // Estimate Air = MAX rate among the COUNTRY's air routes at the weight's Q-break × weight.
  const airEst = (it: any) => {
    const w = Number(it.weight) || 0
    const routes = airRates.filter(r => (r.country || "") === (it.country || ""))
    if (!it.country || !w || !routes.length) return null
    const bk = breakKey(w)
    const vals = routes.map(r => Number(r.rates?.[bk])).filter(v => v && !isNaN(v))
    if (!vals.length) return null
    const rate = Math.max(...vals)
    return { bk, rate, est: Math.round(rate * w * 100) / 100 }
  }

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const raw = (it: any, k: string, fb = "") => edits[it.id]?.[k] ?? (it[k] != null ? String(it[k]) : fb)
  const dateVal = (it: any, k: string) => edits[it.id]?.[k] ?? (it[k] ? String(it[k]).slice(0, 10) : "")

  const save = async (rq: any) => {
    for (const it of rq.items) {
      if (!airEst(it)) return alert(`No air rate for country "${it.country}" at this weight (SO ${it.soNoDoc}). Check the Country / weight.`)
      if (!dateVal(it, "inHouseAirDate")) return alert("Enter In-House Air date for every line.")
    }
    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({
        id: it.id,
        airFreightCost: airEst(it)?.est ?? null,
        seaFreightCost: raw(it, "seaFreightCost") || null,
        incotermCost: raw(it, "incotermCost") || null,
        leadTimeAir: raw(it, "leadTimeAir"),
        leadTimeSea: raw(it, "leadTimeSea"),
        inHouseAirDate: dateVal(it, "inHouseAirDate"),
        inHouseSeaDate: dateVal(it, "inHouseSeaDate"),
      }))
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates, status: "PENDING_SCM_DECISION" }),
      })
      if (r.ok) { setEdits({}); setOpenId(null); await load() } else alert("Error")
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Under testing (Admin only)</p></div>

  const inp = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-red-200"
  const openReq = reqs.find(r => r.id === openId)

  return (
    <div className="p-5 max-w-[1100px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Logistics — Pull Material</h1>
        <p className="text-sm text-gray-500">Estimate Air is auto-calculated from Port + weight (Rate_LG). Fill Air L/T + In-House → send to SCM</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        openReq ? (
          /* ── Document detail — vertical form per item ── */
          <div className="space-y-4">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-500 hover:text-gray-700">← Back to list</button>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div><span className="font-bold text-blue-700 text-lg">{openReq.documentNo}</span>
                <span className="text-xs text-gray-500"> · {openReq.requesterName} · {openReq.items.length} items</span></div>
              <button onClick={() => save(openReq)} disabled={busy === openReq.id} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
                {busy === openReq.id ? "..." : "Save → Send to SCM"}
              </button>
            </div>

            {openReq.items.map((it: any) => {
              const e = airEst(it)
              return (
                <div key={it.id} className="bg-white rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b pb-2">
                    <span className="font-semibold text-gray-800">SO {it.soNoDoc}</span>
                    <span className="text-sm text-gray-600">{it.itemName || it.itemCode}</span>
                    <span className="text-xs text-gray-400">{it.brand || "-"} · PULL {fmt(it.pullMaterialQty)} {it.bomUom || ""}</span>
                  </div>

                  {/* Read-only refs */}
                  <div className="grid sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <Ref label="Country" value={it.country || "-"} />
                    <Ref label="Incoterm" value={it.incoterm || "-"} />
                    <Ref label="Weight (kg)" value={fmt(it.weight)} />
                    <Ref label="Consumption" value={fmt(it.consumption)} />
                    <Ref label="Ship Date" value={fmtDate(it.shipmentDate)} />
                  </div>

                  {/* Auto Estimate Air */}
                  <div className={`rounded-lg p-3 ${e ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
                    {e ? (
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-xs text-gray-500">Estimate Air (auto)</span>
                        <span className="text-lg font-bold" style={{ color: MAROON }}>{fmt(e.est)} USD</span>
                        <span className="text-xs text-gray-400">= max rate {e.rate} ({e.bk}) × {fmt(it.weight)} kg</span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700">⚠ No air rate for country &quot;{it.country || "-"}&quot; at this weight — check Country/weight or add the rate to the master.</span>
                    )}
                  </div>

                  {/* LG inputs — vertical */}
                  <div className="grid sm:grid-cols-2 gap-4 pt-1">
                    <Field label="In-House Air date *"><input type="date" value={dateVal(it, "inHouseAirDate")} onChange={ev => setVal(it.id, "inHouseAirDate", ev.target.value)} className={inp} /></Field>
                    <Field label="In-House Sea date"><input type="date" value={dateVal(it, "inHouseSeaDate")} onChange={ev => setVal(it.id, "inHouseSeaDate", ev.target.value)} className={inp} /></Field>
                    <Field label="Air Lead Time"><input value={raw(it, "leadTimeAir")} onChange={ev => setVal(it.id, "leadTimeAir", ev.target.value)} placeholder="e.g. 3 days" className={inp} /></Field>
                    <Field label="Sea Lead Time"><input value={raw(it, "leadTimeSea")} onChange={ev => setVal(it.id, "leadTimeSea", ev.target.value)} placeholder="e.g. 30 days" className={inp} /></Field>
                    <Field label="Incoterm cost (optional)"><input type="number" value={raw(it, "incotermCost")} onChange={ev => setVal(it.id, "incotermCost", ev.target.value)} placeholder="0" className={inp} /></Field>
                    <Field label="Sea Freight (optional)"><input type="number" value={raw(it, "seaFreightCost")} onChange={ev => setVal(it.id, "seaFreightCost", ev.target.value)} placeholder="0" className={inp} /></Field>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── List of documents ── */
          reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No documents at this stage</div> :
            <div className="bg-white rounded-xl border overflow-hidden divide-y divide-gray-100">
              {reqs.map(rq => {
                const ports = [...new Set(rq.items.map((i: any) => i.port).filter(Boolean))].join(", ")
                return (
                  <button key={rq.id} onClick={() => setOpenId(rq.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 text-left">
                    <div>
                      <div className="font-semibold text-blue-700">{rq.documentNo}</div>
                      <div className="text-xs text-gray-400">{rq.requesterName} · {rq.items.length} items · Port: {ports || "-"}</div>
                    </div>
                    <span className="text-gray-300">›</span>
                  </button>
                )
              })}
            </div>
        )}
    </div>
  )
}

function Ref({ label, value }: { label: string; value: any }) {
  return <div><div className="text-[11px] text-gray-400">{label}</div><div className="text-gray-700">{value}</div></div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>{children}</div>
}
