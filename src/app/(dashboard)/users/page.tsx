"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const ROLES = ["ADMIN","MER_USER","VP_MER","SCM_USER","VP_SCM","PRESIDENT","LOGISTICS",
  "DVM_COMMERCIAL","DVM_PROCUREMENT","DVM_NYK","DVM_PRODUCTION",
  "VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION",
  "CLAIM_COMMERCIAL","CLAIM_PROCUREMENT","CLAIM_NYK","CLAIM_PRODUCTION"]
const CLAIM_ROLES = ["DVM_COMMERCIAL","DVM_PROCUREMENT","DVM_NYK","DVM_PRODUCTION","VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION","CLAIM_COMMERCIAL","CLAIM_PROCUREMENT","CLAIM_NYK","CLAIM_PRODUCTION"]
const empty = { name: "", email: "", password: "", role: "MER_USER", isActive: true, priority: "" }

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const role = (session?.user as any)?.role

  useEffect(() => {
    if (session && role !== "ADMIN") router.replace("/dashboard")
  }, [session, role, router])

  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [activeOnly, setActiveOnly] = useState(false)
  const [roleFilter, setRoleFilter] = useState("")
  const [deptFilter, setDeptFilter] = useState("")
  const [peopleQ, setPeopleQ] = useState("")
  const [peopleResults, setPeopleResults] = useState<any[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [peopleError, setPeopleError] = useState("")

  const load = () => fetch("/api/users").then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openEdit = (u: any) => {
    setEditId(u.id)
    setForm({ name: u.name || "", email: u.email, password: "", role: u.role, isActive: u.isActive, priority: u.priority != null ? String(u.priority) : "" })
    setError("")
  }
  const reset = () => { setEditId(null); setForm(empty); setError("") }

  const save = async () => {
    setSaving(true); setError("")
    try {
      const url = editId ? `/api/users/${editId}` : "/api/users"
      const method = editId ? "PATCH" : "POST"
      const payload = { ...form, priority: form.priority !== "" ? parseInt(form.priority) : null }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (res.ok) { await load(); reset() } else {
        const text = await res.text()
        try { const e = JSON.parse(text); setError(e.error || "Error") } catch { setError(text || "Save failed") }
      }
    } catch (e: any) {
      setError(e.message || "Network error")
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"?`)) return
    await fetch(`/api/users/${id}`, { method: "DELETE" })
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const toggleActive = async (u: any) => {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: u.name, email: u.email, role: u.role, isActive: !u.isActive })
    })
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x))
  }

  const searchPeople = async () => {
    if (!peopleQ.trim()) return
    setPeopleLoading(true); setPeopleError(""); setPeopleResults([])
    const res = await fetch(`/api/people?q=${encodeURIComponent(peopleQ)}`)
    if (res.ok) {
      const data = await res.json()
      setPeopleResults(Array.isArray(data) ? data : [])
    } else {
      const e = await res.json()
      setPeopleError(e.error || "Error")
    }
    setPeopleLoading(false)
  }

  const pickPerson = (p: any) => {
    setForm(prev => ({ ...prev, name: p.name || prev.name, email: p.email || prev.email }))
    setPeopleResults([]); setPeopleQ("")
  }

  const roleColor: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-700", MER_USER: "bg-gray-100 text-gray-600",
    VP_MER: "bg-yellow-100 text-yellow-700", SCM_USER: "bg-orange-100 text-orange-700",
    VP_SCM: "bg-amber-100 text-amber-700", PRESIDENT: "bg-purple-100 text-purple-700",
    LOGISTICS: "bg-blue-100 text-blue-700", VP_NYK: "bg-teal-100 text-teal-700",
    CLAIM_COMMERCIAL: "bg-indigo-100 text-indigo-700", CLAIM_PROCUREMENT: "bg-indigo-100 text-indigo-700",
    CLAIM_NYK: "bg-indigo-100 text-indigo-700", CLAIM_PRODUCTION: "bg-indigo-100 text-indigo-700",
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">USER MANAGEMENT</h1>

      {/* People Directory Search */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 border-b pb-2">ค้นหาพนักงานจาก People Directory</h2>
        <div className="flex gap-2">
          <input value={peopleQ} onChange={e => setPeopleQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchPeople()}
            placeholder="ค้นหาชื่อหรืออีเมล..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={searchPeople} disabled={peopleLoading || !peopleQ.trim()}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {peopleLoading ? "..." : "Search"}
          </button>
        </div>
        {peopleError && <p className="text-sm text-red-500">{peopleError}</p>}
        {peopleResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">NAME</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">EMAIL</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">DEPT / BU</th>
                  <th className="px-4 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {peopleResults.map((p, i) => (
                  <tr key={i} className="hover:bg-blue-50">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2 text-gray-500">{p.email || <span className="text-gray-300 italic">no email</span>}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{[p.dept, p.bu].filter(Boolean).join(" · ")}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => pickPerson(p)}
                        className="text-xs text-blue-600 hover:underline font-medium">
                        Select →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 border-b pb-2">{editId ? "Edit User" : "New User"}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">NAME</label>
            <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Full name" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">EMAIL *</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="email@example.com" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">{editId ? "PASSWORD (leave blank = no change)" : "PASSWORD *"}</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="••••••••" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">ROLE *</label>
            <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {CLAIM_ROLES.includes(form.role) && (
            <div>
              <label className="text-xs text-gray-500 font-medium">APPROVAL PRIORITY <span className="font-normal text-gray-400">(1 = first, leave blank = any order)</span></label>
              <input type="number" min="1" value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))}
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 1, 2, 3..." />
            </div>
          )}
          {editId && (
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({...p, isActive: e.target.checked}))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !form.email || (!editId && !form.password)}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : editId ? "Save Changes" : "Create User"}
          </button>
          {editId && <button onClick={reset} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
          <h2 className="font-semibold text-gray-800 mr-2">USERS ({users.filter(u =>
            (!activeOnly || u.isActive) &&
            (!roleFilter || u.role === roleFilter) &&
            (!deptFilter || u.role.endsWith(`_${deptFilter}`))
          ).length})</h2>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setDeptFilter("") }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-400">
            <option value="">All Roles</option>
            {["ADMIN","MER_USER","VP_MER","SCM_USER","VP_SCM","PRESIDENT","LOGISTICS"].map(r =>
              <option key={r} value={r}>{r}</option>)}
            <optgroup label="── DVM">
              {["DVM_COMMERCIAL","DVM_PROCUREMENT","DVM_NYK","DVM_PRODUCTION"].map(r =>
                <option key={r} value={r}>{r}</option>)}
            </optgroup>
            <optgroup label="── VP Claim">
              {["VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION"].map(r =>
                <option key={r} value={r}>{r}</option>)}
            </optgroup>
            <optgroup label="── Claim (Legacy)">
              {["CLAIM_COMMERCIAL","CLAIM_PROCUREMENT","CLAIM_NYK","CLAIM_PRODUCTION"].map(r =>
                <option key={r} value={r}>{r}</option>)}
            </optgroup>
          </select>
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setRoleFilter("") }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-400">
            <option value="">All Departments</option>
            {["COMMERCIAL","PROCUREMENT","NYK","PRODUCTION"].map(d =>
              <option key={d} value={d}>{d}</option>)}
          </select>
          {(roleFilter || deptFilter) && (
            <button onClick={() => { setRoleFilter(""); setDeptFilter("") }}
              className="text-xs text-gray-400 hover:text-gray-600">✕ Clear</button>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 ml-auto">
            <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="w-4 h-4 rounded" />
            Active only
          </label>
        </div>
        {loading ? <div className="py-10 text-center text-gray-400">Loading...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["NAME","EMAIL","ROLE","PRIORITY","STATUS",""].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.filter(u =>
                (!activeOnly || u.isActive) &&
                (!roleFilter || u.role === roleFilter) &&
                (!deptFilter || u.role.endsWith(`_${deptFilter}`))
              ).map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.isActive ? "opacity-40" : ""}`}>
                  <td className="px-4 py-3 font-medium">{u.name || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${roleColor[u.role] || "bg-gray-100 text-gray-600"}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    {CLAIM_ROLES.includes(u.role) && u.priority != null
                      ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{u.priority}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${u.isActive ? "bg-green-500" : "bg-gray-300"}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${u.isActive ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => del(u.id, u.name || u.email)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
