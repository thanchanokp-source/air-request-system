"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor } from "../_StageWork"
import { pcApprover } from "@/lib/pull-approvers"
import SignatureModal from "@/components/signature-modal"

// Approver stages: which role owns each, and where Approve / Send-back go.
const APPROVER: Record<string, { role: string; label: string; next: string; back: string; backLabel: string }> = {
  PENDING_DVM_SCM:  { role: "PULL_DVM_SCM",   label: "DVM SCM",        next: "PENDING_VP_SCM",  back: "PENDING_SCM_DECISION", backLabel: "Send back to SCM" },
  PENDING_VP_SCM:   { role: "VP_SCM",         label: "VP SCM",         next: "PENDING_FINAL",   back: "PENDING_DVM_SCM",      backLabel: "Send back to DVM SCM" },
  PENDING_FINAL:    { role: "PULL_PRESIDENT", label: "VP Production",  next: "APPROVED",        back: "PENDING_VP_SCM",       backLabel: "Send back to VP SCM" },
  PENDING_VP_PUR:   { role: "VP_PUR",         label: "DVM Purchase",   next: "APPROVED",        back: "PENDING_PC_DECISION",  backLabel: "Send back to Requester" },
  PENDING_APPROVAL: { role: "ADMIN",          label: "Approval (legacy)", next: "APPROVED",     back: "PENDING_SCM_DECISION", backLabel: "Send back" },
}

// Full stage chain per branch — for the stepper. `role` resolves the actual approver NAME per stage.
// Est Air is auto-computed after Purchasing (no manual Logistics step); LG only enters ACTUAL after approval.
const SCM_CHAIN = [
  { s: "PENDING_PURCHASING", l: "Purchasing", role: "PURCHASING" },
  { s: "PENDING_SCM_DECISION", l: "SCM", role: "SCM_PULL" }, { s: "PENDING_DVM_SCM", l: "DVM SCM", role: "PULL_DVM_SCM" },
  { s: "PENDING_VP_SCM", l: "VP SCM", role: "VP_SCM" },
  { s: "PENDING_FINAL", l: "VP Production", role: "PULL_PRESIDENT" }, { s: "APPROVED", l: "Approved · LG fills actual", role: "" },
]
// PC branch stepper: Requester → DVM Purchase → Logistics (no role-holder name lists).
const PC_CHAIN = [
  { s: "REQUESTER", l: "Requester", role: "" },
  { s: "PENDING_VP_PUR", l: "DVM Purchase", role: "VP_PUR" },
  { s: "APPROVED", l: "Logistics", role: "" },
]
const nameOf = (u: any) => u?.name || (u?.email ? String(u.email).split("@")[0] : "")
// Earliest of date-ish values (system-derived Shipment Date + MRD).
const earliest = (arr: any[]) => { const t = arr.map(v => (v ? new Date(v).getTime() : NaN)).filter(n => !isNaN(n)); return t.length ? new Date(Math.min(...t)) : null }

export default function Page() {
  const { data: session } = useSession()
  const myRoles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = myRoles.includes("ADMIN")
  const myEmail = String((session?.user as any)?.email || "").toLowerCase()

  // Can this user approve a doc at this status? Admin = all. PC approval (PENDING_VP_PUR) is a SINGLE
  // approver routed by BU — only that person (per the doc's BU) may approve.
  const canApprove = (st: string, docBu?: string) => {
    if (isAdmin) return true
    if (st === "PENDING_VP_PUR") return !!docBu && pcApprover(docBu)?.toLowerCase() === myEmail
    return myRoles.includes(APPROVER[st]?.role)
  }

  const [bu, setBu] = useState("NYG")
  const [allReqs, setAllReqs] = useState<any[]>([]) // pending-approval docs across ALL BUs
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [typeF, setTypeF] = useState<"ALL" | "SCM" | "PURCHASING">("ALL")
  const [poQ, setPoQ] = useState("")
  // Signature modal (like Air Claim): opens before an Approve, resolves the promise with the data URI.
  const [sigOpen, setSigOpen] = useState(false)
  const sigResolver = useRef<((v: string | undefined) => void) | null>(null)
  const askSignature = () => new Promise<string | undefined>(resolve => { sigResolver.current = resolve; setSigOpen(true) })
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  // role → approver names (for the stepper)
  const [roleNames, setRoleNames] = useState<Record<string, string[]>>({})
  useEffect(() => {
    fetch("/api/pull-material/approvers").then(r => r.json()).then(d => {
      const map: Record<string, string[]> = {}
      for (const u of (d.users || [])) {
        const held = [u.role, ...(u.roles || [])].filter(Boolean)
        for (const rl of new Set(held)) { (map[rl as string] ||= []).push(nameOf(u)) }
      }
      setRoleNames(map)
    }).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      // An approver (esp. jariya = PC approver for EVERY BU) must not miss a doc just because it
      // sits under a different BU tab → load ALL BUs, then filter to what this user can approve.
      const results = await Promise.all(BUS.map(b => fetch(`/api/pull-material?bu=${b}`).then(r => r.json()).catch(() => ({}))))
      const seen = new Set<string>()
      const all = results.flatMap((d: any) => d.requests || []).filter((r: any) => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
      setAllReqs(all.filter((r: any) => APPROVER[r.status] && canApprove(r.status, r.bu)))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [isAdmin, myEmail]) // eslint-disable-line

  const act = async (rq: any, toStatus: string) => {
    const isApprove = toStatus === "APPROVED"
    // Approving requires a signature (like Air Claim) — the signature popup IS the confirmation
    // (draw first time / reuse after). Non-approve actions still confirm with a dialog.
    let signatureData: string | undefined
    if (isApprove) {
      signatureData = await askSignature()
      if (!signatureData) return   // cancelled in the signature popup
    } else if (!confirm(`Send back ${rq.documentNo}?`)) return
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus, ...(signatureData ? { signatureData } : {}) }),
      })
      if (r.ok) { setOpenId(null); await load() } else alert("Error")
    } finally { setBusy(false) }
  }

  const doReject = async (rq: any) => {
    if (!rejectReason.trim()) return alert("Please enter a reason for rejection.")
    setBusy(true)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", rejectReason: rejectReason.trim() }),
      })
      if (r.ok) { setShowReject(false); setRejectReason(""); setOpenId(null); await load() } else alert("Error")
    } finally { setBusy(false) }
  }

  const reqs = bu === "ALL" ? allReqs : allReqs.filter((r: any) => r.bu === bu) // docs shown for the selected BU tab
  const openReq = allReqs.find(r => r.id === openId)

  return (
    <div className="p-5 md:p-8 max-w-[1100px] mx-auto space-y-5">
      {!openReq && (
        <>
          <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: MAROON }}>Approval — Pull Material</h1>
            <p className="text-sm text-gray-400 mt-0.5">Documents pending your approval</p></div>
          <div className="flex gap-1.5">{["ALL", ...BUS].map(b => {
            const cnt = b === "ALL" ? allReqs.length : allReqs.filter((r: any) => r.bu === b).length
            return (
            <button key={b} onClick={() => { setBu(b); setOpenId(null) }} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition inline-flex items-center gap-1.5 ${bu === b ? "text-white border-transparent shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: b === "ALL" ? MAROON : buColor(b) } : undefined}>
              {b === "ALL" ? "ALL BU" : b}{cnt > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${bu === b ? "bg-white/25 text-white" : "bg-red-100 text-red-700"}`}>{cnt}</span>}
            </button>
          )})}</div>

          {/* Request-type toggle + PO search */}
          <div className="flex flex-wrap items-center gap-2">
            {([["ALL", "ทั้งหมด"], ["SCM", "SCM request"], ["PURCHASING", "PC request"]] as const).map(([v, label]) => {
              const n = v === "ALL" ? reqs.length : reqs.filter(r => (r.requestType || "SCM") === v).length
              return (
                <button key={v} onClick={() => setTypeF(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${typeF === v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                  style={typeF === v ? { background: MAROON } : undefined}>{label} <span className="opacity-70">({n})</span></button>
              )
            })}
            <input value={poQ} onChange={e => setPoQ(e.target.value)} placeholder="🔍 ค้นหา PO / เลขเอกสาร…"
              className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>

          {(() => {
            const pq = poQ.trim().toLowerCase()
            const shown = reqs.filter(rq => {
              if (typeF !== "ALL" && (rq.requestType || "SCM") !== typeF) return false
              if (!pq) return true
              if (String(rq.documentNo || "").toLowerCase().includes(pq)) return true
              return (rq.items || []).some((i: any) => String(i.poNoDoc || "").toLowerCase().includes(pq) || String(i.soNoDoc || "").toLowerCase().includes(pq))
            })
            return loading ? <p className="text-sm text-gray-400">Loading…</p> :
            shown.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">{reqs.length === 0 ? "No documents pending your approval" : "ไม่พบเอกสารที่ตรงกับตัวกรอง"}</div> :
              <div className="space-y-2.5">
                {shown.map(rq => (
                  <button key={rq.id} onClick={() => setOpenId(rq.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition text-left">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{rq.documentNo}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{APPROVER[rq.status]?.label || rq.status}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{rq.requesterName} · {rq.items?.length || 0} items · PO {[...new Set((rq.items || []).map((i: any) => i.poNoDoc).filter(Boolean))].join(", ") || "-"}</div>
                    </div>
                    <span className="shrink-0 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>Open →</span>
                  </button>
                ))}
              </div>
          })()}
        </>
      )}

      {openReq && (() => {
        const chain = openReq.requestType === "PURCHASING" ? PC_CHAIN : SCM_CHAIN
        const curIdx = chain.findIndex(s => s.s === openReq.status)
        const cfg = APPROVER[openReq.status]
        const total = (openReq.items || []).reduce((s: number, it: any) => s + (Number(it.airFreightCost) || 0), 0)
        return (
          <div className="space-y-5">
            <button onClick={() => setOpenId(null)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1">← Back</button>
            {/* Header: doc info left · action buttons top-right (GM74 style) */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{openReq.documentNo}</h1>
                <span className="text-xs text-gray-400">by {openReq.requesterName} · {fmtDate(openReq.createdAt)}</span>
              </div>
              {cfg && canApprove(openReq.status, openReq.bu) && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => act(openReq, cfg.next)} disabled={busy}
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 shadow-sm" style={{ background: "#16a34a" }}>
                    {busy ? "…" : "✓ Approve"}
                  </button>
                  <button onClick={() => { setRejectReason(""); setShowReject(true) }} disabled={busy}
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 bg-red-600 hover:bg-red-700 shadow-sm">
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              {/* Left: doc info + items */}
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="text-sm font-bold text-gray-800 mb-3">📄 Document</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Info label="BU" value={openReq.bu} />
                    <Info label="Requester" value={openReq.requesterName} />
                    <Info label="Brand Name" value={[...new Set((openReq.items || []).map((i: any) => i.brand).filter(Boolean))].join(", ")} />
                    <Info label="Supplier Name" value={[...new Set((openReq.items || []).map((i: any) => i.vendorName).filter(Boolean))].join(", ") || openReq.vendorContact} />
                    {openReq.requestType !== "PURCHASING" && openReq.remark && <div className="col-span-2"><Info label="Remark" value={openReq.remark} /></div>}
                  </div>
                  <PullAttachments reqId={openReq.id} />
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="text-sm font-bold text-gray-800 px-5 pt-5 pb-2">Items</div>
                  {openReq.requestType === "PURCHASING" ? (() => {
                    // 1 shipment / 1 doc → shipment fields are identical for all lines. Show them ONCE
                    // (Country/Port/Est Air/L/T Air) + a by-PO breakdown of the pull qty (QTY AIR).
                    const items = (openReq.items || [])
                    const s0 = items.find((x: any) => x.airFreightCost != null) || items[0] || {}
                    const byPo: Record<string, { qty: number; uoms: Set<string>; freight: number; origin: number }> = {}
                    items.forEach((it: any) => { const po = it.poNoDoc || "-"; const g = (byPo[po] ||= { qty: 0, uoms: new Set(), freight: 0, origin: 0 }); const tot = Number(it.airFreightCost) || 0; const org = Number(it.originCost) || 0; g.qty += Number(it.pullMaterialQty) || 0; g.freight += tot - org; g.origin += org; if (it.bomUom) g.uoms.add(it.bomUom) })
                    const docAct = openReq.actualAir != null ? `${fmt(openReq.actualAir)}` : "-"
                    const docMawb = openReq.mawbNo || "-", docHawb = openReq.hawbNo || "-"
                    // Est Air = freight only (no incoterm); EXW = origin cost; Total Air = freight + origin.
                    const totalOrigin = items.reduce((s: number, it: any) => s + (Number(it.originCost) || 0), 0)
                    const totalFreight = total - totalOrigin
                    const totalQty = items.reduce((s: number, it: any) => s + (Number(it.pullMaterialQty) || 0), 0)
                    const pkgs = Array.isArray(openReq.packages) ? openReq.packages : []
                    const pkgStr = pkgs.length ? pkgs.map((p: any) => `${fmt(p.qty)} ${p.uom}`).join(", ") : (s0.cartons ? String(fmt(s0.cartons)) : "")
                    const dimStr = (s0.boxW || s0.boxL || s0.boxH) ? `${s0.boxW || "-"}×${s0.boxL || "-"}×${s0.boxH || "-"} cm` : ""
                    return (
                      <div className="px-5 pb-5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 rounded-xl bg-gray-50 p-3">
                          <Info label="Country" value={s0.country} />
                          <Info label="Port" value={s0.port || s0.seaPort} />
                          <Info label="City" value={s0.city} />
                          <Info label="Incoterm" value={s0.incoterm} />
                          <Info label="QTY Air" value={fmt(totalQty)} />
                          <Info label="Est Air (freight)" value={total ? `${fmt(totalFreight)} USD` : <span className="text-amber-600 text-xs font-medium">⚠️ ไม่มี rate — ให้ LG เพิ่ม Master Rate ของ port {s0.port || s0.seaPort || "นี้"}</span>} />
                          <Info label={`EXW/${s0.incoterm || "incoterm"}`} value={totalOrigin ? `${fmt(totalOrigin)} USD` : "-"} />
                          <Info label="Total Air" value={total ? `${fmt(total)} USD` : "-"} />
                          <Info label="L/T Air" value={s0.leadTimeAir} />
                          <Info label="Weight (kg)" value={s0.weight != null ? fmt(s0.weight) : "-"} />
                          <Info label="ETC" value={s0.etc ? fmtDate(s0.etc) : "-"} />
                          <Info label="Need date (in-house)" value={s0.needDate ? fmtDate(s0.needDate) : "-"} />
                          <Info label="MRD" value={fmtDate(earliest(items.flatMap((it: any) => [it.shipmentDate, it.mrdDate, it.mrdNeedDate, it.mrd2])))} />
                          <Info label="Shipment Date" value={fmtDate(earliest(items.map((it: any) => it.shipmentDate)))} />
                          <Info label="Package" value={pkgStr} />
                          <Info label="Dimension" value={dimStr} />
                          {openReq.remark && <Info label="Remark" value={openReq.remark} />}
                          {s0.pickupAddress && <div className="col-span-2 sm:col-span-4"><Info label="Supplier / Pickup address" value={s0.pickupAddress} /></div>}
                        </div>

                        {/* Shipping mode comparison — cost + lead time per transport type (use what data exists) */}
                        {(() => {
                          const seaCost = items.reduce((a: number, it: any) => a + (Number(it.seaFreightCost) || 0), 0) || (s0.estSea ? Number(s0.estSea) : 0)
                          const modes = [
                            { key: "air", label: "✈️ Air", cost: total || null, lt: s0.leadTimeAir || null, accent: "#6b1a1a" },
                            { key: "sea", label: "🚢 Sea", cost: seaCost || null, lt: s0.leadTimeSea || null, accent: "#0369a1" },
                            { key: "dhl", label: "📦 Courier · DHL", cost: null, lt: null, accent: "#b45309" },
                            { key: "fedex", label: "📦 Courier · FedEx", cost: null, lt: null, accent: "#7c3aed" },
                          ]
                          const cheapest = Math.min(...modes.filter(m => m.cost).map(m => m.cost as number))
                          return (
                            <div className="mb-4">
                              <div className="text-xs font-bold text-gray-600 mb-2">เปรียบเทียบวิธีขนส่ง (ค่าใช้จ่าย · Lead time)</div>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                {modes.map(m => {
                                  const best = m.cost && m.cost === cheapest
                                  return (
                                    <div key={m.key} className={`rounded-xl border p-3 ${best ? "ring-2 ring-emerald-300 border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"}`}>
                                      <div className="text-xs font-semibold" style={{ color: m.accent }}>{m.label}{best && <span className="ml-1 text-[10px] text-emerald-600">ถูกสุด</span>}</div>
                                      <div className="mt-1.5 text-lg font-bold text-gray-800">{m.cost ? `${fmt(m.cost)}` : <span className="text-gray-300 text-sm">–</span>}<span className="text-[10px] font-normal text-gray-400 ml-1">{m.cost ? "USD" : "รอ data"}</span></div>
                                      <div className="text-[11px] text-gray-500 mt-0.5">L/T: {m.lt || <span className="text-gray-300">–</span>}</div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}

                        <div className="overflow-x-auto border rounded-xl">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500"><tr>
                              {["PO NO", "QTY AIR", "UOM", "EST AIR COST", "EXW", "TOTAL AIR", "ACT AIR COST", "MAWB", "HAWB", "LOCAL CHARGE (TH)", "INVOICE NO"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                              {Object.keys(byPo).map(po => (
                                <tr key={po} className="hover:bg-gray-50">
                                  <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{po}</td>
                                  <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(byPo[po].qty)}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap">{[...byPo[po].uoms].join(", ") || "-"}</td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{byPo[po].freight ? fmt(byPo[po].freight) : "-"}</td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{byPo[po].origin ? fmt(byPo[po].origin) : "-"}</td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold">{(byPo[po].freight + byPo[po].origin) ? fmt(byPo[po].freight + byPo[po].origin) : "-"}</td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap text-gray-500" title="ยอดรวมทั้งเอกสาร (LG กรอก)">{docAct}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{docMawb}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{docHawb}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-400">-</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap font-medium text-gray-700">{(openReq.poInvoices || {})[po] || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })() : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500"><tr>
                        {["SO", "Material", "PULL", "Country", "Port", "Incoterm", "Wt(kg)", "Air Freight", "L/T Air", "Air?", "Reason"].map(h =>
                          <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {(openReq.items || []).map((it: any) => (
                          <tr key={it.id} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{it.soNoDoc}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{it.itemName || it.itemCode}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{it.country || "-"}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{it.port || it.seaPort || "-"}</td>
                            <td className="px-3 py-1.5">{it.incoterm || "-"}</td>
                            <td className="px-3 py-1.5 text-right">{fmt(it.weight)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(it.airFreightCost)}</td>
                            <td className="px-3 py-1.5">{it.leadTimeAir || "-"}</td>
                            <td className="px-3 py-1.5 text-center">{it.airDecision === "AIR" ? "✈" : it.airDecision === "NO_AIR" ? "—" : ""}</td>
                            <td className="px-3 py-1.5 text-gray-500 max-w-[160px] truncate" title={it.reasonAirPick || ""}>{it.reasonAirPick || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="bg-gray-50 font-semibold"><td colSpan={7} className="px-3 py-2 text-right text-gray-600">Total Air Freight</td><td className="px-3 py-2 text-right" style={{ color: MAROON }}>{fmt(total)}</td><td colSpan={3}></td></tr></tfoot>
                    </table>
                  </div>
                  )}
                </div>
              </div>

              {/* Right: approval stepper (shows the actual approver name per stage) */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="text-sm font-bold text-gray-800 mb-4">Approval steps</div>
                  <div className="space-y-0">
                    {chain.map((step, i) => {
                      const done = i < curIdx, current = i === curIdx
                      // Requester step → the requester; PC approval → the single BU-routed approver;
                      // other stages (SCM branch) → role holders. Logistics/blank → no names.
                      const who = step.s === "REQUESTER"
                        ? (openReq.requesterName || "")
                        : step.s === "PENDING_VP_PUR"
                          ? nameOf({ email: pcApprover(openReq.bu) })
                          : step.role ? (roleNames[step.role] || []).join(", ") : ""
                      return (
                        <div key={step.s} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? "bg-green-500 text-white" : current ? "bg-amber-400 text-white" : "bg-gray-200 text-gray-400"}`}>
                              {done ? "✓" : current ? "●" : "○"}
                            </div>
                            {i < chain.length - 1 && <div className={`w-0.5 flex-1 min-h-[26px] ${done ? "bg-green-400" : "bg-gray-200"}`} />}
                          </div>
                          <div className={`pb-4 ${current ? "" : "opacity-80"}`}>
                            <div className={`text-sm font-semibold ${current ? "text-amber-700" : done ? "text-gray-700" : "text-gray-400"}`}>{step.l}</div>
                            {who && <div className="text-[11px] text-gray-500">{who}</div>}
                            {current && <div className="text-[11px] text-amber-600">รออนุมัติ</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Reject modal — reason required */}
            {showReject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setShowReject(false)}>
                <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold text-gray-800">✕ Reject {openReq.documentNo}</h3>
                  <p className="text-xs text-gray-500">The document will be withdrawn from the flow and everyone who acted on it (+ requester) will be notified with this reason.</p>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Reason <span className="text-red-500">*</span></label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} autoFocus
                      placeholder="Why is this document rejected?"
                      className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowReject(false)} disabled={busy} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                    <button onClick={() => doReject(openReq)} disabled={busy || !rejectReason.trim()} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40">
                      {busy ? "…" : "Confirm Reject"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Signature popup (draw first time · reuse/confirm after) — like Air Claim */}
      <SignatureModal
        open={sigOpen}
        title="Sign to Approve"
        confirmLabel="Confirm & Approve"
        onConfirm={sig => { setSigOpen(false); sigResolver.current?.(sig); sigResolver.current = null }}
        onCancel={() => { setSigOpen(false); sigResolver.current?.(undefined); sigResolver.current = null }}
      />
    </div>
  )
}

function Info({ label, value }: { label: string; value: any }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-gray-800">{value || "-"}</div></div>
}

// Attachments uploaded with the request — download links (streamed via the app server).
function PullAttachments({ reqId }: { reqId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [pv, setPv] = useState<any | null>(null)
  useEffect(() => { fetch(`/api/pull-material/${reqId}/attachments`).then(r => r.json()).then(d => setRows(Array.isArray(d) ? d : [])).catch(() => {}) }, [reqId])
  if (!rows.length) return null
  const url = pv ? `/api/pull-material/attachments/${pv.id}` : ""
  const ext = pv ? String(pv.fileName || "").split(".").pop()?.toLowerCase() : ""
  const isImg = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext || "")
  const isPdf = ext === "pdf"
  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <div className="text-[11px] font-semibold text-gray-500 uppercase mb-2">แนบไฟล์ ({rows.length})</div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map(a => (
          <button key={a.id} type="button" onClick={() => setPv(a)}
            className="inline-flex items-center gap-1 text-[11px] bg-sky-50 border border-sky-200 text-sky-800 rounded-full px-2.5 py-1 hover:bg-sky-100">
            📎 <span className="max-w-[220px] truncate" title={a.fileName}>{a.fileName}</span>
          </button>
        ))}
      </div>

      {pv && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPv(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-800 truncate" title={pv.fileName}>📎 {pv.fileName}</span>
              <div className="flex items-center gap-2 shrink-0">
                <a href={url} download={pv.fileName} className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold" style={{ background: MAROON }}>⬇ ดาวน์โหลด</a>
                <button onClick={() => setPv(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-1">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-2 min-h-[300px]">
              {isImg ? <img src={url} alt={pv.fileName} className="max-w-full max-h-[75vh] object-contain" />
                : isPdf ? <iframe src={url} title={pv.fileName} className="w-full h-[75vh] border-0" />
                  : <div className="text-center p-10 text-gray-500"><div className="text-5xl mb-3">📄</div><p className="text-sm">ไฟล์ประเภทนี้แสดงตัวอย่างในเบราว์เซอร์ไม่ได้<br />กด <b>“ดาวน์โหลด”</b> มุมขวาบนเพื่อเปิด</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
