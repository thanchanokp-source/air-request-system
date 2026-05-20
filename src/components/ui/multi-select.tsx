"use client"
import { useState, useRef, useEffect } from "react"

interface Props {
  label: string
  options: string[]
  value: string[]
  onChange: (val: string[]) => void
}

export function MultiSelect({ label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch("") }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  const toggle = (opt: string) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  const display = value.length === 0 ? label : value.length === 1 ? value[0] : `${value.length} selected`

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-300 ${value.length > 0 ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white"}`}>
        <span className={`truncate ${value.length > 0 ? "text-blue-700 font-medium" : "text-gray-500"}`}>{display}</span>
        <span className="text-gray-400 text-xs ml-1 shrink-0">▼</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-xl shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          {value.length > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-50">
              <button type="button" onClick={() => onChange([])} className="text-xs text-red-500 hover:text-red-700">
                Clear all ({value.length})
              </button>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">No results</p>}
            {filtered.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 rounded border-gray-300" />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
