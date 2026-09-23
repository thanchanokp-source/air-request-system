"use client"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

const MAROON = "#6b1a1a"
const fmtDT = (v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? "-" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) }
const fmtD = (v: any) => { if (!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-GB") }
const fmtN = (v: any) => (v != null ? Number(v).toLocaleString() : "-")
const nameOf = (l: any) => l.userName || (l.userEmail ? String(l.userEmail).split("@")[0] : "-")
const CAP = 500

// Read-only audit of Logistics data entry (LgEntryLog) — what LG entered, when, by whom.
export default function LgHistory() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN" || String((session?.user as any)?.email || "").toLowerCase() === "jariya.t@nanyangtextile.com"
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [q, setQ] = useState("")
  const [fSo, setFSo] = useState("")
  const [fSub, setFSub] = useState("")
  const [fHawb, setFHawb] = useState("")
  const [fInv, setFInv] = useState("")
  const [fromD, setFromD] = useState("")
  const [toD, setToD] = useState("")
  const [actF, setActF] = useState<"all" | "draft" | "send">("all")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState("")
  const saveComment = async (id: string, val: string) => {
    setSavingId(id)
    try {
      const r = await fetch("/api/lg-entries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, comment: val }) })
      if (r.ok) setLogs(ls => ls.map(l => (l.id === id ? { ...l, comment: val.trim() || null } : l)))
    } finally { setSavingId("") }
  }

  useEffect(() => {
    fetch("/api/lg-entries")
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({} as any))).error || `HTTP ${r.status}`); return r.json() })
      .then(setLogs).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const so = fSo.trim().toLowerCase(), sub = fSub.trim().toLowerCase(), hawb = fHawb.trim().toLowerCase(), inv = fInv.trim().toLowerCase()
    const has = (v: any, needle: string) => String(v || "").toLowerCase().includes(needle)
    return logs.filter(l => {
      if (actF !== "all" && l.action !== actF) return false
      if (fromD || toD) { const d = String(l.createdAt).slice(0, 10); if (fromD && d < fromD) return false; if (toD && d > toD) return false }
      if (so && !has(l.so, so)) return false
      if (sub && !has(l.sub, sub)) return false
      if (hawb && !has(l.hawbNo, hawb)) return false
      if (inv && !has(l.invoiceNo, inv)) return false
      if (qq && ![l.documentNo, l.so, l.sub, l.brand, l.invoiceNo, l.hawbNo, nameOf(l)].some((x: any) => has(x, qq))) return false
      return true
    })
  }, [logs, q, fSo, fSub, fHawb, fInv, fromD, toD, actF])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหารวม Doc / Brand / ผู้กรอก"
          className="w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        <input value={fSo} onChange={e => setFSo(e.target.value)} placeholder="SO…" className="w-28 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        <input value={fSub} onChange={e => setFSub(e.target.value)} placeholder="SUB…" className="w-24 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        <input value={fHawb} onChange={e => setFHawb(e.target.value)} placeholder="HAWB…" className="w-32 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        <input value={fInv} onChange={e => setFInv(e.target.value)} placeholder="INV…" className="w-32 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        <span className="text-xs text-gray-400">วันที่:</span>
        <input type="date" value={fromD} onChange={e => setFromD(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
        <span className="text-xs text-gray-400">ถึง</span>
        <input type="date" value={toD} onChange={e => setToD(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
        {(["all", "draft", "send"] as const).map(v => (
          <button key={v} onClick={() => setActF(v)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${actF === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            style={actF === v ? { background: MAROON } : {}}>{v === "all" ? "ทั้งหมด" : v === "draft" ? "Draft" : "Send"}</button>
        ))}
        {(q || fSo || fSub || fHawb || fInv || fromD || toD || actF !== "all") && <button onClick={() => { setQ(""); setFSo(""); setFSub(""); setFHawb(""); setFInv(""); setFromD(""); setToD(""); setActF("all") }} className="text-xs text-red-600 hover:underline">ล้างตัวกรอง</button>}
        <span className="text-xs text-gray-400 ml-auto">{rows.length.toLocaleString()} รายการ</span>
      </div>

      {loading && <p className="text-sm text-gray-400">กำลังโหลด…</p>}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{err}</div>}
      {!loading && !err && (
        <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium whitespace-nowrap">เมื่อไหร่</th>
                <th className="px-3 py-2 font-medium">โดยใคร</th>
                <th className="px-3 py-2 font-medium">Doc</th>
                <th className="px-3 py-2 font-medium">SO</th>
                <th className="px-3 py-2 font-medium">SUB</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">INV</th>
                <th className="px-3 py-2 font-medium">HAWB#</th>
                <th className="px-3 py-2 font-medium text-right">Actual Air</th>
                <th className="px-3 py-2 font-medium text-right">QTY Ship</th>
                <th className="px-3 py-2 font-medium">Ship Date</th>
                <th className="px-3 py-2 font-medium">action</th>
                <th className="px-3 py-2 font-medium min-w-[160px]">Comment {isAdmin && <span className="text-[9px] text-gray-400">(admin)</span>}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, CAP).map((l, i) => (
                <tr key={l.id || i} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{fmtDT(l.createdAt)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{nameOf(l)}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">{l.documentNo}</td>
                  <td className="px-3 py-1.5 font-mono">{l.so || "-"}</td>
                  <td className="px-3 py-1.5 font-mono">{l.sub || "-"}</td>
                  <td className="px-3 py-1.5">{l.brand || "-"}</td>
                  <td className="px-3 py-1.5">{l.invoiceNo || "-"}</td>
                  <td className="px-3 py-1.5">{l.hawbNo || "-"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtN(l.actualAirFreight)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtN(l.qtyActualShip)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtD(l.planShipmentDate)}</td>
                  <td className="px-3 py-1.5"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${l.action === "send" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>{l.action}</span></td>
                  <td className="px-3 py-1.5">
                    {isAdmin ? (
                      <input value={drafts[l.id] ?? l.comment ?? ""} disabled={savingId === l.id}
                        onChange={e => setDrafts(d => ({ ...d, [l.id]: e.target.value }))}
                        onBlur={() => { const v = drafts[l.id]; if (v !== undefined && v !== (l.comment ?? "")) saveComment(l.id, v) }}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                        placeholder="ใส่หมายเหตุ…"
                        className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-50" />
                    ) : (
                      <span className="text-gray-600">{l.comment || "-"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > CAP && <div className="px-3 py-2 text-[11px] text-amber-600 border-t border-gray-100">แสดง {CAP} จาก {rows.length.toLocaleString()} — ใช้ตัวกรอง</div>}
          {rows.length === 0 && <div className="px-3 py-6 text-center text-gray-400">ยังไม่มีประวัติ (เริ่มบันทึกตั้งแต่ deploy ฟีเจอร์นี้)</div>}
        </div>
      )}
    </div>
  )
}
