"use client"
import { useEffect, useState, useMemo } from "react"

const STATUSES = ["PENDING_VP_MER","PENDING_SCM","PENDING_VP_SCM","PENDING_PRESIDENT","PENDING_LOGISTICS","PENDING_CLAIM","COMPLETED","REJECTED"]

export default function AnalyticsPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("")
  const [filterBrand, setFilterBrand] = useState("")
  const [filterSO, setFilterSO] = useState("")
  const [filterPO, setFilterPO] = useState("")

  useEffect(() => {
    fetch("/api/analytics").then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [])

  const brands = useMemo(() => [...new Set(data.map(r => r.brandName).filter(Boolean))].sort(), [data])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (filterStatus && r.status !== filterStatus) return false
      if (filterBrand && r.brandName !== filterBrand) return false
      if (filterSO || filterPO) {
        const hasItem = r.items?.some((item: any) =>
          (!filterSO || item.so?.toLowerCase().includes(filterSO.toLowerCase())) &&
          (!filterPO || item.customerPO?.toLowerCase().includes(filterPO.toLowerCase()))
        )
        if (!hasItem) return false
      }
      return true
    })
  }, [data, filterStatus, filterBrand, filterSO, filterPO])

  const stats = useMemo(() => {
    const allItems = filtered.flatMap((r: any) => r.items || []).filter((item: any) => {
      return (!filterSO || item.so?.toLowerCase().includes(filterSO.toLowerCase())) &&
             (!filterPO || item.customerPO?.toLowerCase().includes(filterPO.toLowerCase()))
    })
    const totalAirfreight = filtered.filter((r: any) => r.status === "COMPLETED")
      .reduce((s: number, r: any) => s + (r.actualAirFreight || 0), 0)
    const totalPcs = allItems.reduce((s: number, i: any) => s + (i.qtyRequestAir || 0), 0)
    const totalOrigPcs = allItems.reduce((s: number, i: any) => s + (i.qtyOriginalShipment || 0), 0)
    const byStatus = STATUSES.map(s => ({ status: s, count: filtered.filter((r: any) => r.status === s).length })).filter(s => s.count > 0)
    const byBrand = [...new Set(filtered.map((r: any) => r.brandName))].map(b => ({
      brand: b, count: filtered.filter((r: any) => r.brandName === b).length
    })).sort((a, b) => b.count - a.count)
    return { totalAirfreight, totalPcs, totalOrigPcs, soCount: allItems.length, byStatus, byBrand }
  }, [filtered, filterSO, filterPO])

  const hasFilter = filterStatus || filterBrand || filterSO || filterPO

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        {hasFilter && (
          <button onClick={() => { setFilterStatus(""); setFilterBrand(""); setFilterSO(""); setFilterPO("") }}
            className="text-sm text-blue-600 hover:underline">Clear filters</button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">Brand</label>
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">SO</label>
          <input type="text" placeholder="Search SO..." value={filterSO}
            onChange={e => setFilterSO(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">Customer PO</label>
          <input type="text" placeholder="Search Customer PO..." value={filterPO}
            onChange={e => setFilterPO(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      </div>

      {loading ? <div className="text-center py-20 text-gray-400">Loading...</div> : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Requests", value: filtered.length.toString(), color: "blue" },
              { label: "Total Airfreight (USD)", value: stats.totalAirfreight.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: "green" },
              { label: "QTY Air (pcs)", value: stats.totalPcs.toLocaleString(), color: "purple" },
              { label: "SO Lines", value: stats.soCount.toLocaleString(), color: "orange" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border p-5 bg-${color}-50 border-${color}-200`}>
                <p className={`text-sm text-${color}-600 font-medium`}>{label}</p>
                <p className={`text-3xl font-bold text-${color}-700 mt-1`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4">By Status</h2>
              {stats.byStatus.length === 0 ? <p className="text-gray-400 text-sm">No data</p> : (
                <div className="space-y-2">
                  {stats.byStatus.map(s => (
                    <div key={s.status} className="flex justify-between text-sm">
                      <span className="text-gray-500">{s.status.replace(/_/g, " ")}</span>
                      <span className="font-bold">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-4">By Brand</h2>
              {stats.byBrand.length === 0 ? <p className="text-gray-400 text-sm">No data</p> : (
                <div className="space-y-2">
                  {stats.byBrand.map(b => (
                    <div key={b.brand} className="flex justify-between text-sm">
                      <span className="text-gray-500">{b.brand}</span>
                      <span className="font-bold">{b.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">Requests ({filtered.length})</h2>
            </div>
            <table className="text-sm w-full">
              <thead className="bg-gray-50 border-b">
                <tr>{["Doc No","Brand","BU","Status","Airfreight (USD)","QTY Air","SO Lines"].map(h =>
                  <th key={h} className="px-4 py-2 text-left text-gray-600">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data</td></tr>}
                {filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-blue-700">{r.documentNo}</td>
                    <td className="px-4 py-2">{r.brandName}</td>
                    <td className="px-4 py-2">{r.buName}</td>
                    <td className="px-4 py-2 text-xs">{r.status.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2">{r.actualAirFreight?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "-"}</td>
                    <td className="px-4 py-2">{r.items?.reduce((s: number, i: any) => s + (i.qtyRequestAir || 0), 0).toLocaleString()}</td>
                    <td className="px-4 py-2">{r.items?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
