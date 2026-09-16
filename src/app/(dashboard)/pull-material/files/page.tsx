"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, buColor } from "../_StageWork"

const CAT_LABEL: Record<string, string> = { INV: "INV", PACKING: "Packing", AWB: "AWB", CUSTOMS: "ใบขน", COMBINED: "รวม" }
const PC_CATS: [string, string][] = [["INV", "PC"], ["PACKING", "PC"], ["COMBINED", "PC"]]
const LG_CATS: [string, string][] = [["AWB", "LG"], ["CUSTOMS", "LG"], ["COMBINED", "LG"]]

// Central attachment library for Pull RM — attach INV / Packing (PC) and AWB / ใบขน (LG) to any doc,
// before OR after approval. PC uploads only to its OWN docs; LG to any; admin to all.
export default function Page() {
  const { data: session } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN")
  const isPc = roles.includes("PURCHASING")
  const isLg = roles.includes("LOGISTICS_IMPORT")
  const canUse = isAdmin || isPc || isLg || roles.includes("SCM_PULL")
  const userId = (session?.user as any)?.id

  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING">("ALL")
  const [reqF, setReqF] = useState("")

  const load = async () => {
    setLoading(true)
    try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [bu, canUse]) // eslint-disable-line

  const uploadFile = async (rq: any, category: string, source: string, files: FileList | null) => {
    if (!files || !files.length) return
    setBusy(rq.id + category)
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append("file", f); fd.append("category", category); fd.append("source", source)
        await fetch(`/api/pull-material/${rq.id}/attachments`, { method: "POST", body: fd }).catch(() => {})
      }
      await load()
    } finally { setBusy(null) }
  }
  const filesOf = (rq: any, side: string) => (rq.attachments || []).filter((a: any) => a.source === side || (!a.source && side === "PC"))
  const canUp = (rq: any, side: string) => isAdmin || (side === "PC" && isPc && rq.createdById === userId) || (side === "LG" && isLg)
  // Delete a file — the document owner (request creator) sees the ✕ on their own docs; admin sees it on ALL.
  const canDel = (rq: any) => isAdmin || (!!userId && rq.createdById === userId)
  const delFile = async (a: any) => {
    if (!confirm(`ลบไฟล์ "${a.fileName}"?`)) return
    setBusy("del" + a.id)
    try {
      const r = await fetch(`/api/pull-material/attachments/${a.id}`, { method: "DELETE" })
      if (r.ok) await load(); else alert("ลบไม่สำเร็จ")
    } finally { setBusy(null) }
  }

  // A doc's branch: requestType, falling back to the documentNo prefix (SCM_… vs PULL_…) for older docs.
  const reqTypeOf = (r: any) => (r.requestType === "PURCHASING" || String(r.documentNo || "").toUpperCase().startsWith("PULL")) ? "PURCHASING" : "SCM"
  // Requester (จัดซื้อ) list — normalise emails to the local-part + de-dupe, so the filter is clean.
  const rname = (s: any) => String(s || "").split("@")[0].trim()
  const requesters = useMemo(() => {
    const m = new Map<string, string>()
    reqs.forEach(r => { const d = rname(r.requesterName); if (d && !m.has(d.toLowerCase())) m.set(d.toLowerCase(), d) })
    return [...m.values()].sort()
  }, [reqs])
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return reqs.filter(r => {
      if (typeF !== "ALL" && reqTypeOf(r) !== typeF) return false
      if (reqF && rname(r.requesterName).toLowerCase() !== reqF.toLowerCase()) return false
      if (onlyMissing && (r.attachments || []).length > 0) return false
      if (!term) return true
      return String(r.documentNo || "").toLowerCase().includes(term)
        || (r.items || []).some((i: any) => String(i.poNoDoc || "").toLowerCase().includes(term))
    })
  }, [reqs, q, onlyMissing, typeF, reqF]) // eslint-disable-line

  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Purchasing / Logistics / Admin only</p></div>

  const side = (rq: any, name: string, s: string, cats: [string, string][]) => {
    const list = filesOf(rq, s)
    const allow = canUp(rq, s)
    // Checklist: which required doc types are attached. A COMBINED file covers everything on that side.
    const required = cats.filter(([c]) => c !== "COMBINED").map(([c]) => c)
    const hasCombined = list.some((a: any) => a.category === "COMBINED")
    const has = (c: string) => hasCombined || list.some((a: any) => a.category === c)
    const missing = required.filter(c => !has(c))
    const complete = missing.length === 0
    return (
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{name}</span>
          {complete
            ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">✓ ครบ</span>
            : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">ยังขาด: {missing.map(c => CAT_LABEL[c] || c).join(" · ")}</span>}
        </div>
        <div className="flex flex-col gap-1">
          {list.length === 0 ? <span className="text-xs text-gray-300">— ยังไม่มีไฟล์ —</span> : list.map((a: any) => (
            <div key={a.id} className="flex items-center gap-1.5 group">
              <a href={`/api/pull-material/attachments/${a.id}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-sky-700 hover:underline truncate min-w-0" title={a.fileName}>
                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">{CAT_LABEL[a.category] || "ไฟล์"}</span>
                <span className="truncate">{a.fileName}</span>
              </a>
              {canDel(rq) && (
                <button onClick={() => delFile(a)} disabled={busy === "del" + a.id} title="ลบไฟล์"
                  className="shrink-0 text-gray-300 hover:text-red-600 text-xs px-1 disabled:opacity-40">{busy === "del" + a.id ? "…" : "✕"}</button>
              )}
            </div>
          ))}
        </div>
        {allow ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {cats.map(([cat, src]) => {
              const done = cat !== "COMBINED" ? has(cat) : hasCombined
              return (
                <label key={cat} title={done ? "แนบแล้ว — คลิกเพื่อเพิ่มอีก" : "ยังไม่แนบ"}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border cursor-pointer ${done ? "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700"}`}>
                  {busy === rq.id + cat ? "…" : `${done ? "✓" : "＋"} ${CAT_LABEL[cat]}`}
                  <input type="file" multiple className="hidden" onChange={e => { uploadFile(rq, cat, src, e.target.files); e.currentTarget.value = "" }} />
                </label>
              )
            })}
          </div>
        ) : <div className="text-[11px] text-gray-300 mt-2">แนบไม่ได้ (ไม่ใช่เจ้าของ/สิทธิ์)</div>}
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 max-w-[1100px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>Attach Files — Pull Material</h1>
        <p className="text-sm text-gray-400 mt-0.5">แนบ INV / Packing (จัดซื้อ) · AWB / ใบขน (LG) — ย้อนหลังได้ทุกเมื่อ · เลือก "รวม" ถ้าไฟล์เดียวมีหลายอย่าง</p>
      </div>

      {/* Branch filter — separate SCM requests from Purchasing requests */}
      <div className="flex gap-2 border-b border-gray-200">
        {([["ALL", "📁 ทั้งหมด"], ["SCM", "🧾 SCM req"], ["PURCHASING", "🛒 Purchase req"]] as const).map(([v, label]) => {
          const n = v === "ALL" ? reqs.length : reqs.filter(r => reqTypeOf(r) === v).length
          return (
            <button key={v} onClick={() => setTypeF(v)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${typeF === v ? "" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              style={typeF === v ? { color: MAROON, borderColor: MAROON } : undefined}>
              {label}<span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {BUS.map(b => (
          <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 ค้นหา เลขเอกสาร / PO…" className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <select value={reqF} onChange={e => setReqF(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">👤 จัดซื้อทั้งหมด</option>
          {requesters.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} className="w-4 h-4 accent-red-700" /> เฉพาะที่ยังไม่มีไฟล์
        </label>
        <span className="text-xs text-gray-400 ml-auto">{shown.length} เอกสาร</span>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        shown.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">ไม่พบเอกสาร</div> :
          <div className="space-y-2.5">
            {shown.map(rq => {
              const pos = [...new Set((rq.items || []).map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
              const n = (rq.attachments || []).length
              return (
                <div key={rq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="font-bold text-gray-900">{rq.documentNo}</span>
                    {reqTypeOf(rq) === "PURCHASING"
                      ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">Purchase req</span>
                      : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">SCM req</span>}
                    <span className="text-xs text-gray-400">{rq.requesterName} · PO {pos || "-"}</span>
                    <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full ${n ? "bg-sky-50 text-sky-700" : "bg-gray-100 text-gray-400"}`}>📎 {n} ไฟล์</span>
                  </div>
                  <div className="flex gap-6 flex-wrap">
                    {side(rq, "📄 PC Files (จัดซื้อ)", "PC", PC_CATS)}
                    {side(rq, "🚚 LG Files", "LG", LG_CATS)}
                  </div>
                </div>
              )
            })}
          </div>}
    </div>
  )
}
