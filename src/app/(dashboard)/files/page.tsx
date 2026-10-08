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
  "PENDING_LOGISTICS", "PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_VP_NYK", "PENDING_PRESIDENT",
  "PENDING_LOGISTICS_GW", "PENDING_CLAIM_GW", "PENDING_PRESIDENT_GW",
  "PENDING_ACCOUNTING", "COMPLETED",
]

// A document appears once it is approved for booking (VP SCM / GM).
// EXCEPTION: any doc that already has a HAWB entered surfaces here regardless of status —
// once Logistics has keyed a HAWB the shipment is real and must be findable/printable, even if
// the claim dept is still being picked at SCM (Kimita) or the doc is an auto-add prepaid doc.
function hasHawb(req: any): boolean {
  return (req?.items || []).some((i: any) => String(i?.hawbNo || "").trim() !== "")
}
function qualifies(req: any): boolean {
  return BOOK_READY_STATUSES.includes(req.status) || hasHawb(req)
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
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const closePreview = () => setPreview(p => { if (p) URL.revokeObjectURL(p.url); return null })
  // VP MER master signatures (name → data URI) — stamped on PDFs when the doc isn't formally signed yet.
  const [masterSigs, setMasterSigs] = useState<Record<string, string>>({})
  useEffect(() => { fetch("/api/signature/masters").then(r => r.json()).then(d => setMasterSigs(d?.signatures || {})).catch(() => {}) }, [])
  const [combineMode, setCombineMode] = useState(false)
  const [hawbLoading, setHawbLoading] = useState(false)
  const [hawbQuery, setHawbQuery] = useState("")
  const [unbookedOnly, setUnbookedOnly] = useState(false)
  const [showTest, setShowTest] = useState(false)
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set())
  const [combineLoading, setCombineLoading] = useState(false)
  const [docF, setDocF] = useState<string[]>([])
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

  const [hawbUploading, setHawbUploading] = useState<string | null>(null)
  const [hawbPanel, setHawbPanel] = useState<Set<string>>(new Set())
  const toggleHawbPanel = (id: string) => setHawbPanel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  // Attach a supporting file to a specific HAWB (retroactive, after LG already sent).
  const attachHawb = async (reqId: string, hawbNo: string, file: File) => {
    const key = `${reqId}:${hawbNo}`
    setHawbUploading(key)
    try {
      const form = new FormData()
      form.append("file", file); form.append("category", "AWB"); form.append("hawbNo", hawbNo)
      const res = await fetch(`/api/requests/${reqId}/attachments`, { method: "POST", body: form })
      if (!res.ok) { alert("Upload failed"); return }
      const d = await fetch("/api/requests").then(r => r.json()); setRequests(Array.isArray(d) ? d : [])
    } finally { setHawbUploading(null) }
  }

  const folderFiltered = useMemo(() =>
    requests.filter(r => (showTest || !r.isTest) && requestInBu(r, activeBU) && qualifies(r) && matchesStatus(r, statusFilter)),
    [requests, statusFilter, activeBU, showTest])

  const uniq = (arr: any[]) => [...new Set(arr.filter(Boolean))].sort()
  const docOpts = useMemo(() => uniq(folderFiltered.map(r => r.documentNo)), [folderFiltered])
  const brandOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.brand || r.brandName))), [folderFiltered])
  const styleOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.style))), [folderFiltered])
  const soOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.so))), [folderFiltered])
  const cpOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.customerPO))), [folderFiltered])
  const invoiceOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.invoiceNo))), [folderFiltered])
  const claimOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).flatMap((i: any) => getSplits(i).map((s: any) => s.dept)))), [folderFiltered])
  const portOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.port))), [folderFiltered])
  const shipOpts = useMemo(() => uniq(folderFiltered.flatMap(r => (r.items || []).map((i: any) => i.planShipmentDate ? fmtDate(i.planShipmentDate) : null))), [folderFiltered])

  const hasFilter = [docF, brandF, styleF, soF, cpF, claimF, invoiceF, portF, shipF].some(f => f.length > 0) || hawbQuery.trim().length > 0

  // HAWB# box (also used for "Print by HAWB") doubles as a live filter — case-insensitive contains.
  const hawbNorm = hawbQuery.trim().toLowerCase()
  const hawbMatch = (h: any) => !hawbNorm || String(h || "").trim().toLowerCase().includes(hawbNorm)

  // Item-level filter — used to filter the SO rows WITHIN a document ("By Document" view) so a
  // selected SO/Style/etc. actually narrows the rows shown, not just which documents appear.
  const itemMatchesFilters = (it: any) => {
    if (brandF.length && !brandF.includes(it.brand)) return false
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
    if (docF.length && !docF.includes(r.documentNo)) return false
    if (brandF.length && !items.some((i: any) => brandF.includes(i.brand || r.brandName))) return false
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
  }), [folderFiltered, docF, brandF, styleF, soF, cpF, invoiceF, claimF, portF, shipF, hawbNorm, unbookedOnly])

  // ── HAWB summary → Excel (pivot-like): one row per HAWB (totals) with its INV rows grouped underneath
  // (Excel outline: collapsed, click + to expand). Uses the documents + filters currently on screen.
  // Sheet 2 = flat SO detail (HAWB / INV / SO …) for the user's own pivot.
  const exportHawbSummary = async () => {
    const XLSX = await import("xlsx")
    const lines: any[] = []
    for (const r of filtered) for (const it of (r.items || [])) {
      if (it.itemStatus === "REJECTED" || !itemMatchesFilters(it)) continue
      const h = String(it.hawbNo || "").trim(); if (!h || /^[-.\s]*$/.test(h)) continue
      lines.push({ hawb: h, inv: String(it.invoiceNo || "").trim() || "(no INV)", doc: r.documentNo, bu: r.bu, brand: it.brand || r.brandName || "",
        so: it.so, sub: it.sub || "", style: it.style || "", qty: Number(it.qtyActualShip ?? it.qtyRequestAir) || 0,
        act: Number(it.actualAirFreight) || 0, est: Number(it.airFreight) || 0 })
    }
    if (!lines.length) { alert("ไม่มี SO ที่มี HAWB ตาม filter ปัจจุบัน"); return }
    const r2 = (v: number) => Math.round(v * 100) / 100
    const uniqJoin = (xs: string[]) => [...new Set(xs.filter(Boolean))].join(", ")
    const agg = (ls: any[]) => ({ so: new Set(ls.map(l => `${l.so}|${l.sub}`)).size, qty: ls.reduce((a, l) => a + l.qty, 0), act: r2(ls.reduce((a, l) => a + l.act, 0)), est: r2(ls.reduce((a, l) => a + l.est, 0)) })
    const byHawb = new Map<string, any[]>()
    for (const l of lines) byHawb.set(l.hawb, [...(byHawb.get(l.hawb) || []), l])
    const head = ["HAWB", "INV", "เอกสาร", "BU", "Brand", "SO", "QTY", "Actual", "EST"]
    const aoa: any[][] = [head], rows: any[] = [{}]
    for (const [h, ls] of [...byHawb.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const t = agg(ls)
      const invs = [...new Set(ls.map(l => l.inv))].sort()
      aoa.push([h, `${invs.length} INV`, uniqJoin(ls.map(l => l.doc)), uniqJoin(ls.map(l => l.bu)), uniqJoin(ls.map(l => l.brand)), t.so, t.qty, t.act, t.est]); rows.push({})
      for (const inv of invs) {
        const il = ls.filter(l => l.inv === inv), ti = agg(il)
        aoa.push([h, inv, uniqJoin(il.map(l => l.doc)), uniqJoin(il.map(l => l.bu)), uniqJoin(il.map(l => l.brand)), ti.so, ti.qty, ti.act, ti.est])
        rows.push({ level: 1, hidden: true })   // grouped under the HAWB row — expand with + in Excel
      }
    }
    const g = agg(lines)
    aoa.push(["GRAND TOTAL", `${new Set(lines.map(l => l.inv)).size} INV`, `${new Set(lines.map(l => l.doc)).size} เอกสาร`, "", "", g.so, g.qty, g.act, g.est]); rows.push({})
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws["!rows"] = rows
    ws["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 6 }, { wch: 28 }, { wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]
    const detail = XLSX.utils.json_to_sheet(lines.sort((a, b) => a.hawb.localeCompare(b.hawb) || a.inv.localeCompare(b.inv) || String(a.so).localeCompare(String(b.so)))
      .map(l => ({ HAWB: l.hawb, INV: l.inv, "เอกสาร": l.doc, BU: l.bu, Brand: l.brand, SO: l.so, SUB: l.sub, STYLE: l.style, QTY: l.qty, Actual: r2(l.act), EST: r2(l.est) })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "HAWB Summary")
    XLSX.utils.book_append_sheet(wb, detail, "Detail (SO)")
    XLSX.writeFile(wb, `hawb-summary-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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
      const el = React.createElement(CombinedPdfDocument as any, { pages, hawbNo: hawb, masterSigs, hidePresident: true })
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
    } catch (e) { console.error("PDF error (per-SO):", e); alert("PDF generation failed: " + ((e as any)?.message || String(e))) }
    finally { setPdfLoading(null) }
  }

  // Download the whole document — one formal page per SO.
  // Build the document PDF blob (SOs respecting active filters + unbooked toggle). Reused by
  // download and preview so both show exactly the same output.
  const buildDocBlob = async (req: any): Promise<{ blob: Blob; name: string } | null> => {
    const fullReq = await fetch(`/api/requests/${req.id}`).then(r => r.json())
    const items = (fullReq.items || []).filter((i: any) =>
      i.itemStatus !== "REJECTED" && (!unbookedOnly || !itemBooked(i)) && itemMatchesFilters(i))
    if (items.length === 0) { alert("ไม่มี SO ที่ตรงกับ filter"); return null }
    const [{ pdf }, { CombinedPdfDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/request-pdf"),
    ])
    const pages = items.map((item: any) => ({ req: fullReq, item }))
    const element = React.createElement(CombinedPdfDocument as any, { pages, masterSigs, hidePresident: true })
    const blob = await (pdf(element as any) as any).toBlob()
    return { blob, name: `${fullReq.documentNo}.pdf` }
  }
  const downloadDocPdf = async (req: any) => {
    setPdfLoading(`doc-${req.id}`)
    try {
      const r = await buildDocBlob(req); if (!r) return
      const url = URL.createObjectURL(r.blob)
      const a = document.createElement("a"); a.href = url; a.download = r.name
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) { console.error("PDF error (doc):", e); alert("PDF generation failed: " + ((e as any)?.message || String(e))) }
    finally { setPdfLoading(null) }
  }
  const previewDocPdf = async (req: any) => {
    setPdfLoading(`prev-${req.id}`)
    try {
      const r = await buildDocBlob(req); if (!r) return
      setPreview({ url: URL.createObjectURL(r.blob), name: r.name })
    } catch (e) { console.error("PDF error (preview):", e); alert("PDF generation failed: " + ((e as any)?.message || String(e))) }
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
      const element = React.createElement(CombinedPdfDocument as any, { pages, masterSigs, hidePresident: true })
      const blob = await (pdf(element as any) as any).toBlob()
      // Open the PREVIEW window first (it has a ⬇ Download button) instead of downloading straight away.
      setPreview({ url: URL.createObjectURL(blob), name: `Combined_${pages.length}SO.pdf` })
    } catch (e) { console.error("PDF error (combined):", e); alert("Combined PDF generation failed: " + ((e as any)?.message || String(e))) }
    finally { setCombineLoading(false) }
  }

  // One combined PDF of EVERY filtered SO across ALL visible documents (no manual selection) —
  // respects the active filters + unbooked toggle, same SOs as shown on screen.
  const downloadAllFilteredPdf = async () => {
    setCombineLoading(true)
    try {
      const docItems = filtered
        .map(req => ({ req, ids: (req.items || []).filter((i: any) => i.itemStatus !== "REJECTED" && (!unbookedOnly || !itemBooked(i)) && itemMatchesFilters(i)).map((i: any) => i.id) }))
        .filter(d => d.ids.length > 0)
      if (docItems.length === 0) { alert("ไม่มี SO ที่ตรงกับ filter"); return }
      const reqDataMap: Record<string, any> = {}
      await Promise.all(docItems.map(async d => { reqDataMap[d.req.id] = await fetch(`/api/requests/${d.req.id}`).then(r => r.json()) }))
      const pages: { req: any; item: any }[] = []
      docItems.forEach(d => {
        const fullReq = reqDataMap[d.req.id]
        ;(d.req.items || []).forEach((item: any) => {
          if (d.ids.includes(item.id)) pages.push({ req: fullReq || d.req, item: fullReq?.items?.find((i: any) => i.id === item.id) || item })
        })
      })
      if (pages.length === 0) return
      const [{ pdf }, { CombinedPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/request-pdf"),
      ])
      const element = React.createElement(CombinedPdfDocument as any, { pages, masterSigs, hidePresident: true })
      const blob = await (pdf(element as any) as any).toBlob()
      // Open the PREVIEW window first (it has a ⬇ Download button) instead of downloading straight away.
      setPreview({ url: URL.createObjectURL(blob), name: `Combined_filtered_${pages.length}SO.pdf` })
    } catch (e) { console.error("PDF error (all-filtered):", e); alert("PDF generation failed: " + ((e as any)?.message || String(e))) }
    finally { setCombineLoading(false) }
  }

  // Total filtered SOs across all visible docs (for the "print all filtered" button label).
  // ── HAWB summary ──────────────────────────────────────────────────────────────────────────────
  // When LG types a HAWB in the box, show what that single HAWB actually costs: every SO carrying it
  // (across documents), its total actual freight, and the invoices it covers — an INV can hold several
  // SOs, which is exactly what people come here to check.
  const hawbSummary = useMemo(() => {
    const q = hawbQuery.trim().toLowerCase()
    if (!q) return null
    const rows: any[] = []
    for (const req of folderFiltered) {
      for (const it of (req.items || [])) {
        if (it.itemStatus === "REJECTED") continue
        if (!String(it.hawbNo || "").trim().toLowerCase().includes(q)) continue
        rows.push({ ...it, documentNo: req.documentNo, bu: req.buName })
      }
    }
    if (!rows.length) return { rows: [], total: 0, invs: [], docs: [], hawbs: [] }
    const byInv = new Map<string, { inv: string; sos: any[]; qty: number; cost: number }>()
    for (const r of rows) {
      const k = String(r.invoiceNo || "(ไม่มี INV)")
      const g = byInv.get(k) || { inv: k, sos: [], qty: 0, cost: 0 }
      g.sos.push(r); g.qty += Number(r.qtyRequestAir) || 0; g.cost += Number(r.actualAirFreight) || 0
      byInv.set(k, g)
    }
    return {
      rows,
      total: rows.reduce((a, r) => a + (Number(r.actualAirFreight) || 0), 0),
      qty: rows.reduce((a, r) => a + (Number(r.qtyRequestAir) || 0), 0),
      invs: [...byInv.values()].sort((a, b) => b.cost - a.cost),
      docs: [...new Set(rows.map(r => r.documentNo))],
      hawbs: [...new Set(rows.map(r => String(r.hawbNo || "").trim()).filter(Boolean))],
    }
  }, [hawbQuery, folderFiltered])
  const [hawbOpen, setHawbOpen] = useState(false)

  const filteredSoTotal = filtered.reduce((n, req) => n + (req.items || []).filter((i: any) => i.itemStatus !== "REJECTED" && (!unbookedOnly || !itemBooked(i)) && itemMatchesFilters(i)).length, 0)

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
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200">
          {/* Header — row 1: title + count + view switch · row 2: show-toggles (left) · exports (right) */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-semibold text-gray-800">Documents</h2>
              <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full px-2 py-0.5 tabular-nums">{soView ? `${soRows.length} SO` : `${filtered.length} docs`}</span>
              <div className="ml-auto flex items-center gap-2">
                {soView && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-gray-400">Group</span>
                    {([["shipdate","Ship Date"],["none","None"]] as [any,string][]).map(([k,lbl]) => (
                      <button key={k} onClick={() => setGroupBy(k)}
                        className={`h-8 px-2.5 rounded-lg font-medium whitespace-nowrap ${groupBy === k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{lbl}</button>
                    ))}
                  </div>
                )}
                {/* View toggle: LG picks SO (grouped by port/date); or browse by document */}
                <div className="flex h-8 rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
                  <button onClick={() => setSoView(false)}
                    className={`px-3 whitespace-nowrap ${!soView ? "bg-gray-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>By Document</button>
                  <button onClick={() => setSoView(true)}
                    className={`px-3 whitespace-nowrap border-l border-gray-300 ${soView ? "bg-gray-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>By SO</button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* show / mode toggles */}
              <button onClick={() => setUnbookedOnly(v => !v)}
                className={`h-8 text-xs px-3 rounded-lg font-medium border whitespace-nowrap transition-colors ${unbookedOnly ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"}`}>
                {unbookedOnly ? "● Unbooked only" : "○ Unbooked only"}
              </button>
              {isAdmin && (
                <button onClick={() => setShowTest(v => !v)}
                  title="Admin only — include TEST documents (hidden from other users)"
                  className={`h-8 text-xs px-3 rounded-lg font-medium border whitespace-nowrap transition-colors ${showTest ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-600 border-purple-300 hover:bg-purple-50"}`}>
                  {showTest ? "● Test docs" : "○ Test docs"}
                </button>
              )}
              <button onClick={() => { setCombineMode(m => !m); setSelectedForCombine(new Set()) }}
                className={`h-8 text-xs px-3 rounded-lg font-medium border whitespace-nowrap transition-colors ${combineMode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"}`}>
                {combineMode ? "✕ Cancel Combine" : "⊞ Combine Mode"}
              </button>

              {/* exports */}
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {/* One PDF of ALL filtered SOs across every visible document (no manual selection). */}
                <button onClick={downloadAllFilteredPdf} disabled={combineLoading || filteredSoTotal === 0}
                  title="รวม SO ที่ filter จากทุกเอกสารเป็น PDF เดียว"
                  className="h-8 text-xs px-3 rounded-lg font-medium border border-green-600 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                  {combineLoading ? "…" : `↓ PDF รวม (${filteredSoTotal} SO)`}
                </button>
                {/* HAWB summary (Excel, pivot-like: HAWB → INV) of the documents / filters on screen */}
                <button onClick={exportHawbSummary}
                  title="สรุปยอดตาม HAWB (กด + ใน Excel เพื่อดูราย INV) · ตาม filter ปัจจุบัน"
                  className="h-8 text-xs px-3 rounded-lg font-medium border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 whitespace-nowrap">
                  ⬇ HAWB Summary (Excel)
                </button>
                {/* Print by HAWB — type (or pick) a HAWB# → consolidated PDF of all its SO */}
                <div className="flex h-8 rounded-lg border border-gray-300 overflow-hidden bg-white">
                  <input list="hawb-list" value={hawbQuery} disabled={hawbLoading}
                    onChange={e => setHawbQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") printHawb(hawbQuery) }}
                    placeholder="HAWB#…" aria-label="HAWB number"
                    className="text-xs px-2 text-gray-700 w-[130px] outline-none disabled:opacity-50" />
                  <datalist id="hawb-list">{allHawbs.map(h => <option key={h} value={h} />)}</datalist>
                  <button onClick={() => printHawb(hawbQuery)} disabled={hawbLoading || !hawbQuery.trim()}
                    className="text-xs px-3 font-medium border-l border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap">
                    {hawbLoading ? "…" : "🖨 HAWB"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* What this HAWB costs — appears as soon as a HAWB is typed in the box above. */}
          {hawbSummary && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              {hawbSummary.rows.length === 0 ? (
                <span className="text-sm text-amber-700">ไม่พบ SO ที่ใช้ HAWB &ldquo;{hawbQuery.trim()}&rdquo; ในเอกสารที่แสดงอยู่</span>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* one coloured tile per value (HAWB · total · SO/pcs · INV/docs) */}
                  {[
                    { lbl: "HAWB", val: hawbSummary.hawbs.join(", "), box: "bg-indigo-50", l: "text-indigo-700", v: "text-indigo-950 font-mono" },
                    { lbl: "ยอดรวม (THB)", val: fmtNum(hawbSummary.total), box: "bg-amber-100", l: "text-amber-800", v: "text-amber-900 text-xl" },
                    { lbl: "SO · pcs", val: `${hawbSummary.rows.length} · ${fmtNum(hawbSummary.qty)}`, box: "bg-green-100", l: "text-green-800", v: "text-green-950" },
                    { lbl: "INV · เอกสาร", val: `${hawbSummary.invs.length} · ${hawbSummary.docs.length}`, box: "bg-pink-100", l: "text-pink-800", v: "text-pink-950" },
                  ].map(s => (
                    <div key={s.lbl} className={`flex flex-col rounded-lg px-3 py-1.5 min-w-[120px] ${s.box}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${s.l}`}>{s.lbl}</span>
                      <span className={`text-base font-extrabold tabular-nums leading-tight ${s.v}`}>{s.val}</span>
                    </div>
                  ))}
                  <button onClick={() => setHawbOpen(true)}
                    className="ml-auto text-sm px-4 py-2 rounded-lg font-semibold bg-gray-900 text-white hover:bg-gray-700">
                    ดู INV ในใบนี้ ({hawbSummary.invs.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-start gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 mt-2 shrink-0">FILTERS</span>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 min-w-0">
              <MultiSelect label="Doc No..." options={docOpts} value={docF} onChange={setDocF} />
              <MultiSelect label="Ship Date..." options={shipOpts} value={shipF} onChange={setShipF} />
              <MultiSelect label="All Brand" options={brandOpts} value={brandF} onChange={setBrandF} />
              <MultiSelect label="SO..." options={soOpts} value={soF} onChange={setSoF} />
              <MultiSelect label="All Style" options={styleOpts} value={styleF} onChange={setStyleF} />
              <MultiSelect label="Customer PO..." options={cpOpts} value={cpF} onChange={setCpF} />
              <MultiSelect label="Claim Dept" options={claimOpts} value={claimF} onChange={setClaimF} />
              <MultiSelect label="Invoice No..." options={invoiceOpts} value={invoiceF} onChange={setInvoiceF} />
            </div>
            {hasFilter && (
              <button onClick={() => { setDocF([]); setBrandF([]); setStyleF([]); setSoF([]); setCpF([]); setClaimF([]); setInvoiceF([]); setPortF([]); setShipF([]); setHawbQuery("") }}
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
                            {["SO","SUB","Style","Document","Brand","BU","Ship Date","QTY Air","Booking",""].map(h =>
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
                                <td className="py-1.5 px-3 text-gray-700 whitespace-nowrap">{item.sub || "-"}</td>
                                <td className="py-1.5 px-3 whitespace-nowrap">{item.style}</td>
                                <td className="py-1.5 px-3 text-blue-700 whitespace-nowrap">{req.documentNo}</td>
                                <td className="py-1.5 px-3 text-gray-500 whitespace-nowrap">{item.brand || req.brandName}</td>
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
                              <span className="text-xs text-gray-400">{[...new Set(items.map((i: any) => i.brand).filter(Boolean))].join(", ") || req.brandName}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${req.bu === "GW" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{req.bu}</span>
                              {req.crNo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium whitespace-nowrap">CR: {req.crNo}</span>}
                              {Array.isArray(req.supplierClaims) && req.supplierClaims.length > 0 && (
                                <span title={req.supplierClaims.map((c: any) => `${c.refNo} · ${Number(c.amount).toLocaleString()} THB`).join("\n")}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">
                                  🧾 เคลม supplier แล้ว {req.supplierClaims.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} THB
                                </span>
                              )}
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
                                onClick={e => { e.stopPropagation(); previewDocPdf(req) }}
                                className="text-xs bg-white border border-gray-300 text-gray-700 px-2.5 py-1 rounded hover:bg-gray-100 font-medium cursor-pointer whitespace-nowrap">
                                {pdfLoading === `prev-${req.id}` ? "..." : "👁 Preview"}
                              </span>
                              <span role="button" tabIndex={0}
                                onClick={e => { e.stopPropagation(); downloadDocPdf(req) }}
                                className="text-xs bg-gray-700 text-white px-2.5 py-1 rounded hover:bg-gray-800 font-medium cursor-pointer whitespace-nowrap">
                                {pdfLoading === `doc-${req.id}` ? "..." : (() => {
                                  const total = items.filter((i: any) => i.itemStatus !== "REJECTED").length
                                  const n = items.filter((i: any) => i.itemStatus !== "REJECTED" && (!unbookedOnly || !itemBooked(i)) && itemMatchesFilters(i)).length
                                  return `↓ PDF (${n < total ? `${n} SO` : "all SO"})`
                                })()}
                              </span>
                            </button>

                            {/* Items under document */}
                            {(expandedDocs.has(docKey) || hasFilter) && (
                              <div className="pl-20 pr-5 pb-3 bg-blue-50 border-t border-blue-100">
                                {/* Attach supporting files BY HAWB (retroactive) — collapsible + compact grid */}
                                {(() => {
                                  const hawbs = [...new Set((req.items || []).map((i: any) => (i.hawbNo || "").trim()).filter(Boolean))] as string[]
                                  if (!hawbs.length) return <p className="text-xs text-gray-400 mt-2">No HAWB yet — enter HAWB in LG Booking first, then attach files here.</p>
                                  const open = hawbPanel.has(req.id)
                                  // HAWB files may be stored either way: by the hawbNo field (files page upload)
                                  // OR category "HAWB:<no>" (LG entry upload) — match BOTH so files attached in
                                  // either place show up here.
                                  const attHawb = (a: any, h: string) => (a.hawbNo || "") === h || a.category === "HAWB:" + h
                                  const attached = hawbs.filter(h => (req.attachments || []).some((a: any) => attHawb(a, h))).length
                                  return (
                                    <div className="mt-2">
                                      <button onClick={e => { e.stopPropagation(); toggleHawbPanel(req.id) }}
                                        className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1.5">
                                        <span className="text-gray-400">{open ? "▾" : "▸"}</span>📎 Attach files by HAWB
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${attached === hawbs.length ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>{attached}/{hawbs.length} attached</span>
                                      </button>
                                      {open && (
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                          {hawbs.map(h => {
                                            const files = (req.attachments || []).filter((a: any) => attHawb(a, h))
                                            const key = `${req.id}:${h}`
                                            return (
                                              <div key={h} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[11px] font-semibold text-gray-700 truncate flex-1" title={h}>{h}</span>
                                                  <label className={`text-[11px] px-1.5 py-0.5 rounded border font-medium cursor-pointer shrink-0 ${hawbUploading === key ? "opacity-50 pointer-events-none bg-gray-50 border-gray-200 text-gray-400" : files.length ? "border-gray-300 text-gray-500 hover:bg-gray-50" : "border-blue-300 text-blue-600 hover:bg-blue-50"}`}>
                                                    {hawbUploading === key ? "…" : "📎"}
                                                    <input type="file" className="hidden" onClick={e => e.stopPropagation()}
                                                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attachHawb(req.id, h, f) }} />
                                                  </label>
                                                </div>
                                                {files.length > 0 && (
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                    {files.map((a: any) => (
                                                      <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer"
                                                        className="text-[10px] bg-orange-50 border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded hover:bg-orange-100 max-w-[140px] truncate">📎 {a.fileName}</a>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                                {/* Other logistics files not tied to a HAWB */}
                                {(req.attachments || []).some((a: any) => ["INV","AWB","EXPENSE"].includes(a.category) && !a.hawbNo) && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="text-xs text-gray-500 font-medium py-1">Other files:</span>
                                    {(req.attachments || []).filter((a: any) => ["INV","AWB","EXPENSE"].includes(a.category) && !a.hawbNo).map((a: any) => (
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
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">SUB</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Style</th>
                                        <th className="text-left py-1 pr-3 font-medium whitespace-nowrap">Brand</th>
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
                                            <td className="py-1.5 pr-3 font-medium text-gray-800 whitespace-nowrap">{item.so}</td>
                                            <td className="py-1.5 pr-3 text-gray-700 whitespace-nowrap">{item.sub || "-"}</td>
                                            <td className="py-1.5 pr-3 text-gray-600">{item.style}</td>
                                            <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{item.brand || req.brandName}</td>
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

      {/* PDF preview popup */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col p-4 sm:p-8" onClick={closePreview}>
          <div className="bg-white rounded-xl w-full h-full max-w-5xl mx-auto flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 shrink-0">
              <span className="text-sm font-semibold text-gray-700 truncate">👁 {preview.name}</span>
              <div className="flex items-center gap-2">
                <a href={preview.url} download={preview.name}
                  className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 font-medium">⬇ Download</a>
                <button onClick={closePreview} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 font-medium">✕ Close</button>
              </div>
            </div>
            <iframe src={preview.url} title="PDF preview" className="flex-1 w-full" />
          </div>
        </div>
      )}
      {/* HAWB breakdown — which INVs make up this HAWB and what each one costs. */}
      {hawbOpen && hawbSummary && hawbSummary.rows.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHawbOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-bold text-gray-900">HAWB <span className="font-mono">{hawbSummary.hawbs.join(", ")}</span></div>
                <div className="text-[11px] text-gray-500">{hawbSummary.invs.length} INV · {hawbSummary.rows.length} SO · รวม {fmtNum(hawbSummary.total)} THB</div>
              </div>
              <button onClick={() => setHawbOpen(false)} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">ปิด</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {hawbSummary.invs.map(g => (
                <div key={g.inv} className="rounded-xl border border-gray-200">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-gray-50 rounded-t-xl">
                    <span className="font-mono text-sm font-bold text-gray-800">{g.inv}</span>
                    <span className="text-[11px] text-gray-500">{g.sos.length} SO · {fmtNum(g.qty)} pcs</span>
                    <span className="ml-auto text-sm font-bold text-gray-900">{fmtNum(g.cost)} <span className="text-[10px] font-normal text-gray-400">THB</span></span>
                    {g.sos.length > 1 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">INV เดียว {g.sos.length} SO</span>}
                  </div>
                  <table className="w-full text-xs">
                    <thead className="text-gray-400"><tr>{["SO", "STYLE", "BRAND", "QTY", "ACTUAL (THB)", "เอกสาร"].map(h => <th key={h} className="px-3 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {g.sos.map((r: any, i: number) => (
                        <tr key={r.id || i}>
                          <td className="px-3 py-1.5 font-mono">{r.so}{r.sub ? `-${r.sub}` : ""}</td>
                          <td className="px-3 py-1.5 text-gray-600">{r.style || "-"}</td>
                          <td className="px-3 py-1.5 text-gray-600">{r.brand || "-"}</td>
                          <td className="px-3 py-1.5 text-right">{fmtNum(r.qtyRequestAir)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold">{fmtNum(r.actualAirFreight)}</td>
                          <td className="px-3 py-1.5 text-gray-500 font-mono">{r.documentNo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>

  )
}
