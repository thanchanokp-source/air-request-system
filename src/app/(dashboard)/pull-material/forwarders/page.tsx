"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON } from "../_StageWork"

// MASTER FWD — the forwarder address book LG keeps. The LOGISTICS page picks a FWD from here when it
// mails the actual-entry template, so nobody has to retype an address per document. Sending to a brand
// new address still auto-adds it here.
export default function Page() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const canUse = roles.includes("ADMIN") || roles.includes("LOGISTICS_IMPORT")
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState("")
  const [q, setQ] = useState("")
  const [nw, setNw] = useState({ name: "", email: "", contactName: "", tel: "" })
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  // FWD names already used in the Air rate master — so LG can add the ones the system actually quotes.
  const [knownFwd, setKnownFwd] = useState<string[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch("/api/pull-material/forwarders?all=1").then(r => r.json())
      setRows(d.rows || []); setEdits({})
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [canUse]) // eslint-disable-line
  useEffect(() => {
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => {
      setKnownFwd([...new Set((d.rows || []).map((r: any) => String(r.fwd || "").trim()).filter(Boolean))].sort() as string[])
    }).catch(() => {})
  }, [])

  const val = (r: any, k: string) => edits[r.id]?.[k] ?? (r[k] != null ? String(r[k]) : "")
  const setVal = (id: string, k: string, v: string) => setEdits(p => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }))
  const dirty = (r: any) => !!edits[r.id] && Object.entries(edits[r.id]).some(([k, v]) => v !== (r[k] != null ? String(r[k]) : ""))

  const add = async () => {
    if (!nw.name.trim()) return alert("ใส่ชื่อ FWD ก่อน")
    if (!nw.email.trim()) return alert("ใส่อีเมล FWD ก่อน")
    setBusy("new")
    try {
      const r = await fetch("/api/pull-material/forwarders", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nw),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setNw({ name: "", email: "", contactName: "", tel: "" }); await load() } else alert(d.error || "เพิ่มไม่สำเร็จ")
    } finally { setBusy("") }
  }

  const save = async (r: any) => {
    setBusy(r.id)
    try {
      const res = await fetch("/api/pull-material/forwarders", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, name: val(r, "name"), email: val(r, "email"), contactName: val(r, "contactName"), tel: val(r, "tel") }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) await load(); else alert(d.error || "บันทึกไม่สำเร็จ")
    } finally { setBusy("") }
  }

  const toggle = async (r: any) => {
    setBusy(r.id)
    try {
      await fetch("/api/pull-material/forwarders", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
      })
      await load()
    } finally { setBusy("") }
  }

  const del = async (r: any) => {
    if (!confirm(`ลบ ${r.name} (${r.email}) ออกจากรายชื่อ?`)) return
    setBusy(r.id)
    try { await fetch(`/api/pull-material/forwarders?id=${r.id}`, { method: "DELETE" }); await load() } finally { setBusy("") }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Logistics Import / Admin only</p></div>

  const inp = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
  const needle = q.trim().toLowerCase()
  const shown = rows.filter(r => !needle || [r.name, r.email, r.contactName, r.tel].some((v: any) => String(v || "").toLowerCase().includes(needle)))
  const missing = knownFwd.filter(f => !rows.some(r => String(r.name).toUpperCase() === f.toUpperCase()))

  return (
    <div className="p-5 md:p-8 max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>MASTER FWD</h1>
        <p className="text-sm text-gray-500 mt-1">อีเมล Forwarder ที่ใช้ส่งขอ Actual (หน้า LOGISTICS เลือกจากรายชื่อนี้)</p>
      </div>

      {/* Add a contact */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-sm font-bold text-gray-800 mb-3">➕ เพิ่ม Forwarder</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">ชื่อ FWD *</label>
            <input list="known-fwd" value={nw.name} onChange={e => setNw({ ...nw, name: e.target.value })} placeholder="BFI" className={inp} />
            <datalist id="known-fwd">{knownFwd.map(f => <option key={f} value={f} />)}</datalist>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">อีเมล *</label>
            <input value={nw.email} onChange={e => setNw({ ...nw, email: e.target.value })} placeholder="ops@forwarder.com" className={inp} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">ผู้ติดต่อ</label>
            <input value={nw.contactName} onChange={e => setNw({ ...nw, contactName: e.target.value })} placeholder="คุณ…" className={inp} />
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">เบอร์</label>
              <input value={nw.tel} onChange={e => setNw({ ...nw, tel: e.target.value })} placeholder="02-…" className={inp} />
            </div>
            <button onClick={add} disabled={busy === "new"} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 shrink-0" style={{ background: MAROON }}>
              {busy === "new" ? "…" : "เพิ่ม"}
            </button>
          </div>
        </div>
        {missing.length > 0 && (
          <p className="mt-3 text-[11px] text-amber-700">
            ⚠️ FWD ใน Master Rate ที่ยังไม่มีอีเมล: {missing.map(f => (
              <button key={f} onClick={() => setNw(v => ({ ...v, name: f }))} className="underline font-semibold mr-2 hover:text-amber-800">{f}</button>
            ))}
          </p>
        )}
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหาชื่อ / อีเมล…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />

      {/* Contact list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? <p className="p-6 text-sm text-gray-400">Loading…</p> :
          shown.length === 0 ? <p className="p-10 text-center text-gray-400 text-sm">ยังไม่มีรายชื่อ — เพิ่มด้านบนได้เลย</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>{["FWD", "อีเมล", "ผู้ติดต่อ", "เบอร์", "ใช้งาน", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {shown.map(r => (
                    <tr key={r.id} className={`hover:bg-gray-50 ${r.isActive ? "" : "opacity-50"}`}>
                      <td className="px-3 py-2 min-w-[130px]"><input value={val(r, "name")} onChange={e => setVal(r.id, "name", e.target.value)} className={inp} /></td>
                      <td className="px-3 py-2 min-w-[220px]"><input value={val(r, "email")} onChange={e => setVal(r.id, "email", e.target.value)} className={inp} /></td>
                      <td className="px-3 py-2 min-w-[150px]"><input value={val(r, "contactName")} onChange={e => setVal(r.id, "contactName", e.target.value)} className={inp} /></td>
                      <td className="px-3 py-2 min-w-[120px]"><input value={val(r, "tel")} onChange={e => setVal(r.id, "tel", e.target.value)} className={inp} /></td>
                      <td className="px-3 py-2">
                        <button onClick={() => toggle(r)} disabled={busy === r.id}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${r.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}>
                          {r.isActive ? "ใช้งาน" : "ปิด"}
                        </button>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {dirty(r) && (
                          <button onClick={() => save(r)} disabled={busy === r.id} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold mr-1.5 disabled:opacity-50" style={{ background: MAROON }}>
                            {busy === r.id ? "…" : "💾 บันทึก"}
                          </button>
                        )}
                        <button onClick={() => del(r)} disabled={busy === r.id} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
      <p className="text-[11px] text-gray-400">* ส่งเมลหา FWD รายใหม่จากหน้า LOGISTICS ระบบจะเก็บชื่อ+อีเมลเข้ามาที่นี่ให้อัตโนมัติ</p>
    </div>
  )
}
