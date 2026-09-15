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

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return reqs.filter(r => {
      if (onlyMissing && (r.attachments || []).length > 0) return false
      if (!term) return true
      return String(r.documentNo || "").toLowerCase().includes(term)
        || (r.items || []).some((i: any) => String(i.poNoDoc || "").toLowerCase().includes(term))
    })
  }, [reqs, q, onlyMissing])

  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Purchasing / Logistics / Admin only</p></div>

  const side = (rq: any, name: string, s: string, cats: [string, string][]) => {
    const list = filesOf(rq, s)
    const allow = canUp(rq, s)
    return (
      <div className="flex-1 min-w-[240px]">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{name}</div>
        <div className="flex flex-col gap-1">
          {list.length === 0 ? <span className="text-xs text-gray-300">— ยังไม่มีไฟล์ —</span> : list.map((a: any) => (
            <a key={a.id} href={`/api/pull-material/attachments/${a.id}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-sky-700 hover:underline truncate" title={a.fileName}>
              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">{CAT_LABEL[a.category] || "ไฟล์"}</span>
              <span className="truncate">{a.fileName}</span>
            </a>
          ))}
        </div>
        {allow ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {cats.map(([cat, src]) => (
              <label key={cat} className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 cursor-pointer">
                {busy === rq.id + cat ? "…" : `＋ ${CAT_LABEL[cat]}`}
                <input type="file" multiple className="hidden" onChange={e => { uploadFile(rq, cat, src, e.target.files); e.currentTarget.value = "" }} />
              </label>
            ))}
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

      <div className="flex gap-1.5 flex-wrap">
        {BUS.map(b => (
          <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 ค้นหา เลขเอกสาร / PO…" className="w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
