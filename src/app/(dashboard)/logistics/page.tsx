"use client"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import LgHistory from "@/components/lg-history"

// LG BOOKING — Logistics landing. Familiar doc-card layout, but shows only the SOs still waiting on
// Logistics (itemStatus PRES_PASSED, doc not yet sent) and GROUPS them BY BRAND across documents.
// LG ticks the SOs to work on (can span documents within a brand) and clicks "Open selected" → the
// combined entry page (/logistics/entry) to enter one HAWB across the chosen SOs.
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }

// One document's transaction table. Big docs (hundreds/thousands of rows) render only a slice
// and grow it as the user scrolls to the bottom, so opening a 1,500-row document stays snappy.
// Header stays sticky inside the scroll box; a footer shows how much is shown vs total.
const ROW_STEP = 60
function LgDocTable({ items, cur, selected, onToggle }: { items: any[]; cur: string; selected: Set<string>; onToggle: (id: string) => void }) {
  const [visN, setVisN] = useState(ROW_STEP)
  const shown = items.slice(0, visN)
  const onScroll = (e: any) => {
    const el = e.currentTarget as HTMLDivElement
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) setVisN(n => (n >= items.length ? n : Math.min(items.length, n + ROW_STEP)))
  }
  return (
    <div>
      <div className="overflow-auto max-h-[56vh]" onScroll={onScroll}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-gray-50 border-b sticky top-0 z-10"><tr>
            <th className="px-3 py-2 w-8"></th>
            {["SO","STYLE","SUB","CUSTOMER PO","DESCRIPTION","PLAN DATE","QTY AIR","GROSS (KG)",`EST. AIR FREIGHT (${cur})`,`ACTUAL (${cur})`,"FACTORY","COUNTRY","INV NO","HAWB#"].map(h =>
              <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((it: any) => (
              <tr key={it.id} className={selected.has(it.id) ? "bg-blue-50" : "hover:bg-blue-50/30"}>
                <td className="px-3 py-1.5"><input type="checkbox" checked={selected.has(it.id)} onChange={() => onToggle(it.id)} className="rounded" /></td>
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
      {items.length > ROW_STEP && (
        <div className="px-4 py-1.5 text-center text-[11px] text-gray-400 bg-gray-50/70 border-t border-gray-100">
          แสดง {shown.length} จาก {items.length} แถว{visN < items.length ? " · เลื่อนลงเพื่อโหลดเพิ่ม" : " · ครบแล้ว"}
        </div>
      )}
    </div>
  )
}

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
  const [fSo, setFSo] = useState("")
  const [fSub, setFSub] = useState("")
  const [fCpo, setFCpo] = useState("")
  const [fStyle, setFStyle] = useState("")
  const [buF, setBuF] = useState("")
  const [fwOnly, setFwOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openBrands, setOpenBrands] = useState<Set<string>>(new Set())
  const toggleBrand = (b: string) => setOpenBrands(p => { const n = new Set(p); n.has(b) ? n.delete(b) : n.add(b); return n })
  const [noAir, setNoAir] = useState<{ reqId: string; docNo: string; ids: string[] } | null>(null)
  const [noAirReason, setNoAirReason] = useState("No air")
  const [sending, setSending] = useState(false)
  const [view, setView] = useState<"booking" | "history" | "map">("booking")

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
    // NYG books through LG AIR BOOKING now → LG BOOKING serves only EA / TRM / GW.
    if (isAdmin) return new Set(["EA", "TRM", "GW"])
    const s = new Set<string>()
    if ((roles.includes("LOGISTICS") || roles.includes("LOGISTICS_SUB")) && userBu === "EA") s.add("EA")
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
      const bu = r.bu || "NYG"
      if (!lgBus.has(bu)) continue
      const bookable = bu === "GW" ? ["PRES_PASSED", "PRESIDENT_PENDING"] : ["LOG_PASSED", "CLAIM_PASSED", "PRES_PASSED", "PRESIDENT_PENDING"]
      for (const it of (r.items || [])) {
        if (!bookable.includes(it.itemStatus)) continue
        // Drop a SO off the worklist only once it's been SENT (logisticsSent) with its Actual in. A SO with
        // an Actual entered but NOT yet sent = a DRAFT → keep it visible (with the "📝 draft" badge) so LG
        // can re-open and continue. (Previously any Actual hid it, so drafted SOs vanished from the list.)
        if (r.logisticsSent && it.actualAirFreight) continue
        out.push({ ...it, request: r, brand: it.brand || r.brandName || "(no brand)" })
      }
    }
    return out
  }, [requests, lgBus, isAdmin])

  // Group by BRAND → then by DOCUMENT (each doc rendered as a familiar card with its SO rows).
  const brands = useMemo(() => {
    const s = q.trim().toLowerCase()
    let filtered = buF ? rows.filter(r => (r.request.bu || "NYG") === buF) : rows
    if (fwOnly) filtered = filtered.filter(r => !!r.request.lgForwardEmail)
    if (s) filtered = filtered.filter(r => `${r.brand} ${r.so} ${r.request.documentNo}`.toLowerCase().includes(s))
    const byBrand: Record<string, any[]> = {}
    for (const row of filtered) (byBrand[row.brand] ||= []).push(row)
    return Object.entries(byBrand).sort((a, b) => a[0].localeCompare(b[0])).map(([brand, brandRows]) => {
      const byDoc: Record<string, any[]> = {}
      for (const row of brandRows) (byDoc[row.request.id] ||= []).push(row)
      const docs = Object.values(byDoc).map(items => ({ request: items[0].request, items }))
      // Draft = LG has started entering data on this SO — from the FIRST field (INV), not only HAWB/Actual.
      const draftIds = brandRows.filter((r: any) => r.invoiceNo || r.hawbNo || r.actualAirFreight != null).map((r: any) => r.id)
      return { brand, docs, count: brandRows.length, ids: brandRows.map(r => r.id), draftCount: draftIds.length, draftIds }
    })
  }, [rows, q, buF, fwOnly])

  const searching = !!(q.trim() || fSo.trim() || fSub.trim() || fCpo.trim() || fStyle.trim())
  const inc = (v: any, f: string) => !f.trim() || String(v || "").toLowerCase().includes(f.trim().toLowerCase())
  // Flat SO results — per-field filters (SO / Sub / Customer PO / Style) + general search → tick to select.
  const soMatches = useMemo(() => {
    if (!searching) return []
    const s = q.trim().toLowerCase()
    return rows.filter(r =>
      (!buF || (r.request.bu || "NYG") === buF) &&
      (!fwOnly || !!r.request.lgForwardEmail) &&
      (!s || `${r.brand} ${r.so} ${r.sub || ""} ${r.request.documentNo} ${r.style || ""} ${r.customerPO || ""}`.toLowerCase().includes(s)) &&
      inc(r.so, fSo) && inc(r.sub, fSub) && inc(r.customerPO, fCpo) && inc(r.style, fStyle)
    )
  }, [rows, q, buF, fwOnly, fSo, fSub, fCpo, fStyle, searching])

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleMany = (ids: string[], on: boolean) => setSelected(p => { const n = new Set(p); ids.forEach(id => on ? n.add(id) : n.delete(id)); return n })

  const openSelected = () => {
    if (selected.size === 0) return
    sessionStorage.setItem("lg_entry_ids", JSON.stringify([...selected]))
    router.push("/logistics/entry")
  }

  // Clicking a document number opens the LG booking entry (inside) for that whole document's SOs.
  const openDoc = (ids: string[]) => {
    if (ids.length === 0) return
    sessionStorage.setItem("lg_entry_ids", JSON.stringify(ids))
    router.push("/logistics/entry")
  }

  if (!allowed) return <div className="text-center py-20 text-gray-400">Logistics / Admin only</div>

  const TabBar = () => (
    <div className="flex gap-1 border-b border-gray-200">
      {([["booking", "จองงาน (Booking)"], ["history", "📜 ประวัติการกรอก"]] as const).map(([v, l]) => (
        <button key={v} onClick={() => setView(v as any)}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${view === v ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{l}</button>
      ))}
    </div>
  )

  if (view === "history") return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LG BOOKING</h1>
        <p className="text-xs text-gray-400 mt-0.5">ประวัติการกรอกข้อมูล Logistics (view only) — ใครกรอกอะไร · เมื่อไหร่ · INV / HAWB / Actual</p>
      </div>
      <TabBar />
      <LgHistory />
    </div>
  )

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LG BOOKING</h1>
        <p className="text-xs text-gray-400 mt-0.5">Select SOs to book (can span documents within a brand), then click "Open" → enter one HAWB across the selected SOs</p>
      </div>
      <TabBar />

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search brand / SO / document no…"
          className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-1.5">
          {["", ...["EA", "TRM", "GW"].filter(b => lgBus.has(b))].map(b => (
            <button key={b || "ALL"} onClick={() => setBuF(b)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${buF === b ? "bg-blue-600 text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
              {b || "All BU"}
            </button>
          ))}
        </div>
        <button onClick={() => setFwOnly(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${fwOnly ? "bg-violet-600 text-white border-transparent" : "bg-white text-violet-600 border-violet-300 hover:bg-violet-50"}`}>
          ↪ Forwarded only
        </button>
      </div>

      {/* Per-field filters (type to narrow the SO list) */}
      <div className="flex flex-wrap items-end gap-2">
        <FField label="SO" value={fSo} onChange={setFSo} />
        <FField label="SUB" value={fSub} onChange={setFSub} />
        <FField label="Customer PO" value={fCpo} onChange={setFCpo} />
        <FField label="Style" value={fStyle} onChange={setFStyle} />
        {searching && <button onClick={() => { setQ(""); setFSo(""); setFSub(""); setFCpo(""); setFStyle("") }}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2">Clear</button>}
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Loading...</div>}

      {/* Search mode → flat SO list with tick (multi-select across docs/brands) */}
      {!loading && searching && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <input type="checkbox" checked={soMatches.length > 0 && soMatches.every(r => selected.has(r.id))}
              onChange={e => toggleMany(soMatches.map(r => r.id), e.target.checked)} className="rounded border-gray-300" />
            <span className="text-sm font-semibold text-gray-700">Matching SOs</span>
            <span className="text-xs text-gray-400">{soMatches.length} found · tick to select</span>
          </div>
          {soMatches.length === 0 ? <div className="px-4 py-8 text-center text-gray-400 text-sm">No SO matches</div> : (
            <div className="max-h-[62vh] overflow-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 font-medium">SO</th>
                    <th className="px-3 py-2 font-medium">Doc</th>
                    <th className="px-3 py-2 font-medium">Style</th>
                    <th className="px-3 py-2 font-medium">Sub</th>
                    <th className="px-3 py-2 font-medium">Customer PO</th>
                    <th className="px-3 py-2 font-medium">Brand</th>
                    <th className="px-3 py-2 font-medium text-right">QTY</th>
                    <th className="px-3 py-2 font-medium text-right">น้ำหนัก (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {soMatches.map(r => (
                    <tr key={r.id} onClick={() => toggle(r.id)}
                      className={`border-t border-gray-100 cursor-pointer ${selected.has(r.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      <td className="px-3 py-1.5"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} onClick={e => e.stopPropagation()} className="rounded border-gray-300" /></td>
                      <td className="px-3 py-1.5 font-bold text-gray-900">{r.so} {(r.invoiceNo || r.hawbNo || r.actualAirFreight != null) && <span className="text-[9px] px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 align-middle" title="มี draft (เริ่มกรอกแล้ว)">📝</span>}</td>
                      <td className="px-3 py-1.5 text-blue-700">{r.request.documentNo}</td>
                      <td className="px-3 py-1.5 text-gray-700">{r.style || "-"}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.sub || "-"}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.customerPO || "-"}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.brand || "-"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.qtyRequestAir)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.grossWeight != null ? fmtNum(r.grossWeight) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && !searching && brands.length === 0 && <div className="text-center py-20 text-gray-400">No SOs waiting on LG</div>}

      {!searching && brands.map(({ brand, docs, count, ids, draftCount, draftIds }) => {
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
                  // Header EST/ACT = the WHOLE document (matches AIR REQUESTS), not just the unbooked pool.
                  const allItems = (req.items && req.items.length ? req.items : items)
                  const est = allItems.reduce((s: number, i: any) => s + (i.airFreight || 0), 0)
                  const act = allItems.reduce((s: number, i: any) => s + (i.actualAirFreight || 0), 0)
                  const cur = (req.bu === "EA" || String(req.documentNo || "").startsWith("AIR_EA")) ? "USD" : "THB" // EA prices in USD
                  const docIds = items.map((i: any) => i.id)
                  const docAllOn = docIds.every((id: string) => selected.has(id))
                  const docDraft = items.filter((i: any) => i.invoiceNo || i.hawbNo || i.actualAirFreight != null).length
                  return (
                    <div key={req.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center gap-2">
                        <input type="checkbox" checked={docAllOn} onChange={() => toggleMany(docIds, !docAllOn)} className="rounded" />
                        <button onClick={() => openDoc(docIds)} className="font-semibold text-blue-600 hover:underline text-sm" title="Open in LG booking">{req.documentNo}</button>
                        {req.lgForwardEmail && (() => {
                          const names = (req.lgForwardNames?.length ? req.lgForwardNames : req.lgForwardName ? [req.lgForwardName] : req.lgForwardEmails || [req.lgForwardEmail]).join(", ")
                          return (
                            <span title={`Forwarded to ${names}${req.lgForwardBy ? " by " + req.lgForwardBy : ""}`}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300 font-medium whitespace-nowrap">
                              ↪ FW: {names}
                            </span>
                          )
                        })()}
                        {docDraft > 0 && <span role="button" tabIndex={0} title="กดเพื่อเลือก SO ที่มี draft ในเอกสารนี้"
                          onClick={e => { e.stopPropagation(); toggleMany(items.filter((i: any) => i.invoiceNo || i.hawbNo || i.actualAirFreight != null).map((i: any) => i.id), true) }}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-medium whitespace-nowrap cursor-pointer hover:bg-amber-200">📝 draft {docDraft} SO ✓</span>}
                        <span className="text-xs text-gray-500">{req.bu}</span>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">EST {fmtNum(est)} {cur}</span>
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">ACT {fmtNum(act)} {cur}</span>
                        <span className="text-xs text-gray-400">{allItems.length} transaction · <span className="text-amber-600 font-medium">เหลือ {items.length} รอกรอก actual</span></span>
                      </div>
                      <LgDocTable items={items} cur={cur} selected={selected} onToggle={toggle} />
                      {/* No air — CANCEL only the ticked SOs of THIS document (doc stays for air SOs) */}
                      <div className="px-4 py-2 border-t border-gray-100 flex justify-end">
                        <button onClick={() => openNoAir(req, docIds)}
                          className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 font-medium">
                          ✕ No air — ยกเลิกเฉพาะ SO ที่เลือก
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
            <div className="bg-red-600 text-white px-5 py-3 font-semibold text-sm">No air — ยกเลิก {noAir.ids.length} SO</div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">{noAir.docNo} · เลือก {noAir.ids.length} SO — ยืนยันว่าไม่ได้ออก air? <b>เฉพาะ SO ที่เลือกจะถูกยกเลิก</b> (เอกสารยังอยู่ให้กรอก actual ต่อสำหรับ SO ที่ออก air)</p>
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

function Cell({ label, value }: { label: string; value: any }) {
  const v = value === null || value === undefined || value === "" ? "-" : value
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-xs text-gray-800 truncate" title={String(v)}>{v}</div>
    </div>
  )
}

function FField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={`filter ${label}…`}
        className="w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
    </div>
  )
}
