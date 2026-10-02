"use client"
import { useState } from "react"

const MAROON = "#6b1a1a"
const n = (v: any) => (v != null ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-")

export default function FixHawbPage() {
  const [hawb, setHawb] = useState("")
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [newHawb, setNewHawb] = useState("")
  const [total, setTotal] = useState("")
  const [addInv, setAddInv] = useState("")
  const [invPreview, setInvPreview] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (h?: string) => {
    const q = (h ?? hawb).trim()
    if (!q) return
    setLoading(true); setMsg(""); setSel(new Set())
    try {
      const r = await fetch(`/api/admin/fix-hawb?hawb=${encodeURIComponent(q)}`)
      const d = await r.json()
      if (!r.ok) { setMsg("โหลดไม่สำเร็จ: " + (d.error || r.status)); setData(null); return }
      setData(d)
    } finally { setLoading(false) }
  }

  const toggle = (id: string) => setSel(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })
  const allIds = (data?.rows || []).map((r: any) => r.id)
  const allSel = allIds.length > 0 && allIds.every((id: string) => sel.has(id))

  const doRename = async () => {
    if (!sel.size || !newHawb.trim()) { setMsg("ติ๊ก SO + ใส่ HAWB ใหม่ก่อน"); return }
    if (!confirm(`ย้าย ${sel.size} SO → HAWB "${newHawb.trim()}" ?`)) return
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/admin/fix-hawb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rename", itemIds: [...sel], newHawb: newHawb.trim() }) })
      const d = await r.json()
      if (!r.ok) { setMsg("ย้ายไม่สำเร็จ: " + (d.error || r.status)); return }
      setMsg(`✓ ย้าย ${d.moved} SO → ${d.newHawb} · อย่าลืม "ตั้ง total + กระจาย" ให้ทั้ง HAWB เดิมและ HAWB ใหม่`)
      await load()
    } finally { setBusy(false) }
  }

  // ลองดูก่อน (ไม่บันทึก) — ดูว่า INV นี้จะผูก SO ไหนบ้าง
  const doPreviewInv = async () => {
    const iv = addInv.trim()
    if (!iv || !data?.hawb) { setMsg("ใส่เลข INV ก่อน"); return }
    setBusy(true); setMsg(""); setInvPreview(null)
    try {
      const r = await fetch("/api/admin/fix-hawb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_inv", inv: iv, hawb: data.hawb, preview: true }) })
      const d = await r.json()
      if (!r.ok) { setMsg("ลองดูไม่สำเร็จ: " + (d.error || r.status)); return }
      setInvPreview(d)
      if (!d.willAttach?.length) setMsg(`⚠️ เจอ ${d.foundSubs} sub แต่ไม่มี air-req ที่ว่างให้ผูก${d.notFound?.length ? ` · ไม่พบ INV: ${d.notFound.join(", ")}` : ""}`)
    } finally { setBusy(false) }
  }
  // บันทึกจริง (commit) — ผูก SO ของ INV เข้า HAWB แล้ว "กระจาย actual ใหม่" ให้ทุก SO (รวมที่เพิ่ง add)
  const doAddInv = async () => {
    const iv = addInv.trim()
    if (!iv || !data?.hawb) return
    const curTotal = Number(data.totalActual) || 0
    const nInv = invPreview?.invs?.length || 1
    if (!confirm(`บันทึก: ผูก ${invPreview?.willAttach?.length || "?"} SO จาก ${nInv} INV เข้า HAWB ${data.hawb}\nแล้วกระจาย actual รวม ${curTotal.toLocaleString()} ให้ทุก SO ตาม qty ?`)) return
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/admin/fix-hawb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_inv", inv: iv, hawb: data.hawb }) })
      const d = await r.json()
      if (!r.ok) { setMsg("บันทึกไม่สำเร็จ: " + (d.error || r.status)); return }
      if (d.added > 0 && curTotal > 0) {
        // re-divide the HAWB's existing total across ALL SO (old + newly added) by qty
        await fetch("/api/admin/fix-hawb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redistribute", hawb: data.hawb, total: curTotal }) }).catch(() => {})
      }
      setMsg(d.added > 0
        ? `✓ ผูก ${d.added} SO จาก INV ${(d.invs || []).join(", ")} + กระจาย actual ${curTotal.toLocaleString()} ใหม่แล้ว${d.notFound?.length ? ` · ไม่พบ: ${d.notFound.join(", ")}` : ""} · ถ้า total ไม่ถูก ใส่ total ใหม่ที่ ② แล้วกระจายอีกที`
        : `⚠️ ไม่มี SO ให้ผูก`)
      setAddInv(""); setInvPreview(null)
      await load()
    } finally { setBusy(false) }
  }

  // กระจายตาม "ยอดจริงของ INV" (mp_line/export) แทน qty ที่ LG กรอก — ลองดูก่อน แล้วค่อยบันทึก
  const [srcPrev, setSrcPrev] = useState<any | null>(null)
  const [writeQty, setWriteQty] = useState(true)
  const callSrc = async (preview: boolean) => {
    const t = Number(total)
    if (!data?.hawb || !(t > 0)) { setMsg("ใส่ total (>0) ก่อน"); return null }
    const r = await fetch("/api/admin/fix-hawb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redistribute_src", hawb: data.hawb, total: t, preview, writeQty }) })
    const d = await r.json()
    if (!r.ok) { setMsg((preview ? "ลองดู" : "บันทึก") + "ไม่สำเร็จ: " + (d.error || r.status)); return null }
    return d
  }
  const doSrcPreview = async () => {
    setBusy(true); setMsg(""); setSrcPrev(null)
    try { const d = await callSrc(true); if (d) setSrcPrev(d) } finally { setBusy(false) }
  }
  const doSrcSave = async () => {
    if (!srcPrev) return
    if (!confirm(`บันทึก: กระจาย ${Number(total).toLocaleString()} ของ ${data.hawb} ตามยอดจริงของ INV (${srcPrev.realTotal.toLocaleString()} ตัว แทน ${srcPrev.lgTotal.toLocaleString()} ที่ LG กรอก)${writeQty ? "\nและแก้ QTY ship ให้เท่ายอดจริง" : ""} ?`)) return
    setBusy(true); setMsg("")
    try {
      const d = await callSrc(false)
      if (d) { setMsg(`✓ กระจายตามยอดจริงแล้ว ${d.saved} แถว${d.writeQty ? " · แก้ QTY ship แล้ว" : ""}`); setSrcPrev(null); await load() }
    } finally { setBusy(false) }
  }

  const doRedistribute = async (targetHawb: string) => {
    const t = Number(total)
    if (!targetHawb.trim() || !(t > 0)) { setMsg("ใส่ total (>0) ก่อน"); return }
    if (!confirm(`ตั้ง total ของ ${targetHawb} = ${t.toLocaleString()} แล้วกระจาย actual ตาม qty ?`)) return
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/admin/fix-hawb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redistribute", hawb: targetHawb.trim(), total: t }) })
      const d = await r.json()
      if (!r.ok) { setMsg("กระจายไม่สำเร็จ: " + (d.error || r.status)); return }
      setMsg(`✓ กระจาย ${targetHawb} total ${t.toLocaleString()} แล้ว`)
      await load()
    } finally { setBusy(false) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>Fix HAWB (admin)</h1>
        <p className="text-xs text-gray-500 mt-0.5">แก้เลข HAWB ของ SO + ตั้ง total → กระจาย Actual Air ตาม qty · <b>admin เท่านั้น</b></p>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-200 p-3">
        <input value={hawb} onChange={e => setHawb(e.target.value)} onKeyDown={e => e.key === "Enter" && load()}
          placeholder="ใส่ HAWB# เช่น CAR-26080004" className="w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={() => load()} disabled={loading} className="text-sm px-4 py-1.5 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: MAROON }}>{loading ? "…" : "โหลด SO"}</button>
        {data && <span className="text-xs text-gray-500 ml-2">HAWB <b>{data.hawb}</b> · {data.rows.length} SO · QTY รวม {n(data.totalQty)} · Actual รวม {n(data.totalActual)}</span>}
      </div>

      {msg && <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 whitespace-pre-wrap">{msg}</div>}

      {data && (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500"><tr className="text-left">
                <th className="px-3 py-2"><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(allIds))} /></th>
                <th className="px-3 py-2 font-medium">Doc</th><th className="px-3 py-2 font-medium">SO</th><th className="px-3 py-2 font-medium">SUB</th>
                <th className="px-3 py-2 font-medium">Brand</th><th className="px-3 py-2 font-medium">INV</th><th className="px-3 py-2 font-medium">HAWB#</th>
                <th className="px-3 py-2 font-medium text-right">QTY</th><th className="px-3 py-2 font-medium text-right">Actual Air (ตอนนี้)</th>
              </tr></thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.id} className={`border-t border-gray-100 ${sel.has(r.id) ? "bg-red-50/40" : ""}`}>
                    <td className="px-3 py-1.5"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                    <td className="px-3 py-1.5 whitespace-nowrap font-medium">{r.documentNo}</td>
                    <td className="px-3 py-1.5 font-mono">{r.so}</td>
                    <td className="px-3 py-1.5 font-mono">{r.sub || "-"}</td>
                    <td className="px-3 py-1.5">{r.brand || "-"}</td>
                    <td className="px-3 py-1.5">{r.invoiceNo || "-"}</td>
                    <td className="px-3 py-1.5">{r.hawbNo || "-"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{n(r.qty)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color: MAROON }}>{n(r.actualAirFreight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="font-semibold text-sm text-gray-800">① ย้าย SO ที่ติ๊ก → HAWB ใหม่</p>
              <p className="text-[11px] text-gray-400">ติ๊ก SO ที่ผิด (เช่น เอกสาร 2607) แล้วใส่เลข HAWB ที่ถูก</p>
              <div className="flex gap-2">
                <input value={newHawb} onChange={e => setNewHawb(e.target.value)} placeholder="HAWB ใหม่ เช่น CAR-26070004" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                <button onClick={doRename} disabled={busy || !sel.size} className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">ย้าย ({sel.size})</button>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="font-semibold text-sm text-gray-800">② ตั้ง total แล้วกระจาย Actual ตาม qty</p>
              <p className="text-[11px] text-gray-400">ใส่ total ของ HAWB นี้ ({data.hawb}) → กระจายให้ทุก SO ตาม qty</p>
              <div className="flex gap-2">
                <input value={total} onChange={e => setTotal(e.target.value)} type="number" placeholder="total เช่น 288721" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right" />
                <button onClick={() => doRedistribute(data.hawb)} disabled={busy} className="text-sm px-4 py-1.5 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: MAROON }}>กระจาย</button>
              </div>
              {newHawb.trim() && <button onClick={() => doRedistribute(newHawb.trim())} disabled={busy} className="text-xs text-blue-600 hover:underline">…หรือกระจายให้ HAWB ใหม่ ({newHawb.trim()}) ด้วย total นี้</button>}
              <div className="border-t border-gray-100 pt-2 mt-1 space-y-1.5">
                <p className="text-[11px] text-gray-600"><b>หรือ กระจายตามยอดจริงของ INV</b> (mp_line / export) — ใช้เมื่อ LG ใส่ qty / INV ไม่ตรง</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={doSrcPreview} disabled={busy || !(Number(total) > 0)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 font-semibold disabled:opacity-50">👁 ลองดู</button>
                  <button onClick={doSrcSave} disabled={busy || !srcPrev} className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-40">💾 บันทึก</button>
                  <label className="text-[11px] text-gray-600 flex items-center gap-1"><input type="checkbox" checked={writeQty} onChange={e => { setWriteQty(e.target.checked); setSrcPrev(null) }} /> แก้ QTY ship ให้เท่ายอดจริงด้วย</label>
                </div>
                {srcPrev && (
                  <div className="border border-gray-200 rounded-lg overflow-auto max-h-64">
                    <div className="px-2 py-1 text-[11px] text-gray-500 bg-gray-50">ลองดู · INV {srcPrev.invs.length} ใบ · qty ที่ LG กรอก {n(srcPrev.lgTotal)} → ยอดจริง <b className="text-green-700">{n(srcPrev.realTotal)}</b></div>
                    <table className="w-full text-[11px]">
                      <thead className="text-gray-400 bg-white sticky top-0"><tr className="text-left">
                        <th className="px-2 py-1 font-medium">SO / SUB</th><th className="px-2 py-1 font-medium text-right">LG</th><th className="px-2 py-1 font-medium text-right">จริง</th>
                        <th className="px-2 py-1 font-medium text-right">Actual เดิม</th><th className="px-2 py-1 font-medium text-right">Actual ใหม่</th>
                      </tr></thead>
                      <tbody>{srcPrev.summary.map((s: any, i: number) => (
                        <tr key={i} className={`border-t border-gray-50 ${s.lgQty !== s.usedQty ? "bg-amber-50" : ""}`}>
                          <td className="px-2 py-1 font-mono">{s.so} / {s.sub || "-"}{!s.found && <span className="ml-1 text-orange-600" title="ไม่พบใน mp_line/export → ใช้ qty ที่ LG กรอก">⚠</span>}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{n(s.lgQty)}</td>
                          <td className={`px-2 py-1 text-right tabular-nums ${s.lgQty !== s.usedQty ? "font-semibold text-amber-800" : ""}`}>{n(s.usedQty)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-gray-500">{n(s.actualBefore)}</td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold">{n(s.actualAfter)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="font-semibold text-sm text-gray-800">③ เพิ่ม INV เข้า HAWB นี้ ({data.hawb})</p>
            <p className="text-[11px] text-gray-400">ใส่เลข INV (ได้หลายตัว คั่นด้วย <b>comma / เว้นวรรค / ขึ้นบรรทัดใหม่</b>) → กด <b>ลองดู</b> (ยังไม่บันทึก) เพื่อดูว่าจะผูก SO ไหน → ถ้าถูกค่อยกด <b>บันทึก</b></p>
            <div className="flex gap-2 items-start">
              <textarea value={addInv} onChange={e => { setAddInv(e.target.value); setInvPreview(null) }} rows={2} placeholder="INV เช่น G26227806735, G26116906084 …" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono resize-y" />
              <button onClick={doPreviewInv} disabled={busy || !addInv.trim()} className="text-sm px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 font-semibold disabled:opacity-50 whitespace-nowrap">👁 ลองดู</button>
              <button onClick={doAddInv} disabled={busy || !invPreview?.willAttach?.length} className="text-sm px-4 py-1.5 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-40 whitespace-nowrap">💾 บันทึก ({invPreview?.willAttach?.length || 0})</button>
            </div>
            {invPreview && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500">
                  ลองดู (ยังไม่บันทึก) · INV <b>{(invPreview.invs || []).join(", ") || "-"}</b> · เจอ {invPreview.foundSubs} sub · จะผูก <b className="text-green-700">{invPreview.willAttach?.length || 0}</b> SO
                  {invPreview.notFound?.length > 0 && <span className="text-red-500"> · ไม่พบ: {invPreview.notFound.join(", ")}</span>}
                </div>
                {invPreview.willAttach?.length > 0 && (
                  <table className="w-full text-xs"><thead className="bg-white text-gray-400"><tr className="text-left"><th className="px-3 py-1 font-medium">INV</th><th className="px-3 py-1 font-medium">SO</th><th className="px-3 py-1 font-medium">SUB</th><th className="px-3 py-1 font-medium text-right">QTY (จริง)</th></tr></thead>
                    <tbody>{invPreview.willAttach.map((w: any, i: number) => (<tr key={i} className="border-t border-gray-50"><td className="px-3 py-1 font-mono text-gray-500">{w.inv || "-"}</td><td className="px-3 py-1 font-mono">{w.so}</td><td className="px-3 py-1 font-mono">{w.sub || "-"}</td><td className="px-3 py-1 text-right tabular-nums">{n(w.qty)}</td></tr>))}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <b>วิธีใช้ (เคสนี้):</b> โหลด <b>CAR-26080004</b> → ติ๊ก SO ของเอกสาร 2607 → ย้ายไป <b>CAR-26070004</b> (①) → ใส่ total 81,302 กดกระจายให้ CAR-26070004 → กลับมาโหลด CAR-26080004 อีกครั้ง ใส่ total <b>288,721</b> กดกระจาย (②)
          </div>
        </>
      )}

      <DedupeDocBox />
    </div>
  )
}

// ④ ลบแถวที่ซ้ำในเอกสาร — rows that repeat another document's SO+SUB (+qty). Preview → tick → delete.
function DedupeDocBox() {
  const [docNo, setDocNo] = useState("")
  const [res, setRes] = useState<any | null>(null)
  const [pick, setPick] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  const preview = async () => {
    const d0 = docNo.trim(); if (!d0) return
    setBusy(true); setMsg(""); setRes(null)
    try {
      const r = await fetch("/api/admin/dedupe-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentNo: d0, preview: true }) })
      const d = await r.json()
      if (!r.ok) { setMsg("ลองดูไม่สำเร็จ: " + (d.error || r.status)); return }
      setRes(d)
      // pre-tick only EXCESS exact rows (more air-req rows than INV shipment rounds) that LG hasn't booked
      setPick(new Set((d.exact as any[]).filter(x => x.excess && !x.hawbNo).map(x => x.id)))
    } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!res || !pick.size) return
    if (!confirm(`ลบ ${pick.size} แถวออกจาก ${res.documentNo}?\n(ลบถาวร · เก็บ log ไว้ในเอกสาร)`)) return
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/admin/dedupe-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentNo: res.documentNo, itemIds: [...pick] }) })
      const d = await r.json()
      if (!r.ok) { setMsg("ลบไม่สำเร็จ: " + (d.error || r.status)); return }
      setMsg(d.docDeleted ? `✓ ลบ ${d.deleted} แถว · เอกสารว่างแล้วจึงลบทั้งเอกสาร` : `✓ ลบ ${d.deleted} แถว · เหลือ ${d.remaining} แถว`)
      setRes(null); setPick(new Set())
      if (!d.docDeleted) await preview()
    } finally { setBusy(false) }
  }
  const toggle = (id: string) => setPick(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = (rows: any[], on: boolean) => setPick(p => { const s = new Set(p); rows.forEach(r => on ? s.add(r.id) : s.delete(r.id)); return s })

  const Table = ({ rows, title, tone }: { rows: any[]; title: string; tone: string }) => {
    const all = rows.length > 0 && rows.every(r => pick.has(r.id))
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className={`px-3 py-1.5 text-[11px] font-semibold flex items-center gap-2 ${tone}`}>
          <input type="checkbox" checked={all} onChange={e => toggleAll(rows, e.target.checked)} disabled={!rows.length} />
          {title} ({rows.length})
        </div>
        {rows.length > 0 && (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-white text-gray-400 sticky top-0"><tr className="text-left">
                <th className="px-3 py-1 w-6"></th><th className="px-3 py-1 font-medium">SO</th><th className="px-3 py-1 font-medium">SUB</th>
                <th className="px-3 py-1 font-medium text-right">QTY Air</th><th className="px-3 py-1 font-medium">HAWB</th>
                <th className="px-3 py-1 font-medium text-right" title="แถว air request ทั้งหมดของ SO+SUB นี้ / จำนวน INV ที่ส่งจริง (mp_line + export)">แถว / INV ส่งจริง</th>
                <th className="px-3 py-1 font-medium">มีในเอกสาร</th>
              </tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id} className={`border-t border-gray-50 ${pick.has(r.id) ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-1"><input type="checkbox" checked={pick.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="px-3 py-1 font-mono">{r.so}</td><td className="px-3 py-1 font-mono">{r.sub || "-"}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(r.qty)}</td>
                  <td className="px-3 py-1 font-mono">{r.hawbNo ? <span className="text-amber-700" title="แถวนี้ LG ใส่ HAWB แล้ว — ไม่ได้ติ๊กให้อัตโนมัติ">{r.hawbNo}</span> : "-"}</td>
                  <td className={`px-3 py-1 text-right tabular-nums ${r.excess ? "text-red-600 font-semibold" : "text-green-700"}`} title={r.excess ? "แถวมากกว่ารอบที่ส่งจริง → น่าจะซ้ำ" : "จำนวนรอบส่ง (INV) รองรับทุกแถว → อาจเป็นการส่งหลายรอบ"}>
                    {r.airRows} / {r.ships}{r.excess ? "" : " ✓"}
                  </td>
                  <td className="px-3 py-1 text-gray-500">{(r.others || []).join(", ")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 mt-6">
      <p className="font-semibold text-sm text-gray-800">④ ลบแถวที่ซ้ำในเอกสาร</p>
      <p className="text-[11px] text-gray-400">ใส่เลขเอกสาร → <b>ลองดู</b> · ติ๊กให้อัตโนมัติเฉพาะแถวที่ SO+SUB+qty ตรงกับเอกสารอื่น <b>และจำนวนแถว air request มากกว่ารอบที่ส่งจริง (INV ใน mp_line/export)</b> · ยกเว้นแถวที่มี HAWB แล้ว · แถว qty ต่างให้เลือกเอง · แถวใหม่ไม่แตะ</p>
      <div className="flex gap-2">
        <input value={docNo} onChange={e => { setDocNo(e.target.value); setRes(null) }} onKeyDown={e => e.key === "Enter" && preview()} placeholder="เช่น AIR_NYG_2609_0056" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono" />
        <button onClick={preview} disabled={busy || !docNo.trim()} className="text-sm px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 font-semibold disabled:opacity-50 whitespace-nowrap">👁 ลองดู</button>
        <button onClick={remove} disabled={busy || !pick.size} className="text-sm px-4 py-1.5 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-40 whitespace-nowrap">🗑 ลบที่เลือก ({pick.size})</button>
      </div>
      {msg && <p className="text-xs text-gray-700">{msg}</p>}
      {res && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">{res.documentNo} · {res.status} · ทั้งหมด {n(res.total)} แถว · ซ้ำตรง <b className="text-red-600">{res.exact.length}</b> · qty ต่าง <b className="text-amber-700">{res.diff.length}</b> · ใหม่ (เก็บไว้) <b className="text-green-700">{res.fresh}</b></p>
          <Table rows={res.exact} title="ซ้ำตรง (SO+SUB+qty ตรงกับเอกสารอื่น)" tone="bg-red-50 text-red-800" />
          <Table rows={res.diff} title="SO+SUB ซ้ำแต่ qty ต่าง — เลือกเอง" tone="bg-amber-50 text-amber-800" />
        </div>
      )}
    </div>
  )
}
