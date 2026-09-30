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
    </div>
  )
}
