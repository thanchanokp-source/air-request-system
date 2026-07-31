"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { MASTER_EDITOR_EMAILS } from "@/lib/master-access"

const nav = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/requests", label: "AIR REQUESTS" },
  { href: "/approvals", label: "APPROVALS" },
  { href: "/files", label: "ALL FILES" },
  { href: "/requests/nyk-import", label: "NYK IMPORT (GW)", roles: ["ADMIN", "SCM_NYK_APPROVER", "SCM_NYK", "SCM_NYK_EVP"] },
  { href: "/users", label: "USER MANAGEMENT", adminOnly: true },
  { href: "/master/port", label: "MASTER RATE", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "MER_USER", "MER_GW"], masterEdit: true },
  { href: "/master/description", label: "MASTER DESCRIPTION", roles: ["ADMIN", "LOGISTICS", "MER_USER"], masterEdit: true },
  { href: "/master/delay-code", label: "MASTER DELAY CODE", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "SCM_USER"], masterEdit: true },
  { href: "/settings", label: "SETTINGS", adminOnly: true }
]

const ROLE_LABEL: Record<string, string> = {
  VP_MER_GW: "DPM (GW)", DPM_GW: "DPM (GW)", GM_GW: "GM (GW)", PRESIDENT_GW: "President (GW)",
  LOGISTICS_GW: "Logistics (GW)", CLAIM_GW: "Claim (GW)", SCM_NYK: "SCM NYK", SCM_NYG: "SCM NYG",
  ACCOUNTING: "Accounting", MER_USER: "Merchandise", MER_GW: "Merchandise (GW)",
  MER_EA: "Merchandise (EA)", DVM_MER_EA: "ADVM (EA)", VP_MER_EA: "DVM (EA)",
  MER_TRM: "Merchandise (TRM)", DVM_MER_TRM: "DVM (TRM)", VP_MER_TRM: "VP (TRM)",
  LOGISTICS_TRM: "Logistics (TRM)",
}

export default function Sidebar({ role, onClose }: { role: string; onClose?: () => void }) {
  const path = usePathname()
  const { data: session } = useSession()
  const email = String((session?.user as any)?.email || "").toLowerCase()
  const isMasterEditor = MASTER_EDITOR_EMAILS.includes(email)
  const isAdmin = role === "ADMIN"
  const visible = nav.filter(item => {
    // Master pages: show for the allowed roles OR anyone explicitly granted (email allowlist).
    if (item.roles) return item.roles.includes(role) || ((item as any).masterEdit && isMasterEditor)
    return !item.adminOnly || isAdmin
  })
  return (
    <div className="w-60 h-full text-white flex flex-col shrink-0" style={{background:"#6b1a1a"}}>
      <div className="p-5 border-b flex items-center justify-between" style={{borderColor:"#8b2a2a"}}>
        <div>
          <p className="font-bold text-lg">Air Request</p>
          <p className="text-xs" style={{color:"#e8b0b0"}}>Nan Yang Textile</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-white/10" style={{color:"#e8b0b0"}}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {visible.map(item => (
          <Link key={item.href} href={item.href} onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              path.startsWith(item.href) ? "text-white" : "hover:text-white"
            }`}
            style={path.startsWith(item.href) ? {background:"#8b2a2a"} : {color:"#e8b0b0"}}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 text-xs border-t" style={{borderColor:"#8b2a2a",color:"#e8b0b0"}}>{ROLE_LABEL[role] || role}</div>
    </div>
  )
}
