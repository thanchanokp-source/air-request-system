"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const nav = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/requests", label: "AIR REQUESTS" },
  { href: "/approvals", label: "APPROVALS" },
  { href: "/users", label: "USER MANAGEMENT", adminOnly: true },
  { href: "/master/port", label: "MASTER PORT", adminOnly: true },
  { href: "/master/description", label: "MASTER DESCRIPTION", adminOnly: true }
]

export default function Sidebar({ role }: { role: string }) {
  const path = usePathname()
  const isAdmin = role === "ADMIN"
  const visible = nav.filter(item => !item.adminOnly || isAdmin)
  return (
    <div className="w-60 bg-blue-900 text-white flex flex-col shrink-0">
      <div className="p-5 border-b border-blue-800">
        <p className="font-bold text-lg">Air Request</p>
        <p className="text-blue-300 text-xs">Nan Yang Textile</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {visible.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              path.startsWith(item.href) ? "bg-blue-700 text-white" : "text-blue-200 hover:bg-blue-800"
            }`}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-blue-800 text-xs text-blue-400">{role}</div>
    </div>
  )
}
