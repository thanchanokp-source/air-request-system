"use client"
import { signOut } from "next-auth/react"
export default function Header({ user }: { user: any }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right"><p className="text-sm font-medium text-gray-900">{user.name || user.email}</p><p className="text-xs text-gray-500">{user.role}</p></div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs text-gray-500 hover:text-red-600 border border-gray-300 px-3 py-1 rounded">Logout</button>
      </div>
    </header>
  )
}
