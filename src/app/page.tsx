import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Logistics roles land straight on LG BOOKING; everyone else on the dashboard.
export default async function Home() {
  const session = await getServerSession(authOptions)
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isLg = roles.some(r => ["LOGISTICS", "LOGISTICS_SUB", "LOGISTICS_GW", "LOGISTICS_TRM"].includes(r))
  redirect(isLg ? "/logistics" : "/dashboard")
}
