"use client"
import { useEffect, useRef, useState } from "react"

// One calendar for a whole date range (replaces a pair of "from"/"to" date inputs).
// First click sets the start, second click sets the end; clicking again starts over. Values are plain
// "YYYY-MM-DD" strings so callers keep comparing them as text, exactly like the native inputs did.
const MAROON = "#7a1f2b"
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const TH_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const parse = (s: string) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return y && m && d ? new Date(y, m - 1, d) : null }
const show = (s: string) => { const d = parse(s); return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "" }

export default function DateRangePicker({ from, to, onChange, label = "ช่วงวันที่", placeholder = "ทุกวันที่" }: {
  from: string; to: string
  onChange: (from: string, to: string) => void
  label?: string; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState<string>("")
  const [view, setView] = useState(() => parse(from) || new Date())
  const box = useRef<HTMLDivElement>(null)

  // Close when clicking anywhere else on the page.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])
  useEffect(() => { if (open) setView(parse(from) || new Date()) }, [open]) // eslint-disable-line

  const pick = (day: string) => {
    // no start yet, or a complete range already → start a new one
    if (!from || (from && to)) { onChange(day, ""); return }
    if (day < from) { onChange(day, from); return }   // clicked earlier than the start → swap
    onChange(from, day)
    setOpen(false)
  }

  const y = view.getFullYear(), m = view.getMonth()
  const first = new Date(y, m, 1), lead = first.getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(y, m, i + 1)))]
  const end = to || (from && hover > from ? hover : "")   // preview the range while hovering
  const inRange = (d: string) => !!from && !!end && d > from && d < end
  const today = iso(new Date())

  const shift = (n: number) => setView(new Date(y, m + n, 1))
  const preset = (fromD: Date, toD: Date) => { onChange(iso(fromD), iso(toD)); setOpen(false) }
  const now = new Date()

  return (
    <div className="relative" ref={box}>
      <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`min-w-[210px] flex items-center gap-2 border rounded-lg px-3 py-1.5 text-sm bg-white hover:bg-gray-50 ${from || to ? "border-gray-400 text-gray-800" : "border-gray-300 text-gray-400"}`}>
        <span>📅</span>
        <span className="flex-1 text-left truncate">
          {from ? `${show(from)}${to ? ` – ${show(to)}` : " – …"}` : placeholder}
        </span>
        {(from || to) && (
          <span onClick={e => { e.stopPropagation(); onChange("", "") }} title="ล้างช่วงวันที่"
            className="text-gray-400 hover:text-red-600 px-1">✕</span>
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} className="px-2 py-1 rounded hover:bg-gray-100 text-gray-500">‹</button>
            <span className="text-sm font-bold text-gray-700">{TH_MONTHS[m]} {y}</span>
            <button type="button" onClick={() => shift(1)} className="px-2 py-1 rounded hover:bg-gray-100 text-gray-500">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {TH_DOW.map(d => <div key={d} className="text-[10px] text-gray-400 text-center py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => setHover("")}>
            {cells.map((d, i) => {
              if (!d) return <div key={`x${i}`} />
              const isStart = d === from, isEnd = d === to
              const mid = inRange(d)
              return (
                <button key={d} type="button" onClick={() => pick(d)} onMouseEnter={() => setHover(d)}
                  className={`h-8 text-xs rounded-md transition ${
                    isStart || isEnd ? "text-white font-bold" : mid ? "bg-red-50 text-red-800" : "hover:bg-gray-100 text-gray-700"
                  } ${d === today && !isStart && !isEnd ? "ring-1 ring-gray-300" : ""}`}
                  style={isStart || isEnd ? { background: MAROON } : undefined}>
                  {Number(d.slice(8))}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => preset(now, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7))}
              className="px-2 py-1 rounded-md text-[11px] border border-gray-200 text-gray-600 hover:bg-gray-50">7 วันข้างหน้า</button>
            <button type="button" onClick={() => preset(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0))}
              className="px-2 py-1 rounded-md text-[11px] border border-gray-200 text-gray-600 hover:bg-gray-50">เดือนนี้</button>
            <button type="button" onClick={() => preset(new Date(now.getFullYear(), now.getMonth() + 1, 1), new Date(now.getFullYear(), now.getMonth() + 2, 0))}
              className="px-2 py-1 rounded-md text-[11px] border border-gray-200 text-gray-600 hover:bg-gray-50">เดือนหน้า</button>
            <button type="button" onClick={() => { onChange("", ""); setOpen(false) }}
              className="ml-auto px-2 py-1 rounded-md text-[11px] text-gray-500 underline">ล้าง</button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">{from && !to ? "เลือกวันสิ้นสุดอีกครั้ง" : "คลิกวันเริ่ม แล้วคลิกวันสิ้นสุด"}</p>
        </div>
      )}
    </div>
  )
}
