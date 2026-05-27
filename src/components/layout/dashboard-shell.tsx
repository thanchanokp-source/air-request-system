"use client"
import { useState } from "react"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"

export default function DashboardShell({ role, user, children }: {
  role: string; user: any; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex h-screen bg-gray-100">
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setOpen(false)}/>
      )}
      <div className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 lg:relative lg:z-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar role={role} onClose={() => setOpen(false)}/>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header user={user} onMenuClick={() => setOpen(true)}/>
        <main className="flex-1 overflow-auto p-3 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
