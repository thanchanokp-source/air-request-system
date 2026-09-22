"use client"
import { useEffect, useMemo, useState } from "react"

// QTY Air Map — NYG admin preview (READ-ONLY). Renders the reconciliation from /api/air-export-map.
// Tab A = SO ที่มีประวัติส่งออก (mp_line) · Tab B = air req ที่ยังไม่มีใน mp_line. No writes, no flow impact.
const n = (v: any) => (v == null ? "—" : Number(v).toLocaleString())

type Line = { sub: string; inv: string; pcs: number; style?: string; forwarder?: string }
type RowA = { status: string; so: string; brand: string[]; qtyPlan: number | null; qtyAirMap: number; lines: Line[]; docs: string[]; airInv: string[] }
type RowB = { status: string; so: string; brand: string[]; qtyPlan: number | null; docs: string[]; airInv: string[] }
type Data = { tabA: RowA[]; tabB: RowB[]; counts: any; error?: string }

const PILL: Record<string, { label: string; cls: string }> = {
  exactly:                  { label: "✓ exactly",                cls: "bg-green-100 text-green-700 border-green-200" },
  revise:                   { label: "✏ revise qty",             cls: "bg-sky-100 text-sky-700 border-sky-200" },
  auto_air_prepaid_mapping: { label: "✚ auto air prepaid",        cls: "bg-red-100 text-red-700 border-red-200" },
  no_ship_record:           { label: "⏳ ยังไม่มี record ship",   cls: "bg-amber-100 text-amber-700 border-amber-200" },
}

export default function LgExportMap() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [tab, setTab] = useState<"A" | "B">("A")
  const [q, setQ] = useState("")
  const [expand, setExpand] = useState<Set<number>>(new Set())

  useEffect(() => {
    setLoading(true); setErr("")
    fetch("/api/air-export-map").then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      return d
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  const qq = q.trim().toLowerCase()
  const matchA = (r: RowA) => !qq || r.so.toLowerCase().includes(qq) || r.brand.some(b => b.toLowerCase().includes(qq)) || r.lines.some(l => String(l.inv).toLowerCase().includes(qq))
  const matchB = (r: RowB) => !qq || r.so.toLowerCase().includes(qq) || r.brand.some(b => b.toLowerCase().includes(qq))
  const rowsA = useMemo(() => (data?.tabA || []).filter(matchA), [data, qq])
  const rowsB = useMemo(() => (data?.tabB || []).filter(matchB), [data, qq])
  const c = data?.counts || {}

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">กำลังโหลด…</div>
  if (err) return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">โหลดไม่สำเร็จ: {err}</div>
  if (!data) return null

  return (
    <div className="space-y-3">
      {/* summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { l: "✓ exactly", v: c.exactly, cls: "text-green-700" },
          { l: "✏ revise qty", v: c.revise, cls: "text-sky-700" },
          { l: "✚ auto prepaid", v: c.prepaid, cls: "text-red-700" },
          { l: "⏳ ยังไม่ส่งออก", v: c.noship, cls: "text-amber-700" },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-[11px] text-gray-400">{k.l}</div>
            <div className={`text-2xl font-bold tabular-nums ${k.cls}`}>{n(k.v)}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {([["A", `มีประวัติส่งออก (${c.tabA ?? 0})`], ["B", `ยังไม่มีประวัติการส่งออก (${c.tabB ?? 0})`]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border ${tab === v ? "bg-blue-600 text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 ค้นหา SO / INV / Brand"
          className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      {tab === "A" ? (
        <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr className="text-left">
              <th className="px-3 py-2 font-medium">SO</th><th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium text-right">QTY แผน</th>
              <th className="px-3 py-2 font-medium text-right">QTY AIR MAP</th>
              <th className="px-3 py-2 font-medium">INV (mp_line)</th><th className="px-3 py-2 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {rowsA.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr> :
                rowsA.map((r, i) => {
                  const isAuto = r.status === "auto_air_prepaid_mapping"
                  const p = PILL[r.status]
                  const open = expand.has(i)
                  return (
                    <tr key={i} className={`border-t border-gray-100 ${isAuto ? "bg-red-50/50 border-l-2 border-l-red-400" : r.status === "revise" ? "bg-sky-50/40" : ""}`}>
                      <td className="px-3 py-1.5 font-mono font-semibold">{r.so}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.brand.join(", ") || "-"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{n(r.qtyPlan)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-bold text-gray-800">{n(r.qtyAirMap)}</td>
                      <td className="px-3 py-1.5">
                        <button onClick={() => setExpand(s => { const x = new Set(s); x.has(i) ? x.delete(i) : x.add(i); return x })}
                          className="text-[11px] text-blue-600 hover:underline">{r.lines.length} INV {open ? "▲" : "▼"}</button>
                        {open && <div className="mt-1 space-y-0.5">{r.lines.map((l, j) => (
                          <div key={j} className="text-[10px] text-gray-500 tabular-nums">{l.sub && `SUB ${l.sub} · `}{l.inv} · {n(l.pcs)} pcs</div>
                        ))}</div>}
                      </td>
                      <td className="px-3 py-1.5"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${p?.cls || ""}`}>{p?.label || r.status}</span></td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr className="text-left">
              <th className="px-3 py-2 font-medium">SO</th><th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium text-right">QTY แผน (air)</th>
              <th className="px-3 py-2 font-medium">Doc</th><th className="px-3 py-2 font-medium">INV (air)</th><th className="px-3 py-2 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {rowsB.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr> :
                rowsB.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100 bg-amber-50/30">
                    <td className="px-3 py-1.5 font-mono font-semibold">{r.so}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.brand.join(", ") || "-"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{n(r.qtyPlan)}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-[10px]">{r.docs.join(", ") || "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-[10px]">{r.airInv.join(", ") || "-"}</td>
                    <td className="px-3 py-1.5"><span className="text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap bg-amber-100 text-amber-700 border-amber-200">⏳ ยังไม่มี record ship</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400">NYG · mp_line SHIPPED · AIR PP · join by SO · read-only preview (ยังไม่เขียนข้อมูล ไม่กระทบการจอง)</p>
    </div>
  )
}
