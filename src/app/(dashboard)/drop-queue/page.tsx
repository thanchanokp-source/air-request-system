"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

// MER DROP QUEUE — SOs flagged by a claim approver for MER to drop (data wrong). MER either DROPs (deletes
// just that SO — the document stays) or KEEPs (removes the flag). NYG/EA/TRM · MER + Admin only.
const MAROON = "#6b1a1a"
const n = (v: any) => (v == null ? "-" : Number(v).toLocaleString())

type Row = { itemId: string; requestId: string; documentNo: string; bu: string; docStatus: string; so: string; sub?: string; style?: string; brand?: string; qty?: number; reason?: string; by?: string }

export default function DropQueuePage() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const allowed = roles.includes("ADMIN") || roles.some(r => ["MER_USER", "MER_EA", "MER_TRM"].includes(r))

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState("")

  const load = () => {
    setLoading(true)
    fetch("/api/drop-queue").then(r => r.json()).then(d => setRows(d.rows || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { if (allowed) load() }, [allowed]) // eslint-disable-line

  const act = async (r: Row, action: "delete_item" | "unflag_drop_so") => {
    const msg = action === "delete_item"
      ? `ลบ SO ${r.so} (${r.documentNo}) ออกจากเอกสาร?\nลบเฉพาะ SO นี้ · เอกสารยังอยู่ · ย้อนกลับไม่ได้`
      : `ยกเลิก drop SO ${r.so}? (เก็บ SO นี้ไว้)`
    if (!confirm(msg)) return
    setBusy(r.itemId)
    try {
      const res = await fetch(`/api/requests/${r.requestId}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId: r.itemId }),
      })
      if (res.ok) setRows(prev => prev.filter(x => x.itemId !== r.itemId))
      else { const e = await res.json().catch(() => ({})); alert(e.error || "Error") }
    } finally { setBusy(null) }
  }

  const qq = q.trim().toLowerCase()
  const shown = rows.filter(r => !qq || r.so.toLowerCase().includes(qq) || String(r.documentNo).toLowerCase().includes(qq) || String(r.brand || "").toLowerCase().includes(qq))

  if (auth === "loading" || loading) return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!allowed) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Merchandise / Admin only</p></div>

  return (
    <div className="p-5 md:p-8 max-w-[1100px] mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>DROP QUEUE <span className="text-base font-normal text-gray-400">({rows.length})</span></h1>
        <p className="text-xs text-gray-400 mt-0.5">SO ที่ claim ส่งมาให้ MER ลบ (data ผิด) — <b>Drop</b> = ลบ SO นั้น (เอกสารยังอยู่) · <b>Keep</b> = ยกเลิก drop</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 ค้นหา SO / Doc / Brand"
        className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />

      {shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">ไม่มี SO รอ drop 🎉</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500"><tr className="text-left">
              <th className="px-3 py-2 font-medium">SO</th><th className="px-3 py-2 font-medium">Doc</th>
              <th className="px-3 py-2 font-medium">Brand</th><th className="px-3 py-2 font-medium">Style</th>
              <th className="px-3 py-2 font-medium text-right">QTY</th><th className="px-3 py-2 font-medium">เหตุผล (จาก claim)</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map(r => (
                <tr key={r.itemId} className="hover:bg-gray-50 bg-rose-50/30">
                  <td className="px-3 py-2 font-mono font-semibold">{r.so}{r.sub ? ` · ${r.sub}` : ""}</td>
                  <td className="px-3 py-2"><a href={`/requests/${r.requestId}`} className="text-blue-600 hover:underline">{r.documentNo}</a> <span className="text-[10px] text-gray-400">{r.bu}</span></td>
                  <td className="px-3 py-2 text-gray-600">{r.brand || "-"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.style || "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(r.qty)}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[240px]"><span title={r.reason || ""}>{r.reason || "-"}</span>{r.by && <span className="block text-[10px] text-gray-400">โดย {String(r.by).split("@")[0]}</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => act(r, "delete_item")} disabled={busy === r.itemId}
                      className="px-3 py-1 rounded-lg text-white text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-40">{busy === r.itemId ? "…" : "🗑 Drop"}</button>
                    <button onClick={() => act(r, "unflag_drop_so")} disabled={busy === r.itemId}
                      className="ml-2 px-3 py-1 rounded-lg text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">Keep</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
