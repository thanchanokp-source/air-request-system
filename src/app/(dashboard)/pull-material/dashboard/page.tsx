"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { BUS, STATUS_LABEL, fmt } from "../_StageWork"
import { MultiSelect } from "@/components/ui/multi-select"
import { buildRequesters } from "@/lib/pull-requesters"
import { pullReqType, isSampleLike } from "@/lib/pull-reqtype"

// ── Theme ──────────────────────────────────────────────────────────────────────────────────
// Light backdrop, white panels. Series colours are fixed slots assigned in order and never
// cycled; every bar and slice also prints its own number, so colour is never the only cue.
const D = {
  pageBg: "#eceef2", pageText: "#0f172a", pageMut: "#6b7280",
  card: "#ffffff", card2: "#f5f6f9", line: "#e3e6ec", line2: "#eef0f4",
  text: "#0f172a", mut: "#6b7280", faint: "#9aa1ad",
}
const C = {
  s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", s4: "#eda100", s5: "#4a3aa7", good: "#008300", crit: "#e34948",
  seq: ["#104281", "#1c5cab", "#2a78d6", "#86b6ef", "#cde2fb"],
}
const SH = "0 1px 2px rgba(15,23,42,.05)"
const THB = 32.5
const DAY = 86400000
const K = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${Math.round(n)}`)
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
// "2026-09" → "Sep" (or "Sep 26" once the range crosses a year boundary)
const monLabel = (key: string, withYear: boolean) => {
  const [y, m] = key.split("-")
  return `${MON[Number(m) - 1] || m}${withYear ? ` ${y.slice(2)}` : ""}`
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
  const [statusF, setStatusF] = useState<string[]>([])
  const [supF, setSupF] = useState<string[]>([])
  const reqTypeOf = pullReqType

  const load = async () => { setLoading(true); try { const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json()); setReqs(d.requests || []) } finally { setLoading(false) } }
  useEffect(() => { load() }, [bu]) // eslint-disable-line

  const { options: reqOptions, displayOf } = useMemo(() => buildRequesters(reqs), [reqs])
  const docNos = useMemo(() => [...new Set(reqs.map((r: any) => r.documentNo).filter(Boolean))].sort(), [reqs])
  const poNos = useMemo(() => [...new Set(reqs.flatMap((r: any) => (r.items || []).map((i: any) => i.poNoDoc)).filter(Boolean))].sort(), [reqs])
  const statusOpts = useMemo(() => [...new Set(reqs.map((r: any) => STATUS_LABEL[r.status] || r.status).filter(Boolean))].sort(), [reqs])
  const supOpts = useMemo(() => [...new Set(reqs.flatMap((r: any) => (r.items || []).map((i: any) => i.vendorName)).filter(Boolean))].sort(), [reqs])

  // Every hook must run on every render — this early return has to stay BELOW them, otherwise the
  // first render (session still "loading") runs fewer hooks than the next one: React error #310.
  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>

  const fReqs = reqs.filter((r: any) => {
    if (typeF !== "ALL" && reqTypeOf(r) !== typeF) return false
    if (docF.length && !docF.includes(r.documentNo)) return false
    if (poF.length && !(r.items || []).some((i: any) => poF.includes(i.poNoDoc))) return false
    if (reqF.length && !reqF.includes(displayOf(r))) return false
    if (statusF.length && !statusF.includes(STATUS_LABEL[r.status] || r.status)) return false
    if (supF.length && !(r.items || []).some((i: any) => supF.includes(i.vendorName))) return false
    return true
  })
  const items = fReqs.flatMap((r: any) => r.items || [])
  const totalDocs = fReqs.length
  const estOf = (r: any) => (r.items || []).reduce((s: number, i: any) => s + (Number(i.airFreightCost) || 0), 0)
  const kgOf = (r: any) => (r.items || []).reduce((s: number, i: any) => s + (Number(i.weight) || 0), 0)
  const isDone = (r: any) => r.status === "COMPLETED" || r.actualAir != null

  // One person, one bar. The same human reaches us as "doungjai.p", "doungjai.p@nanyangtextile.com"
  // or "doungjai", so every spelling folds onto the name the Buyer filter already uses.
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

  const est = items.reduce((s, i) => s + (Number(i.airFreightCost) || 0), 0)   // USD
  const act = fReqs.reduce((s, r) => s + (Number(r.actualAir) || 0), 0)        // USD
  const doneDocs = fReqs.filter(isDone)
  const wipDocs = fReqs.filter((r: any) => !isDone(r))
  const estDone = doneDocs.reduce((s, r) => s + estOf(r), 0)
  const variance = act - estDone
  const variancePct = estDone > 0 && act > 0 ? (variance / estDone) * 100 : null

  // ── Row 1 · Est vs Actual by month + ship mode ─────────────────────────────────────────
  const byMonth: Record<string, { docs: number; est: number; act: number }> = {}
  fReqs.forEach((r: any) => {
    const d = new Date(r.createdAt); if (isNaN(d.getTime())) return
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const g = (byMonth[k] ||= { docs: 0, est: 0, act: 0 })
    g.docs++; g.est += estOf(r); g.act += Number(r.actualAir) || 0
  })
  const monthly = Object.entries(byMonth).sort().slice(-10)
  const maxMonth = Math.max(1, ...monthly.flatMap(([, v]) => [v.est, v.act]))
  const multiYear = new Set(monthly.map(([m]) => m.slice(0, 4))).size > 1

  const modeRows = [
    { k: "✈ Air", n: fReqs.filter((r: any) => r.shipMode === "AIR").length, c: C.s1 },
    { k: "🚢 Sea", n: fReqs.filter((r: any) => r.shipMode === "SEA").length, c: C.s3 },
    { k: "📦 Courier", n: fReqs.filter((r: any) => r.shipMode === "COURIER").length, c: C.s5 },
    { k: "Not confirmed", n: fReqs.filter((r: any) => !r.shipMode).length, c: C.s4 },
  ]
  const modeTotal = modeRows.reduce((s, m) => s + m.n, 0) || 1
  const modeOverride = fReqs.filter((r: any) => r.preferredMode && r.shipMode && r.preferredMode !== r.shipMode).length

  // ── Row 2 · everything below looks at the AIR documents only ───────────────────────────
  const airDocs = fReqs.filter((r: any) => r.shipMode === "AIR")
  const fwdCount: Record<string, number> = {}
  let airNoFwd = 0
  airDocs.forEach((r: any) => {
    const name = r.fwdName || r.preCostFwd
    if (name) fwdCount[name] = (fwdCount[name] || 0) + 1; else airNoFwd++
  })
  const airFwdRows = Object.entries(fwdCount).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 6)
  const fwdAssigned = airDocs.length - airNoFwd

  // Origin countries of the air documents: how many documents, and what a kilo costs there.
  const airByCountry: Record<string, { docs: Set<string>; est: number; kg: number }> = {}
  airDocs.forEach((r: any) => (r.items || []).forEach((i: any) => {
    const k = i.country; if (!k) return
    const g = (airByCountry[k] ||= { docs: new Set(), est: 0, kg: 0 })
    g.docs.add(r.id); g.est += Number(i.airFreightCost) || 0; g.kg += Number(i.weight) || 0
  }))
  const airCountryRows = Object.entries(airByCountry)
    .map(([k, v]) => ({ k, n: v.docs.size, perKg: v.kg ? v.est / v.kg : 0 }))
    .sort((a, b) => b.n - a.n).slice(0, 6)

  const perKgBy = (key: "country" | "vendorName") => {
    const m: Record<string, { est: number; kg: number; n: number }> = {}
    items.forEach((i: any) => {
      const k = i[key]; if (!k) return
      const g = (m[k] ||= { est: 0, kg: 0, n: 0 })
      g.est += Number(i.airFreightCost) || 0; g.kg += Number(i.weight) || 0; g.n++
    })
    return Object.entries(m).map(([k, v]) => ({ k, v: v.kg ? v.est / v.kg : 0, n: v.n }))
      .filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 6)
  }
  const countryCost = perKgBy("country"), supplierCost = perKgBy("vendorName")

  const incCount: Record<string, number> = {}
  fReqs.forEach((r: any) => { const t = ((r.items || []).find((i: any) => i.incoterm) || {}).incoterm; if (t) incCount[t] = (incCount[t] || 0) + 1 })
  const incRows = Object.entries(incCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const incTotal = incRows.reduce((s, [, n]) => s + n, 0)

  const fwdStatusRows = [
    { k: "Not sent yet", n: fReqs.filter((r: any) => !r.fwdSentAt).length, c: C.s4 },
    { k: "Sent · awaiting reply", n: fReqs.filter((r: any) => r.fwdSentAt && !r.fwdImportedAt).length, c: C.s1 },
    { k: "Replied", n: fReqs.filter((r: any) => r.fwdImportedAt).length, c: C.s3 },
  ]

  // ── Row 3 · who raised what, and where it sits ─────────────────────────────────────────
  const byOwner: Record<string, number> = {}
  fReqs.forEach((r: any) => { const o = ownerOf(r); byOwner[o] = (byOwner[o] || 0) + 1 })
  const purchaserRows = Object.entries(byOwner).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 9)

  // Status told the way the team actually talks about it: which lane the document is in, and which
  // desk it is sitting on right now. The three lanes have different chains, so they are separated
  // instead of being piled into one status list.
  const laneOf = (r: any): "SCM" | "FREE" | "PUR" =>
    isSampleLike(reqTypeOf(r)) ? "FREE" : (r.requestType || "SCM") === "PURCHASING" ? "PUR" : "SCM"
  const stageOf = (r: any): string => {
    const s = r.status
    if (s === "COMPLETED") return "Completed"
    if (s === "RECALLED") return "Recalled"
    if (s === "REJECTED") return "Rejected"
    if (s === "NO_AIR") return "No air"
    if (s === "PENDING_LG_RATE") return "Waiting LG · air rate"
    if (s === "APPROVED" || s === "PENDING_LOGISTICS") return laneOf(r) === "FREE" ? "Auto approved · waiting LG" : "Waiting LG"
    if (s === "PC_REVISE") return "Returned to Purchase"
    if (s === "PENDING_PURCHASING") return "Waiting Purchase"
    if (s === "PENDING_SCM_DECISION") return "Waiting SCM air decision"
    if (["PENDING_DVM_SCM", "PENDING_VP_SCM", "PENDING_FINAL"].includes(s)) return "Waiting SCM approve"
    if (["PENDING_VP_PUR", "PENDING_DVM_PUR", "PENDING_PC_DECISION"].includes(s)) return "Waiting DVM Purchase approve"
    return STATUS_LABEL[s] || s
  }
  const STAGE_RANK = ["Waiting Purchase", "Returned to Purchase", "Waiting SCM air decision", "Waiting SCM approve",
    "Waiting DVM Purchase approve", "Auto approved · waiting LG", "Waiting LG", "Waiting LG · air rate", "Completed"]
  const stageColor: Record<string, string> = {
    "Waiting Purchase": C.s2, "Returned to Purchase": C.crit, "Waiting SCM air decision": C.s5,
    "Waiting SCM approve": C.s4, "Waiting DVM Purchase approve": C.s4, "Auto approved · waiting LG": C.s1,
    "Waiting LG": C.s1, "Waiting LG · air rate": "#c2491d", Completed: C.s3, Recalled: "#8b5cf6", Rejected: D.mut, "No air": D.mut,
  }
  const LANES: { key: "SCM" | "FREE" | "PUR"; label: string }[] = [
    { key: "SCM", label: "SCM request" }, { key: "PUR", label: "Purchasing request" }, { key: "FREE", label: "MER / PPC request" },
  ]
  const laneRows = LANES.map(l => {
    const docs = fReqs.filter((r: any) => laneOf(r) === l.key)
    const m: Record<string, number> = {}
    docs.forEach((r: any) => { const k = stageOf(r); m[k] = (m[k] || 0) + 1 })
    const rows = Object.entries(m).sort((a, b) => {
      const ra = STAGE_RANK.indexOf(a[0]), rb = STAGE_RANK.indexOf(b[0])
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb)
    }).map(([k, n]) => ({ k, n, c: stageColor[k] || D.mut }))
    return { ...l, total: docs.length, rows }
  }).filter(l => l.total > 0)

  // What Logistics still owes — one row per thing LG has to do next.
  const atLg = fReqs.filter((r: any) => ["APPROVED", "PENDING_LOGISTICS", "PENDING_LG_RATE", "COMPLETED"].includes(r.status))
  const lgRows = [
    { k: "No ship mode selected", n: atLg.filter((r: any) => !r.shipMode && r.status !== "COMPLETED").length, c: C.s4 },
    { k: "Air rate missing", n: fReqs.filter((r: any) => r.status === "PENDING_LG_RATE").length, c: "#c2491d" },
    { k: "Air · not sent to FWD", n: atLg.filter((r: any) => r.shipMode === "AIR" && !r.fwdSentAt && r.status !== "COMPLETED").length, c: C.s2 },
    { k: "Sent to FWD · awaiting reply", n: fReqs.filter((r: any) => r.fwdSentAt && !r.fwdImportedAt).length, c: C.s1 },
    { k: "FWD replied · ready to close", n: fReqs.filter((r: any) => r.fwdImportedAt && r.actualAir == null).length, c: C.s5 },
    { k: "Closed", n: doneDocs.length, c: C.s3 },
  ].filter(r => r.n > 0)

  // ── Export (unchanged data contract) ───────────────────────────────────────────────────
  const dstr = (v: any) => (v ? new Date(v).toLocaleDateString("en-GB") : "-")
  const TABLE_COLS = ["Doc No", "BU", "Lane", "Buyer", "PO", "Country", "Port", "Incoterm", "Wt(kg)", "Factory", "ETC", "Est USD", "MAWB", "HAWB", "ETD", "ETA", "Pre cost", "Actual", "Local", "CFM in-house", "Status"]
  const tableRow = (r: any): any[] => {
    const its = r.items || []
    const d0 = its.find((i: any) => i.airFreightCost != null) || its[0] || {}
    const po = [...new Set(its.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
    return [r.documentNo, r.bu, reqTypeOf(r) === "PURCHASING" ? "Purchasing" : reqTypeOf(r) === "SAMPLE" ? "Sample" : "SCM", ownerOf(r), po,
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

  // ── building blocks ────────────────────────────────────────────────────────────────────
  const Card = ({ title, cap, right, children, className = "" }: any) => (
    <div className={`rounded-2xl p-[14px] ${className}`} style={{ background: D.card, border: `1px solid ${D.line}`, boxShadow: SH }}>
      <div className="flex items-start justify-between gap-2.5 flex-wrap">
        <div>
          <h3 className="text-[13.5px] font-bold tracking-[-.01em]" style={{ color: D.text }}>{title}</h3>
          {cap && <p className="text-[11px] mt-0.5" style={{ color: D.faint }}>{cap}</p>}
        </div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
  const Empty = () => <p className="text-[12px] py-4 text-center" style={{ color: D.faint }}>No data</p>

  // Capsule bars; the value is always printed, with an optional faint second number on the right.
  const HBars = ({ rows, labelW = 96 }: { rows: { k: string; v: number; label: string; color?: string; sub?: string }[]; labelW?: number }) => {
    if (!rows.length) return <Empty />
    const top = Math.max(1, ...rows.map(r => r.v))
    return (
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.k} className="flex items-center gap-2.5">
            <span className="text-[11.5px] truncate shrink-0" style={{ width: labelW, color: D.mut }} title={r.k}>{r.k}</span>
            <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: D.card2 }}>
              <span className="block h-2 rounded-full" style={{ width: `${Math.max(3, (r.v / top) * 100)}%`, background: r.color || C.s1 }} />
            </span>
            <span className="text-[11.5px] font-bold tabular-nums text-right shrink-0" style={{ minWidth: 54, color: D.text }}>{r.label}</span>
            {r.sub && <span className="text-[10.5px] tabular-nums text-right shrink-0" style={{ minWidth: 56, color: D.faint }}>{r.sub}</span>}
          </div>
        ))}
      </div>
    )
  }

  const ShareBar = ({ rows }: { rows: { k: string; n: number; c: string }[] }) => {
    const total = rows.reduce((s, r) => s + r.n, 0) || 1
    return (
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px]" style={{ background: D.card2 }}>
        {rows.map(r => <span key={r.k} title={`${r.k} · ${r.n}`} style={{ width: `${(r.n / total) * 100}%`, background: r.c }} />)}
      </div>
    )
  }

  // Grouped columns — Est vs Actual per month, one shared scale.
  const Columns = () => {
    if (!monthly.length) return <Empty />
    const W = 480, H = 186, P = { t: 18, r: 10, b: 26, l: 38 }
    const iw = W - P.l - P.r, ih = H - P.t - P.b
    const bw = iw / monthly.length, w = Math.min(16, (bw - 12) / 2)
    const y = (v: number) => P.t + ih - (v / maxMonth) * ih
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Estimate vs Actual by month">
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(maxMonth * t)} y2={y(maxMonth * t)} stroke={D.line2} strokeWidth={1} />
            <text x={P.l - 6} y={y(maxMonth * t) + 3} textAnchor="end" style={{ fontSize: 9, fill: D.faint }}>{K(maxMonth * t)}</text>
          </g>
        ))}
        {monthly.map(([m, v], i) => {
          const x0 = P.l + i * bw + (bw - w * 2 - 3) / 2
          return (
            <g key={m}>
              <rect x={x0} y={y(v.est)} width={w} height={Math.max(1.5, P.t + ih - y(v.est))} rx={3} fill={C.s1}><title>{`${m} · Est ${fmt(Math.round(v.est))} USD`}</title></rect>
              <rect x={x0 + w + 3} y={y(v.act)} width={w} height={Math.max(v.act > 0 ? 1.5 : 0, P.t + ih - y(v.act))} rx={3} fill={C.s2}><title>{`${m} · Actual ${fmt(Math.round(v.act))} USD`}</title></rect>
              <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" style={{ fontSize: 9.5, fill: D.faint }}>{monLabel(m, multiYear)}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  const Donut = () => {
    if (!incTotal) return <Empty />
    const S = 130, R = 57, r0 = 36, cx = S / 2, cy = S / 2
    const cols = [C.s1, C.s2, C.s3, C.s4, C.s5]
    const pt = (a: number, rad: number) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]
    let a0 = -Math.PI / 2
    return (
      <div className="flex gap-3.5 items-center flex-wrap">
        <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} role="img" aria-label="Incoterm mix">
          {incRows.map(([k, n], idx) => {
            const a1 = a0 + (n / incTotal) * Math.PI * 2 - 0.02
            const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0)
            const la = a1 - a0 > Math.PI ? 1 : 0
            const d = `M${x0} ${y0} A${R} ${R} 0 ${la} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${la} 0 ${x3} ${y3} Z`
            a0 = a1 + 0.02
            return <path key={k} d={d} fill={cols[idx % 5]} stroke={D.card} strokeWidth={2}><title>{`${k} · ${n}`}</title></path>
          })}
          <text x={cx} y={cy} textAnchor="middle" style={{ fontSize: 17, fontWeight: 700, fill: D.text }}>{incTotal}</text>
          <text x={cx} y={cy + 13} textAnchor="middle" style={{ fontSize: 9, fill: D.faint }}>documents</text>
        </svg>
        <div className="flex flex-col gap-1.5 text-[11px]" style={{ color: D.mut }}>
          {incRows.map(([k, n], i) => (
            <span key={k} className="flex items-center gap-2">
              <i className="inline-block w-2 h-2 rounded-sm" style={{ background: cols[i % 5] }} />
              {k} <b className="tabular-nums" style={{ color: D.text }}>{n}</b>
              <span style={{ color: D.faint }}>({Math.round((n / incTotal) * 100)}%)</span>
            </span>
          ))}
        </div>
      </div>
    )
  }

  const SectionHead = ({ n, title, color }: { n: number; title: string; color: string }) => (
    <div className="flex items-center gap-2.5 mt-6 mb-3">
      <span className="w-6 h-6 rounded-lg grid place-items-center text-[12px] font-bold text-white shrink-0" style={{ background: color }}>{n}</span>
      <h2 className="text-[15px] font-bold tracking-[-.015em] whitespace-nowrap" style={{ color: D.text }}>{title}</h2>
      <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${D.line}, transparent)` }} />
    </div>
  )

  const Legend = ({ items: ls }: { items: { k: string; c: string }[] }) => (
    <div className="flex gap-3 text-[11px] flex-wrap" style={{ color: D.mut }}>
      {ls.map(l => <span key={l.k} className="flex items-center gap-1.5"><i className="inline-block w-2 h-2 rounded-sm" style={{ background: l.c }} />{l.k}</span>)}
    </div>
  )
  const Pill = ({ tone, children }: { tone: "neutral" | "warn" | "bad" | "ok"; children: any }) => {
    const bg = tone === "warn" ? "rgba(237,161,0,.18)" : tone === "bad" ? "rgba(227,73,72,.13)" : tone === "ok" ? "rgba(0,131,0,.12)" : D.card2
    const fg = tone === "warn" ? "#8a5a00" : tone === "bad" ? C.crit : tone === "ok" ? C.good : D.mut
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color: fg }}>{children}</span>
  }

  const kpis = [
    { ic: "∑", k: "Estimated freight", v: K(est), u: "USD", d: totalDocs ? `Avg ${fmt(Math.round(est / totalDocs))} USD per document` : "—", c: C.s1 },
    { ic: "✓", k: "Actual freight", v: K(act), u: "USD", d: "", pill: `From ${doneDocs.length} closed document${doneDocs.length === 1 ? "" : "s"}`, c: C.s2 },
    {
      ic: "Δ", k: "Variance (Actual − Est)", c: variance > 0 ? C.crit : C.good,
      v: variancePct == null ? "—" : `${variance >= 0 ? "+" : "−"}${Math.abs(variancePct).toFixed(1)}`, u: variancePct == null ? "" : "%",
      d: variancePct == null ? "No closed document yet" : "small sample", pill: variancePct == null ? "" : variance > 0 ? "Above estimate" : "Below estimate",
    },
  ]

  return (
    <div className="rounded-2xl p-4 md:p-5 min-h-[calc(100vh-110px)]" style={{ background: D.pageBg, color: D.pageText, border: `1px solid ${D.line}` }}>
      <div className="max-w-[1360px] mx-auto">

        {/* header banner */}
        <div className="rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3.5 flex-wrap"
          style={{ background: `linear-gradient(100deg, ${D.card}, ${D.card2})`, border: `1px solid ${D.line}`, borderInlineStart: `4px solid ${C.s1}`, boxShadow: SH }}>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[.17em] font-semibold" style={{ color: D.faint }}>Nan Yang Textile · RM REQ AIR · {bu}</div>
            <h1 className="text-[22px] font-bold tracking-[-.025em] mt-0.5 leading-[1.4]" style={{ color: D.text }}>✈ Air Request — Team Analysis Dashboard</h1>
            <div className="flex items-center gap-2.5 flex-wrap mt-1.5 text-[11.5px]" style={{ color: D.mut }}>
              <Pill tone="neutral">{monthly.length ? `${monLabel(monthly[0][0], true)} → ${monLabel(monthly[monthly.length - 1][0], true)}` : "—"}</Pill>
            </div>
          </div>
          <div className="flex gap-0.5 rounded-xl p-[3px]" style={{ background: D.card2, border: `1px solid ${D.line}` }}>
            {BUS.map(b => (
              <button key={b} onClick={() => setBu(b)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={bu === b ? { background: D.card, color: D.text, boxShadow: SH } : { color: D.mut }}>{b}</button>
            ))}
          </div>
        </div>

        {/* KPI */}
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))" }}>
          {kpis.map(c => (
            <div key={c.k} className="relative rounded-2xl py-3.5 pr-4 pl-[18px] overflow-hidden" style={{ background: D.card, border: `1px solid ${D.line}`, boxShadow: SH }}>
              <span className="absolute inset-y-0 start-0 w-1" style={{ background: c.c }} />
              <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: D.mut }}>
                <i className="not-italic w-[19px] h-[19px] rounded-md grid place-items-center text-[11px]" style={{ background: `${c.c}22`, color: c.c }}>{c.ic}</i>
                {c.k}
              </div>
              <div className="text-[33px] font-bold tracking-[-.03em] leading-[1.05] mt-1.5" style={{ color: c.c }}>
                {c.v}{c.u && <span className="text-[14px] font-semibold ms-1" style={{ color: D.mut }}>{c.u}</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[11.5px]" style={{ color: D.mut }}>
                {(c as any).pill ? <Pill tone={c.k.startsWith("Variance") ? (variance > 0 ? "bad" : "ok") : "warn"}>{(c as any).pill}</Pill> : null}
                {c.d && <span style={{ color: D.faint }}>{c.d}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* toolbar */}
        <div className="flex items-center gap-2 flex-wrap rounded-2xl px-3 py-2.5 mt-3" style={{ background: D.card, border: `1px solid ${D.line}`, boxShadow: SH }}>
          <div className="flex gap-1 rounded-xl p-[3px]" style={{ background: D.card2 }}>
            {([["ALL", "All"], ["SCM", "SCM"], ["PURCHASING", "Purchasing"], ["SAMPLE", "Sample"], ["PPC", "PPC"]] as const).map(([v, label]) => {
              const n = v === "ALL" ? reqs.length : reqs.filter((r: any) => reqTypeOf(r) === v).length
              return (
                <button key={v} onClick={() => setTypeF(v)} className="px-2 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
                  style={typeF === v ? { background: D.card, color: D.text, boxShadow: SH } : { color: D.mut }}>
                  {label} <span className="opacity-60">{n}</span>
                </button>
              )
            })}
          </div>
          {/* the five pickers share the leftover width so the bar stays a single row */}
          <div className="flex-1 min-w-[160px]"><MultiSelect label="Doc No…" options={docNos} value={docF} onChange={setDocF} /></div>
          <div className="flex-1 min-w-[110px]"><MultiSelect label="PO…" options={poNos} value={poF} onChange={setPoF} /></div>
          <div className="flex-1 min-w-[110px]"><MultiSelect label="Buyer…" options={reqOptions} value={reqF} onChange={setReqF} /></div>
          <div className="flex-1 min-w-[120px]"><MultiSelect label="Status…" options={statusOpts} value={statusF} onChange={setStatusF} /></div>
          <div className="flex-1 min-w-[120px]"><MultiSelect label="Supplier…" options={supOpts} value={supF} onChange={setSupF} /></div>
          {(docF.length > 0 || poF.length > 0 || reqF.length > 0 || statusF.length > 0 || supF.length > 0) && (
            <button onClick={() => { setDocF([]); setPoF([]); setReqF([]); setStatusF([]); setSupF([]) }} className="text-[11px] underline" style={{ color: D.mut }}>Clear filters</button>
          )}
          <span className="text-[11.5px] ms-auto" style={{ color: D.faint }}>{totalDocs} documents</span>
        </div>

        {loading ? <p className="text-sm mt-4" style={{ color: D.pageMut }}>Loading…</p> : totalDocs === 0 ? (
          <div className="rounded-2xl p-12 text-center text-sm mt-3" style={{ background: D.card, border: `1px solid ${D.line}`, color: D.mut }}>No documents in this BU</div>
        ) : (
          <>
            {/* ── 1 · Cost & Ship Mode ───────────────────────────────────── */}
            <SectionHead n={1} title="Cost & Ship Mode" color={C.s1} />
            <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)" }}>
              <Card title="Estimate vs Actual (USD)"
                right={<Legend items={[{ k: "Estimate", c: C.s1 }, { k: "Actual", c: C.s2 }]} />}>
                <Columns />
              </Card>
              <Card title="Ship Mode per Document"
                right={modeOverride ? <Pill tone="warn">LG changed {modeOverride}</Pill> : null}>
                <ShareBar rows={modeRows} />
                <div className="h-3" />
                <HBars labelW={92} rows={modeRows.map(m => ({
                  k: m.k, v: m.n, color: m.c, label: `${m.n} docs`, sub: `${Math.round((m.n / modeTotal) * 100)}%`,
                }))} />
              </Card>
            </div>

            {/* ── 2 · Air Cost ───────────────────────────────────────────── */}
            <SectionHead n={2} title="Air Cost" color={C.s2} />
            <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr)" }}>
              <Card title={`Forwarder on Air Documents (${airDocs.length})`}
                right={airNoFwd ? <Pill tone="bad">{airNoFwd} pending</Pill> : null}>
                {airDocs.length === 0 ? <Empty /> : (
                  <>
                    <ShareBar rows={[{ k: "Assigned", n: fwdAssigned, c: C.s3 }, { k: "Not assigned", n: airNoFwd, c: C.s4 }]} />
                    <div className="mt-2"><Legend items={[{ k: `Forwarder assigned ${fwdAssigned}`, c: C.s3 }, { k: `Not assigned ${airNoFwd}`, c: C.s4 }]} /></div>
                    <div className="my-3" style={{ borderTop: `1px solid ${D.line2}` }} />
                    <HBars labelW={112} rows={[
                      ...airFwdRows.map(f => ({ k: f.k, v: f.n, color: C.s3, label: `${f.n} docs` })),
                      ...(airNoFwd ? [{ k: "Not assigned", v: airNoFwd, color: C.s4, label: `${airNoFwd} docs` }] : []),
                    ]} />
                  </>
                )}
              </Card>
              <Card title="Air Origin Countries">
                <HBars labelW={94} rows={airCountryRows.map(r => ({ k: r.k, v: r.n, color: C.s1, label: `${r.n} docs`, sub: `${r.perKg.toFixed(2)} $/kg` }))} />
              </Card>
              <Card title="Cost / kg by Country (USD)">
                <HBars labelW={94} rows={countryCost.map(x => ({ k: x.k, v: x.v, color: C.s4, label: x.v.toFixed(2) }))} />
              </Card>
            </div>
            <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              <Card title="Cost / kg by Supplier (USD)">
                <HBars labelW={112} rows={supplierCost.map((x, i) => ({ k: x.k, v: x.v, color: i === 0 ? C.crit : C.s5, label: x.v.toFixed(2) }))} />
              </Card>
              <Card title="Incoterms">
                <Donut />
              </Card>
              <Card title="Forwarder Status">
                <HBars labelW={118} rows={fwdStatusRows.map(s => ({ k: s.k, v: s.n, color: s.c, label: `${s.n} docs` }))} />
              </Card>
            </div>

            {/* ── 3 · Status Document ────────────────────────────────────── */}
            <SectionHead n={3} title="Status Document" color={C.s5} />
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              <Card title="Documents Raised by Purchasing"
                right={<Pill tone="neutral">{purchaserRows.length} people</Pill>}>
                <HBars labelW={100} rows={purchaserRows.map(p => ({ k: p.k, v: p.n, color: C.s5, label: `${p.n} docs` }))} />
              </Card>
              <Card title="Waiting On — by Request Lane"
                right={<Pill tone="neutral">{wipDocs.length} open</Pill>}>
                {laneRows.length === 0 ? <Empty /> : (
                  <div className="space-y-3.5">
                    {laneRows.map(l => (
                      <div key={l.key}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-[11.5px] font-bold" style={{ color: D.text }}>{l.label}</span>
                          <span className="text-[10.5px] tabular-nums" style={{ color: D.faint }}>{l.total} docs</span>
                        </div>
                        <ShareBar rows={l.rows.map(r => ({ k: r.k, n: r.n, c: r.c }))} />
                        <div className="mt-2">
                          <HBars labelW={146} rows={l.rows.map(r => ({ k: r.k, v: r.n, color: r.c, label: `${r.n}` }))} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card title="Logistics — What's Next"
                right={<Pill tone="neutral">{atLg.length} at LG</Pill>}>
                <HBars labelW={160} rows={lgRows.map(r => ({ k: r.k, v: r.n, color: r.c, label: `${r.n} docs` }))} />
              </Card>
            </div>

            {/* full data table — folded away so it never fights the overview */}
            <details className="rounded-2xl mt-3" style={{ background: D.card, border: `1px solid ${D.line}`, boxShadow: SH }}>
              <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold select-none" style={{ color: D.text }}>
                All data (SCM · Purchasing · LG) — {totalDocs} documents
              </summary>
              <div className="px-4 pb-4">
                <button onClick={exportTable} className="mb-3 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-white" style={{ background: C.s3 }}>📊 Export Excel</button>
                <div className="overflow-x-auto">
                  <table className="text-[11px] whitespace-nowrap min-w-[1500px] w-full">
                    <thead>
                      <tr style={{ color: D.faint, borderBottom: `1px solid ${D.line}` }}>{TABLE_COLS.map(h => <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {fReqs.map((r: any) => {
                        const its = r.items || []
                        const d0 = its.find((i: any) => i.airFreightCost != null) || its[0] || {}
                        const e = estOf(r)
                        const po = [...new Set(its.map((i: any) => i.poNoDoc).filter(Boolean))].join(", ")
                        return (
                          <tr key={r.id} style={{ borderTop: `1px solid ${D.line2}`, color: D.mut }}>
                            <td className="px-2 py-1.5 font-semibold" style={{ color: D.text }}>{r.documentNo}</td>
                            <td className="px-2 py-1.5">{r.bu}</td>
                            <td className="px-2 py-1.5">{reqTypeOf(r) === "PURCHASING" ? "Purchasing" : reqTypeOf(r) === "SAMPLE" ? "Sample" : "SCM"}</td>
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
          </>
        )}
      </div>
    </div>
  )
}
