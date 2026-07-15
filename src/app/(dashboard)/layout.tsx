import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import DashboardShell from "@/components/layout/dashboard-shell"
import { isMaintenance } from "@/lib/settings"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const role = (session.user as any).role
  // Maintenance mode: admins keep full access to test; everyone else is held out.
  if (role !== "ADMIN" && (await isMaintenance())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="text-5xl mb-4">🛠️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">ปิดปรับปรุงระบบชั่วคราว</h1>
          <p className="text-sm text-gray-500">
            ระบบกำลังอยู่ระหว่างการทดสอบ/ปรับปรุง กรุณากลับมาใหม่ภายหลัง<br />
            <span className="text-gray-400">The system is temporarily down for maintenance.</span>
          </p>
        </div>
      </div>
    )
  }
  return (
    <DashboardShell role={role} user={session.user}>
      {children}
    </DashboardShell>
  )
}
