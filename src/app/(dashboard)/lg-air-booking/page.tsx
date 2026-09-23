"use client"
import { useEffect, useMemo, useState } from "react"

// LG AIR BOOKING (admin trial · NYG · READ-ONLY preview) — INV-FIRST flow:
//   Step 1: pick a BRAND (1 HAWB = 1 brand) → tick INVs of that brand
//   Step 2: see every SO+SUB on the invoice; tick the SOs that reached LG (others locked)
// Data from /api/lg-inv-booking (admin-only). No writes — "ไปหน้าเพิ่ม HAWB" is a placeholder.
const MAROON = "#6b1a1a"
type Line = { so: string; sub: string; pcs: number; style: string; air: "ready" | "pending" | "none" }
type Inv = { inv: string; sos: Line[]; total: number; ready: number; complete: boolean }
type Brand = { brand: string; invCount: number; readySo: number; invs: Inv[] }

const AIR: Record<string, { txt: string; cls: string }> = {
  ready:   { txt: "✓ พร้อม (ถึงคิว LG)", cls: "bg-green-100 text-green-700" },
  pending: { txt: "⏳ ยังไม่ถึงคิว LG",   cls: "bg-amber-100 text-amber-700" },
  none:    { txt: "✚ ไม่มีใน air req → SCM", cls: "bg-red-100 text-red-700" },
}

export default function LgAirBookingPage() {
  const [data, setData] = useState<{ brands: Brand[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [step, setStep] = useState<1 | 2>(1)
  const [brand, setBrand] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [pickedInv, setPickedInv] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<Record<string, boolean>>({}) // `${inv}|${so}|${sub}` -> bool

  useEffect(() => {
    setLoading(true); setErr("")
    fetch("/api/lg-inv-booking").then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      return d
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  const brands = data?.brands || []
  const brandObj = useMemo(() => brands.find(b => b.brand === brand) || null, [brands, brand])
  const qq = q.trim().toLowerCase()
  const invList = useMemo(() => !brandObj ? [] : brandObj.invs.filter(iv => !qq || iv.inv.toLowerCase().includes(qq)), [brandObj, qq])

  const selectBrand = (b: string) => { if (b !== brand) { setBrand(b); setPickedInv(new Set()) } }
  const toggleInv = (inv: string, on: boolean) => setPickedInv(p => { const s = new Set(p); on ? s.add(inv) : s.delete(inv); return s })

  const go2 = () => {
    if (!pickedInv.size) { alert("เลือก INV ก่อน"); return }
    // default-tick all ready lines of the picked INVs
    const next: Record<string, boolean> = {}
    for (const iv of (brandObj?.invs || [])) {
      if (!pickedInv.has(iv.inv)) continue
      for (const l of iv.sos) if (l.air === "ready") next[`${iv.inv}|${l.so}|${l.sub}`] = true
    }
    setSel(next); setStep(2)
  }

  const chosenInvs = useMemo(() => (brandObj?.invs || []).filter(iv => pickedInv.has(iv.inv)), [brandObj, pickedInv])
  const toggleLine = (inv: string, l: Line) => { const k = `${inv}|${l.so}|${l.sub}`; setSel(s => ({ ...s, [k]: !s[k] })) }
  const toggleAll = (iv: Inv, on: boolean) => setSel(s => { const n = { ...s }; for (const l of iv.sos) if (l.air === "ready") n[`${iv.inv}|${l.so}|${l.sub}`] = on; return n })

  const summary = useMemo(() => {
    let ready = 0, locked = 0, selCnt = 0, selPcs = 0
    for (const iv of chosenInvs) for (const l of iv.sos) {
      if (l.air === "ready") { ready++; if (sel[`${iv.inv}|${l.so}|${l.sub}`]) { selCnt++; selPcs += l.pcs } }
      else locked++
    }
    return { ready, locked, selCnt, selPcs }
  }, [chosenInvs, sel])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>LG AIR BOOKING <span className="text-xs font-normal text-gray-400">(ทดลอง · admin · read-only · INV-first)</span></h1>
        <p className="text-xs text-gray-500 mt-0.5">เลือก brand → ติ๊ก INV จาก <b>mp_line</b> → เห็นทุก SO ในใบ → ติ๊ก SO ที่ถึงคิว LG → เพิ่ม HAWB · <b>1 HAWB = brand เดียว</b></p>
        <div className="flex items-center gap-2 mt-3 text-xs flex-wrap">
          {[[1, "เลือก brand + INV"], [2, "ติ๊ก SO ที่พร้อม"]].map(([nn, l]) => (
            <span key={nn as number} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-medium ${step === nn ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200"}`} style={step === nn ? { background: MAROON } : {}}>
              <span className={`w-4 h-4 rounded-full grid place-items-center text-[10px] ${step === nn ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>{nn as number}</span>{l}
            </span>
          ))}
          <span className="text-gray-300">→ 3 เพิ่ม HAWB (ไม่ต้องกรอก INV) → 4 ส่งต่อ claim</span>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">กำลังโหลด…</div>}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">โหลดไม่สำเร็จ: {err}</div>}

      {data && step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="block text-xs font-semibold text-gray-600 mb-2">1) เลือก Brand <span className="text-gray-400 font-normal">— 1 HAWB = brand เดียว ทำทีละ brand</span></label>
          <div className="flex flex-wrap gap-2">
            {brands.map(b => (
              <button key={b.brand} onClick={() => selectBrand(b.brand)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${brand === b.brand ? "text-white border-transparent" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-red-300"}`}
                style={brand === b.brand ? { background: MAROON } : {}}>
                {b.brand} <span className="text-[10px] opacity-70">{b.invCount} INV · พร้อม {b.readySo}</span>
              </button>
            ))}
            {brands.length === 0 && <span className="text-xs text-gray-400">ไม่มีข้อมูล mp_line</span>}
          </div>

          <label className="block text-xs font-semibold text-gray-600 mb-2 mt-5">2) ติ๊กเลือก INV ของ brand นี้</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหา INV ใน brand นี้…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          <div className="mt-2.5 border border-gray-200 rounded-lg max-h-[40vh] overflow-auto">
            {!brand ? <div className="p-4 text-center text-xs text-gray-400">⬆ เลือก brand ก่อน แล้ว INV จะขึ้นให้ติ๊ก</div>
              : invList.length === 0 ? <div className="p-4 text-center text-xs text-gray-400">ไม่พบ INV ใน brand นี้</div>
              : invList.map(iv => { const on = pickedInv.has(iv.inv); return (
                <label key={iv.inv} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50 ${on ? "bg-green-50/70" : ""}`}>
                  <input type="checkbox" checked={on} onChange={e => toggleInv(iv.inv, e.target.checked)} className="w-4 h-4 align-middle" style={{ accentColor: "#12855f" }} />
                  <span className="font-mono font-bold text-[13px]">{iv.inv}</span>
                  <span className="ml-auto text-[11px] text-gray-400 whitespace-nowrap">{iv.total} SO · <span className="text-green-700 font-semibold">พร้อม {iv.ready}</span>{iv.complete ? "" : " · บางส่วน"}</span>
                </label>
              )})}
          </div>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button onClick={go2} disabled={!pickedInv.size} className="text-sm font-bold text-white px-5 py-2.5 rounded-lg disabled:opacity-40" style={{ background: MAROON }}>ถัดไป → ดู SO ในใบ</button>
            <span className="text-xs text-gray-400">เลือก {pickedInv.size} INV</span>
            {pickedInv.size > 0 && <button onClick={() => setPickedInv(new Set())} className="text-xs text-red-600 hover:underline">ล้าง</button>}
          </div>
        </div>
      )}

      {data && step === 2 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: "✓ SO พร้อมทำ", v: summary.ready, c: "#15803d" },
              { l: "🔒 SO ที่ล็อก", v: summary.locked, c: "#b45309" },
              { l: "✅ เลือกแล้ว (ไป HAWB)", v: `${summary.selCnt} · ${summary.selPcs.toLocaleString()} pcs`, c: "#15803d" },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-[11px] text-gray-400">{k.l}</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: k.c }}>{k.v}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setStep(1)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">← แก้ INV</button>
            <span className="text-xs text-gray-500 font-semibold">Brand: {brand}</span>
            <button onClick={() => alert(`→ ไปหน้าเพิ่ม HAWB (หน้าเดิม)\n\n• SO/INV ที่ติ๊กไว้มาให้แล้ว — ไม่ต้องกรอก INV\n• LG ใส่ HAWB + expense (1 HAWB = ${brand})\n• SO ที่ล็อก (ยังไม่ถึงคิว LG) ถูกข้ามไว้\n\n(preview — ยังไม่เขียนลง flow จริง)\n\nพร้อมส่ง: ${summary.selCnt} SO`)}
              disabled={summary.selCnt === 0}
              className="ml-auto text-sm font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: "#15803d" }}>ไปหน้าเพิ่ม HAWB ({summary.selCnt})</button>
          </div>

          {chosenInvs.map(iv => {
            const allReadyOn = iv.sos.filter(l => l.air === "ready").every(l => sel[`${iv.inv}|${l.so}|${l.sub}`]) && iv.ready > 0
            return (
              <div key={iv.inv} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 flex-wrap">
                  <span className="font-mono font-bold text-[15px]">{iv.inv}</span>
                  <span className="ml-auto flex items-center gap-2.5">
                    <span className="w-28 h-1.5 rounded bg-gray-200 overflow-hidden"><i className="block h-full bg-green-600" style={{ width: `${iv.total ? Math.round(iv.ready / iv.total * 100) : 0}%` }} /></span>
                    <span className={`text-[11.5px] font-semibold ${iv.complete ? "text-green-700" : "text-amber-700"}`}>{iv.complete ? "✓ INV ครบ" : "บางส่วน"} · พร้อม {iv.ready}/{iv.total} SO</span>
                  </span>
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-3.5 py-2 w-10 text-center">{iv.ready > 0 && <input type="checkbox" checked={allReadyOn} onChange={e => toggleAll(iv, e.target.checked)} />}</th>
                    <th className="px-3.5 py-2">SO</th><th className="px-3.5 py-2">SUB</th><th className="px-3.5 py-2 text-right">QTY (mp_line)</th><th className="px-3.5 py-2">สถานะ air req</th>
                  </tr></thead>
                  <tbody>
                    {iv.sos.map((l, i) => { const k = `${iv.inv}|${l.so}|${l.sub}`; const on = !!sel[k]; const a = AIR[l.air]
                      const ready = l.air === "ready"
                      return (
                        <tr key={i} onClick={() => ready && toggleLine(iv.inv, l)}
                          className={`border-b border-gray-50 last:border-0 ${ready ? `cursor-pointer ${on ? "bg-green-50/70" : "hover:bg-gray-50"}` : "bg-gray-50/70 text-gray-400"}`}>
                          <td className="px-3.5 py-2.5 text-center">{ready
                            ? <input type="checkbox" checked={on} onChange={() => toggleLine(iv.inv, l)} onClick={e => e.stopPropagation()} className="align-middle" style={{ accentColor: "#12855f" }} />
                            : <span title="ล็อก">🔒</span>}</td>
                          <td className="px-3.5 py-2.5 font-mono font-bold">{l.so}</td>
                          <td className="px-3.5 py-2.5 font-mono">SUB {l.sub || "-"}</td>
                          <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">{l.pcs.toLocaleString()}</td>
                          <td className="px-3.5 py-2.5"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${a.cls}`}>{a.txt}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {!iv.complete && <div className="px-4 py-2 text-[11.5px] text-amber-700 bg-amber-50 border-t border-amber-100">⚠ INV นี้ยังไม่ครบ — มี SO ที่ยังทำไม่ได้ (ยังไม่ถึงคิว LG / ไม่มีใน air req) · ทำ partial ที่พร้อมก่อนได้ · HAWB จะยังไม่ปิดจนครบ</div>}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
