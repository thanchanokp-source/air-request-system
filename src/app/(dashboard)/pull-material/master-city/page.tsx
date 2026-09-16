"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON } from "../_StageWork"

export default function Page() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const canEdit = roles.includes("ADMIN") || roles.includes("PURCHASING")
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [nw, setNw] = useState({ country: "", port: "", seaPort: "", city: "" })
  const [edits, setEdits] = useState<Record<string, { country: string; port: string; seaPort: string; city: string }>>({})
  // Real sea-master ports → power a datalist so LG/Purchasing pick an EXISTING sea port (guarantees the rate matches).
  const [seaPorts, setSeaPorts] = useState<{ port: string; country: string }[]>([])
  useEffect(() => {
    fetch("/api/pull-material/sea-rates").then(r => r.json()).then(d => {
      const seen = new Set<string>(); const list: { port: string; country: string }[] = []
      // Only LCL ports with a real rate — the compare uses LCL freight, so FCL-only ports would show "no master".
      ;(d.rows || []).forEach((r: any) => {
        const p = String(r.port || "").trim()
        const isLcl = String(r.container || "").toUpperCase().includes("LCL") && Number(r.rate) > 0
        if (p && isLcl && !seen.has(p.toUpperCase())) { seen.add(p.toUpperCase()); list.push({ port: p, country: String(r.country || "") }) }
      })
      setSeaPorts(list.sort((a, b) => a.port.localeCompare(b.port)))
    }).catch(() => {})
  }, [])
  const [busy, setBusy] = useState(false)
  // Sea ports grouped by country (normalized) so each row's SEA PORT list shows only that country's ports.
  const ck = (s: any) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const seaByCountry: Record<string, { port: string; country: string }[]> = {}
  seaPorts.forEach(s => { const k = ck(s.country); if (k) (seaByCountry[k] ||= []).push(s) })
  const seaListId = (country: string) => { const k = ck(country); return k && seaByCountry[k] ? `sea-${k}` : "sea-all" }

  const load = async () => { setLoading(true); try { const d = await fetch("/api/pull-material/cities").then(r => r.json()); setRows(d.rows || []) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  // The LIVE LG air Master Rate origins — so each Port shows whether it actually maps (drives Est Air).
  const [rateOrigins, setRateOrigins] = useState<Set<string>>(new Set())
  const [rateCountryByOrigin, setRateCountryByOrigin] = useState<Record<string, string>>({})
  useEffect(() => {
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => {
      setRateOrigins(new Set((d.origins || []).map((o: string) => String(o).toUpperCase())))
      const m: Record<string, string> = {}
      ;(d.rows || []).forEach((r: any) => { if (r.origin && r.country && !m[String(r.origin).toUpperCase()]) m[String(r.origin).toUpperCase()] = r.country })
      setRateCountryByOrigin(m)
    }).catch(() => {})
  }, [])
  const mapsRate = (port: string) => !!port && rateOrigins.has(String(port).toUpperCase())

  // Common origin airports — Port = IATA code (maps to the "origin" in the LG Master Rate → drives Est Air).
  // Country = the LG Master Rate's country name (EN, so the request cascade + Est Air match); City = TH.
  const AIRPORTS: { country: string; port: string; city: string }[] = [
    { country: "HONG KONG", port: "HKG", city: "ฮ่องกง" },
    { country: "TAIWAN", port: "TPE", city: "ไทเป" },
    { country: "CHINA", port: "TAO", city: "ชิงเต่า" },
    { country: "CHINA", port: "PVG", city: "เซี่ยงไฮ้" },
    { country: "CHINA", port: "SZX", city: "เซินเจิ้น" },
    { country: "CHINA", port: "CAN", city: "กวางโจว" },
    { country: "CHINA", port: "XMN", city: "เซี่ยเหมิน" },
    { country: "VIETNAM", port: "HAN", city: "ฮานอย" },
    { country: "VIETNAM", port: "HPH", city: "ไฮฟอง" },
    { country: "VIETNAM", port: "SGN", city: "โฮจิมินห์ซิตี้" },
    { country: "JAPAN", port: "KIX", city: "โอซาก้า" },
    { country: "INDIA", port: "DEL", city: "เดลี" },
    { country: "INDIA", port: "CJB", city: "โคอิมบาตอร์" },
    { country: "INDONESIA", port: "CGK", city: "จาการ์ตา" },
    { country: "ITALY", port: "MXP", city: "มิลาน" },
  ]
  const seedAirports = async () => {
    const have = new Set(rows.map(r => String(r.port || "").toUpperCase()))
    const todo = AIRPORTS.filter(a => !have.has(a.port))
    if (!todo.length) return alert("มีครบทั้ง 15 สนามบินแล้ว")
    if (!confirm(`เพิ่ม ${todo.length} สนามบิน (ข้ามที่มีอยู่แล้ว)?`)) return
    setBusy(true)
    try {
      for (const a of todo) await fetch("/api/pull-material/cities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) })
      await load()
    } finally { setBusy(false) }
  }

  const add = async () => {
    if (!nw.city.trim()) return alert("กรอก City")
    setBusy(true)
    try { const r = await fetch("/api/pull-material/cities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nw) }); if (r.ok) { setNw({ country: "", port: "", seaPort: "", city: "" }); await load() } else alert("Error") } finally { setBusy(false) }
  }
  const save = async (id: string) => {
    const e = edits[id]; if (!e) return
    setBusy(true)
    try { const r = await fetch("/api/pull-material/cities", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...e }) }); if (r.ok) { setEdits(p => { const n = { ...p }; delete n[id]; return n }); await load() } else alert("Error") } finally { setBusy(false) }
  }
  const del = async (id: string) => {
    if (!confirm("ลบเมืองนี้?")) return
    setBusy(true)
    try { const r = await fetch(`/api/pull-material/cities?id=${id}`, { method: "DELETE" }); if (r.ok) await load(); else alert("Error") } finally { setBusy(false) }
  }
  const val = (r: any, k: "country" | "port" | "seaPort" | "city") => edits[r.id]?.[k] ?? r[k] ?? ""
  const setVal = (r: any, k: string, v: string) => setEdits(p => {
    const base = p[r.id] || { country: r.country, port: r.port, seaPort: r.seaPort || "", city: r.city }
    return { ...p, [r.id]: { ...base, [k]: v } }
  })

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canEdit) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Admin / Purchasing only</p></div>

  const qq = q.trim().toLowerCase()
  const shown = qq ? rows.filter(r => `${r.country} ${r.port} ${r.city}`.toLowerCase().includes(qq)) : rows
  const inp = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-200"

  return (
    <div className="p-5 max-w-[900px] mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>MASTER PURCHASE</h1></div>
        <button onClick={seedAirports} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50 whitespace-nowrap">✈ โหลดชุดสนามบิน (15)</button>
      </div>

      {/* Map status vs the LIVE LG air Master Rate */}
      {(() => {
        const withPort = rows.filter(r => r.port)
        const ok = withPort.filter(r => mapsRate(r.port)).length
        const bad = withPort.length - ok
        return (
          <div className={`text-sm rounded-xl border px-3 py-2 ${bad ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
            {rateOrigins.size === 0
              ? "⏳ กำลังโหลด LG Master Rate…"
              : bad === 0
                ? <>✓ ทุก Port ({ok}) map กับ LG Master Rate แล้ว — คิด Est Air ได้</>
                : <>⚠ {ok} Port ตรง · <b>{bad} Port ไม่พบใน LG Master Rate</b> (แถว ⚠ ด้านล่าง) — Port พวกนี้จะยังไม่คิด Est Air จนกว่า LG จะเพิ่ม rate</>}
          </div>
        )
      })()}

      {/* Add row */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">เพิ่มเมือง</p>
        <div className="grid sm:grid-cols-5 gap-2">
          <input value={nw.country} onChange={e => setNw(p => ({ ...p, country: e.target.value }))} placeholder="Country" className={inp} />
          <input value={nw.port} onChange={e => setNw(p => ({ ...p, port: e.target.value }))} placeholder="Air Port" className={inp} />
          <input list={seaListId(nw.country)} value={nw.seaPort} onChange={e => setNw(p => ({ ...p, seaPort: e.target.value }))} placeholder="Sea Port" className={inp} />
          <input value={nw.city} onChange={e => setNw(p => ({ ...p, city: e.target.value }))} placeholder="City *" className={inp} />
          <button onClick={add} disabled={busy} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>+ เพิ่ม</button>
        </div>
      </div>

      {/* Sea-port suggestions from the LIVE sea Master Rate — one datalist PER COUNTRY so each row only sees
          its own country's ports (e.g. a CHINA row lists just CHINA sea ports). "sea-all" is the fallback. */}
      {Object.entries(seaByCountry).map(([k, list]) => (
        <datalist id={`sea-${k}`} key={k}>{list.map(s => <option key={s.port} value={s.port}>{s.port}</option>)}</datalist>
      ))}
      <datalist id="sea-all">{seaPorts.map(s => <option key={s.port} value={s.port}>{s.country ? `${s.port} · ${s.country}` : s.port}</option>)}</datalist>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหา country / port / city…" className="w-full sm:w-96 border border-gray-300 rounded-lg px-3 py-2 text-sm" />

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500"><tr>
            {["COUNTRY", "AIR PORT", "SEA PORT", "CITY", "MAP RATE", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr> :
              shown.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">ยังไม่มีข้อมูล</td></tr> :
                shown.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${edits[r.id] ? "bg-green-50" : ""}`}>
                    <td className="px-3 py-1.5"><input value={val(r, "country")} onChange={e => setVal(r, "country", e.target.value)} className={inp} /></td>
                    <td className="px-3 py-1.5"><input value={val(r, "port")} onChange={e => setVal(r, "port", e.target.value)} className={inp} /></td>
                    <td className="px-3 py-1.5"><input list={seaListId(val(r, "country"))} value={val(r, "seaPort")} onChange={e => setVal(r, "seaPort", e.target.value)} placeholder="—" className={inp} /></td>
                    <td className="px-3 py-1.5"><input value={val(r, "city")} onChange={e => setVal(r, "city", e.target.value)} className={inp} /></td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {!r.port ? <span className="text-gray-300 text-xs">—</span>
                        : mapsRate(r.port)
                          ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">✓ ตรง rate</span>
                          : <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5" title="ไม่พบ port นี้ใน LG Master Rate">⚠ ไม่พบใน rate</span>}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-right">
                      {edits[r.id] && <button onClick={() => save(r.id)} disabled={busy} className="px-3 py-1 rounded-lg text-white text-xs font-semibold bg-green-600 mr-1 disabled:opacity-50">💾 Save</button>}
                      <button onClick={() => del(r.id)} disabled={busy} className="text-gray-300 hover:text-red-500 px-2">✕</button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
