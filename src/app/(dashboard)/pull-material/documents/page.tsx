"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const canUse = isAdmin || roles.includes("LOGISTICS_IMPORT")
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // edits[docId] = { hawbNo, invoiceNo, actualAir } — ONE set per document (1 shipment / 1 doc).
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === "APPROVED" || r.status === "COMPLETED"))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const raw = (rq: any, k: string) => edits[rq.id]?.[k] ?? (rq[k] != null ? String(rq[k]) : "")

  const patch = async (rq: any, extra: any) => {
    const r = await fetch(`/api/pull-material/${rq.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hawbNo: raw(rq, "hawbNo") || null,
        invoiceNo: raw(rq, "invoiceNo") || null,
        actualAir: raw(rq, "actualAir") === "" ? null : raw(rq, "actualAir"),
        ...extra,
      }),
    })
    if (r.ok) { setEdits(p => { const n = { ...p }; delete n[rq.id]; return n }); await load() }
    else alert("Error")
  }

  // Draft-save the actual (no status change).
  const save = async (rq: any) => { setBusy(rq.id); try { await patch(rq, {}) } finally { setBusy(null) } }

  // Save + close the document (APPROVED → COMPLETED).
  const complete = async (rq: any) => {
    if (!String(raw(rq, "actualAir")).trim()) return alert("กรอก Actual Air Freight ก่อนปิดงาน")
    if (!confirm(`ปิดงาน ${rq.documentNo}?\nActual / INV / HAWB จะถูกบันทึกและเปลี่ยนสถานะเป็น COMPLETED`)) return
    setBusy(rq.id); try { await patch(rq, { status: "COMPLETED" }) } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Logistics Import / Admin only</p></div>

  const inp = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Logistics Document — Pull Material</h1>
        <p className="text-sm text-gray-500">เอกสารที่อนุมัติแล้ว (ต้องส่ง air) — LG กรอก <b>Actual</b> หลัง book/ได้ invoice จริง</p></div>

      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No approved documents yet</div> :
          reqs.map(rq => {
            const estTotal = rq.items.reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
            const actTotal = raw(rq, "actualAir") === "" ? 0 : Number(raw(rq, "actualAir")) || 0
            const diff = actTotal - estTotal
            const pos = [...new Set(rq.items.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
            const done = rq.status === "COMPLETED"
            return (
              <div key={rq.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                    <span className="text-xs text-gray-500"> · {rq.requesterName} · PO {pos || "-"}</span></div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Est {fmt(estTotal)} USD</span>
                    {actTotal > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Actual {fmt(actTotal)}</span>}
                    {actTotal > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diff > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))}
                      </span>
                    )}
                    {done
                      ? <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-white font-medium">✓ COMPLETED</span>
                      : <>
                        <button onClick={() => save(rq)} disabled={busy === rq.id}
                          className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
                          {busy === rq.id ? "..." : "Save"}
                        </button>
                        <button onClick={() => complete(rq)} disabled={busy === rq.id}
                          className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 bg-gray-800">
                          ✓ ปิดงาน
                        </button>
                      </>}
                  </div>
                </div>
                {/* ONE entry per document (1 shipment / 1 doc): HAWB · INV · Actual Air Freight */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-green-50/40 border border-green-100 p-3">
                  <div>
                    <label className="text-[11px] font-semibold text-green-700 block mb-1">HAWB NO</label>
                    <input value={raw(rq, "hawbNo")} onChange={e => setVal(rq.id, "hawbNo", e.target.value)} disabled={done} placeholder="HAWB…" className={inp} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-green-700 block mb-1">INVOICE NO</label>
                    <input value={raw(rq, "invoiceNo")} onChange={e => setVal(rq.id, "invoiceNo", e.target.value)} disabled={done} placeholder="INV…" className={inp} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-green-700 block mb-1">ACTUAL AIR FREIGHT <span className="text-red-500">*</span></label>
                    <input type="number" value={raw(rq, "actualAir")} onChange={e => setVal(rq.id, "actualAir", e.target.value)} disabled={done} placeholder="0" className={inp} />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">กรอกครั้งเดียวต่อ 1 document · Est Air = ค่าที่อนุมัติ (freeze) ไว้เทียบกับ Actual · Save = บันทึก draft · ปิดงาน = COMPLETED</p>
              </div>
            )
          })}
    </div>
  )
}
