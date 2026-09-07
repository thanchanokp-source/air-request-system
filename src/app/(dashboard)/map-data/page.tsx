"use client"
import { useEffect, useMemo, useState } from "react"

const MAROON = "#6b1a1a"
type Row = { status: string; so: string; sub: string; qtyAir: number | null; airQty: number | null; docs: string[]; airInv: string[]; mpInv: string[] }
type Data = { summary: { airKeys: number; mpKeys: number; matched: number; notFound: number; merUpload: number; matchPct: number }; rows: Row[] }

const STATUS: Record<string, { label: string; cls: string }> = {
  matched: { label: "✓ Matched", cls: "bg-green-100 text-green-700 border-green-200" },
  not_found: { label: "⚠ Not found (air มี · mp_line ไม่มี)", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  mer_upload: { label: "➕ Mer upload (mp_line มี · air ไม่มี)", cls: "bg-sky-100 text-sky-700 border-sky-200" },
}
const CAP = 400

export default function MapDataPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [tab, setTab] = useState<"all" | "matched" | "not_found" | "mer_upload">("all")
  const [q, setQ] = useState("")

  useEffect(() => {
    fetch("/api/map-data").then(async r => {
      if (!r.ok) { const e = await r.json().catch(() => ({} as any)); throw new Error(e.error || `HTTP ${r.status}`) }
      return r.json()
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const qq = q.trim().toLowerCase()
    return data.rows.filter(r =>
      (tab === "all" || r.status === tab) &&
      (!qq || r.so.toLowerCase().includes(qq) || r.sub.toLowerCase().includes(qq) || r.docs.some(d => d.toLowerCase().includes(qq)))
    )
  }, [data, tab, q])

  const s = data?.summary
  const exportCsv = () => {
    if (!data) return
    const head = ["Status", "SO", "SUB", "QTY Air (final_pcs)", "Air QTY", "Documents", "air INV", "mp INV"]
    const lines = [head.join(",")].concat(filtered.map(r =>
      [STATUS[r.status]?.label || r.status, r.so, r.sub, r.qtyAir ?? "", r.airQty ?? "", r.docs.join(" "), r.airInv.join(" "), r.mpInv.join(" ")]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")))
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "map-data.csv"; a.click()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>Map Data — Air Request ↔ mp_line</h1>
        <p className="text-xs text-gray-500 mt-0.5">Cross-check ด้วยคีย์ <b>SO + SUB</b> · QTY Air = <b>final_pcs</b> จาก mp_line (INV ไม่ใช้ join เพราะคนละชุด)</p>
      </div>

      {loading && <div className="text-sm text-gray-500">กำลังโหลด…</div>}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">โหลดไม่สำเร็จ: {err}</div>}

      {s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card label="Match %" value={`${s.matchPct}%`} sub={`${s.matched}/${s.airKeys} SO+SUB`} accent={MAROON} />
            <Card label="✓ Matched" value={s.matched} sub="ใช้ final_pcs" accent="#15803d" />
            <Card label="⚠ Not found" value={s.notFound} sub="air มี · mp ไม่มี" accent="#b45309" />
            <Card label="➕ Mer upload" value={s.merUpload} sub="mp มี · air ไม่มี" accent="#0369a1" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "matched", "not_found", "mer_upload"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${tab === t ? "text-white" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                style={tab === t ? { background: MAROON, borderColor: MAROON } : {}}>
                {t === "all" ? `ทั้งหมด (${data.rows.length})` : t === "matched" ? `Matched (${s.matched})` : t === "not_found" ? `Not found (${s.notFound})` : `Mer upload (${s.merUpload})`}
              </button>
            ))}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหา SO / SUB / เอกสาร"
              className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-200" />
            <button onClick={exportCsv} className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">⬇ Export CSV</button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">SO</th>
                  <th className="px-3 py-2 font-medium">SUB</th>
                  <th className="px-3 py-2 font-medium text-right">QTY Air (final_pcs)</th>
                  <th className="px-3 py-2 font-medium text-right">Air QTY</th>
                  <th className="px-3 py-2 font-medium">Documents</th>
                  <th className="px-3 py-2 font-medium">INV (air / mp)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, CAP).map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5"><span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-medium ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label || r.status}</span></td>
                    <td className="px-3 py-1.5 font-mono">{r.so}</td>
                    <td className="px-3 py-1.5 font-mono">{r.sub || "-"}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums" style={{ color: r.qtyAir != null ? MAROON : "#cbd5e1" }}>{r.qtyAir != null ? r.qtyAir.toLocaleString() : "-"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{r.airQty != null ? r.airQty.toLocaleString() : "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">{r.docs.join(", ") || "-"}</td>
                    <td className="px-3 py-1.5 text-gray-400 text-[10px]">{(r.airInv.join(",") || "-") + " / " + (r.mpInv.join(",") || "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > CAP && <div className="px-3 py-2 text-[11px] text-amber-600 border-t border-gray-100">แสดง {CAP} จาก {filtered.length.toLocaleString()} แถว — ใช้ช่องค้นหา หรือ Export CSV เพื่อดูทั้งหมด</div>}
            {filtered.length === 0 && <div className="px-3 py-6 text-center text-gray-400 text-sm">ไม่พบข้อมูล</div>}
          </div>
        </>
      )}
    </div>
  )
}

function Card({ label, value, sub, accent }: { label: string; value: any; sub: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
