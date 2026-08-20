"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

const MAROON = "#6b1a1a"
const BUS = ["NYG", "EA", "TRM", "GW"]

type Bom = {
  soNoDoc: string; customerName?: string; customerPo?: string; vendorName?: string
  poNoDoc?: string; style?: string; brand?: string; gmtType?: string
  shipmentDate?: string; orderQty?: number
  itemCode?: string; itemName?: string; bomQty?: number; bomUom?: string; consumption?: number
}
type CartItem = Bom & { key: string; pullGarment: number; pullMaterialQty: number }

const fmt = (n: any) => (n == null || isNaN(Number(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString("th-TH") }

export default function ScmRequestPage() {
  const { data: session, status } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"

  const [bu, setBu] = useState("NYG")
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Bom[]>([])
  const [searching, setSearching] = useState(false)

  const [openSo, setOpenSo] = useState<Bom | null>(null)
  const [materials, setMaterials] = useState<Bom[]>([])
  const [loadingMat, setLoadingMat] = useState(false)
  const [pullGarment, setPullGarment] = useState("")
  const [ticked, setTicked] = useState<Set<string>>(new Set())

  const [cart, setCart] = useState<CartItem[]>([])
  const [requester, setRequester] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const n = (session?.user as any)?.name || (session?.user as any)?.email || ""
    if (n && !requester) setRequester(n)
  }, [session]) // eslint-disable-line

  const search = async () => {
    setSearching(true); setOpenSo(null); setMaterials([])
    try {
      const r = await fetch(`/api/bom?bu=${bu}&q=${encodeURIComponent(q)}&limit=100`).then(r => r.json())
      setResults(Array.isArray(r.rows) ? r.rows : [])
    } finally { setSearching(false) }
  }

  const pickSo = async (b: Bom) => {
    setOpenSo(b); setMaterials([]); setPullGarment(""); setTicked(new Set()); setLoadingMat(true)
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
    if (!g || g <= 0) return alert("ใส่จำนวน garment ที่จะ pull ก่อน")
    const picked = materials.filter(m => m.itemCode && ticked.has(m.itemCode))
    if (picked.length === 0) return alert("ติ๊กเลือก material อย่างน้อย 1 รายการ")
    const add = picked.map(m => ({
      ...m, key: `${m.soNoDoc}|${m.itemCode}`,
      pullGarment: g, pullMaterialQty: calcQty(m, g),
    }))
    setCart(prev => [...prev.filter(c => !add.some(a => a.key === c.key)), ...add])
    setOpenSo(null); setMaterials([]); setPullGarment(""); setTicked(new Set())
  }
  const removeCart = (key: string) => setCart(p => p.filter(c => c.key !== key))

  const submit = async () => {
    if (!requester.trim()) return alert("ใส่ชื่อผู้ขอก่อน")
    if (cart.length === 0) return alert("ยังไม่มีรายการในคำขอ")
    if (!confirm(`ส่งคำขอ Pull Material ${cart.length} รายการ?`)) return
    setSubmitting(true)
    try {
      const r = await fetch("/api/pull-material", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bu, requesterName: requester, requesterEmail: (session?.user as any)?.email, items: cart }),
      })
      const d = await r.json()
      if (r.ok) { alert(`ส่งคำขอสำเร็จ: ${d.request?.documentNo}`); setCart([]) }
      else alert(`ผิดพลาด: ${d.error || "ส่งไม่สำเร็จ"}`)
    } finally { setSubmitting(false) }
  }

  if (status === "loading") return <div className="p-10 text-center text-gray-400 text-sm">กำลังโหลด…</div>
  if (!isAdmin) return (
    <div className="p-10 max-w-lg mx-auto text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="text-lg font-bold mt-3" style={{ color: MAROON }}>Pull Material — อยู่ระหว่างทดสอบ</h1>
      <p className="text-sm text-gray-500 mt-2">เปิดให้ทุกคนเมื่อทดสอบเสร็จ</p>
    </div>
  )

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>SCM Request — Pull Material</h1>
        <p className="text-sm text-gray-500">เลือก SO จาก Bill of Material → ติ๊ก material → ใส่จำนวน garment ที่จะ pull (คำนวณวัตถุดิบให้อัตโนมัติ)</p>
      </div>

      {/* BU tabs */}
      <div className="flex gap-1.5">
        {BUS.map(b => (
          <button key={b} onClick={() => { setBu(b); setResults([]); setOpenSo(null) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            style={bu === b ? { background: MAROON } : undefined}>{b}</button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
            placeholder="พิมพ์ SO / ชื่อลูกค้า / Customer PO / Brand แล้ว Enter"
            className="flex-1 min-w-[280px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          <button onClick={search} disabled={searching}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
            {searching ? "กำลังค้นหา…" : "ค้นหา"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-3 border rounded-xl overflow-auto max-h-[320px]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0"><tr>
                {["", "SO", "ลูกค้า", "CUST PO", "STYLE", "BRAND", "GMT", "ORDER QTY", "SHIP DATE"].map(h =>
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((b, i) => (
                  <tr key={i} className={`hover:bg-red-50/40 ${openSo?.soNoDoc === b.soNoDoc ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-1.5">
                      <button onClick={() => pickSo(b)} className="text-xs px-2 py-0.5 rounded-md font-medium bg-red-50 text-red-700 hover:bg-red-100">เลือก</button>
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-gray-800">{b.soNoDoc}</td>
                    <td className="px-3 py-1.5">{b.customerName || "-"}</td>
                    <td className="px-3 py-1.5">{b.customerPo || "-"}</td>
                    <td className="px-3 py-1.5">{b.style || "-"}</td>
                    <td className="px-3 py-1.5">{b.brand || "-"}</td>
                    <td className="px-3 py-1.5">{b.gmtType || "-"}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(b.orderQty)}</td>
                    <td className="px-3 py-1.5">{fmtDate(b.shipmentDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Material lines of the picked SO */}
      {openSo && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800">Material ของ SO {openSo.soNoDoc}
            <span className="text-xs text-gray-400 font-normal"> · {openSo.customerName} · order {fmt(openSo.orderQty)} ตัว</span>
          </h2>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <label className="text-sm font-semibold text-gray-600">Pull กี่ garment: *</label>
            <input value={pullGarment} onChange={e => setPullGarment(e.target.value)} type="number" placeholder="เช่น 30"
              className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-xs text-gray-400">จาก order {fmt(openSo.orderQty)} ตัว → วัตถุดิบคำนวณให้อัตโนมัติ</span>
          </div>

          {loadingMat ? <p className="text-sm text-gray-400 mt-3">กำลังโหลด material…</p> : (
            <div className="mt-3 border rounded-xl overflow-auto max-h-[300px]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0"><tr>
                  {["ติ๊ก", "ITEM", "วัตถุดิบ", "ORDER QTY (ตัว)", "รวม BOM", "หน่วย", "PULL (คำนวณ)"].map(h =>
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {materials.map((m, i) => {
                    const g = Number(pullGarment) || 0
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <input type="checkbox" checked={!!m.itemCode && ticked.has(m.itemCode)} onChange={() => m.itemCode && toggle(m.itemCode)} />
                        </td>
                        <td className="px-3 py-1.5 font-mono text-gray-600">{m.itemCode || "-"}</td>
                        <td className="px-3 py-1.5">{m.itemName || "-"}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(m.orderQty)}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(m.bomQty)}</td>
                        <td className="px-3 py-1.5">{m.bomUom || "-"}</td>
                        <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>
                          {g > 0 ? `${fmt(calcQty(m, g))} ${m.bomUom || ""}` : "-"}
                        </td>
                      </tr>
                    )
                  })}
                  {materials.length === 0 && <tr><td colSpan={7} className="px-3 py-3 text-center text-gray-400">ไม่พบ material</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button onClick={addToCart} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>
              + เพิ่มเข้าคำขอ
            </button>
          </div>
        </div>
      )}

      {/* Cart */}
      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold text-gray-800">รายการที่จะขอ Pull ({cart.length})</h2>
        <div className="my-3">
          <label className="text-xs font-semibold text-gray-600">ผู้ขอ (Requester) *</label>
          <input value={requester} onChange={e => setRequester(e.target.value)} placeholder="ชื่อผู้ขอ / แผนก"
            className="w-full max-w-sm mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        {cart.length === 0 ? <p className="text-sm text-gray-400">ยังไม่มีรายการ — ค้นหา SO แล้วเลือก material</p> : (
          <div className="border rounded-xl overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50"><tr>
                {["SO", "วัตถุดิบ", "PULL garment", "PULL วัตถุดิบ", "หน่วย", ""].map(h =>
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {cart.map(c => (
                  <tr key={c.key} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-semibold text-gray-800">{c.soNoDoc}</td>
                    <td className="px-3 py-1.5">{c.itemName || c.itemCode}</td>
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
        <div className="mt-3 flex justify-end">
          <button onClick={submit} disabled={submitting || cart.length === 0}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: MAROON }}>
            {submitting ? "กำลังส่ง…" : "ส่งคำขอ Pull Material →"}
          </button>
        </div>
      </div>
    </div>
  )
}
