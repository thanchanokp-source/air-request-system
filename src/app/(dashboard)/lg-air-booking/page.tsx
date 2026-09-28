"use client"
import { useEffect, useMemo, useState } from "react"

// LG AIR BOOKING (admin trial · NYG · READ-ONLY preview) — INV-FIRST flow:
//   Step 1: pick a BRAND (1 HAWB = 1 brand) → tick INVs of that brand
//   Step 2: see every SO+SUB on the invoice; tick the SOs that reached LG (others locked)
// Data from /api/lg-inv-booking (admin-only). No writes — "ไปหน้าเพิ่ม HAWB" is a placeholder.
const MAROON = "#6b1a1a"
type Line = { so: string; sub: string; pcs: number; plan: number | null; est: number | null; qty: "exactly" | "revise" | "auto"; style: string; air: "ready" | "pending" | "auto"; itemId: string | null; reqId: string | null }
// LG can tick every shipped line: "ready" (in air req, at LG → book + advance to claim),
// "pending" (in air req but not yet at LG → shipped already, so LG fills data EARLY as a draft while
// approval keeps running normally), and "auto" (not in air req → prepaid doc → SCM selects claim).
const canTick = (air: string) => air === "ready" || air === "auto" || air === "pending"
const QTY: Record<string, { txt: string; cls: string }> = {
  exactly: { txt: "✓ exactly", cls: "bg-green-100 text-green-700" },
  revise:  { txt: "✏ revise",  cls: "bg-sky-100 text-sky-700" },
  auto:    { txt: "✚ auto add", cls: "bg-red-100 text-red-700" },
}
type Inv = { inv: string; sos: Line[]; total: number; ready: number; complete: boolean }
type Brand = { brand: string; invCount: number; readySo: number; invs: Inv[] }

const AIR: Record<string, { txt: string; cls: string }> = {
  ready:   { txt: "✓ พร้อม (ถึงคิว LG)", cls: "bg-green-100 text-green-700" },
  pending: { txt: "⏳ ยังไม่ถึงคิว · กรอกล่วงหน้าได้", cls: "bg-amber-100 text-amber-700" },
  auto:    { txt: "✚ auto add → SCM", cls: "bg-red-100 text-red-700" },
}

export default function LgAirBookingPage() {
  const [data, setData] = useState<{ brands: Brand[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [brand, setBrand] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [pickedInv, setPickedInv] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<Record<string, boolean>>({}) // `${inv}|${so}|${sub}` -> bool
  const [hawbAll, setHawbAll] = useState("") // ONE HAWB no for all selected INVs (1 HAWB spans many INV)
  const [expAll, setExpAll] = useState("")   // ONE expense/HAWB total → distributed across lines by qty
  const [hawbFiles, setHawbFiles] = useState<File[]>([]) // AWB/expense document(s) for this HAWB
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState("")

  const reload = () => {
    setLoading(true); setErr("")
    fetch("/api/lg-inv-booking").then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      return d
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }

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
      for (const l of iv.sos) if (canTick(l.air)) next[`${iv.inv}|${l.so}|${l.sub}`] = true
    }
    setSel(next); setStep(2)
  }

  const chosenInvs = useMemo(() => (brandObj?.invs || []).filter(iv => pickedInv.has(iv.inv)), [brandObj, pickedInv])
  const toggleLine = (inv: string, l: Line) => { const k = `${inv}|${l.so}|${l.sub}`; setSel(s => ({ ...s, [k]: !s[k] })) }
  const toggleAll = (iv: Inv, on: boolean) => setSel(s => { const n = { ...s }; for (const l of iv.sos) if (canTick(l.air)) n[`${iv.inv}|${l.so}|${l.sub}`] = on; return n })

  const summary = useMemo(() => {
    let ready = 0, locked = 0, selCnt = 0, selPcs = 0
    for (const iv of chosenInvs) for (const l of iv.sos) {
      if (canTick(l.air)) { ready++; if (sel[`${iv.inv}|${l.so}|${l.sub}`]) { selCnt++; selPcs += l.pcs } }
      else locked++
    }
    return { ready, locked, selCnt, selPcs }
  }, [chosenInvs, sel])

  // Go to the in-page TRIAL HAWB entry (step 3) — admin preview, does NOT touch the real
  // /logistics/entry flow. INV is carried over (locked); LG only types HAWB + expense.
  const goHawb = () => {
    if (summary.selCnt === 0) { alert("ยังไม่มี SO ที่เลือก"); return }
    setStep(3)
  }
  // Selected lines grouped by INV (only ticked ready lines) — for step 3.
  const hawbGroups = useMemo(() => chosenInvs
    .map(iv => ({ inv: iv.inv, lines: iv.sos.filter(l => canTick(l.air) && sel[`${iv.inv}|${l.so}|${l.sub}`]) }))
    .filter(g => g.lines.length > 0), [chosenInvs, sel])

  // REAL submit: book the selected READY lines (they have an air req item) via the same proven LG flow
  // (/api/requests/[id]/approve · save_logistics_draft · lgComplete), attach the HAWB file to each
  // involved document, then advance to claim. Actual/SO = expense ÷ total selected pcs × the SO's pcs.
  // AUTO lines (mp_line SO with no air req item) are NOT written here — they need SCM first; we report them.
  const doBook = async () => {
    const hawbNo = hawbAll.trim()
    const exp = parseFloat(String(expAll).replace(/,/g, "")) || 0  // strip thousands separators — parseFloat("295,312.44") would otherwise return 295
    if (!hawbNo) { alert("ใส่เลข HAWB ก่อน"); return }
    if (!exp) { alert("ใส่ EXPENSE/HAWB ก่อน"); return }
    if (hawbFiles.length === 0) { alert("ต้องแนบไฟล์เอกสาร (AWB) ของ HAWB นี้ก่อน"); return }
    const allLines = hawbGroups.flatMap(g => g.lines.map(l => ({ ...l, inv: g.inv })))
    const totalPcs = allLines.reduce((a, l) => a + l.pcs, 0)
    if (totalPcs <= 0) { alert("ไม่มี qty ให้คิด"); return }
    const perUnit = exp / totalPcs
    // exact-sum: distribute expense by qty; the LAST selected line absorbs the rounding remainder so
    // Σ actual === expense to the satang (no drift). Each line's share is stored on l.actual.
    let _acc = 0
    allLines.forEach((l: any, i) => {
      if (i < allLines.length - 1) { l.actual = Math.round(l.pcs * perUnit * 100) / 100; _acc += l.actual }
      else { l.actual = Math.round((exp - _acc) * 100) / 100 }
    })
    const ready = allLines.filter(l => l.air === "ready" && l.itemId && l.reqId)   // at LG → book + advance to claim
    const pending = allLines.filter(l => l.air === "pending" && l.itemId && l.reqId) // shipped but pre-LG → save data only, approval keeps running
    const auto = allLines.filter(l => !l.itemId)                                    // not in air req → prepaid doc → SCM
    if (ready.length === 0 && pending.length === 0 && auto.length === 0) { alert("ยังไม่มี SO ที่เลือก"); return }
    if (!confirm(`บันทึก HAWB ${hawbNo}\n${ready.length ? `${ready.length} SO → ส่งต่อ claim\n` : ""}${pending.length ? `${pending.length} SO → บันทึกข้อมูลล่วงหน้า (approval เดินปกติ)\n` : ""}${auto.length ? `auto ${auto.length} SO → สร้างเอกสารส่ง SCM (Kimita) เลือก claim` : ""}`)) return

    setSubmitting(true); setResult("")
    const today = new Date().toISOString().slice(0, 10)
    const attachTo = async (reqId: string) => {
      for (const f of hawbFiles) {
        const form = new FormData(); form.append("file", f); form.append("category", `HAWB:${hawbNo}`)
        await fetch(`/api/requests/${reqId}/attachments`, { method: "POST", body: form }).catch(() => {})
      }
    }
    // Save a set of lines to their air req items. advance=true → LG "Save & Send" (goes to claim);
    // advance=false → save data ONLY (draft), so a shipped pre-LG SO gets its actual now while its
    // approval (SCM → Saji) keeps running normally in parallel.
    const saveGroup = async (lines: typeof ready, advance: boolean) => {
      const byReq = new Map<string, typeof lines>()
      for (const l of lines) { const a = byReq.get(l.reqId!) || []; a.push(l); byReq.set(l.reqId!, a) }
      for (const [reqId, ls] of byReq) {
        await attachTo(reqId)
        const itemLogistics: any = {}, itemActuals: any = {}, itemShipData: any = {}
        for (const l of ls) {
          itemLogistics[l.itemId!] = { invoiceNo: l.inv, hawbNo, bookingDate: today }
          itemActuals[l.itemId!] = String((l as any).actual) // qty share of the HAWB expense (exact-sum)
          itemShipData[l.itemId!] = { qtyRequestAir: l.pcs }                        // QTY follows mp_line (revise)
        }
        const res = await fetch(`/api/requests/${reqId}/approve`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_logistics_draft", itemLogistics, itemActuals, itemShipData, lgComplete: advance }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
      }
      return byReq.size
    }
    try {
      const readyDocs = await saveGroup(ready, true)      // ready → advance to claim
      const pendingDocs = await saveGroup(pending, false) // pending → save data only, approval unchanged
      // AUTO lines (shipped but never in air req) → create ONE prepaid NYG doc at SCM claim-selection.
      let autoDoc = ""
      if (auto.length > 0) {
        const ares = await fetch("/api/lg-inv-booking", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand, hawbNo, bookingDate: today, lines: auto.map(l => ({ so: l.so, sub: l.sub, inv: l.inv, pcs: l.pcs, style: l.style, actual: (l as any).actual })) }),
        })
        if (!ares.ok) { const e = await ares.json().catch(() => ({})); throw new Error(`auto-add: ${e.error || ares.status}`) }
        const aj = await ares.json().catch(() => ({}))
        autoDoc = aj?.documentNo || ""
        if (aj?.id) for (const f of hawbFiles) { const form = new FormData(); form.append("file", f); form.append("category", `HAWB:${hawbNo}`); await fetch(`/api/requests/${aj.id}/attachments`, { method: "POST", body: form }).catch(() => {}) }
      }
      setResult(`✓ บันทึก HAWB ${hawbNo}${ready.length ? ` · ${ready.length} SO → claim (${readyDocs} เอกสาร)` : ""}${pending.length ? ` · ${pending.length} SO บันทึกล่วงหน้า (รอ approval, ${pendingDocs} เอกสาร)` : ""}${auto.length ? ` · auto ${auto.length} SO → สร้าง ${autoDoc} ส่ง SCM (Kimita)` : ""}`)
      setStep(1); setPickedInv(new Set()); setSel({}); setHawbAll(""); setExpAll(""); setHawbFiles([])
      reload()
    } catch (e: any) {
      alert(`บันทึกไม่สำเร็จ: ${e?.message || "error"}`)
    } finally { setSubmitting(false) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>LG AIR BOOKING <span className="text-xs font-normal text-gray-400">(NYG · INV-first)</span></h1>
        <p className="text-xs text-gray-500 mt-0.5">เลือก brand → ติ๊ก INV → ใส่ HAWB · <b>1 HAWB = brand เดียว</b></p>
        <div className="flex items-center gap-2 mt-3 text-xs flex-wrap">
          {[[1, "เลือก brand + INV"], [2, "ติ๊ก SO ที่พร้อม"], [3, "ใส่ HAWB (INV มาให้แล้ว)"]].map(([nn, l]) => (
            <span key={nn as number} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-medium ${step === nn ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200"}`} style={step === nn ? { background: MAROON } : {}}>
              <span className={`w-4 h-4 rounded-full grid place-items-center text-[10px] ${step === nn ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>{nn as number}</span>{l}
            </span>
          ))}
          <span className="text-gray-300">→ 4 ส่งต่อ claim</span>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">กำลังโหลด…</div>}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">โหลดไม่สำเร็จ: {err}</div>}
      {result && <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between gap-3">
        <span>{result}</span><button onClick={() => setResult("")} className="text-green-600 hover:text-green-800 font-bold">✕</button></div>}

      {data && step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="block text-xs font-semibold text-gray-600 mb-2">1) เลือก Brand <span className="text-gray-400 font-normal">— 1 HAWB = brand เดียว ทำทีละ brand</span></label>
          <div className="flex flex-wrap gap-2">
            {brands.map(b => (
              <button key={b.brand} onClick={() => selectBrand(b.brand)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${brand === b.brand ? "text-white border-transparent" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-red-300"}`}
                style={brand === b.brand ? { background: MAROON } : {}}>
                {b.brand} <span className="text-[10px] opacity-70">{b.invCount} INV</span>
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
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setStep(1)} className="text-sm font-semibold px-4 py-2 rounded-lg border-2 text-gray-700 border-gray-300 hover:bg-gray-100">← แก้ INV</button>
            <span className="text-lg font-bold text-gray-900">{brand}</span>
            <button onClick={goHawb}
              disabled={summary.selCnt === 0}
              className="ml-auto text-sm font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-40" style={{ background: "#15803d" }}>ไปหน้าเพิ่ม HAWB ({summary.selCnt})</button>
          </div>

          {chosenInvs.map(iv => {
            const allReadyOn = iv.sos.filter(l => canTick(l.air)).every(l => sel[`${iv.inv}|${l.so}|${l.sub}`]) && iv.ready > 0
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
                    <th className="px-3.5 py-2">SO</th><th className="px-3.5 py-2">SUB</th><th className="px-3.5 py-2 text-right">QTY แผน</th><th className="px-3.5 py-2 text-right">QTY mp_line</th><th className="px-3.5 py-2">qty</th><th className="px-3.5 py-2">สถานะ air req</th>
                  </tr></thead>
                  <tbody>
                    {iv.sos.map((l, i) => { const k = `${iv.inv}|${l.so}|${l.sub}`; const on = !!sel[k]; const a = AIR[l.air]
                      const ready = canTick(l.air)
                      return (
                        <tr key={i} onClick={() => ready && toggleLine(iv.inv, l)}
                          className={`border-b border-gray-50 last:border-0 ${ready ? `cursor-pointer ${on ? "bg-green-50/70" : "hover:bg-gray-50"}` : "bg-gray-50/70 text-gray-400"}`}>
                          <td className="px-3.5 py-2.5 text-center">{ready
                            ? <input type="checkbox" checked={on} onChange={() => toggleLine(iv.inv, l)} onClick={e => e.stopPropagation()} className="align-middle" style={{ accentColor: "#12855f" }} />
                            : <span title="ล็อก">🔒</span>}</td>
                          <td className="px-3.5 py-2.5 font-mono font-bold">{l.so}</td>
                          <td className="px-3.5 py-2.5 font-mono">SUB {l.sub || "-"}</td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums text-gray-500">{l.plan == null ? "—" : l.plan.toLocaleString()}</td>
                          <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">{l.pcs.toLocaleString()}</td>
                          <td className="px-3.5 py-2.5"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${QTY[l.qty].cls}`}>{QTY[l.qty].txt}</span></td>
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

      {data && step === 3 && (() => {
        const allLines = hawbGroups.flatMap(g => g.lines.map(l => ({ ...l, inv: g.inv })))
        const totalPcs = allLines.reduce((a, l) => a + l.pcs, 0)
        const exp = parseFloat(String(expAll).replace(/,/g, "")) || 0  // strip commas (295,312.44 → 295312.44)
        const perUnit = totalPcs > 0 ? exp / totalPcs : 0
        return (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setStep(2)} className="text-sm font-semibold px-4 py-2 rounded-lg border-2 text-gray-700 border-gray-300 hover:bg-gray-100">← กลับไปเลือก SO</button>
            <span className="text-lg font-bold text-gray-900">{brand}</span>
          </div>

          {/* One HAWB for all selected INVs */}
          <div className="bg-white rounded-xl border-2 border-orange-200 overflow-hidden">
            <div className="flex flex-wrap items-end gap-4 px-4 py-3.5 bg-orange-50/70 border-b border-orange-100">
              <div>
                <label className="block text-[11px] font-semibold text-orange-700 mb-1">HAWB# <span className="text-red-500">*</span> <span className="font-normal text-gray-400">(1 ใบสำหรับ {hawbGroups.length} INV ที่เลือก)</span></label>
                <input value={hawbAll} onChange={e => setHawbAll(e.target.value)} placeholder="ใส่เลข HAWB…"
                  className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-orange-700 mb-1">EXPENSE / HAWB (THB)</label>
                <input value={expAll} onChange={e => setExpAll(e.target.value)} inputMode="numeric" placeholder="0"
                  className="w-44 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-200" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-orange-700 mb-1">เอกสารแนบ (AWB) <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 cursor-pointer whitespace-nowrap">📎 แนบไฟล์
                    <input type="file" multiple className="hidden" onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ""; setHawbFiles(p => [...p, ...fs]) }} />
                  </label>
                  {hawbFiles.length === 0 && <span className="text-[10px] text-gray-400">— ยังไม่มีไฟล์ —</span>}
                  {hawbFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 max-w-[160px]">
                      <span className="text-blue-600 truncate">📎 {f.name}</span>
                      <button onClick={() => setHawbFiles(p => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 font-bold leading-none shrink-0">✕</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[11px] text-gray-400">รวม</p>
                <p className="text-sm font-bold text-gray-700">{hawbGroups.length} INV · {allLines.length} SO · {totalPcs.toLocaleString()} pcs</p>
                <p className="text-[11px] text-gray-400">Actual/SO = {exp ? `${exp.toLocaleString()} ÷ ${totalPcs.toLocaleString()} × qty` : "expense ÷ qty รวม × qty"}</p>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="px-3.5 py-2">INV (mp_line)</th><th className="px-3.5 py-2">SO</th><th className="px-3.5 py-2">SUB</th>
                <th className="px-3.5 py-2 text-right">QTY (mp_line)</th><th className="px-3.5 py-2 text-right">EST (air req)</th><th className="px-3.5 py-2 text-right">Actual (preview)</th><th className="px-3.5 py-2 text-right">Δ vs EST</th>
              </tr></thead>
              <tbody>
                {allLines.map((l, i) => {
                  const actual = exp ? Math.round(l.pcs * perUnit * 100) / 100 : null
                  const d = actual != null && l.est != null ? Math.round((actual - l.est) * 100) / 100 : null
                  return (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-3.5 py-2 font-mono text-gray-500">{l.inv}</td>
                    <td className="px-3.5 py-2 font-mono font-bold">{l.so}</td>
                    <td className="px-3.5 py-2 font-mono">SUB {l.sub || "-"}</td>
                    <td className="px-3.5 py-2 text-right font-semibold tabular-nums">{l.pcs.toLocaleString()}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-sky-700">{l.est != null ? l.est.toLocaleString() : "—"}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-teal-700 font-semibold">{actual != null ? actual.toLocaleString() : "—"}</td>
                    <td className={`px-3.5 py-2 text-right tabular-nums font-semibold ${d == null ? "text-gray-300" : d > 0 ? "text-red-600" : d < 0 ? "text-green-600" : "text-gray-400"}`}>{d == null ? "—" : (d > 0 ? "+" : "") + d.toLocaleString()}</td>
                  </tr>
                  )
                })}
              </tbody>
              <tfoot><tr className="border-t border-gray-200 bg-gray-50/60 font-bold">
                <td className="px-3.5 py-2" colSpan={3}>รวม</td>
                <td className="px-3.5 py-2 text-right tabular-nums">{totalPcs.toLocaleString()}</td>
                <td className="px-3.5 py-2 text-right tabular-nums text-sky-700">{(() => { const e = allLines.reduce((a, l) => a + (l.est || 0), 0); return e ? e.toLocaleString() : "—" })()}</td>
                <td className="px-3.5 py-2 text-right tabular-nums text-teal-700">{exp ? exp.toLocaleString() : "—"}</td>
                <td className="px-3.5 py-2 text-right tabular-nums">{(() => { const e = allLines.reduce((a, l) => a + (l.est || 0), 0); const d = exp && e ? Math.round((exp - e) * 100) / 100 : null; return d == null ? "—" : (d > 0 ? "+" : "") + d.toLocaleString() })()}</td>
              </tr></tfoot>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={doBook} disabled={submitting}
              className="text-sm font-bold text-white px-5 py-2.5 rounded-lg disabled:opacity-50" style={{ background: "#15803d" }}>
              {submitting ? "กำลังบันทึก…" : "บันทึก + ส่งต่อ claim"}</button>
            <span className="text-xs text-gray-400">ถ้าต้องแยกหลาย HAWB (คนละเที่ยว) → แยกทำทีละชุด INV</span>
          </div>
        </>
        )
      })()}
    </div>
  )
}
