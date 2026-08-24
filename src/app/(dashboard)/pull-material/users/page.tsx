"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { MAROON } from "../_StageWork"

export default function PullUsersPage() {
  const { data: session, status: auth } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [onlyYes, setOnlyYes] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const d = await fetch("/api/pull-material/users").then(r => r.json()); setUsers(d.users || []) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin]) // eslint-disable-line

  const toggle = async (u: any) => {
    setBusy(u.id)
    try {
      const r = await fetch("/api/pull-material/users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, pullRm: !u.pullRm }),
      })
      if (r.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, pullRm: !x.pullRm } : x))
    } finally { setBusy(null) }
  }

  if (auth === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Admin only</p></div>

  const qq = q.trim().toLowerCase()
  const shown = users.filter(u => {
    if (onlyYes && !u.pullRm) return false
    if (!qq) return true
    return `${u.name || ""} ${u.email} ${u.role} ${(u.roles || []).join(" ")}`.toLowerCase().includes(qq)
  })
  const yesCount = users.filter(u => u.pullRm).length

  return (
    <div className="p-5 max-w-[1100px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>User Management — Pull Material</h1>
        <p className="text-sm text-gray-500">Flag who takes part in the Pull Material flow (Pull RM = YES). They&apos;ll get stage alerts by their role.</p></div>

      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search name / email / role…"
          className="flex-1 min-w-[240px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={onlyYes} onChange={e => setOnlyYes(e.target.checked)} /> Pull RM = YES only
        </label>
        <span className="text-xs text-gray-400">{yesCount} tagged · {shown.length}/{users.length}</span>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                {["Name", "Email", "Role(s)", "BU", "Pull RM"].map(h =>
                  <th key={h} className={`px-4 py-2.5 font-medium whitespace-nowrap ${h === "Pull RM" ? "text-center" : "text-left"}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{u.name || "-"}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{u.email}</td>
                  <td className="px-4 py-2.5 text-gray-600">{[...new Set([u.role, ...(u.roles || [])])].join(", ")}</td>
                  <td className="px-4 py-2.5 text-gray-500">{u.bu}</td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="checkbox" checked={!!u.pullRm} disabled={busy === u.id} onChange={() => toggle(u)}
                      className="w-4 h-4 rounded border-gray-300 accent-green-600 cursor-pointer disabled:opacity-50" />
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No users</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
