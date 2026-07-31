"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"

const NYK_ROLES = ["SCM_NYK_APPROVER", "SCM_NYK", "SCM_NYK_EVP"]
const numOf = (v: any) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isNaN(n) ? 0 : n }
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })
const colLike = (row: any, ...subs: string[]) => {
  const k = Object.keys(row).find(k => { const lk = k.toLowerCase(); return subs.every(s => lk.includes(s.toLowerCase())) })
  return k ? row[k] : ""
}
const get = (row: any, key: string) => { const k = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase()); return k ? row[k] : "" }

export default function NykImportPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const roles: string[] = [role, ...(((session?.user as any)?.roles) || [])]
  const allowed = role === "ADMIN" || roles.some(r => NYK_ROLES.includes(r))

  const [rows, setRows] = useState<any[]>([])
  const [fileName, setFileName] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // Preview: compute actual per SO from Total HAWB# (same formula as the server).
  const hawbAgg: Record<string, { sumQty: number; total: number }> = {}
  for (const r of rows) {
    const h = String(get(r, "HAWB#") || "").trim(); if (!h) continue
    const q = numOf(get(r, "QTY Request ship Air (pcs)") || get(r, "QTY AIR"))
    const t = numOf(colLike(r, "total", "hawb"))
    if (!hawbAgg[h]) hawbAgg[h] = { sumQty: 0, total: 0 }
    hawbAgg[h].sumQty += q
    if (t > 0) hawbAgg[h].total = t
  }
  const actualOf = (r: any) => {
    const h = String(get(r, "HAWB#") || "").trim(); const g = h ? hawbAgg[h] : null
    if (!g || g.sumQty <= 0 || g.total <= 0) return 0
    return Math.round(numOf(get(r, "QTY Request ship Air (pcs)") || get(r, "QTY AIR")) * (g.total / g.sumQty) * 100) / 100
  }
  const totalActual = rows.reduce((s, r) => s + actualOf(r), 0)
  const missingActual = rows.filter(r => String(get(r, "HAWB#") || "").trim() && actualOf(r) <= 0).length

  const readFile = async (file: File) => {
    setError("")
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
      const valid = parsed.filter(r => String(get(r, "SO") || "").trim())
      if (valid.length === 0) { setError("ไม่พบข้อมูล — ต้องมีคอลัมน์ SO และข้อมูลตามเทมเพลต GW"); return }
      setRows(valid); setFileName(file.name)
    } catch (e: any) { setError(`อ่านไฟล์ไม่สำเร็จ: ${e?.message || e}`) }
  }

  const submit = async () => {
    if (rows.length === 0) return
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/requests/nyk-direct", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Create failed"); setBusy(false); return }
      const { id } = await res.json()
      // Upload each attachment to the new document.
      for (const f of attachments) {
        const form = new FormData(); form.append("file", f); form.append("category", "NYK_IMPORT")
        await fetch(`/api/requests/${id}/attachments`, { method: "POST", body: form }).catch(() => {})
      }
      router.push(`/requests/${id}`)
    } catch (e: any) { setError(e?.message || "Error"); setBusy(false) }
  }

  if (!allowed) return <div className="text-center py-20 text-gray-400">เฉพาะ Admin หรือ SCM NYK เท่านั้น</div>

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NYK DIRECT IMPORT <span className="text-sm font-medium text-orange-600 align-middle">GW</span></h1>
        <p className="text-xs text-gray-400 mt-0.5">นำเข้าไฟล์ที่มีข้อมูลครบ (INV / HAWB / Total HAWB / NYK 100%) → ข้ามทุกขั้น ส่งตรงให้ SCM NYK อนุมัติ · actual คำนวณจาก Total HAWB ให้อัตโนมัติ</p>
      </div>

      {/* Step 1 — data file */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500">① ไฟล์ข้อมูล (Excel — เทมเพลต GW)</p>
        <label className="inline-flex items-center gap-2 border border-blue-300 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 cursor-pointer">
          ⬆ เลือกไฟล์
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = "" }} />
        </label>
        {fileName && <span className="ml-3 text-sm text-gray-600">{fileName} · <b>{rows.length}</b> SO · <b>{Object.keys(hawbAgg).length}</b> HAWB</span>}
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-gray-600">พรีวิว actual (คำนวณจาก Total HAWB)</span>
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">รวม Actual {fmt(totalActual)} THB</span>
            <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-medium">Claim NYK 100%</span>
            {missingActual > 0 && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">⚠ {missingActual} SO ไม่มี Total HAWB → actual = 0</span>}
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-50 border-b sticky top-0"><tr>
                {["SO", "STYLE", "SUB", "QTY AIR", "INV NO.", "HAWB#", "Total HAWB#", "ACTUAL (คำนวณ)", "CLAIM"].map(h =>
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium">{get(r, "SO")}</td>
                    <td className="px-3 py-1.5">{get(r, "STYLE")}</td>
                    <td className="px-3 py-1.5">{get(r, "SUB") || "-"}</td>
                    <td className="px-3 py-1.5">{fmt(numOf(get(r, "QTY Request ship Air (pcs)") || get(r, "QTY AIR")))}</td>
                    <td className="px-3 py-1.5">{get(r, "INV NO.") || "-"}</td>
                    <td className="px-3 py-1.5">{get(r, "HAWB#") || "-"}</td>
                    <td className="px-3 py-1.5 text-gray-500">{numOf(colLike(r, "total", "hawb")) > 0 ? fmt(numOf(colLike(r, "total", "hawb"))) : "-"}</td>
                    <td className="px-3 py-1.5 font-semibold text-green-700">{fmt(actualOf(r))}</td>
                    <td className="px-3 py-1.5 text-amber-800">NYK 100%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 2 — attachments */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500">② แนบเอกสาร (หลายไฟล์ได้ — INV / AWB / Expense ฯลฯ)</p>
        <label className="inline-flex items-center gap-2 border border-gray-300 bg-white text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
          📎 เพิ่มไฟล์แนบ
          <input type="file" multiple className="hidden" onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setAttachments(p => [...p, ...fs]); e.target.value = "" }} />
        </label>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                {f.name}
                <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 leading-none">✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy || rows.length === 0}
          className="bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-40">
          {busy ? "กำลังสร้าง..." : `สร้าง & ส่งให้ SCM NYK (${rows.length} SO)`}
        </button>
        <span className="text-xs text-gray-400">หลังสร้าง → เอกสารจะไปอยู่ที่ SCM NYK ทันที (ข้าม MER/DPM/GM/President/LG)</span>
      </div>
    </div>
  )
}
