"use client"
import { useState } from "react"

// Roles selectable per BU for admin "View as". Value = role code, label = display.
const ROLES_BY_BU: Record<string, { role: string; label: string }[]> = {
  NYG: [
    { role: "MER_USER", label: "Merchandise (upload)" },
    { role: "DVM_MER", label: "DVM Merchandise" },
    { role: "VP_MER", label: "VP Merchandise" },
    { role: "SCM_USER", label: "SCM User" },
    { role: "VP_SCM", label: "VP SCM" },
    { role: "CLAIM_PRODUCTION", label: "Claim – Production" },
    { role: "VP_PRODUCTION", label: "VP Claim – Production" },
    { role: "CLAIM_PROCUREMENT", label: "Claim – Procurement" },
    { role: "VP_PROCUREMENT", label: "VP Claim – Procurement" },
    { role: "SCM_NYK_APPROVER", label: "Claim SCM NYK Approver" },
    { role: "SCM_NYK_EVP", label: "Claim SCM NYK EVP" },
    { role: "SCM_NYK", label: "Claim SCM NYK (CR)" },
    { role: "LOGISTICS", label: "Logistics" },
    { role: "PRESIDENT", label: "President" },
    { role: "ACCOUNTING", label: "Accounting" },
  ],
  GW: [
    { role: "MER_GW", label: "Merchandise (GW)" },
    { role: "DPM_GW", label: "DPM (GW)" },
    { role: "GM_GW", label: "GM (GW)" },
    { role: "CLAIM_GW", label: "Claim – GW" },
    { role: "SCM_NYK_APPROVER", label: "Claim SCM NYK Approver" },
    { role: "SCM_NYG", label: "Claim SCM NYG" },
    { role: "LOGISTICS_GW", label: "Logistics (GW)" },
    { role: "PRESIDENT_GW", label: "President (GW)" },
    { role: "ACCOUNTING", label: "Accounting" },
  ],
  EA: [
    { role: "MER_EA", label: "Merchandise (EA)" },
    { role: "DVM_MER_EA", label: "ADVM (EA)" },
    { role: "VP_MER_EA", label: "DVM (EA)" },
    // From SCM onward EA shares the NYG people
    { role: "SCM_USER", label: "SCM User (shared)" },
    { role: "VP_SCM", label: "VP SCM (shared)" },
    { role: "CLAIM_PROCUREMENT", label: "Claim – Procurement (shared)" },
    { role: "LOGISTICS", label: "Logistics (shared)" },
    { role: "PRESIDENT", label: "President (shared)" },
    { role: "ACCOUNTING", label: "Accounting (shared)" },
  ],
}

export default function ImpersonateBar({ isAdmin, isImpersonating, actingLabel }: {
  isAdmin: boolean; isImpersonating: boolean; actingLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [bu, setBu] = useState("NYG")
  const [role, setRole] = useState("")
  if (!isAdmin && !isImpersonating) return null

  const go = () => { if (role) window.location.href = `/api/admin/impersonate?role=${encodeURIComponent(role)}&bu=${encodeURIComponent(bu)}` }
  const roles = ROLES_BY_BU[bu] || []

  return (
    <div className={`w-full ${isImpersonating ? "bg-amber-500" : "bg-slate-800"} text-white text-sm`}>
      <div className="max-w-full px-4 py-1.5 flex flex-wrap items-center gap-2">
        {isImpersonating ? (
          <>
            <span className="font-semibold">🔍 กำลังดูในนาม: {actingLabel || "—"}</span>
            <span className="opacity-70">·</span>
            <button onClick={() => setOpen(o => !o)} className="underline hover:opacity-80">สลับ role</button>
            <a href="/api/admin/impersonate/return" className="ml-auto bg-white text-amber-700 font-semibold px-3 py-1 rounded-md hover:bg-amber-50">↩ กลับเป็น Admin</a>
          </>
        ) : (
          <>
            <span className="font-semibold">👁 Admin — View as (ดูหน้าแต่ละ role)</span>
            <button onClick={() => setOpen(o => !o)} className="ml-auto underline hover:opacity-80">{open ? "ซ่อน" : "เลือก role"}</button>
          </>
        )}
      </div>
      {open && (
        <div className={`px-4 pb-2 flex flex-wrap items-center gap-2 ${isImpersonating ? "bg-amber-500" : "bg-slate-800"}`}>
          <select value={bu} onChange={e => { setBu(e.target.value); setRole("") }}
            className="text-gray-800 rounded-md px-2 py-1 text-xs">
            <option value="NYG">BU: NYG</option>
            <option value="GW">BU: GW</option>
            <option value="EA">BU: EA</option>
          </select>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="text-gray-800 rounded-md px-2 py-1 text-xs min-w-[220px]">
            <option value="">-- เลือก role --</option>
            {roles.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
          </select>
          <button onClick={go} disabled={!role}
            className="bg-white text-slate-800 font-semibold px-3 py-1 rounded-md text-xs hover:bg-gray-100 disabled:opacity-40">
            View as →
          </button>
          <span className="text-[11px] opacity-80">เข้าเป็น role นั้นทันที (ไม่ต้อง login) · ดูหน้า Approvals ที่ต้อง action</span>
        </div>
      )}
    </div>
  )
}
