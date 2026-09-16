"use client"
import { useState } from "react"

// Searchable single-select for the "จัดซื้อ / requester" filter — type to filter the list.
// Shared across Pull RM pages so every tab gets the same combobox. `options` are {key, display};
// value/onChange carry the selected key ("" = ทั้งหมด).
export default function ReqPicker({ value, display, options, onChange, placeholder = "จัดซื้อทั้งหมด" }:
  { value: string; display: string; options: { key: string; display: string }[]; onChange: (k: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const list = q ? options.filter(o => o.display.toLowerCase().includes(q.toLowerCase())) : options
  const close = () => { setOpen(false); setQ("") }
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white flex items-center gap-2 min-w-[170px] justify-between hover:border-gray-400">
        <span className="truncate">👤 {value ? display : placeholder}</span>
        <span className="text-gray-400 text-xs">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 พิมพ์ค้นหาชื่อ…"
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-red-200" />
            <div className="max-h-64 overflow-auto">
              <button type="button" onClick={() => { onChange(""); close() }}
                className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-50 ${!value ? "font-semibold text-red-700" : "text-gray-600"}`}>👤 {placeholder}</button>
              {list.map(o => (
                <button key={o.key} type="button" onClick={() => { onChange(o.key); close() }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-50 truncate ${value === o.key ? "font-semibold text-red-700 bg-red-50" : "text-gray-700"}`}>{o.display}</button>
              ))}
              {list.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">ไม่พบชื่อ</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
