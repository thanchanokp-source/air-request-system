"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS } from "../_StageWork"

// สถิติ Revise — how many times each purchaser's docs were bounced back (revise) by LG. Its own page
// (moved out of the Purchase tabs). Self-contained: fetches all BUs, all statuses.
export default function Page() {
  const { data: session } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const canUse = roles.includes("ADMIN") || roles.includes("PURCHASING")

  const [all, setAll] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!canUse) return
    ;(async () => {
      try {
        const results = await Promise.all(BUS.map(b => fetch(`/api/pull-material?bu=${b}`).then(r => r.json()).catch(() => ({}))))
        setAll(results.flatMap((d: any) => d.requests || []))
      } finally { setLoading(false) }
    })()
  }, [canUse])

  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Purchasing / Admin only</p></div>

  const byPerson: Record<string, { name: string; revises: number; docs: number }> = {}
  for (const r of all) {
    const key = r.purchaserName || r.purchaserEmail || r.requesterName || "(ไม่ระบุ)"
    const e = (byPerson[key] ??= { name: key, revises: 0, docs: 0 })
    e.revises += Number(r.reviseCount) || 0
    if (Number(r.reviseCount) > 0) e.docs += 1
  }
  const rows = Object.values(byPerson).filter(p => p.revises > 0).sort((a, b) => b.revises - a.revises)

  return (
    <div className="p-5 md:p-8 max-w-[900px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>📊 สถิติ Revise</h1>
        <p className="text-sm text-gray-500 mt-0.5">นับจากจำนวนครั้งที่เอกสารถูก LG ตีกลับให้แก้ (revise) — เรียงจากมากไปน้อย · ใช้ประกอบการประเมิน</p>
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        rows.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">ยังไม่มีการตีกลับ 🎉</div> :
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500"><tr>
              <th className="px-4 py-2.5 text-left font-medium">#</th>
              <th className="px-4 py-2.5 text-left font-medium">จัดซื้อ</th>
              <th className="px-4 py-2.5 text-right font-medium">จำนวนครั้งที่ถูกตีกลับ</th>
              <th className="px-4 py-2.5 text-right font-medium">จำนวนเอกสาร</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((p, i) => (
                <tr key={p.name} className={i === 0 ? "bg-red-50/40" : ""}>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}{i === 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">สูงสุด</span>}</td>
                  <td className="px-4 py-2.5 text-right font-bold" style={{ color: MAROON }}>{p.revises}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{p.docs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      <p className="text-[11px] text-gray-400">* นับจากทุกเอกสารทุก BU ทุกสถานะ (รวมที่ผ่านขั้นตอนไปแล้ว)</p>
    </div>
  )
}
