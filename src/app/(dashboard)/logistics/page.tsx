"use client"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

// LG BOOKING — Logistics workspace. Shows every SO waiting on Logistics ACROSS documents, grouped
// by BRAND (so one HAWB can span documents). LG selects SOs, enters INV + HAWB# + the total
// EXPENSE/HAWB per HAWB group → actual air is split per SO by QTY Air. SOs that won't air → Send
// Back to Merchandise. Reuses the per-document endpoints (save_logistics_draft / lg_reject_so).
const fmt = (n: number) => (n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` }

export default function LgBookingPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const roles: string[] = [role, ...(((session?.user as any)?.roles) || [])]
  const userBu = (session?.user as any)?.bu || "NYG"
  const isAdmin = role === "ADMIN"
  const allowed = isAdmin || roles.some(r => ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM"].includes(r))

  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [inv, setInv] = useState<Record<string, string>>({})
  const [hawb, setHawb] = useState<Record<string, string>>({})
  const [hawbTotal, setHawbTotal] = useState<Record<string, string>>({}) // keyed by HAWB# (cross-doc)
  const [busy, setBusy] = useState(false)
  const [sendBackId, setSendBackId] = useState<string | null>(null)
  const [sendBackReason, setSendBackReason] = useState("")
  const [msg, setMsg] = useState("")

  const load = () => {
    setLoading(true)
    fetch("/api/requests").then(r => r.json()).then(d => { setRequests(Array.isArray(d) ? d : []); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  // Which BUs this user may book. Admin = all. LOGISTICS→NYG/EA (by user.bu), _TRM→TRM, _GW→GW.
  const lgBus = useMemo(() => {
    if (isAdmin) return new Set(["NYG", "EA", "TRM", "GW"])
    const s = new Set<string>()
    if (roles.includes("LOGISTICS")) s.add(userBu === "EA" ? "EA" : "NYG")
    if (roles.includes("LOGISTICS_TRM")) s.add("TRM")
    if (roles.includes("LOGISTICS_GW")) s.add("GW")
    return s
  }, [isAdmin, roles, userBu])

  // SOs still waiting on LG (past VP SCM, LG not yet sent), across all docs.
  const rows = useMemo(() => {
    const out: any[] = []
    for (const r of requests) {
      if (r.isTest && !isAdmin) continue
      if (r.logisticsSent) continue
      const bu = r.bu || "NYG"
      if (!lgBus.has(bu)) continue
      const inWindow = bu === "GW"
        ? ["PENDING_CLAIM_GW", "PENDING_LOGISTICS_GW", "PENDING_PRESIDENT_GW"].includes(r.status)
        : ["PENDING_PRESIDENT", "PENDING_CLAIM", "PENDING_VP_CLAIM"].includes(r.status)
      if (!inWindow) continue
      for (const it of (r.items || [])) {
        if (["REJECTED", "COMPLETED", "ACCOUNTING_PENDING"].includes(it.itemStatus)) continue
        if (bu === "GW" && it.itemStatus !== "PRES_PASSED") continue
        out.push({ ...it, request: r, brand: it.brand || r.brandName || "(no brand)" })
      }
    }
    return out
  }, [requests, lgBus, isAdmin])

  // Group by brand.
  const brands = useMemo(() => {
    const m: Record<string, any[]> = {}
    for (const row of rows) { const b = row.brand || "(no brand)"; (m[b] ||= []).push(row) }
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  // Actual per SO: within each HAWB# (across docs), split the total EXPENSE/HAWB by QTY Air of the
  // SELECTED SOs sharing that HAWB.  actual = qty × (total ÷ Σqty).
  const actualOf = (row: any): number => {
    const h = (hawb[row.id] || "").trim()
    if (!h || !sel.has(row.id)) return 0
    const total = parseFloat(hawbTotal[h] || "0") || 0
    if (total <= 0) return 0
    const group = rows.filter(x => sel.has(x.id) && (hawb[x.id] || "").trim() === h)
    const sumQty = group.reduce((s, x) => s + (Number(x.qtyRequestAir) || 0), 0)
    if (sumQty <= 0) return 0
    return Math.round((Number(row.qtyRequestAir) || 0) * (total / sumQty) * 100) / 100
  }

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const save = async (complete: boolean) => {
    const chosen = rows.filter(r => sel.has(r.id))
    if (!chosen.length) { setMsg("เลือก SO ก่อน"); return }
    setBusy(true); setMsg("")
    // Group selected SOs by document → one save_logistics_draft call per doc.
    const byDoc: Record<string, any[]> = {}
    for (const r of chosen) (byDoc[r.request.id] ||= []).push(r)
    for (const [docId, its] of Object.entries(byDoc)) {
      const doc = its[0].request
      const itemLogistics: Record<string, any> = {}, itemActuals: Record<string, string> = {}
      for (const it of its) {
        itemLogistics[it.id] = { invoiceNo: (inv[it.id] || "").trim(), hawbNo: (hawb[it.id] || "").trim(), bookingDate: "" }
        itemActuals[it.id] = String(actualOf(it))
      }
      // "Save & Send" advances a doc ONLY when EVERY LG-pending SO of that doc is now booked.
      const docPending = rows.filter(x => x.request.id === docId)
      const allBooked = docPending.every(x => sel.has(x.id) && (hawb[x.id] || "").trim() && actualOf(x) > 0)
      const lgComplete = complete && allBooked
      const action = lgComplete && doc.bu === "GW" ? "approve" : "save_logistics_draft"
      await fetch(`/api/requests/${docId}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemLogistics, itemActuals, lgComplete }),
      }).catch(() => {})
    }
    setBusy(false)
    setMsg(complete ? "บันทึก & ส่งแล้ว (เอกสารที่ SO ครบจะเดินต่อ)" : "บันทึกร่างแล้ว")
    setSel(new Set()); load()
  }

  const doSendBack = async () => {
    if (!sendBackId || !sendBackReason.trim()) return
    const row = rows.find(r => r.id === sendBackId)
    if (!row) return
    setBusy(true)
    const res = await fetch(`/api/requests/${row.request.id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lg_reject_so", itemId: sendBackId, comment: sendBackReason.trim() }),
    })
    setBusy(false)
    if (!res.ok) { const e = await res.json().catch(() => ({})); setMsg(e.error || "Send back failed"); return }
    setSendBackId(null); setSendBackReason(""); setMsg("ส่งกลับ MER แล้ว"); load()
  }

  if (!allowed) return <div className="text-center py-20 text-gray-400">เฉพาะ Logistics / Admin เท่านั้น</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LG BOOKING</h1>
          <p className="text-xs text-gray-400 mt-0.5">SO ที่รอ Logistics book air — จัดกลุ่มตาม brand (HAWB ข้ามเอกสารได้) · เลือก SO → ใส่ INV/HAWB/EXPENSE → actual คำนวณให้</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">เลือก <b className="text-blue-600">{sel.size}</b> SO</span>
          <button onClick={() => save(false)} disabled={busy || !sel.size} className="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Save Draft</button>
          <button onClick={() => save(true)} disabled={busy || !sel.size} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">Save & Send</button>
        </div>
      </div>
      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg px-4 py-2">{msg}</div>}

      {loading && <div className="text-center py-10 text-gray-400">Loading...</div>}
      {!loading && brands.length === 0 && <div className="text-center py-20 text-gray-400">ไม่มี SO ที่รอ LG</div>}

      {brands.map(([brand, brandRows]) => {
        // HAWB totals used by this brand (cross-doc), for a compact per-HAWB total editor.
        const hawbsInBrand = [...new Set(brandRows.filter(r => sel.has(r.id)).map(r => (hawb[r.id] || "").trim()).filter(Boolean))]
        return (
          <div key={brand} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-gray-800">🏷 {brand}</span>
              <span className="text-xs text-gray-400">{brandRows.length} SO</span>
              {hawbsInBrand.map(h => (
                <span key={h} className="inline-flex items-center gap-1 text-xs bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1">
                  <span className="font-medium text-indigo-700">HAWB {h}</span>
                  <span className="text-gray-400">EXPENSE</span>
                  <input type="number" value={hawbTotal[h] || ""} onChange={e => setHawbTotal(p => ({ ...p, [h]: e.target.value }))}
                    placeholder="total" className="w-24 border border-gray-300 rounded px-2 py-0.5 text-xs" />
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 border-b"><tr>
                  {["", "DOC NO", "SO", "STYLE", "SUB", "PLAN DATE", "QTY AIR", "INV NO", "HAWB#", "ACTUAL (คำนวณ)", ""].map((h, i) =>
                    <th key={i} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {brandRows.map((row: any) => {
                    const isSel = sel.has(row.id)
                    return (
                      <tr key={row.id} className={isSel ? "bg-blue-50/40" : "hover:bg-gray-50"}>
                        <td className="px-3 py-1.5"><input type="checkbox" className="w-4 h-4" checked={isSel} onChange={() => toggle(row.id)} /></td>
                        <td className="px-3 py-1.5 font-medium text-blue-700">{row.request.documentNo} <span className="text-gray-400">{row.request.bu}</span></td>
                        <td className="px-3 py-1.5 font-medium">{row.so}</td>
                        <td className="px-3 py-1.5">{row.style}</td>
                        <td className="px-3 py-1.5">{row.sub || "-"}</td>
                        <td className="px-3 py-1.5">{fmtDate(row.planShipmentDate)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{row.qtyRequestAir}</td>
                        <td className="px-3 py-1.5"><input value={inv[row.id] || ""} disabled={!isSel} onChange={e => setInv(p => ({ ...p, [row.id]: e.target.value }))} placeholder="INV" className="w-28 border border-gray-300 rounded px-2 py-0.5 disabled:bg-gray-50" /></td>
                        <td className="px-3 py-1.5"><input value={hawb[row.id] || ""} disabled={!isSel} onChange={e => setHawb(p => ({ ...p, [row.id]: e.target.value }))} placeholder="HAWB#" className="w-32 border border-gray-300 rounded px-2 py-0.5 disabled:bg-gray-50" /></td>
                        <td className="px-3 py-1.5 text-right font-semibold text-green-700">{isSel ? fmt(actualOf(row)) : "-"}</td>
                        <td className="px-3 py-1.5"><button onClick={() => { setSendBackId(row.id); setSendBackReason("") }} className="text-xs text-orange-600 hover:underline">↩ Send Back</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Send Back modal */}
      {sendBackId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSendBackId(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800">↩ Send Back — SO {rows.find(r => r.id === sendBackId)?.so}</h3>
            <p className="text-xs text-gray-400">SO นี้ไม่ air / ไม่ claim → ส่งกลับ Merchandise (แจ้ง MER)</p>
            <textarea value={sendBackReason} onChange={e => setSendBackReason(e.target.value)} rows={3} placeholder="เหตุผล..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSendBackId(null)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">ยกเลิก</button>
              <button onClick={doSendBack} disabled={busy || !sendBackReason.trim()} className="px-4 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-40">ส่งกลับ MER</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
