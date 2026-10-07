"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { BUS, STATUS_LABEL, fmt } from "../_StageWork"
import { MultiSelect } from "@/components/ui/multi-select"
import { buildRequesters } from "@/lib/pull-requesters"
import { pullReqType } from "@/lib/pull-reqtype"

// ── Control-tower theme ────────────────────────────────────────────────────────────────────
// The wall display is two surfaces, not one: the PAGE (the backdrop + its headings) can be dark,
// cream or light, while the CHART PANELS are always a light card. Charts stay readable whatever
// backdrop is chosen, and one set of series colours works everywhere. The choice is remembered
// per browser. Colours are fixed slots assigned in order and never cycled; every bar and slice
// also carries its own number, so colour is never the only cue.
const D = {
  pageBg: "#eef0f4", pageText: "#111827", pageMut: "#6b7280",            // the backdrop behind the panels
  card: "#ffffff", card2: "#f4f5f8", line: "#e4e7ec", text: "#111827", mut: "#6b7280", // inside every panel
}
// One series set — the panels are light under every theme, so these never need a dark variant.
const C = {
  s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", s4: "#eda100", s5: "#4a3aa7", good: "#008300", crit: "#e34948",
  // every funnel bar prints its count in white, so each step stays dark enough to read on
  funnel: ["#104281", "#1c5cab", "#2a78d6", "#b45309", "#c2491d", "#4a3aa7"],
}
const THB = 32.5
const DAY = 86400000
const K = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${Math.round(n)}`)

// Workflow order used by the funnel; anything unknown falls in at the end.
const FUNNEL_ORDER = ["PENDING_PURCHASING", "PC_REVISE", "PENDING_SCM_DECISION", "PENDING_APPROVAL", "PENDING_LOGISTICS", "PENDING_LG_RATE", "APPROVED"]
const FUNNEL_LABEL: Record<string, string> = {
  PENDING_PURCHASING: "รอจัดซื้อกรอก", PC_REVISE: "ตีกลับให้แก้", PENDING_SCM_DECISION: "รอ SCM ตัดสิน",
  PENDING_APPROVAL: "รออนุมัติ", PENDING_LOGISTICS: "รอ LG ปิดงาน", PENDING_LG_RATE: "รอเติม Air rate", APPROVED: "อนุมัติแล้ว",
}

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
  // or "doungjai", so every spelling folds onto the name the "จัดซื้อ" filter already uses.
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
  const est = items.reduce((s, i) => s + (Number(i.airFreightCost) || 0), 0)   // USD
  const act = fReqs.reduce((s, r) => s + (Number(r.actualAir) || 0), 0)        // USD
  const doneDocs = fReqs.filter(isDone)
  const wipDocs = fReqs.filter((r: any) => !isDone(r))
  const estDone = doneDocs.reduce((s, r) => s + estOf(r), 0)
  const variance = act - estDone
  const variancePct = estDone > 0 && act > 0 ? (variance / estDone) * 100 : null

  // ── Workload by buyer ────────────────────────────────────────────────────────────────────
  const byOwner: Record<string, number> = {}
  fReqs.forEach((r: any) => { const o = ownerOf(r); byOwner[o] = (byOwner[o] || 0) + 1 })
  const workRows = Object.entries(byOwner).map(([k, docs]) => ({ k, docs })).sort((a, b) => b.docs - a.docs).slice(0, 7)

  // ── Monthly: totals (USD) + unit rate (USD/kg) ───────────────────────────────────────────
  const byMonth: Record<string, { docs: number; est: number; act: number; kg: number; kgDone: number }> = {}
  fReqs.forEach((r: any) => {
    const d = new Date(r.createdAt); if (isNaN(d.getTime())) return
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const g = (byMonth[k] ||= { docs: 0, est: 0, act: 0, kg: 0, kgDone: 0 })
    g.docs++; g.est += estOf(r); g.act += Number(r.actualAir) || 0
    g.kg += kgOf(r); if (isDone(r)) g.kgDone += kgOf(r)
  })
  const monthly = Object.entries(byMonth).sort().slice(-10)
  const maxMonth = Math.max(1, ...monthly.map(([, v]) => Math.max(v.est, v.act)))
  const rateRows = monthly.map(([m, v]) => ({
    m, est: v.kg ? v.est / v.kg : 0, act: v.kgDone ? v.act / v.kgDone : 0,
  }))

  // ── Pending funnel ───────────────────────────────────────────────────────────────────────
  const stageCount: Record<string, number> = {}
  wipDocs.forEach((r: any) => { stageCount[r.status] = (stageCount[r.status] || 0) + 1 })
  const funnelRows = [
    ...FUNNEL_ORDER.filter(s => stageCount[s]).map(s => ({ k: FUNNEL_LABEL[s] || STATUS_LABEL[s] || s, n: stageCount[s] })),
    ...Object.keys(stageCount).filter(s => !FUNNEL_ORDER.includes(s)).map(s => ({ k: STATUS_LABEL[s] || s, n: stageCount[s] })),
  ]

  // ── Forwarder performance (THB/kg) ───────────────────────────────────────────────────────
  const byFwd: Record<string, { act: number; est: number; kg: number; docs: number }> = {}
  doneDocs.forEach((r: any) => {
    const name = r.fwdName || r.preCostFwd; const kg = kgOf(r)
    if (!name || !kg || r.actualAir == null) return
    const g = (byFwd[name] ||= { act: 0, est: 0, kg: 0, docs: 0 })
    g.act += Number(r.actualAir) || 0; g.est += estOf(r); g.kg += kg; g.docs++
  })
  const fwdRows = Object.entries(byFwd).map(([k, v]) => ({
    k, docs: v.docs, rate: (v.act * THB) / v.kg, diff: ((v.act - v.est) * THB) / v.kg,
  })).sort((a, b) => b.rate - a.rate).slice(0, 5)

  // ── Incoterm: how many docs, and what a kilo costs under each term ──────────────────────
  const incAgg: Record<string, { n: number; est: number; kg: number }> = {}
  fReqs.forEach((r: any) => {
    const t = ((r.items || []).find((i: any) => i.incoterm) || {}).incoterm; if (!t) return
    const g = (incAgg[t] ||= { n: 0, est: 0, kg: 0 })
    g.n++; g.est += estOf(r); g.kg += kgOf(r)
  })
  const incRows = Object.entries(incAgg).sort((a, b) => b[1].n - a[1].n).slice(0, 5)
  const incTotal = incRows.reduce((s, [, v]) => s + v.n, 0)

  // ── Route cost: what a kilo costs out of each origin country (per material line, not per doc) ──
  const byCountry: Record<string, { est: number; kg: number; n: number }> = {}
  items.forEach((i: any) => {
    const k = i.country; if (!k) return
    const g = (byCountry[k] ||= { est: 0, kg: 0, n: 0 })
    g.est += Number(i.airFreightCost) || 0; g.kg += Number(i.weight) || 0; g.n++
  })
  const countryCost = Object.entries(byCountry).map(([k, v]) => ({ k, v: v.kg ? v.est / v.kg : 0, n: v.n }))
    .filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 6)

  // ── Exceptions ───────────────────────────────────────────────────────────────────────────
  const AGE_LIMIT = 7
  const exceptions = wipDocs.map((r: any) => {
    const age = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / DAY)
    const rev = Number(r.reviseCount) || 0
    const waitFwd = r.fwdSentAt && !r.fwdImportedAt ? Math.floor((Date.now() - new Date(r.fwdSentAt).getTime()) / DAY) : null
    return { r, age, rev, waitFwd }
  }).filter(x => x.age > AGE_LIMIT || x.rev >= 3 || (x.waitFwd != null && x.waitFwd > 3))
    .sort((a, b) => (b.rev * 10 + b.age) - (a.rev * 10 + a.age)).slice(0, 8)

  // ── Reasons for revision ─────────────────────────────────────────────────────────────────
  const reasonCount: Record<string, number> = {}
  fReqs.forEach((r: any) => { const t = String(r.lastReturnReason || "").trim(); if (t && (Number(r.reviseCount) || 0) > 0) reasonCount[t] = (reasonCount[t] || 0) + 1 })
  const reasonRows = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const totalRevises = fReqs.reduce((s, r) => s + (Number(r.reviseCount) || 0), 0)

  // ── Export (unchanged data contract) ─────────────────────────────────────────────────────
  const dstr = (v: any) => (v ? new Date(v).toLocaleDateString("en-GB") : "-")
  const TABLE_COLS = ["Doc No", "BU", "สาย", "จัดซื้อ", "PO", "Country", "Port", "Incoterm", "Wt(kg)", "Factory", "ETC", "Est USD", "MAWB", "HAWB", "ETD", "ETA", "Pre cost", "Actual", "Local", "CFM in-house", "Status"]
  const tableRow = (r: any): any[] => {
    const its = r.items || []
    const d0 = its.find((i: any) => i.airFreightCost != null) || its[0] || {}
    const po = [...new Set(its.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
    return [r.documentNo, r.bu, reqTypeOf(r) === "PURCHASING" ? "จัดซื้อ" : reqTypeOf(r) === "SAMPLE" ? "Sample" : "SCM", ownerOf(r), po,
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

  // ── building blocks ─────────────────────────────────────────────────────────────────────
  const Card = ({ title, cap, right, children }: any) => (
    <div className="rounded-xl p-3.5" style={{ background: D.card, border: `1px solid ${D.line}` }}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2.5">
        <div>
          <h3 className="text-[13px] font-bold" style={{ color: D.text }}>{title}</h3>
          {cap && <p className="text-[10.5px] mt-0.5" style={{ color: D.mut }}>{cap}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
  const Empty = () => <p className="text-[12px] py-4 text-center" style={{ color: D.mut }}>ไม่มีข้อมูล</p>

  // Horizontal bars with the value printed at the end of every row.
  const HBars = ({ rows, color = C.s1, labelW = 86 }: { rows: { k: string; v: number; label: string; color?: string; tag?: any }[]; color?: string; labelW?: number }) => {
    const top = Math.max(1, ...rows.map(r => r.v))
    if (!rows.length) return <Empty />
    return (
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.k} className="flex items-center gap-2">
            <span className="text-[11.5px] truncate shrink-0" style={{ width: labelW, color: D.mut }} title={r.k}>{r.k}</span>
            <span className="flex-1 h-[14px] rounded" style={{ background: D.card2 }}>
              <span className="block h-[14px] rounded" style={{ width: `${Math.max(3, (r.v / top) * 100)}%`, background: r.color || color }} />
            </span>
            <span className="text-[11.5px] font-bold tabular-nums text-right shrink-0" style={{ minWidth: 56, color: D.text }}>{r.label}</span>
            {r.tag}
          </div>
        ))}
      </div>
    )
  }

  // Grouped columns — Est vs Actual per month, one shared scale.
  const Columns = () => {
    if (!monthly.length) return <Empty />
    const W = 460, H = 170, P = { t: 12, r: 8, b: 24, l: 34 }
    const iw = W - P.l - P.r, ih = H - P.t - P.b
    const bw = iw / monthly.length, w = Math.min(14, (bw - 10) / 2)
    const y = (v: number) => P.t + ih - (v / maxMonth) * ih
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Est เทียบ Actual รายเดือน">
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(maxMonth * t)} y2={y(maxMonth * t)} stroke={D.line} strokeWidth={1} />
            <text x={P.l - 6} y={y(maxMonth * t) + 3} textAnchor="end" style={{ fontSize: 8.5, fill: D.mut }}>{K(maxMonth * t)}</text>
          </g>
        ))}
        {monthly.map(([m, v], i) => {
          const x0 = P.l + i * bw + (bw - w * 2 - 3) / 2
          return (
            <g key={m}>
              <rect x={x0} y={y(v.est)} width={w} height={Math.max(1, P.t + ih - y(v.est))} rx={2} fill={C.s1}><title>{`${m} · Est ${fmt(Math.round(v.est))} USD`}</title></rect>
              <rect x={x0 + w + 3} y={y(v.act)} width={w} height={Math.max(v.act > 0 ? 1 : 0, P.t + ih - y(v.act))} rx={2} fill={C.s2}><title>{`${m} · Actual ${fmt(Math.round(v.act))} USD`}</title></rect>
              <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" style={{ fontSize: 8.5, fill: D.mut }}>{m.slice(5)}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  // Lines — unit price per kilo, so it is NOT the same picture as the totals above.
  const Lines = () => {
    if (rateRows.length < 2) return <Empty />
    const W = 460, H = 160, P = { t: 14, r: 34, b: 22, l: 34 }
    const iw = W - P.l - P.r, ih = H - P.t - P.b
    const max = Math.max(0.1, ...rateRows.flatMap(r => [r.est, r.act]))
    const x = (i: number) => P.l + (i / (rateRows.length - 1)) * iw
    const y = (v: number) => P.t + ih - (v / max) * ih
    const path = (key: "est" | "act") => rateRows.map((r, i) => `${i ? "L" : "M"}${x(i)} ${y(r[key])}`).join(" ")
    const last = rateRows[rateRows.length - 1]
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="ราคาต่อกิโลรายเดือน">
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} stroke={D.line} strokeWidth={1} />
            <text x={P.l - 6} y={y(max * t) + 3} textAnchor="end" style={{ fontSize: 8.5, fill: D.mut }}>{(max * t).toFixed(1)}</text>
          </g>
        ))}
        <path d={path("est")} fill="none" stroke={C.s1} strokeWidth={2} />
        <path d={path("act")} fill="none" stroke={C.s2} strokeWidth={2} />
        {rateRows.map((r, i) => (
          <g key={r.m}>
            <circle cx={x(i)} cy={y(r.est)} r={3} fill={C.s1}><title>{`${r.m} · Est ${r.est.toFixed(2)} USD/kg`}</title></circle>
            {r.act > 0 && <circle cx={x(i)} cy={y(r.act)} r={3} fill={C.s2}><title>{`${r.m} · Actual ${r.act.toFixed(2)} USD/kg`}</title></circle>}
            <text x={x(i)} y={H - 7} textAnchor="middle" style={{ fontSize: 8.5, fill: D.mut }}>{r.m.slice(5)}</text>
          </g>
        ))}
        <text x={W - P.r + 4} y={y(last.est) + 3} style={{ fontSize: 9, fill: C.s1, fontWeight: 700 }}>{last.est.toFixed(1)}</text>
        {last.act > 0 && <text x={W - P.r + 4} y={y(last.act) + 3} style={{ fontSize: 9, fill: C.s2, fontWeight: 700 }}>{last.act.toFixed(1)}</text>}
      </svg>
    )
  }

  // Backlog by stage. A funnel implies each step is a subset of the one above it, which these
  // stages are not — they are a snapshot of where open docs sit right now. One share bar for the
  // composition, then a plain ranked bar per stage, each with its own count and percentage.
  const Backlog = () => {
    const total = funnelRows.reduce((s, f) => s + f.n, 0)
    if (!total) return <Empty />
    const ranked = [...funnelRows].sort((a, b) => b.n - a.n)
    const max = ranked[0].n
    return (
      <div className="space-y-3">
        <div className="flex h-5 rounded overflow-hidden" style={{ border: `1px solid ${D.line}` }}>
          {ranked.map((f, i) => (
            <span key={f.k} style={{ width: `${(f.n / total) * 100}%`, background: C.funnel[i % C.funnel.length] }} title={`${f.k} · ${f.n} ใบ (${Math.round((f.n / total) * 100)}%)`} />
          ))}
        </div>
        <div className="space-y-1.5">
          {ranked.map((f, i) => (
            <div key={f.k} className="flex items-center gap-2">
              <span className="text-[11.5px] truncate shrink-0" style={{ width: 104, color: D.mut }} title={f.k}>{f.k}</span>
              <span className="flex-1 h-[14px] rounded" style={{ background: D.card2 }}>
                <span className="block h-[14px] rounded" style={{ width: `${Math.max(3, (f.n / max) * 100)}%`, background: C.funnel[i % C.funnel.length] }} />
              </span>
              <span className="text-[11.5px] font-bold tabular-nums text-right shrink-0" style={{ minWidth: 38, color: D.text }}>{f.n} ใบ</span>
              <span className="text-[10.5px] tabular-nums text-right shrink-0" style={{ minWidth: 34, color: D.mut }}>{Math.round((f.n / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Donut — incoterm mix; every slice is labelled in the legend with its count and share.
  const Donut = () => {
    if (!incTotal) return <Empty />
    const S = 150, R = 66, r0 = 40, cx = S / 2, cy = S / 2
    const pt = (a: number, rad: number) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]
    let a0 = -Math.PI / 2
    return (
      <div className="flex gap-4 items-center flex-wrap">
        <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} role="img" aria-label="สัดส่วน Incoterm">
          {incRows.map(([k, v], idx) => {
            const a1 = a0 + (v.n / incTotal) * Math.PI * 2 - 0.02
            const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0)
            const large = a1 - a0 > Math.PI ? 1 : 0
            const d = `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`
            a0 = a1 + 0.02
            return <path key={k} d={d} fill={[C.s1, C.s2, C.s3, C.s4, C.s5][idx % 5]} stroke={D.card} strokeWidth={2}><title>{`${k} · ${v.n} ใบ`}</title></path>
          })}
          <text x={cx} y={cy - 1} textAnchor="middle" style={{ fontSize: 17, fontWeight: 700, fill: D.text }}>{incTotal}</text>
          <text x={cx} y={cy + 13} textAnchor="middle" style={{ fontSize: 9, fill: D.mut }}>เอกสาร</text>
        </svg>
        <div className="flex flex-col gap-1.5">
          {incRows.map(([k, v], i) => (
            <span key={k} className="flex items-center gap-2 text-[11.5px]" style={{ color: D.mut }}>
              <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: [C.s1, C.s2, C.s3, C.s4, C.s5][i % 5] }} />
              {k} <b style={{ color: D.text }}>{v.n}</b> ({Math.round((v.n / incTotal) * 100)}%)
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Vertical bars — top reasons a doc got sent back.
  const VBars = () => {
    if (!reasonRows.length) return <Empty />
    const W = 300, H = 150, P = { t: 14, r: 6, b: 34, l: 26 }
    const iw = W - P.l - P.r, ih = H - P.t - P.b
    const max = Math.max(...reasonRows.map(([, n]) => n))
    const bw = iw / reasonRows.length
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="เหตุผลที่ถูกตีกลับ">
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={P.t + ih - ih * t} y2={P.t + ih - ih * t} stroke={D.line} strokeWidth={1} />
            <text x={P.l - 5} y={P.t + ih - ih * t + 3} textAnchor="end" style={{ fontSize: 8.5, fill: D.mut }}>{Math.round(max * t)}</text>
          </g>
        ))}
        {reasonRows.map(([k, n], i) => {
          const h = (n / max) * ih, x0 = P.l + i * bw + bw * 0.22
          return (
            <g key={k}>
              <rect x={x0} y={P.t + ih - h} width={bw * 0.56} height={Math.max(2, h)} rx={3} fill={C.s5}><title>{`${k} · ${n} ใบ`}</title></rect>
              <text x={x0 + bw * 0.28} y={P.t + ih - h - 4} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: D.text }}>{n}</text>
              <text x={x0 + bw * 0.28} y={H - 10} textAnchor="middle" style={{ fontSize: 8, fill: D.mut }}>{k.length > 10 ? k.slice(0, 9) + "…" : k}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  const SectionTitle = ({ children }: any) => (
    <h2 className="text-[12.5px] font-bold uppercase tracking-wider mb-2" style={{ color: D.pageMut }}>{children}</h2>
  )
  const kpis = [
    { v: fmt(totalDocs), k: `${doneDocs.length} ปิดงาน · ${wipDocs.length} ค้าง`, c: D.text },
    { v: K(totalPullGarment), k: "Pull garment (ตัว)", c: C.s5 },
    { v: K(est), k: "Est freight (USD)", c: C.s1 },
    { v: K(act), k: "Actual freight (USD)", c: C.s2 },
    {
      v: variancePct == null ? "—" : `${variance >= 0 ? "+" : "−"}${Math.abs(variancePct).toFixed(1)}%`,
      k: "Air variance (Act − Est)", c: variance > 0 ? C.crit : C.good,
    },
  ]

  const period = monthly.length ? `${monthly[0][0]} → ${monthly[monthly.length - 1][0]}` : "—"

  return (
    // A panel inside the app shell rather than a full-bleed wash — the white top bar and the maroon
    // sidebar stay as they are, and the dark surface reads as deliberate instead of clashing.
    <div className="rounded-2xl p-4 md:p-5 min-h-[calc(100vh-110px)]" style={{ background: D.pageBg, color: D.pageText, border: `1px solid ${D.line}` }}>
      <div className="max-w-[1500px] mx-auto space-y-3">
        {/* header — framed like every other panel, with a tinted strip so the title reads as a banner */}
        <div className="rounded-xl px-4 py-3.5 flex items-end justify-between gap-3 flex-wrap"
          style={{ background: `linear-gradient(90deg, ${D.card} 0%, ${D.card2} 100%)`, border: `1px solid ${D.line}`, borderLeft: `4px solid ${C.s1}` }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-[10px] uppercase tracking-[0.18em]" style={{ color: D.mut }}>
              Nan Yang Textile · RM REQ AIR
              <span className="px-2 py-0.5 rounded-full tracking-normal normal-case text-[10.5px]" style={{ background: D.card2, border: `1px solid ${D.line}` }}>{period}</span>
            </div>
            <h1 className="text-[22px] font-bold leading-[1.45] py-0.5" style={{ color: D.text }}>✈ {bu} Air Request — Team Analysis Dashboard</h1>
          </div>
          <div className="flex gap-1.5">{BUS.map(b => (
            <button key={b} onClick={() => setBu(b)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={bu === b ? { background: C.s1, color: "#fff" } : { background: D.card, color: D.mut, border: `1px solid ${D.line}` }}>{b}</button>
          ))}</div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {kpis.map(c => (
            <div key={c.k} className="rounded-xl px-4 py-3" style={{ background: D.card, border: `1px solid ${D.line}` }}>
              <div className="text-[26px] font-bold leading-none tabular-nums" style={{ color: c.c }}>{c.v}</div>
              <div className="text-[10.5px] mt-1.5" style={{ color: D.mut }}>{c.k}</div>
            </div>
          ))}
        </div>

        {/* filters */}
        <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2" style={{ background: D.card, border: `1px solid ${D.line}` }}>
          {([["ALL", "ทั้งหมด"], ["SCM", "SCM"], ["PURCHASING", "จัดซื้อ"], ["SAMPLE", "Sample"], ["PPC", "PPC"]] as const).map(([v, label]) => {
            const n = v === "ALL" ? reqs.length : reqs.filter((r: any) => reqTypeOf(r) === v).length
            return (
              <button key={v} onClick={() => setTypeF(v)} className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold"
                style={typeF === v ? { background: C.s1, color: "#fff" } : { background: D.card2, color: D.mut }}>
                {label} <span className="opacity-70">({n})</span>
              </button>
            )
          })}
          <div className="w-44"><MultiSelect label="Doc No…" options={docNos} value={docF} onChange={setDocF} /></div>
          <div className="w-44"><MultiSelect label="PO…" options={poNos} value={poF} onChange={setPoF} /></div>
          <div className="w-44"><MultiSelect label="จัดซื้อ…" options={reqOptions} value={reqF} onChange={setReqF} /></div>
          {(docF.length > 0 || poF.length > 0 || reqF.length > 0) && (
            <button onClick={() => { setDocF([]); setPoF([]); setReqF([]) }} className="text-[11px] underline" style={{ color: D.mut }}>ล้าง filter</button>
          )}
          <span className="text-[11px] ml-auto" style={{ color: D.mut }}>{fReqs.length} เอกสาร</span>
        </div>

        {loading ? <p className="text-sm" style={{ color: D.pageMut }}>Loading…</p> : totalDocs === 0 ? (
          <div className="rounded-xl p-12 text-center text-sm" style={{ background: D.card, border: `1px solid ${D.line}`, color: D.mut }}>ยังไม่มีเอกสารใน BU นี้</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-3 items-start">
            {/* ── Column 1 · ประสิทธิภาพทีม & คอขวด ─────────────────────────── */}
            <div className="space-y-3">
              <SectionTitle>Team Operational Efficiency &amp; Bottleneck</SectionTitle>
              <Card title="ปริมาณงานต่อคน" cap="จำนวนเอกสารที่รับผิดชอบในช่วงนี้">
                <HBars rows={workRows.map(o => ({ k: o.k, v: o.docs, label: `${o.docs} ใบ` }))} color={C.s1} />
              </Card>
              <Card title="ราคาต่อกิโลรายเดือน (USD/kg)" cap="เส้น Est เทียบ Actual — ดูว่าค่าขนส่งต่อหน่วยแพงขึ้นหรือถูกลง"
                right={
                  <div className="flex gap-2.5 text-[10.5px]" style={{ color: D.mut }}>
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm inline-block" style={{ background: C.s1 }} />Est</span>
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm inline-block" style={{ background: C.s2 }} />Actual</span>
                  </div>
                }>
                <Lines />
              </Card>
              <Card title="Supplier &amp; Route Performance" cap="ค่าขนส่งจริงต่อกิโล (THB/kg) · วงเล็บ = ส่วนต่างจาก Est">
                <HBars color={C.s3} rows={fwdRows.map(f => ({
                  k: `${f.k} (${f.docs})`, v: f.rate, label: f.rate.toFixed(1),
                  tag: <span className="text-[10.5px] font-bold tabular-nums" style={{ color: f.diff > 0 ? C.crit : C.good }}>({f.diff > 0 ? "+" : ""}{f.diff.toFixed(1)})</span>,
                }))} />
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${D.line}` }}>
                  <p className="text-[10.5px] mb-2" style={{ color: D.mut }}>ต้นทุน Est ต่อกิโล แยกตามประเทศต้นทาง (USD/kg)</p>
                  <HBars color={C.s4} labelW={78} rows={countryCost.map(x => ({ k: `${x.k} (${x.n})`, v: x.v, label: x.v.toFixed(2) }))} />
                </div>
              </Card>
            </div>

            {/* ── Column 2 · คุมต้นทุน & ส่วนต่าง ───────────────────────────── */}
            <div className="space-y-3">
              <SectionTitle>Cost Control &amp; Variance Analysis</SectionTitle>
              <Card title="Est เทียบ Actual รายเดือน (USD)" cap="ยอดรวมต่อเดือน · สเกลเดียวกันทั้งสองแท่ง"
                right={
                  <div className="flex gap-2.5 text-[10.5px]" style={{ color: D.mut }}>
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm inline-block" style={{ background: C.s1 }} />Est</span>
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm inline-block" style={{ background: C.s2 }} />Actual</span>
                  </div>
                }>
                <Columns />
              </Card>
              <Card title="Exception Handling" cap={`ค้างเกิน ${AGE_LIMIT} วัน · ตีกลับ ≥ 3 ครั้ง · FWD ไม่ตอบเกิน 3 วัน`}>
                {exceptions.length === 0 ? <p className="text-[12px] py-3 text-center" style={{ color: C.good }}>ไม่มีใบที่เกินเกณฑ์ 🎉</p> : (
                  <div className="space-y-1.5">
                    {exceptions.map(({ r, age, rev, waitFwd }) => {
                      const bad = rev >= 3
                      const txt = bad ? `ตีกลับ ${rev} ครั้ง` : waitFwd != null && waitFwd > 3 ? `FWD ไม่ตอบ ${waitFwd} วัน` : `${STATUS_LABEL[r.status] || r.status} (${age} วัน)`
                      return (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: D.card2 }}>
                          <span className="text-[11.5px] font-semibold truncate" style={{ color: D.text }}>{r.documentNo}</span>
                          <span className="text-[10px] truncate" style={{ color: D.mut }}>{ownerOf(r)}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: bad ? "rgba(230,103,103,.15)" : "rgba(201,133,0,.18)", color: bad ? C.crit : C.s4 }}>{txt}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Column 3 · คิวงาน & สาเหตุ ───────────────────────────────── */}
            <div className="space-y-3">
              <SectionTitle>Pending Queue &amp; Root Cause</SectionTitle>
              <Card title="Pending Requests Breakdown" cap={`เอกสารที่ยังไม่ปิดงาน ${wipDocs.length} ใบ แยกตามขั้น`}>
                <Backlog />
              </Card>
              <Card title="Incoterms Distribution" cap="กระทบว่าต้องบวก origin cost (EXW/FCA) หรือไม่">
                <Donut />
              </Card>
              <Card title="Top Reasons for Revision" cap={`ตีกลับรวม ${totalRevises} ครั้ง · เหตุผลล่าสุดของแต่ละใบ`}>
                <VBars />
              </Card>
            </div>
          </div>
        )}

        {/* full data table — kept, folded away so it never fights the wall view */}
        {totalDocs > 0 && (
          <details className="rounded-xl" style={{ background: D.card, border: `1px solid ${D.line}` }}>
            <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold select-none" style={{ color: D.text }}>
              ตารางข้อมูลทั้งหมด (SCM · จัดซื้อ · LG) — {fReqs.length} เอกสาร
            </summary>
            <div className="px-4 pb-4">
              <button onClick={exportTable} className="mb-3 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold" style={{ background: C.s3, color: "#fff" }}>📊 Export Excel</button>
              <div className="overflow-x-auto">
                <table className="text-[11px] whitespace-nowrap min-w-[1500px] w-full">
                  <thead>
                    <tr style={{ color: D.mut, borderBottom: `1px solid ${D.line}` }}>{TABLE_COLS.map(h => <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fReqs.map((r: any) => {
                      const its = r.items || []
                      const d0 = its.find((i: any) => i.airFreightCost != null) || its[0] || {}
                      const e = estOf(r)
                      const po = [...new Set(its.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
                      return (
                        <tr key={r.id} style={{ borderTop: `1px solid ${D.card2}`, color: D.mut }}>
                          <td className="px-2 py-1.5 font-semibold" style={{ color: D.text }}>{r.documentNo}</td>
                          <td className="px-2 py-1.5">{r.bu}</td>
                          <td className="px-2 py-1.5">{reqTypeOf(r) === "PURCHASING" ? "จัดซื้อ" : reqTypeOf(r) === "SAMPLE" ? "Sample" : "SCM"}</td>
                          <td className="px-2 py-1.5">{ownerOf(r)}</td>
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
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
