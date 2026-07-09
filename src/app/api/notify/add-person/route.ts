import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyAdminAddPerson } from "@/lib/notify"

// A claim approver can't find a person for the required position → email ADMIN
// asking them to add that person as a user.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { position, suggestedName, requestId } = await req.json()
    if (!position) return NextResponse.json({ error: "position required" }, { status: 400 })

    let documentNo: string | undefined
    let bu: string | undefined
    if (requestId) {
      const r = await prisma.airRequest.findUnique({
        where: { id: requestId }, select: { documentNo: true, bu: true },
      })
      documentNo = r?.documentNo
      bu = (r as any)?.bu
    }

    await notifyAdminAddPerson({
      position: String(position),
      suggestedName: suggestedName ? String(suggestedName) : undefined,
      requesterName: (session.user as any)?.name || (session.user as any)?.email,
      documentNo, bu, requestId,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}
