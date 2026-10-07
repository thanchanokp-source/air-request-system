"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, STATUS_LABEL, fmt, buColor } from "../_StageWork"
import { MultiSelect } from "@/components/ui/multi-select"
import { buildRequesters } from "@/lib/pull-requesters"
import { pullReqType } from "@/lib/pull-reqtype"

// Chart palette — fixed slots, assigned in order and never cycled. Checked for colour-blind
// separation against a white panel; every bar also carries its own number, so colour is never
// the only thing that tells two things apart.
const C = {
  s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", s4: "#eda100", s5: "#4a3aa7",
  good: "#008300", warn: "#b45309", crit: "#e34948",
  seq: ["#104281", "#1c5cab", "#2a78d6", "#86b6ef", "#cde2fb"],
}
const THB = 32.5
const DAY = 86400000
const days = (a: any, b: any) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / DAY : null)

export default function Page() {
  const { data: session, status: auth } = useSession()
  const [bu, setBu] = useState("NYG")
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING" | "SAMPLE" | "PPC">("ALL")
  const [docF, setDocF] = useState<string[]>([])
  const [poF, setPoF] = useState<string[]>([])
  const [reqF, setReqF] = useState<string[]>([])
  const reqTypeOf = pullReqType

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { load() }, [bu]) // eslint-disable-line

  // Filter options (Doc No / PO / จัดซื้อ) + apply SCM/Purchasing + those filters to EVERY metric below.
  const { options: reqOptions, displayOf } = useMemo(() => buildRequesters(reqs), [reqs])
  const docNos = useMemo(() => [...new Set(reqs.map((r: any) => r.documentNo).filter(Boolean))].sort(), [reqs])
  const poNos = useMemo(() => [...new Set(reqs.flatMap((r: any) => (r.items || []).map((i: any) => i.poNoDoc)).filter(Boolean))].sort(), [reqs])

  // Every hook must run on every render — this early return has to stay BELOW them, otherwise the
  // first render (session still "loading") runs fewer hooks than the next one: React error #310.
  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  const fReqs = reqs.filter((r: any) => {
    if (typeF !== "ALL" && reqTypeOf(r) !== typeF) return false
    if (docF.length && !docF.includes(r.documentNo)) return false
    if (poF.length && !(r.items || []).some((i: any) => poF.includes(i.poNoDoc))) return false
    if (reqF.length && !reqF.includes(displayOf(r))) return false
    return true
  })
  const items = fReqs.flatMap((r: any) => r.items || [])
  const totalDocs = fReqs.length
  const estOf = (r: any) => (r.items || []).reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
  const kgOf = (r: any) => (r.items || []).reduce((s: number, i: any) => s + (Number(i.weight) || 0), 0)
  const isDone = (r: any) => r.status === "COMPLETED" || r.actualAir != null
  // One person, one bar. The same human reaches us as "doungjai.p", "doungjai.p@nanyangtextile.com"
  // or "doungjai" depending on which field was filled, so every spelling is folded onto the name the
  // "จัดซื้อ" filter already uses (buildRequesters), matching on the part before the @ and, failing
  // that, on the part before the first dot.
  const localOf = (s: any) => String(s || "").split("@")[0].trim()
  const canon = new Map<string, string>()
  reqs.forEach((r: any) => {
    const d = displayOf(r); if (!d) return
    canon.set(d.toLowerCase(), d)
    const l = localOf(r.requesterName).toLowerCase(); if (l) canon.set(l, d)
  })
  const ownerOf = (r: any) => {
    const raw = localOf(r.purchaserName) || displayOf(r) || localOf(r.requesterName)
    if (!raw) return "-"
    const k = raw.toLowerCase()
    return canon.get(k) || canon.get(k.split(".")[0]) || raw
  }

  const totalPullGarment = items.reduce((s, i) => s + (Number(i.pullGarment) || 0), 0)
  const totalKg = items.reduce((s, i) => s + (Number(i.weight) || 0), 0)
  // Pull RM freight is priced in USD (air master rates are USD/kg).
  const est = items.reduce((s, i) => s + (Number(i.airFreightCost) || 0), 0)
  const act = fReqs.reduce((s, r) => s + (Number(r.actualAir) || 0), 0)
  const doneDocs = fReqs.filter(isDone)
  const wipDocs = fReqs.filter((r: any) => !isDone(r))
  // Est of the CLOSED docs only — the only fair base to judge the Actual against.
  const estDone = doneDocs.reduce((s, r) => s + estOf(r), 0)
  const variance = act - estDone
  const variancePct = estDone > 0 && act > 0 ? (variance / estDone) * 100 : null

  // ── 1 · รอบเวลาต่อคน (เปิดเอกสาร → ปิดงาน) ────────────────────────────────────────────
  // The system has no per-stage timestamps yet, so this is the honest number we CAN compute:
  // calendar days from the document being raised until LG closed it. Rows slower than the overall
  // average are flagged — no invented target.
  const byOwner: Record<string, { d: number[]; docs: number }> = {}
  fReqs.forEach((r: any) => {
    const o = ownerOf(r); const g = (byOwner[o] ||= { d: [], docs: 0 })
    g.docs++
    if (isDone(r)) { const n = days(r.createdAt, r.updatedAt); if (n != null && n >= 0) g.d.push(n) }
  })
  const ownerRows = Object.entries(byOwner).map(([k, v]) => ({
    k, docs: v.docs, avg: v.d.length ? v.d.reduce((a, b) => a + b, 0) / v.d.length : null, closed: v.d.length,
  }))
  const turnRows = ownerRows.filter(o => o.avg != null).sort((a, b) => (b.avg || 0) - (a.avg || 0)).slice(0, 8)
  const avgAll = turnRows.length ? turnRows.reduce((s, o) => s + (o.avg || 0), 0) / turnRows.length : 0
  const workRows = [...ownerRows].sort((a, b) => b.docs - a.docs).slice(0, 8)

  // ── 2 · Est vs Actual รายเดือน ─────────────────────────────────────────────────────────
  const byMonth: Record<string, { docs: number; est: number; act: number }> = {}
  fReqs.forEach((r: any) => {
    const d = new Date(r.createdAt); if (isNaN(d.getTime())) return
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const g = (byMonth[k] ||= { docs: 0, est: 0, act: 0 })
    g.docs++; g.est += estOf(r); g.act += Number(r.actualAir) || 0
  })
  const monthly = Object.entries(byMonth).sort().slice(-8)
  const maxMonth = Math.max(1, ...monthly.flatMap(([, v]) => [v.est, v.act]))

  // ── 3 · ค้างอยู่ขั้นไหน ────────────────────────────────────────────────────────────────
  const byStage: Record<string, number> = {}
  wipDocs.forEach((r: any) => { const k = STATUS_LABEL[r.status] || r.status; byStage[k] = (byStage[k] || 0) + 1 })
  const stageRows = Object.entries(byStage).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // ── 4 · ค่าขนส่งจริงต่อกิโล แยกตาม Forwarder (THB/kg) ─────────────────────────────────
  const byFwd: Record<string, { act: number; est: number; kg: number; docs: number }> = {}
  doneDocs.forEach((r: any) => {
    const name = r.fwdName || r.preCostFwd; const kg = kgOf(r)
    if (!name || !kg || r.actualAir == null) return
    const g = (byFwd[name] ||= { act: 0, est: 0, kg: 0, docs: 0 })
    g.act += Number(r.actualAir) || 0; g.est += estOf(r); g.kg += kg; g.docs++
  })
  const fwdRows = Object.entries(byFwd).map(([k, v]) => ({
    k, docs: v.docs, rate: (v.act * THB) / v.kg, diff: ((v.act - v.est) * THB) / v.kg,
  })).sort((a, b) => b.rate - a.rate).slice(0, 6)

  // ── 5 · สัดส่วน Incoterm (นับตามเอกสาร — ใช้เทอมของบรรทัดแรกที่กรอก) ──────────────────
  const incCount: Record<string, number> = {}
  fReqs.forEach((r: any) => { const t = ((r.items || []).find((i: any) => i.incoterm) || {}).incoterm; if (t) incCount[t] = (incCount[t] || 0) + 1 })
  const incRows = Object.entries(incCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const incTotal = incRows.reduce((s, [, n]) => s + n, 0)

  // ── 6 · ใบที่ต้องตามด่วน ──────────────────────────────────────────────────────────────
  const AGE_LIMIT = 7 // วันที่ถือว่าค้างนาน
  const exceptions = wipDocs.map((r: any) => {
    const age = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / DAY)
    const rev = Number(r.reviseCount) || 0
    const waitFwd = r.fwdSentAt && !r.fwdImportedAt ? Math.floor((Date.now() - new Date(r.fwdSentAt).getTime()) / DAY) : null
    return { r, age, rev, waitFwd }
  }).filter(x => x.age > AGE_LIMIT || x.rev >= 3 || (x.waitFwd != null && x.waitFwd > 3))
    .sort((a, b) => (b.rev * 10 + b.age) - (a.rev * 10 + a.age)).slice(0, 10)

  // ── 7 · เหตุผลที่ถูกตีกลับ (ระบบเก็บได้แค่เหตุผลล่าสุดของแต่ละใบ) ────────────────────
  const reasonCount: Record<string, number> = {}
  fReqs.forEach((r: any) => { const t = String(r.lastReturnReason || "").trim(); if (t && (Number(r.reviseCount) || 0) > 0) reasonCount[t] = (reasonCount[t] || 0) + 1 })
  const reasonRows = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const totalRevises = fReqs.reduce((s, r) => s + (Number(r.reviseCount) || 0), 0)

  // ── Top-5 by est air cost (brand / supplier / country) ────────────────────────────────
  const topBy = (key: string) => {
    const m: Record<string, number> = {}
    items.forEach((i: any) => { const k = i[key] || null; if (k) m[k] = (m[k] || 0) + (Number(i.airFreightCost) || 0) })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }
  const topBrand = topBy("brand"), topVendor = topBy("vendorName"), topCountry = topBy("country")

  // OVER BUDGET (Actual > Est) attributed to brand / vendor. A doc's Actual is per-doc, so it's split
  // across its lines by each line's Est share, then summed per brand & per vendor.
  const overBy = (key: "brand" | "vendorName") => {
    const m: Record<string, { est: number; act: number }> = {}
    fReqs.forEach((r: any) => {
      const its = r.items || []
      const docEst = estOf(r), docAct = Number(r.actualAir) || 0
      if (!docEst || !docAct) return
      its.forEach((i: any) => {
        const k = i[key]; if (!k) return
        const e = Number(i.airFreightCost) || 0
        const g = (m[k] ||= { est: 0, act: 0 })
        g.est += e; g.act += docAct * (e / docEst)
      })
    })
    return Object.entries(m).map(([name, v]) => ({ name, est: v.est, act: v.act, diff: v.act - v.est }))
      .filter(x => x.diff > 0.5).sort((a, b) => b.diff - a.diff).slice(0, 6)
  }
  const overBrand = overBy("brand"), overVendor = overBy("vendorName")
  const overTotal = overBrand.reduce((s, x) => s + x.diff, 0)

  const dstr = (v: any) => (v ? new Date(v).toLocaleDateString("en-GB") : "-")
  const TABLE_COLS = ["Doc No", "BU", "สาย", "จัดซื้อ", "PO", "Country", "Port", "Incoterm", "Wt(kg)", "Factory", "ETC", "Est USD", "MAWB", "HAWB", "ETD", "ETA", "Pre cost", "Actual", "Local", "CFM in-house", "Status"]
  const tableRow = (r: any): any[] => {
    const its = r.items || []
    const d0 = its.find((i: any) => i.airFreightCost != null) || its[0] || {}
    const po = [...new Set(its.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
    return [r.documentNo, r.bu, reqTypeOf(r) === "PURCHASING" ? "จัดซื้อ" : reqTypeOf(r) === "SAMPLE" ? "Sample" : "SCM", displayOf(r) || "", po,
      d0.country || "", d0.port || d0.seaPort || "", d0.incoterm || "", d0.weight != null ? Number(d0.weight) : "",
      r.factory || d0.factory || "", dstr(d0.etc), estOf(r) ? Math.round(estOf(r)) : "",
      r.mawbNo || "", r.hawbNo || "", dstr(r.flightEtd), dstr(r.flightEta),
      r.preCost != null ? Number(r.preCost) : "", r.actualAir != null ? Number(r.actualAir) : "", r.localChargeTh != null ? Number(r.localChargeTh) : "",
      dstr(r.cfmInHouseDate), STATUS_LABEL[r.status] || r.status]
  }
  const exportTable = async () => {
    try {
      const ExcelJS: any = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Pull RM")
      ws.addRow(TABLE_COLS); ws.getRow(1).font = { bold: true }
      fReqs.forEach((r: any) => ws.addRow(tableRow(r)))
      ws.columns.forEach((c: any) => { c.width = 14 })
      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      const a = document.createElement("a"); a.href = url; a.download = `PullRM_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) { alert("Export ไม่สำเร็จ: " + String((e as any)?.message || e).slice(0, 160)) }
  }

  // ── building blocks ───────────────────────────────────────────────────────────────────
  const Panel = ({ title, cap, right, children, className = "" }: any) => (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[13.5px] font-bold text-gray-900">{title}</h2>
          {cap && <p className="text-[11.5px] text-gray-500 mt-0.5">{cap}</p>}
        </div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )

  // Horizontal bars — every row carries its own value label, so colour is never the only cue.
  const HBars = ({ rows, max, color = C.s1, unit = "", labelW = "w-28" }: {
    rows: { k: string; v: number; color?: string; label?: string; tag?: any }[]; max?: number; color?: string; unit?: string; labelW?: string
  }) => {
    const top = max ?? Math.max(1, ...rows.map(r => r.v))
    if (!rows.length) return <p className="text-sm text-gray-300">ไม่มีข้อมูล</p>
    return (
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.k} className="flex items-center gap-2">
            <span className={`text-[12px] text-gray-600 ${labelW} truncate shrink-0`} title={r.k}>{r.k}</span>
            <span className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
              <span className="block h-4 rounded-r" style={{ width: `${Math.max(2, (r.v / top) * 100)}%`, background: r.color || color }} />
            </span>
            <span className="text-[12px] font-bold text-gray-800 tabular-nums text-right shrink-0 min-w-[66px]">
              {r.label ?? `${fmt(Math.round(r.v))}${unit}`}
            </span>
            {r.tag}
          </div>
        ))}
      </div>
    )
  }

  const Chip = ({ kind, children }: { kind: "bad" | "warn" | "ok"; children: any }) => (
    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${kind === "bad" ? "bg-red-50 text-red-700" : kind === "warn" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{children}</span>
  )

  // Donut — hand-drawn arcs with a 2px surface gap between slices.
  const Donut = ({ rows, total }: { rows: [string, number][]; total: number }) => {
    const S = 168, R = 72, r0 = 44, cx = S / 2, cy = S / 2
    const pt = (a: number, rad: number) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]
    let a0 = -Math.PI / 2
    const paths = rows.map(([k, n], idx) => {
      const a1 = a0 + (n / total) * Math.PI * 2 - 0.02
      const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0)
      const large = a1 - a0 > Math.PI ? 1 : 0
      const d = `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`
      a0 = a1 + 0.02
      return <path key={k} d={d} fill={[C.s1, C.s2, C.s3, C.s4, C.s5][idx % 5]} stroke="#fff" strokeWidth={2}><title>{`${k} · ${n} ใบ (${Math.round((n / total) * 100)}%)`}</title></path>
    })
    return (
      <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} role="img" aria-label="สัดส่วน Incoterm">
        {paths}
        <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: 19, fontWeight: 700, fill: "#111827" }}>{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10, fill: "#9ca3af" }}>เอกสาร</text>
      </svg>
    )
  }

  const kpis = [
    { k: "เอกสารทั้งหมด", v: fmt(totalDocs), d: `${doneDocs.length} ปิดงานแล้ว · ${wipDocs.length} กำลังดำเนินการ`, c: "#111827" },
    { k: "น้ำหนักรวม", v: `${fmt(Math.round(totalKg))} kg`, d: totalDocs ? `เฉลี่ย ${fmt(Math.round(totalKg / totalDocs))} kg/ใบ` : "—", c: C.s5 },
    { k: "Est air (USD)", v: fmt(Math.round(est)), d: "จาก Master Rate ตาม port + น้ำหนัก", c: C.s1 },
    { k: "Actual air (USD)", v: fmt(Math.round(act)), d: `จาก ${doneDocs.length} ใบที่ LG ปิดงานแล้ว`, c: C.s2 },
    {
      k: "ส่วนต่าง Actual − Est", c: variance > 0 ? C.crit : C.good,
      v: variancePct == null ? "—" : `${variance >= 0 ? "▲" : "▼"} ${Math.abs(variancePct).toFixed(1)}%`,
      d: variancePct == null ? "ยังไม่มีใบที่ปิดงาน" : `${variance >= 0 ? "+" : "−"}${fmt(Math.abs(Math.round(variance)))} USD · เทียบ Est ของใบที่ปิดแล้ว`,
    },
  ]

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div>
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-gray-400 font-semibold">RM REQ AIR · {bu}</div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>DASHBOARD</h1>
        <p className="text-[12.5px] text-gray-500 mt-0.5">ใครคอขวด · ส่วนต่าง Est เทียบ Actual · ใบที่ค้างเกินกำหนด</p>
      </div>

      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {/* Branch filter — every metric below reflects the chosen branch (SCM vs Purchasing) */}
      <div className="flex gap-2 border-b border-gray-200">
        {([["ALL", "📁 ทั้งหมด"], ["SCM", "🧾 SCM"], ["PURCHASING", "🛒 จัดซื้อ"], ["SAMPLE", "🧪 Sample"], ["PPC", "🏭 PPC"]] as const).map(([v, label]) => {
          const n = v === "ALL" ? reqs.length : reqs.filter((r: any) => reqTypeOf(r) === v).length
          return (
            <button key={v} onClick={() => setTypeF(v)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${typeF === v ? "" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              style={typeF === v ? { color: MAROON, borderColor: MAROON } : undefined}>
              {label}<span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500">{n}</span>
            </button>
          )
        })}
      </div>

      {/* Searchable filters — narrow every metric + the table by Doc No / PO / จัดซื้อ */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-48"><MultiSelect label="Doc No…" options={docNos} value={docF} onChange={setDocF} /></div>
        <div className="w-48"><MultiSelect label="PO…" options={poNos} value={poF} onChange={setPoF} /></div>
        <div className="w-48"><MultiSelect label="จัดซื้อ…" options={reqOptions} value={reqF} onChange={setReqF} /></div>
        {(docF.length > 0 || poF.length > 0 || reqF.length > 0) && (
          <button onClick={() => { setDocF([]); setPoF([]); setReqF([]) }} className="text-xs text-gray-400 hover:text-red-600 underline">ล้าง filter</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{fReqs.length} เอกสาร</span>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : totalDocs === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">ยังไม่มีเอกสารใน BU นี้</div>
      ) : (
        <>
          {/* ── KPI row ─────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {kpis.map(c => (
              <div key={c.k} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[10.5px] uppercase tracking-wider text-gray-400 font-semibold">{c.k}</div>
                <div className="text-[25px] font-bold leading-tight mt-1 tabular-nums" style={{ color: c.c }}>{c.v}</div>
                <div className="text-[11.5px] text-gray-500 mt-0.5">{c.d}</div>
              </div>
            ))}
          </div>

          {/* ── รอบเวลาต่อคน · ปริมาณงานต่อคน ───────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-3">
            <Panel
              title="รอบเวลาเฉลี่ยต่อคน (เปิดเอกสาร → ปิดงาน)"
              cap={`นับเฉพาะใบที่ปิดงานแล้ว · ค่าเฉลี่ยรวม ${avgAll ? avgAll.toFixed(1) : "—"} วัน`}
              right={turnRows.some(o => (o.avg || 0) > avgAll) ? <Chip kind="bad">● ช้ากว่าค่าเฉลี่ย {turnRows.filter(o => (o.avg || 0) > avgAll).length} คน</Chip> : null}>
              <HBars
                rows={turnRows.map(o => ({
                  k: o.k, v: o.avg || 0, color: (o.avg || 0) > avgAll ? C.crit : C.s1,
                  label: `${(o.avg || 0).toFixed(1)} วัน`,
                  tag: (o.avg || 0) > avgAll ? <Chip kind="bad">ช้า</Chip> : null,
                }))} />
              <p className="text-[11px] text-gray-400 mt-3">* ระบบยังไม่เก็บเวลาแยกรายขั้น — ตัวเลขนี้คือเวลาทั้งใบ ตั้งแต่เปิดจนถึง LG ปิดงาน</p>
            </Panel>

            <Panel title="ปริมาณงานต่อคน" cap="จำนวนเอกสารที่รับผิดชอบในช่วงนี้ (แยกจากเวลา เพื่อไม่ให้สองสเกลปนกัน)">
              <HBars rows={workRows.map(o => ({ k: o.k, v: o.docs, label: `${o.docs} ใบ` }))} color={C.seq[2]} />
            </Panel>
          </div>

          {/* ── Est vs Actual รายเดือน · ค้างอยู่ขั้นไหน ─────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-3">
            <Panel className="lg:col-span-2" title="Est เทียบ Actual รายเดือน" cap="หน่วย USD · แท่งคู่ต่อเดือน (สเกลเดียว)"
              right={
                <div className="flex gap-3 text-[11.5px] text-gray-500">
                  <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: C.s1 }} />Est air</span>
                  <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: C.s2 }} />Actual air</span>
                </div>
              }>
              {monthly.length === 0 ? <p className="text-sm text-gray-300">ไม่มีข้อมูล</p> : (
                <div className="flex items-end gap-5 h-52 overflow-x-auto pb-1">
                  {monthly.map(([m, v], idx) => (
                    <div key={m} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 66 }}>
                      {idx === monthly.length - 1 && (
                        <span className="text-[10px] font-semibold text-gray-500 tabular-nums">{(v.est / 1000).toFixed(1)}k / {(v.act / 1000).toFixed(1)}k</span>
                      )}
                      <div className="flex items-end gap-1.5 h-36">
                        <div className="w-5 rounded-t" title={`Est ${fmt(Math.round(v.est))} USD`} style={{ height: `${(v.est / maxMonth) * 100}%`, minHeight: 3, background: C.s1 }} />
                        <div className="w-5 rounded-t" title={`Actual ${fmt(Math.round(v.act))} USD`} style={{ height: `${(v.act / maxMonth) * 100}%`, minHeight: v.act > 0 ? 3 : 0, background: C.s2 }} />
                      </div>
                      <span className="text-[10px] text-gray-400">{m.slice(2)}</span>
                      <span className="text-[10px] font-medium" style={{ color: C.s5 }}>{v.docs} ใบ</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="ค้างอยู่ขั้นไหน" cap={`เอกสารที่ยังไม่ปิดงาน ${wipDocs.length} ใบ`}>
              <HBars rows={stageRows.map(([k, n], i) => ({ k, v: n, color: C.seq[Math.min(i, C.seq.length - 1)], label: `${n} ใบ` }))} labelW="w-32" />
            </Panel>
          </div>

          {/* ── Forwarder · Incoterm ────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-3">
            <Panel title="ค่าขนส่งจริงต่อกิโล แยกตาม Forwarder" cap="THB/kg เฉลี่ยจากใบที่ปิดงานแล้ว · ตัวเลขในวงเล็บ = ส่วนต่างจาก Est">
              <HBars
                color={C.s3}
                rows={fwdRows.map(f => ({
                  k: `${f.k} (${f.docs})`, v: f.rate, label: f.rate.toFixed(1),
                  tag: <span className="text-[11px] font-semibold tabular-nums" style={{ color: f.diff > 0 ? C.crit : C.good }}>({f.diff > 0 ? "+" : ""}{f.diff.toFixed(1)})</span>,
                }))} />
            </Panel>

            <Panel title="สัดส่วน Incoterm" cap="กระทบว่าต้องบวก origin cost (EXW/FCA) หรือไม่">
              {incTotal === 0 ? <p className="text-sm text-gray-300">ไม่มีข้อมูล</p> : (
                <div className="flex gap-5 items-center flex-wrap">
                  <Donut rows={incRows as [string, number][]} total={incTotal} />
                  <div className="flex flex-col gap-2 text-[12px] text-gray-600">
                    {incRows.map(([k, n], i) => (
                      <span key={k} className="flex items-center gap-2">
                        <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: [C.s1, C.s2, C.s3, C.s4, C.s5][i % 5] }} />
                        {k} <b className="tabular-nums">{n}</b>
                        <span className="text-gray-400">({Math.round((n / incTotal) * 100)}%)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* ── ใบที่ต้องตามด่วน · เหตุผลที่ถูกตีกลับ ──────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-3">
            <Panel className="lg:col-span-2" title="ใบที่ต้องตามด่วน" cap={`ค้างเกิน ${AGE_LIMIT} วัน · ถูกตีกลับ ≥ 3 ครั้ง · หรือ FWD ยังไม่ตอบเกิน 3 วัน`}>
              {exceptions.length === 0 ? <p className="text-sm text-gray-300">ไม่มีใบที่เกินเกณฑ์ 🎉</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-[10.5px] uppercase tracking-wide text-gray-400">
                        <th className="text-left font-semibold px-2 py-1.5">เอกสาร</th>
                        <th className="text-left font-semibold px-2 py-1.5">ติดอยู่ที่</th>
                        <th className="text-left font-semibold px-2 py-1.5">ผู้รับผิดชอบ</th>
                        <th className="text-right font-semibold px-2 py-1.5">ค้าง</th>
                        <th className="text-left font-semibold px-2 py-1.5">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exceptions.map(({ r, age, rev, waitFwd }) => (
                        <tr key={r.id} className="border-t border-gray-100">
                          <td className="px-2 py-1.5 font-semibold text-gray-800">{r.documentNo}</td>
                          <td className="px-2 py-1.5 text-gray-600">{STATUS_LABEL[r.status] || r.status}</td>
                          <td className="px-2 py-1.5 text-gray-500">{ownerOf(r)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{age} วัน</td>
                          <td className="px-2 py-1.5">
                            {rev >= 3 ? <Chip kind="bad">▲ ตีกลับ {rev} ครั้ง</Chip>
                              : waitFwd != null && waitFwd > 3 ? <Chip kind="warn">● FWD ไม่ตอบ {waitFwd} วัน</Chip>
                                : <Chip kind="warn">● เกินเกณฑ์ {age - AGE_LIMIT} วัน</Chip>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="เหตุผลที่ถูกตีกลับ" cap={`ตีกลับรวม ${totalRevises} ครั้ง · แสดงเหตุผลล่าสุดของแต่ละใบ`}>
              <HBars rows={reasonRows.map(([k, n]) => ({ k, v: n, label: `${n} ใบ` }))} color={C.s5} labelW="w-36" />
            </Panel>
          </div>

          {/* ── เกินงบ (Actual > Est) ───────────────────────────────────────────── */}
          {(overBrand.length > 0 || overVendor.length > 0) && (() => {
            const OverList = ({ title, rows }: { title: string; rows: { name: string; est: number; act: number; diff: number }[] }) => (
              <div className="flex-1 min-w-[260px]">
                <p className="text-[11px] font-semibold text-gray-500 uppercase mb-2">{title}</p>
                {rows.length === 0 ? <p className="text-sm text-gray-300">ไม่มีที่เกินงบ 🎉</p> : (
                  <div className="space-y-1.5">
                    {rows.map(x => {
                      const pct = x.est > 0 ? (x.diff / x.est) * 100 : 0
                      return (
                        <div key={x.name} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                          <span className="text-sm text-gray-800 truncate" title={x.name}>{x.name}</span>
                          <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full shrink-0 ${pct >= 15 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>+${fmt(Math.round(x.diff))} (+{pct.toFixed(0)}%)</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
            return (
              <Panel title="⚠ เกินงบ (Actual > Est) — เจาะตามแบรนด์ / ผู้ขาย"
                cap="Actual ต่อเอกสารถูกกระจายเข้าแต่ละบรรทัดตามสัดส่วน Est · นับเฉพาะเอกสารที่กรอก Actual แล้ว"
                right={<span className="text-xs font-bold tabular-nums" style={{ color: C.crit }}>รวม +${fmt(Math.round(overTotal))}</span>}>
                <div className="flex gap-6 flex-wrap">
                  <OverList title="🏷️ ตามแบรนด์ (Brand)" rows={overBrand} />
                  <OverList title="🏭 ตามผู้ขาย (Vendor)" rows={overVendor} />
                </div>
              </Panel>
            )
          })()}

          {/* ── Top by cost ─────────────────────────────────────────────────────── */}
          <div className="grid md:grid-cols-3 gap-3">
            {([["Top brand — Est air (USD)", topBrand, C.s1], ["Top supplier — Est air (USD)", topVendor, C.s2], ["Top country — Est air (USD)", topCountry, C.s3]] as const).map(([title, rows, color]) => (
              <Panel key={title as string} title={title}>
                <HBars rows={(rows as [string, number][]).map(([k, v]) => ({ k, v }))} color={color as string} />
              </Panel>
            ))}
          </div>

          {/* ── Data table — every field entered by SCM / จัดซื้อ / LG ───────────── */}
          <Panel title={`ตารางข้อมูลทั้งหมด (SCM · จัดซื้อ · LG) — ${fReqs.length} เอกสาร`}
            right={<button onClick={exportTable} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50">📊 Export Excel</button>}>
            <div className="overflow-x-auto">
              <table className="text-xs whitespace-nowrap min-w-[1500px] w-full">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>{TABLE_COLS.map(h => <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fReqs.map((r: any) => {
                    const its = r.items || []
                    const d0 = its.find((i: any) => i.airFreightCost != null) || its[0] || {}
                    const e = estOf(r)
                    const po = [...new Set(its.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-semibold text-gray-800">{r.documentNo}</td>
                        <td className="px-2 py-1.5">{r.bu}</td>
                        <td className="px-2 py-1.5">{reqTypeOf(r) === "PURCHASING" ? "จัดซื้อ" : reqTypeOf(r) === "SAMPLE" ? "Sample" : "SCM"}</td>
                        <td className="px-2 py-1.5">{displayOf(r) || "-"}</td>
                        <td className="px-2 py-1.5" title={po}>{po || "-"}</td>
                        <td className="px-2 py-1.5">{d0.country || "-"}</td>
                        <td className="px-2 py-1.5">{d0.port || d0.seaPort || "-"}</td>
                        <td className="px-2 py-1.5">{d0.incoterm || "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{d0.weight != null ? fmt(d0.weight) : "-"}</td>
                        <td className="px-2 py-1.5">{r.factory || d0.factory || "-"}</td>
                        <td className="px-2 py-1.5">{dstr(d0.etc)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: C.s1 }}>{e ? fmt(Math.round(e)) : "-"}</td>
                        <td className="px-2 py-1.5">{r.mawbNo || "-"}</td>
                        <td className="px-2 py-1.5">{r.hawbNo || "-"}</td>
                        <td className="px-2 py-1.5">{dstr(r.flightEtd)}</td>
                        <td className="px-2 py-1.5">{dstr(r.flightEta)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.preCost != null ? fmt(r.preCost) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: C.s2 }}>{r.actualAir != null ? fmt(r.actualAir) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.localChargeTh != null ? fmt(r.localChargeTh) : "-"}</td>
                        <td className="px-2 py-1.5">{dstr(r.cfmInHouseDate)}</td>
                        <td className="px-2 py-1.5">{STATUS_LABEL[r.status] || r.status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
