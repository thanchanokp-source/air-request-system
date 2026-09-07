"use client"
import { useEffect, useMemo, useState } from "react"

const MAROON = "#6b1a1a"
type Row = { status: string; so: string; sub: string; qtyAir: number | null; airQty: number | null; qtyPlan: number | null; docs: string[]; airInv: string[]; mpInv: string[] }
type Data = { mode: string; summary: { airKeys: number; mpKeys: number; matched: number; notFound: number; merUpload: number; matchPct: number }; rows: Row[] }
const CAP = 500
const n = (v: number | null) => (v == null ? "-" : v.toLocaleString())

export default function QtyAirMapPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    setLoading(true); setErr("")
    fetch(`/api/map-data?mode=sosub`).then(async r => {
      if (!r.ok) { const e = await r.json().catch(() => ({} as any)); throw new Error(e.error || `HTTP ${r.status}`) }
      return r.json()
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  const qq = q.trim().toLowerCase()
  const match = (r: Row) => !qq || r.so.toLowerCase().includes(qq) || r.sub.toLowerCase().includes(qq) || r.airInv.some(x => x.toLowerCase().includes(qq)) || r.mpInv.some(x => x.toLowerCase().includes(qq))
  const airRows = useMemo(() => (data?.rows || []).filter(r => r.status === "matched" || r.status === "not_found").filter(match), [data, qq])
  const mpOnlyRows = useMemo(() => (data?.rows || []).filter(r => r.status === "mer_upload").filter(match), [data, qq])

  const csv = (rows: Row[], head: string[], pick: (r: Row) => any[], name: string) => {
    const lines = [head.join(",")].concat(rows.map(r => pick(r).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")))
    const b = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>QTY AIR MAP</h1>
        <p className="text-xs text-gray-500 mt-0.5">เทียบ QTY AIR: <b>air req (MER กรอก)</b> ↔ <b>mp_line (final_pcs)</b> · จับคู่ด้วย <b>SO + SUB</b> · mp_line รวม final_pcs ต่อ SO+SUB · <b>INV โชว์ให้เช็คเอง (คนละชุด A/G จับคู่อัตโนมัติไม่ได้)</b></p>
      </div>

      {loading && <div className="text-sm text-gray-500">กำลังโหลด…</div>}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">โหลดไม่สำเร็จ: {err}</div>}

      {data && (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหา SO / SUB / INV"
            className="w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />

          {/* ── ก้อน 1: ฝั่ง Air Request ── */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-800">① จาก Air Request (MER) — เทียบกับ mp_line</h2>
              <span className="text-[11px] text-gray-400">{airRows.length.toLocaleString()} รายการ · ✓ เจอ {data.summary.matched} · ⚠ ไม่เจอ {data.summary.notFound}</span>
              <button onClick={() => csv(airRows, ["SO", "SUB", "INV(air)", "QTY PLAN", "QTY AIR (MER)", "QTY AIR (mp_line)", "สถานะ"], r => [r.so, r.sub, r.airInv.join(" "), r.qtyPlan, r.airQty, r.qtyAir ?? "", r.status === "matched" ? "เจอ" : "ไม่เจอใน mp_line"], "qty-air-map_air.csv")}
                className="ml-auto text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">⬇ CSV</button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">SO</th>
                    <th className="px-3 py-2 font-medium">SUB</th>
                    <th className="px-3 py-2 font-medium">INV (air)</th>
                    <th className="px-3 py-2 font-medium text-right">QTY PLAN</th>
                    <th className="px-3 py-2 font-medium text-right">QTY AIR (MER)</th>
                    <th className="px-3 py-2 font-medium text-right">QTY AIR (mp_line)</th>
                    <th className="px-3 py-2 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {airRows.slice(0, CAP).map((r, i) => (
                    <tr key={i} className={`border-t border-gray-100 ${r.status === "not_found" ? "bg-amber-50/40" : ""}`}>
                      <td className="px-3 py-1.5 font-mono">{r.so}</td>
                      <td className="px-3 py-1.5 font-mono">{r.sub || "-"}</td>
                      <td className="px-3 py-1.5 text-gray-500 text-[10px]">{r.airInv.join(", ") || "-"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{n(r.qtyPlan)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium">{n(r.airQty)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color: r.qtyAir != null ? MAROON : "#cbd5e1" }}>{r.qtyAir != null ? n(r.qtyAir) : "-"}</td>
                      <td className="px-3 py-1.5">
                        {r.status === "matched"
                          ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200 font-medium">✓ เจอ</span>
                          : <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200 font-medium">⚠ ไม่เจอใน mp_line</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {airRows.length > CAP && <div className="px-3 py-2 text-[11px] text-amber-600 border-t border-gray-100">แสดง {CAP} จาก {airRows.length.toLocaleString()} — ค้นหา หรือ Export CSV เพื่อดูทั้งหมด</div>}
              {airRows.length === 0 && <div className="px-3 py-6 text-center text-gray-400">ไม่พบข้อมูล</div>}
            </div>
          </section>

          {/* ── ก้อน 2: mp_line ที่ไม่มีใน air ── */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-800">② จาก mp_line — <span className="text-sky-700">ไม่มีใน Air Request</span></h2>
              <span className="text-[11px] text-gray-400">{mpOnlyRows.length.toLocaleString()} รายการ</span>
              <button onClick={() => csv(mpOnlyRows, ["SO", "SUB", "INV(mp_line)", "QTY AIR (final_pcs)"], r => [r.so, r.sub, r.mpInv.join(" "), r.qtyAir ?? ""], "qty-air-map_mponly.csv")}
                className="ml-auto text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">⬇ CSV</button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">SO</th>
                    <th className="px-3 py-2 font-medium">SUB</th>
                    <th className="px-3 py-2 font-medium">INV (mp_line)</th>
                    <th className="px-3 py-2 font-medium text-right">QTY AIR (final_pcs)</th>
                    <th className="px-3 py-2 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {mpOnlyRows.slice(0, CAP).map((r, i) => (
                    <tr key={i} className="border-t border-gray-100 bg-sky-50/30">
                      <td className="px-3 py-1.5 font-mono">{r.so}</td>
                      <td className="px-3 py-1.5 font-mono">{r.sub || "-"}</td>
                      <td className="px-3 py-1.5 text-gray-500 text-[10px]">{r.mpInv.join(", ") || "-"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color: MAROON }}>{n(r.qtyAir)}</td>
                      <td className="px-3 py-1.5"><span className="text-[10px] px-2 py-0.5 rounded-full border bg-sky-100 text-sky-700 border-sky-200 font-medium">➕ ไม่มีใน air</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mpOnlyRows.length > CAP && <div className="px-3 py-2 text-[11px] text-amber-600 border-t border-gray-100">แสดง {CAP} จาก {mpOnlyRows.length.toLocaleString()} — ค้นหา หรือ Export CSV เพื่อดูทั้งหมด</div>}
              {mpOnlyRows.length === 0 && <div className="px-3 py-6 text-center text-gray-400">ไม่พบข้อมูล</div>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
