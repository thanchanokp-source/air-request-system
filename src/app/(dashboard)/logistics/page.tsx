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
  const allowed = isAdmin || roles.some(r => ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM"].includes(r))

  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openBrands, setOpenBrands] = useState<Set<string>>(new Set())
  const toggleBrand = (b: string) => setOpenBrands(p => { const n = new Set(p); n.has(b) ? n.delete(b) : n.add(b); return n })

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => { setRequests(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const lgBus = useMemo(() => {
    if (isAdmin) return new Set(["NYG", "EA", "TRM", "GW"])
    const s = new Set<string>()
    if (roles.includes("LOGISTICS")) s.add(userBu === "EA" ? "EA" : "NYG")
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
      return { brand, docs, count: brandRows.length, ids: brandRows.map(r => r.id) }
    })
  }, [rows, q])

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleMany = (ids: string[], on: boolean) => setSelected(p => { const n = new Set(p); ids.forEach(id => on ? n.add(id) : n.delete(id)); return n })

  const openSelected = () => {
    if (selected.size === 0) return
    sessionStorage.setItem("lg_entry_ids", JSON.stringify([...selected]))
    router.push("/logistics/entry")
  }

  if (!allowed) return <div className="text-center py-20 text-gray-400">เฉพาะ Logistics / Admin เท่านั้น</div>

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LG BOOKING</h1>
        <p className="text-xs text-gray-400 mt-0.5">เลือก SO ที่จะ book (ข้ามเอกสารในแต่ละ brand ได้) แล้วกด "เปิดทำงาน" → กรอก HAWB เดียวครอบ SO ที่เลือก</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหา brand / SO / เลขเอกสาร…"
        className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      {loading && <div className="text-center py-10 text-gray-400">Loading...</div>}
      {!loading && brands.length === 0 && <div className="text-center py-20 text-gray-400">ไม่มี SO ที่รอ LG</div>}

      {brands.map(({ brand, docs, count, ids }) => {
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
              </button>
            </div>

            {open && (
              <div className="p-3 space-y-2.5 bg-gray-50/40">
                {docs.map(({ request: req, items }) => {
                  const est = items.reduce((s: number, i: any) => s + (i.airFreight || 0), 0)
                  const act = items.reduce((s: number, i: any) => s + (i.actualAirFreight || 0), 0)
                  const docIds = items.map((i: any) => i.id)
                  const docAllOn = docIds.every((id: string) => selected.has(id))
                  return (
                    <div key={req.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center gap-2">
                        <input type="checkbox" checked={docAllOn} onChange={() => toggleMany(docIds, !docAllOn)} className="rounded" />
                        <Link href={`/requests/${req.id}`} className="font-semibold text-blue-600 hover:underline text-sm">{req.documentNo}</Link>
                        <span className="text-xs text-gray-500">{req.bu}</span>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">EST {fmtNum(est)} THB</span>
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">ACT {fmtNum(act)} THB</span>
                        <span className="text-xs text-gray-400">{items.length} transaction</span>
                        <Link href={`/requests/${req.id}`} className="ml-auto text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">Open →</Link>
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
          <span className="text-sm font-medium text-gray-700">เลือกแล้ว {selected.size} transaction</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-red-600 underline">ล้าง</button>
          <button onClick={openSelected} className="ml-auto bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">
            เปิดทำงาน {selected.size} transaction →
          </button>
        </div>
      )}
    </div>
  )
}
