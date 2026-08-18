"use client"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

// LG BOOKING — Logistics landing. Familiar doc-card layout, but shows only the SOs still waiting on
// Logistics (itemStatus PRES_PASSED, doc not yet sent) and GROUPS them BY BRAND across documents.
// LG ticks the SOs to work on (can span documents within a brand) and clicks "Open selected" → the
// combined entry page (/logistics/entry) to enter one HAWB across the chosen SOs.
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }

export default function LgBookingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const role = (session?.user as any)?.role || ""
  const roles: string[] = [role, ...(((session?.user as any)?.roles) || [])]
  const userBu = (session?.user as any)?.bu || "NYG"
  const isAdmin = role === "ADMIN"
  const allowed = isAdmin || roles.some(r => ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "LOGISTICS_SUB"].includes(r))

  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openBrands, setOpenBrands] = useState<Set<string>>(new Set())
  const toggleBrand = (b: string) => setOpenBrands(p => { const n = new Set(p); n.has(b) ? n.delete(b) : n.add(b); return n })
  const [noAir, setNoAir] = useState<{ reqId: string; docNo: string; ids: string[] } | null>(null)
  const [noAirReason, setNoAirReason] = useState("No air")
  const [sending, setSending] = useState(false)

  const openNoAir = (req: any, docIds: string[]) => {
    const ids = docIds.filter(id => selected.has(id))
    if (ids.length === 0) { alert("Tick the SOs with no air in this document first"); return }
    setNoAirReason("No air"); setNoAir({ reqId: req.id, docNo: req.documentNo, ids })
  }
  const doNoAir = async () => {
    if (!noAir || !noAirReason.trim()) return
    setSending(true)
    for (const id of noAir.ids) {
      await fetch(`/api/requests/${noAir.reqId}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lg_reject_so", itemId: id, comment: noAirReason.trim() }),
      }).catch(() => {})
    }
    setSelected(p => { const n = new Set(p); noAir!.ids.forEach(id => n.delete(id)); return n })
    setNoAir(null); setSending(false)
    const d = await fetch("/api/requests").then(r => r.json()); setRequests(Array.isArray(d) ? d : [])
  }

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => { setRequests(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const lgBus = useMemo(() => {
    if (isAdmin) return new Set(["NYG", "EA", "TRM", "GW"])
    const s = new Set<string>()
    if (roles.includes("LOGISTICS") || roles.includes("LOGISTICS_SUB")) s.add(userBu === "EA" ? "EA" : "NYG")
    if (roles.includes("LOGISTICS_TRM")) s.add("TRM")
    if (roles.includes("LOGISTICS_GW")) s.add("GW")
    return s
  }, [isAdmin, roles, userBu])

  // SOs still waiting on LG (document not yet sent onward). LG runs in PARALLEL with claim, so the
  // bookable item statuses are LOG_PASSED / CLAIM_PASSED / PRES_PASSED for NYG-style BUs; GW = PRES_PASSED.
  const rows = useMemo(() => {
    const out: any[] = []
    for (const r of requests) {
      if (r.isTest && !isAdmin) continue
      if (r.logisticsSent) continue
      const bu = r.bu || "NYG"
      if (!lgBus.has(bu)) continue
      const bookable = bu === "GW" ? ["PRES_PASSED"] : ["LOG_PASSED", "CLAIM_PASSED", "PRES_PASSED"]
      for (const it of (r.items || [])) {
        if (!bookable.includes(it.itemStatus)) continue
        out.push({ ...it, request: r, brand: it.brand || r.brandName || "(no brand)" })
      }
    }
    return out
  }, [requests, lgBus, isAdmin])

  // Group by BRAND → then by DOCUMENT (each doc rendered as a familiar card with its SO rows).
  const brands = useMemo(() => {
    const s = q.trim().toLowerCase()
    const filtered = s ? rows.filter(r => `${r.brand} ${r.so} ${r.request.documentNo}`.toLowerCase().includes(s)) : rows
    const byBrand: Record<string, any[]> = {}
    for (const row of filtered) (byBrand[row.brand] ||= []).push(row)
    return Object.entries(byBrand).sort((a, b) => a[0].localeCompare(b[0])).map(([brand, brandRows]) => {
      const byDoc: Record<string, any[]> = {}
      for (const row of brandRows) (byDoc[row.request.id] ||= []).push(row)
      const docs = Object.values(byDoc).map(items => ({ request: items[0].request, items }))
      const draftIds = brandRows.filter((r: any) => r.hawbNo || r.actualAirFreight != null).map((r: any) => r.id)
      return { brand, docs, count: brandRows.length, ids: brandRows.map(r => r.id), draftCount: draftIds.length, draftIds }
    })
  }, [rows, q])

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleMany = (ids: string[], on: boolean) => setSelected(p => { const n = new Set(p); ids.forEach(id => on ? n.add(id) : n.delete(id)); return n })

  const openSelected = () => {
    if (selected.size === 0) return
    sessionStorage.setItem("lg_entry_ids", JSON.stringify([...selected]))
    router.push("/logistics/entry")
  }

  if (!allowed) return <div className="text-center py-20 text-gray-400">Logistics / Admin only</div>

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LG BOOKING</h1>
        <p className="text-xs text-gray-400 mt-0.5">Select SOs to book (can span documents within a brand), then click "Open" → enter one HAWB across the selected SOs</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search brand / SO / document no…"
        className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      {loading && <div className="text-center py-10 text-gray-400">Loading...</div>}
      {!loading && brands.length === 0 && <div className="text-center py-20 text-gray-400">No SOs waiting on LG</div>}

      {brands.map(({ brand, docs, count, ids, draftCount, draftIds }) => {
        const allOn = ids.every(id => selected.has(id))
        const open = openBrands.has(brand)
        return (
          <div key={brand} className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow transition-shadow overflow-hidden">
            {/* Brand dropdown header */}
            <div className={`flex items-center gap-2.5 px-4 py-3.5 ${open ? "border-b border-gray-100 bg-gray-50/60" : "bg-white"}`}>
              <input type="checkbox" checked={allOn} onChange={() => toggleMany(ids, !allOn)} onClick={e => e.stopPropagation()} className="rounded border-gray-300 text-blue-600" />
              <button onClick={() => toggleBrand(brand)} className="flex items-center gap-2.5 flex-1 text-left group">
                <span className={`text-gray-400 text-[10px] w-3 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
                <span className="text-[15px] font-semibold text-gray-700 group-hover:text-gray-900 tracking-tight">{brand}</span>
                <span className="text-xs text-gray-400 font-normal">{count} transaction · {docs.length} Document</span>
                {draftCount > 0 && <span role="button" tabIndex={0} title="กดเพื่อเลือก SO ที่มี draft แล้วกด Open ต่อ"
                  onClick={e => { e.stopPropagation(); toggleMany(draftIds, true); setOpenBrands(p => { const n = new Set(p); n.add(brand); return n }) }}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-medium whitespace-nowrap cursor-pointer hover:bg-amber-200">📝 draft {draftCount} SO ✓</span>}
              </button>
            </div>

            {open && (
              <div className="p-3 space-y-2.5 bg-gray-50/40">
                {docs.map(({ request: req, items }) => {
                  const est = items.reduce((s: number, i: any) => s + (i.airFreight || 0), 0)
                  const act = items.reduce((s: number, i: any) => s + (i.actualAirFreight || 0), 0)
                  const docIds = items.map((i: any) => i.id)
                  const docAllOn = docIds.every((id: string) => selected.has(id))
                  const docDraft = items.filter((i: any) => i.hawbNo || i.actualAirFreight != null).length
                  return (
                    <div key={req.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center gap-2">
                        <input type="checkbox" checked={docAllOn} onChange={() => toggleMany(docIds, !docAllOn)} className="rounded" />
                        <Link href={`/requests/${req.id}`} className="font-semibold text-blue-600 hover:underline text-sm">{req.documentNo}</Link>
                        {docDraft > 0 && <span role="button" tabIndex={0} title="กดเพื่อเลือก SO ที่มี draft ในเอกสารนี้"
                          onClick={e => { e.stopPropagation(); toggleMany(items.filter((i: any) => i.hawbNo || i.actualAirFreight != null).map((i: any) => i.id), true) }}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-medium whitespace-nowrap cursor-pointer hover:bg-amber-200">📝 draft {docDraft} SO ✓</span>}
                        <span className="text-xs text-gray-500">{req.bu}</span>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">EST {fmtNum(est)} THB</span>
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">ACT {fmtNum(act)} THB</span>
                        <span className="text-xs text-gray-400">{items.length} transaction</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs whitespace-nowrap">
                          <thead className="bg-gray-50 border-b"><tr>
                            <th className="px-3 py-2 w-8"></th>
                            {["SO","STYLE","SUB","CUSTOMER PO","DESCRIPTION","PLAN DATE","QTY AIR","GROSS (KG)","EST. AIR FREIGHT (THB)","ACTUAL (THB)","FACTORY","COUNTRY","INV NO","HAWB#"].map(h =>
                              <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>)}
                          </tr></thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.map((it: any) => (
                              <tr key={it.id} className={selected.has(it.id) ? "bg-blue-50" : "hover:bg-blue-50/30"}>
                                <td className="px-3 py-1.5"><input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} className="rounded" /></td>
                                <td className="px-3 py-1.5 font-medium">{it.so}</td>
                                <td className="px-3 py-1.5">{it.style}</td>
                                <td className="px-3 py-1.5">{it.sub || "-"}</td>
                                <td className="px-3 py-1.5">{it.customerPO || "-"}</td>
                                <td className="px-3 py-1.5">{it.description || "-"}</td>
                                <td className="px-3 py-1.5">{fmtDate(it.planShipmentDate)}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">{it.qtyRequestAir}</td>
                                <td className="px-3 py-1.5 text-right text-blue-700">{fmtNum(it.grossWeight, 2)}</td>
                                <td className="px-3 py-1.5 text-right text-blue-700">{fmtNum(it.airFreight)}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-green-700">{it.actualAirFreight != null ? fmtNum(it.actualAirFreight) : "-"}</td>
                                <td className="px-3 py-1.5">{it.factory || "-"}</td>
                                <td className="px-3 py-1.5">{it.country || "-"}</td>
                                <td className="px-3 py-1.5">{it.invoiceNo || "-"}</td>
                                <td className="px-3 py-1.5">{it.hawbNo || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* No air — send back the ticked SOs of THIS document */}
                      <div className="px-4 py-2 border-t border-gray-100 flex justify-end">
                        <button onClick={() => openNoAir(req, docIds)}
                          className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 font-medium">
                          ✕ No air — send back selected SOs
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Sticky action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white border-t shadow-lg px-6 py-3 flex items-center gap-3 z-40">
          <span className="text-sm font-medium text-gray-700">Selected {selected.size} transaction(s)</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-red-600 underline">Clear</button>
          <button onClick={openSelected} className="ml-auto bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">
            Open {selected.size} transaction(s) →
          </button>
        </div>
      )}

      {/* No air modal */}
      {noAir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-red-600 text-white px-5 py-3 font-semibold text-sm">No air — send back {noAir.ids.length} SO(s)</div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">{noAir.docNo} · {noAir.ids.length} selected SO(s) — confirm these had no air? They will be sent back before claim (notifies MER/SCM)</p>
              <textarea value={noAirReason} onChange={e => setNoAirReason(e.target.value)} rows={3} placeholder="Reason (e.g. No air / not shipped by air)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              <div className="flex gap-2">
                <button onClick={() => setNoAir(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={doNoAir} disabled={!noAirReason.trim() || sending} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">{sending ? "..." : "Confirm No air"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
