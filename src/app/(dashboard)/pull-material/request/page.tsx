"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { buColor } from "../_StageWork"

const MAROON = "#6b1a1a"
const BUS = ["NYG", "EA", "TRM", "GW"]

type Bom = {
  soNoDoc: string; customerName?: string; customerPo?: string; vendorName?: string
  poNoDoc?: string; style?: string; brand?: string; gmtType?: string
  shipmentDate?: string; orderQty?: number
  itemCode?: string; itemName?: string; bomQty?: number; bomUom?: string; consumption?: number
  bu?: string; soYear?: string; groupCode?: string; cpartNo?: string; partDesc?: string
  itemNo?: string; poqtyBomdummy?: number; poDate?: string; updInhouse?: string
  status?: string; poUsername?: string; mrdDate?: string; mrdNeedDate?: string; mrd2?: string
}

// Columns SCM sees when selecting material lines (per BOM spec)
const MAT_COLS: { k: keyof Bom; label: string; kind?: "date" | "num" }[] = [
  { k: "bu", label: "BU" }, { k: "soYear", label: "SO YEAR" }, { k: "soNoDoc", label: "SO NO" },
  { k: "poNoDoc", label: "PO NO" },
  { k: "customerName", label: "CUST NAME" }, { k: "groupCode", label: "GROUP" },
  { k: "itemCode", label: "ITEM CODE" }, { k: "itemNo", label: "ITEM NO" },
  { k: "itemName", label: "ITEM NAME" }, { k: "consumption", label: "CONSUMPTION", kind: "num" },
  { k: "cpartNo", label: "CPART" }, { k: "partDesc", label: "PART DESC" },
  { k: "orderQty", label: "ORDER QTY", kind: "num" },
  { k: "poqtyBomdummy", label: "POQTY BOMDUMMY", kind: "num" },
  { k: "poDate", label: "PO DATE", kind: "date" }, { k: "updInhouse", label: "UPD INHOUSE", kind: "date" },
  { k: "vendorName", label: "VEND NAME" }, { k: "status", label: "STATUS" }, { k: "poUsername", label: "POUSERNAME" },
  { k: "mrdDate", label: "MRD DATE", kind: "date" }, { k: "mrdNeedDate", label: "MRD NEED", kind: "date" },
  { k: "mrd2", label: "MRD2", kind: "date" },
]
type ScmInfo = { inHouseAirDate: string; inHouseSeaDate: string; sewingStartDate: string; reasonAirPick: string; grossWeightKg: string; airFreightCost: string }
type CartItem = Bom & ScmInfo & { key: string; pullGarment: number; pullMaterialQty: number }

const fmt = (n: any) => (n == null || isNaN(Number(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString("en-GB") }

export default function ScmRequestPage() {
  const { data: session, status } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = roles.includes("ADMIN") || roles.includes("SCM_PULL")

  const [bu, setBu] = useState("NYG")
  const [q, setQ] = useState("")
  const [poQ, setPoQ] = useState("")
  const [results, setResults] = useState<Bom[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"request" | "approve">("request")

  const [openSo, setOpenSo] = useState<Bom | null>(null)
  const [materials, setMaterials] = useState<Bom[]>([])
  const [loadingMat, setLoadingMat] = useState(false)
  const [pullGarment, setPullGarment] = useState("")
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const emptyScm = { inHouseAirDate: "", inHouseSeaDate: "", sewingStartDate: "", reasonAirPick: "", grossWeightKg: "", airFreightCost: "" }
  const [scm, setScm] = useState({ ...emptyScm })

  const [cart, setCart] = useState<CartItem[]>([])
  const [remark, setRemark] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  // Requester is always the logged-in user (creator) — no manual field.
  const requesterName = (session?.user as any)?.name || (session?.user as any)?.email || ""

  // BOM data freshness (from the daily refresh job → insert_date)
  useEffect(() => {
    fetch("/api/bom", { method: "POST" }).then(r => r.json()).then(d => setLastSync(d.lastSync || null)).catch(() => {})
  }, [])

  const sync = (() => {
    if (!lastSync) return null
    const d = new Date(lastSync)
    if (isNaN(d.getTime())) return null
    const stale = d.toDateString() !== new Date().toDateString()
    return { txt: d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }), stale }
  })()

  // Debounced search-as-you-type → dropdown of matching SOs (by SO number and/or PO)
  useEffect(() => {
    if (!q.trim() && !poQ.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const qs = new URLSearchParams({ bu, limit: "30" })
        if (q.trim()) qs.set("q", q.trim())
        if (poQ.trim()) qs.set("po", poQ.trim())
        const r = await fetch(`/api/bom?${qs.toString()}`).then(r => r.json())
        setResults(Array.isArray(r.rows) ? r.rows : []); setOpen(true)
      } finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [q, poQ, bu])

  const pickSo = async (b: Bom) => {
    setOpenSo(b); setMaterials([]); setPullGarment(""); setTicked(new Set()); setScm({ ...emptyScm }); setLoadingMat(true)
    try {
      const r = await fetch(`/api/bom?bu=${bu}&so=${encodeURIComponent(b.soNoDoc)}`).then(r => r.json())
      setMaterials(Array.isArray(r.rows) ? r.rows : [])
    } finally { setLoadingMat(false) }
  }

  const toggle = (code: string) => setTicked(p => { const n = new Set(p); n.has(code) ? n.delete(code) : n.add(code); return n })

  // material qty scales with pull garment: bomQty * (pullGarment / orderQty)
  const calcQty = (m: Bom, garment: number) =>
    (m.bomQty && m.orderQty) ? Math.round((m.bomQty * garment / m.orderQty) * 100) / 100 : 0

  const addToCart = () => {
    const g = Number(pullGarment)
    if (!g || g <= 0) return alert("Enter the number of garments to pull first.")
    const picked = materials.filter(m => m.itemCode && ticked.has(m.itemCode))
    if (picked.length === 0) return alert("Tick at least one material line.")
    const add = picked.map(m => ({
      ...m, key: `${m.soNoDoc}|${m.itemCode}`,
      pullGarment: g, pullMaterialQty: calcQty(m, g), ...scm,
    }))
    setCart(prev => [...prev.filter(c => !add.some(a => a.key === c.key)), ...add])
    setOpenSo(null); setMaterials([]); setPullGarment(""); setTicked(new Set()); setScm({ ...emptyScm })
  }
  const removeCart = (key: string) => setCart(p => p.filter(c => c.key !== key))

  const submit = async () => {
    if (!requesterName.trim()) return alert("No signed-in user found.")
    if (cart.length === 0) return alert("No items in the request yet.")
    if (!confirm(`Submit Pull Material request with ${cart.length} item(s)?`)) return
    setSubmitting(true)
    try {
      const r = await fetch("/api/pull-material", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bu, requesterName, requesterEmail: (session?.user as any)?.email, remark, items: cart, requestType: "SCM" }),
      })
      const d = await r.json()
      if (r.ok) { alert(`Submitted: ${d.request?.documentNo}`); setCart([]); setRemark("") }
      else alert(`Error: ${d.error || "submit failed"}`)
    } finally { setSubmitting(false) }
  }

  if (status === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return (
    <div className="p-10 max-w-lg mx-auto text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="text-lg font-bold mt-3" style={{ color: MAROON }}>Pull Material — under testing</h1>
      <p className="text-sm text-gray-500 mt-2">Opens to everyone once testing is complete.</p>
    </div>
  )

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>SCM — Pull Material</h1>
        <p className="text-sm text-gray-500">Request: pick SO / material + pull qty · Send Approve: decide air after LG + PC fill their data</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([["request", "1 · Request"], ["approve", "2 · Send Approve"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-current" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            style={tab === k ? { color: MAROON, borderColor: MAROON } : undefined}>{label}</button>
        ))}
      </div>

      {tab === "approve" ? <SendApprove bu={bu} setBu={setBu} /> : <>

      {/* BU tabs */}
      <div className="flex gap-1.5">
        {BUS.map(b => (
          <button key={b} onClick={() => { setBu(b); setResults([]); setOpenSo(null) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border p-4">
        {sync && (
          <div className={`mb-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${sync.stale ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-green-50 border-green-300 text-green-800"}`}>
            {sync.stale ? "⚠ BOM may be stale" : "● BOM last updated"}: {sync.txt}
            {sync.stale && <span className="opacity-80">— job may not have run today</span>}
          </div>
        )}
        <div className="relative">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Type SO number…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            <input value={poQ} onChange={e => setPoQ(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="…or PO number"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          {searching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>}
          {open && results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-80 overflow-auto">
              {results.map((b, i) => (
                <button key={i} onMouseDown={() => { pickSo(b); setQ(b.soNoDoc); setPoQ(""); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 border-b border-gray-50 last:border-0">
                  <span className="font-semibold text-gray-800">{b.soNoDoc}</span>
                  <span className="text-gray-600"> · PO {b.poNoDoc || "-"}</span>
                  <span className="text-gray-500"> · {b.customerName || "-"} · {b.brand || "-"}/{b.gmtType || "-"} · order {fmt(b.orderQty)}</span>
                </button>
              ))}
            </div>
          )}
          {open && (q.trim() || poQ.trim()) && !searching && results.length === 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg px-3 py-2 text-xs text-gray-400">No SO found</div>
          )}
        </div>
      </div>

      {/* Material lines of the picked SO */}
      {openSo && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800">Materials of SO {openSo.soNoDoc}
            <span className="text-xs text-gray-400 font-normal"> · {openSo.customerName} · order {fmt(openSo.orderQty)} pcs</span>
          </h2>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <label className="text-sm font-semibold text-gray-600">Pull how many garments: *</label>
            <input value={pullGarment} onChange={e => setPullGarment(e.target.value)} type="number" placeholder="e.g. 30"
              className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-xs text-gray-400">from order {fmt(openSo.orderQty)} pcs → material qty auto-calculated</span>
          </div>

          {loadingMat ? <p className="text-sm text-gray-400 mt-3">Loading materials…</p> : (
            <div className="mt-3 border rounded-xl overflow-auto max-h-[340px]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0"><tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Pick</th>
                  {MAT_COLS.map(c => <th key={c.k} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{c.label}</th>)}
                  <th className="px-3 py-2 text-left font-medium text-red-700 whitespace-nowrap">PULL (calc)</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {materials.map((m, i) => {
                    const g = Number(pullGarment) || 0
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <input type="checkbox" checked={!!m.itemCode && ticked.has(m.itemCode)} onChange={() => m.itemCode && toggle(m.itemCode)} />
                        </td>
                        {MAT_COLS.map(c => {
                          const v = (m as any)[c.k]
                          return <td key={c.k} className={`px-3 py-1.5 whitespace-nowrap ${c.kind === "num" ? "text-right" : ""}`}>
                            {c.kind === "date" ? fmtDate(v) : c.kind === "num" ? fmt(v) : (v ?? "-")}
                          </td>
                        })}
                        <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap" style={{ color: MAROON }}>
                          {g > 0 ? `${fmt(calcQty(m, g))} ${m.bomUom || ""}` : "-"}
                        </td>
                      </tr>
                    )
                  })}
                  {materials.length === 0 && <tr><td colSpan={MAT_COLS.length + 2} className="px-3 py-3 text-center text-gray-400">No materials found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button onClick={addToCart} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>
              + Add to request
            </button>
          </div>
        </div>
      )}

      {/* Cart */}
      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold text-gray-800">Items to pull ({cart.length})</h2>
        <p className="text-xs text-gray-500 mt-1">Requester: <span className="font-medium text-gray-700">{requesterName || "-"}</span></p>
        {cart.length === 0 ? <p className="text-sm text-gray-400 mt-3">No items yet — search an SO and pick materials.</p> : (
          <div className="border rounded-xl overflow-auto mt-3">
            <table className="w-full text-xs">
              <thead className="bg-gray-50"><tr>
                {["SO", "Item No", "Item Code", "Material", "Consumption", "PULL garment", "PULL material", "Unit", ""].map(h =>
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {cart.map(c => (
                  <tr key={c.key} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-semibold text-gray-800">{c.soNoDoc}</td>
                    <td className="px-3 py-1.5">{c.itemNo || "-"}</td>
                    <td className="px-3 py-1.5">{c.itemCode || "-"}</td>
                    <td className="px-3 py-1.5">{c.itemName || c.itemCode}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(c.consumption)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(c.pullGarment)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(c.pullMaterialQty)}</td>
                    <td className="px-3 py-1.5">{c.bomUom || "-"}</td>
                    <td className="px-3 py-1.5 text-center"><button onClick={() => removeCart(c.key)} className="text-gray-300 hover:text-red-500">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <label className="text-xs font-semibold text-gray-600">Remark</label>
          <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} placeholder="Note for this pull request (optional)"
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={submit} disabled={submitting || cart.length === 0}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: MAROON }}>
            {submitting ? "Submitting…" : "Submit Pull Material →"}
          </button>
        </div>
      </div>
      </>}
    </div>
  )
}

// ── SCM · Send Approve — pick which lines go AIR + sew date per line, after PC+LG data ──
function SendApprove({ bu, setBu }: { bu: string; setBu: (b: string) => void }) {
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState<Record<string, string>>({})
  const [air, setAir] = useState<Record<string, boolean>>({})       // itemId → air?
  const [sew, setSew] = useState<Record<string, string>>({})        // itemId → sew date
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      const rows = (d.requests || []).filter((r: any) => r.status === "PENDING_SCM_DECISION")
      setReqs(rows)
      // default: every line AIR; prefill sew date from snapshot
      const a: Record<string, boolean> = {}, s: Record<string, string> = {}
      rows.forEach((rq: any) => rq.items.forEach((it: any) => {
        a[it.id] = it.airDecision ? it.airDecision === "AIR" : true
        s[it.id] = it.sewingStartDate ? String(it.sewingStartDate).slice(0, 10) : ""
      }))
      setAir(a); setSew(s)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [bu]) // eslint-disable-line

  const submit = async (rq: any) => {
    const anyAir = rq.items.some((it: any) => air[it.id])
    if (anyAir && !(reason[rq.id] || "").trim()) return alert("Enter the Reason for Air before requesting approval.")
    if (!confirm(anyAir ? "Send the AIR lines for approval?" : "Mark all lines as NO AIR?")) return
    setBusy(rq.id)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: anyAir ? "PENDING_VP_SCM" : "NO_AIR",
          itemUpdates: rq.items.map((it: any) => ({
            id: it.id,
            airDecision: air[it.id] ? "AIR" : "NO_AIR",
            sewingStartDate: sew[it.id] || null,
            reasonAirPick: air[it.id] ? (reason[rq.id] || "") : null,
          })),
        }),
      })
      if (r.ok) await load()
    } finally { setBusy(null) }
  }

  return (
    <>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No documents pending decision — must pass Purchasing (PC) + LG first</div> :
          reqs.map(rq => (
            <div key={rq.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                  <span className="text-xs text-gray-500"> · {rq.requesterName} · {rq.items.length} items</span></div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Pending SCM air decision</span>
              </div>
              <div className="mt-3 border rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    {["✈ AIR", "SO", "Material", "PULL", "Consumption", "Country", "Incoterm", "G.W.(kg)", "Air Freight", "Sea Freight", "Lead Air", "Lead Sea", "In-House Air", "In-House Sea", "Sew Date"].map(h =>
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rq.items.map((it: any) => (
                      <tr key={it.id} className={`hover:bg-gray-50 ${air[it.id] ? "" : "opacity-50"}`}>
                        <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={!!air[it.id]} onChange={e => setAir(p => ({ ...p, [it.id]: e.target.checked }))} /></td>
                        <td className="px-3 py-1.5 font-semibold text-gray-800">{it.soNoDoc}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.itemName || it.itemCode}</td>
                        <td className="px-3 py-1.5">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                        <td className="px-3 py-1.5">{fmt(it.consumption)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.country || "-"}</td>
                        <td className="px-3 py-1.5">{it.incoterm || "-"}</td>
                        <td className="px-3 py-1.5">{fmt(it.weight)}</td>
                        <td className="px-3 py-1.5 font-semibold" style={{ color: MAROON }}>{fmt(it.airFreightCost)}</td>
                        <td className="px-3 py-1.5">{fmt(it.seaFreightCost)}</td>
                        <td className="px-3 py-1.5">{it.leadTimeAir || "-"}</td>
                        <td className="px-3 py-1.5">{it.leadTimeSea || "-"}</td>
                        <td className="px-3 py-1.5">{fmtDate(it.inHouseAirDate)}</td>
                        <td className="px-3 py-1.5">{fmtDate(it.inHouseSeaDate)}</td>
                        <td className="px-3 py-1.5"><input type="date" value={sew[it.id] || ""} onChange={e => setSew(p => ({ ...p, [it.id]: e.target.value }))} className="border border-gray-200 rounded px-2 py-1 text-xs" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <label className="text-xs font-semibold text-gray-600">Reason for Air <span className="text-red-500">*</span></label>
                <input value={reason[rq.id] || ""} onChange={e => setReason(p => ({ ...p, [rq.id]: e.target.value }))} placeholder="Why air is required (for the AIR lines)"
                  className="flex-1 min-w-[240px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                <button onClick={() => submit(rq)} disabled={busy === rq.id} className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
                  {busy === rq.id ? "..." : "Submit decision →"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">Ticked lines = request AIR approval · unticked = NO AIR. If no line is ticked the whole doc is marked NO AIR.</p>
            </div>
          ))}
    </>
  )
}
