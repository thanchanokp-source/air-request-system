"use client"
import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

// Roles that must be set by Admin (master)
const MASTER_ROLES_NYG = [
  // Flow: MER → DVM MER → VP MER (finder) → President → SCM User → VP SCM (finder) → Claim → Logistics → Accounting
  { role: "DVM_MER",              label: "DVM MER",               hint: "Approves after MER upload + handles Commercial claim (P1)", needsPriority: false, bu: "NYG" },
  { role: "VP_MER",               label: "VP MER",                hint: "Approves after DVM MER + handles Commercial claim (P2)", needsPriority: false, bu: "NYG" },
  { role: "PRESIDENT",            label: "President",             hint: "Approves all requests after VP MER",         needsPriority: false, bu: "NYG" },
  { role: "SCM_USER",             label: "SCM User",              hint: "Assign Claim Dept + select VP SCM",         needsPriority: false, bu: "NYG" },
  { role: "VP_SCM",               label: "VP SCM",                hint: "Approves after SCM User (set up in master)", needsPriority: false, bu: "NYG" },
  { role: "CLAIM_PRODUCTION",     label: "Claim – Production",    hint: "Priority 1 = handles first (auto-cascade to P2…)", needsPriority: true,  bu: "NYG" },
  { role: "VP_PRODUCTION",        label: "VP Claim – Production", hint: "Approves after Claim Production (Priority 1 first)", needsPriority: true, bu: "NYG" },
  { role: "CLAIM_PROCUREMENT",    label: "Claim – Procurement",   hint: "Priority 1 = handles first (auto-cascade to P2…)", needsPriority: true,  bu: "NYG" },
  { role: "VP_PROCUREMENT",       label: "VP Claim – Procurement",hint: "Approves after Claim Procurement (Priority 1 first)", needsPriority: true, bu: "NYG" },
  // SCM NYK uses the 3-role flow (Approver → EVP + CR) — same as GW, but BU = NYG.
  { role: "SCM_NYK_APPROVER",     label: "Claim-SCM NYK Action Approver", hint: "Approves NYK claim first → alerts EVP + CR user", needsPriority: true, bu: "NYG" },
  { role: "SCM_NYK",              label: "Claim-SCM NYK User",    hint: "Enter CR NO",                             needsPriority: true, bu: "NYG" },
  { role: "SCM_NYK_EVP",          label: "Claim-SCM NYK EVP",     hint: "Approves after the Action Approver",      needsPriority: true, bu: "NYG" },
  { role: "LOGISTICS",            label: "Logistics",             hint: "Manage HAWB + Generate PDF",               needsPriority: false, bu: "NYG" },
  { role: "ACCOUNTING",           label: "Accounting",            hint: "Receives final file + closes document",              needsPriority: false, bu: "NYG" },
]

const MASTER_ROLES_GW = [
  // Flow: MER GW → DPM → GM → President → Logistics → Claim → SCM NYK (CR NO) → Accounting
  { role: "DPM_GW",              label: "DPM (GW)",                 hint: "Approves 1st after MER",         needsPriority: false, bu: "GW" },
  { role: "GM_GW",               label: "GM (GW)",                  hint: "Approves 2nd",                  needsPriority: false, bu: "GW" },
  { role: "PRESIDENT_GW",        label: "President (GW)",            hint: "Approves 3rd",                  needsPriority: false, bu: "GW" },
  { role: "LOGISTICS_GW",        label: "Logistics (GW)",            hint: "Booking + manage Logistics",          needsPriority: false, bu: "GW" },
  { role: "CLAIM_GW",            label: "Claim-GW",                  hint: "Priority 1 = handles first",         needsPriority: true,  bu: "GW" },
  { role: "SCM_NYK_APPROVER",    label: "Claim-SCM NYK Action Approver", hint: "Approves NYK claim first → alerts EVP + CR user", needsPriority: true, bu: "GW" },
  { role: "SCM_NYK",             label: "Claim-SCM NYK User",        hint: "Enter CR NO then send to Accounting",       needsPriority: true, bu: "GW" },
  { role: "SCM_NYK_EVP",        label: "Claim-SCM NYK EVP",         hint: "Approves after SCM NYK User",         needsPriority: true, bu: "GW" },
  { role: "SCM_NYG",             label: "Claim-SCM NYG",             hint: "1st in NYG chain",           needsPriority: true, bu: "GW" },
  { role: "SCM_NYG_VP",          label: "Claim-SCM NYG VP",          hint: "2nd in NYG chain",           needsPriority: true, bu: "GW" },
  { role: "SCM_NYG_VP_PROD_G1G3",label: "Claim-SCM NYG VP Prod G1/G3", hint: "Factory G1 / G3",                 needsPriority: true, bu: "GW" },
  { role: "SCM_NYG_VP_PROD_G2G4",label: "Claim-SCM NYG VP Prod G2/G4", hint: "Factory G2 / G4",                 needsPriority: true, bu: "GW" },
  { role: "SCM_NYG_EVP",         label: "Claim-SCM NYG EVP",         hint: "Last in NYG chain",            needsPriority: true, bu: "GW" },
  { role: "ACCOUNTING_GW",       label: "Account (GW)",              hint: "Receives final file + closes document",         needsPriority: false, bu: "GW" },
]

const ALL_MASTER_ROLES = [...MASTER_ROLES_NYG, ...MASTER_ROLES_GW]

// Legacy alias used elsewhere
const MASTER_ROLES = MASTER_ROLES_NYG

// Roles via People Finder (no master needed)
const FINDER_ROLES_NYG = [
  { role: "CLAIM_*_P2+",  label: "Claim Priority ≥ 2 (All Depts)", who: "Set in master; forwarded by Claim P1 in request" },
]

const FINDER_ROLES_GW = [
  { role: "MER_GW", label: "MER (GW)", who: "Self-registers (Priority 1, no setup needed)" },
]

const ALL_ROLES = [
  ...MASTER_ROLES_NYG.map(r => r.role),
  ...MASTER_ROLES_GW.map(r => r.role),
  "MER_USER", "MER_GW", "ADMIN",
]

// Which BU each APPROVER role belongs to (SCM_NYK_* appear in BOTH master lists → both sets).
// Used ONLY to surface a cross-BU approver in the other BU's tab. MER (MER_USER / MER_GW)
// is a requester role governed purely by the `bu` field — excluded here so a GW MER never
// leaks into the NYG tab (and vice-versa).
const NYG_ROLE_SET = new Set<string>(MASTER_ROLES_NYG.map(r => r.role))
const GW_ROLE_SET = new Set<string>(MASTER_ROLES_GW.map(r => r.role))

// Role order by approval flow (NYG then GW)
const FLOW_ORDER: string[] = [
  // NYG flow
  "MER_USER", "DVM_MER", "VP_MER", "PRESIDENT", "SCM_USER", "VP_SCM",
  "CLAIM_COMMERCIAL", "VP_COMMERCIAL", "CLAIM_PRODUCTION", "VP_PRODUCTION",
  "CLAIM_NYG", "CLAIM_NYK", "CLAIM_PROCUREMENT", "VP_PROCUREMENT",
  "LOGISTICS", "ACCOUNTING",
  // GW flow
  "MER_GW", "DPM_GW", "GM_GW", "PRESIDENT_GW", "LOGISTICS_GW",
  "CLAIM_GW", "SCM_NYK_APPROVER", "SCM_NYK", "SCM_NYK_EVP",
  "SCM_NYG", "SCM_NYG_VP", "SCM_NYG_VP_PROD_G1G3", "SCM_NYG_VP_PROD_G2G4", "SCM_NYG_EVP",
  "ACCOUNTING_GW",
  // Other
  "ADMIN",
]

type ActionType = "Approver" | "User" | "Read"
const ROLE_ACTION: Record<string, ActionType> = {
  // Approvers — click to approve
  DVM_MER: "Approver", VP_MER: "Approver", PRESIDENT: "Approver", VP_SCM: "Approver",
  DPM_GW: "Approver", GM_GW: "Approver", PRESIDENT_GW: "Approver",
  CLAIM_COMMERCIAL: "Approver", CLAIM_PRODUCTION: "Approver",
  CLAIM_NYG: "Approver", CLAIM_NYK: "Approver", CLAIM_PROCUREMENT: "Approver",
  VP_COMMERCIAL: "Approver", VP_PRODUCTION: "Approver", VP_PROCUREMENT: "Approver", VP_NYK: "Approver",
  CLAIM_GW: "Approver",
  SCM_NYK_APPROVER: "Approver", SCM_NYK: "User", SCM_NYK_EVP: "Approver", SCM_NYG: "Approver", SCM_NYG_VP: "Approver",
  SCM_NYG_VP_PROD_G1G3: "Approver", SCM_NYG_VP_PROD_G2G4: "Approver", SCM_NYG_EVP: "Approver",
  // Users — enter data / upload
  MER_USER: "User", MER_GW: "User", SCM_USER: "User",
  LOGISTICS: "User", LOGISTICS_GW: "User",
  // Read — receive files / view only
  ACCOUNTING: "Read", ACCOUNTING_GW: "Read",
  ADMIN: "Read",
}
const ACTION_STYLE: Record<ActionType, string> = {
  Approver: "bg-green-100 text-green-800 border border-green-200",
  User:     "bg-blue-100 text-blue-800 border border-blue-200",
  Read:     "bg-gray-100 text-gray-600 border border-gray-200",
}

const ROLE_LABEL: Record<string, string> = {
  // NYG
  DVM_MER: "DVM MER", VP_MER: "VP MER", PRESIDENT: "President", LOGISTICS: "Logistics", ACCOUNTING: "Accounting",
  SCM_USER: "SCM User", VP_SCM: "VP SCM",
  CLAIM_COMMERCIAL:  "Claim-Commercial",
  CLAIM_PRODUCTION:  "Claim-Production",
  CLAIM_NYG:         "Claim-SCM NYG",
  CLAIM_NYK:         "Claim-SCM NYK",
  CLAIM_PROCUREMENT: "Claim-Procurement",
  VP_COMMERCIAL:     "VP Claim-Commercial",
  VP_PRODUCTION:     "VP Claim-Production",
  VP_PROCUREMENT:    "VP Claim-Procurement",
  VP_NYK:            "VP Claim-NYK",
  MER_USER: "MER User",
  // GW
  MER_GW: "MER (GW)", DPM_GW: "DPM (GW)", GM_GW: "GM (GW)",
  PRESIDENT_GW: "President (GW)", LOGISTICS_GW: "Logistics (GW)", ACCOUNTING_GW: "Account (GW)",
  CLAIM_GW: "Claim-GW",
  // GW SCM NYK chain
  SCM_NYK_APPROVER:     "Claim-SCM NYK Action Approver",
  SCM_NYK:              "Claim-SCM NYK User",
  SCM_NYK_EVP:          "Claim-SCM NYK EVP",
  // GW SCM NYG chain
  SCM_NYG:              "Claim-SCM NYG",
  SCM_NYG_VP:           "Claim-SCM NYG VP",
  SCM_NYG_VP_PROD_G1G3: "Claim-SCM NYG VP Prod G1/G3",
  SCM_NYG_VP_PROD_G2G4: "Claim-SCM NYG VP Prod G2/G4",
  SCM_NYG_EVP:          "Claim-SCM NYG EVP",
  // Common
  ADMIN: "Admin",
}

// SINGLE SOURCE OF TRUTH for role display names across the whole app.
// Base name = ROLE_LABEL; claim roles append position/dept/procurement from the
// person's own fields (priority / claimDepartment / procurementType).
// Change a name here → All Users, Setup Guide, and badges all update together.
function roleDisplayName(
  r: string,
  opts?: { priority?: number | null; claimDepartment?: string | null; procurementType?: string | null }
): string {
  const p = opts?.priority ?? null
  const claimDept = opts?.claimDepartment ?? null
  const procurementType = opts?.procurementType ?? null
  if (r === "CLAIM_GW") {
    const MAP: Record<string, string> = { GW: "Claim-GW", SUPPLIER: "Claim-SUPPLIER", NYG: "Claim-SCM NYG", NYK: "Claim-SCM NYK" }
    return claimDept ? (MAP[claimDept] ?? `Claim-${claimDept}`) : "Claim-GW"
  }
  if (r === "CLAIM_PRODUCTION") {
    const level = p === 1 ? "VP" : p === 2 ? "EVP" : p ? `P${p}` : ""
    const g = claimDept === "G1G3" ? "G1/G3" : claimDept === "G2G4" ? "G2/G4" : String(claimDept || "").toUpperCase() === "ALL" ? "ทุก G" : (claimDept || "")
    return `Claim-Production ${level} ${g}`.trim()
  }
  if (r === "CLAIM_COMMERCIAL") return p === 2 ? "Claim-Commercial VP" : "Claim-Commercial DPM/DVM"
  if (r === "CLAIM_NYG") return p === 1 ? "Claim-SCM NYG DPM/DVM" : p === 2 ? "Claim-SCM NYG VP" : "Claim-SCM NYG"
  if (r === "CLAIM_NYK") return p === 1 ? "Claim-SCM NYK User" : p === 2 ? "Claim-SCM NYK EVP" : "Claim-SCM NYK"
  if (r === "CLAIM_PROCUREMENT") {
    if (p === 2) return "Claim-Procurement VP"
    const sub = procurementType === "SOURCING" ? " (Sourcing)" : procurementType === "PURCHASING" ? " (Purchasing)" : ""
    return `Claim-Procurement DPM/DVM${sub}`
  }
  if (r === "DVM_MER") return "DVM MER"
  return ROLE_LABEL[r] || r
}

const CLAIM_ROLES = ALL_MASTER_ROLES.filter(r => r.needsPriority).map(r => r.role)
const CLAIM_GW_DEPTS = ["NYK", "GW", "SUPPLIER", "NYG"]

// NYG Claim has multiple sequential levels (priority-based)
const CLAIM_GW_NYG_POSITIONS = [
  { label: "SCM",    priority: 1 },
  { label: "VP SCM", priority: 2 },
  { label: "VP PROD",priority: 3 },
  { label: "EVP",    priority: 4 },
]

const emptyForm = { name: "", email: "", role: "PRESIDENT", bu: "NYG", priority: "", claimDepartment: "", nygPosition: "", procurementType: "", sendEmail: false }

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const myRole = (session?.user as any)?.role
  useEffect(() => { if (session && myRole !== "ADMIN") router.replace("/dashboard") }, [session, myRole, router])

  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...emptyForm })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"setup"|"all">("setup")
  const [buFilter, setBuFilter] = useState<"NYG"|"GW"|"">("")
  const [roleFilter, setRoleFilter] = useState("")
  const [peopleQ, setPeopleQ] = useState("")
  const [peopleResults, setPeopleResults] = useState<any[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle"|"saving"|"done"|"error">("idle")
  const [saveMsg, setSaveMsg] = useState("")
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragIdx = useRef<number | null>(null)

  const [pending, setPending] = useState<any[]>([])
  const [pendingBusy, setPendingBusy] = useState<string | null>(null)
  const loadPending = async () => {
    try { const r = await fetch("/api/people/pending-approvers"); if (r.ok) setPending(await r.json()) } catch {}
  }
  const handlePending = async (pid: string, action: "approve" | "reject") => {
    let reason: string | null = null
    if (action === "reject") {
      reason = window.prompt("Reason for rejecting (optional — the requester will be notified):") || ""
    }
    setPendingBusy(pid)
    try {
      const r = await fetch("/api/people/pending-approvers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pid, action, reason }) })
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || "Failed") }
      await loadPending(); if (action === "approve") load()
    } finally { setPendingBusy(null) }
  }

  const load = async () => {
    const r = await fetch("/api/users")
    if (r.ok) setUsers(await r.json())
    setLoading(false)
  }
  useEffect(() => { load(); loadPending() }, [])

  const reset = () => { setEditId(null); setForm({ ...emptyForm }); setError("") }

  const openEdit = (u: any) => {
    setEditId(u.id)
    const nygPos = u.role === "CLAIM_GW" && u.claimDepartment === "NYG"
      ? CLAIM_GW_NYG_POSITIONS.find(p => p.priority === u.priority)?.label || ""
      : ""
    setForm({ name: u.name || "", email: u.email, role: u.role, bu: u.bu || "NYG",
      priority: u.priority != null ? String(u.priority) : "", claimDepartment: u.claimDepartment || "", nygPosition: nygPos,
      procurementType: u.procurementType || "", sendEmail: false })
    setError("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const save = async () => {
    setSaving(true); setError("")
    setSaveStatus("saving"); setSaveMsg("")
    const url = editId ? `/api/users/${editId}` : "/api/users"
    const method = editId ? "PATCH" : "POST"
    const payload = {
      ...form,
      priority: form.priority !== "" ? parseInt(form.priority) : null,
      claimDepartment: form.claimDepartment || null,
      procurementType: form.procurementType || null,
    }
    const wasEdit = !!editId
    const label = form.name || form.email
    try {
      // Guard against a hung request (e.g. slow DB) so the overlay can't spin forever.
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000)
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) {
        setSaveStatus("done")
        setSaveMsg(wasEdit ? `Updated successfully` : `User "${label}" created`)
        reset()
        setSaving(false)
        load()  // refresh the list in the background — don't hold the overlay for it
      } else {
        const e = await res.json().catch(() => ({}))
        setSaveStatus("error"); setSaveMsg(e.error || "Save failed"); setError(e.error || "Save failed")
        setSaving(false)
      }
    } catch (err: any) {
      const msg = err?.name === "AbortError"
        ? "Server is slow — timed out after 30s. The change may still have saved; press Cancel and refresh to check."
        : (err?.message || "Save failed")
      setSaveStatus("error"); setSaveMsg(msg); setError(msg)
      setSaving(false)
    }
  }

  const sendReset = async (id: string, email: string) => {
    if (!confirm(`Send password setup link to ${email}?`)) return
    const res = await fetch(`/api/users/${id}/send-reset`, { method: "POST" })
    alert(res.ok ? "Email sent successfully" : "Failed to send")
  }

  const toggleActive = async (u: any) => {
    await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: u.name, email: u.email, role: u.role, bu: u.bu, isActive: !u.isActive, priority: u.priority }) })
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x))
  }

  const del = async (id: string, name: string) => {
    if (!confirm(`ลบผู้ใช้ "${name}" ?\n(ถ้าเคยอนุมัติ/สร้างเอกสารมาก่อน อาจลบไม่ได้ — ให้ปิด Status แทน)`)) return
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id))
      return
    }
    // FK constraint / other error → the account is referenced by existing documents.
    let msg = "ลบไม่ได้"
    try { const d = await res.json(); if (d?.error) msg = d.error } catch {}
    alert(`ลบไม่สำเร็จ: ${name}\n${msg}\n\nสาเหตุที่พบบ่อย: ผู้ใช้นี้ผูกกับเอกสารเดิมอยู่ → แนะนำให้ "ปิด Status" แทนการลบ`)
  }

  const searchPeople = async () => {
    if (!peopleQ.trim()) return
    setPeopleLoading(true); setPeopleResults([])
    const res = await fetch(`/api/people?q=${encodeURIComponent(peopleQ)}`)
    if (res.ok) setPeopleResults(await res.json())
    setPeopleLoading(false)
  }

  // A person can hold multiple roles → match the primary role OR any in roles[].
  const hasRole = (u: any, r: string) => u.role === r || (Array.isArray(u.roles) && u.roles.includes(r))

  // Checklist logic
  const isRoleSetup = (role: string) => users.some(u => hasRole(u, role) && u.isActive)
  const isClaimP1Setup = (role: string) => users.some(u => hasRole(u, role) && u.priority === 1 && u.isActive)

  const isMasterRole = CLAIM_ROLES.includes(form.role)
  const isGWClaim = form.role === "CLAIM_GW"
  const isProcurementRole = form.role === "CLAIM_PROCUREMENT" || form.role === "DVM_PROCUREMENT"
  // NYG Production claim routes by factory G-group, stored in claimDepartment (G1G3 / G2G4).
  const isProductionClaim = form.role === "CLAIM_PRODUCTION" || form.role === "VP_PRODUCTION"

  const visibleMasterRoles = buFilter === "NYG" ? MASTER_ROLES_NYG : buFilter === "GW" ? MASTER_ROLES_GW : ALL_MASTER_ROLES
  const visibleFinderRoles = buFilter === "GW" ? FINDER_ROLES_GW : buFilter === "NYG" ? FINDER_ROLES_NYG : [...FINDER_ROLES_NYG, ...FINDER_ROLES_GW]

  // A person belongs to a BU tab if: their primary bu matches, bu = ALL, OR they hold
  // ANY role that lives in that BU (role names encode BU). So a cross-BU person
  // (e.g. President of both) shows in BOTH tabs even with a single primary bu.
  const heldRolesOf = (u: any): string[] => [u.role, ...(Array.isArray(u.roles) ? u.roles : [])].filter(Boolean)
  const inBuTab = (u: any, bu: string): boolean => {
    if (u.bu === "ALL") return true
    if ((u.bu || "NYG") === bu) return true
    const set = bu === "GW" ? GW_ROLE_SET : NYG_ROLE_SET
    return heldRolesOf(u).some(r => set.has(r))
  }
  const filtered = users.filter(u =>
    (!roleFilter || heldRolesOf(u).includes(roleFilter)) &&
    (!buFilter || inBuTab(u, buFilter))
  )

  // Sync orderedIds when filter changes — default sort by approval flow then priority
  useEffect(() => {
    const sorted = [...filtered].sort((a, b) => {
      const ai = FLOW_ORDER.indexOf(a.role)
      const bi = FLOW_ORDER.indexOf(b.role)
      const aOrd = ai === -1 ? 999 : ai
      const bOrd = bi === -1 ? 999 : bi
      if (aOrd !== bOrd) return aOrd - bOrd
      return (a.priority ?? 99) - (b.priority ?? 99)
    })
    setOrderedIds(sorted.map(u => u.id))
  }, [users, roleFilter, buFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = orderedIds.length
    ? orderedIds.map(id => filtered.find(u => u.id === id)).filter(Boolean)
    : filtered

  const handleDragStart = (idx: number) => { dragIdx.current = idx }
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
    if (dragIdx.current === null || dragIdx.current === idx) return
    const newOrder = [...orderedIds]
    const [moved] = newOrder.splice(dragIdx.current, 1)
    newOrder.splice(idx, 0, moved)
    dragIdx.current = idx
    setOrderedIds(newOrder)
  }
  const handleDragEnd = () => { dragIdx.current = null; setDragOverIdx(null) }

  // Shared Create/Edit form — rendered inline on the Setup tab AND inside a modal on
  // the All Users tab (so a user can be edited without leaving the list). Kept as a JSX
  // element (not a nested component) so inputs don't remount / lose focus per keystroke.
  const userForm = (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="font-semibold text-gray-800">{editId ? "Edit User" : "Add New User"}</h2>
        {editId && <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">✕ Cancel</button>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Full name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="email@nanyangtextile.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Role *</label>
          <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value, priority: "", claimDepartment: "" }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <optgroup label="── NYG Master">
              {MASTER_ROLES.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
            </optgroup>
            <optgroup label="── GW Master">
              {MASTER_ROLES_GW.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
            </optgroup>
            <optgroup label="── General">
              <option value="MER_USER">MER User (NYG)</option>
              <option value="MER_GW">MER (GW)</option>
              <option value="ADMIN">Admin</option>
            </optgroup>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">BU</label>
          <select value={form.bu} onChange={e => setForm(p => ({ ...p, bu: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="NYG">NYG</option>
            <option value="GW">GW</option>
            <option value="ALL">ALL</option>
          </select>
        </div>

        {isMasterRole && !isGWClaim && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Priority <span className="text-gray-400 font-normal">(1 = handles first)</span>
            </label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select Priority --</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>Priority {n}</option>)}
            </select>
          </div>
        )}

        {isProcurementRole && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Procurement Type *</label>
            <select value={form.procurementType} onChange={e => setForm(p => ({ ...p, procurementType: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select --</option>
              <option value="PURCHASING">Purchasing</option>
              <option value="SOURCING">Sourcing</option>
            </select>
          </div>
        )}

        {isProductionClaim && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Factory G-group *</label>
            <select value={form.claimDepartment}
              onChange={e => setForm(p => ({ ...p, claimDepartment: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select G-group --</option>
              <option value="G1G3">G1 / G3</option>
              <option value="G2G4">G2 / G4</option>
              <option value="ALL">ทุก G (G1/G3 + G2/G4)</option>
            </select>
          </div>
        )}

        {isGWClaim && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Claim Dept (GW)</label>
            <select value={form.claimDepartment}
              onChange={e => setForm(p => ({ ...p, claimDepartment: e.target.value, nygPosition: "", priority: "" }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select --</option>
              {CLAIM_GW_DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {isGWClaim && form.claimDepartment && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Priority <span className="text-gray-400 font-normal">(1 = handles first)</span>
            </label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select Priority --</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>Priority {n}</option>)}
            </select>
          </div>
        )}
      </div>

      {!editId && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
          <div>
            <p className="text-xs font-medium text-gray-700">Send password setup email now</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Off → you can click "Send Link" later</p>
          </div>
          <button type="button" onClick={() => setForm(p => ({ ...p, sendEmail: !p.sendEmail }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.sendEmail ? "bg-blue-600" : "bg-gray-300"}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.sendEmail ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button onClick={save} disabled={saving || !form.email}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {saving ? "Saving..." : editId ? "Save Changes" : "Create User"}
      </button>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Save status popup */}
      {saveStatus !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-4 text-center">
            {saveStatus === "saving" && (
              <>
                <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                <div>
                  <p className="font-semibold text-gray-800">Creating user...</p>
                  <p className="text-xs text-gray-400 mt-1">Please wait a moment</p>
                </div>
              </>
            )}
            {saveStatus === "done" && (
              <>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
                <div>
                  <p className="font-semibold text-gray-800">Done!</p>
                  <p className="text-xs text-gray-500 mt-1">{saveMsg}</p>
                </div>
                <button onClick={() => setSaveStatus("idle")}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  Close
                </button>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">✕</div>
                <div>
                  <p className="font-semibold text-gray-800">Failed</p>
                  <p className="text-xs text-red-500 mt-1">{saveMsg}</p>
                </div>
                <button onClick={() => setSaveStatus("idle")}
                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Pending new-approver requests — Admin must approve before the person is added + alerted */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2.5">
          <p className="text-sm font-bold text-amber-800">⏳ Pending approver requests ({pending.length})</p>
          {pending.map((p: any) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 bg-white border border-amber-200 rounded-lg px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">{p.nextName || p.nextEmail} <span className="text-xs font-normal text-gray-400">{p.nextEmail}</span></p>
                <p className="text-[11px] text-gray-500">
                  Add as <b className="text-gray-700">{p.positionLabel}</b> ({p.role} · {p.bu}) · Doc {p.documentNo}
                  {Array.isArray(p.itemIds) ? ` · ${p.itemIds.length} SO` : ""} · by {p.requestedName || p.requestedBy || "-"}
                </p>
              </div>
              <button onClick={() => handlePending(p.id, "approve")} disabled={pendingBusy === p.id}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-40">
                {pendingBusy === p.id ? "..." : "✓ Approve & notify"}
              </button>
              <button onClick={() => handlePending(p.id, "reject")} disabled={pendingBusy === p.id}
                className="px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-40">
                Reject
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">USER MANAGEMENT</h1>
        <div className="flex items-center gap-3">
          {/* BU Filter */}
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-1">
            {([["NYG","NYG"],["GW","GW"],["","All"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setBuFilter(val as any)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${buFilter === val
                  ? val === "NYG" ? "bg-blue-600 text-white shadow"
                  : val === "GW" ? "bg-emerald-600 text-white shadow"
                  : "bg-white text-gray-900 shadow"
                  : "text-gray-500 hover:text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>
          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["setup","all"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                {t === "setup" ? "Setup Guide" : "All Users"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SETUP TAB */}
      {tab === "setup" && (
        <div className="grid grid-cols-3 gap-5">

          {/* How-to banner (full width) */}
          <div className="col-span-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">วิธีตั้งค่าผู้อนุมัติในระบบ (Master) — ทำ 3 ขั้นตอน</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-blue-800">
              <span><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold mr-1.5">1</span>เลือก <b>ตำแหน่ง (role)</b> จากรายการทางซ้าย</span>
              <span><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold mr-1.5">2</span>กรอก <b>ชื่อ + อีเมล</b> (และ Priority / G-group ถ้ามี)</span>
              <span><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold mr-1.5">3</span>กด <b>Save</b> → คนนี้จะรับหน้าที่ในตำแหน่งนั้นทันที</span>
            </div>
            <p className="text-xs text-blue-600 mt-2">💡 1 คนถือได้หลายตำแหน่ง/ข้าม BU — ใช้อีเมลเดิมเพิ่ม role ได้เลย · ทุกคนต้องตั้งใน master (ไม่ดึงจากที่อื่น)</p>
          </div>

          {/* Left: Checklist */}
          <div className="col-span-1 space-y-4">

            {/* Must-setup checklist */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-3">
                <p className="text-sm font-semibold">ตำแหน่งที่ต้องตั้งค่า (คลิกเพื่อเลือก)</p>
                <div className="flex gap-3 mt-1.5 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded-full bg-green-500 text-white flex items-center justify-center text-[9px] font-bold">✓</span> ตั้งแล้ว</span>
                  <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded-full bg-gray-400 text-white flex items-center justify-center text-[9px] font-bold">!</span> ยังไม่ได้ตั้ง</span>
                </div>
              </div>
              <div className="divide-y">
                {visibleMasterRoles.map(mr => {
                  // CLAIM_GW: expand into dept sub-items — all depts are priority-based
                  if (mr.role === "CLAIM_GW") {
                    return (
                      <div key={mr.role}>
                        <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Claim (GW) — Sequential Approval All Depts
                        </div>
                        {CLAIM_GW_DEPTS.map(dept => {
                          const deptUsers = users
                            .filter(u => hasRole(u, "CLAIM_GW") && u.claimDepartment === dept && u.isActive)
                            .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
                          const maxP = deptUsers.length > 0 ? Math.max(...deptUsers.map(u => u.priority ?? 0)) : 0
                          const hasP1 = deptUsers.some(u => u.priority === 1)
                          return (
                            <div key={dept} className="border-t border-gray-100">
                              {/* Dept header row */}
                              <div
                                onClick={() => { setForm(p => ({ ...p, role: "CLAIM_GW", bu: "GW", claimDepartment: dept, priority: String(maxP + 1), nygPosition: "" })); setEditId(null); setError("") }}
                                className="flex items-center justify-between px-4 py-2 pl-6 cursor-pointer hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold ${hasP1 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>
                                    {hasP1 ? "✓" : "!"}
                                  </span>
                                  <span className="text-sm text-gray-700 font-semibold">{dept}</span>
                                </div>
                                <span className="text-xs text-blue-500 hover:underline">+ Add</span>
                              </div>
                              {/* Priority rows */}
                              {deptUsers.map(u => (
                                <div key={u.id}
                                  onClick={() => { openEdit(u); }}
                                  className="flex items-center gap-2 px-4 py-1.5 pl-10 cursor-pointer hover:bg-blue-50 transition-colors">
                                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{u.priority ?? "?"}</span>
                                  <span className="text-xs text-gray-700">{u.name || u.email}</span>
                                </div>
                              ))}
                              {deptUsers.length === 0 && (
                                <p className="text-xs text-red-400 px-4 pb-2 pl-10">No users yet</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  }

                  // Normal roles
                  // VP-claim roles are the SECOND step of a claim chain (priority 2 by
                  // design) → they never have a Priority-1 person, so "done" = any active
                  // holder. Entry claim roles still require a Priority-1 (first handler).
                  const isVpClaimRole = ["VP_COMMERCIAL", "VP_PRODUCTION", "VP_PROCUREMENT"].includes(mr.role)
                  const done = (mr.needsPriority && !isVpClaimRole) ? isClaimP1Setup(mr.role) : isRoleSetup(mr.role)
                  const count = users.filter(u => hasRole(u, mr.role) && u.isActive).length
                  return (
                    <div key={mr.role}
                      onClick={() => { setForm(p => ({ ...p, role: mr.role, bu: mr.bu, priority: mr.needsPriority ? "1" : "", claimDepartment: "", nygPosition: "" })); setEditId(null); setError("") }}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold ${done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>
                        {done ? "✓" : "!"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{roleDisplayName(mr.role)}</p>
                        <p className="text-xs text-gray-400">{mr.hint}</p>
                        {count > 0 && <p className="text-xs text-green-600 mt-0.5">{count} active</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* People Finder roles info */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600">
                🔍 Via People Finder (no setup needed)
              </div>
              <div className="divide-y">
                {visibleFinderRoles.map(fr => (
                  <div key={fr.role} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs flex-shrink-0 text-blue-500">→</span>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{ROLE_LABEL[fr.role] ? roleDisplayName(fr.role) : fr.label}</p>
                      <p className="text-xs text-gray-400">{fr.who}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MER free */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
              <span className="font-semibold">MER User</span> — self-registers, no setup needed
            </div>
          </div>

          {/* Right: Form */}
          <div className="col-span-2 space-y-4">

            {/* Search existing master users (optional) */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ค้นหาคนที่มีในระบบแล้ว <span className="normal-case text-gray-400 font-normal">(ไม่บังคับ — ใช้เพื่อเพิ่มตำแหน่งให้คนเดิม)</span></p>
              <div className="flex gap-2">
                <input value={peopleQ} onChange={e => setPeopleQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchPeople()}
                  placeholder="พิมพ์ชื่อหรืออีเมล แล้วกด Enter..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={searchPeople} disabled={peopleLoading || !peopleQ.trim()}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {peopleLoading ? "..." : "Search"}
                </button>
              </div>
              {peopleResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["Name","Email","Dept"].map(h => <th key={h} className="px-3 py-2 text-left text-xs text-gray-500 font-medium">{h}</th>)}
                        <th className="px-3 py-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {peopleResults.map((p, i) => (
                        <tr key={i} className="hover:bg-blue-50">
                          <td className="px-3 py-2">{p.name}</td>
                          <td className="px-3 py-2 text-gray-500">{p.email || <span className="text-gray-300 italic">—</span>}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{[p.dept, p.bu].filter(Boolean).join(" · ")}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => { setForm(prev => ({ ...prev, name: p.name || prev.name, email: p.email || prev.email })); setPeopleResults([]) }}
                              className="text-xs text-blue-600 font-medium hover:underline">
                              Use →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Create / Edit Form — shared element (defined as userForm above the return) */}
            {userForm}

            {/* Quick list of master roles */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Configured Master Users</p>
              </div>
              <div className="divide-y">
                {visibleMasterRoles.map(mr => {
                  const group = users.filter(u => hasRole(u, mr.role))
                  if (group.length === 0) return (
                    <div key={mr.role} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-500">{roleDisplayName(mr.role)}</span>
                        <span className="ml-2 text-xs text-red-400">None yet</span>
                      </div>
                      <button onClick={() => setForm(p => ({ ...p, role: mr.role, priority: mr.needsPriority ? "1" : "" }))}
                        className="text-xs text-blue-600 hover:underline">+ Add</button>
                    </div>
                  )
                  return (
                    <div key={mr.role} className="px-4 py-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1 pb-1.5">{roleDisplayName(mr.role)}</p>
                      <div className="space-y-1">
                        {group.map(u => {
                          // What distinguishes people within the SAME role: factory G-group
                          // (Production), procurement type, or claim dept — so you can tell
                          // "who handles which G". Red if a required detail is not set yet.
                          const detail = (() => {
                            if (mr.role === "CLAIM_PRODUCTION") {
                              const d = String(u.claimDepartment || "")
                              if (d.toUpperCase() === "ALL" || (/[13]/.test(d) && /[24]/.test(d))) return { text: "ทุก G", missing: false }
                              if (/G1|G3/i.test(d)) return { text: "G1/G3", missing: false }
                              if (/G2|G4/i.test(d)) return { text: "G2/G4", missing: false }
                              return { text: "⚠ ยังไม่ตั้ง G", missing: true }
                            }
                            if (mr.role === "CLAIM_PROCUREMENT" && u.priority === 1) {
                              if (u.procurementType === "SOURCING") return { text: "Sourcing", missing: false }
                              if (u.procurementType === "PURCHASING") return { text: "Purchasing", missing: false }
                              return { text: "⚠ ยังไม่ตั้งประเภท", missing: true }
                            }
                            if (["CLAIM_GW", "SCM_NYK", "SCM_NYG"].includes(mr.role) && u.claimDepartment) {
                              return { text: u.claimDepartment, missing: false }
                            }
                            return null
                          })()
                          return (
                          <div key={u.id} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${u.isActive ? "bg-gray-50" : "bg-gray-50 opacity-40"}`}>
                            <div className="flex items-center gap-2">
                              {mr.needsPriority && (
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {u.priority ?? "?"}
                                </span>
                              )}
                              <span className="text-sm font-medium">{u.name || u.email}</span>
                              {detail && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${detail.missing ? "bg-red-100 text-red-600 border border-red-200" : "bg-purple-100 text-purple-700 border border-purple-200"}`}>
                                  {detail.text}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">{u.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleActive(u)}
                                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${u.isActive ? "bg-green-500" : "bg-gray-300"}`}>
                                <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${u.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                              </button>
                              <button onClick={() => openEdit(u)} className="text-xs text-blue-600 hover:underline">Edit</button>
                              <button onClick={() => sendReset(u.id, u.email)} className="text-xs text-amber-600 hover:underline">Send Link</button>
                              <button onClick={() => del(u.id, u.name || u.email)} className="text-xs text-red-500 hover:text-red-700 hover:underline">Delete</button>
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALL USERS TAB */}
      {tab === "all" && (<>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-700 text-sm">
              Users{buFilter ? ` (${buFilter})` : " (All)"} — <span className="text-indigo-600">{filtered.length}</span>
            </span>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs">
              <option value="">All Roles</option>
              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
            </select>
            {roleFilter && <button onClick={() => setRoleFilter("")} className="text-xs text-gray-400 hover:text-gray-600">✕ Role</button>}
            {buFilter && <span className={`px-2 py-0.5 rounded text-xs font-semibold ${buFilter === "GW" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{buFilter}</span>}
          </div>
          {loading ? <div className="py-10 text-center text-gray-400 text-sm">Loading...</div> : (
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm table-fixed" style={{fontVariantNumeric:"tabular-nums"}}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800">
                  {[["NO.","w-10"],["Name","w-[12%]"],["Email","w-[20%]"],["BU","w-[7%]"],["Role","w-[17%]"],["Sub Role","w-[8%]"],["Action","w-[8%]"],["Priority","w-[7%]"],["Status","w-[6%]"],["Manage","w-[14%]"]].map(([h,w]) =>
                    <th key={h} className={`bg-slate-800 px-2.5 py-2.5 text-left text-[11px] font-semibold text-slate-300 uppercase tracking-wide ${w}`}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayed.map((u, idx) => {
                  // Full display label for ANY role this person holds (primary or extra).
                  // Uses the shared roleDisplayName() so All Users / Setup Guide / badges match.
                  const labelFor = (r: string): string =>
                    roleDisplayName(r, { priority: u.priority, claimDepartment: u.claimDepartment, procurementType: u.procurementType })
                  const fullRoleLabel: string = labelFor(u.role)
                  const roleBadgeColor = (() => {
                    const r = u.role || ""
                    if (["PRESIDENT","PRESIDENT_GW"].includes(r)) return "bg-blue-100 text-blue-800 border border-blue-200"
                    if (["GM_GW","DPM_GW","VP_MER_GW"].includes(r)) return "bg-indigo-100 text-indigo-800 border border-indigo-200"
                    if (r.startsWith("SCM")) return "bg-violet-100 text-violet-800 border border-violet-200"
                    if (r.startsWith("LOGISTICS")) return "bg-sky-100 text-sky-800 border border-sky-200"
                    if (r.startsWith("ACCOUNTING")) return "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    if (r.startsWith("CLAIM")) return "bg-amber-100 text-amber-800 border border-amber-200"
                    return "bg-gray-100 text-gray-700 border border-gray-200"
                  })()
                  return (
                  <tr key={u.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`transition-colors cursor-grab active:cursor-grabbing border-b border-gray-100 ${!u.isActive ? "opacity-40" : ""} ${dragOverIdx === idx ? "bg-indigo-100 border-l-4 border-l-indigo-500" : idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/60 hover:bg-indigo-50/30"}`}>
                    <td className="px-2.5 py-2 align-top text-gray-400 text-xs font-mono select-none">
                      <span className="text-gray-300 mr-1">⠿</span>{idx + 1}
                    </td>
                    <td className="px-2.5 py-2 align-top font-semibold text-gray-800 break-words">{u.name || <span className="text-gray-300 font-normal">—</span>}</td>
                    <td className="px-2.5 py-2 align-top text-gray-500 text-xs break-all">{u.email}</td>
                    <td className="px-2.5 py-2 align-top">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.bu === "GW" ? "bg-amber-100 text-amber-800 border border-amber-200" : u.bu === "ALL" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-teal-100 text-teal-800 border border-teal-200"}`}>
                        {u.bu || "NYG"}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold leading-tight ${roleBadgeColor}`}>
                          {fullRoleLabel}
                        </span>
                        {/* Extra roles this person also holds (multi-role) */}
                        {Array.isArray(u.roles) && u.roles.filter((r: string) => r && r !== u.role).map((r: string) => (
                          <span key={r} className="inline-block px-2 py-0.5 rounded text-[9px] font-medium leading-tight bg-gray-100 text-gray-600 border border-gray-200">
                            + {labelFor(r)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      {u.procurementType
                        ? <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.procurementType === "PURCHASING" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-violet-100 text-violet-700 border border-violet-200"}`}>{u.procurementType}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      {(() => {
                        const action = ROLE_ACTION[u.role]
                        return action
                          ? <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ACTION_STYLE[action]}`}>{action}</span>
                          : <span className="text-gray-300 text-xs">—</span>
                      })()}
                    </td>
                    <td className="px-2.5 py-2 align-top text-center">
                      {u.priority != null
                        ? <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center">{u.priority}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      <button onClick={() => toggleActive(u)}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${u.isActive ? "bg-green-500" : "bg-gray-300"}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${u.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 items-center text-[11px]">
                        <button onClick={() => openEdit(u)} className="font-medium text-blue-600 hover:text-blue-800">Edit</button>
                        <span className="text-gray-200">|</span>
                        <button onClick={() => sendReset(u.id, u.email)} className="font-medium text-amber-600 hover:text-amber-800">Send Link</button>
                        <span className="text-gray-200">|</span>
                        <button onClick={() => del(u.id, u.name || u.email)} className="font-medium text-red-400 hover:text-red-600">Delete</button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
        {/* Edit-in-place: clicking Edit on this tab opens the form in a modal (no tab switch). */}
        {editId && (
          <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
            onMouseDown={e => { if (e.target === e.currentTarget) reset() }}>
            <div className="w-full max-w-2xl my-auto">
              {userForm}
            </div>
          </div>
        )}
      </>)}
    </div>
  )
}
