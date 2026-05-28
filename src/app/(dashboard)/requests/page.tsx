"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { MultiSelect } from "@/components/ui/multi-select"
import { PdfDownloadButton } from "@/components/pdf-download-button"

const STATUS_LABELS: Record<string, string> = {
  PENDING_VP_MER: "Pending VP MER", PENDING_SCM: "Pending SCM",
  PENDING_VP_SCM: "Pending VP SCM", PENDING_PRESIDENT: "Pending President",
  PENDING_LOGISTICS: "Pending Logistics", PENDING_CLAIM: "Pending Claim",
  PENDING_VP_CLAIM: "Pending VP Claim",
  PENDING_VP_NYK: "Pending VP NYK", COMPLETED: "Completed", REJECTED: "Rejected"
}

const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

const SoBadge = ({ s, docStatus }: { s: string; docStatus: string }) => {
  const completed = s === "COMPLETED" || (docStatus === "COMPLETED" && s !== "REJECTED")
  const rejected = s === "REJECTED" || docStatus === "REJECTED"
  const cls = completed ? "bg-green-100 text-green-700" : rejected ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
  const lbl = completed ? "Completed" : rejected ? "Rejected" : "Pending"
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>{lbl}</span>
}

const getSoCurrentStep = (docStatus: string, itemStatus: string): string => {
  if (itemStatus === "REJECTED") return "Rejected"
  if (itemStatus === "COMPLETED") return "Completed"
  if (itemStatus === "PENDING") return docStatus === "PENDING_SCM" ? "SCM" : "VP MER"
  if (itemStatus === "VP_MER_PASSED") return "SCM"
  if (itemStatus === "PASSED") return "VP SCM"
  if (itemStatus === "VP_PASSED") return "President"
  if (itemStatus === "PRES_PASSED") return "Logistics"
  if (itemStatus === "LOG_PASSED") return "Claim"
  if (itemStatus === "CLAIM_PASSED") return "VP Claim"
  return "-"
}

const STEP_COLORS: Record<string, string> = {
  "VP MER": "bg-yellow-100 text-yellow-700",
  "SCM": "bg-orange-100 text-orange-700",
  "VP SCM": "bg-amber-100 text-amber-700",
  "President": "bg-purple-100 text-purple-700",
  "Logistics": "bg-blue-100 text-blue-700",
  "Claim": "bg-indigo-100 text-indigo-700",
  "VP Claim": "bg-violet-100 text-violet-700",
  "Completed": "bg-green-100 text-green-700",
  "Rejected": "bg-red-100 text-red-700",
}

const CurrentStepBadge = ({ docStatus, itemStatus }: { docStatus: string; itemStatus: string }) => {
  const step = getSoCurrentStep(docStatus, itemStatus)
  const cls = STEP_COLORS[step] || "bg-gray-100 text-gray-500"
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${cls}`}>{step}</span>
}


export default function RequestsPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const [requests, setRequests] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [brandF, setBrandF] = useState<string[]>([])
  const [styleF, setStyleF] = useState<string[]>([])
  const [soF, setSoF] = useState<string[]>([])
  const [cpF, setCpF] = useState<string[]>([])
  const [portF, setPortF] = useState<string[]>([])
  const [countryF, setCountryF] = useState<string[]>([])
  const [claimF, setClaimF] = useState<string[]>([])
  const [invoiceF, setInvoiceF] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/requests").then(r => r.json()).then(d => { setRequests(d); setLoading(false) })
  }, [])

  const allRows = requests.flatMap(r =>
    (r.items || []).map((item: any) => ({ ...item, request: r }))
  )

  const brands = [...new Set(allRows.map(r => r.request.brandName).filter(Boolean))].sort()
  const styles = [...new Set(allRows.map(r => r.style).filter(Boolean))].sort()
  const sos = [...new Set(allRows.map(r => r.so).filter(Boolean))].sort()
  const cps = [...new Set(allRows.map(r => r.customerPO).filter(Boolean))].sort()
  const ports = [...new Set(allRows.map(r => r.port).filter(Boolean))].sort()
  const countries = [...new Set(allRows.map(r => r.country).filter(Boolean))].sort()
  const invoices = [...new Set(allRows.map(r => r.invoiceNo).filter(Boolean))].sort()

  const filtered = allRows.filter(row => {
    const r = row.request
    return (!statusFilter || r.status === statusFilter) &&
      (!brandF.length || brandF.includes(r.brandName)) &&
      (!styleF.length || styleF.includes(row.style)) &&
      (!soF.length || soF.includes(row.so)) &&
      (!cpF.length || cpF.includes(row.customerPO)) &&
      (!portF.length || portF.includes(row.port)) &&
      (!countryF.length || countryF.includes(row.country)) &&
      (!claimF.length || claimF.includes(row.claimDepartment)) &&
      (!invoiceF.length || invoiceF.includes(row.invoiceNo))
  })

  const docGroups = requests.map(req => {
    const reqRows = filtered.filter(row => row.request.id === req.id)
    if (!reqRows.length) return null
    const styleMap: Record<string, any[]> = {}
    for (const row of reqRows) {
      const s = row.style || "(no style)"
      if (!styleMap[s]) styleMap[s] = []
      styleMap[s].push(row)
    }
    return { request: req, styles: Object.entries(styleMap).map(([style, rows]) => ({ style, rows })), total: reqRows.length }
  }).filter(Boolean) as { request: any, styles: { style: string, rows: any[] }[], total: number }[]

  const toggleDoc = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleStyle = (k: string) => setExpandedStyles(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const deleteRequest = async (reqId: string) => {
    if (!confirm("Delete this request?")) return
    const res = await fetch(`/api/requests/${reqId}`, { method: "DELETE" })
    if (res.ok) setRequests(prev => prev.filter(r => r.id !== reqId))
  }

  const SO_COLS = [
    ["SO",""],["CUSTOMER PO",""],["GMT",""],["ORIG. DATE","min-w-[90px]"],["PLAN DATE","min-w-[90px]"],
    ["QTY ORIG",""],["QTY AIR",""],["GROSS WEIGHT (KG)","min-w-[110px]"],
    ["EST. AIR FREIGHT (THB)","min-w-[120px]"],["ACTUAL AIR FREIGHT (THB)","min-w-[130px]"],
    ["FACTORY",""],["COUNTRY",""],["PORT",""],["CLAIM DEPT","min-w-[100px]"],["INVOICE NO","min-w-[100px]"],["REASON","min-w-[130px]"],
    ["SO STATUS","min-w-[90px]"],["CURRENT STEP","min-w-[110px]"],
    ["SCM FILE","min-w-[100px]"],["APPROVAL FILE","min-w-[110px]"],["BOOKING FILE","min-w-[110px]"],
    ["LOGISTICS FILE","min-w-[110px]"]
  ] as [string,string][]

  const getFileLinks = (atts: any[], itemId: string, roles: string[]) =>
    (atts || []).filter(a => a.itemId === itemId && roles.includes(a.uploadedBy?.role))

  const [claimExpanded, setClaimExpanded] = useState(false)

  const POSITIONS = [
    { key: "PENDING_VP_MER", label: "VP MER" },
    { key: "PENDING_SCM", label: "SCM" },
    { key: "PENDING_VP_SCM", label: "VP SCM" },
    { key: "PENDING_PRESIDENT", label: "PRESIDENT" },
    { key: "PENDING_LOGISTICS", label: "LOGISTICS" },
    { key: "PENDING_CLAIM", label: "CLAIM" },
    { key: "PENDING_VP_CLAIM", label: "VP CLAIM" },
  ]

  const claimRows = allRows.filter(r => r.itemStatus === "LOG_PASSED")
  const claimByDept: Record<string, number> = {}
  for (const r of claimRows) {
    const dept = r.claimDepartment || "Unassigned"
    claimByDept[dept] = (claimByDept[dept] || 0) + 1
  }

  const totalCompleted = allRows.filter(r => r.itemStatus === "COMPLETED").length
  const totalRejected = allRows.filter(r => r.itemStatus === "REJECTED").length
  const totalPending = allRows.filter(r => r.itemStatus !== "COMPLETED" && r.itemStatus !== "REJECTED").length

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">AIR REQUESTS</h1>
        {role === "MER_USER" && (
          <Link href="/requests/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + New Request
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="border rounded-xl p-3 sm:p-4 bg-green-50 border-green-200 flex items-center gap-2 sm:gap-4">
          <div className="text-2xl sm:text-3xl font-bold text-green-600">{totalCompleted}</div>
          <div><div className="text-xs sm:text-sm font-semibold text-green-700">COMPLETED</div><div className="text-xs text-green-500">SO(s)</div></div>
        </div>
        <div className="border rounded-xl p-3 sm:p-4 bg-yellow-50 border-yellow-200 flex items-center gap-2 sm:gap-4">
          <div className="text-2xl sm:text-3xl font-bold text-yellow-600">{totalPending}</div>
          <div><div className="text-xs sm:text-sm font-semibold text-yellow-700">PENDING</div><div className="text-xs text-yellow-500">SO(s)</div></div>
        </div>
        <div className="border rounded-xl p-3 sm:p-4 bg-red-50 border-red-200 flex items-center gap-2 sm:gap-4">
          <div className="text-2xl sm:text-3xl font-bold text-red-600">{totalRejected}</div>
          <div><div className="text-xs sm:text-sm font-semibold text-red-700">REJECTED</div><div className="text-xs text-red-500">SO(s)</div></div>
        </div>
      </div>

      <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Pending by Stage</span>
        <div className="flex-1 border-t border-blue-100"></div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
        {POSITIONS.map(({ key, label }) => {
          const ITEM_TO_STEP: Record<string, string> = {
            PENDING: "PENDING_VP_MER",
            VP_MER_PASSED: "PENDING_SCM",
            PASSED: "PENDING_VP_SCM",
            VP_PASSED: "PENDING_PRESIDENT",
            PRES_PASSED: "PENDING_LOGISTICS",
            LOG_PASSED: "PENDING_CLAIM",
            CLAIM_PASSED: "PENDING_VP_CLAIM",
          }
          const count = allRows.filter(r => {
            if (r.itemStatus === "REJECTED" || r.itemStatus === "COMPLETED") return false
            const step = r.itemStatus === "PENDING"
              ? (r.request.status === "PENDING_SCM" ? "PENDING_SCM" : "PENDING_VP_MER")
              : ITEM_TO_STEP[r.itemStatus]
            return step === key
          }).length
          const isClaim = key === "PENDING_CLAIM"
          return (
            <div key={key} className={`border rounded-xl p-2 sm:p-3 border-blue-200 bg-blue-50 ${isClaim ? "cursor-pointer" : ""}`}
              onClick={() => isClaim && setClaimExpanded(p => !p)}>
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{count}</div>
              <div className="text-[10px] sm:text-xs font-semibold mt-0.5 flex items-center gap-1 text-blue-700">
                {label} {isClaim && <span className="text-xs">{claimExpanded ? "▲" : "▼"}</span>}
              </div>
              {isClaim && claimExpanded && count > 0 && (
                <div className="mt-2 space-y-1 border-t border-blue-200 pt-2">
                  {Object.entries(claimByDept).map(([dept, n]) => (
                    <div key={dept} className="flex justify-between text-xs">
                      <span className="text-blue-600">{dept}</span>
                      <span className="font-semibold text-blue-700">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">FILTERS</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <MultiSelect label="All Brand" options={brands} value={brandF} onChange={setBrandF} />
          <MultiSelect label="All Style" options={styles} value={styleF} onChange={setStyleF} />
          <MultiSelect label="SO..." options={sos} value={soF} onChange={setSoF} />
          <MultiSelect label="Customer PO..." options={cps} value={cpF} onChange={setCpF} />
          <MultiSelect label="All Port" options={ports} value={portF} onChange={setPortF} />
          <MultiSelect label="All Country" options={countries} value={countryF} onChange={setCountryF} />
          <MultiSelect label="Claim Dept" options={["COMMERCIAL","PROCUREMENT","NYK","PRODUCTION"]} value={claimF} onChange={setClaimF} />
          <MultiSelect label="Invoice No..." options={invoices} value={invoiceF} onChange={setInvoiceF} />
        </div>
      </div>

      <div className="space-y-3">
        {loading && <div className="bg-white rounded-xl border p-10 text-center text-gray-400">Loading...</div>}
        {!loading && docGroups.length === 0 && (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No results found</div>
        )}
        {!loading && docGroups.map(dg => {
          const isDocExp = expanded.has(dg.request.id)
          return (
            <div key={dg.request.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Document header */}
              <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 cursor-pointer hover:bg-gray-50 select-none bg-gray-50 border-b border-gray-100 min-w-0" onClick={() => toggleDoc(dg.request.id)}>
                <span className="text-gray-400 text-xs w-4 shrink-0">{isDocExp ? "▼" : "▶"}</span>
                <Link href={`/requests/${dg.request.id}`} onClick={e => e.stopPropagation()}
                  className="font-bold text-blue-700 hover:underline text-sm shrink-0">{dg.request.documentNo}</Link>
                {role === "MER_USER" && dg.request.status === "PENDING_VP_MER" && (
                  <button onClick={e => { e.stopPropagation(); deleteRequest(dg.request.id) }}
                    className="text-red-400 hover:text-red-600 text-xs shrink-0" title="Delete">✕</button>
                )}
                <span className="text-xs text-gray-500 truncate">{dg.request.brandName} · {dg.request.buName}</span>
                {dg.request.status === "REJECTED" && dg.request.approvalLogs?.[0] && (
                  <span className="text-xs text-red-500 shrink-0">by {dg.request.approvalLogs[0].user?.name}</span>
                )}
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto shrink-0">{dg.styles.length} style(s) · {dg.total} SO(s)</span>
                {(dg.request.attachments || []).filter((a: any) => ["MER_USER","VP_MER"].includes(a.uploadedBy?.role)).map((att: any) => (
                  <a key={att.id} href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full hover:bg-orange-100 whitespace-nowrap font-medium shrink-0">
                    📎 {att.fileName}
                  </a>
                ))}
                <PdfDownloadButton req={dg.request} compact />
              </div>

              {/* Style groups */}
              {isDocExp && (
                <div className="divide-y divide-gray-100">
                  {dg.styles.map(sg => {
                    const styleKey = `${dg.request.id}||${sg.style}`
                    const isStyleExp = expandedStyles.has(styleKey)
                    return (
                      <div key={styleKey}>
                        <div className="flex items-center gap-3 px-6 py-2.5 cursor-pointer hover:bg-blue-50/30 select-none" onClick={() => toggleStyle(styleKey)}>
                          <span className="text-gray-300 text-xs w-4">{isStyleExp ? "▼" : "▶"}</span>
                          <span className="font-semibold text-gray-700 text-sm">{sg.style}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sg.rows.length} SO(s)</span>
                        </div>
                        {isStyleExp && (
                          <div className="overflow-x-auto border-t border-gray-50">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>{SO_COLS.map(([h, w]) =>
                                  <th key={h} className={`px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap ${w}`}>{h}</th>
                                )}</tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {sg.rows.map((row: any) => (
                                  <tr key={row.id} className={`hover:bg-blue-50/30 ${row.itemStatus === "REJECTED" ? "opacity-50" : ""}`}>
                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{row.so}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{row.customerPO || "-"}</td>
                                    <td className="px-3 py-2">{row.gmtType || "-"}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(row.originalShipmentDate)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(row.planShipmentDate)}</td>
                                    <td className="px-3 py-2">{row.qtyOriginalShipment}</td>
                                    <td className="px-3 py-2 font-semibold">{row.qtyRequestAir}</td>
                                    <td className="px-3 py-2 text-blue-700">{fmtNum(row.grossWeight, 2)}</td>
                                    <td className="px-3 py-2 text-blue-700">{fmtNum(row.airFreight)}</td>
                                    <td className="px-3 py-2 font-semibold text-green-700">{fmtNum(row.actualAirFreight)}</td>
                                    <td className="px-3 py-2">{row.factory}</td>
                                    <td className="px-3 py-2">{row.country}</td>
                                    <td className="px-3 py-2">{row.port}</td>
                                    <td className="px-3 py-2">{row.claimDepartment || "-"}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{row.invoiceNo || "-"}</td>
                                    <td className="px-3 py-2 max-w-[150px] truncate" title={row.reasonDelay}>{row.reasonDelay || "-"}</td>
                                    <td className="px-3 py-2"><SoBadge s={row.itemStatus} docStatus={row.request.status} /></td>
                                    <td className="px-3 py-2"><CurrentStepBadge docStatus={row.request.status} itemStatus={row.itemStatus} /></td>
                                    <td className="px-3 py-2">{(() => { const f = getFileLinks(dg.request.attachments, row.id, ["SCM_USER","VP_SCM"]); return f.length ? f.map((a: any) => <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap">📎 {a.fileName}</a>) : <span className="text-gray-300">—</span> })()}</td>
                                    <td className="px-3 py-2">{(() => { const f = getFileLinks(dg.request.attachments, row.id, ["DVM_COMMERCIAL","DVM_PROCUREMENT","DVM_NYK","DVM_PRODUCTION","CLAIM_COMMERCIAL","CLAIM_PROCUREMENT","CLAIM_NYK","CLAIM_PRODUCTION"]); return f.length ? f.map((a: any) => <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline whitespace-nowrap">📎 {a.fileName}</a>) : <span className="text-gray-300">—</span> })()}</td>
                                    <td className="px-3 py-2"><PdfDownloadButton req={dg.request} item={row} compact alwaysShow={row.itemStatus === "COMPLETED"} /></td>
                                    <td className="px-3 py-2">{(() => { const f = getFileLinks(dg.request.attachments, row.id, ["LOGISTICS"]); return f.length ? f.map((a: any) => <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-green-600 hover:underline whitespace-nowrap">📎 {a.fileName}</a>) : <span className="text-gray-300">—</span> })()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400">{docGroups.length} document(s) · {filtered.length} SO(s)</p>
    </div>
  )
}
