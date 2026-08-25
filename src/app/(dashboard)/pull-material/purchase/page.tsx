"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, buColor } from "../_StageWork"

const INCOTERMS = ["FOB", "CIF", "EX-WORK"]

export default function PurchasePage() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [airRows, setAirRows] = useState<any[]>([])
  const [seaRows, setSeaRows] = useState<any[]>([])
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
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setAirRows(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/sea-rates").then(r => r.json()).then(d => setSeaRows(d.rows || [])).catch(() => {})
  }, [])

  // country → air ports / sea ports (cascade)
  const { countries, airByCountry, seaByCountry } = useMemo(() => {
    const airByCountry: Record<string, Set<string>> = {}, seaByCountry: Record<string, Set<string>> = {}
    airRows.forEach(r => { const c = r.country || ""; if (c && r.origin) (airByCountry[c] ??= new Set()).add(r.origin) })
    seaRows.forEach(r => { const c = r.country || ""; if (c && r.port) (seaByCountry[c] ??= new Set()).add(r.port) })
    const countries = [...new Set([...Object.keys(airByCountry), ...Object.keys(seaByCountry)])].sort()
    return { countries, airByCountry, seaByCountry }
  }, [airRows, seaRows])

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const valOf = (it: any, k: string) => {
    if (edits[it.id]?.[k] !== undefined) return edits[it.id][k]
    if (it[k] == null) return ""
    return (k === "shipmentDate") ? String(it[k]).slice(0, 10) : String(it[k])
  }

  const save = async (rq: any) => {
    for (const it of rq.items) {
      if (!valOf(it, "country")) return alert(`Select a Country for SO ${it.soNoDoc}.`)
      if (!valOf(it, "port") && !valOf(it, "seaPort")) return alert(`Select an Air Port or Sea Port for SO ${it.soNoDoc}.`)
      if (!valOf(it, "incoterm")) return alert(`Select an Incoterm for SO ${it.soNoDoc}.`)
      if (!valOf(it, "weight")) return alert(`Enter the Weight for SO ${it.soNoDoc}.`)
    }
    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({
        id: it.id, country: valOf(it, "country"), port: valOf(it, "port"), seaPort: valOf(it, "seaPort"),
        incoterm: valOf(it, "incoterm"), weight: valOf(it, "weight"), shipmentDate: valOf(it, "shipmentDate"),
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

  const sel = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 disabled:bg-gray-50 disabled:text-gray-400"
  const openReq = reqs.find(r => r.id === openId)
  const itemReady = (it: any) => !!valOf(it, "country") && (!!valOf(it, "port") || !!valOf(it, "seaPort")) && !!valOf(it, "incoterm") && !!valOf(it, "weight")
  const allReady = openReq ? openReq.items.every(itemReady) : false

  return (
    <div className="p-5 md:p-8 max-w-[1000px] mx-auto space-y-5">
      <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>Purchase</h1>
        <p className="text-sm text-gray-400 mt-0.5">Pick Country → choose Air / Sea port, Incoterm &amp; Weight → send to Logistics</p></div>

      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${bu === b ? "text-white border-transparent shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        openReq ? (
          <div className="space-y-5">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">← Back</button>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-bold text-lg text-gray-900">{openReq.documentNo}</div>
                <div className="text-xs text-gray-400">{openReq.requesterName} · {openReq.items.length} items</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button onClick={() => save(openReq)} disabled={busy === openReq.id || !allReady}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition" style={{ background: MAROON }}>
                  {busy === openReq.id ? "Saving…" : "Save → Send to Logistics"}
                </button>
                {!allReady && <span className="text-[11px] text-amber-600">Fill Country, Port, Incoterm &amp; Weight for every item</span>}
              </div>
            </div>

            {openReq.items.map((it: any) => {
              const c = valOf(it, "country")
              const airPorts = [...(airByCountry[c] || [])].sort()
              const seaPorts = [...(seaByCountry[c] || [])].sort()
              return (
                <div key={it.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Header strip */}
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs font-bold text-white px-2 py-0.5 rounded-md" style={{ background: MAROON }}>SO {it.soNoDoc}</span>
                    <span className="text-sm font-medium text-gray-800">{it.itemName || it.itemCode}</span>
                    <span className="text-xs text-gray-400">{it.brand || ""} · {it.itemCode || ""}</span>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Reference chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <Chip label="PO No" value={it.poNoDoc} />
                      <Chip label="Customer" value={it.customerName} />
                      <Chip label="Cust PO" value={it.customerPo} />
                      <Chip label="Style" value={it.style} />
                      <Chip label="PULL" value={`${fmt(it.pullMaterialQty)} ${it.bomUom || ""}`} />
                      <Chip label="Consumption" value={fmt(it.consumption)} />
                    </div>

                    {/* Inputs */}
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                      <Field label="Country *">
                        <select value={c} onChange={e => { setVal(it.id, "country", e.target.value); setVal(it.id, "port", ""); setVal(it.id, "seaPort", "") }} className={sel}>
                          <option value="">— select country —</option>
                          {countries.map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </Field>
                      <Field label="Incoterm *">
                        <select value={valOf(it, "incoterm")} onChange={e => setVal(it.id, "incoterm", e.target.value)} className={sel}>
                          <option value="">— select —</option>
                          {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label={`Air Port ${airPorts.length ? `(${airPorts.length})` : ""}`}>
                        <select value={valOf(it, "port")} onChange={e => setVal(it.id, "port", e.target.value)} disabled={!c} className={sel}>
                          <option value="">{c ? (airPorts.length ? "— select air port —" : "no air port for country") : "select country first"}</option>
                          {airPorts.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </Field>
                      <Field label={`Sea Port ${seaPorts.length ? `(${seaPorts.length})` : ""}`}>
                        <select value={valOf(it, "seaPort")} onChange={e => setVal(it.id, "seaPort", e.target.value)} disabled={!c} className={sel}>
                          <option value="">{c ? (seaPorts.length ? "— select sea port —" : "no sea port for country") : "select country first"}</option>
                          {seaPorts.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </Field>
                      <Field label="Weight (kg) *">
                        <input type="number" value={valOf(it, "weight")} onChange={e => setVal(it.id, "weight", e.target.value)} placeholder="0" className={sel} />
                      </Field>
                      <Field label="Ship Date">
                        <input type="date" value={valOf(it, "shipmentDate")} onChange={e => setVal(it.id, "shipmentDate", e.target.value)} className={sel} />
                      </Field>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          reqs.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">No documents at this stage</div> :
            <div className="space-y-2.5">
              {reqs.map(rq => (
                <button key={rq.id} onClick={() => setOpenId(rq.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition text-left">
                  <div>
                    <div className="font-semibold text-gray-900">{rq.documentNo}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{rq.requesterName} · {rq.items.length} items · {[...new Set(rq.items.map((i: any) => i.soNoDoc))].join(", ")}</div>
                  </div>
                  <span className="text-gray-300 text-lg">›</span>
                </button>
              ))}
            </div>
        )}
    </div>
  )
}

function Chip({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 truncate" title={String(value ?? "")}>{value || "-"}</div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-semibold text-gray-500 block mb-1.5">{label}</label>{children}</div>
}
