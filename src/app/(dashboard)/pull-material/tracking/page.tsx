"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL } from "../_StageWork"

const FLOW = ["PENDING_LOGISTICS", "PENDING_PURCHASING", "PENDING_SCM_DECISION", "PENDING_APPROVAL", "APPROVED"]
const STEP_SHORT = ["LG", "จัดซื้อ", "SCM", "อนุมัติ", "เสร็จ"]

export default function Page() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { if (isAdmin) load() }, [bu, isAdmin]) // eslint-disable-line

  const decide = async (rq: any, air: boolean) => {
    setBusy(rq.id)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: air ? "PENDING_APPROVAL" : "NO_AIR", itemUpdates: rq.items.map((i: any) => ({ id: i.id, airDecision: air ? "AIR" : "NO_AIR" })) }),
      })
      if (r.ok) await load()
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">กำลังโหลด…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">อยู่ระหว่างทดสอบ (Admin)</p></div>

  const stepIdx = (s: string) => FLOW.indexOf(s === "COMPLETED" ? "APPROVED" : s)

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Tracking Document — Pull Material</h1>
        <p className="text-sm text-gray-500">ตามสถานะทุกเอกสาร · SCM ตัดสินใจ air/ไม่ air ที่ขั้น &quot;รอ SCM ตัดสินใจ&quot;</p></div>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: MAROON } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">กำลังโหลด…</p> :
        reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">ยังไม่มีเอกสาร</div> :
          reqs.map(rq => {
            const idx = stepIdx(rq.status)
            const noAir = rq.status === "NO_AIR"
            return (
              <div key={rq.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                    <span className="text-xs text-gray-500"> · {rq.requesterName} · {rq.items.length} รายการ</span></div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${noAir ? "bg-gray-100 text-gray-600" : rq.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {STATUS_LABEL[rq.status] || rq.status}
                  </span>
                </div>

                {!noAir && (
                  <div className="mt-3 flex items-center gap-1">
                    {FLOW.map((s, i) => (
                      <div key={s} className="flex items-center flex-1">
                        <div className={`flex-1 text-center text-[10px] py-1 rounded ${i < idx ? "bg-green-50 text-green-700" : i === idx ? "text-white" : "bg-gray-50 text-gray-400"}`}
                          style={i === idx ? { background: MAROON } : undefined}>{STEP_SHORT[i]}{i < idx ? " ✓" : ""}</div>
                        {i < FLOW.length - 1 && <span className="text-gray-300 px-0.5">›</span>}
                      </div>
                    ))}
                  </div>
                )}

                {rq.status === "PENDING_SCM_DECISION" && (
                  <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2 flex-wrap">
                    <span className="text-xs text-amber-800 font-medium">SCM ตัดสินใจ:</span>
                    <button onClick={() => decide(rq, true)} disabled={busy === rq.id} className="px-3 py-1 rounded-lg text-white text-xs font-semibold disabled:opacity-50" style={{ background: MAROON }}>✈ AIR (ขออนุมัติ)</button>
                    <button onClick={() => decide(rq, false)} disabled={busy === rq.id} className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 disabled:opacity-50">ไม่ air</button>
                  </div>
                )}
              </div>
            )
          })}
    </div>
  )
}
