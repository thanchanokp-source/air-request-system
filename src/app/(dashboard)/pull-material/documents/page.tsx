"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate } from "../_StageWork"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs((d.requests || []).filter((r: any) => r.status === "APPROVED" || r.status === "COMPLETED")) } finally { setLoading(false) } }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">กำลังโหลด…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">อยู่ระหว่างทดสอบ (Admin)</p></div>

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Logistics Document — Pull Material</h1>
        <p className="text-sm text-gray-500">เอกสารที่อนุมัติแล้ว = ต้องออกแอร์ (สำหรับ LG จองแอร์)</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: MAROON } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">กำลังโหลด…</p> :
        reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">ยังไม่มีเอกสารที่อนุมัติ</div> :
          reqs.map(rq => (
            <div key={rq.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                  <span className="text-xs text-gray-500"> · {rq.requesterName}</span></div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">✈ อนุมัติแล้ว — ออกแอร์</span>
              </div>
              <div className="mt-3 border rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    {["SO", "วัตถุดิบ", "PULL", "G.W.(kg)", "In-House Air", "Air Freight", "Ship Date"].map(h =>
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rq.items.map((it: any) => (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-semibold text-gray-800">{it.soNoDoc}</td>
                        <td className="px-3 py-1.5">{it.itemName || it.itemCode}</td>
                        <td className="px-3 py-1.5">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                        <td className="px-3 py-1.5">{fmt(it.grossWeightKg || it.weight)}</td>
                        <td className="px-3 py-1.5">{fmtDate(it.inHouseAirDate)}</td>
                        <td className="px-3 py-1.5">{fmt(it.airFreightCost)}</td>
                        <td className="px-3 py-1.5">{fmtDate(it.shipmentDate)}</td>
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
