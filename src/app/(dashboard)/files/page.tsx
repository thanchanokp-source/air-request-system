"use client"
import { useEffect, useRef, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import React from "react"
import { MultiSelect } from "@/components/ui/multi-select"
import { getSplits } from "@/lib/claim"
import { viewableBus, requestInBu } from "@/lib/bu"

type StatusFilter = "ALL" | "TOBOOK" | "BOOKED" | "COMPLETED"
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

// A document appears once it is approved for booking (VP SCM / GM).
function qualifies(req: any): boolean {
  return BOOK_READY_STATUSES.includes(req.status)
}

// Pipeline stage of a document (all in one folder, distinguished by a badge).
// "Done" = the workflow has finished. GW ends at COMPLETED; NYG ends at the Accounting
// step (President approved → PENDING_ACCOUNTING is terminal), so treat both as complete.
function isDone(req: any): boolean {
  return req.status === "COMPLETED" || req.status === "PENDING_ACCOUNTING"
}

function docStage(req: any): "BOOKING" | "LOGISTICS" | "FINAL" {
  if (isDone(req)) return "FINAL"
  if ((req.items || []).some((i: any) => itemBooked(i))) return "LOGISTICS"
  return "BOOKING"
}

// Does this document match the selected status chip?
function matchesStatus(req: any, f: StatusFilter): boolean {
  if (f === "ALL") return true
  if (f === "COMPLETED") return isDone(req)
  // A done doc is finished — never show it in To-book / Booked (e.g. imported history).
  if (f === "TOBOOK") return !isDone(req) && unbookedCount(req) > 0
  if (f === "BOOKED") return isBooked(req) && !isDone(req)
  return true
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

const STAGE_BADGE: Record<string, { label: string; cls: string }> = {
  BOOKING: { label: "Booking", cls: "bg-blue-100 text-blue-700" },
  LOGISTICS: { label: "Logistics", cls: "bg-orange-100 text-orange-700" },
  FINAL: { label: "Completed", cls: "bg-green-100 text-green-700" },
}
const STATUS_CHIPS: { key: StatusFilter; label: string; cls: string }[] = [
  { key: "ALL", label: "All", cls: "bg-gray-700 text-white" },
  { key: "TOBOOK", label: "To book", cls: "bg-amber-500 text-white" },
  { key: "BOOKED", label: "Booked", cls: "bg-blue-600 text-white" },
  { key: "COMPLETED", label: "Completed", cls: "bg-green-600 text-white" },
]

export default function FilesPage() {
  const { data: session } = useSession()
  // Which BU(s) this viewer may see. ADMIN + jariya → every BU (+ "ALL"); everyone else →
  // only the BU(s) their ROLE implies. Derived from roles (not the stale User.bu field).
  const { bus: viewBus, canAll } = useMemo(() => viewableBus(session?.user), [session])
  const buOptions: string[] = useMemo(() => (canAll ? ["ALL", ...viewBus] : viewBus), [viewBus, canAll])
  // Only admins may reveal TEST documents (hidden from everyone else, incl. in counts).
  const isAdmin = useMemo(() => {
    const u: any = session?.user
    return u?.role === "ADMIN" || (Array.isArray(u?.roles) && u.roles.includes("ADMIN"))
  }, [session])

  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [activeBU, setActiveBU] = useState<string>("ALL")
  // Default the BU filter to the viewer's first allowed BU ("ALL" for admins) once session loads.
  const buInit = useRef(false)
  useEffect(() => {
    if (buInit.current || !session?.user) return
    setActiveBU(canAll ? "ALL" : (viewBus[0] || "NYG"))
    buInit.current = true
  }, [session, canAll, viewBus])
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [combineMode, setCombineMode] = useState(false)
  const [hawbLoading, setHawbLoading] = useState(false)
  const [hawbQuery, setHawbQuery] = useState("")
  const [unbookedOnly, setUnbookedOnly] = useState(false)
  const [showTest, setShowTest] = useState(false)
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set())
  const [combineLoading, setCombineLoading] = useState(false)
  const [brandF, setBrandF] = useState<string[]>([])
  const [styleF, setStyleF] = useState<string[]>([])
  const [soF, setSoF] = useState<string[]>([])
  const [cpF, setCpF] = useState<string[]>([])
  const [claimF, setClaimF] = useState<string[]>([])
  const [invoiceF, setInvoiceF] = useState<string[]>([])
  const [portF, setPortF] = useState<string[]>([])
  const [shipF, setShipF] = useState<string[]>([])
  // LG-friendly SO view: flat list grouped by Port / Ship Date for bulk booking.
  const [soView, setSoView] = useState(false)
  const [groupBy, setGroupBy] = useState<"port" | "shipdate" | "none">("shipdate")

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => {
      setRequests(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const folderFiltered = useMemo(() =>
    requests.filter(r => (showTest || !r.isTest) && requestInBu(r, activeBU) && qualifies(r) && matchesStatus(r, statusFilter)),
    [requests, statusFilter, activeBU, showTest])

  const uniq = (arr: any[]) => [...new Set(arr.filter(Boolean))].sort()
  const brandOpts = useMemo(() => uniq(folderFiltered.map(r => r.brandName)), [folderFiltered])
  const styleOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.style))), [folderFiltered])
  const soOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.so))), [folderFiltered])
  const cpOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.customerPO))), [folderFiltered])
  const invoiceOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.invoiceNo))), [folderFiltered])
  const claimOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).flatMap((i: any) => getSplits(i).map((s: any) => s.dept)))), [folderFiltered])
  const portOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.port))), [folderFiltered])
  const shipOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.planShipmentDate ? fmtDate(i.planShipmentDate) : null))), [folderFiltered])

  const hasFilter = [brandF, styleF, soF, cpF, claimF, invoiceF, portF, shipF].some(f => f.length > 0) || hawbQuery.trim().length > 0

  // HAWB# box (also used for "Print by HAWB") doubles as a live filter — case-insensitive contains.
  const hawbNorm = hawbQuery.trim().toLowerCase()
  const hawbMatch = (h: any) => !hawbNorm || String(h || "").trim().toLowerCase().includes(hawbNorm)

  // Item-level filter — used to filter the SO rows WITHIN a document ("By Document" view) so a
  // selected SO/Style/etc. actually narrows the rows shown, not just which documents appear.
  const itemMatchesFilters = (it: any) => {
    if (styleF.length && !styleF.includes(it.style)) return false
    if (soF.length && !soF.includes(it.so)) return false
    if (cpF.length && !cpF.includes(it.customerPO)) return false
    if (invoiceF.length && !invoiceF.includes(it.invoiceNo)) return false
    if (portF.length && !portF.includes(it.port)) return false
    if (shipF.length && !shipF.includes(fmtDate(it.planShipmentDate))) return false
    if (!hawbMatch(it.hawbNo)) return false
    return true
  }

  const filtered = useMemo(() => folderFiltered.filter(r => {
    const items = r.items || []
    if (brandF.length && !brandF.includes(r.brandName)) return false
    if (styleF.length && !items.some((i: any) => styleF.includes(i.style))) return false
    if (soF.length && !items.some((i: any) => soF.includes(i.so))) return false
    if (cpF.length && !items.some((i: any) => cpF.includes(i.customerPO))) return false
    if (invoiceF.length && !items.some((i: any) => invoiceF.includes(i.invoiceNo))) return false
    if (claimF.length && !items.some((i: any) => getSplits(i).some((s: any) => claimF.includes(s.dept)) || claimF.includes(i.claimDepartment))) return false
    if (portF.length && !items.some((i: any) => portF.includes(i.port))) return false
    if (shipF.length && !items.some((i: any) => shipF.includes(fmtDate(i.planShipmentDate)))) return false
    if (hawbNorm && !items.some((i: any) => hawbMatch(i.hawbNo))) return false
    if (unbookedOnly && unbookedCount(r) === 0) return false
    return true
  }), [folderFiltered, brandF, styleF, soF, cpF, invoiceF, claimF, portF, shipF, hawbNorm, unbookedOnly])

  // Flat SO rows for the LG "By SO" view — item-level filtering, then group by Port/Ship Date.
  const soRows = useMemo(() => {
    const rows: { req: any; item: any }[] = []
    filtered.forEach(r => (r.items || []).forEach((it: any) => {
      if (it.itemStatus === "REJECTED") return
      if (unbookedOnly && itemBooked(it)) return
      if (styleF.length && !styleF.includes(it.style)) return
      if (soF.length && !soF.includes(it.so)) return
      if (cpF.length && !cpF.includes(it.customerPO)) return
      if (invoiceF.length && !invoiceF.includes(it.invoiceNo)) return
      if (portF.length && !portF.includes(it.port)) return
      if (shipF.length && !shipF.includes(fmtDate(it.planShipmentDate))) return
      if (!hawbMatch(it.hawbNo)) return
      rows.push({ req: r, item: it })
    }))
    return rows
  }, [filtered, unbookedOnly, styleF, soF, cpF, invoiceF, portF, shipF, hawbNorm])

  const soGroups = useMemo(() => {
    const m: Record<string, { req: any; item: any }[]> = {}
    soRows.forEach(row => {
      const key = groupBy === "port" ? (row.item.port || "— No port —")
        : groupBy === "shipdate" ? fmtDate(row.item.planShipmentDate)
        : "All SO"
      ;(m[key] ||= []).push(row)
    })
    // Sort ship-date groups chronologically; others alphabetically.
    const keys = Object.keys(m).sort((a, b) =>
      groupBy === "shipdate" ? (new Date(m[a][0].item.planShipmentDate).getTime() || 0) - (new Date(m[b][0].item.planShipmentDate).getTime() || 0) : a.localeCompare(b))
    return keys.map(k => ({ key: k, rows: m[k] }))
  }, [soRows, groupBy])

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

  // All HAWB numbers across every document (for the "Print by HAWB" picker).
  const allHawbs = useMemo(
    () => [...new Set(requests.flatMap((r: any) => (r.items || []).map((i: any) => (i.hawbNo || "").trim()).filter(Boolean)))].sort(),
    [requests]
  )

  // Print ONE HAWB# → all its SO across ANY document(s), in the SAME consolidated
  // layout as the other PDFs (letterhead + table + signatures).
  const printHawb = async (hawbRaw: string) => {
    const hawb = (hawbRaw || "").trim()
    if (!hawb) return
    setHawbLoading(true)
    try {
      const reqIds = new Set<string>()
      requests.forEach((r: any) => (r.items || []).forEach((it: any) => {
        if ((it.hawbNo || "").trim() === hawb && it.itemStatus !== "REJECTED") reqIds.add(r.id)
      }))
      if (reqIds.size === 0) { alert(`No SO found for HAWB "${hawb}"`); return }
      // Fetch full docs (incl. signatures) so the PDF stamps approvals correctly.
      const full: Record<string, any> = {}
      await Promise.all([...reqIds].map(async id => { full[id] = await fetch(`/api/requests/${id}`).then(r => r.json()) }))
      const pages: { req: any; item: any }[] = []
      requests.forEach((r: any) => {
        const fr = full[r.id]; if (!fr) return
        ;(fr.items || []).forEach((it: any) => {
          if ((it.hawbNo || "").trim() === hawb && it.itemStatus !== "REJECTED") pages.push({ req: fr, item: it })
        })
      })
      if (pages.length === 0) { alert(`No SO found for HAWB "${hawb}"`); return }
      const [{ pdf }, { CombinedPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/request-pdf"),
      ])
      const el = React.createElement(CombinedPdfDocument as any, { pages, hawbNo: hawb })
      const blob = await (pdf(el as any) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `HAWB_${hawb}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { alert("HAWB PDF generation failed") }
    finally { setHawbLoading(false) }
  }

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

  // Download the whole document — one formal page per SO.
  const downloadDocPdf = async (req: any) => {
    const dkey = `doc-${req.id}`
    setPdfLoading(dkey)
    try {
      const fullReq = await fetch(`/api/requests/${req.id}`).then(r => r.json())
      const items = (fullReq.items || []).filter((i: any) => i.itemStatus !== "REJECTED")
      if (items.length === 0) return
      const [{ pdf }, { CombinedPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/request-pdf"),
      ])
      const pages = items.map((item: any) => ({ req: fullReq, item }))
      const element = React.createElement(CombinedPdfDocument as any, { pages })
      const blob = await (pdf(element as any) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fullReq.documentNo}.pdf`
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
      // Combined output uses the same per-SO (by-SO) formal page layout — including
      // the signature stamps — so the combined file looks identical to a single by-SO doc.
      const [{ pdf }, { CombinedPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/request-pdf"),
      ])
      const element = React.createElement(CombinedPdfDocument as any, { pages })
      const blob = await (pdf(element as any) as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Combined_${pages.length}SO.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch { alert("Combined PDF generation failed") }
    finally { setCombineLoading(false) }
  }

  // Select/deselect every SO in a group (port / ship-date) at once.
  const setGroupSelected = (rows: { req: any; item: any }[], on: boolean) => {
    setSelectedForCombine(prev => {
      const n = new Set(prev)
      rows.forEach(({ req, item }) => { const k = `${req.id}:${item.id}`; on ? n.add(k) : n.delete(k) })
      return n
    })
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">DOCUMENT FOR LOGISTICS &amp; ACCOUNTING</h1>
        <p className="text-xs text-gray-400 mt-0.5">All approved documents in one place — filter by BU and status</p>
      </div>

      <div className="flex gap-4 items-start">
        {/* Left: filters */}
        <div className="w-56 shrink-0 bg-white rounded-xl border border-gray-200 p-3 space-y-3 self-start sticky top-4">
          {/* BU filter — only shown when the viewer has more than one BU (admin/jariya/cross-BU) */}
          {buOptions.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 px-1 mb-1.5 uppercase tracking-wide">Business Unit</p>
              <div className="flex gap-1 px-1">
                {buOptions.map(b => (
                  <button key={b} onClick={() => setActiveBU(b)}
                    className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${activeBU === b ? "bg-red-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status filter */}
          <div>
            <p className="text-xs font-semibold text-gray-500 px-1 mb-1.5 uppercase tracking-wide">Status</p>
            <div className="space-y-1">
              {STATUS_CHIPS.map(c => {
                const count = requests.filter(r => (showTest || !r.isTest) && requestInBu(r, activeBU) && qualifies(r) && matchesStatus(r, c.key)).length
                const active = statusFilter === c.key
                return (
                  <button key={c.key} onClick={() => setStatusFilter(c.key)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${active ? `${c.cls} font-medium` : "text-gray-700 hover:bg-gray-50"}`}>
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: content */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-gray-800">Documents</h2>
              <p className="text-xs text-gray-400 mt-0.5">Approved for booking (VP SCM / GM) — Booking → Logistics → Completed</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-gray-400">{soView ? `${soRows.length} SO` : `${filtered.length} document(s)`}</span>
              {/* View toggle: LG picks SO (grouped by port/date); or browse by document */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
                <button onClick={() => setSoView(false)}
                  className={`px-3 py-1.5 ${!soView ? "bg-gray-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>By Document</button>
                <button onClick={() => setSoView(true)}
                  className={`px-3 py-1.5 border-l border-gray-300 ${soView ? "bg-gray-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>By SO</button>
              </div>
              {soView && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-400">Group:</span>
                  {([["shipdate","Ship Date"],["none","None"]] as [any,string][]).map(([k,lbl]) => (
                    <button key={k} onClick={() => setGroupBy(k)}
                      className={`px-2 py-1 rounded font-medium ${groupBy === k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{lbl}</button>
                  ))}
                </div>
              )}
              {true && (
                <button onClick={() => setUnbookedOnly(v => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${unbookedOnly ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"}`}>
                  {unbookedOnly ? "● Showing unbooked" : "○ Unbooked only"}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowTest(v => !v)}
                  title="Admin only — include TEST documents (hidden from other users)"
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${showTest ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-600 border-purple-300 hover:bg-purple-50"}`}>
                  {showTest ? "● Showing test" : "○ Test docs"}
                </button>
              )}
              <button onClick={() => { setCombineMode(m => !m); setSelectedForCombine(new Set()) }}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${combineMode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"}`}>
                {combineMode ? "✕ Cancel Combine" : "⊞ Combine Mode"}
              </button>
              {/* Print by HAWB — type (or pick) a HAWB# → consolidated PDF of all its SO */}
              <div className="flex items-center gap-1">
                <input list="hawb-list" value={hawbQuery} disabled={hawbLoading}
                  onChange={e => setHawbQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") printHawb(hawbQuery) }}
                  placeholder="HAWB#…"
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 w-[130px] disabled:opacity-50" />
                <datalist id="hawb-list">{allHawbs.map(h => <option key={h} value={h} />)}</datalist>
                <button onClick={() => printHawb(hawbQuery)} disabled={hawbLoading || !hawbQuery.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {hawbLoading ? "…" : "🖨 HAWB"}
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-start gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 mt-2 shrink-0">FILTERS</span>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 min-w-0">
              <MultiSelect label="Ship Date..." options={shipOpts} value={shipF} onChange={setShipF} />
              <MultiSelect label="All Brand" options={brandOpts} value={brandF} onChange={setBrandF} />
              <MultiSelect label="SO..." options={soOpts} value={soF} onChange={setSoF} />
              <MultiSelect label="All Style" options={styleOpts} value={styleF} onChange={setStyleF} />
              <MultiSelect label="Customer PO..." options={cpOpts} value={cpF} onChange={setCpF} />
              <MultiSelect label="Claim Dept" options={claimOpts} value={claimF} onChange={setClaimF} />
              <MultiSelect label="Invoice No..." options={invoiceOpts} value={invoiceF} onChange={setInvoiceF} />
            </div>
            {hasFilter && (
              <button onClick={() => { setBrandF([]); setStyleF([]); setSoF([]); setCpF([]); setClaimF([]); setInvoiceF([]); setPortF([]); setShipF([]); setHawbQuery("") }}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium shrink-0 mt-0.5">Clear</button>
            )}
          </div>

          {loading && <div className="text-center py-16 text-gray-400">Loading...</div>}
          {!loading && (soView ? soRows.length === 0 : filtered.length === 0) && (() => {
            // Admin testing hint: if the ONLY matching docs are TEST docs (hidden), offer to reveal them.
            const hiddenTest = isAdmin && !showTest
              ? requests.filter(r => r.isTest && requestInBu(r, activeBU) && qualifies(r) && matchesStatus(r, statusFilter)).length
              : 0
            return (
              <div className="text-center py-16 text-gray-300">
                <p className="text-4xl mb-2">📂</p>
                <p className="text-sm">No documents match</p>
                {hiddenTest > 0 && (
                  <button onClick={() => setShowTest(true)}
                    className="mt-3 text-xs font-semibold text-purple-600 border border-purple-300 rounded-lg px-3 py-1.5 hover:bg-purple-50">
                    🧪 {hiddenTest} test document{hiddenTest > 1 ? "s" : ""} hidden — click to show
                  </button>
                )}
              </div>
            )
          })()}

          {/* LG "By SO" view — flat SO list grouped by Port / Ship Date, bulk-selectable */}
          {soView && soRows.length > 0 && (
            <div className="divide-y divide-gray-100">
              {soGroups.map(g => {
                const allSel = combineMode && g.rows.every(({ req, item }) => selectedForCombine.has(`${req.id}:${item.id}`))
                const unbooked = g.rows.filter(({ item }) => !itemBooked(item)).length
                return (
                  <div key={g.key}>
                    {/* Group header */}
                    <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50 sticky top-0 z-10">
                      {combineMode && (
                        <input type="checkbox" checked={allSel}
                          onChange={e => setGroupSelected(g.rows, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                      )}
                      <span className="text-sm font-semibold text-gray-700">
                        {groupBy === "port" ? "📍 " : groupBy === "shipdate" ? "📅 " : ""}{g.key}
                      </span>
                      <span className="text-xs text-gray-400">{g.rows.length} SO{unbooked > 0 && <span className="text-amber-600"> · {unbooked} to book</span>}</span>
                      {combineMode && (
                        <button onClick={() => setGroupSelected(g.rows, !allSel)}
                          className="text-xs text-blue-600 hover:underline ml-auto">{allSel ? "Deselect group" : "Select group"}</button>
                      )}
                    </div>
                    {/* SO rows */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400">
                            {combineMode && <th className="py-1.5 pl-5 pr-2 w-6"></th>}
                            {["SO","Style","Document","Brand","BU","Ship Date","QTY Air","Booking",""].map(h =>
                              <th key={h} className={`py-1.5 px-3 font-medium whitespace-nowrap ${h === "QTY Air" ? "text-right" : "text-left"} ${!combineMode && h === "SO" ? "pl-5" : ""}`}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {g.rows.map(({ req, item }) => {
                            const ck = `${req.id}:${item.id}`
                            const isChecked = selectedForCombine.has(ck)
                            const booked = itemBooked(item)
                            const key = `${req.id}-${item.id}`
                            return (
                              <tr key={item.id} className={`hover:bg-blue-50/50 ${isChecked ? "bg-blue-50" : ""}`}>
                                {combineMode && (
                                  <td className="py-1.5 pl-5 pr-2">
                                    <input type="checkbox" checked={isChecked} onChange={() => toggleCombineItem(req.id, item.id)}
                                      className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                                  </td>
                                )}
                                <td className={`py-1.5 px-3 font-semibold text-gray-800 whitespace-nowrap ${!combineMode ? "pl-5" : ""}`}>{item.so}</td>
                                <td className="py-1.5 px-3 whitespace-nowrap">{item.style}</td>
                                <td className="py-1.5 px-3 text-blue-700 whitespace-nowrap">{req.documentNo}</td>
                                <td className="py-1.5 px-3 text-gray-500 whitespace-nowrap">{req.brandName}</td>
                                <td className="py-1.5 px-3"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${req.bu === "GW" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{req.bu}</span></td>
                                <td className="py-1.5 px-3 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                                <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-gray-700">{fmtNum(item.qtyRequestAir)}</td>
                                <td className="py-1.5 px-3">
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${booked ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                                    {booked ? "✓ Booked" : "● To book"}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 text-right">
                                  <button onClick={() => downloadPdf(req, item)} disabled={pdfLoading === key}
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
                )
              })}
            </div>
          )}

          {/* Year/Month tree (By Document) */}
          {!soView && (
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
                              {req.crNo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium whitespace-nowrap">CR: {req.crNo}</span>}
                              {(() => {
                                const stage = docStage(req)
                                const ap = bookApproval(req)
                                const booked = isBooked(req)
                                const nUnbooked = unbookedCount(req)
                                return (
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STAGE_BADGE[stage].cls}`}>
                                      {STAGE_BADGE[stage].label}
                                    </span>
                                    {ap && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">
                                        ✓ {ap.role} · {ap.by} · {fmtDate(ap.date)}
                                      </span>
                                    )}
                                    {stage !== "FINAL" && (
                                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${booked ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                                        {booked ? "✓ Booked" : `● ${nUnbooked} to book`}
                                      </span>
                                    )}
                                  </span>
                                )
                              })()}
                              <span className="text-xs text-gray-400 ml-auto">{items.length} SO(s) · {fmtDate(req.createdAt)}</span>
                              <span role="button" tabIndex={0}
                                onClick={e => { e.stopPropagation(); downloadDocPdf(req) }}
                                className="text-xs bg-gray-700 text-white px-2.5 py-1 rounded hover:bg-gray-800 font-medium cursor-pointer whitespace-nowrap">
                                {pdfLoading === `doc-${req.id}` ? "..." : "↓ PDF (all SO)"}
                              </span>
                            </button>

                            {/* Items under document */}
                            {(expandedDocs.has(docKey) || hasFilter) && (
                              <div className="pl-20 pr-5 pb-3 bg-blue-50 border-t border-blue-100">
                                {(req.attachments || []).some((a: any) => ["INV","AWB","EXPENSE"].includes(a.category)) && (
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
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Booking</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Invoice No</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">QTY Ship</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Actual Freight</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Booking Date</th>
                                        <th className="text-right py-1 font-medium">PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-blue-100">
                                      {items.filter((i: any) => (!unbookedOnly || !itemBooked(i)) && itemMatchesFilters(i)).map((item: any) => {
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
                                            <td className="py-1.5 pr-3">
                                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${booked ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                                                {booked ? "✓ Booked" : "● To book"}
                                              </span>
                                            </td>
                                            <td className="py-1.5 pr-3">{item.invoiceNo || "-"}</td>
                                            <td className="py-1.5 pr-3">{item.qtyActualShip ?? item.qtyRequestAir ?? "-"}</td>
                                            <td className="py-1.5 pr-3 text-green-700 font-semibold">{fmtNum(item.actualAirFreight)}</td>
                                            <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(item.bookingDate)}</td>
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
          )}
          {/* Spacer so the last rows clear the floating combine bar */}
          {combineMode && <div className="h-28" aria-hidden />}
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
