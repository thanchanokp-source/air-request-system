"use client"

import React from "react"
import { useState, useEffect, useCallback } from "react"

interface Item {
  id: string; so: string; style: string; customerPO?: string; country?: string
  factory?: string; grossWeight?: number; qtyRequestAir: number; qtyActualShip?: number
  actualAirFreight?: number; claimDepartment?: string; invoiceNo?: string
}

interface HawbGroup {
  id: string; hawbNo: string; totalCharge: number; items: Item[]
}

interface Props {
  requestId: string
  presPassedItems: Item[]
  onReqRefresh: () => void
  reqInfo?: { documentNo: string; brandName: string; buName: string }
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function HawbSection({ requestId, presPassedItems, onReqRefresh, reqInfo }: Props) {
  const [hawbs, setHawbs] = useState<HawbGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [hawbNo, setHawbNo] = useState("")
  const [totalCharge, setTotalCharge] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportFile, setReportFile] = useState<any>(null)
  const [downloadingHawbId, setDownloadingHawbId] = useState<string | null>(null)

  const loadHawbs = useCallback(async () => {
    const res = await fetch(`/api/requests/${requestId}/hawb`)
    if (res.ok) setHawbs(await res.json())
    setLoading(false)
  }, [requestId])

  useEffect(() => { loadHawbs() }, [loadHawbs])

  const assignedIds = new Set(hawbs.flatMap(h => h.items.map(i => i.id)))
  const unassigned = presPassedItems.filter(i => !assignedIds.has(i.id))

  const selectedItems = presPassedItems.filter(i => checked.has(i.id))
  const chargeNum = parseFloat(totalCharge) || 0
  const totalQty = selectedItems.reduce((s, i) => s + (i.qtyActualShip ?? i.qtyRequestAir), 0)
  const costPerPc = totalQty > 0 && chargeNum > 0 ? chargeNum / totalQty : 0

  const toggleCheck = (id: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleAll = () =>
    setChecked(prev => prev.size === unassigned.length ? new Set() : new Set(unassigned.map(i => i.id)))

  const createHawb = async () => {
    if (!hawbNo.trim() || chargeNum <= 0 || checked.size === 0) return
    setSaving(true)
    const res = await fetch(`/api/requests/${requestId}/hawb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hawbNo: hawbNo.trim(), totalCharge: chargeNum, itemIds: [...checked] })
    })
    const data = await res.json()
    if (res.ok) {
      await loadHawbs()
      onReqRefresh()
      setChecked(new Set()); setHawbNo(""); setTotalCharge(""); setModalOpen(false)
    } else {
      alert(data.error || "สร้าง HAWB ไม่สำเร็จ")
    }
    setSaving(false)
  }

  const deleteHawb = async (hawbId: string) => {
    if (!confirm("ลบ HAWB นี้และรีเซ็ต Air Freight ของ SO ที่เกี่ยวข้อง?")) return
    setDeletingId(hawbId)
    const res = await fetch(`/api/requests/${requestId}/hawb/${hawbId}`, { method: "DELETE" })
    if (res.ok) { await loadHawbs(); onReqRefresh() }
    setDeletingId(null)
  }

  const generateReport = async () => {
    setGeneratingReport(true)
    const res = await fetch(`/api/requests/${requestId}/hawb/report`, { method: "POST" })
    const data = await res.json()
    if (res.ok) { setReportFile(data) }
    else { alert(data.error || "Generate PDF ไม่สำเร็จ") }
    setGeneratingReport(false)
  }

  const downloadHawbPdf = async (hawb: HawbGroup) => {
    setDownloadingHawbId(hawb.id)
    try {
      const [{ pdf }, { HawbPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./request-pdf"),
      ])
      const doc = React.createElement(HawbPdfDocument, {
        hawbNo: hawb.hawbNo,
        totalCharge: hawb.totalCharge,
        items: hawb.items,
        documentNo: reqInfo?.documentNo || requestId,
        brandName: reqInfo?.brandName || "-",
        buName: reqInfo?.buName || "-",
      }) as any
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `HAWB_${hawb.hawbNo}_${reqInfo?.documentNo || requestId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert("PDF generation failed")
    } finally {
      setDownloadingHawbId(null)
    }
  }

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">กำลังโหลด...</div>

  return (
    <div className="space-y-4">

      {/* Unassigned SOs */}
      {unassigned.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">SO ที่ยังไม่มี HAWB ({unassigned.length} รายการ)</p>
            {checked.size > 0 && (
              <button
                onClick={() => { setModalOpen(true) }}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700">
                + สร้าง HAWB ({checked.size} SO)
              </button>
            )}
          </div>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={checked.size === unassigned.length && unassigned.length > 0}
                      onChange={toggleAll} className="rounded" />
                  </th>
                  {["SO","STYLE","CLAIM TO","QTY AIR","VWT (KG)"].map(h =>
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unassigned.map(item => (
                  <tr key={item.id} className={checked.has(item.id) ? "bg-blue-50" : "hover:bg-gray-50"}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggleCheck(item.id)} className="rounded" />
                    </td>
                    <td className="px-3 py-2 font-medium">{item.so}</td>
                    <td className="px-3 py-2">{item.style}</td>
                    <td className="px-3 py-2">{item.claimDepartment || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-right">{item.qtyActualShip ?? item.qtyRequestAir}</td>
                    <td className="px-3 py-2 text-right">{item.grossWeight != null ? fmt(item.grossWeight) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {checked.size === 0 && (
            <p className="text-xs text-gray-400">☑ เลือก SO ที่จะรวมใน HAWB เดียวกัน แล้วกด "สร้าง HAWB"</p>
          )}
        </div>
      )}

      {/* HAWB List */}
      {hawbs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-600">HAWB ที่สร้างแล้ว ({hawbs.length})</p>
          {hawbs.map(hawb => {
            const qty = hawb.items.reduce((s, i) => s + (i.qtyActualShip ?? i.qtyRequestAir), 0)
            const avg = qty > 0 ? hawb.totalCharge / qty : 0
            const hawbTotal = hawb.items.reduce((s, i) => s + (i.actualAirFreight ?? 0), 0)
            return (
              <div key={hawb.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between bg-slate-800 text-white px-4 py-2">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold">HAWB: {hawb.hawbNo}</span>
                    <span className="text-xs text-slate-300">Total: {fmt(hawb.totalCharge)} THB</span>
                    <span className="text-xs text-slate-300">PCS: {qty}</span>
                    <span className="text-xs text-slate-300">AVG: {fmt(avg)} THB/pc</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      disabled={downloadingHawbId === hawb.id}
                      onClick={() => downloadHawbPdf(hawb)}
                      className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2.5 py-1 rounded font-medium disabled:opacity-40 whitespace-nowrap">
                      {downloadingHawbId === hawb.id ? "..." : "↓ PDF"}
                    </button>
                    <button
                      disabled={deletingId === hawb.id}
                      onClick={() => deleteHawb(hawb.id)}
                      className="text-xs text-red-300 hover:text-red-100 disabled:opacity-40">
                      {deletingId === hawb.id ? "..." : "ลบ"}
                    </button>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["SO","STYLE","QTY","AIR CHARGE (THB)"].map(h =>
                        <th key={h} className="px-3 py-1.5 text-left text-gray-500 font-medium">{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {hawb.items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-medium">{item.so}</td>
                        <td className="px-3 py-1.5">{item.style}</td>
                        <td className="px-3 py-1.5">{item.qtyActualShip ?? item.qtyRequestAir}</td>
                        <td className="px-3 py-1.5 font-semibold text-green-700">
                          {item.actualAirFreight != null ? fmt(item.actualAirFreight) : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t font-semibold">
                      <td className="px-3 py-1.5" colSpan={3}>รวม {hawb.items.length} SO</td>
                      <td className="px-3 py-1.5 text-green-700">{fmt(hawbTotal)} THB</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Generate Report */}
      {unassigned.length === 0 && hawbs.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t">
          <button
            onClick={generateReport}
            disabled={generatingReport}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
            {generatingReport ? "กำลัง Generate..." : "📄 Generate PDF → บันทึก Logistics File"}
          </button>
          {reportFile && (
            <a href={`/api/attachments/${reportFile.id}`} target="_blank" rel="noreferrer"
              className="text-xs text-indigo-600 hover:underline font-medium">
              ✓ {reportFile.fileName}
            </a>
          )}
        </div>
      )}
      {unassigned.length > 0 && hawbs.length > 0 && (
        <p className="text-xs text-amber-600">ยังมี SO ที่ไม่ได้ assign HAWB อีก {unassigned.length} รายการ</p>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-slate-800 text-white px-5 py-3 font-semibold text-sm">สร้าง HAWB</div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">HAWB#</label>
                <input
                  value={hawbNo}
                  onChange={e => setHawbNo(e.target.value)}
                  placeholder="เช่น 37026130294"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total Charge (THB)</label>
                <input
                  type="number" value={totalCharge}
                  onChange={e => setTotalCharge(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {chargeNum > 0 && totalQty > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Total QTY</span><span className="font-bold">{totalQty} pcs</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>AVG / PC</span>
                    <span className="font-bold text-blue-700">{fmt(costPerPc)} THB</span>
                  </div>
                  <div className="border-t pt-2 space-y-1">
                    {selectedItems.map(item => {
                      const qty = item.qtyActualShip ?? item.qtyRequestAir
                      return (
                        <div key={item.id} className="flex justify-between text-gray-500">
                          <span>SO {item.so} ({qty} pcs)</span>
                          <span className="font-medium text-gray-700">{fmt(costPerPc * qty)} THB</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModalOpen(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button
                  onClick={createHawb}
                  disabled={saving || !hawbNo.trim() || chargeNum <= 0}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "กำลังบันทึก..." : "ยืนยัน"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
