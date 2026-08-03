import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canEditMaster } from "@/lib/master-access"
import { getFx, setFx } from "@/lib/fx"

// Global USD exchange rates (EA currency conversion). Edited on the Master Rate page.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getFx())
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canEditMaster(session.user)) return NextResponse.json({ error: "Read only" }, { status: 403 })
  const { thbPerUsd, vndPerUsd } = await req.json()
  await setFx(Number(thbPerUsd) || 0, Number(vndPerUsd) || 0)
  return NextResponse.json(await getFx())
}
