"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON, BUS, fmt, fmtDate, buColor, STATUS_LABEL } from "../_StageWork"
import { pullReqType } from "@/lib/pull-reqtype"
import DateRangePicker from "@/components/pull/DateRangePicker"

// REPORT — the whole Pull RM dataset in one place: filter, look, export.
// The LOGISTICS page stays a work queue (only what LG still owes); this page carries EVERY document of
// every stage so anyone can pull a proper Excel report (one row per PO, all money + FWD columns).
const norm = (v: any) => String(v || "").toLowerCase()
const dstr = (v: any) => (v ? String(v).slice(0, 10) : "")
const earliestD = (arr: any[]) => { const t = arr.map(v => (v ? new Date(v).getTime() : NaN)).filter(n => !isNaN(n)); return t.length ? new Date(Math.min(...t)).toISOString().slice(0, 10) : "" }

export default function ReportPage() {
  const { data: session, status: auth } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const canUse = roles.some(r => ["ADMIN", "LOGISTICS_IMPORT", "PURCHASING", "SCM_PULL", "DVM_PUR", "VP_PUR", "PULL_DVM_SCM", "VP_SCM", "PULL_PRESIDENT"].includes(r))

  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [bu, setBu] = useState("ALL")
  const [q, setQ] = useState("")
  const [statusF, setStatusF] = useState("ALL")
  const [modeF, setModeF] = useState("ALL")
  const [portF, setPortF] = useState("ALL")
  const [brandF, setBrandF] = useState("ALL")
  const [etcFrom, setEtcFrom] = useState("")
  const [etcTo, setEtcTo] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const results = await Promise.all(BUS.map(b => fetch(`/api/pull-material?bu=${b}`).then(r => r.json()).catch(() => ({}))))
      const seen = new Set<string>()
      setReqs(results.flatMap((d: any) => d.requests || []).filter((r: any) => { if (seen.has(r.id)) return false; seen.add(r.id); return true }))
    } finally { setLoading(false) }
  }
  useEffect(() => { if (canUse) load() }, [canUse]) // eslint-disable-line

  // ── filters ────────────────────────────────────────────────────────────────────────────────────
  const docPorts = (r: any) => [...new Set((r.items || []).map((i: any) => i.port).filter(Boolean))] as string[]
  const docBrands = (r: any) => [...new Set((r.items || []).map((i: any) => i.brand).filter(Boolean))] as string[]
  const docEtcs = (r: any) => (r.items || []).map((i: any) => dstr(i.etc)).filter(Boolean) as string[]
  const allPorts = [...new Set(reqs.flatMap(docPorts))].sort()
  const allBrands = [...new Set(reqs.flatMap(docBrands))].sort()
  const allStatuses = [...new Set(reqs.map(r => r.status).filter(Boolean))].sort()

  const rows = reqs.filter(r => {
    if (bu !== "ALL" && r.bu !== bu) return false
    if (statusF !== "ALL" && r.status !== statusF) return false
    if (modeF !== "ALL" && (r.shipMode || r.approvedMode || "") !== modeF) return false
    if (portF !== "ALL" && !docPorts(r).includes(portF)) return false
    if (brandF !== "ALL" && !docBrands(r).includes(brandF)) return false
    if (etcFrom || etcTo) {
      const es = docEtcs(r)
      if (!es.length || !es.some(e => (!etcFrom || e >= etcFrom) && (!etcTo || e <= etcTo))) return false
    }
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return [r.documentNo, r.requesterName, r.requesterEmail, r.hawbNo, r.mawbNo, r.invoiceNo, r.fwdName,
      ...(r.items || []).flatMap((i: any) => [i.poNoDoc, i.soNoDoc, i.brand, i.vendorName, i.port])]
      .some((v: any) => norm(v).includes(needle))
  })

  // Totals shown above the table (USD, same unit the system stores).
  const estOf = (r: any) => (r.items || []).reduce((a: number, i: any) => a + (Number(i.airFreightCost) || 0), 0)
  const sumEst = rows.reduce((a, r) => a + estOf(r), 0)
  const sumAct = rows.reduce((a, r) => a + (Number(r.actualAir) || 0), 0)

  // ── export: one row per PO, every column a report needs ────────────────────────────────────────
  const exportExcel = async () => {
    if (!rows.length) return alert("ไม่มีข้อมูลให้ export")
    setExporting(true)
    try {
      const ExcelJS: any = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Pull RM report")
      ws.columns = [
        { header: "DOCUMENT NO", key: "doc", width: 22 }, { header: "BU", key: "bu", width: 8 },
        { header: "TYPE", key: "type", width: 12 }, { header: "STATUS", key: "status", width: 20 },
        { header: "REQUESTER", key: "requester", width: 18 }, { header: "PURCHASER", key: "purchaser", width: 18 },
        { header: "BRAND", key: "brand", width: 14 }, { header: "SUPPLIER", key: "supplier", width: 26 },
        { header: "SO", key: "so", width: 16 }, { header: "PO NO", key: "po", width: 16 },
        { header: "QTY AIR", key: "qty", width: 12 }, { header: "UOM", key: "uom", width: 8 },
        { header: "INVOICE NO", key: "inv", width: 18 },
        { header: "COUNTRY", key: "country", width: 14 }, { header: "AIR PORT", key: "port", width: 10 },
        { header: "SEA PORT", key: "seaport", width: 12 }, { header: "INCOTERM", key: "incoterm", width: 10 },
        { header: "WEIGHT (KG)", key: "weight", width: 12 }, { header: "PACKAGE", key: "package", width: 14 },
        { header: "ETC", key: "etc", width: 12 }, { header: "NEED DATE", key: "needDate", width: 12 },
        { header: "MRD", key: "mrd", width: 12 }, { header: "SHIPMENT DATE", key: "shipDate", width: 14 },
        { header: "SHIP MODE (LG)", key: "mode", width: 14 }, { header: "MODE APPROVED", key: "amode", width: 14 },
        { header: "MODE REASON", key: "mreason", width: 26 },
        { header: "EST AIR (USD)", key: "est", width: 14 }, { header: "PRE COST (USD)", key: "pre", width: 14 },
        { header: "ACTUAL (USD)", key: "act", width: 14 }, { header: "LOCAL CHARGE (USD)", key: "local", width: 16 },
        { header: "DIFF (USD)", key: "diff", width: 12 }, { header: "CURRENCY TYPED", key: "cur", width: 14 },
        { header: "FWD", key: "fwd", width: 14 }, { header: "FWD RATE (THB/KG)", key: "rate", width: 16 },
        { header: "FWD SENT", key: "sent", width: 13 }, { header: "FWD PHASE", key: "phase", width: 10 },
        { header: "ACTUAL SOURCE", key: "src", width: 13 },
        { header: "MAWB", key: "mawb", width: 16 }, { header: "HAWB", key: "hawb", width: 16 },
        { header: "FLIGHT ETD", key: "etd", width: 12 }, { header: "FLIGHT ETA", key: "eta", width: 12 },
        { header: "CFM IN-HOUSE", key: "cfm", width: 13 }, { header: "CREATED", key: "created", width: 12 },
      ]
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E9E9" } }
      ws.views = [{ state: "frozen", ySplit: 1 }]

      for (const r of rows) {
        const its: any[] = r.items || []
        const d0 = its.find((x: any) => x.airFreightCost != null) || its[0] || {}
        const est = estOf(r)
        const pkgs = Array.isArray(r.packages) ? r.packages : []
        const pkgStr = pkgs.length ? pkgs.map((p: any) => `${p.qty} ${p.uom}`).join(", ") : (d0.cartons ?? "")
        const byPo: Record<string, { qty: number; uoms: Set<string>; sos: Set<string>; vend: Set<string>; brand: Set<string> }> = {}
        its.forEach(it => {
          const po = it.poNoDoc || "-"
          const g = (byPo[po] ||= { qty: 0, uoms: new Set(), sos: new Set(), vend: new Set(), brand: new Set() })
          g.qty += Number(it.pullMaterialQty) || 0
          if (it.bomUom) g.uoms.add(it.bomUom); if (it.soNoDoc) g.sos.add(it.soNoDoc)
          if (it.vendorName) g.vend.add(it.vendorName); if (it.brand) g.brand.add(it.brand)
        })
        for (const po of Object.keys(byPo)) {
          const g = byPo[po]
          ws.addRow({
            doc: r.documentNo, bu: r.bu, type: pullReqType(r), status: STATUS_LABEL?.[r.status] || r.status,
            requester: r.requesterName || "", purchaser: r.purchaserName || r.purchaserEmail || "",
            brand: [...g.brand].join(", "), supplier: [...g.vend].join(", "),
            so: [...g.sos].join(", "), po, qty: g.qty || "", uom: [...g.uoms].join(", "),
            inv: (r.poInvoices || {})[po] || r.invoiceNo || "",
            country: d0.country || "", port: d0.port || "", seaport: d0.seaPort || "", incoterm: d0.incoterm || "",
            weight: d0.weight != null ? Number(d0.weight) : "", package: pkgStr,
            etc: dstr(d0.etc), needDate: dstr(d0.needDate),
            mrd: earliestD(its.flatMap(i => [i.shipmentDate, i.mrdDate, i.mrdNeedDate, i.mrd2])),
            shipDate: earliestD(its.map(i => i.shipmentDate)),
            mode: r.shipMode || "", amode: r.approvedMode || "", mreason: r.shipModeReason || "",
            est: est || "", pre: r.preCost != null ? Number(r.preCost) : "",
            act: r.actualAir != null ? Number(r.actualAir) : "",
            local: r.localChargeTh != null ? Number(r.localChargeTh) : "",
            diff: r.actualAir != null ? Math.round(((Number(r.actualAir) || 0) - est) * 100) / 100 : "",
            cur: r.actualCurrency || "", fwd: r.fwdName || r.preCostFwd || "",
            rate: r.fwdRateThbPerKg != null ? Number(r.fwdRateThbPerKg) : "",
            sent: dstr(r.fwdSentAt), phase: r.fwdPhase || "", src: r.actualSource || "",
            mawb: r.mawbNo || "", hawb: r.hawbNo || "", etd: dstr(r.flightEtd), eta: dstr(r.flightEta),
            cfm: dstr(r.cfmInHouseDate), created: dstr(r.createdAt),
          })
        }
      }
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url
      a.download = `PullRM_report_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) { alert("Export ไม่สำเร็จ: " + String((e as any)?.message || e).slice(0, 160)) } finally { setExporting(false) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">ไม่มีสิทธิ์เข้าหน้านี้</p></div>

  const sel = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
  return (
    <div className="p-5 md:p-8 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: MAROON }}>REPORT</h1>
          <p className="text-sm text-gray-500 mt-1">ข้อมูล Pull Material ทั้งหมดทุกสถานะ — กรองแล้ว export เป็น Excel (1 แถว = 1 PO)</p>
        </div>
        <button onClick={exportExcel} disabled={exporting || !rows.length}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: MAROON }}>
          {exporting ? "กำลังสร้าง…" : `📊 Export Excel (${rows.length} ใบ)`}
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">{["ALL", ...BUS].map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
          style={bu === b ? { background: b === "ALL" ? MAROON : buColor(b) } : undefined}>{b === "ALL" ? "ALL BU" : b}</button>
      ))}</div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">ค้นหา</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 เลขเอกสาร / PO / SO / Brand / Supplier / HAWB / FWD…"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200" />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">สถานะ</label>
          <select value={statusF} onChange={e => setStatusF(e.target.value)} className={sel + " max-w-[190px]"}>
            <option value="ALL">ทุกสถานะ</option>
            {allStatuses.map(s => <option key={s} value={s}>{STATUS_LABEL?.[s] || s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">Mode</label>
          <select value={modeF} onChange={e => setModeF(e.target.value)} className={sel}>
            {["ALL", "AIR", "SEA", "COURIER"].map(m => <option key={m} value={m}>{m === "ALL" ? "ทุก mode" : m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">Brand</label>
          <select value={brandF} onChange={e => setBrandF(e.target.value)} className={sel + " max-w-[170px]"}>
            <option value="ALL">ทุก Brand</option>{allBrands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">Port</label>
          <select value={portF} onChange={e => setPortF(e.target.value)} className={sel}>
            <option value="ALL">ทุก Port</option>{allPorts.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <DateRangePicker label="ETC (ช่วงวันที่)" from={etcFrom} to={etcTo} placeholder="ทุกวัน ETC"
          onChange={(f, t) => { setEtcFrom(f); setEtcTo(t) }} />
        {(q || statusF !== "ALL" || modeF !== "ALL" || portF !== "ALL" || brandF !== "ALL" || etcFrom || etcTo) && (
          <button onClick={() => { setQ(""); setStatusF("ALL"); setModeF("ALL"); setPortF("ALL"); setBrandF("ALL"); setEtcFrom(""); setEtcTo("") }}
            className="px-2 py-1.5 text-xs text-gray-500 underline">ล้าง filter</button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="px-3 py-1.5 rounded-lg bg-white border border-gray-200">เอกสาร <b>{rows.length}</b> ใบ</span>
        <span className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800">Est รวม <b>{fmt(sumEst)}</b> USD</span>
        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">Actual รวม <b>{fmt(sumAct)}</b> USD</span>
        {sumAct > 0 && <span className={`px-3 py-1.5 rounded-lg border ${sumAct - sumEst > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          ส่วนต่าง <b>{sumAct - sumEst > 0 ? "▲" : "▼"} {fmt(Math.abs(sumAct - sumEst))}</b> USD</span>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        {loading ? <p className="p-6 text-sm text-gray-400">Loading…</p> : rows.length === 0 ? (
          <p className="p-10 text-center text-gray-400 text-sm">ไม่พบเอกสารตามตัวกรอง</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>{["DOC NO", "BU", "STATUS", "MODE", "PORT", "ETC", "WEIGHT", "EST (USD)", "ACTUAL (USD)", "DIFF", "FWD"].map(h =>
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.slice(0, 200).map(r => {
                const its = r.items || []
                const d0 = its.find((x: any) => x.airFreightCost != null) || its[0] || {}
                const est = estOf(r), act = Number(r.actualAir) || 0
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{r.documentNo}</td>
                    <td className="px-3 py-1.5">{r.bu}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{STATUS_LABEL?.[r.status] || r.status}</td>
                    <td className="px-3 py-1.5">{r.shipMode || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5">{d0.port || "-"}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(d0.etc)}</td>
                    <td className="px-3 py-1.5 text-right">{d0.weight != null ? fmt(d0.weight) : "-"}</td>
                    <td className="px-3 py-1.5 text-right">{est ? fmt(est) : "-"}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{act ? fmt(act) : "-"}</td>
                    <td className={`px-3 py-1.5 text-right ${act && act - est > 0 ? "text-red-600" : "text-emerald-600"}`}>{act ? `${act - est > 0 ? "▲" : "▼"} ${fmt(Math.abs(act - est))}` : "-"}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.fwdName || r.preCostFwd || "-"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {rows.length > 200 && <p className="text-[11px] text-gray-400">* แสดงตัวอย่าง 200 แถวแรก — ไฟล์ Excel จะได้ครบทั้ง {rows.length} ใบ</p>}
    </div>
  )
}
