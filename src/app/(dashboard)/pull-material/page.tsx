"use client"

import { useEffect, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────
// PULL MATERIAL — mockup (clickable prototype)
// A new document type alongside NYG/GW/TRM/EA. Flow:
//   1) Request (SCM/dept)   → pick BU + SO, pulled from Bill of Material (09:00 job)
//   2) Logistics            → Est Air/Sea freight + Lead time Air/Sea
//   3) Purchasing           → material weight
//   4) Approve              → requester's chain (~2 positions, master added later)
//   5) Alert                → notify LG (book air) + Purchasing (PC from BOM)
//   6) LG Actual            → key INV + Actual Air → done
// This mockup keeps everything in local state (no DB writes yet) so the flow/
// screens can be validated first. Persistence + approver master come next.
// ─────────────────────────────────────────────────────────────────────────

type Bom = {
  bu: string; soNoDoc: string; customerName: string | null; customerPo: string | null
  vendorName: string | null; poNoDoc: string | null; style: string | null; updatedAt?: string
}
type Item = Bom & {
  key: string
  estAir: string; estSea: string; ltAir: string; ltSea: string   // Logistics
  weight: string                                                 // Purchasing
  invNo: string; actualAir: string                               // LG actual
}

const STAGES = [
  { key: "request",    label: "1 · Request",     who: "SCM / แผนกอื่น" },
  { key: "logistics",  label: "2 · Logistics",   who: "Logistics" },
  { key: "purchasing", label: "3 · Purchasing",  who: "จัดซื้อ" },
  { key: "approve",    label: "4 · Approve",     who: "Requester + สายอนุมัติ" },
  { key: "alert",      label: "5 · Alert",       who: "ระบบ → LG / Purchasing" },
  { key: "actual",     label: "6 · LG Actual",   who: "Logistics" },
]

const MAROON = "#6b1a1a"

export default function PullMaterialMockup() {
  const [stage, setStage] = useState(0)
  const [bus, setBus] = useState<string[]>(["NYG"])
  const [bu, setBu] = useState("NYG")
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Bom[]>([])
  const [searching, setSearching] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [requester, setRequester] = useState("")

  useEffect(() => {
    fetch("/api/bom", { method: "POST" }).then(r => r.json()).then(d => {
      if (Array.isArray(d.bus) && d.bus.length) { setBus(d.bus); setBu(d.bus[0]) }
    }).catch(() => {})
  }, [])

  const search = async () => {
    setSearching(true)
    try {
      const r = await fetch(`/api/bom?bu=${encodeURIComponent(bu)}&q=${encodeURIComponent(q)}&limit=50`)
      const d = await r.json()
      setResults(Array.isArray(d.rows) ? d.rows : [])
    } finally { setSearching(false) }
  }

  const addItem = (b: Bom) => {
    const key = `${b.soNoDoc}|${b.style || ""}|${b.customerPo || ""}`
    if (items.some(i => i.key === key)) return
    setItems(prev => [...prev, { ...b, key, estAir: "", estSea: "", ltAir: "", ltSea: "", weight: "", invNo: "", actualAir: "" }])
  }
  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key))
  const patch = (key: string, field: keyof Item, v: string) =>
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: v } : i))

  const canNext =
    stage === 0 ? items.length > 0 && requester.trim().length > 0 :
    stage === 3 ? true : true

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-5">
      {/* Header + mockup banner */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: MAROON }}>Pull Material</h1>
          <p className="text-sm text-gray-500">ขอเบิกวัตถุดิบข้ามประเทศ — ตั้งต้นจาก Bill of Material</p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
          ⚙ MOCKUP — ยังไม่บันทึกลงระบบ (ไว้ดู flow/หน้าจอก่อน)
        </span>
      </div>

      {/* Stepper */}
      <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
        {STAGES.map((s, i) => {
          const active = i === stage, done = i < stage
          return (
            <button key={s.key} onClick={() => setStage(i)}
              className={`flex-1 min-w-[150px] text-left rounded-xl border px-3 py-2 transition-colors ${
                active ? "border-transparent text-white" : done ? "bg-green-50 border-green-200 text-green-800" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
              style={active ? { background: MAROON } : undefined}>
              <div className="text-xs font-semibold">{s.label}{done && " ✓"}</div>
              <div className={`text-[10px] ${active ? "text-white/80" : "text-gray-400"}`}>{s.who}</div>
            </button>
          )
        })}
      </div>

      {/* ── STAGE 1 · REQUEST ─────────────────────────────────────────── */}
      {stage === 0 && (
        <div className="space-y-4">
          <Card title="เลือกข้อมูลจาก Bill of Material" desc="เลือก BU แล้วค้นหา SO / ลูกค้า / PO — ระบบดึงจาก BOM (อัปเดตทุก 09:00)">
            <div className="flex items-center gap-2 flex-wrap">
              <select value={bu} onChange={e => setBu(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                {bus.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && search()}
                placeholder="พิมพ์ SO / ชื่อลูกค้า / Customer PO / PO แล้ว Enter"
                className="flex-1 min-w-[280px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
              <button onClick={search} disabled={searching}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
                {searching ? "กำลังค้นหา…" : "ค้นหา"}
              </button>
            </div>

            {results.length > 0 && (
              <div className="mt-3 border border-gray-200 rounded-xl overflow-auto max-h-[300px]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>{["", "SO", "ลูกค้า", "CUSTOMER PO", "STYLE", "VENDOR", "PO"].map(h =>
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((b, i) => {
                      const key = `${b.soNoDoc}|${b.style || ""}|${b.customerPo || ""}`
                      const added = items.some(x => x.key === key)
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5">
                            <button onClick={() => addItem(b)} disabled={added}
                              className={`text-xs px-2 py-0.5 rounded-md font-medium ${added ? "bg-green-100 text-green-700" : "bg-red-50 text-red-700 hover:bg-red-100"}`}>
                              {added ? "✓ เพิ่มแล้ว" : "+ เพิ่ม"}
                            </button>
                          </td>
                          <td className="px-3 py-1.5 font-semibold text-gray-800">{b.soNoDoc}</td>
                          <td className="px-3 py-1.5">{b.customerName || "-"}</td>
                          <td className="px-3 py-1.5">{b.customerPo || "-"}</td>
                          <td className="px-3 py-1.5">{b.style || "-"}</td>
                          <td className="px-3 py-1.5">{b.vendorName || "-"}</td>
                          <td className="px-3 py-1.5">{b.poNoDoc || "-"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`รายการที่เลือก (${items.length})`} desc="รายการที่จะขอ Pull Material">
            <div className="mb-3">
              <label className="text-xs font-semibold text-gray-600">ผู้ขอ (Requester) *</label>
              <input value={requester} onChange={e => setRequester(e.target.value)} placeholder="ชื่อผู้ขอ / แผนก"
                className="w-full max-w-sm mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <SelectedTable items={items} cols={["SO", "ลูกค้า", "CUSTOMER PO", "STYLE", "VENDOR", "PO"]}
              render={i => [i.soNoDoc, i.customerName || "-", i.customerPo || "-", i.style || "-", i.vendorName || "-", i.poNoDoc || "-"]}
              onRemove={removeItem} />
          </Card>
        </div>
      )}

      {/* ── STAGE 2 · LOGISTICS ───────────────────────────────────────── */}
      {stage === 1 && (
        <Card title="Logistics — ประเมินค่าขนส่ง + Lead time" desc="กรอก Est Air / Est Sea freight และ Lead time ทั้ง Air และ Sea (ต่อ SO)">
          <EditTable items={items}
            fixed={i => [i.soNoDoc, i.customerName || "-", i.style || "-"]}
            fixedCols={["SO", "ลูกค้า", "STYLE"]}
            fields={[
              { h: "EST AIR (THB)", f: "estAir" }, { h: "EST SEA (THB)", f: "estSea" },
              { h: "LEAD TIME AIR", f: "ltAir" }, { h: "LEAD TIME SEA", f: "ltSea" },
            ]}
            patch={patch} />
        </Card>
      )}

      {/* ── STAGE 3 · PURCHASING ──────────────────────────────────────── */}
      {stage === 2 && (
        <Card title="จัดซื้อ — น้ำหนัก material" desc="กรอกน้ำหนักวัตถุดิบ (ต่อ SO)">
          <EditTable items={items}
            fixed={i => [i.soNoDoc, i.customerName || "-", i.style || "-", i.vendorName || "-"]}
            fixedCols={["SO", "ลูกค้า", "STYLE", "VENDOR"]}
            fields={[{ h: "น้ำหนัก (KG)", f: "weight" }]}
            patch={patch} />
        </Card>
      )}

      {/* ── STAGE 4 · APPROVE ─────────────────────────────────────────── */}
      {stage === 3 && (
        <div className="space-y-4">
          <Card title="เอกสารครบ — ส่งให้ผู้ขออนุมัติ" desc={`ผู้ขอ: ${requester || "-"} · ${items.length} รายการ`}>
            <SelectedTable items={items} cols={["SO", "ลูกค้า", "STYLE", "EST AIR", "EST SEA", "LT AIR", "LT SEA", "น้ำหนัก"]}
              render={i => [i.soNoDoc, i.customerName || "-", i.style || "-", i.estAir || "-", i.estSea || "-", i.ltAir || "-", i.ltSea || "-", i.weight || "-"]} />
          </Card>
          <Card title="สายอนุมัติ (Approval chain)" desc="ตามสายงานของผู้ขอ — ~2 ตำแหน่ง (master คนอนุมัติจะใส่ทีหลัง)">
            <div className="flex items-center gap-2 flex-wrap">
              {["ตำแหน่งที่ 1 (placeholder)", "ตำแหน่งที่ 2 (placeholder)"].map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600">{p}</span>
                  {i === 0 && <span className="text-gray-300">→</span>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-amber-700 mt-2">⚙ mockup: ปุ่ม Approve ด้านล่างจะข้ามทั้ง chain ให้เลย</p>
          </Card>
        </div>
      )}

      {/* ── STAGE 5 · ALERT ───────────────────────────────────────────── */}
      {stage === 4 && (
        <Card title="อนุมัติแล้ว — แจ้งเตือน" desc="ระบบส่งแจ้งเตือนไปยังผู้เกี่ยวข้อง">
          <div className="grid sm:grid-cols-2 gap-3">
            <AlertCard icon="✈" title="แจ้ง Logistics (LG)" body="เพื่อไปจองแอร์ (book air) ตามรายการที่อนุมัติ" tone="blue" />
            <AlertCard icon="🛒" title="แจ้ง Purchasing (PC)" body="แจ้งผู้ดูแลจัดซื้อ (PC จาก BOM — คอลัมน์ PC จะเพิ่มภายหลัง)" tone="green" />
          </div>
        </Card>
      )}

      {/* ── STAGE 6 · LG ACTUAL ───────────────────────────────────────── */}
      {stage === 5 && (
        <Card title="Logistics — คีย์ INV + Actual Air (ปิด flow)" desc="กรอก Invoice No และค่า Actual Air จริง">
          <EditTable items={items}
            fixed={i => [i.soNoDoc, i.customerName || "-", i.style || "-", i.estAir || "-"]}
            fixedCols={["SO", "ลูกค้า", "STYLE", "EST AIR"]}
            fields={[{ h: "INV NO.", f: "invNo" }, { h: "ACTUAL AIR (THB)", f: "actualAir" }]}
            patch={patch} />
        </Card>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button onClick={() => setStage(s => Math.max(0, s - 1))} disabled={stage === 0}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium disabled:opacity-40">
          ← ย้อนกลับ
        </button>
        {stage < STAGES.length - 1 ? (
          <button onClick={() => canNext && setStage(s => s + 1)} disabled={!canNext}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: MAROON }}>
            {stage === 0 ? "ส่งคำขอ Pull Material →" : stage === 3 ? "อนุมัติ (ข้าม chain) →" : "ถัดไป →"}
          </button>
        ) : (
          <button onClick={() => alert("Mockup: จบ flow แล้ว ✓ (ยังไม่บันทึกจริง)")}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold bg-green-600 hover:bg-green-700">
            ✓ เสร็จสิ้น (Complete)
          </button>
        )}
      </div>
    </div>
  )
}

// ── small presentational helpers ────────────────────────────────────────
function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-800">{title}</h2>
      {desc && <p className="text-xs text-gray-500 mt-0.5 mb-3">{desc}</p>}
      {children}
    </div>
  )
}

function SelectedTable({ items, cols, render, onRemove }: {
  items: Item[]; cols: string[]; render: (i: Item) => (string | number)[]; onRemove?: (key: string) => void
}) {
  if (items.length === 0) return <p className="text-sm text-gray-400">ยังไม่มีรายการ</p>
  return (
    <div className="border border-gray-200 rounded-xl overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>{cols.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
            {onRemove && <th className="px-3 py-2 w-8"></th>}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map(i => (
            <tr key={i.key} className="hover:bg-gray-50">
              {render(i).map((v, k) => <td key={k} className={`px-3 py-1.5 ${k === 0 ? "font-semibold text-gray-800" : "text-gray-600"}`}>{v}</td>)}
              {onRemove && <td className="px-3 py-1.5 text-center">
                <button onClick={() => onRemove(i.key)} className="text-gray-300 hover:text-red-500">✕</button>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EditTable({ items, fixed, fixedCols, fields, patch }: {
  items: Item[]; fixed: (i: Item) => (string | number)[]; fixedCols: string[]
  fields: { h: string; f: keyof Item }[]; patch: (key: string, field: keyof Item, v: string) => void
}) {
  if (items.length === 0) return <p className="text-sm text-gray-400">ยังไม่มีรายการ (กลับไป stage 1 เพื่อเลือก SO)</p>
  return (
    <div className="border border-gray-200 rounded-xl overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            {fixedCols.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
            {fields.map(f => <th key={f.h} className="px-3 py-2 text-left font-medium text-red-700 whitespace-nowrap">{f.h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map(i => (
            <tr key={i.key} className="hover:bg-gray-50">
              {fixed(i).map((v, k) => <td key={k} className={`px-3 py-1.5 ${k === 0 ? "font-semibold text-gray-800" : "text-gray-600"}`}>{v}</td>)}
              {fields.map(f => (
                <td key={f.h} className="px-3 py-1.5">
                  <input value={String(i[f.f] ?? "")} onChange={e => patch(i.key, f.f, e.target.value)}
                    className="w-28 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AlertCard({ icon, title, body, tone }: { icon: string; title: string; body: string; tone: "blue" | "green" }) {
  const c = tone === "blue" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-green-50 border-green-200 text-green-800"
  return (
    <div className={`rounded-xl border p-4 ${c}`}>
      <div className="text-2xl">{icon}</div>
      <div className="font-semibold mt-1">{title}</div>
      <div className="text-xs mt-0.5 opacity-80">{body}</div>
    </div>
  )
}
