import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendPasswordSetupEmail } from "@/lib/notify"
import crypto from "crypto"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const users = await (prisma.user as any).findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, bu: true, claimDepartment: true, procurementType: true, isActive: true, priority: true, createdAt: true }
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, email, role, bu, claimDepartment, priority, procurementType, sendEmail } = await req.json()
  if (!email || !role) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const token = crypto.randomUUID()
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const isProcurement = role === "CLAIM_PROCUREMENT" || role === "DVM_PROCUREMENT"

  try {
    const user = await prisma.user.create({
      data: {
        name, email: email.toLowerCase(), password: null,
        role, bu: bu || "NYG",
        claimDepartment: (role === "CLAIM_GW" || role === "SCM_NYK" || role === "SCM_NYG") ? (claimDepartment || null) : null,
        procurementType: isProcurement ? (procurementType || null) : null,
        priority: priority ?? null,
        isActive: false,
        resetToken: token,
        resetTokenExpiry: expiry,
      } as any
    })
    if (sendEmail) {
      sendPasswordSetupEmail(email, name || email, token).catch(() => {})
    }
    return NextResponse.json({ id: user.id })
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Email นี้มีในระบบแล้ว" }, { status: 409 })
    throw e
  }
}
