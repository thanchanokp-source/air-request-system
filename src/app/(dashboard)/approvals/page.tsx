"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { StatusBadge } from "@/components/ui/status-badge"
import Link from "next/link"
import { CLAIM_VP_ROLES } from "@/types"
import { MultiSelect } from "@/components/ui/multi-select"

const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

export default function ApprovalsPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [brandF, setBrandF] = useState<string[]>([])
  const [styleF, setStyleF] = useState<string[]>([])
  const [soF, setSoF] = useState<string[]>([])
  const [cpF, setCpF] = useState<string[]>([])
  const [portF, setPortF] = useState<string[]>([])
  const [countryF, setCountryF] = useState<string[]>([])
  const [claimF, setClaimF] = useState<string[]>([])
  const [invoiceF, setInvoiceF] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/requests?mine=true").then(r => r.json()).then(d => { setRequests(d); setLoading(false) })
  }, [])

  // Derive claim dept from role
  const claimDept = role.startsWith("DVM_") ? role.replace("DVM_", "")
    : role.startsWith("CLAIM_") ? role.replace("CLAIM_", "")
    : CLAIM_VP_ROLES.includes(role) ? role.replace("VP_", "")
    : ""

  // Filter documents by item-status (per-style forwarding — each role acts on specific itemStatus)
  const myRequests = requests.filter(r => {
    const items = r.items || []
    if (role === "VP_MER") return r.status === "PENDING_VP_MER" && items.some((i: any) => i.itemStatus === "PENDING")
    if (role === "SCM_USER") {
      return (r.status === "PENDING_VP_MER" && items.some((i: any) => i.itemStatus === "VP_MER_PASSED")) ||
             (r.status === "PENDING_SCM" && items.some((i: any) => i.itemStatus === "PENDING"))
    }
    if (role === "VP_SCM") return r.status === "PENDING_SCM" && items.some((i: any) => i.itemStatus === "PASSED")
    if (role === "PRESIDENT") return items.some((i: any) => i.itemStatus === "VP_PASSED")
    if (role === "LOGISTICS") return items.some((i: any) => i.itemStatus === "PRES_PASSED")
    if (role.startsWith("DVM_") || role.startsWith("CLAIM_")) {
      return items.some((i: any) => i.itemStatus === "LOG_PASSED" && i.claimDepartment === claimDept)
    }
    if (CLAIM_VP_ROLES.includes(role)) {
      return items.some((i: any) => i.itemStatus === "CLAIM_PASSED" && i.claimDepartment === claimDept)
    }
    return false
  })

  // Show only items relevant to this role
  const getRelevantItems = (r: any) => {
    const items = r.items || []
    if (role === "VP_MER") return items.filter((i: any) => i.itemStatus === "PENDING")
    if (role === "SCM_USER") {
      if (r.status === "PENDING_VP_MER") return items.filter((i: any) => i.itemStatus === "VP_MER_PASSED")
      return items.filter((i: any) => i.itemStatus === "PENDING")
    }
    if (role === "VP_SCM") return items.filter((i: any) => i.itemStatus === "PASSED")
    if (role === "PRESIDENT") return items.filter((i: any) => i.itemStatus === "VP_PASSED")
    if (role === "LOGISTICS") return items.filter((i: any) => i.itemStatus === "PRES_PASSED")
    if (role.startsWith("DVM_") || role.startsWith("CLAIM_")) {
      return items.filter((i: any) => i.itemStatus === "LOG_PASSED" && i.claimDepartment === claimDept)
    }
    if (CLAIM_VP_ROLES.includes(role)) {
      return items.filter((i: any) => i.itemStatus === "CLAIM_PASSED" && i.claimDepartment === claimDept)
    }
    return items.filter((i: any) => i.itemStatus !== "REJECTED")
  }

  const allRows = myRequests.flatMap(r =>
    getRelevantItems(r).map((item: any) => ({ ...item, request: r }))
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
    return (!brandF.length || brandF.includes(r.brandName)) &&
      (!styleF.length || styleF.includes(row.style)) &&
      (!soF.length || soF.includes(row.so)) &&
      (!cpF.length || cpF.includes(row.customerPO)) &&
      (!portF.length || portF.includes(row.port)) &&
      (!countryF.length || countryF.includes(row.country)) &&
      (!claimF.length || claimF.includes(row.claimDepartment)) &&
      (!invoiceF.length || invoiceF.includes(row.invoiceNo))
  })

  const docGroups = myRequests.filter(r => filtered.some(f => f.request.id === r.id))

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">APPROVALS</h1>
          <p className="text-xs text-gray-400 mt-0.5">{docGroups.length} document(s) pending your action</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">FILTERS</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
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

      {loading && <div className="text-center py-10 text-gray-400">Loading...</div>}
      {!loading && docGroups.length === 0 && (
        <div className="text-center py-20 text-gray-400">No pending approvals</div>
      )}

      <div className="space-y-4">
        {docGroups.map(req => {
          const reqItems = filtered.filter(f => f.request.id === req.id)
          return (
            <div key={req.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <Link href={`/requests/${req.id}`} className="font-semibold text-blue-600 hover:underline text-sm shrink-0">{req.documentNo}</Link>
                  <span className="text-xs text-gray-500 truncate">{req.brandName} · {req.buName}</span>
                  <StatusBadge status={req.status} />
                </div>
                <Link href={`/requests/${req.id}`} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium shrink-0 ml-auto">
                  Open →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>{["SO","STYLE","DESCRIPTION","GMT","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","GROSS WEIGHT (KG)","EST. AIR FREIGHT (THB)","ACTUAL AIR FREIGHT (THB)","REASON","FACTORY","COUNTRY","PORT","CLAIM DEPT","INVOICE NO"].map(h =>
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reqItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-medium">{item.so}</td>
                        <td className="px-3 py-1.5">{item.style}</td>
                        <td className="px-3 py-1.5">{item.description}</td>
                        <td className="px-3 py-1.5">{item.gmtType}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(item.originalShipmentDate)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(item.planShipmentDate)}</td>
                        <td className="px-3 py-1.5">{item.qtyOriginalShipment}</td>
                        <td className="px-3 py-1.5 font-semibold">{item.qtyRequestAir}</td>
                        <td className="px-3 py-1.5 text-blue-700">{fmtNum(item.grossWeight, 2)}</td>
                        <td className="px-3 py-1.5 text-blue-700">{fmtNum(item.airFreight)}</td>
                        <td className="px-3 py-1.5 font-semibold text-green-700">{fmtNum(item.actualAirFreight)}</td>
                        <td className="px-3 py-1.5">{item.reasonDelay}</td>
                        <td className="px-3 py-1.5">{item.factory}</td>
                        <td className="px-3 py-1.5">{item.country}</td>
                        <td className="px-3 py-1.5">{item.port}</td>
                        <td className="px-3 py-1.5">{item.claimDepartment || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{item.invoiceNo || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
