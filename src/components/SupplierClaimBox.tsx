"use client"
import { useState } from "react"

// Document page box: supplier claims Procurement made for this document (claim doc no. + amount + files).
// Visible when the document has a PROCUREMENT claim split or already has a record; editable by
// CLAIM_PROCUREMENT / VP_PROCUREMENT / ADMIN.
const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function SupplierClaimBox({ req, myRoles, onChanged }: { req: any; myRoles: string[]; onChanged: () => void }) {
  const claims: any[] = req?.supplierClaims || []
  const hasProc = (req?.items || []).some((i: any) => (Array.isArray(i.claimDepts) ? i.claimDepts : []).some((s: any) => s?.dept === "PROCUREMENT") || i.claimDepartment === "PROCUREMENT")
  const canEdit = myRoles.some(r => ["CLAIM_PROCUREMENT", "VP_PROCUREMENT", "ADMIN"].includes(r))
  const [open, setOpen] = useState(false)
  const [refNo, setRefNo] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  if (!hasProc && !claims.length) return null

  const filesOf = (cid: string) => (req?.attachments || []).filter((a: any) => a.category === `SUPPLIER_CLAIM:${cid}`)
  const total = claims.reduce((s, c) => s + (Number(c.amount) || 0), 0)

  const save = async () => {
    setErr("")
    if (!refNo.trim()) { setErr("ใส่เลขเอกสารเคลม supplier"); return }
    if (!(Number(amount.replace(/,/g, "")) > 0)) { setErr("ใส่ยอดที่เคลม supplier"); return }
    setBusy(true)
    try {
      const r = await fetch(`/api/requests/${req.id}/supplier-claims`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refNo, amount, note }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status)
      for (const f of files) {
        const form = new FormData(); form.append("file", f); form.append("category", `SUPPLIER_CLAIM:${d.id}`); form.append("claimDept", "PROCUREMENT")
        const up = await fetch(`/api/requests/${req.id}/attachments`, { method: "POST", body: form })
        if (!up.ok) throw new Error(`บันทึกแล้ว แต่แนบไฟล์ ${f.name} ไม่สำเร็จ`)
      }
      setRefNo(""); setAmount(""); setNote(""); setFiles([]); setOpen(false); onChanged()
    } catch (e: any) { setErr(e.message || "บันทึกไม่สำเร็จ") } finally { setBusy(false) }
  }
  const remove = async (c: any) => {
    if (!window.confirm(`ลบรายการเคลม supplier ${c.refNo} (และไฟล์แนบ)?`)) return
    const r = await fetch(`/api/requests/${req.id}/supplier-claims?claimId=${c.id}`, { method: "DELETE" })
    if (r.ok) onChanged(); else { const d = await r.json().catch(() => ({})); alert(d.error || "ลบไม่สำเร็จ") }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-semibold text-gray-800">🧾 เคลม Supplier (Procurement)</h2>
        {claims.length > 0
          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">✓ เคลมแล้ว {claims.length} รายการ · {fmt(total)} THB</span>
          : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">ยังไม่มีการเคลม supplier</span>}
        {canEdit && !open && <button onClick={() => setOpen(true)} className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700">+ บันทึกการเคลม supplier</button>}
      </div>

      {claims.length > 0 && (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500"><tr className="text-left">
              <th className="px-3 py-1.5 font-medium">เลขเอกสารเคลม</th><th className="px-3 py-1.5 font-medium text-right">ยอดเคลม supplier (THB)</th>
              <th className="px-3 py-1.5 font-medium">หมายเหตุ</th><th className="px-3 py-1.5 font-medium">ไฟล์</th><th className="px-3 py-1.5 font-medium">บันทึกโดย</th><th></th>
            </tr></thead>
            <tbody>{claims.map(c => (
              <tr key={c.id} className="border-t border-gray-50">
                <td className="px-3 py-1.5 font-mono font-semibold">{c.refNo}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fmt(c.amount)}</td>
                <td className="px-3 py-1.5 text-gray-600">{c.note || "-"}</td>
                <td className="px-3 py-1.5">{filesOf(c.id).length ? filesOf(c.id).map((a: any) => (
                  <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="block text-blue-600 hover:underline truncate max-w-[220px]">📎 {a.fileName}</a>)) : <span className="text-gray-400">-</span>}</td>
                <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{c.createdBy?.name || c.createdBy?.email || "-"} · {new Date(c.createdAt).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-1.5 text-right">{canEdit && <button onClick={() => remove(c)} className="text-red-400 hover:text-red-600">ลบ</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="border border-green-200 bg-green-50/40 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs text-gray-600">เลขเอกสารเคลม supplier *
              <input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="เช่น DN-ABC-2026-0915" className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white" /></label>
            <label className="text-xs text-gray-600">ยอดที่เคลม supplier ได้ (THB) *
              <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white text-right" /></label>
            <label className="text-xs text-gray-600">หมายเหตุ (ชื่อ supplier / SO)
              <input value={note} onChange={e => setNote(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white" /></label>
          </div>
          <label className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 cursor-pointer hover:bg-gray-50">
            📎 แนบไฟล์ (เลือกได้หลายไฟล์)
            <input type="file" multiple className="hidden" onChange={e => setFiles([...files, ...Array.from(e.target.files || [])])} />
          </label>
          {files.length > 0 && <div className="text-xs text-gray-600 flex flex-wrap gap-2">{files.map((f, i) => (
            <span key={i} className="px-2 py-0.5 bg-white border border-gray-200 rounded">{f.name} <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-red-400 ml-1">✕</button></span>))}</div>}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setOpen(false); setErr("") }} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600">ยกเลิก</button>
            <button onClick={save} disabled={busy} className="text-xs px-4 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50">{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
          </div>
        </div>
      )}
    </div>
  )
}
