"use client"
import { useEffect, useMemo, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"

// LG BOOKING — combined entry. Works on the SOs the LG ticked on the landing page (which may span
// several documents). Inline table grouped by brand: type INV + HAWB# right in the row, enter one
// Total Air per HAWB (shared by every row with the same HAWB#, even across documents) → ACTUAL is
// computed live as Total × qty ÷ Σqty. Save books them; Send Back returns an SO before claim.
const fmt = (n: number, dec = 2) => (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmt0 = (n: any) => n != null ? Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-"
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` }

export default function LgEntryPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const roles: string[] = [role, ...(((session?.user as any)?.roles) || [])]
  const allowed = role === "ADMIN" || roles.some(r => ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM"].includes(r))

  const [entryIds, setEntryIds] = useState<string[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Inline inputs (unbooked rows)
  const [rowInv, setRowInv] = useState<Record<string, string>>({})
  const [rowHawb, setRowHawb] = useState<Record<string, string>>({})
  const [totalByHawb, setTotalByHawb] = useState<Record<string, string>>({})

  // Send-back modal
  const [sbItem, setSbItem] = useState<any>(null)
  const [sbReason, setSbReason] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const d = await fetch("/api/requests").then(r => r.json())
    setRequests(Array.isArray(d) ? d : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    try { setEntryIds(JSON.parse(sessionStorage.getItem("lg_entry_ids") || "[]")) } catch { setEntryIds([]) }
    load()
  }, [load])

  // LG works in PARALLEL with claim → bookable statuses differ by BU.
  const bookableOf = (bu: string) => bu === "GW" ? ["PRES_PASSED"] : ["LOG_PASSED", "CLAIM_PASSED", "PRES_PASSED"]

  // Selected SOs (still bookable by LG), each carrying its parent document.
  const myItems = useMemo(() => {
    const idset = new Set(entryIds)
    const out: any[] = []
    for (const r of requests) {
      if (r.logisticsSent) continue
      const bookable = bookableOf(r.bu || "NYG")
      for (const it of (r.items || [])) {
        if (!idset.has(it.id)) continue
        if (!bookable.includes(it.itemStatus)) continue
        out.push({ ...it, request: r, brand: it.brand || r.brandName || "(no brand)" })
      }
    }
    return out
  }, [requests, entryIds])

  // Prefill inputs from DB once loaded (booked rows have hawbNo/invoiceNo/actual).
  useEffect(() => {
    const inv: Record<string, string> = {}, hawb: Record<string, string> = {}, tot: Record<string, string> = {}
    const sumByHawb: Record<string, number> = {}
    for (const it of myItems) {
      if (it.invoiceNo) inv[it.id] = it.invoiceNo
      if (it.hawbNo) { hawb[it.id] = it.hawbNo; sumByHawb[it.hawbNo] = (sumByHawb[it.hawbNo] || 0) + (it.actualAirFreight || 0) }
    }
    for (const [h, s] of Object.entries(sumByHawb)) tot[h] = String(Math.round(s))
    setRowInv(p => ({ ...inv, ...p })); setRowHawb(p => ({ ...hawb, ...p })); setTotalByHawb(p => ({ ...tot, ...p }))
  }, [myItems.length])

  const qtyOf = (it: any) => it.qtyActualShip ?? it.qtyRequestAir

  // Live ACTUAL per row: Total(hawb) × qty ÷ Σqty of rows sharing that HAWB# across the whole selection.
  const actualOf = useCallback((it: any) => {
    if (it.hawbNo && it.actualAirFreight != null) return it.actualAirFreight // already booked in DB
    const h = (rowHawb[it.id] || "").trim()
    const total = parseFloat(totalByHawb[h] || "") || 0
    if (!h || total <= 0) return null
    const peers = myItems.filter(x => (x.hawbNo ? x.hawbNo : (rowHawb[x.id] || "").trim()) === h)
    const sumQty = peers.reduce((s, x) => s + qtyOf(x), 0)
    return sumQty > 0 ? (total * qtyOf(it)) / sumQty : null
  }, [rowHawb, totalByHawb, myItems])

  // Group by brand for display.
  const brands = useMemo(() => {
    const g: Record<string, any[]> = {}
    for (const it of myItems) (g[it.brand] ||= []).push(it)
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]))
  }, [myItems])

  const setHawb = (id: string, v: string) => setRowHawb(p => ({ ...p, [id]: v }))
  const setTotal = (h: string, v: string) => setTotalByHawb(p => ({ ...p, [h]: v }))

  // Save = for every HAWB# entered on unbooked rows with a Total, create the cross-doc HAWB.
  const saveAll = async () => {
    const groups: Record<string, { total: number; items: { id: string; invoiceNo?: string }[] }> = {}
    for (const it of myItems) {
      if (it.hawbNo) continue // already booked
      const h = (rowHawb[it.id] || "").trim()
      const total = parseFloat(totalByHawb[h] || "") || 0
      if (!h || total <= 0) continue
      if (!groups[h]) groups[h] = { total, items: [] }
      groups[h].items.push({ id: it.id, invoiceNo: rowInv[it.id]?.trim() || undefined })
    }
    const entries = Object.entries(groups)
    if (entries.length === 0) { alert("ยังไม่มี HAWB# + Total Air ที่จะบันทึก"); return }
    setSaving(true)
    let ok = 0
    for (const [hawbNo, g] of entries) {
      const res = await fetch("/api/logistics/hawb", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hawbNo, totalCharge: g.total, items: g.items }),
      })
      if (res.ok) ok++
    }
    await load()
    setSaving(false)
    alert(`บันทึก ${ok}/${entries.length} HAWB`)
  }

  const deleteHawb = async (hNo: string) => {
    if (!confirm(`ลบ HAWB ${hNo} และล้างค่า actual ของ SO ที่เกี่ยวข้อง?`)) return
    setBusy(hNo)
    const res = await fetch("/api/logistics/hawb", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hawbNo: hNo }) })
    if (res.ok) { setTotalByHawb(p => { const n = { ...p }; delete n[hNo]; return n }); await load() } else alert("ลบไม่สำเร็จ")
    setBusy(null)
  }

  const sendBack = async () => {
    if (!sbItem || !sbReason.trim()) return
    setBusy(sbItem.id)
    const res = await fetch(`/api/requests/${sbItem.request.id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lg_reject_so", itemId: sbItem.id, comment: sbReason.trim() }),
    })
    if (res.ok) { setSbItem(null); setSbReason(""); await load() } else alert("Send back ไม่สำเร็จ")
    setBusy(null)
  }

  const sendDoc = async (req: any) => {
    if (req.bu === "GW") return
    if (!confirm(`ส่งต่อเอกสาร ${req.documentNo} ไปขั้นถัดไป?`)) return
    setBusy(req.id)
    const res = await fetch(`/api/requests/${req.id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_logistics_draft", lgComplete: true }),
    })
    if (res.ok) await load(); else alert("ส่งต่อไม่สำเร็จ")
    setBusy(null)
  }

  // Documents represented — with send-onward eligibility (all their bookable SOs now booked).
  const involvedDocs = useMemo(() => {
    const ids = new Set(myItems.map(i => i.request.id))
    return requests.filter(r => ids.has(r.id)).map(r => {
      const bookable = bookableOf(r.bu || "NYG")
      const pres = (r.items || []).filter((i: any) => bookable.includes(i.itemStatus))
      const unbooked = pres.filter((i: any) => !i.hawbNo)
      return { req: r, eligible: pres.length > 0 && unbooked.length === 0, remaining: unbooked.length }
    })
  }, [requests, myItems])

  if (!allowed) return <div className="text-center py-20 text-gray-400">เฉพาะ Logistics / Admin เท่านั้น</div>

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <Link href="/logistics" className="text-sm text-blue-600 hover:underline">← LG BOOKING</Link>
        <h1 className="text-xl font-bold text-gray-900">กรอก HAWB ({myItems.length} transaction)</h1>
      </div>

      {loading && <div className="text-center py-10 text-gray-400">Loading...</div>}
      {!loading && myItems.length === 0 && (
        <div className="text-center py-20 text-gray-400">ไม่มี SO ที่เลือก — กลับไป <Link href="/logistics" className="text-blue-600 underline">LG BOOKING</Link> เพื่อเลือกใหม่</div>
      )}

      {brands.map(([brand, items]) => (
        <div key={brand} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">🏷 {brand}</span>
            <span className="text-xs text-gray-400">{items.length} transaction</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-50 border-b"><tr>
                {["DOC NO","SO","STYLE","SUB","PLAN DATE","QTY AIR","INV NO","HAWB#","TOTAL AIR (THB)","ACTUAL (คำนวณ)",""].map(h =>
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it: any) => {
                  const booked = !!it.hawbNo
                  const h = (rowHawb[it.id] || "").trim()
                  const act = actualOf(it)
                  return (
                    <tr key={it.id} className={booked ? "bg-green-50/50" : "hover:bg-blue-50/30"}>
                      <td className="px-3 py-2"><Link href={`/requests/${it.request.id}`} className="text-blue-600 hover:underline font-medium">{it.request.documentNo}</Link> <span className="text-gray-400">{it.request.bu}</span></td>
                      <td className="px-3 py-2 font-medium">{it.so}</td>
                      <td className="px-3 py-2">{it.style}</td>
                      <td className="px-3 py-2">{it.sub || "-"}</td>
                      <td className="px-3 py-2">{fmtDate(it.planShipmentDate)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{qtyOf(it)}</td>
                      {booked ? (
                        <>
                          <td className="px-3 py-2"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{it.invoiceNo || "-"}</span></td>
                          <td className="px-3 py-2"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{it.hawbNo}</span></td>
                          <td className="px-3 py-2 text-gray-400">—</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt0(it.actualAirFreight)}</td>
                          <td className="px-3 py-2"><button disabled={busy === it.hawbNo} onClick={() => deleteHawb(it.hawbNo)} className="text-[11px] text-red-500 hover:text-red-700 underline">ลบ HAWB</button></td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            <input value={rowInv[it.id] || ""} onChange={e => setRowInv(p => ({ ...p, [it.id]: e.target.value }))} placeholder="INV"
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={rowHawb[it.id] || ""} onChange={e => setHawb(it.id, e.target.value)} placeholder="HAWB#"
                              className="w-32 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" value={h ? (totalByHawb[h] || "") : ""} disabled={!h} onChange={e => setTotal(h, e.target.value)} placeholder={h ? "Total" : "—"}
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40" />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-green-700">{act != null ? fmt0(act) : <span className="text-gray-300">-</span>}</td>
                          <td className="px-3 py-2"><button onClick={() => { setSbItem(it); setSbReason("") }} className="text-[11px] text-red-500 hover:text-red-700 underline flex items-center gap-0.5">↩ Send Back</button></td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Send documents onward */}
      {involvedDocs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 shadow-sm">
          <p className="text-sm font-semibold text-gray-700">ส่งต่อเอกสาร (เมื่อ book ครบทุก SO ของเอกสาร)</p>
          {involvedDocs.map(({ req, eligible, remaining }) => (
            <div key={req.id} className="flex items-center gap-3 text-xs border-b last:border-0 py-1.5">
              <Link href={`/requests/${req.id}`} className="text-blue-600 hover:underline font-medium">{req.documentNo}</Link>
              <span className="text-gray-400">{req.bu}</span>
              {remaining > 0 ? <span className="text-amber-600">เหลือ {remaining} SO ยังไม่ book</span> : <span className="text-green-600">book ครบแล้ว</span>}
              <div className="ml-auto">
                {req.bu === "GW"
                  ? <Link href={`/requests/${req.id}`} className="text-xs bg-slate-100 border border-slate-300 text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-200 font-medium">ส่งต่อที่หน้าเอกสาร (GW) →</Link>
                  : <button disabled={!eligible || busy === req.id} onClick={() => sendDoc(req)} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">{busy === req.id ? "..." : "ส่งต่อ →"}</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky save bar */}
      {myItems.some((i: any) => !i.hawbNo) && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white border-t shadow-lg px-6 py-3 flex items-center gap-3 z-40">
          <span className="text-xs text-gray-500">ใส่ HAWB# + Total Air แล้วกดบันทึก — ระบบหาร actual ตาม qty (HAWB เดียวข้ามเอกสารได้)</span>
          <button onClick={saveAll} disabled={saving} className="ml-auto bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึก HAWB"}</button>
        </div>
      )}

      {/* Send back modal */}
      {sbItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-red-600 text-white px-5 py-3 font-semibold text-sm">Send back SO {sbItem.so}</div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">{sbItem.request.documentNo} · SO {sbItem.so} — ส่งกลับก่อน claim (แจ้ง MER/SCM)</p>
              <textarea value={sbReason} onChange={e => setSbReason(e.target.value)} rows={3} placeholder="เหตุผล (เช่น ไม่ได้ air จริง / 0 claim)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              <div className="flex gap-2">
                <button onClick={() => setSbItem(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
                <button onClick={sendBack} disabled={!sbReason.trim() || busy === sbItem.id} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">{busy === sbItem.id ? "..." : "Send back"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
