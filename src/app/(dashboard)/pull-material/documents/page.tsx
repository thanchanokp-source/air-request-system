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
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING">("ALL")
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

      {/* Request-type toggle */}
      <div className="flex gap-1.5">
        {([["ALL", "ทั้งหมด"], ["SCM", "SCM request"], ["PURCHASING", "PC request"]] as const).map(([v, label]) => {
          const n = v === "ALL" ? reqs.length : reqs.filter(r => (r.requestType || "SCM") === v).length
          return (
            <button key={v} onClick={() => setTypeF(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${typeF === v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
              style={typeF === v ? { background: MAROON } : undefined}>{label} <span className="opacity-70">({n})</span></button>
          )
        })}
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        (() => { const shown = reqs.filter(r => typeF === "ALL" || (r.requestType || "SCM") === typeF); return shown.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No approved documents</div> :
          shown.map(rq => {
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

                {/* Shipment details (like the DVM Purchase view) — 1 ship/1 doc so shown once */}
                {(() => {
                  const its = rq.items || []
                  const d0 = its.find((x: any) => x.airFreightCost != null) || its[0] || {}
                  const byPo: Record<string, { qty: number; uoms: Set<string> }> = {}
                  its.forEach((it: any) => { const po = it.poNoDoc || "-"; const g = (byPo[po] ||= { qty: 0, uoms: new Set() }); g.qty += Number(it.pullMaterialQty) || 0; if (it.bomUom) g.uoms.add(it.bomUom) })
                  const qtyAir = its.reduce((s: number, it: any) => s + (Number(it.pullMaterialQty) || 0), 0)
                  const pkgs = Array.isArray(rq.packages) ? rq.packages : []
                  const pkgStr = pkgs.length ? pkgs.map((p: any) => `${fmt(p.qty)} ${p.uom}`).join(", ") : (d0.cartons ? String(fmt(d0.cartons)) : "")
                  const dimStr = (d0.boxW || d0.boxL || d0.boxH) ? `${d0.boxW || "-"}×${d0.boxL || "-"}×${d0.boxH || "-"} cm` : ""
                  const Info = ({ label, value }: { label: string; value: any }) => <div><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-gray-800 text-sm">{value || "-"}</div></div>
                  return (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-gray-50 p-3">
                        <Info label="Country" value={d0.country} />
                        <Info label="Port" value={d0.port || d0.seaPort} />
                        <Info label="City" value={d0.city} />
                        <Info label="Incoterm" value={d0.incoterm} />
                        <Info label="QTY Air" value={fmt(qtyAir)} />
                        <Info label="Est Air" value={estTotal ? `${fmt(estTotal)} USD` : "-"} />
                        <Info label="L/T Air" value={d0.leadTimeAir} />
                        <Info label="Weight (kg)" value={d0.weight != null ? fmt(d0.weight) : "-"} />
                        <Info label="Need date" value={d0.needDate ? fmtDate(d0.needDate) : "-"} />
                        <Info label="Package" value={pkgStr} />
                        <Info label="Dimension" value={dimStr} />
                        {["EX-WORK", "FCA"].includes(d0.incoterm) && <Info label="Pickup address" value={d0.pickupAddress} />}
                        {rq.remark && <div className="col-span-2 sm:col-span-4"><Info label="Remark" value={rq.remark} /></div>}
                      </div>
                      {(rq.attachments || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(rq.attachments || []).map((a: any) => (
                            <a key={a.id} href={`/api/pull-material/attachments/${a.id}`} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] bg-sky-50 border border-sky-200 text-sky-800 rounded-full px-2.5 py-1 hover:bg-sky-100">📎 <span className="max-w-[200px] truncate" title={a.fileName}>{a.fileName}</span></a>
                          ))}
                        </div>
                      )}
                      <div className="border rounded-xl overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500"><tr>{["PO NO", "QTY AIR", "UOM"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                          <tbody className="divide-y divide-gray-50">
                            {Object.keys(byPo).map(po => (
                              <tr key={po} className="hover:bg-gray-50">
                                <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{po}</td>
                                <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(byPo[po].qty)}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap">{[...byPo[po].uoms].join(", ") || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

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
          }) })()}
    </div>
  )
}
