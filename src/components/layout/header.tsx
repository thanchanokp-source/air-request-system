"use client"
import { signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import Link from "next/link"

const ROLE_LABEL: Record<string, string> = {
  VP_MER_GW: "DPM (GW)", DPM_GW: "DPM (GW)", GM_GW: "GM (GW)", PRESIDENT_GW: "President (GW)",
  LOGISTICS_GW: "Logistics (GW)", CLAIM_GW: "Claim (GW)", SCM_NYK: "SCM NYK", SCM_NYG: "SCM NYG",
  ACCOUNTING: "Accounting", MER_USER: "MER", MER_GW: "MER (GW)",
}

export default function Header({ user, onMenuClick }: { user: any; onMenuClick?: () => void }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetch("/api/notifications/count")
      .then(r => r.json())
      .then(d => setCount(d.count || 0))
  }, [])

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
      <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
      <div className="hidden lg:block"/>
      <div className="flex items-center gap-3 md:gap-4">
        <Link href="/approvals" className="relative p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 leading-none">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900 leading-tight">{user.name || user.email}</p>
          <p className="text-xs text-gray-500">{ROLE_LABEL[user.role] || user.role}</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs text-gray-500 hover:text-red-600 border border-gray-300 px-2 md:px-3 py-1 rounded whitespace-nowrap">
          Logout
        </button>
      </div>
    </header>
  )
}
