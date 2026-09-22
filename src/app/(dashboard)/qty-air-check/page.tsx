"use client"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

// QTY AIR CHECK (admin only · NYG · READ-ONLY) — เช็คว่ายอด air req ตรงกับ mp_line (ออกจริง) ไหม
// ไม่คำนึงถึง approver / flow — เป็นเครื่องมือตรวจยอดล้วนๆ ใช้ API เดียวกับ LG preview (/api/air-export-map).
const MAROON = "#6b1a1a"
const n = (v: any) => (v == null ? "—" : Number(v).toLocaleString())

type Row = { status: string; so: string; brand: string[]; qtyPlan: number | null; qtyAirMap: number | null }
const STATUS: Record<string, { label: string; cls: string; tint: string }> = {
  exactly:                  { label: "✓ ตรง",                 cls: "bg-green-100 text-green-700 border-green-200", tint: "" },
  revise:                   { label: "✗ ไม่ตรง",              cls: "bg-red-100 text-red-700 border-red-200", tint: "bg-red-50/50" },
  auto_air_prepaid_mapping: { label: "✚ auto (air ไม่มี)",    cls: "bg-sky-100 text-sky-700 border-sky-200", tint: "bg-sky-50/40" },
  no_ship_record:           { label: "⏳ ยังไม่ส่งออก",       cls: "bg-amber-100 text-amber-700 border-amber-200", tint: "bg-amber-50/30" },
}

export default function QtyAirCheckPage() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [f, setF] = useState<"all" | "exactly" | "revise" | "auto_air_prepaid_mapping" | "no_ship_record">("all")
  const [q, setQ] = useState("")

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    setLoading(true); setErr("")
    fetch("/api/air-export-map").then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      return d
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [isAdmin])

  // Flatten both tabs into one list for qty verification.
  const all: Row[] = useMemo(() => {
    if (!data) return []
    const a = (data.tabA || []).map((r: any) => ({ status: r.status, so: r.so, brand: r.brand || [], qtyPlan: r.qtyPlan, qtyAirMap: r.qtyAirMap }))
    const b = (data.tabB || []).map((r: any) => ({ status: r.status, so: r.so, brand: r.brand || [], qtyPlan: r.qtyPlan, qtyAirMap: null }))
    return [...a, ...b]
  }, [data])
  const qq = q.trim().toLowerCase()
  const rows = useMemo(() => all.filter(r =>
    (f === "all" || r.status === f) &&
    (!qq || r.so.toLowerCase().includes(qq) || r.brand.some(x => x.toLowerCase().includes(qq)))), [all, f, qq])
  const c = data?.counts || {}

  if (auth === "loading" || loading) return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Admin only</p></div>

  return (
    <div className="p-5 md:p-8 max-w-[1100px] mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>QTY AIR CHECK <span className="text-base font-normal text-gray-400">(admin · NYG)</span></h1>
        <p className="text-xs text-gray-400 mt-0.5">เช็คว่ายอด <b>air req (แผน)</b> ตรงกับ <b>mp_line (ออกจริง · SHIPPED · AIR PP)</b> ไหม · join by SO · <b>read-only ไม่เกี่ยว approver</b></p>
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">โหลดไม่สำเร็จ: {err}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "✓ ยอดตรง", v: c.exactly, cls: "text-green-700" },
          { l: "✗ ยอดไม่ตรง", v: c.revise, cls: "text-red-700" },
          { l: "✚ auto (air ไม่มี)", v: c.prepaid, cls: "text-sky-700" },
          { l: "⏳ ยังไม่ส่งออก", v: c.noship, cls: "text-amber-700" },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-[11px] text-gray-400">{k.l}</div>
            <div className={`text-2xl font-bold tabular-nums ${k.cls}`}>{n(k.v)}</div>
          </div>
        ))}
      </div>

      {/* toggle + search */}
      <div className="flex items-center gap-2 flex-wrap">
        {([["all", `ทั้งหมด (${all.length})`], ["exactly", `ตรง (${c.exactly ?? 0})`], ["revise", `ไม่ตรง (${c.revise ?? 0})`],
          ["auto_air_prepaid_mapping", `auto (${c.prepaid ?? 0})`], ["no_ship_record", `ยังไม่ส่งออก (${c.noship ?? 0})`]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setF(v)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border ${f === v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            style={f === v ? { background: MAROON } : undefined}>{l}</button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 ค้นหา SO / Brand"
          className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
      </div>

      {/* table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500"><tr className="text-left">
            <th className="px-3 py-2 font-medium">SO</th><th className="px-3 py-2 font-medium">Brand</th>
            <th className="px-3 py-2 font-medium text-right">QTY แผน (air)</th>
            <th className="px-3 py-2 font-medium text-right">QTY AIR MAP (mp_line)</th>
            <th className="px-3 py-2 font-medium text-right">ผลต่าง</th>
            <th className="px-3 py-2 font-medium">ยอด</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">ไม่พบข้อมูล</td></tr> :
              rows.slice(0, 800).map((r, i) => {
                const s = STATUS[r.status] || { label: r.status, cls: "", tint: "" }
                const diff = (r.qtyPlan != null && r.qtyAirMap != null) ? r.qtyAirMap - r.qtyPlan : null
                return (
                  <tr key={i} className={`border-t border-gray-100 ${s.tint}`}>
                    <td className="px-3 py-1.5 font-mono font-semibold">{r.so}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.brand.join(", ") || "-"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{n(r.qtyPlan)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-bold text-gray-800">{n(r.qtyAirMap)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${diff == null ? "text-gray-300" : diff === 0 ? "text-green-600" : "text-red-600"}`}>{diff == null ? "—" : (diff > 0 ? "+" : "") + n(diff)}</td>
                    <td className="px-3 py-1.5"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span></td>
                  </tr>
                )
              })}
          </tbody>
        </table>
        {rows.length > 800 && <div className="px-3 py-2 text-[11px] text-amber-600 border-t border-gray-100">แสดง 800 จาก {rows.length.toLocaleString()} — กรอง/ค้นหาเพื่อดูเพิ่ม</div>}
      </div>
      <p className="text-[11px] text-gray-400">NYG · mp_line SHIPPED · AIR PP · join by SO · QTY ยึด mp_line · read-only (ตรวจยอดอย่างเดียว ไม่เกี่ยว approver/flow)</p>
    </div>
  )
}
