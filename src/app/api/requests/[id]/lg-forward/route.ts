import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { randomBytes } from "crypto"

const APP_URL = process.env.APP_URL || "http://localhost:3000"
const LG_ROLES = ["LOGISTICS", "LOGISTICS_TRM", "LOGISTICS_GW"]

// LG handoff: a senior LG (or the current forward-holder) forwards this document's data-entry to
// a subordinate. The partial data they already filled is saved separately (save_logistics_draft);
// here we just record who it went to + email them a magic-link to open & continue.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role
  const userEmail = String(session.user?.email || "").toLowerCase()
  const forwarderName = (session.user as any).name || role
  const { id } = await params
  const { toEmail, toName, note } = await req.json()

  const request = await prisma.airRequest.findUnique({ where: { id } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Held roles (multi-role) so a senior with LG in roles[] can forward.
  const dbRoles: string[] = await prisma.user.findUnique({ where: { id: userId }, select: { roles: true } as any })
    .then((u: any) => (Array.isArray(u?.roles) ? u.roles : [])).catch(() => [])
  const held = [role, ...dbRoles]
  const isLg = role === "ADMIN" || held.some(r => LG_ROLES.includes(r))
  const isCurrentTarget = !!(request as any).lgForwardEmail && userEmail === String((request as any).lgForwardEmail).toLowerCase()
  if (!isLg && !isCurrentTarget) return NextResponse.json({ error: "Only Logistics can forward this document" }, { status: 403 })

  const to = String(toEmail || "").trim().toLowerCase()
  if (!to.endsWith("@nanyangtextile.com")) return NextResponse.json({ error: "Please choose a valid @nanyangtextile.com recipient" }, { status: 400 })
  if (to === userEmail) return NextResponse.json({ error: "Cannot forward to yourself" }, { status: 400 })

  const token = randomBytes(32).toString("hex")
  await prisma.airRequest.update({
    where: { id },
    data: { lgForwardEmail: to, lgForwardName: toName || to, lgForwardBy: forwarderName, lgForwardToken: token } as any,
  })
  await prisma.approvalLog.create({
    data: { requestId: id, userId, action: "LG_FORWARD", fromStatus: request.status, toStatus: request.status, comment: `Logistics forwarded to ${toName || to}${note ? ` — ${note}` : ""}` },
  })

  const link = `${APP_URL}/api/magic-login?token=${token}&redirect=/requests/${id}`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
      <div style="background:#6b1a1a;color:#fff;padding:16px 20px"><b>Air Request — Logistics Handoff</b></div>
      <div style="padding:20px;color:#111;font-size:14px;line-height:1.6">
        <p><b>${forwarderName}</b> ได้ส่งเอกสาร <b>${(request as any).documentNo}</b> มาให้คุณกรอกข้อมูล Logistics ต่อ</p>
        ${note ? `<p style="background:#f9fafb;border-left:3px solid #6b1a1a;padding:8px 12px;color:#374151">📝 ${note}</p>` : ""}
        <p style="margin-top:16px"><a href="${link}" style="background:#6b1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;display:inline-block">เปิดเอกสาร &amp; กรอกต่อ →</a></p>
        <p style="color:#9ca3af;font-size:12px;margin-top:16px">ลิงก์นี้จะพาคุณเข้าสู่ระบบและเปิดเอกสารโดยตรง (ไม่ต้องใช้รหัสผ่าน)</p>
      </div>
    </div>`
  await sendMail([to], `[Logistics] เอกสารส่งต่อให้คุณกรอก — ${(request as any).documentNo}`, html).catch(() => {})

  return NextResponse.json({ ok: true, to })
}
