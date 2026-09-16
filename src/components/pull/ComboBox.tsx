"use client"
import { useState } from "react"

// Searchable dropdown that also allows a free-typed value (for Sample Brand / Supplier / Item).
// The typed value IS the value; the list filters by it; clicking an option fills it.
export default function ComboBox({ value, onChange, options, placeholder }:
  { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const q = value.trim().toLowerCase()
  const list = (q ? options.filter(o => o.toLowerCase().includes(q)) : options).slice(0, 200)
  return (
    <div className="relative">
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        placeholder={placeholder} autoComplete="off"
        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200" />
      {open && list.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {list.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-sm truncate hover:bg-gray-50 ${value === o ? "bg-red-50 text-red-700 font-semibold" : "text-gray-700"}`} title={o}>{o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
