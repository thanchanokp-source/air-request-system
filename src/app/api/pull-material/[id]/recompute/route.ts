import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { recomputePullAir } from "@/lib/pull-freight"

// Re-run the air freight formula for a document (dest by BU + max rate + origin cost) → refresh
// airFreightCost + originCost. Admin / Logistics can trigger it for existing docs.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const u: any = session?.user
  const ok = !!u && (u.role === "ADMIN" || (Array.isArray(u.roles) && (u.roles.includes("LOGISTICS_IMPORT") || u.roles.includes("LOGISTICS"))))
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  try {
    await recomputePullAir(id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "recompute failed" }, { status: 500 })
  }
}
