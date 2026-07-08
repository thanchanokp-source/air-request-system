"use client"
import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import React from "react"
import { MultiSelect } from "@/components/ui/multi-select"
import { getSplits } from "@/lib/claim"

type FolderType = "FINAL" | "LOGISTICS" | "BOOKING"
type BUFilter = "ALL" | "NYG" | "GW"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; return `${String(d.getDate()).padStart(2,"0")}/${MONTHS[d.getMonth()]}/${d.getFullYear()}` }
const fmtNum = (v: any) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-"

// A document is "ready to book" once it has passed the approval Logistics needs:
//  - NYG: VP SCM approved  → PENDING_LOGISTICS / PENDING_CLAIM and beyond
//  - GW:  GM approved       → PENDING_LOGISTICS_GW / PENDING_CLAIM_GW and beyond
// (President is now the FINAL approver, so these are all post-VP-SCM/GM.)
const BOOK_READY_STATUSES = [
  "PENDING_LOGISTICS", "PENDING_CLAIM", "PENDING_PRESIDENT",
  "PENDING_LOGISTICS_GW", "PENDING_CLAIM_GW", "PENDING_PRESIDENT_GW",
  "PENDING_ACCOUNTING", "COMPLETED",
]

function qualifies(req: any, type: FolderType): boolean {
  const items: any[] = req.items || []
  if (type === "FINAL") return req.status === "COMPLETED"
  if (type === "LOGISTICS") return items.some((i: any) => i.invoiceNo)
  if (type === "BOOKING") return BOOK_READY_STATUSES.includes(req.status)
  return false
}

// Who approved this doc for booking (VP SCM / GM) — from the approval log.
function bookApproval(req: any): { by: string; date: string; role: string } | null {
  const log = (req.approvalLogs || []).find((l: any) =>
    l.action === "APPROVE" && (l.fromStatus === "PENDING_VP_SCM" || l.fromStatus === "PENDING_GM_GW"))
  if (!log) return null
  return { by: log.user?.name || "-", date: log.createdAt, role: log.fromStatus === "PENDING_GM_GW" ? "GM" : "VP SCM" }
}

// A single SO is "booked" once Logistics has processed it (booking date /
// invoice / actual freight filled). Until then it still needs booking.
function itemBooked(item: any): boolean {
  return item.bookingDate != null || !!item.invoiceNo || item.actualAirFreight != null
}
// Booked = every active SO in the document is booked.
function isBooked(req: any): boolean {
  const items = (req.items || []).filter((i: any) => i.itemStatus !== "REJECTED")
  return items.length > 0 && items.every(itemBooked)
}
// How many SO still need booking in this document.
function unbookedCount(req: any): number {
  return (req.items || []).filter((i: any) => i.itemStatus !== "REJECTED" && !itemBooked(i)).length
}

const FOLDER_LABELS: Record<FolderType, string> = {
  BOOKING: "Booking File",
  LOGISTICS: "Logistics File",
  FINAL: "Final File",
}
const FOLDER_DESC: Record<FolderType, string> = {
  BOOKING: "Approved by VP SCM (NYG) / GM (GW) — ready for Logistics to book air",
  LOGISTICS: "After Logistics uploads the Excel with Invoice & Freight",
  FINAL: "Requests that are COMPLETED",
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
  const [combineMode, setCombineMode] = useState(false)
  const [unbookedOnly, setUnbookedOnly] = useState(false)
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set())
  const [combineLoading, setCombineLoading] = useState(false)
  const [brandF, setBrandF] = useState<string[]>([])
  const [styleF, setStyleF] = useState<string[]>([])
  const [soF, setSoF] = useState<string[]>([])
  const [cpF, setCpF] = useState<string[]>([])
  const [claimF, setClaimF] = useState<string[]>([])
  const [invoiceF, setInvoiceF] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => {
      setRequests(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const folderFiltered = useMemo(() =>
    requests.filter(r => (activeBU === "ALL" || r.bu === activeBU) && qualifies(r, activeFolder)),
    [requests, activeFolder, activeBU])

  const uniq = (arr: any[]) => [...new Set(arr.filter(Boolean))].sort()
  const brandOpts = useMemo(() => uniq(folderFiltered.map(r => r.brandName)), [folderFiltered])
  const styleOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.style))), [folderFiltered])
  const soOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.so))), [folderFiltered])
  const cpOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.customerPO))), [folderFiltered])
  const invoiceOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.invoiceNo))), [folderFiltered])
  const claimOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).flatMap((i: any) => getSplits(i).map((s: any) => s.dept)))), [folderFiltered])

  const hasFilter = [brandF, styleF, soF, cpF, claimF, invoiceF].some(f => f.length > 0)

  const filtered = useMemo(() => folderFiltered.filter(r => {
    const items = r.items || []
    if (brandF.length && !brandF.includes(r.brandName)) return false
    if (styleF.length && !items.some((i: any) => styleF.includes(i.style))) return false
    if (soF.length && !items.some((i: any) => soF.includes(i.so))) return false
    if (cpF.length && !items.some((i: any) => cpF.includes(i.customerPO))) return false
    if (invoiceF.length && !items.some((i: any) => invoiceF.includes(i.invoiceNo))) return false
    if (claimF.length && !items.some((i: any) => getSplits(i).some((s: any) => claimF.includes(s.dept)) || claimF.includes(i.claimDepartment))) return false
    if (activeFolder === "BOOKING" && unbookedOnly && unbookedCount(r) === 0) return false
    return true
  }), [folderFiltered, brandF, styleF, soF, cpF, invoiceF, claimF, activeFolder, unbookedOnly])

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

  const generateCombinedPdf = async () => {
    if (selectedForCombine.size === 0) return
    setCombineLoading(true)
    try {
      // Group by reqId → itemId list
      const reqItemMap: Record<string, string[]> = {}
      selectedForCombine.forEach(key => {
        const [rId, iId] = key.split(":")
        if (!reqItemMap[rId]) reqItemMap[rId] = []
        reqItemMap[rId].push(iId)
      })
      // Fetch full request data for each unique reqId
      const reqDataMap: Record<string, any> = {}
      await Promise.all(Object.keys(reqItemMap).map(async rId => {
        reqDataMap[rId] = await fetch(`/api/requests/${rId}`).then(r => r.json())
      }))
      // Build ordered pages matching display order (filtered list order)
      const pages: { req: any; item: any }[] = []
      filtered.forEach(req => {
        const itemIds = reqItemMap[req.id]
        if (!itemIds) return
        const fullReq = reqDataMap[req.id]
        ;(req.items || []).forEach((item: any) => {
          if (itemIds.includes(item.id)) {
            const fullItem = fullReq?.items?.find((i: any) => i.id === item.id) || item
            pages.push({ req: fullReq || req, item: fullItem })
          }
        })
      })
      if (pages.length === 0) return
      const [{ pdf }, { TransportationBookingPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/request-pdf"),
      ])
      const generatedDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      const element = React.createElement(TransportationBookingPdf as any, { pages, generatedDate })
      const blob = await (pdf(element as any) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Transportation_Booking_${pages.length}SO.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { alert("Combined PDF generation failed") }
    finally { setCombineLoading(false) }
  }

  // Select every not-yet-booked SO across the visible documents (for booking).
  const selectAllUnbooked = () => {
    const keys = new Set<string>()
    filtered.forEach(r => (r.items || []).forEach((i: any) => {
      if (i.itemStatus !== "REJECTED" && !itemBooked(i)) keys.add(`${r.id}:${i.id}`)
    }))
    setSelectedForCombine(keys)
  }

  const toggleCombineItem = (reqId: string, itemId: string) => {
    const key = `${reqId}:${itemId}`
    setSelectedForCombine(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  const buOptions: BUFilter[] = ["ALL", "NYG", "GW"]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ALL FILES</h1>
        <p className="text-xs text-gray-400 mt-0.5">System-generated documents grouped by BU and type</p>
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
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-gray-800">{FOLDER_LABELS[activeFolder]}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{FOLDER_DESC[activeFolder]}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-gray-400">{filtered.length} document(s)</span>
              {activeFolder === "BOOKING" && (
                <button onClick={() => setUnbookedOnly(v => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${unbookedOnly ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"}`}>
                  {unbookedOnly ? "● Showing unbooked" : "○ Unbooked only"}
                </button>
              )}
              {activeFolder === "BOOKING" && (
                <button onClick={() => { setCombineMode(m => !m); setSelectedForCombine(new Set()) }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${combineMode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"}`}>
                  {combineMode ? "✕ Cancel Combine" : "⊞ Combine Mode"}
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-start gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 mt-2 shrink-0">FILTERS</span>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 min-w-0">
              <MultiSelect label="All Brand" options={brandOpts} value={brandF} onChange={setBrandF} />
              <MultiSelect label="All Style" options={styleOpts} value={styleF} onChange={setStyleF} />
              <MultiSelect label="SO..." options={soOpts} value={soF} onChange={setSoF} />
              <MultiSelect label="Customer PO..." options={cpOpts} value={cpF} onChange={setCpF} />
              <MultiSelect label="Claim Dept" options={claimOpts} value={claimF} onChange={setClaimF} />
              <MultiSelect label="Invoice No..." options={invoiceOpts} value={invoiceF} onChange={setInvoiceF} />
            </div>
            {hasFilter && (
              <button onClick={() => { setBrandF([]); setStyleF([]); setSoF([]); setCpF([]); setClaimF([]); setInvoiceF([]) }}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium shrink-0 mt-0.5">Clear</button>
            )}
          </div>

          {loading && <div className="text-center py-16 text-gray-400">Loading...</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-300">
              <p className="text-4xl mb-2">📂</p>
              <p className="text-sm">No files in this folder</p>
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

                {(expandedYears.has(year) || hasFilter) && Object.keys(grouped[year]).map(month => {
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

                      {(expandedMonths.has(monthKey) || hasFilter) && grouped[year][month].map((req: any) => {
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
                              {activeFolder === "BOOKING" && (() => {
                                const ap = bookApproval(req)
                                const booked = isBooked(req)
                                return (
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    {ap && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">
                                        ✓ Approved by {ap.role} · {ap.by} · {fmtDate(ap.date)}
                                      </span>
                                    )}
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${booked ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                                      {booked ? "✓ Booked" : "● To book"}
                                    </span>
                                  </span>
                                )
                              })()}
                              <span className="text-xs text-gray-400 ml-auto">{items.length} SO(s) · {fmtDate(req.createdAt)}</span>
                            </button>

                            {/* Items under document */}
                            {(expandedDocs.has(docKey) || hasFilter) && (
                              <div className="pl-20 pr-5 pb-3 bg-blue-50 border-t border-blue-100">
                                {activeFolder === "LOGISTICS" && (req.attachments || []).some((a: any) => ["INV","AWB","EXPENSE"].includes(a.category)) && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="text-xs text-gray-500 font-medium py-1">Logistics files:</span>
                                    {(req.attachments || []).filter((a: any) => ["INV","AWB","EXPENSE"].includes(a.category)).map((a: any) => (
                                      <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer"
                                        className="text-xs bg-white border border-orange-200 text-orange-700 px-2 py-1 rounded hover:bg-orange-50 font-medium">
                                        📎 {a.category}: {a.fileName}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs mt-2">
                                    <thead>
                                      <tr className="text-gray-500">
                                        {combineMode && <th className="py-1 pr-2 w-6"></th>}
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">SO</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Style</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Description</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">QTY Air</th>
                                        {activeFolder === "BOOKING" && <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Booking</th>}
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
                                      {(activeFolder === "BOOKING" && unbookedOnly ? items.filter((i: any) => !itemBooked(i)) : items).map((item: any) => {
                                        const key = `${req.id}-${item.id}`
                                        const combineKey = `${req.id}:${item.id}`
                                        const isChecked = selectedForCombine.has(combineKey)
                                        const booked = itemBooked(item)
                                        return (
                                          <tr key={item.id} className={`hover:bg-blue-100/50 ${isChecked ? "bg-blue-100" : ""}`}>
                                            {combineMode && (
                                              <td className="py-1.5 pr-2">
                                                <input type="checkbox" checked={isChecked}
                                                  onChange={() => toggleCombineItem(req.id, item.id)}
                                                  className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                                              </td>
                                            )}
                                            <td className="py-1.5 pr-3 font-medium text-gray-800">{item.so}</td>
                                            <td className="py-1.5 pr-3 text-gray-600">{item.style}</td>
                                            <td className="py-1.5 pr-3 text-gray-500 max-w-[140px] truncate">{item.description}</td>
                                            <td className="py-1.5 pr-3 text-gray-700 font-semibold">{item.qtyRequestAir}</td>
                                            {activeFolder === "BOOKING" && (
                                              <td className="py-1.5 pr-3">
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${booked ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                                                  {booked ? "✓ Booked" : "● To book"}
                                                </span>
                                              </td>
                                            )}
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

      {/* Floating combine action bar */}
      {combineMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-medium">{selectedForCombine.size} SO selected</span>
          <button onClick={selectAllUnbooked}
            className="text-xs bg-amber-500/90 hover:bg-amber-500 text-white px-3 py-1 rounded-lg font-medium">Select all unbooked</button>
          {selectedForCombine.size > 0 && (
          <button onClick={() => setSelectedForCombine(new Set())}
            className="text-xs text-gray-400 hover:text-white">Clear</button>
          )}
          <button onClick={generateCombinedPdf} disabled={combineLoading || selectedForCombine.size === 0}
            className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold px-5 py-1.5 rounded-xl transition-colors">
            {combineLoading ? "Generating..." : `⬇ Download Combined PDF`}
          </button>
        </div>
      )}
    </div>
  )
}
