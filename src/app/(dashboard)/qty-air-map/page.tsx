"use client"
import { useEffect, useMemo, useState } from "react"

const MAROON = "#6b1a1a"
type Row = { status: string; nfReason?: string; so: string; sub: string; brand: string[]; mpBrand: string[]; shipDates: string[]; qtyAir: number | null; airQty: number | null; qtyPlan: number | null; docs: string[]; airInv: string[]; mpInv: string[] }
const fmtD = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[3]}/${m[2]}/${m[1]}` : s }
type Data = { mode: string; summary: { airKeys: number; mpKeys: number; matched: number; notFound: number; merUpload: number; matchPct: number }; rows: Row[] }
const CAP = 500
const n = (v: number | null) => (v == null ? "-" : v.toLocaleString())

export default function QtyAirMapPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [q, setQ] = useState("")
  const [brandF, setBrandF] = useState("")
  const [statusF, setStatusF] = useState<"all" | "matched" | "not_found">("all")
  const [fromD, setFromD] = useState("")
  const [toD, setToD] = useState("")

  useEffect(() => {
    setLoading(true); setErr("")
    fetch(`/api/map-data?mode=sosub`).then(async r => {
      if (!r.ok) { const e = await r.json().catch(() => ({} as any)); throw new Error(e.error || `HTTP ${r.status}`) }
      return r.json()
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  const qq = q.trim().toLowerCase()
  const match = (r: Row) => !qq || r.so.toLowerCase().includes(qq) || r.sub.toLowerCase().includes(qq) || r.airInv.some(x => x.toLowerCase().includes(qq)) || r.mpInv.some(x => x.toLowerCase().includes(qq)) || r.brand.some(x => x.toLowerCase().includes(qq)) || r.mpBrand.some(x => x.toLowerCase().includes(qq))
  const brandOk = (r: Row) => !brandF || r.brand.includes(brandF) || r.mpBrand.includes(brandF)
  const brands = useMemo(() => {
    const s = new Set<string>()
    for (const r of data?.rows || []) { r.brand.forEach(b => s.add(b)); r.mpBrand.forEach(b => s.add(b)) }
    return [...s].filter(Boolean).sort()
  }, [data])
  const dateOk = (r: Row) => { if (!fromD && !toD) return true; if (!r.shipDates.length) return false; return r.shipDates.some(d => (!fromD || d >= fromD) && (!toD || d <= toD)) }
  // Section ① rows honor the status filter; the summary below must reflect the SAME set REGARDLESS of
  // the status filter (so the % breakdown always adds up) → compute it on a status-unfiltered set.
  const airBase = useMemo(() => (data?.rows || []).filter(r => (r.status === "matched" || r.status === "not_found") && match(r) && brandOk(r) && dateOk(r)), [data, qq, brandF, fromD, toD])
  const airRows = useMemo(() => airBase.filter(r => statusF === "all" || r.status === statusF), [airBase, statusF])
  const mpOnlyRows = useMemo(() => (data?.rows || []).filter(r => r.status === "mer_upload" && match(r) && brandOk(r)), [data, qq, brandF])
  const sum = useMemo(() => {
    const total = airBase.length
    const matched = airBase.filter(r => r.status === "matched").length
    const nf = airBase.filter(r => r.status === "not_found")
    const noInv = nf.filter(r => r.nfReason === "no_inv").length
    const invSub = nf.filter(r => r.nfReason === "inv_sub").length
    const invNoSo = nf.filter(r => r.nfReason === "inv_no_so").length
    const pct = (x: number) => (total ? Math.round((1000 * x) / total) / 10 : 0)
    return { total, matched, nf: nf.length, noInv, invSub, invNoSo, pct, mpOnly: mpOnlyRows.length }
  }, [airBase, mpOnlyRows])

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
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหา SO / SUB / INV / Brand"
              className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            <select value={brandF} onChange={e => setBrandF(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200">
              <option value="">ทุก Brand ({brands.length})</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <span className="text-xs text-gray-400 ml-1">สถานะ (ก้อน ①):</span>
            {(["all", "matched", "not_found"] as const).map(v => (
              <button key={v} onClick={() => setStatusF(v)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${statusF === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                style={statusF === v ? { background: MAROON } : {}}>
                {v === "all" ? "ทั้งหมด" : v === "matched" ? "✓ เจอ" : "⚠ ไม่เจอ"}
              </button>
            ))}
            <span className="text-xs text-gray-400 ml-1">วันออก air:</span>
            <input type="date" value={fromD} onChange={e => setFromD(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
            <span className="text-xs text-gray-400">ถึง</span>
            <input type="date" value={toD} onChange={e => setToD(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
            {(brandF || statusF !== "all" || q || fromD || toD) && <button onClick={() => { setBrandF(""); setStatusF("all"); setQ(""); setFromD(""); setToD("") }} className="text-xs text-red-600 hover:underline ml-1">ล้างตัวกรอง</button>}
          </div>

          {/* ── สรุป % + แยกสาเหตุไม่เจอ (ตามตัวกรอง brand/date) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: "ก้อน ① ทั้งหมด", v: sum.total.toLocaleString(), s: "SO+SUB (air req)", c: MAROON },
              { l: "✓ เจอใน mp_line", v: sum.matched.toLocaleString(), s: `${sum.pct(sum.matched)}%`, c: "#15803d" },
              { l: "⚠ ไม่เจอ", v: sum.nf.toLocaleString(), s: `${sum.pct(sum.nf)}%`, c: "#b45309" },
              { l: "ก้อน ② mp_line only", v: sum.mpOnly.toLocaleString(), s: "ไม่มีใน air req", c: "#0369a1" },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-[11px] text-gray-400">{c.l}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: c.c }}>{c.v}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{c.s}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">แยกสาเหตุ “ไม่เจอ” — {sum.nf.toLocaleString()} รายการ (จาก {sum.total.toLocaleString()})</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-800">⏳ รอ LG (ยังไม่มี INV): <b>{sum.noInv.toLocaleString()}</b> ({sum.pct(sum.noInv)}%)</span>
              <span className="px-2.5 py-1 rounded-lg border bg-orange-50 border-orange-200 text-orange-800">มี INV · SUB ไม่ตรง (SO มีใน mp_line): <b>{sum.invSub.toLocaleString()}</b> ({sum.pct(sum.invSub)}%)</span>
              <span className="px-2.5 py-1 rounded-lg border bg-red-50 border-red-200 text-red-800">มี INV · ไม่มี SO ใน mp_line: <b>{sum.invNoSo.toLocaleString()}</b> ({sum.pct(sum.invNoSo)}%)</span>
            </div>
          </div>

          {/* ── ก้อน 1: ฝั่ง Air Request ── */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-800">① จาก Air Request (MER) — เทียบกับ mp_line</h2>
              <span className="text-[11px] text-gray-400">{airRows.length.toLocaleString()} รายการ · ✓ เจอ {data.summary.matched} · ⚠ ไม่เจอ {data.summary.notFound}</span>
              <button onClick={() => csv(airRows, ["SO", "SUB", "BRAND", "SHIP AIR", "INV(air)", "QTY PLAN", "QTY AIR (MER)", "QTY AIR (mp_line)", "สถานะ"], r => [r.so, r.sub, r.brand.join(" "), r.shipDates.map(fmtD).join(" "), r.airInv.join(" "), r.qtyPlan, r.airQty, r.qtyAir ?? "", r.status === "matched" ? "เจอ" : "ไม่เจอใน mp_line"], "qty-air-map_air.csv")}
                className="ml-auto text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">⬇ CSV</button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">SO</th>
                    <th className="px-3 py-2 font-medium">SUB</th>
                    <th className="px-3 py-2 font-medium">BRAND</th>
                    <th className="px-3 py-2 font-medium">SHIP AIR</th>
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
                      <td className="px-3 py-1.5 text-gray-600">{r.brand.join(", ") || "-"}</td>
                      <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r.shipDates.map(fmtD).join(", ") || "-"}</td>
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
              <button onClick={() => csv(mpOnlyRows, ["SO", "SUB", "BRAND", "INV(mp_line)", "QTY AIR (final_pcs)"], r => [r.so, r.sub, r.mpBrand.join(" "), r.mpInv.join(" "), r.qtyAir ?? ""], "qty-air-map_mponly.csv")}
                className="ml-auto text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">⬇ CSV</button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">SO</th>
                    <th className="px-3 py-2 font-medium">SUB</th>
                    <th className="px-3 py-2 font-medium">BRAND</th>
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
                      <td className="px-3 py-1.5 text-gray-600">{r.mpBrand.join(", ") || "-"}</td>
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
