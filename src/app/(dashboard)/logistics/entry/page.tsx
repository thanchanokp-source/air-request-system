"use client"
import { useEffect, useMemo, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"

// LG BOOKING — combined entry for the SOs ticked on the landing page (may span several documents).
// Flow: (1) enter Invoice per SO, (2) group SOs into a HAWB with one Total Air → ACTUAL is generated
// per transaction, one HAWB can span documents. QTY Air / Plan Ship Date are editable (default = the
// value MER entered). Buttons: Forward (hand off to a subordinate), Save Draft, Send (advance).
const fmt0 = (n: any) => n != null ? Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-"
const toDateInput = (v: any) => { if (!v) return ""; const d = new Date(v); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10) }

export default function LgEntryPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const roles: string[] = [role, ...(((session?.user as any)?.roles) || [])]
  const allowed = role === "ADMIN" || roles.some(r => ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM"].includes(r))

  const [entryIds, setEntryIds] = useState<string[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // Per-SO inputs
  const [rowInv, setRowInv] = useState<Record<string, string>>({})
  const [rowQty, setRowQty] = useState<Record<string, string>>({})
  const [rowDate, setRowDate] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Set<string>>(new Set())

  // Bulk-action inputs
  const [invBulk, setInvBulk] = useState("")
  const [hawbInput, setHawbInput] = useState("")
  const [totalInput, setTotalInput] = useState("")

  // Send-back + forward modals
  const [sbItem, setSbItem] = useState<any>(null)
  const [sbReason, setSbReason] = useState("")
  const [fwOpen, setFwOpen] = useState(false)
  const [fwEmail, setFwEmail] = useState("")
  const [fwName, setFwName] = useState("")
  const [fwNote, setFwNote] = useState("")
  const [fwTargets, setFwTargets] = useState<any[]>([])

  const load = useCallback(async () => {
    const d = await fetch("/api/requests").then(r => r.json())
    setRequests(Array.isArray(d) ? d : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    try { setEntryIds(JSON.parse(sessionStorage.getItem("lg_entry_ids") || "[]")) } catch { setEntryIds([]) }
    load()
    // LG-capable people from master (for the Forward picker).
    fetch("/api/users/lg-forward-targets").then(r => r.json()).then(d => setFwTargets(Array.isArray(d) ? d : [])).catch(() => {})
  }, [load])

  const bookableOf = (bu: string) => bu === "GW" ? ["PRES_PASSED"] : ["LOG_PASSED", "CLAIM_PASSED", "PRES_PASSED"]

  // Selected SOs (still bookable), each carrying its parent document.
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

  // Prefill inputs from DB once (INV / QTY / Ship Date default to what MER entered).
  useEffect(() => {
    const inv: Record<string, string> = {}, qty: Record<string, string> = {}, date: Record<string, string> = {}
    for (const it of myItems) {
      if (it.invoiceNo) inv[it.id] = it.invoiceNo
      qty[it.id] = String(it.qtyActualShip ?? it.qtyRequestAir ?? "")
      date[it.id] = toDateInput(it.planShipmentDate)
    }
    setRowInv(p => ({ ...inv, ...p })); setRowQty(p => ({ ...qty, ...p })); setRowDate(p => ({ ...date, ...p }))
  }, [myItems.length])

  // Group by brand.
  const brands = useMemo(() => {
    const g: Record<string, any[]> = {}
    for (const it of myItems) (g[it.brand] ||= []).push(it)
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]))
  }, [myItems])

  const toggle = (id: string) => setChecked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const unbookedItems = myItems.filter(i => !i.hawbNo)

  // Persist QTY / Ship Date edits + INV (draft) for the given items, grouped per document.
  const saveDraftFor = async (items: any[]) => {
    const byDoc: Record<string, any[]> = {}
    for (const it of items) (byDoc[it.request.id] ||= []).push(it)
    for (const [reqId, docItems] of Object.entries(byDoc)) {
      const itemLogistics: Record<string, any> = {}
      const itemShipData: Record<string, any> = {}
      for (const it of docItems) {
        if (!it.hawbNo && rowInv[it.id]?.trim()) itemLogistics[it.id] = { invoiceNo: rowInv[it.id].trim() }
        const q = rowQty[it.id], d = rowDate[it.id]
        const origQ = String(it.qtyActualShip ?? it.qtyRequestAir ?? ""), origD = toDateInput(it.planShipmentDate)
        const sd: any = {}
        if (q != null && q !== "" && q !== origQ) sd.qtyRequestAir = q
        if (d && d !== origD) sd.planShipmentDate = d
        if (Object.keys(sd).length) itemShipData[it.id] = sd
      }
      if (!Object.keys(itemLogistics).length && !Object.keys(itemShipData).length) continue
      await fetch(`/api/requests/${reqId}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_logistics_draft", itemLogistics, itemShipData }),
      })
    }
  }

  const applyInvToChecked = () => {
    if (!invBulk.trim() || checked.size === 0) { alert("กรอก INV และเลือก SO ก่อน"); return }
    setRowInv(p => { const n = { ...p }; checked.forEach(id => n[id] = invBulk.trim()); return n })
    setInvBulk("")
  }

  // Create a cross-document HAWB for the checked SOs → generates ACTUAL per transaction.
  const createHawb = async () => {
    const sel = unbookedItems.filter(i => checked.has(i.id))
    if (sel.length === 0) { alert("เลือก SO ที่จะรวมเป็น HAWB ก่อน"); return }
    if (!hawbInput.trim()) { alert("กรอก HAWB No"); return }
    const total = parseFloat(totalInput) || 0
    if (total <= 0) { alert("กรอก Total Air (THB)"); return }
    const missingInv = sel.filter(i => !rowInv[i.id]?.trim())
    if (missingInv.length) { alert(`กรอก Invoice ให้ครบก่อน (ขาด ${missingInv.length} SO)`); return }
    setBusy("hawb")
    // 1) persist any QTY/date edits first so ACTUAL divides by the correct qty.
    await saveDraftFor(sel)
    // 2) create the cross-doc HAWB (server computes actual = total × qty ÷ Σqty).
    const res = await fetch("/api/logistics/hawb", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hawbNo: hawbInput.trim(), totalCharge: total, items: sel.map(i => ({ id: i.id, invoiceNo: rowInv[i.id]?.trim() })) }),
    })
    if (res.ok) { setHawbInput(""); setTotalInput(""); setChecked(new Set()); await load() }
    else alert((await res.json().catch(() => ({})))?.error || "สร้าง HAWB ไม่สำเร็จ")
    setBusy(null)
  }

  const deleteHawb = async (hNo: string) => {
    if (!confirm(`ลบ HAWB ${hNo} และล้างค่า actual ของ SO ที่เกี่ยวข้อง?`)) return
    setBusy(hNo)
    const res = await fetch("/api/logistics/hawb", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hawbNo: hNo }) })
    if (res.ok) await load(); else alert("ลบไม่สำเร็จ")
    setBusy(null)
  }

  const saveDraft = async () => {
    setBusy("draft"); await saveDraftFor(myItems); await load(); setBusy(null); alert("บันทึกร่างแล้ว")
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

  // Documents represented — eligibility to send onward (all their bookable SOs now booked).
  const involvedDocs = useMemo(() => {
    const ids = new Set(myItems.map(i => i.request.id))
    return requests.filter(r => ids.has(r.id)).map(r => {
      const bookable = bookableOf(r.bu || "NYG")
      const pres = (r.items || []).filter((i: any) => bookable.includes(i.itemStatus))
      const unbooked = pres.filter((i: any) => !i.hawbNo)
      return { req: r, eligible: pres.length > 0 && unbooked.length === 0, remaining: unbooked.length }
    })
  }, [requests, myItems])

  const send = async () => {
    const eligible = involvedDocs.filter(d => d.eligible && d.req.bu !== "GW")
    const gwEligible = involvedDocs.filter(d => d.eligible && d.req.bu === "GW")
    if (eligible.length === 0 && gwEligible.length === 0) { alert("ยังไม่มีเอกสารที่ book ครบ (book ทุก SO ก่อนส่ง)"); return }
    if (!confirm(`ส่งต่อ ${eligible.length} เอกสารที่ book ครบแล้ว?${gwEligible.length ? ` (GW ${gwEligible.length} เอกสาร ให้ส่งที่หน้าเอกสาร)` : ""}`)) return
    setBusy("send")
    await saveDraftFor(myItems)
    for (const d of eligible) {
      await fetch(`/api/requests/${d.req.id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_logistics_draft", lgComplete: true }),
      })
    }
    await load(); setBusy(null)
    alert(`ส่งต่อแล้ว ${eligible.length} เอกสาร${gwEligible.length ? ` · GW ${gwEligible.length} เอกสารกรุณาส่งที่หน้าเอกสาร` : ""}`)
  }

  const forward = async () => {
    if (!fwEmail.trim().endsWith("@nanyangtextile.com")) { alert("กรอกอีเมล @nanyangtextile.com"); return }
    setBusy("fw")
    const ids = [...new Set(myItems.map(i => i.request.id))]
    let ok = 0
    for (const reqId of ids) {
      const res = await fetch(`/api/requests/${reqId}/lg-forward`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: fwEmail.trim(), toName: fwName.trim() || fwEmail.trim(), note: fwNote.trim() }),
      })
      if (res.ok) ok++
    }
    setBusy(null); setFwOpen(false); setFwEmail(""); setFwName(""); setFwNote("")
    alert(`ส่งต่อให้ ${fwName || fwEmail} แล้ว ${ok}/${ids.length} เอกสาร`)
  }

  if (!allowed) return <div className="text-center py-20 text-gray-400">เฉพาะ Logistics / Admin เท่านั้น</div>

  const hasUnbooked = myItems.some((i: any) => !i.hawbNo)

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

      {/* Step actions */}
      {hasUnbooked && (
        <div className="grid md:grid-cols-2 gap-3">
          {/* 1. Invoice */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 shadow-sm">
            <p className="text-sm font-semibold text-gray-700"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs mr-1.5">1</span> Invoice</p>
            <p className="text-xs text-gray-400">ติ๊กเลือก SO ในตาราง แล้วกรอก INV → กด "ใส่ INV ให้ที่เลือก" (หรือพิมพ์ในช่อง INV ของแต่ละแถวก็ได้)</p>
            <div className="flex items-center gap-2">
              <input value={invBulk} onChange={e => setInvBulk(e.target.value)} placeholder="INV No."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={applyInvToChecked} className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-700 whitespace-nowrap">ใส่ INV ให้ที่เลือก ({checked.size})</button>
            </div>
          </div>
          {/* 2. HAWB */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 shadow-sm">
            <p className="text-sm font-semibold text-gray-700"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs mr-1.5">2</span> HAWB → generate Actual</p>
            <p className="text-xs text-gray-400">เลือก SO ที่มี INV แล้ว กรอก HAWB No + Total Air → ระบบหาร actual ให้ตาม qty (HAWB เดียวข้ามเอกสารได้)</p>
            <div className="flex items-center gap-2">
              <input value={hawbInput} onChange={e => setHawbInput(e.target.value)} placeholder="HAWB No."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input type="number" value={totalInput} onChange={e => setTotalInput(e.target.value)} placeholder="Total Air (THB)"
                className="w-36 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={createHawb} disabled={busy === "hawb"} className="text-xs bg-slate-800 text-white px-3 py-2 rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">{busy === "hawb" ? "..." : `สร้าง HAWB (${checked.size})`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Table grouped by brand */}
      {brands.map(([brand, items]) => (
        <div key={brand} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-gray-50/70 border-b flex items-center gap-2">
            {items.some((i: any) => !i.hawbNo) && (() => {
              const bIds = items.filter((i: any) => !i.hawbNo).map((i: any) => i.id)
              const allOn = bIds.every((id: string) => checked.has(id))
              return <input type="checkbox" checked={allOn} onChange={() => setChecked(p => { const n = new Set(p); bIds.forEach((id: string) => allOn ? n.delete(id) : n.add(id)); return n })} className="rounded" />
            })()}
            <span className="text-sm font-semibold text-gray-700">{brand}</span>
            <span className="text-xs text-gray-400">{items.length} transaction</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-50 border-b"><tr>
                <th className="px-2 py-2 w-8"></th>
                {["DOC NO","SO","STYLE","SUB","QTY AIR *","PLAN DATE *","INV NO","HAWB#","ACTUAL (คำนวณ)",""].map(h =>
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it: any) => {
                  const booked = !!it.hawbNo
                  return (
                    <tr key={it.id} className={booked ? "bg-green-50/50" : checked.has(it.id) ? "bg-blue-50" : "hover:bg-blue-50/30"}>
                      <td className="px-2 py-2">{!booked && <input type="checkbox" checked={checked.has(it.id)} onChange={() => toggle(it.id)} className="rounded" />}</td>
                      <td className="px-3 py-2"><Link href={`/requests/${it.request.id}`} className="text-blue-600 hover:underline font-medium">{it.request.documentNo}</Link> <span className="text-gray-400">{it.request.bu}</span></td>
                      <td className="px-3 py-2 font-medium">{it.so}</td>
                      <td className="px-3 py-2">{it.style}</td>
                      <td className="px-3 py-2">{it.sub || "-"}</td>
                      {/* Editable QTY Air (default = MER) */}
                      <td className="px-3 py-2">
                        <input type="number" value={rowQty[it.id] ?? ""} onChange={e => setRowQty(p => ({ ...p, [it.id]: e.target.value }))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-right" />
                      </td>
                      {/* Editable Plan Ship Date (default = MER) */}
                      <td className="px-3 py-2">
                        <input type="date" value={rowDate[it.id] ?? ""} onChange={e => setRowDate(p => ({ ...p, [it.id]: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      {booked ? (
                        <>
                          <td className="px-3 py-2"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{it.invoiceNo || "-"}</span></td>
                          <td className="px-3 py-2"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{it.hawbNo}</span></td>
                          <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt0(it.actualAirFreight)}</td>
                          <td className="px-3 py-2"><button disabled={busy === it.hawbNo} onClick={() => deleteHawb(it.hawbNo)} className="text-[11px] text-red-500 hover:text-red-700 underline">ลบ HAWB</button></td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            <input value={rowInv[it.id] || ""} onChange={e => setRowInv(p => ({ ...p, [it.id]: e.target.value }))} placeholder="INV"
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-3 py-2 text-gray-300">—</td>
                          <td className="px-3 py-2 text-right text-gray-300">-</td>
                          <td className="px-3 py-2"><button onClick={() => { setSbItem(it); setSbReason("") }} className="text-[11px] text-red-500 hover:text-red-700 underline">↩ Send Back</button></td>
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

      {myItems.length > 0 && <p className="text-[11px] text-gray-400">* QTY Air / Plan Date แก้ไขได้ — ถ้าไม่แก้ ระบบยึดค่าที่ MER กรอกมา</p>}

      {/* Send status per document */}
      {involvedDocs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1.5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700">สถานะการ book ต่อเอกสาร</p>
          {involvedDocs.map(({ req, eligible, remaining }) => (
            <div key={req.id} className="flex items-center gap-3 text-xs border-b last:border-0 py-1.5">
              <Link href={`/requests/${req.id}`} className="text-blue-600 hover:underline font-medium">{req.documentNo}</Link>
              <span className="text-gray-400">{req.bu}</span>
              {remaining > 0 ? <span className="text-amber-600">เหลือ {remaining} SO ยังไม่ book</span> : <span className="text-green-600 font-medium">✓ book ครบแล้ว</span>}
              {req.bu === "GW" && eligible && <Link href={`/requests/${req.id}`} className="ml-auto text-slate-600 underline">ส่งที่หน้าเอกสาร (GW) →</Link>}
            </div>
          ))}
        </div>
      )}

      {/* Sticky action bar: Forward / Save Draft / Send */}
      {myItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white border-t shadow-lg px-6 py-3 flex items-center gap-3 z-40">
          <button onClick={() => setFwOpen(true)} className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50">↪ Forward</button>
          <button onClick={saveDraft} disabled={busy === "draft"} className="text-sm border border-blue-300 text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 disabled:opacity-50">{busy === "draft" ? "..." : "💾 Save Draft"}</button>
          <button onClick={send} disabled={busy === "send"} className="ml-auto bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">{busy === "send" ? "..." : "Send →"}</button>
        </div>
      )}

      {/* Forward modal */}
      {fwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-slate-800 text-white px-5 py-3 font-semibold text-sm">Forward ให้ผู้ใต้บังคับบัญชา</div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">ส่งต่อ {[...new Set(myItems.map(i => i.request.documentNo))].length} เอกสารให้กรอกต่อ (ส่งลิงก์เข้าอีเมล)</p>
              <label className="block text-xs font-medium text-gray-600">เลือกผู้รับ (คน LG จาก master)</label>
              <select value={fwEmail} onChange={e => { const u = fwTargets.find(t => t.email === e.target.value); setFwEmail(e.target.value); setFwName(u?.name || "") }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">— เลือกผู้รับ —</option>
                {fwTargets.map(t => <option key={t.email} value={t.email}>{t.name || t.email} ({t.email})</option>)}
              </select>
              {fwTargets.length === 0 && <p className="text-[11px] text-amber-600">ไม่พบรายชื่อ LG ใน master</p>}
              <textarea value={fwNote} onChange={e => setFwNote(e.target.value)} rows={2} placeholder="หมายเหตุ (ไม่บังคับ)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="flex gap-2">
                <button onClick={() => setFwOpen(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
                <button onClick={forward} disabled={busy === "fw"} className="flex-1 bg-slate-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">{busy === "fw" ? "..." : "Forward"}</button>
              </div>
            </div>
          </div>
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
