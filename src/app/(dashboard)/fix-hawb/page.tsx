"use client"
import { useState } from "react"
import * as XLSX from "xlsx"

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

      <SyncShippedBox />
      <ExpenseFileBox />
      <ScanAllHawbBox />
      <DedupeAllBox />
      <DedupeDocBox />
    </div>
  )
}

// ⑥ ลบแถวซ้ำทุกเอกสาร — same rules as the MER upload (lib/dedupe): same SO+SUB+STYLE+QTY in an older
// document, not booked (no HAWB / ACTUAL), and more rows than real shipment rounds. Preview → delete.
function DedupeAllBox() {
  const [res, setRes] = useState<any | null>(null)
  const [pick, setPick] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const post = async (body: any) => {
    const r = await fetch("/api/admin/dedupe-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); return d
  }
  const preview = async () => {
    setBusy(true); setMsg(""); setRes(null)
    try { const d = await post({ preview: true }); setRes(d); setPick(new Set(d.rows.map((x: any) => x.itemId))) }
    catch (e: any) { setMsg("ลองดูไม่สำเร็จ: " + e.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!pick.size) return
    if (!confirm(`ลบแถวซ้ำ ${pick.size} แถว จากเอกสารที่อัปซ้ำ?\n(ลบถาวร · เก็บ log ในเอกสาร · อีเมลแจ้ง admin)`)) return
    setBusy(true); setMsg("")
    try { const d = await post({ itemIds: [...pick] }); setMsg(`✓ ลบ ${d.deleted} แถว จาก ${d.docs} เอกสาร${d.docsDeleted ? ` (ลบทั้งเอกสาร ${d.docsDeleted})` : ""}`); setRes(null); setPick(new Set()) }
    catch (e: any) { setMsg("ลบไม่สำเร็จ: " + e.message) } finally { setBusy(false) }
  }
  const toggleDoc = (doc: string, on: boolean) => setPick(p => { const s = new Set(p); for (const r of res.rows) if (r.documentNo === doc) on ? s.add(r.itemId) : s.delete(r.itemId); return s })
  return (
    <div className="bg-white rounded-xl border border-red-200 p-4 space-y-2 mt-6">
      <p className="font-semibold text-sm text-gray-800">⑥ ลบแถวซ้ำทุกเอกสาร</p>
      <p className="text-[11px] text-gray-500">แถวซ้ำ = SO+SUB+STYLE+QTY ตรงกับแถวในเอกสารที่เก่ากว่า · ยังไม่มี HAWB / ACTUAL · และ SO+SUB มีแถวเกินจำนวนรอบส่งจริง (INV) — เอกสารต้นฉบับไม่ถูกลบ · กฎเดียวกับตอน MER อัปโหลด</p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={preview} disabled={busy} className="text-sm px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 font-semibold disabled:opacity-50">{busy && !res ? "กำลังตรวจ…" : "👁 ลองดู"}</button>
        <button onClick={remove} disabled={busy || !pick.size} className="text-sm px-4 py-1.5 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-40">🗑 ลบที่เลือก ({pick.size})</button>
      </div>
      {msg && <p className="text-xs text-gray-700">{msg}</p>}
      {res && (
        <div className="border border-gray-200 rounded-lg overflow-auto max-h-96">
          <div className="px-3 py-1.5 text-[11px] text-gray-500 bg-gray-50 flex items-center gap-3 sticky top-0 z-10">
            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700">
              <input type="checkbox" checked={res.rows.length > 0 && pick.size === res.rows.length}
                ref={el => { if (el) el.indeterminate = pick.size > 0 && pick.size < res.rows.length }}
                onChange={e => setPick(e.target.checked ? new Set(res.rows.map((x: any) => x.itemId)) : new Set())} />
              เลือกทั้งหมด
            </label>
            <span>แถวซ้ำ <b className="text-red-600">{n(res.total)}</b> แถว จาก {res.docs.length} เอกสาร · เลือก <b>{n(pick.size)}</b></span>
          </div>
          {res.docs.map((d: any) => {
            const rows = res.rows.filter((r: any) => r.documentNo === d.documentNo)
            const all = rows.every((r: any) => pick.has(r.itemId))
            return (
              <details key={d.documentNo} className="border-t border-gray-100">
                <summary className="px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2">
                  <input type="checkbox" checked={all} onChange={e => toggleDoc(d.documentNo, e.target.checked)} onClick={e => e.stopPropagation()} />
                  <b className="font-mono">{d.documentNo}</b> <span className="text-gray-500">· {d.rows} แถว</span>
                </summary>
                <table className="w-full text-[11px]">
                  <tbody>{rows.map((r: any) => (
                    <tr key={r.itemId} className="border-t border-gray-50">
                      <td className="px-3 py-1"><input type="checkbox" checked={pick.has(r.itemId)} onChange={() => setPick(p => { const s = new Set(p); s.has(r.itemId) ? s.delete(r.itemId) : s.add(r.itemId); return s })} /></td>
                      <td className="px-2 py-1 font-mono">{r.so} / {r.sub || "-"}</td><td className="px-2 py-1">{r.style || "-"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{n(r.qty)}</td><td className="px-2 py-1 text-gray-500">ซ้ำกับ {r.twinDoc}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ★ ซิงค์ยอดส่งออกจริง — write the mapped shipped qty (mp_line / export) into every air-request line and
// re-split each affected HAWB (money total unchanged) → every page (ACTUAL, claim, PDF) uses the real qty.
function SyncShippedBox() {
  const [res, setRes] = useState<any | null>(null)
  const [includeDone, setIncludeDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const post = async (preview: boolean) => {
    const r = await fetch("/api/admin/sync-shipped", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview, includeDone }) })
    const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); return d
  }
  const preview = async () => { setBusy(true); setMsg(""); setRes(null); try { setRes(await post(true)) } catch (e: any) { setMsg("ลองดูไม่สำเร็จ: " + e.message) } finally { setBusy(false) } }
  const commit = async () => {
    if (!res?.changed) return
    if (!confirm(`ซิงค์ยอดส่งออกจริง ${res.changed.toLocaleString()} แถว แล้วกระจายเงินใหม่ ${res.hawbs} HAWB (ยอดรวมของแต่ละ HAWB เท่าเดิม)${includeDone ? "\nรวมเอกสารที่จบแล้วด้วย" : ""} ?`)) return
    setBusy(true); setMsg("")
    try { const d = await post(false); setMsg(`✓ ซิงค์แล้ว ${d.written} แถว · กระจายใหม่ ${d.hawbRedistributed} HAWB`); setRes(null) }
    catch (e: any) { setMsg("ซิงค์ไม่สำเร็จ: " + e.message) } finally { setBusy(false) }
  }
  return (
    <div className="bg-white rounded-xl border-2 border-green-200 p-4 space-y-2 mt-6">
      <p className="font-semibold text-sm text-gray-800">★ ซิงค์ยอดส่งออกจริง (ให้ทุกหน้าคำนวณจากยอดส่งออกจริง)</p>
      <p className="text-[11px] text-gray-500">แมพทุกแถวกับ mp_line / export (กฎเดียวกับ dashboard) → เขียนลง <b>QTY ship</b> (QTY AIR ของ MER ไม่แตะ) → กระจายเงินของ HAWB ที่เกี่ยวข้องใหม่ <b>ยอดรวมของ HAWB เท่าเดิม</b> → ACTUAL / ยอดเคลม / PDF ถูกตาม</p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={preview} disabled={busy} className="text-sm px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 font-semibold disabled:opacity-50">{busy && !res ? "กำลังตรวจ…" : "👁 ลองดู"}</button>
        <button onClick={commit} disabled={busy || !res?.changed} className="text-sm px-4 py-1.5 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-40">💾 ซิงค์ ({res?.changed || 0})</button>
        <label className="text-[11px] text-gray-600 flex items-center gap-1"><input type="checkbox" checked={includeDone} onChange={e => { setIncludeDone(e.target.checked); setRes(null) }} /> รวมเอกสารที่จบแล้ว (COMPLETED / Accounting)</label>
      </div>
      {msg && <p className="text-xs text-gray-700">{msg}</p>}
      {res && (
        <div className="border border-gray-200 rounded-lg overflow-auto max-h-80">
          <div className="px-3 py-1.5 text-[11px] text-gray-500 bg-gray-50">
            ตรวจ {n(res.scanned)} แถว · แมพเจอ {n(res.mapped)} · จะเปลี่ยน <b className="text-green-700">{n(res.changed)}</b> แถว · กระจายใหม่ {n(res.hawbs)} HAWB
            {!includeDone && res.doneSkipped > 0 && <span className="text-amber-700"> · ข้ามเอกสารที่จบแล้ว {n(res.doneSkipped)} แถว</span>}
          </div>
          {res.sample?.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-white text-gray-400 sticky top-0"><tr className="text-left">
                <th className="px-3 py-1 font-medium">เอกสาร</th><th className="px-3 py-1 font-medium">SO / SUB</th><th className="px-3 py-1 font-medium text-right">QTY AIR</th>
                <th className="px-3 py-1 font-medium text-right">ship เดิม</th><th className="px-3 py-1 font-medium text-right">ส่งออกจริง</th><th className="px-3 py-1 font-medium">INV</th><th className="px-3 py-1 font-medium">HAWB</th>
              </tr></thead>
              <tbody>{res.sample.map((s: any, i: number) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="px-3 py-1 text-gray-500">{s.doc}</td><td className="px-3 py-1 font-mono">{s.so} / {s.sub || "-"}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(s.qtyAir)}</td><td className="px-3 py-1 text-right tabular-nums text-gray-500">{s.before ?? "-"}</td>
                  <td className="px-3 py-1 text-right tabular-nums font-semibold text-green-700">{n(s.after)}</td>
                  <td className="px-3 py-1 font-mono text-gray-500">{s.inv || "-"}</td><td className="px-3 py-1 font-mono text-gray-500">{s.hawb}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {res.changed > (res.sample?.length || 0) && <p className="px-3 py-1 text-[11px] text-gray-400">แสดง {res.sample.length} จาก {n(res.changed)} แถว</p>}
        </div>
      )}
    </div>
  )
}

// ⑤ ตรวจทุก HAWB — find every HAWB whose LG qty ≠ the real INV qty (mp_line/export) and re-split each
// HAWB's EXISTING actual total by the real qty, all at once. Scan first (nothing written), then apply.
function ScanAllHawbBox() {
  const [res, setRes] = useState<any | null>(null)
  const [pick, setPick] = useState<Set<string>>(new Set())
  const [writeQty, setWriteQty] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const post = async (body: any) => {
    const r = await fetch("/api/admin/fix-hawb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); return d
  }
  const scan = async () => {
    setBusy(true); setMsg(""); setRes(null)
    try { const d = await post({ action: "scan_src" }); setRes(d); setPick(new Set(d.list.map((x: any) => x.hawb))) }
    catch (e: any) { setMsg("ตรวจไม่สำเร็จ: " + e.message) } finally { setBusy(false) }
  }
  const apply = async () => {
    if (!pick.size) return
    if (!confirm(`กระจายใหม่ ${pick.size} HAWB ตามยอดจริงของ INV\n(ยอดเงินรวมของแต่ละ HAWB เท่าเดิม · เปลี่ยนแค่การแบ่งให้แต่ละ SO)${writeQty ? "\nและแก้ QTY ship ให้เท่ายอดจริง" : ""} ?`)) return
    setBusy(true); setMsg("")
    try { const d = await post({ action: "bulk_src", hawbs: [...pick], writeQty }); setMsg(`✓ กระจายใหม่ ${d.done} HAWB · ${d.lines} แถว${d.writeQty ? " · แก้ QTY ship แล้ว" : ""}`); await scan() }
    catch (e: any) { setMsg("บันทึกไม่สำเร็จ: " + e.message) } finally { setBusy(false) }
  }
  const toggle = (h: string) => setPick(p => { const s = new Set(p); s.has(h) ? s.delete(h) : s.add(h); return s })
  const all = res?.list?.length > 0 && res.list.every((x: any) => pick.has(x.hawb))
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 mt-6">
      <p className="font-semibold text-sm text-gray-800">⑤ ตรวจทุก HAWB — กระจายตามยอดจริงของ INV ทีเดียว</p>
      <p className="text-[11px] text-gray-400">หา HAWB ที่ qty ที่ LG กรอก ≠ ยอดจริงของ INV (mp_line / export) · ยอดเงินรวมของแต่ละ HAWB <b>เท่าเดิม</b> เปลี่ยนแค่การแบ่งให้แต่ละ SO</p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={scan} disabled={busy} className="text-sm px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 font-semibold disabled:opacity-50">{busy && !res ? "กำลังตรวจ…" : "🔍 ตรวจทุก HAWB"}</button>
        <button onClick={apply} disabled={busy || !pick.size} className="text-sm px-4 py-1.5 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-40">💾 กระจายใหม่ที่เลือก ({pick.size})</button>
        <label className="text-[11px] text-gray-600 flex items-center gap-1"><input type="checkbox" checked={writeQty} onChange={e => setWriteQty(e.target.checked)} /> แก้ QTY ship ให้เท่ายอดจริงด้วย</label>
      </div>
      {msg && <p className="text-xs text-gray-700">{msg}</p>}
      {res && (
        <div className="border border-gray-200 rounded-lg overflow-auto max-h-96">
          <div className="px-3 py-1.5 text-[11px] text-gray-500 bg-gray-50">ตรวจ {n(res.scanned)} HAWB · ไม่ตรง <b className="text-amber-700">{res.list.length}</b> HAWB</div>
          {res.list.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-white text-gray-400 sticky top-0"><tr className="text-left">
                <th className="px-3 py-1"><input type="checkbox" checked={all} onChange={e => setPick(e.target.checked ? new Set(res.list.map((x: any) => x.hawb)) : new Set())} /></th>
                <th className="px-3 py-1 font-medium">HAWB</th><th className="px-3 py-1 font-medium">เอกสาร</th>
                <th className="px-3 py-1 font-medium text-right">qty LG</th><th className="px-3 py-1 font-medium text-right">qty จริง</th>
                <th className="px-3 py-1 font-medium text-right">SO ไม่ตรง</th><th className="px-3 py-1 font-medium text-right">ยอดเงิน (คงเดิม)</th>
              </tr></thead>
              <tbody>{res.list.map((x: any) => (
                <tr key={x.hawb} className={`border-t border-gray-50 ${pick.has(x.hawb) ? "bg-green-50/50" : ""}`}>
                  <td className="px-3 py-1"><input type="checkbox" checked={pick.has(x.hawb)} onChange={() => toggle(x.hawb)} /></td>
                  <td className="px-3 py-1 font-mono">{x.hawb}</td>
                  <td className="px-3 py-1 text-gray-500">{x.docs.slice(0, 3).join(", ")}{x.docs.length > 3 ? ` +${x.docs.length - 3}` : ""}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(x.lgQty)}</td>
                  <td className="px-3 py-1 text-right tabular-nums font-semibold text-amber-800">{n(x.realQty)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{x.soChanged}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(x.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ⑦ เทียบไฟล์ expense กับที่ LG กรอก — Excel with a HAWB column + an amount column (several lines per HAWB
// are summed). Shows per HAWB: file vs Σ actual in the system. Ticked HAWBs can take the FILE amount
// (split over its SOs by real INV qty, same as ⑤). Nothing is written until "ใช้ยอดจากไฟล์".
const ST: Record<string, { label: string; cls: string }> = {
  DIFF: { label: "ไม่ตรง", cls: "bg-red-50 text-red-700 border-red-200" },
  NO_ACTUAL: { label: "LG ยังไม่กรอก", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  NOT_IN_SYSTEM: { label: "ไม่มีในระบบ", cls: "bg-gray-100 text-gray-600 border-gray-300" },
  MATCH: { label: "ตรง", cls: "bg-green-50 text-green-700 border-green-200" },
}
const HAWB_RE = /HAWB|H\/AWB|HOUSE\s*AWB|HOUSE\s*AIR/i
function ExpenseFileBox() {
  const [wb, setWb] = useState<any | null>(null)
  const [sheetName, setSheetName] = useState("")
  const [sheet, setSheet] = useState<{ name: string; head: string[]; rows: any[][] } | null>(null)
  const [hCol, setHCol] = useState(-1)
  const [aCol, setACol] = useState(-1)
  const [iCol, setICol] = useState(-1)   // optional INV column → attach INVs missing from the HAWB
  const [res, setRes] = useState<any[] | null>(null)
  const [show, setShow] = useState<string>("PROBLEM")
  const [pick, setPick] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const post = async (body: any) => {
    const r = await fetch("/api/admin/fix-hawb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); return d
  }
  // header row = first row (within 30) that has a cell containing "HAWB"
  const readSheet = (book: any, name: string) => {
    const aoa: any[][] = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "" })
    const hr = aoa.slice(0, 30).findIndex(r => r.some(c => HAWB_RE.test(String(c))))
    return { aoa, hr }
  }
  const onFile = async (f: File | undefined) => {
    setRes(null); setMsg(""); setSheet(null); setWb(null); if (!f) return
    const book = XLSX.read(await f.arrayBuffer(), { type: "array" })
    setWb(book)
    // default sheet = the first one that has a HAWB header
    const first = book.SheetNames.find((nm: string) => readSheet(book, nm).hr >= 0) || book.SheetNames[0]
    pickSheet(book, first)
  }
  const pickSheet = (book: any, name: string) => {
    setRes(null); setMsg(""); setSheetName(name)
    const { aoa, hr: h0 } = readSheet(book, name)
    const hr = h0 < 0 ? 0 : h0
    if (h0 < 0) setMsg(`ชีท "${name}" ไม่เจอหัวคอลัมน์ HAWB — เลือกคอลัมน์เอง หรือเปลี่ยนชีท`)
    const head = (aoa[hr] || []).map((c: any) => String(c).trim())
    setSheet({ name, head, rows: aoa.slice(hr + 1) })
    setHCol(head.findIndex(h => HAWB_RE.test(h)))
    const amt = [/TOTAL.*(THB|AMOUNT|EXPENSE|CHARGE)/i, /(EXPENSE|AMOUNT|CHARGE|TOTAL)/i, /THB/i]
    let ac = -1
    for (const re of amt) { ac = head.findIndex(h => re.test(h) && !HAWB_RE.test(h)); if (ac >= 0) break }
    setACol(ac)
    setICol(head.findIndex(h => /INV|INVOICE/i.test(h) && !HAWB_RE.test(h) && !/AMOUNT|TOTAL|THB|DATE/i.test(h)))
  }
  const check = async () => {
    if (!sheet || hCol < 0 || aCol < 0) return
    setBusy(true); setMsg("")
    try {
      const rows = sheet.rows.map(r => ({ hawb: String(r[hCol] ?? "").trim(), amount: r[aCol], inv: iCol >= 0 ? String(r[iCol] ?? "") : "" })).filter(r => r.hawb)
      const d = await post({ action: "check_file", rows })
      setRes(d.list); setPick(new Set(d.list.filter((x: any) => x.status === "DIFF" || x.invMissing?.length).map((x: any) => x.hawb)))
    } catch (e: any) { setMsg("ตรวจไม่สำเร็จ: " + e.message) } finally { setBusy(false) }
  }
  // pickable: money differs / LG not keyed yet / the file has INVs not on the HAWB (also a HAWB not in the system)
  const canPick = (x: any) => x.status === "DIFF" || x.status === "NO_ACTUAL" || x.invMissing?.length > 0
  const picked = (res || []).filter(x => pick.has(x.hawb) && canPick(x))
  const apply = async () => {
    if (!picked.length) return
    const nInv = picked.reduce((a, x) => a + (x.invMissing?.length || 0), 0)
    if (!confirm(`อัปเดต ${picked.length} HAWB จากไฟล์${nInv ? `\n• เพิ่ม INV เข้า HAWB ${nInv} INV (จับ SO+SUB จาก mp_line / export · ใส่ INV + HAWB + qty จริงให้แถวที่ยังว่าง)` : ""}\n• ใส่ยอด expense จากไฟล์ (แบ่งให้แต่ละ SO ตามยอดส่งจริงของ INV · แทนค่า ACTUAL เดิม)\nรวม ${n(picked.reduce((a, x) => a + x.file, 0))} THB ?`)) return
    setBusy(true); setMsg("")
    try {
      // 1) attach the file's INVs that are not on the HAWB yet (same as ③ add INV)
      let added = 0; const notFound: string[] = [], failed: string[] = []
      for (const x of picked) {
        if (!x.invMissing?.length) continue
        try { const d = await post({ action: "add_inv", hawb: x.hawb, inv: x.invMissing.join(" ") }); added += d.added || 0; notFound.push(...(d.notFound || [])) }
        catch (e: any) { failed.push(`${x.hawb}: ${e.message}`) }
      }
      // 2) money: the file amount, split by real INV qty
      const withAmt = picked.filter(x => x.file > 0)
      const totals: Record<string, number> = {}; withAmt.forEach(x => { totals[x.hawb] = x.file })
      const d = withAmt.length ? await post({ action: "bulk_src", hawbs: withAmt.map(x => x.hawb), totals, writeQty: false }) : { done: 0, lines: 0 }
      setMsg([`✓ อัปเดตยอด ${d.done} HAWB · ${d.lines} แถว`, added ? `เพิ่ม INV แล้ว ${added} แถว` : "",
        notFound.length ? `⚠ ไม่พบ INV ใน mp_line / export: ${[...new Set(notFound)].join(", ")}` : "",
        failed.length ? `⚠ ${failed.join(" · ")}` : ""].filter(Boolean).join(" · "))
      await check()
    } catch (e: any) { setMsg("บันทึกไม่สำเร็จ: " + e.message) } finally { setBusy(false) }
  }
  const exportXlsx = () => {
    if (!res) return
    const ws = XLSX.utils.json_to_sheet(res.map(x => ({ HAWB: x.hawb, "ยอดไฟล์": x.file, "ยอด LG (ระบบ)": x.sys, "ต่าง (ระบบ-ไฟล์)": x.diff, "สถานะ": ST[x.status]?.label, "INV ยังไม่อยู่ใน HAWB": (x.invMissing || []).join(", "), "INV ในระบบแต่ไม่อยู่ในไฟล์": (x.invExtra || []).join(", "), "เอกสาร": x.docs.join(", "), "แถว": x.lines })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "HAWB check")
    XLSX.writeFile(wb, `hawb-expense-check-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  const cnt = (s: string) => (res || []).filter(x => x.status === s).length
  const view = (res || []).filter(x => show === "ALL" || (show === "PROBLEM" ? x.status !== "MATCH" : x.status === show))
  const toggle = (h: string) => setPick(p => { const s = new Set(p); s.has(h) ? s.delete(h) : s.add(h); return s })
  const sum = (k: string) => view.filter(x => k !== "sys" || x.status !== "NOT_IN_SYSTEM").reduce((a, x) => a + (Number(x[k]) || 0), 0)
  const tabs: [string, string][] = [["PROBLEM", `ต้องดู (${(res?.length || 0) - cnt("MATCH")})`], ["DIFF", `ไม่ตรง (${cnt("DIFF")})`], ["NO_ACTUAL", `LG ยังไม่กรอก (${cnt("NO_ACTUAL")})`], ["NOT_IN_SYSTEM", `ไม่มีในระบบ (${cnt("NOT_IN_SYSTEM")})`], ["MATCH", `ตรง (${cnt("MATCH")})`], ["ALL", `ทั้งหมด (${res?.length || 0})`]]
  const colSel = (v: number, set: (n: number) => void) => (
    <select value={v} onChange={e => set(Number(e.target.value))} className="border rounded px-1 py-0.5 text-xs">
      <option value={-1}>— เลือก —</option>{sheet!.head.map((h, i) => <option key={i} value={i}>{h || `คอลัมน์ ${i + 1}`}</option>)}
    </select>)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 mt-6">
      <p className="font-semibold text-sm text-gray-800">⑦ อัปเดต HAWB &amp; expense จากไฟล์ (เทียบกับที่ LG กรอก)</p>
      <p className="text-[11px] text-gray-400">อัป Excel ที่มีคอลัมน์ HAWB + ยอดเงิน (HAWB ซ้ำหลายบรรทัด = รวมให้) → เทียบกับผลรวม ACTUAL ที่ LG กรอกในระบบ · ยังไม่มีการเขียนจนกว่าจะกด &quot;ใช้ยอดจากไฟล์&quot;</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e => onFile(e.target.files?.[0])} className="text-xs" />
        {wb && wb.SheetNames.length > 1 && (
          <label className="text-[11px] text-gray-600">ชีท <select value={sheetName} onChange={e => pickSheet(wb, e.target.value)} className="border rounded px-1 py-0.5 text-xs">
            {wb.SheetNames.map((nm: string) => <option key={nm} value={nm}>{nm}{readSheet(wb, nm).hr >= 0 ? " ✓" : ""}</option>)}
          </select></label>
        )}
        {sheet && <>
          <label className="text-[11px] text-gray-600">คอลัมน์ HAWB {colSel(hCol, setHCol)}</label>
          <label className="text-[11px] text-gray-600">คอลัมน์ยอดเงิน {colSel(aCol, setACol)}</label>
          <label className="text-[11px] text-gray-600">คอลัมน์ INV <span className="text-gray-400">(ถ้ามี)</span> {colSel(iCol, setICol)}</label>
          <button onClick={check} disabled={busy || hCol < 0 || aCol < 0} className="text-sm px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 font-semibold disabled:opacity-50">{busy && !res ? "กำลังตรวจ…" : "🔍 เทียบ"}</button>
        </>}
      </div>
      {msg && <p className="text-xs text-gray-700">{msg}</p>}
      {res && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setShow(k)} className={`px-2.5 py-1 rounded-full border ${show === k ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300"}`}>{l}</button>
            ))}
            <span className="flex-1" />
            <button onClick={exportXlsx} className="px-3 py-1 rounded-lg border border-gray-300 text-gray-700">⬇ Excel</button>
            <button onClick={apply} disabled={busy || !picked.length} className="px-3 py-1 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-40">💾 ใช้ยอดจากไฟล์ ({picked.length})</button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-auto max-h-[28rem]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 sticky top-0"><tr className="text-left">
                <th className="px-3 py-1"><input type="checkbox" checked={view.some(canPick) && view.filter(canPick).every(x => pick.has(x.hawb))} onChange={e => setPick(p => { const s = new Set(p); view.filter(canPick).forEach(x => e.target.checked ? s.add(x.hawb) : s.delete(x.hawb)); return s })} /></th>
                <th className="px-3 py-1 font-medium">HAWB</th><th className="px-3 py-1 font-medium">สถานะ</th>
                <th className="px-3 py-1 font-medium text-right">ยอดไฟล์</th><th className="px-3 py-1 font-medium text-right">ยอด LG (ระบบ)</th>
                <th className="px-3 py-1 font-medium text-right">ต่าง (ระบบ − ไฟล์)</th><th className="px-3 py-1 font-medium">INV</th><th className="px-3 py-1 font-medium">เอกสาร</th>
              </tr></thead>
              <tbody>{view.map(x => (
                <tr key={x.hawb} className="border-t border-gray-50">
                  <td className="px-3 py-1">{canPick(x) && <input type="checkbox" checked={pick.has(x.hawb)} onChange={() => toggle(x.hawb)} />}</td>
                  <td className="px-3 py-1 font-mono">{x.hawb}{x.fileLines > 1 && <span className="text-gray-400"> · {x.fileLines} บรรทัด</span>}</td>
                  <td className="px-3 py-1"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${ST[x.status]?.cls}`}>{ST[x.status]?.label}</span></td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(x.file)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{x.status === "NOT_IN_SYSTEM" ? "-" : n(x.sys)}</td>
                  <td className={`px-3 py-1 text-right tabular-nums font-semibold ${x.status === "DIFF" ? (x.diff > 0 ? "text-red-700" : "text-blue-700") : "text-gray-400"}`}>{x.status === "NOT_IN_SYSTEM" ? "-" : (x.diff > 0 ? "+" : "") + n(x.diff)}</td>
                  <td className="px-3 py-1 text-[10px]">
                    {x.invMissing?.length > 0 && <div className="text-orange-700" title="INV ในไฟล์ที่ยังไม่อยู่ใน HAWB นี้ — กดอัปเดตจะเพิ่มให้">+ ขาด {x.invMissing.join(", ")}</div>}
                    {x.invExtra?.length > 0 && <div className="text-gray-400" title="INV ที่อยู่ใน HAWB ในระบบ แต่ไม่อยู่ในไฟล์ (ไม่ถูกลบ — ตรวจเอง)">ในระบบเกิน {x.invExtra.join(", ")}</div>}
                  </td>
                  <td className="px-3 py-1 text-gray-500">{x.docs.slice(0, 3).join(", ")}{x.docs.length > 3 ? ` +${x.docs.length - 3}` : ""}</td>
                </tr>
              ))}</tbody>
              <tfoot className="bg-gray-50 font-semibold"><tr>
                <td></td><td className="px-3 py-1">รวม {view.length} HAWB</td><td></td>
                <td className="px-3 py-1 text-right tabular-nums">{n(sum("file"))}</td>
                <td className="px-3 py-1 text-right tabular-nums">{n(sum("sys"))}</td>
                <td></td><td></td><td></td>
              </tr></tfoot>
            </table>
          </div>
        </>
      )}
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
