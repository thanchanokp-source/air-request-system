"use client"
import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import React from "react"

type FolderType = "FINAL" | "LOGISTICS" | "BOOKING"
type BUFilter = "ALL" | "NYG" | "GW"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; return `${String(d.getDate()).padStart(2,"0")}/${MONTHS[d.getMonth()]}/${d.getFullYear()}` }
const fmtNum = (v: any) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-"

const PRESIDENT_STATUSES = [
  "PENDING_LOGISTICS","PENDING_LOGISTICS_GW","PENDING_CLAIM","PENDING_CLAIM_GW",
  "PENDING_SCM_GW","PENDING_ACCOUNTING","COMPLETED"
]

function qualifies(req: any, type: FolderType): boolean {
  const items: any[] = req.items || []
  if (type === "FINAL") return req.status === "COMPLETED"
  if (type === "LOGISTICS") return items.some((i: any) => i.invoiceNo)
  if (type === "BOOKING") return PRESIDENT_STATUSES.includes(req.status)
  return false
}

const FOLDER_LABELS: Record<FolderType, string> = {
  BOOKING: "Booking File",
  LOGISTICS: "Logistics File",
  FINAL: "Final File",
}
const FOLDER_DESC: Record<FolderType, string> = {
  BOOKING: "หลัง President อนุมัติ — Logistics ใช้เพื่อ booking air",
  LOGISTICS: "หลัง Logistics upload Excel พร้อม Invoice & Freight",
  FINAL: "Request ที่ COMPLETED แล้ว",
}
const FOLDER_COLOR: Record<FolderType, string> = {
  BOOKING: "text-blue-700 bg-blue-50",
  LOGISTICS: "text-orange-700 bg-orange-50",
  FINAL: "text-green-700 bg-green-50",
}

export default function FilesPage() {
  const { data: session } = useSession()
  const userBu = (session?.user as any)?.bu || "ALL"

  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFolder, setActiveFolder] = useState<FolderType>("BOOKING")
  const [activeBU, setActiveBU] = useState<BUFilter>(userBu === "NYG" ? "NYG" : userBu === "GW" ? "GW" : "ALL")
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => {
      setRequests(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (activeBU !== "ALL" && r.bu !== activeBU) return false
      return qualifies(r, activeFolder)
    })
  }, [requests, activeFolder, activeBU])

  const grouped = useMemo(() => {
    const byYear: Record<string, Record<string, any[]>> = {}
    filtered.forEach(r => {
      const d = new Date(r.createdAt)
      const year = String(d.getFullYear())
      const month = MONTHS[d.getMonth()]
      if (!byYear[year]) byYear[year] = {}
      if (!byYear[year][month]) byYear[year][month] = []
      byYear[year][month].push(r)
    })
    return byYear
  }, [filtered])

  const years = Object.keys(grouped).sort().reverse()

  const toggleYear = (y: string) => setExpandedYears(p => { const n = new Set(p); n.has(y) ? n.delete(y) : n.add(y); return n })
  const toggleMonth = (k: string) => setExpandedMonths(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })
  const toggleDoc = (k: string) => setExpandedDocs(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  const downloadPdf = async (req: any, item: any) => {
    const key = `${req.id}-${item.id}`
    setPdfLoading(key)
    try {
      const fullReq = await fetch(`/api/requests/${req.id}`).then(r => r.json())
      const fullItem = fullReq.items?.find((i: any) => i.id === item.id) || item
      const [{ pdf }, { RequestPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/request-pdf"),
      ])
      const element = React.createElement(RequestPdfDocument as any, { req: fullReq, item: fullItem })
      const blob = await (pdf(element as any) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fullReq.documentNo}_${fullItem.so}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { alert("PDF generation failed") }
    finally { setPdfLoading(null) }
  }

  const buOptions: BUFilter[] = ["ALL", "NYG", "GW"]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ALL FILES</h1>
        <p className="text-xs text-gray-400 mt-0.5">เอกสารที่ระบบ generate แยกตาม BU และประเภท</p>
      </div>

      <div className="flex gap-4 items-start">
        {/* Left: folder tree */}
        <div className="w-56 shrink-0 bg-white rounded-xl border border-gray-200 p-3 space-y-1 self-start sticky top-4">
          <p className="text-xs font-semibold text-gray-500 px-2 mb-2 uppercase tracking-wide">Folders</p>

          {/* BU filter */}
          <div className="flex gap-1 px-2 mb-3">
            {buOptions.map(b => (
              <button key={b} onClick={() => setActiveBU(b)}
                className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${activeBU === b ? "bg-red-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {b}
              </button>
            ))}
          </div>

          {(["BOOKING","LOGISTICS","FINAL"] as FolderType[]).map(f => {
            const count = requests.filter(r => (activeBU === "ALL" || r.bu === activeBU) && qualifies(r, f)).length
            return (
              <button key={f} onClick={() => setActiveFolder(f)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeFolder === f ? `${FOLDER_COLOR[f]} font-medium` : "text-gray-700 hover:bg-gray-50"}`}>
                <span className="text-base">📁</span>
                <span className="flex-1 truncate">{FOLDER_LABELS[f]}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeFolder === f ? "bg-white/60" : "bg-gray-100 text-gray-500"}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Right: content */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div>
              <h2 className="font-semibold text-gray-800">{FOLDER_LABELS[activeFolder]}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{FOLDER_DESC[activeFolder]}</p>
            </div>
            <span className="ml-auto text-xs text-gray-400">{filtered.length} document(s)</span>
          </div>

          {loading && <div className="text-center py-16 text-gray-400">Loading...</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-300">
              <p className="text-4xl mb-2">📂</p>
              <p className="text-sm">ไม่มีไฟล์ใน folder นี้</p>
            </div>
          )}

          {/* Year/Month tree */}
          <div className="divide-y divide-gray-50">
            {years.map(year => (
              <div key={year}>
                {/* Year row */}
                <button onClick={() => toggleYear(year)}
                  className="w-full flex items-center gap-3 px-5 py-3 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 text-left">
                  <span className="text-gray-400 text-xs w-3">{expandedYears.has(year) ? "▼" : "▶"}</span>
                  <span>📅 {year}</span>
                  <span className="text-xs font-normal text-gray-400 ml-auto">
                    {Object.values(grouped[year]).flat().length} docs
                  </span>
                </button>

                {expandedYears.has(year) && Object.keys(grouped[year]).map(month => {
                  const monthKey = `${year}-${month}`
                  return (
                    <div key={monthKey} className="border-t border-gray-50">
                      {/* Month row */}
                      <button onClick={() => toggleMonth(monthKey)}
                        className="w-full flex items-center gap-3 pl-10 pr-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50 text-left">
                        <span className="text-gray-400 text-xs w-3">{expandedMonths.has(monthKey) ? "▼" : "▶"}</span>
                        <span>📂 {month}</span>
                        <span className="text-xs text-gray-400 ml-auto">{grouped[year][month].length} docs</span>
                      </button>

                      {expandedMonths.has(monthKey) && grouped[year][month].map((req: any) => {
                        const docKey = req.id
                        const items: any[] = req.items || []
                        return (
                          <div key={docKey} className="border-t border-gray-50">
                            {/* Document row */}
                            <button onClick={() => toggleDoc(docKey)}
                              className="w-full flex flex-wrap items-center gap-2 pl-16 pr-5 py-2.5 hover:bg-blue-50 text-left group">
                              <span className="text-gray-400 text-xs w-3">{expandedDocs.has(docKey) ? "▼" : "▶"}</span>
                              <span className="font-semibold text-blue-700 text-sm">{req.documentNo}</span>
                              <span className="text-xs text-gray-400">{req.brandName}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${req.bu === "GW" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{req.bu}</span>
                              <span className="text-xs text-gray-400 ml-auto">{items.length} SO(s) · {fmtDate(req.createdAt)}</span>
                            </button>

                            {/* Items under document */}
                            {expandedDocs.has(docKey) && (
                              <div className="pl-20 pr-5 pb-3 bg-blue-50 border-t border-blue-100">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs mt-2">
                                    <thead>
                                      <tr className="text-gray-500">
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">SO</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Style</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Description</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">QTY Air</th>
                                        {activeFolder === "LOGISTICS" && <>
                                          <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Invoice No</th>
                                          <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">QTY Ship</th>
                                          <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Actual Freight</th>
                                          <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Booking Date</th>
                                        </>}
                                        <th className="text-right py-1 font-medium">PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-blue-100">
                                      {items.map((item: any) => {
                                        const key = `${req.id}-${item.id}`
                                        return (
                                          <tr key={item.id} className="hover:bg-blue-100/50">
                                            <td className="py-1.5 pr-3 font-medium text-gray-800">{item.so}</td>
                                            <td className="py-1.5 pr-3 text-gray-600">{item.style}</td>
                                            <td className="py-1.5 pr-3 text-gray-500 max-w-[140px] truncate">{item.description}</td>
                                            <td className="py-1.5 pr-3 text-gray-700 font-semibold">{item.qtyRequestAir}</td>
                                            {activeFolder === "LOGISTICS" && <>
                                              <td className="py-1.5 pr-3">{item.invoiceNo || "-"}</td>
                                              <td className="py-1.5 pr-3">{item.qtyActualShip ?? "-"}</td>
                                              <td className="py-1.5 pr-3 text-green-700 font-semibold">{fmtNum(item.actualAirFreight)}</td>
                                              <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
                                            </>}
                                            <td className="py-1.5 text-right">
                                              <button onClick={() => downloadPdf(req, item)}
                                                disabled={pdfLoading === key}
                                                className="text-xs bg-gray-700 text-white px-2 py-0.5 rounded hover:bg-gray-800 disabled:opacity-50 font-medium">
                                                {pdfLoading === key ? "..." : "↓ PDF"}
                                              </button>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
