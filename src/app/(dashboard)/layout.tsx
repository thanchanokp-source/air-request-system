import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import DashboardShell from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  return (
    <DashboardShell role={(session.user as any).role} user={session.user}>
      {children}
    </DashboardShell>
  )
}
