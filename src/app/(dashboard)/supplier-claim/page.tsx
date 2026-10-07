"use client"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"
import { getSplits, claimSplitState } from "@/lib/claim"

// SUPPLIER CLAIM — every document with a PROCUREMENT claim split, split into "not claimed from the supplier
// yet" / "claimed" (SupplierClaim rows: doc no. + amount, keyed on the document page). Procurement + Admin.
const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const ALLOWED = ["CLAIM_PROCUREMENT", "VP_PROCUREMENT", "ADMIN"]
const PAST_CLAIM = ["COMPLETED", "ACCOUNTING_PENDING", "PRESIDENT_PENDING"]

export default function SupplierClaimPage() {
  const { data: session } = useSession()
  const myRoles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const allowed = myRoles.some(r => ALLOWED.includes(r))
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"todo" | "done" | "all">("todo")
  const [q, setQ] = useState("")
  const [onlyAccepted, setOnlyAccepted] = useState(false)

  useEffect(() => { fetch("/api/requests").then(r => r.json()).then(d => { setRequests(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false)) }, [])

  // one row per document: its PROCUREMENT part (SO count, actual × %, accepted or not) + supplier claims
  const rows = useMemo(() => requests.filter(r => !r.isTest && r.status !== "REJECTED").map(r => {
    let so = 0, act = 0, est = 0, acc = 0, pend = 0
    const reasons = new Set<string>()
    for (const it of (r.items || [])) {
      if (it.itemStatus === "REJECTED") continue
      const sp = getSplits(it).find((s: any) => s.dept === "PROCUREMENT")
      if (!sp) continue
      const pct = (Number(sp.pct) || 0) / 100
      so++; act += (Number(it.actualAirFreight) || 0) * pct; est += (Number(it.airFreight) || 0) * pct
      if (sp.reason) reasons.add(String(sp.reason))
      const ok = PAST_CLAIM.includes(it.itemStatus) || claimSplitState(sp.dept, sp.status, sp).s === "approved"
      ok ? acc++ : pend++
    }
    if (!so) return null
    const sc: any[] = r.supplierClaims || []
    return { id: r.id, docNo: r.documentNo, bu: r.bu, brand: [...new Set((r.items || []).map((i: any) => i.brand).filter(Boolean))].join(", ") || r.brandName || "",
      status: r.status, so, act, est, acc, pend, reasons: [...reasons].join(", "), sc,
      scAmt: sc.reduce((s, c) => s + (Number(c.amount) || 0), 0), scRef: sc.map(c => c.refNo).join(", ") }
  }).filter(Boolean) as any[], [requests])

  const view = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rows.filter(r => tab === "all" || (tab === "done" ? r.sc.length > 0 : r.sc.length === 0))
      .filter(r => !onlyAccepted || r.pend === 0)
      .filter(r => !t || [r.docNo, r.brand, r.scRef, r.reasons].some(x => String(x).toLowerCase().includes(t)))
      .sort((a, b) => b.act - a.act)
  }, [rows, tab, q, onlyAccepted])

  const todo = rows.filter(r => !r.sc.length), done = rows.filter(r => r.sc.length)
  const sum = (xs: any[], k: string) => xs.reduce((s, r) => s + (Number(r[k]) || 0), 0)

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(view.map(r => ({ "เอกสาร": r.docNo, BU: r.bu, Brand: r.brand, "SO (Procurement)": r.so,
      "Actual ส่วน Procurement": Math.round(r.act), "Est ส่วน Procurement": Math.round(r.est), "Accepted SO": r.acc, "Pending SO": r.pend,
      Reason: r.reasons, "เลขเอกสารเคลม supplier": r.scRef, "ยอดเคลม supplier": r.scAmt })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Supplier claim")
    XLSX.writeFile(wb, `supplier-claim-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (session && !allowed) return <div className="p-6 text-sm text-gray-500">หน้านี้สำหรับทีม Procurement และ Admin</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">🧾 Supplier Claim</h1>
        <p className="text-xs text-gray-500 mt-0.5">เอกสารที่มีเคลม PROCUREMENT · บันทึกเลขเอกสาร + ยอดเคลม supplier ในหน้าเอกสาร (กล่อง “เคลม Supplier”)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-500 font-semibold">ยังไม่ได้เคลม supplier</p>
          <p className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{todo.length} <span className="text-sm text-gray-400 font-medium">เอกสาร</span></p>
          <p className="text-[11px] text-gray-400 tabular-nums">ส่วน Procurement {fmt(sum(todo, "act"))} THB</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-500 font-semibold">เคลม supplier แล้ว</p>
          <p className="text-2xl font-bold text-green-700 tabular-nums mt-1">{done.length} <span className="text-sm text-gray-400 font-medium">เอกสาร</span></p>
          <p className="text-[11px] text-gray-400 tabular-nums">ส่วน Procurement {fmt(sum(done, "act"))} THB</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-500 font-semibold">ยอดที่เคลม supplier ได้</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{fmt(sum(done, "scAmt"))} <span className="text-sm text-gray-400 font-medium">THB</span></p>
          <p className="text-[11px] text-gray-400 tabular-nums">{done.reduce((s, r) => s + r.sc.length, 0)} รายการเคลม</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {([["todo", `ยังไม่ได้เคลม (${todo.length})`], ["done", `เคลมแล้ว (${done.length})`], ["all", `ทั้งหมด (${rows.length})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-xs px-3 py-1.5 rounded-full border ${tab === k ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300"}`}>{l}</button>
          ))}
          <label className="text-xs text-gray-600 flex items-center gap-1 ml-2"><input type="checkbox" checked={onlyAccepted} onChange={e => setOnlyAccepted(e.target.checked)} /> เฉพาะที่ Procurement accept ครบแล้ว</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา เอกสาร / brand / เลขเคลม / reason" className="ml-auto text-xs border border-gray-300 rounded-lg px-3 py-1.5 w-64 max-w-full" />
          <button onClick={exportXlsx} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700">⬇ Excel</button>
        </div>

        {loading ? <p className="text-sm text-gray-400 py-8 text-center">กำลังโหลด…</p> : view.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center">ไม่มีเอกสาร</p> : (
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="bg-gray-50 text-gray-500"><tr className="text-left">
                <th className="px-3 py-2 font-medium">เอกสาร</th><th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium text-right">SO</th>
                <th className="px-3 py-2 font-medium text-right">Actual ส่วน Proc. (THB)</th>
                <th className="px-3 py-2 font-medium">สถานะเคลม Proc.</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">เลขเอกสารเคลม supplier</th>
                <th className="px-3 py-2 font-medium text-right">ยอดเคลม supplier</th>
                <th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>{view.map(r => (
                <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-1.5 font-mono text-gray-800 whitespace-nowrap">{r.docNo}</td>
                  <td className="px-3 py-1.5 text-gray-600 max-w-[180px] truncate" title={r.brand}>{r.brand}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.so}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fmt(r.act)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {r.pend === 0 ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">✓ Accepted</span>
                      : <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">⏳ {r.pend}/{r.so} SO รออนุมัติ</span>}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 max-w-[200px] truncate" title={r.reasons}>{r.reasons || "-"}</td>
                  <td className="px-3 py-1.5 font-mono">{r.scRef || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-green-700">{r.sc.length ? fmt(r.scAmt) : ""}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <a href={`/requests/${r.id}`} className={`inline-block px-2.5 py-1 rounded-lg font-semibold ${r.sc.length ? "border border-gray-200 text-gray-600 hover:bg-gray-50" : "bg-green-600 text-white hover:bg-green-700"}`}>
                      {r.sc.length ? "เปิดดู →" : "บันทึกเคลม →"}
                    </a>
                  </td>
                </tr>
              ))}</tbody>
              <tfoot className="bg-gray-50 font-semibold"><tr>
                <td className="px-3 py-1.5" colSpan={2}>รวม {view.length} เอกสาร</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{sum(view, "so")}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(sum(view, "act"))}</td>
                <td colSpan={3}></td>
                <td className="px-3 py-1.5 text-right tabular-nums text-green-700">{fmt(sum(view, "scAmt"))}</td><td></td>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
