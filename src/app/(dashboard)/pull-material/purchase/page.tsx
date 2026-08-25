"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, buColor } from "../_StageWork"

const INCOTERMS = ["FOB", "CIF", "EX-WORK"]

export default function PurchasePage() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [ports, setPorts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "PENDING_PURCHASING"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line

  useEffect(() => {
    fetch("/api/master/port").then(r => r.json()).then((rows: any[]) => {
      setCountries(Array.from(new Set((rows || []).map(r => r.country).filter(Boolean))).sort())
    }).catch(() => {})
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setPorts(d.origins || [])).catch(() => {})
  }, [])

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const valOf = (it: any, k: string) => {
    if (edits[it.id]?.[k] !== undefined) return edits[it.id][k]
    if (it[k] == null) return ""
    return (k === "shipmentDate") ? String(it[k]).slice(0, 10) : String(it[k])
  }

  const save = async (rq: any) => {
    for (const it of rq.items) {
      if (!valOf(it, "port")) return alert(`Select a Port for SO ${it.soNoDoc}.`)
      if (!valOf(it, "incoterm")) return alert(`Select an Incoterm for SO ${it.soNoDoc}.`)
      if (!valOf(it, "weight")) return alert(`Enter the Weight for SO ${it.soNoDoc}.`)
    }
    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({
        id: it.id,
        country: valOf(it, "country"),
        port: valOf(it, "port"),
        incoterm: valOf(it, "incoterm"),
        weight: valOf(it, "weight"),
        shipmentDate: valOf(it, "shipmentDate"),
      }))
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUpdates, status: "PENDING_LOGISTICS" }),
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
      <datalist id="pm-countries">{countries.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="pm-ports">{ports.map(p => <option key={p} value={p} />)}</datalist>

      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Purchase — Pull Material</h1>
        <p className="text-sm text-gray-500">Open a document → per item, pick Country + Port + Incoterm and confirm Weight → send to Logistics</p></div>
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
                {busy === openReq.id ? "..." : "Save → Send to Logistics"}
              </button>
            </div>

            {openReq.items.map((it: any) => (
              <div key={it.id} className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b pb-2">
                  <span className="font-semibold text-gray-800">SO {it.soNoDoc}</span>
                  <span className="text-sm text-gray-600">{it.itemName || it.itemCode}</span>
                  <span className="text-xs text-gray-400">{it.brand || "-"} · {it.itemCode || ""}</span>
                </div>

                {/* Read-only refs */}
                <div className="grid sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  <Ref label="PO No" value={it.poNoDoc || "-"} />
                  <Ref label="Customer" value={it.customerName || "-"} />
                  <Ref label="Cust PO" value={it.customerPo || "-"} />
                  <Ref label="Style" value={it.style || "-"} />
                  <Ref label="PULL" value={`${fmt(it.pullMaterialQty)} ${it.bomUom || ""}`} />
                  <Ref label="Consumption (ref)" value={fmt(it.consumption)} />
                </div>

                {/* PC inputs — vertical */}
                <div className="grid sm:grid-cols-2 gap-4 pt-1">
                  <Field label="Country">
                    <input list="pm-countries" value={valOf(it, "country")} onChange={e => setVal(it.id, "country", e.target.value)} placeholder="search…" className={inp} />
                  </Field>
                  <Field label="Port (origin) *">
                    <input list="pm-ports" value={valOf(it, "port")} onChange={e => setVal(it.id, "port", e.target.value)} placeholder="e.g. HKG" className={inp} />
                  </Field>
                  <Field label="Incoterm *">
                    <select value={valOf(it, "incoterm")} onChange={e => setVal(it.id, "incoterm", e.target.value)} className={inp}>
                      <option value="">—</option>
                      {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Weight (kg) *">
                    <input type="number" value={valOf(it, "weight")} onChange={e => setVal(it.id, "weight", e.target.value)} placeholder="0" className={inp} />
                  </Field>
                  <Field label="Ship Date">
                    <input type="date" value={valOf(it, "shipmentDate")} onChange={e => setVal(it.id, "shipmentDate", e.target.value)} className={inp} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── List of documents ── */
          reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No documents at this stage</div> :
            <div className="bg-white rounded-xl border overflow-hidden divide-y divide-gray-100">
              {reqs.map(rq => (
                <button key={rq.id} onClick={() => setOpenId(rq.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 text-left">
                  <div>
                    <div className="font-semibold text-blue-700">{rq.documentNo}</div>
                    <div className="text-xs text-gray-400">{rq.requesterName} · {rq.items.length} items · {[...new Set(rq.items.map((i: any) => i.soNoDoc))].join(", ")}</div>
                  </div>
                  <span className="text-gray-300">›</span>
                </button>
              ))}
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
