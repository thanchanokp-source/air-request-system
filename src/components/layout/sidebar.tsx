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
  { href: "/files", label: "DOCUMENT FOR LOGISTICS & ACCOUNTING" },
  { href: "/requests/nyk-import", label: "NYK IMPORT", adminOnly: true },
  { href: "/logistics", label: "LG BOOKING", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "LOGISTICS_SUB"] },
  { href: "/qty-air-map", label: "QTY AIR MAP", adminOnly: true },
  { href: "/fix-hawb", label: "FIX HAWB", adminOnly: true },
  { href: "/users", label: "USER MANAGEMENT", adminOnly: true },
  { href: "/master/port", label: "MASTER RATE", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "MER_USER", "MER_GW", "DVM_MER"], masterEdit: true },
  { href: "/master/description", label: "MASTER DESCRIPTION", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "MER_USER", "DVM_MER"], masterEdit: true },
  { href: "/master/delay-code", label: "MASTER DELAY CODE", roles: ["ADMIN", "LOGISTICS", "LOGISTICS_GW", "SCM_USER"], masterEdit: true },
  { href: "/settings", label: "SETTINGS", adminOnly: true },
]
const pullNav = [
  { href: "/pull-material/dashboard", label: "DASHBOARD", roles: ["ADMIN", "PURCHASING", "SCM_PULL", "LOGISTICS_IMPORT", "DVM_PUR", "VP_PUR", "PULL_DVM_SCM", "VP_SCM", "PULL_PRESIDENT", "MER_PULL"] },
  { href: "/pull-material/request", label: "NEW REQUEST", roles: ["ADMIN", "SCM_PULL", "PURCHASING", "MER_PULL"] },
  { href: "/pull-material/tracking", label: "TRACKING DOCUMENT", roles: ["ADMIN", "PURCHASING", "SCM_PULL", "LOGISTICS_IMPORT", "MER_PULL"] },
  { href: "/pull-material/files", label: "ATTACH FILES", roles: ["ADMIN", "PURCHASING", "SCM_PULL", "LOGISTICS_IMPORT", "MER_PULL"] },
  { href: "/pull-material/purchase", label: "รอจัดซื้อกรอก", roles: ["ADMIN", "PURCHASING"] },
  { href: "/pull-material/revise-stats", label: "REVISE STATS", roles: ["ADMIN", "PURCHASING", "DVM_PUR", "VP_PUR"] },
  { href: "/pull-material/approval", label: "APPROVAL", roles: ["ADMIN", "PULL_DVM_SCM", "VP_SCM", "PULL_PRESIDENT", "DVM_PUR", "VP_PUR"] },
  { href: "/pull-material/documents", label: "LOGISTICS", roles: ["ADMIN", "LOGISTICS_IMPORT"] },
  { href: "/pull-material/rates", label: "MASTER RATE", roles: ["ADMIN", "LOGISTICS_IMPORT"] },
  { href: "/pull-material/master-city", label: "MASTER PURCHASE", roles: ["ADMIN", "PURCHASING"] },
  { href: "/pull-material/users", label: "USER MANAGEMENT", roles: ["ADMIN"] },
]

// Top-level family tabs.
const FAMILIES = [
  { key: "claim", label: "CLAIM AIR", icon: "✈", home: "/dashboard" },
  { key: "pull", label: "RM REQ AIR", icon: "📦", home: "/pull-material/request" },
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

  const allRoles = [role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const PULL_ROLES = ["PURCHASING", "SCM_PULL", "LOGISTICS_IMPORT", "DVM_PUR", "VP_PUR", "PULL_DVM_SCM", "MER_PULL"] // pure Pull RM roles
  // + air approvers who ALSO act in Pull RM (they keep Claim Air too, so not "pure pull").
  const PULL_TAB_ROLES = [...PULL_ROLES, "VP_SCM", "PULL_PRESIDENT"]
  const hasPull = isAdmin || allRoles.some((r: string) => PULL_TAB_ROLES.includes(r))
  // Pure Pull RM user (no air-side role) → hide the Claim Air family entirely.
  const isPurePull = !isAdmin && allRoles.length > 0 && allRoles.every((r: string) => PULL_ROLES.includes(r))

  const family = path.startsWith("/pull-material") ? "pull" : "claim"
  const nav = family === "pull" ? pullNav : claimNav
  // Sidebar palette per family: RM REQ AIR = "Ink & Amber" (modern dark); CLAIM AIR = original maroon.
  const TH = family === "pull" ? {
    bg: "#191c22", border: "#2a2f3a", brandSub: "#8b93a3",
    lockBg: "#2a2f3a", lockText: "#6b7280",
    famActiveBg: "#e0a340", famActiveText: "#1a1205", famInactiveBg: "#2a2f3a", famInactiveText: "#9aa2b3",
    itemActiveBg: "#e0a340", itemActiveText: "#1a1205", itemText: "#8b93a3", footer: "#8b93a3",
  } : {
    bg: "#6b1a1a", border: "#8b2a2a", brandSub: "#e8b0b0",
    lockBg: "#7a2323", lockText: "#c79a9a",
    famActiveBg: "#ffffff", famActiveText: "#6b1a1a", famInactiveBg: "#8b2a2a", famInactiveText: "#f0d0d0",
    itemActiveBg: "#8b2a2a", itemActiveText: "#ffffff", itemText: "#e8b0b0", footer: "#e8b0b0",
  }
  const visible = nav.filter((item: any) => {
    if (item.roles) return item.roles.some((r: string) => allRoles.includes(r)) || (item.masterEdit && isMasterEditor)
    return !item.adminOnly || isAdmin
  })

  return (
    <div className="w-60 h-full text-white flex flex-col shrink-0 transition-colors" style={{ background: TH.bg }}>
      <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: TH.border }}>
        <div>
          <p className="font-bold text-lg">Nan Yang Textile</p>
          <p className="text-xs" style={{ color: TH.brandSub }}>Air Request System</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-white/10" style={{ color: TH.brandSub }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Top-level family tabs: Claim Air | Pull Material.
          Pull Material is still under test → locked (grey) for everyone except ADMIN. */}
      <div className="p-3 grid grid-cols-2 gap-2 border-b" style={{ borderColor: TH.border }}>
        {FAMILIES.map(f => {
          const active = family === f.key
          // Pull tab: open to Admin + Pull RM roles (still locked/"testing" for other air users).
          // Claim tab: hidden for pure Pull RM users (they have no air-side pages).
          const locked = f.key === "pull" ? !hasPull : f.key === "claim" ? isPurePull : false
          if (locked) {
            return (
              <div key={f.key} title="ไม่มีสิทธิ์เข้าถึง"
                className="rounded-lg px-2 py-2.5 text-center opacity-50 cursor-not-allowed"
                style={{ background: TH.lockBg, color: TH.lockText }}>
                <div className="text-lg leading-none">{f.icon}</div>
                <div className="text-[11px] font-bold mt-1">{f.label}</div>
              </div>
            )
          }
          return (
            <Link key={f.key} href={f.home} onClick={onClose}
              className="rounded-lg px-2 py-2.5 text-center transition-colors"
              style={active
                ? { background: TH.famActiveBg, color: TH.famActiveText }
                : { background: TH.famInactiveBg, color: TH.famInactiveText }}>
              <div className="text-lg leading-none">{f.icon}</div>
              <div className="text-[11px] font-bold mt-1">{f.label}</div>
            </Link>
          )
        })}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visible.map(item => (
          <Link key={item.href} href={item.href} onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${path.startsWith(item.href) ? "" : "hover:text-white"}`}
            style={path.startsWith(item.href)
              ? { background: TH.itemActiveBg, color: TH.itemActiveText, fontWeight: 700 }
              : { color: TH.itemText }}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 text-xs border-t" style={{ borderColor: TH.border, color: TH.footer }}>
        {(session?.user as any)?.title || ROLE_LABEL[role] || role}
      </div>
    </div>
  )
}
