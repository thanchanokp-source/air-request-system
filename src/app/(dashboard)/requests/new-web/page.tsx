"use client"
import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"
import { validateUploadRows } from "@/lib/upload-validate"

// Web entry (ADMIN test): MER types SO → picks SUB → the rest auto-fills from mp_line (fallback
// SO_ORDER) and stays editable. Submits the SAME row shape as the Excel upload → same API, same
// EST calc / duplicate guard / emails. The rows are also attached as an .xlsx (like an upload).

type SubInfo = {
  sub: string; src: string; brand: string; bu: string; country: string; style: string; po: string
  description: string; origDate: string; planDate: string; qtyAir: number | null; soQty: number | null
  mpRows: { inv: string; status: string; shipMode: string; pcs: number; hod: string }[]
  shipped: boolean; existing: { docNo: string; qtyAir: number; status: string }[]
}
type Fields = {
  qtyOrig: string; qtyAir: string; factory: string; brand: string; bu: string; style: string
  po: string; description: string; origDate: string; planDate: string; country: string
}
type FKey = keyof Fields
type Row = { key: number; so: string; sub: string; f: Fields; ed: Partial<Record<FKey, true>>; st: "idle" | "loading" | "ok" | "notfound" | "nosub" }

// table column order (also the order a multi-column Excel paste fills in)
const COLS: { k: "so" | "sub" | FKey; label: string; w: string; mer?: boolean }[] = [
  { k: "so", label: "SO", w: "w-24" },
  { k: "sub", label: "SUB", w: "w-20" },
  { k: "qtyOrig", label: "QTY Original", w: "w-20", mer: true },
  { k: "qtyAir", label: "QTY Air", w: "w-20" },
  { k: "factory", label: "Factory", w: "w-16", mer: true },
  { k: "brand", label: "Brand name", w: "w-40" },
  { k: "bu", label: "BU", w: "w-14" },
  { k: "style", label: "STYLE", w: "w-36" },
  { k: "po", label: "CUSTOMER PO", w: "w-24" },
  { k: "description", label: "DESCRIPTION", w: "w-32" },
  { k: "origDate", label: "Orig. Ship Date", w: "w-24" },
  { k: "planDate", label: "Plan Ship Date", w: "w-24" },
  { k: "country", label: "Country", w: "w-28" },
]
const FILL_ALL: FKey[] = ["factory", "bu", "country", "brand", "origDate", "planDate"]
const BU_OPTS = ["NYG", "EA", "TRM", "GW"]
const FACTORY_OPTS = ["G1", "G2", "G3", "G4", "TRM", "EA", "GW"]
// fields shown as a dropdown (table cell + "ใส่ทุกแถว")
const SELECT_OPTS: Partial<Record<FKey, string[]>> = { bu: BU_OPTS, factory: FACTORY_OPTS }
const normBu = (s: string) => { const u = String(s || "").trim().toUpperCase(); return BU_OPTS.find(b => b === u) || u }

const so8 = (s: any) => { const d = String(s ?? "").replace(/\D/g, "").replace(/^0+/, ""); return d ? d.padStart(8, "0") : "" }
const emptyF = (): Fields => ({ qtyOrig: "", qtyAir: "", factory: "", brand: "", bu: "", style: "", po: "", description: "", origDate: "", planDate: "", country: "" })
let seq = 1
const newRow = (): Row => ({ key: seq++, so: "", sub: "", f: emptyF(), ed: {}, st: "idle" })

// auto-fill from lookup, never overwriting a field the user typed/pasted (qtyOrig + factory are MER-only)
const fromInfo = (info: SubInfo, r: Row, defBu: string): Fields => {
  const auto: Partial<Fields> = {
    brand: info.brand, bu: normBu(info.bu) || defBu, style: info.style, po: info.po, description: info.description,
    origDate: info.origDate, planDate: info.planDate, country: info.country,
    qtyAir: info.qtyAir != null ? String(info.qtyAir) : "",
  }
  const f = { ...r.f }
  for (const k of Object.keys(auto) as FKey[]) if (!r.ed[k]) f[k] = String(auto[k] ?? "")
  return f
}
const resolveRow = (r: Row, subs: SubInfo[] | undefined, defBu: string): Row => {
  if (!so8(r.so)) return { ...r, st: "idle" }
  if (!subs) return r
  if (!subs.length) return { ...r, st: "notfound" }
  let sub = r.sub.trim().toUpperCase()
  if (!sub && subs.length === 1) sub = subs[0].sub
  const info = subs.find(s => s.sub === sub)
  if (!info) return { ...r, sub, st: "nosub" }
  return { ...r, sub, st: "ok", f: fromInfo(info, r, defBu) }
}

export default function NewWebRequestPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const isAdmin = role === "ADMIN"   // admin-only while testing
  const router = useRouter()

  const [docBu, setDocBu] = useState<"NYG" | "EA" | "TRM">("NYG")
  const [testMode, setTestMode] = useState(true)
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow(), newRow()])
  const [cache, setCache] = useState<Record<string, SubInfo[]>>({})
  const cacheRef = useRef<Record<string, SubInfo[]>>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [fillKey, setFillKey] = useState<FKey>("factory")
  const [fillVal, setFillVal] = useState("")

  // first approver (same as the Excel page)
  const [approvers, setApprovers] = useState<any[]>([])
  const [approver, setApprover] = useState("")
  useEffect(() => {
    const r = docBu === "EA" ? "DVM_MER_EA" : docBu === "TRM" ? "DVM_MER_TRM" : "DVM_MER"
    fetch(`/api/users/by-role?role=${r}`).then(x => x.json()).then(d => {
      const list = Array.isArray(d) ? d : []
      setApprovers(list); setApprover(list.length === 1 ? list[0].email : "")
    }).catch(() => setApprovers([]))
  }, [docBu])

  // look up the SOs of the given rows (only SOs not cached yet), then resolve those rows
  const runLookup = async (list: Row[]) => {
    const keys = new Set(list.map(r => r.key))
    const need = [...new Set(list.map(r => so8(r.so)).filter(s => s && !(s in cacheRef.current)))]
    if (need.length) {
      setRows(rs => rs.map(r => keys.has(r.key) && need.includes(so8(r.so)) ? { ...r, st: "loading" } : r))
      try {
        const res = await fetch("/api/so-lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sos: need }) })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || res.status)
        const next = { ...cacheRef.current }
        for (const s of need) next[s] = d.bySo?.[s] || []
        cacheRef.current = next; setCache(next)
      } catch (e: any) { setError("ค้น SO ไม่สำเร็จ: " + (e?.message || "error")) }
    }
    setRows(rs => rs.map(r => keys.has(r.key) ? resolveRow(r, cacheRef.current[so8(r.so)], docBu) : r))
  }

  const setField = (key: number, k: "so" | "sub" | FKey, v: string) => setRows(rs => rs.map(r => {
    if (r.key !== key) return r
    if (k === "so") return { ...r, so: v, sub: "", ed: { qtyOrig: r.ed.qtyOrig, factory: r.ed.factory }, st: "idle" }
    if (k === "sub") return { ...r, sub: v }
    return { ...r, f: { ...r.f, [k]: v }, ed: { ...r.ed, [k]: true } }
  }))
  const pickSub = (key: number, sub: string) => setRows(rs => rs.map(r => r.key === key ? resolveRow({ ...r, sub }, cacheRef.current[so8(r.so)], docBu) : r))

  // Excel paste: many lines and/or columns → fill down / across starting at this cell
  const onPaste = (e: React.ClipboardEvent, idx: number, col: "so" | "sub" | FKey) => {
    const t = e.clipboardData.getData("text")
    if (!/[\t\n]/.test(t)) return
    e.preventDefault()
    const lines = t.replace(/\r/g, "").split("\n")
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()
    const grid = lines.map(l => l.split("\t"))
    const c0 = COLS.findIndex(c => c.k === col)
    setRows(rs => {
      const out = [...rs]
      while (out.length < idx + grid.length) out.push(newRow())
      const touched: Row[] = []
      grid.forEach((cells, j) => {
        let r = { ...out[idx + j], f: { ...out[idx + j].f }, ed: { ...out[idx + j].ed } }
        cells.forEach((raw, c) => {
          const k = COLS[c0 + c]?.k; const v = raw.trim()
          if (!k) return
          if (k === "so") { r = { ...r, so: v, sub: "", ed: { qtyOrig: r.ed.qtyOrig, factory: r.ed.factory }, st: "idle" } }
          else if (k === "sub") r.sub = v.toUpperCase()
          else { r.f[k] = SELECT_OPTS[k] ? v.toUpperCase() : v; r.ed[k] = true }
        })
        out[idx + j] = r
        if (cells.some((_, c) => ["so", "sub"].includes(String(COLS[c0 + c]?.k)))) touched.push(r)
      })
      if (touched.length) setTimeout(() => runLookup(touched), 0)
      return out
    })
  }

  const fillAll = () => setRows(rs => rs.map(r => so8(r.so) ? { ...r, f: { ...r.f, [fillKey]: fillVal }, ed: { ...r.ed, [fillKey]: true } } : r))

  const used = rows.filter(r => so8(r.so))
  const dupKeys = useMemo(() => {
    const c = new Map<string, number>()
    for (const r of used) if (r.sub) { const k = `${so8(r.so)}|${r.sub}`; c.set(k, (c.get(k) || 0) + 1) }
    return new Set([...c].filter(([, n]) => n > 1).map(([k]) => k))
  }, [used])
  const infoOf = (r: Row) => cache[so8(r.so)]?.find(s => s.sub === r.sub)

  const submit = async () => {
    setError("")
    if (!used.length) { setError("ยังไม่มีรายการ — ใส่ SO อย่างน้อย 1 แถว"); return }
    const bad = used.filter(r => r.st !== "ok")
    if (bad.length) { setError(`มี ${bad.length} แถวที่ยังไม่พร้อม (ไม่พบ SO / ยังไม่เลือก SUB / กำลังค้น) — แก้ก่อนส่ง`); return }
    if (dupKeys.size) { setError(`SO+SUB ซ้ำในหน้านี้: ${[...dupKeys].map(k => k.replace("|", "/")).join(", ")}`); return }
    if (!approver) { setError("กรุณาเลือกผู้อนุมัติคนแรก"); return }
    const items = used.map((r, i) => ({
      "No": i + 1, "Brand name": r.f.brand, "BU": r.f.bu, "STYLE": r.f.style, "SO": so8(r.so), "SUB": r.sub,
      "CUSTOMER PO": r.f.po, "DESCRIPTION": r.f.description,
      "Original Shipment Date": r.f.origDate, "Plan Shipment Date": r.f.planDate,
      "QTY Original Shipment (pcs)": r.f.qtyOrig, "QTY Request ship Air (pcs)": r.f.qtyAir,
      "Factory": r.f.factory, "Country": r.f.country,
    }))
    const { error: verr } = validateUploadRows(items, false)
    if (verr) { setError(verr); return }
    const warn = used.flatMap(r => {
      const info = infoOf(r); const k = `${so8(r.so)}/${r.sub}`; const w: string[] = []
      if (info?.existing.length) w.push(`${k}: เคยขอแล้วใน ${info.existing.map(e => `${e.docNo} (air ${e.qtyAir})`).join(", ")}`)
      if (info?.shipped) w.push(`${k}: mp_line สถานะ SHIPPED แล้ว`)
      return w
    })
    if (warn.length && !confirm(`⚠ พบรายการที่อาจซ้ำ / ส่งออกไปแล้ว ${warn.length} รายการ:\n\n${warn.slice(0, 12).join("\n")}${warn.length > 12 ? "\n…" : ""}\n\nยืนยันส่งต่อ?`)) return
    setLoading(true)
    try {
      const res = await fetch("/api/requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, assignedDvm: approver, assignedVpMer: null, bu: docBu, isTest: testMode }),
      })
      const data = await res.json()
      if (!data.id) { setError(data.error || "Something went wrong"); return }
      if (data.skippedDup?.length > 0) alert(`ℹ ตัดแถวที่ซ้ำกับเอกสารที่มีอยู่แล้วออก ${data.skippedDup.length} แถว (ไม่ได้บันทึก):\n\n${data.skippedDup.slice(0, 15).join("\n")}${data.skippedDup.length > 15 ? "\n…" : ""}`)
      // attach the entered rows as an .xlsx — same as an Excel upload leaves its file on the doc
      const ws = XLSX.utils.json_to_sheet(items); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Air Request")
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" })
      const form = new FormData()
      form.append("file", new File([buf], `WEB_ENTRY_${new Date().toISOString().slice(0, 10)}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      await fetch(`/api/requests/${data.id}/attachments`, { method: "POST", body: form }).catch(() => {})
      router.push(`/requests/${data.id}`)
    } finally { setLoading(false) }
  }

  if (session && !isAdmin) return <div className="p-6 text-sm text-gray-500">หน้านี้เปิดให้ admin ทดลองเท่านั้น</div>

  const inp = "border border-gray-200 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
  return (
    <div className="space-y-4">
      {loading && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30"><div className="bg-white rounded-xl px-8 py-6 text-sm font-semibold">Submitting…</div></div>}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">New Air Request · กรอกในเว็บ</h1>
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">ADMIN ทดลอง</span>
        <a href="/requests/new" className="ml-auto text-xs text-blue-600 hover:underline">← อัปโหลด Excel แบบเดิม</a>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
          <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)} className="w-4 h-4" /> 🧪 Test (อีเมลส่งหา admin)
        </label>
        <label className="text-sm text-gray-600">BU เอกสาร
          <select value={docBu} onChange={e => setDocBu(e.target.value as any)} className="ml-2 border border-gray-300 rounded-lg px-2 py-1 text-sm">
            <option value="NYG">NYG</option><option value="EA">EA</option><option value="TRM">TRM</option>
          </select>
        </label>
        <label className="text-sm text-gray-600 flex items-center gap-2">ผู้อนุมัติคนแรก <span className="text-red-500">*</span>
          <select value={approver} onChange={e => setApprover(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm min-w-[220px]">
            <option value="">-- เลือก --</option>
            {approvers.map((u: any) => <option key={u.email} value={u.email}>{u.name}</option>)}
          </select>
        </label>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1">
        <p><b>วิธีใช้:</b> พิมพ์ SO แล้วกด Tab → เลือก SUB → ข้อมูลที่เหลือดึงให้เอง (mp_line ก่อน ถ้าไม่มีใช้ SO_ORDER) <b>แก้ไขได้ทุกช่อง</b></p>
        <p><b>วางจาก Excel:</b> คลิกช่อง SO แถวแรก แล้ว Ctrl+V — วางได้หลายแถว/หลายคอลัมน์ เรียงตามคอลัมน์ในตาราง (SO · SUB · QTY Original · QTY Air · Factory …) แถวเพิ่มให้อัตโนมัติ</p>
        <p>ช่อง <span className="bg-amber-100 px-1 rounded">สีเหลือง</span> = MER กรอกเอง · 1 แถว = 1 SUB เท่านั้น</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-gray-600">ใส่ทุกแถว:</span>
        <select value={fillKey} onChange={e => { setFillKey(e.target.value as FKey); setFillVal("") }} className="border border-gray-300 rounded px-2 py-1">
          {FILL_ALL.map(k => <option key={k} value={k}>{COLS.find(c => c.k === k)?.label}</option>)}
        </select>
        {SELECT_OPTS[fillKey] ? (
          <select value={fillVal} onChange={e => setFillVal(e.target.value)} className="border border-gray-300 rounded px-2 py-1 w-40">
            <option value="">-- เลือก --</option>
            {SELECT_OPTS[fillKey]!.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input value={fillVal} onChange={e => setFillVal(e.target.value)} placeholder="ค่า" className="border border-gray-300 rounded px-2 py-1 w-40" />
        )}
        <button type="button" onClick={fillAll} className="px-3 py-1 rounded bg-gray-800 text-white font-semibold">ใส่ทุกแถว ({used.length})</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="text-xs min-w-max">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-2 py-2 text-left">#</th>
              {COLS.map(c => <th key={c.k} className={`px-1.5 py-2 text-left whitespace-nowrap ${c.mer ? "bg-amber-50" : ""}`}>{c.label}{c.mer && <span className="text-red-500">*</span>}</th>)}
              <th className="px-2 py-2 text-left">ตรวจสอบ</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, idx) => {
              const subs = cache[so8(r.so)]
              const info = infoOf(r)
              const dup = r.sub && dupKeys.has(`${so8(r.so)}|${r.sub}`)
              return (
                <tr key={r.key} className={r.st === "notfound" || r.st === "nosub" || dup ? "bg-red-50/60" : ""}>
                  <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                  {COLS.map(c => (
                    <td key={c.k} className={`px-1 py-1 ${c.w} ${c.mer ? "bg-amber-50/60" : ""}`}>
                      {c.k === "sub" && subs?.length ? (
                        <select value={r.sub} onChange={e => pickSub(r.key, e.target.value)} onPaste={e => onPaste(e, idx, "sub")} className={inp}>
                          <option value="">--</option>
                          {subs.map(s => <option key={s.sub} value={s.sub}>{s.sub}</option>)}
                          {r.sub && !subs.some(s => s.sub === r.sub) && <option value={r.sub}>{r.sub} (ไม่พบ)</option>}
                        </select>
                      ) : SELECT_OPTS[c.k as FKey] ? (() => {
                        const k = c.k as FKey; const opts = SELECT_OPTS[k]!; const v = r.f[k]
                        return (
                          <select value={v} onChange={e => setField(r.key, k, e.target.value)} className={inp}>
                            <option value="">--</option>
                            {opts.map(o => <option key={o} value={o}>{o}</option>)}
                            {v && !opts.includes(v) && <option value={v}>{v} (?)</option>}
                          </select>
                        )
                      })() : (
                        <input value={c.k === "so" ? r.so : c.k === "sub" ? r.sub : r.f[c.k as FKey]}
                          onChange={e => setField(r.key, c.k, e.target.value)}
                          onBlur={c.k === "so" || c.k === "sub" ? () => runLookup([rows[idx]]) : undefined}
                          onPaste={e => onPaste(e, idx, c.k)}
                          placeholder={c.k === "qtyOrig" && info?.soQty ? `SO qty ${info.soQty}` : c.k.endsWith("Date") ? "YYYY-MM-DD" : ""}
                          className={`${inp} ${c.k === "so" ? "font-mono" : ""} ${r.ed[c.k as FKey] && c.k !== "qtyOrig" && c.k !== "factory" ? "text-blue-700" : ""}`} />
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 whitespace-nowrap space-x-1">
                    {r.st === "loading" && <span className="text-gray-400">⏳ ค้น…</span>}
                    {r.st === "notfound" && <span className="text-red-600 font-semibold">ไม่พบ SO ใน mp_line / SO_ORDER</span>}
                    {r.st === "nosub" && <span className="text-red-600 font-semibold">เลือก SUB</span>}
                    {dup && <span className="text-red-600 font-semibold">ซ้ำในหน้านี้</span>}
                    {info?.existing.length ? <span className="text-amber-700 bg-amber-100 rounded px-1" title={info.existing.map(e => `${e.docNo} · air ${e.qtyAir} · ${e.status}`).join("\n")}>เคยขอแล้ว {info.existing.length} doc</span> : null}
                    {info?.shipped && <span className="text-amber-700 bg-amber-100 rounded px-1">SHIPPED แล้ว</span>}
                    {info?.src === "so_order" && <span className="text-gray-500">จาก SO_ORDER</span>}
                    {info && info.mpRows.length > 1 && <span className="text-gray-500" title={info.mpRows.map(m => `${m.inv || "-"} · ${m.shipMode} · ${m.status} · ${m.pcs} pcs · ${m.hod}`).join("\n")}>mp_line {info.mpRows.length} รอบ (รวม)</span>}
                    {r.st === "ok" && !info?.existing.length && !info?.shipped && !dup && <span className="text-green-600">✓</span>}
                  </td>
                  <td className="px-1"><button type="button" onClick={() => setRows(rs => rs.length > 1 ? rs.filter(x => x.key !== r.key) : [newRow()])} className="text-gray-300 hover:text-red-500">✕</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setRows(rs => [...rs, newRow()])} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white">+ เพิ่มแถว</button>
        <button type="button" onClick={() => setRows(rs => [...rs, ...Array.from({ length: 10 }, newRow)])} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white">+10 แถว</button>
        <span className="text-xs text-gray-400">{used.length} รายการ</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-64 overflow-y-auto"><p className="text-red-600 text-xs whitespace-pre-line">{error}</p></div>}

      <div className="flex gap-3">
        <button type="button" onClick={submit} disabled={loading || !used.length} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Submit Request ({used.length})
        </button>
        <button type="button" onClick={() => router.back()} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium">Cancel</button>
      </div>
    </div>
  )
}
