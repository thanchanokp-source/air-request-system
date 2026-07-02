"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const nav = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/requests", label: "AIR REQUESTS" },
  { href: "/approvals", label: "APPROVALS" },
  { href: "/files", label: "ALL FILES" },
  { href: "/users", label: "USER MANAGEMENT", adminOnly: true },
  { href: "/master/port", label: "MASTER PORT", roles: ["ADMIN", "LOGISTICS"] },
  { href: "/master/description", label: "MASTER DESCRIPTION", adminOnly: true }
]

const ROLE_LABEL: Record<string, string> = {
  VP_MER_GW: "DPM (GW)", DPM_GW: "DPM (GW)", GM_GW: "GM (GW)", PRESIDENT_GW: "President (GW)",
  LOGISTICS_GW: "Logistics (GW)", CLAIM_GW: "Claim (GW)", SCM_NYK: "SCM NYK", SCM_NYG: "SCM NYG",
  ACCOUNTING: "Accounting", MER_USER: "MER", MER_GW: "MER (GW)",
}

export default function Sidebar({ role, onClose }: { role: string; onClose?: () => void }) {
  const path = usePathname()
  const isAdmin = role === "ADMIN"
  const visible = nav.filter(item => {
    if (item.roles) return item.roles.includes(role)
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
