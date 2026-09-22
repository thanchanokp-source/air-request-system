"use client"
import { useEffect, useMemo, useState } from "react"

// LG AIR BOOKING (admin trial · NYG · READ-ONLY preview) — SO-driven LG flow:
//   Step 1: search + pick SOs · Step 2: select INV (mapped to mp_line), live status.
// Data comes from /api/air-export-map (admin-only). No writes yet — the "ไปหน้าเพิ่ม HAWB"
// action is a placeholder until the write path + HAWB grouping are locked.
const MAROON = "#6b1a1a"
type Line = { sub: string; inv: string; pcs: number; style?: string; etd?: string; forwarder?: string }
type RowA = { status: string; so: string; brand: string[]; qtyPlan: number | null; qtyAirMap: number; lines: Line[]; docs: string[]; airInv: string[] }
type RowB = { status: string; so: string; brand: string[]; qtyPlan: number | null; docs: string[]; airInv: string[] }
type Data = { tabA: RowA[]; tabB: RowB[]; counts: any; error?: string }
type Pool = { so: string; brand: string; inMp: boolean; plan: number | null; lines: Line[]; docs: string[] }

const n = (v: number | null) => (v == null ? "—" : v.toLocaleString())

export default function LgAirBookingPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [step, setStep] = useState<1 | 2>(1)
  const [q, setQ] = useState("")
  const [dropOpen, setDropOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // per-SO selected INV line indices (default = all)
  const [sel, setSel] = useState<Record<string, Set<number>>>({})
  const [q2, setQ2] = useState("")

  useEffect(() => {
    setLoading(true); setErr("")
    fetch("/api/air-export-map").then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      return d
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  // Build the SO pool from the reconcile payload.
  const pool = useMemo<Pool[]>(() => {
    if (!data) return []
    const out: Pool[] = []
    for (const r of data.tabA || []) out.push({ so: r.so, brand: r.brand[0] || "(no brand)", inMp: true, plan: r.qtyPlan, lines: r.lines || [], docs: r.docs || [] })
    for (const r of data.tabB || []) out.push({ so: r.so, brand: r.brand[0] || "(no brand)", inMp: false, plan: r.qtyPlan, lines: [], docs: r.docs || [] })
    return out
  }, [data])
  const poolBySo = useMemo(() => { const m = new Map<string, Pool>(); for (const p of pool) m.set(p.so, p); return m }, [pool])

  const qq = q.trim().toLowerCase()
  const dropList = useMemo(() => pool
    .filter(p => !qq || p.so.toLowerCase().includes(qq) || p.brand.toLowerCase().includes(qq))
    .slice(0, 25), [pool, qq])

  const addSO = (so: string) => { setPicked(p => new Set(p).add(so)); setQ("") }
  const removeSO = (so: string) => setPicked(p => { const s = new Set(p); s.delete(so); return s })
  const clearAll = () => setPicked(new Set())

  // selected INV set for a SO (default all lines)
  const selOf = (p: Pool) => sel[p.so] ?? new Set(p.lines.map((_, i) => i))
  const setSelOf = (so: string, s: Set<number>) => setSel(prev => ({ ...prev, [so]: s }))
  const toggleLine = (p: Pool, i: number) => { const s = new Set(selOf(p)); s.has(i) ? s.delete(i) : s.add(i); setSelOf(p.so, s) }
  const toggleAllLines = (p: Pool, on: boolean) => setSelOf(p.so, on ? new Set(p.lines.map((_, i) => i)) : new Set())

  const selPcs = (p: Pool) => p.lines.reduce((a, l, i) => a + (selOf(p).has(i) ? l.pcs : 0), 0)
  const statusOf = (p: Pool) => {
    if (!p.inMp) return { k: "noship", cls: "bg-amber-100 text-amber-700 border-amber-200", txt: "⏳ ยังไม่มี record ship" }
    const pcs = selPcs(p)
    if (p.plan == null) return { k: "auto", cls: "bg-red-100 text-red-700 border-red-200", txt: "✚ auto air prepaid" }
    if (p.plan === pcs) return { k: "exactly", cls: "bg-green-100 text-green-700 border-green-200", txt: "✓ exactly" }
    return { k: "revise", cls: "bg-sky-100 text-sky-700 border-sky-200", txt: "✏ revise qty" }
  }

  // Step 2 rows grouped by brand
  const chosen = useMemo(() => [...picked].map(so => poolBySo.get(so)).filter(Boolean) as Pool[], [picked, poolBySo])
  const q2q = q2.trim().toLowerCase()
  const groups = useMemo(() => {
    const g: Record<string, Pool[]> = {}
    for (const p of chosen) {
      if (q2q && !(p.so.toLowerCase().includes(q2q) || p.brand.toLowerCase().includes(q2q) || p.lines.some(l => l.inv.toLowerCase().includes(q2q)))) continue
      ;(g[p.brand] = g[p.brand] || []).push(p)
    }
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.so.localeCompare(b.so))
    return g
  }, [chosen, q2q])

  const summary = useMemo(() => {
    let exactly = 0, revise = 0, auto = 0, noship = 0, ready = 0
    for (const p of chosen) {
      const st = statusOf(p)
      if (st.k === "exactly") exactly++; else if (st.k === "revise") revise++; else if (st.k === "auto") auto++; else if (st.k === "noship") noship++
      if (p.inMp && selPcs(p) > 0) ready++
    }
    return { exactly, revise, auto, noship, ready }
  }, [chosen, sel])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>LG AIR BOOKING <span className="text-xs font-normal text-gray-400">(ทดลอง · admin · read-only)</span></h1>
        <p className="text-xs text-gray-500 mt-0.5">เลือก SO ที่จะทำ → เลือก INV → ระบบ map กับ <b>mp_line</b> (SHIPPED · AIR PP) ให้อัตโนมัติ → ครบแล้วไปหน้าเพิ่ม HAWB</p>
        <div className="flex items-center gap-2 mt-3 text-xs flex-wrap">
          {[[1, "เลือก SO"], [2, "เลือก INV + ตรวจ map"]].map(([nn, l]) => (
            <span key={nn as number} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-medium ${step === nn ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200"}`} style={step === nn ? { background: MAROON } : {}}>
              <span className={`w-4 h-4 rounded-full grid place-items-center text-[10px] ${step === nn ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>{nn as number}</span>{l}
            </span>
          ))}
          <span className="text-gray-300">→ 3 เพิ่ม HAWB (หน้าเดิม · ไม่ต้องกรอก INV) → 4 ส่งต่อ claim</span>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">กำลังโหลด…</div>}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">โหลดไม่สำเร็จ: {err}</div>}

      {data && step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">ค้นหา + เลือก SO ที่จะทำ (พิมพ์ SO หรือ brand — ข้าม doc ได้)</label>
          <div className="relative">
            <input value={q} onChange={e => { setQ(e.target.value); setDropOpen(true) }} onFocus={() => setDropOpen(true)}
              onBlur={() => setTimeout(() => setDropOpen(false), 150)} autoComplete="off"
              placeholder="🔍 พิมพ์ SO หรือ brand เช่น 9261 / fanatics…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            {dropOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-auto">
                {dropList.length ? dropList.map(p => (
                  <div key={p.so} onMouseDown={e => { e.preventDefault(); addSO(p.so) }}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-gray-50 last:border-0 hover:bg-red-50/60 ${picked.has(p.so) ? "opacity-40 pointer-events-none" : ""}`}>
                    <span className="font-mono font-bold text-[13px]">{p.so}</span>
                    <span className="text-xs text-gray-500">{p.brand}</span>
                    <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.inMp ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{p.inMp ? "✓ mp_line" : "⏳ ยังไม่เจอ"}</span>
                  </div>
                )) : <div className="px-3 py-3 text-xs text-gray-400">ไม่พบ SO ที่ตรง</div>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 min-h-[8px]">
            {[...picked].map(so => { const p = poolBySo.get(so); return (
              <span key={so} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${p?.inMp ? "bg-red-50 text-red-800 border-red-100" : "bg-amber-50 text-amber-800 border-amber-100"}`}>
                <b className="font-mono">{so}</b><span className="opacity-70">{p?.brand}</span>
                <span onClick={() => removeSO(so)} className="w-4 h-4 rounded-full bg-black/5 grid place-items-center cursor-pointer hover:bg-red-500 hover:text-white">✕</span>
              </span>
            )})}
          </div>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button onClick={() => { if (!picked.size) { alert("เลือก SO ก่อน"); return } setStep(2) }}
              className="text-sm font-bold text-white px-5 py-2.5 rounded-lg disabled:opacity-40" style={{ background: MAROON }} disabled={!picked.size}>ถัดไป → เลือก INV</button>
            <span className="text-xs text-gray-400">{picked.size} SO</span>
            {picked.size > 0 && <button onClick={clearAll} className="text-xs text-red-600 hover:underline">ล้าง</button>}
          </div>
        </div>
      )}

      {data && step === 2 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: "✓ exactly", v: summary.exactly, c: "#15803d" },
              { l: "✏ revise qty", v: summary.revise, c: "#0369a1" },
              { l: "✚ auto prepaid", v: summary.auto, c: "#b91c1c" },
              { l: "⏳ ยังไม่มี record ship", v: summary.noship, c: "#b45309" },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-[11px] text-gray-400">{k.l}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: k.c }}>{k.v}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setStep(1)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">← แก้รายการ SO</button>
            <input value={q2} onChange={e => setQ2(e.target.value)} placeholder="🔍 ค้นหา SO / INV / Brand"
              className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            <button onClick={() => alert(`→ ไปหน้าเพิ่ม HAWB (หน้าเดิม)\n\n• INV ที่เลือกไว้มาให้แล้ว — ไม่ต้องกรอก INV\n• LG ใส่ HAWB + expense (จัดกลุ่มตามเที่ยว/HAWB, 1 HAWB = brand เดียว)\n• auto prepaid → ผ่าน SCM เลือก claim ก่อน\n\n(ยังเป็น preview — ยังไม่เขียนลง flow จริง)\n\nพร้อมส่ง: ${summary.ready} SO`)}
              disabled={summary.ready === 0}
              className="text-sm font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: "#15803d" }}>ไปหน้าเพิ่ม HAWB ({summary.ready})</button>
          </div>

          {Object.entries(groups).map(([brand, rows]) => (
            <div key={brand} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 border-l-4" style={{ borderColor: "#c8ccd6" }}>
                <span className="font-bold text-sm">{brand}</span>
                <span className="text-[11px] text-gray-500">🧾 HAWB แยกตาม brand (มีได้หลาย HAWB)</span>
                <span className="ml-auto text-[11px] text-gray-500">{rows.length} SO</span>
              </div>
              <div className="grid grid-cols-[1.3fr_1fr_88px_100px_66px_1fr_128px] gap-2.5 px-4 py-2 text-[10.5px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <span>SO</span><span>Style</span><span className="text-right">QTY แผน</span><span className="text-right">QTY mp_line</span><span className="text-right">Δ</span><span>INV</span><span className="text-right">Status</span>
              </div>
              {rows.map(p => {
                const st = statusOf(p); const pcs = selPcs(p); const d = p.plan == null || !p.inMp ? null : pcs - p.plan
                const open = expanded.has(p.so); const s = selOf(p)
                return (
                  <div key={p.so} className="border-b border-gray-100 last:border-0">
                    <div className="grid grid-cols-[1.3fr_1fr_88px_100px_66px_1fr_128px] gap-2.5 px-4 py-2.5 items-center cursor-pointer hover:bg-gray-50/60"
                      onClick={() => setExpanded(e => { const x = new Set(e); x.has(p.so) ? x.delete(p.so) : x.add(p.so); return x })}>
                      <span className="font-mono font-bold text-[13px]">{p.so}</span>
                      <span className="text-xs text-gray-500 truncate">{p.lines[0]?.style || "—"}</span>
                      <span className="text-right text-[13px] font-semibold tabular-nums text-gray-500">{n(p.plan)}</span>
                      <span className={`text-right text-[13px] font-semibold tabular-nums ${st.k === "exactly" ? "text-green-700" : st.k === "revise" ? "text-sky-700" : "text-gray-400"}`}>{p.inMp ? pcs.toLocaleString() : "—"}</span>
                      <span className={`text-right text-xs font-bold tabular-nums ${d ? "text-sky-700" : "text-gray-400"}`}>{d == null ? "—" : d === 0 ? "0" : d > 0 ? "+" + d : d}</span>
                      <span className="text-xs">{p.inMp ? <span className="text-sky-700 font-semibold">{p.lines.length} INV ▾</span> : <span className="text-gray-300">—</span>}</span>
                      <span className={`justify-self-end text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.txt}</span>
                    </div>
                    {open && (
                      <div className="px-4 pb-3.5 pl-11 bg-gray-50/60">
                        {p.inMp ? (
                          <>
                            <div className="text-[11px] text-gray-500 my-2">เลือก INV/SUB ที่จะ claim (ติ๊กออกเฉพาะที่ไม่เอา) · <b>{s.size}</b>/{p.lines.length} INV · <b className="tabular-nums">{pcs.toLocaleString()}</b> pcs · doc: {p.docs.join(", ") || "—"}</div>
                            <table className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
                              <thead><tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-200">
                                <th className="px-2.5 py-1.5 w-8 text-center"><input type="checkbox" checked={s.size === p.lines.length} ref={el => { if (el) el.indeterminate = s.size > 0 && s.size < p.lines.length }} onChange={e => toggleAllLines(p, e.target.checked)} /></th>
                                <th className="px-2.5 py-1.5">SUB (map SO+SUB)</th><th className="px-2.5 py-1.5">INV (mp_line)</th><th className="px-2.5 py-1.5">ETD</th><th className="px-2.5 py-1.5 text-right">pcs</th>
                              </tr></thead>
                              <tbody>
                                {p.lines.map((l, i) => (
                                  <tr key={i} onClick={() => toggleLine(p, i)} className={`cursor-pointer border-b border-gray-50 last:border-0 ${s.has(i) ? "bg-green-50/70" : ""}`}>
                                    <td className="px-2.5 py-2 text-center"><input type="checkbox" checked={s.has(i)} onChange={() => toggleLine(p, i)} onClick={e => e.stopPropagation()} className="align-middle" /></td>
                                    <td className="px-2.5 py-2 font-mono text-xs font-semibold">SUB {l.sub || "-"}</td>
                                    <td className="px-2.5 py-2 font-mono text-xs text-gray-500">{l.inv || "-"}</td>
                                    <td className="px-2.5 py-2 text-xs text-gray-500">{l.etd ? String(l.etd).slice(0, 10) : "—"}</td>
                                    <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{l.pcs.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        ) : (
                          <div className="my-2 px-4 py-3 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold">⏳ SO นี้ยังไม่เจอใน mp_line (SHIPPED · AIR PP) — ส่งไม่ได้จนกว่าจะมี record ship</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {chosen.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">ไม่มี SO ที่เลือก</div>}
        </>
      )}
    </div>
  )
}
