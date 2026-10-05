"use client"
import { useState, useRef, useEffect } from "react"

// Claim Dept filter as ONE tree: department → delay reason → delay detail (looks like MultiSelect).
// Selected keys (value): "D␁dept" · "R␁dept␁reason" · "X␁dept␁reason␁detail" — build/match with claimKey().
// Ticking a parent covers everything under it (children show as implied).
export const SEP = "\u0001"
export const claimKey = (...parts: string[]) => parts.join(SEP)

export type ClaimTree = { dept: string; label: string; reasons: { reason: string; details: string[] }[] }[]

interface Props { label: string; tree: ClaimTree; value: string[]; onChange: (v: string[]) => void }

export function ClaimTreeSelect({ label, tree, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [exp, setExp] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch("") } }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [])

  const has = (k: string) => value.includes(k)
  const toggle = (k: string) => onChange(has(k) ? value.filter(v => v !== k) : [...value, k])
  const flip = (k: string) => setExp(p => { const s = new Set(p); s.has(k) ? s.delete(k) : s.add(k); return s })
  const q = search.trim().toLowerCase()
  const hit = (s: string) => !q || s.toLowerCase().includes(q)

  const labelOf = (k: string) => {
    const [t, d, r, x] = k.split(SEP)
    const dl = tree.find(n => n.dept === d)?.label || d
    return t === "D" ? dl : t === "R" ? `${dl} › ${r}` : `${dl} › ${r} › ${x}`
  }
  const display = value.length === 0 ? label : value.length === 1 ? labelOf(value[0]) : `${value.length} selected`

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full border rounded-lg px-2 py-1.5 text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-300 ${value.length > 0 ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white"}`}>
        <span className={`truncate ${value.length > 0 ? "text-blue-700 font-medium" : "text-gray-500"}`}>{display}</span>
        <span className="text-gray-400 text-[10px] ml-1 shrink-0">▼</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-max min-w-[260px] max-w-[440px] bg-white border border-gray-200 rounded-xl shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input type="text" placeholder="Search dept / reason / detail…" value={search} onChange={e => setSearch(e.target.value)} autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          {value.length > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-50">
              <button type="button" onClick={() => onChange([])} className="text-xs text-red-500 hover:text-red-700">Clear all ({value.length})</button>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto py-1">
            {tree.map(n => {
              const dk = claimKey("D", n.dept)
              const reasons = n.reasons.filter(r => hit(n.label) || hit(r.reason) || r.details.some(hit))
              if (!reasons.length && !hit(n.label)) return null
              const open1 = exp.has(dk) || !!q
              return (
                <div key={dk}>
                  <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50">
                    <button type="button" onClick={() => flip(dk)} className="w-4 text-[10px] text-gray-400" disabled={!n.reasons.length}>{n.reasons.length ? (open1 ? "▾" : "▸") : ""}</button>
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input type="checkbox" checked={has(dk)} onChange={() => toggle(dk)} className="w-3.5 h-3.5 rounded border-gray-300" />
                      <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{n.label}</span>
                      <span className="text-[10px] text-gray-400">{n.reasons.length}</span>
                    </label>
                  </div>
                  {open1 && reasons.map(r => {
                    const rk = claimKey("R", n.dept, r.reason)
                    const implied = has(dk)
                    const open2 = exp.has(rk) || (!!q && r.details.some(hit))
                    return (
                      <div key={rk}>
                        <div className="flex items-center gap-1 pl-6 pr-2 py-1 hover:bg-gray-50">
                          <button type="button" onClick={() => flip(rk)} className="w-4 text-[10px] text-gray-400" disabled={!r.details.length}>{r.details.length ? (open2 ? "▾" : "▸") : ""}</button>
                          <label className={`flex items-center gap-2 cursor-pointer flex-1 ${implied ? "opacity-60" : ""}`}>
                            <input type="checkbox" checked={implied || has(rk)} disabled={implied} onChange={() => toggle(rk)} className="w-3.5 h-3.5 rounded border-gray-300" />
                            <span className="text-sm text-gray-700 whitespace-nowrap">{r.reason}</span>
                          </label>
                        </div>
                        {open2 && r.details.filter(d => !q || hit(d) || hit(r.reason) || hit(n.label)).map(d => {
                          const xk = claimKey("X", n.dept, r.reason, d)
                          const imp2 = implied || has(rk)
                          return (
                            <label key={xk} className={`flex items-center gap-2 pl-14 pr-2 py-1 hover:bg-gray-50 cursor-pointer ${imp2 ? "opacity-60" : ""}`}>
                              <input type="checkbox" checked={imp2 || has(xk)} disabled={imp2} onChange={() => toggle(xk)} className="w-3.5 h-3.5 rounded border-gray-300" />
                              <span className="text-xs text-gray-600 whitespace-nowrap">{d}</span>
                            </label>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
