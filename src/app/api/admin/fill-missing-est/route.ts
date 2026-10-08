import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { fillMissingEst } from "@/lib/freight"

export const runtime = "nodejs"

// Admin one-shot: fill EST for every line that still has none, from the CURRENT Master Description +
// Master Rate (also runs automatically when a description is added / edited).
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })
  const filled = await fillMissingEst()
  return NextResponse.json({ ok: true, filled })
}
