"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { MASTER_EDITOR_EMAILS } from "@/lib/master-access"

// Two top-level document families. Each has its own set of pages.
const claimNav = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/requests", label: "AIR REQUESTS" },
  { href: "/approvals", label: "APPROVALS" },
  { href: "/claim-status", label: "CLAIM STATUS" },
  { href: "/files", label: "REPORT" },
  { href: "/requests/nyk-import", label: "NYK IMPORT", adminOnly: true },
  { href: "/logistics", label: "LG BOOKING", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM"] },
  { href: "/users", label: "USER MANAGEMENT", adminOnly: true },
  { href: "/master/port", label: "MASTER RATE", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "MER_USER", "MER_GW", "DVM_MER"], masterEdit: true },
  { href: "/master/description", label: "MASTER DESCRIPTION", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "MER_USER", "DVM_MER"], masterEdit: true },
  { href: "/master/delay-code", label: "MASTER DELAY CODE", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "SCM_USER"], masterEdit: true },
  { href: "/settings", label: "SETTINGS", adminOnly: true },
]
const pullNav = [
  { href: "/pull-material", label: "REQUEST / ALL DOCUMENTS" },
]

// Top-level family tabs.
const FAMILIES = [
  { key: "claim", label: "Claim Air", icon: "✈", home: "/dashboard" },
  { key: "pull", label: "Pull Material", icon: "📦", home: "/pull-material" },
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

  const family = path.startsWith("/pull-material") ? "pull" : "claim"
  const nav = family === "pull" ? pullNav : claimNav
  const visible = nav.filter((item: any) => {
    if (item.roles) return item.roles.includes(role) || (item.masterEdit && isMasterEditor)
    return !item.adminOnly || isAdmin
  })

  return (
    <div className="w-60 h-full text-white flex flex-col shrink-0" style={{ background: "#6b1a1a" }}>
      <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "#8b2a2a" }}>
        <div>
          <p className="font-bold text-lg">Nan Yang Textile</p>
          <p className="text-xs" style={{ color: "#e8b0b0" }}>Air Request System</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-white/10" style={{ color: "#e8b0b0" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Top-level family tabs: Claim Air | Pull Material.
          Pull Material is still under test → locked (grey) for everyone except ADMIN. */}
      <div className="p-3 grid grid-cols-2 gap-2 border-b" style={{ borderColor: "#8b2a2a" }}>
        {FAMILIES.map(f => {
          const active = family === f.key
          const locked = f.key === "pull" && !isAdmin
          if (locked) {
            return (
              <div key={f.key} title="อยู่ระหว่างทดสอบ — เปิดเฉพาะ Admin"
                className="rounded-lg px-2 py-2.5 text-center opacity-50 cursor-not-allowed"
                style={{ background: "#7a2323", color: "#c79a9a" }}>
                <div className="text-lg leading-none">{f.icon}</div>
                <div className="text-[11px] font-bold mt-1">{f.label}</div>
                <div className="text-[9px] mt-0.5">🔒 ทดสอบ</div>
              </div>
            )
          }
          return (
            <Link key={f.key} href={f.home} onClick={onClose}
              className="rounded-lg px-2 py-2.5 text-center transition-colors"
              style={active
                ? { background: "#fff", color: "#6b1a1a" }
                : { background: "#8b2a2a", color: "#f0d0d0" }}>
              <div className="text-lg leading-none">{f.icon}</div>
              <div className="text-[11px] font-bold mt-1">{f.label}</div>
              {f.key === "pull" && <div className="text-[9px] mt-0.5 opacity-80">🧪 admin test</div>}
            </Link>
          )
        })}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visible.map(item => (
          <Link key={item.href} href={item.href} onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              path.startsWith(item.href) ? "text-white" : "hover:text-white"
            }`}
            style={path.startsWith(item.href) ? { background: "#8b2a2a" } : { color: "#e8b0b0" }}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 text-xs border-t" style={{ borderColor: "#8b2a2a", color: "#e8b0b0" }}>
        {(session?.user as any)?.title || ROLE_LABEL[role] || role}
      </div>
    </div>
  )
}
