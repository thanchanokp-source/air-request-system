"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

export const MAROON = "#6b1a1a"
export const BUS = ["NYG", "EA", "TRM", "GW"]
export const fmt = (n: any) => (n == null || isNaN(Number(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))
export const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString("th-TH") }

export const STATUS_LABEL: Record<string, string> = {
  PENDING_LOGISTICS: "รอ Logistics", PENDING_PURCHASING: "รอจัดซื้อ",
  PENDING_SCM_DECISION: "รอ SCM ตัดสินใจ air", PENDING_APPROVAL: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว", NO_AIR: "ไม่ air", COMPLETED: "เสร็จสิ้น",
}

type Field = { key: string; label: string; type: "date" | "number" | "text" }
type Action = { label: string; toStatus: string; color?: string }

// Read-only BOM/snapshot context shown to LG / Purchase / Approval before their input fields.
const CTX: { key: string; label: string; kind?: "date" | "num" }[] = [
  { key: "customerName", label: "ลูกค้า" },
  { key: "customerPo", label: "Customer PO" },
  { key: "brand", label: "Brand" },
  { key: "style", label: "Style" },
  { key: "gmtType", label: "ประเภท" },
  { key: "orderQty", label: "Order Qty", kind: "num" },
  { key: "pullGarment", label: "Pull Garment", kind: "num" },
  { key: "consumption", label: "Consumption", kind: "num" },
  { key: "vendorName", label: "Vendor" },
  { key: "poNoDoc", label: "PO No" },
  { key: "shipmentDate", label: "Ship Date", kind: "date" },
]
const ctxVal = (it: any, c: { key: string; kind?: "date" | "num" }) =>
  c.kind === "date" ? fmtDate(it[c.key]) : c.kind === "num" ? fmt(it[c.key]) : (it[c.key] || "-")

export function StageWork({ title, subtitle, status, fields, primary, secondary }: {
  title: string; subtitle: string; status: string; fields: Field[]; primary: Action; secondary?: Action
}) {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      setReqs((d.requests || []).filter((r: any) => r.status === status))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line

  const setVal = (itemId: string, key: string, v: string) => setEdits(p => ({ ...p, [itemId]: { ...(p[itemId] || {}), [key]: v } }))
  const valOf = (item: any, key: string) => {
    if (edits[item.id]?.[key] !== undefined) return edits[item.id][key]
    if (item[key] == null) return ""
    return fields.find(f => f.key === key)?.type === "date" ? String(item[key]).slice(0, 10) : String(item[key])
  }

  const act = async (rq: any, a: Action, validate = false) => {
    if (validate) {
      for (const it of rq.items) {
        for (const f of fields) {
          const v = valOf(it, f.key)
          if (v === "" || v == null) { alert(`กรุณากรอก "${f.label}" ให้ครบทุกรายการก่อนส่งต่อ`); return }
        }
      }
    }
    setBusy(rq.id)
    try {
      const itemUpdates = rq.items.map((it: any) => ({ id: it.id, ...Object.fromEntries(fields.map(f => [f.key, valOf(it, f.key)])) }))
      const r = await fetch(`/api/pull-material/${rq.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemUpdates, status: a.toStatus }) })
      if (r.ok) { setEdits({}); await load() } else alert("ผิดพลาด")
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">กำลังโหลด…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Pull Material — อยู่ระหว่างทดสอบ (Admin)</p></div>

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>{title}</h1><p className="text-sm text-gray-500">{subtitle}</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: MAROON } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">กำลังโหลด…</p> :
        reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">ไม่มีเอกสารในขั้นนี้</div> :
          reqs.map(rq => (
            <div key={rq.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                  <span className="text-xs text-gray-500"> · {rq.requesterName} · {rq.items.length} รายการ</span></div>
                <div className="flex gap-2">
                  {secondary && <button onClick={() => act(rq, secondary)} disabled={busy === rq.id} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 disabled:opacity-50">{secondary.label}</button>}
                  <button onClick={() => act(rq, primary, true)} disabled={busy === rq.id} className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: primary.color || MAROON }}>{busy === rq.id ? "..." : primary.label}</button>
                </div>
              </div>
              <div className="mt-3 border rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    {["SO", "วัตถุดิบ", "PULL"].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                    {CTX.map(c => <th key={c.key} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{c.label}</th>)}
                    {fields.map(f => <th key={f.key} className="px-3 py-2 text-left font-medium text-red-700 whitespace-nowrap">{f.label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rq.items.map((it: any) => (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{it.soNoDoc}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.itemName || it.itemCode}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                        {CTX.map(c => <td key={c.key} className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{ctxVal(it, c)}</td>)}
                        {fields.map(f => (
                          <td key={f.key} className="px-3 py-1.5">
                            <input type={f.type} value={valOf(it, f.key)} onChange={e => setVal(it.id, f.key, e.target.value)}
                              className="w-28 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
    </div>
  )
}
