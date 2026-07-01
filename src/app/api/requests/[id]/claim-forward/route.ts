import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { notifyClaimNext, notifyClaimFinalToAccounting } from "@/lib/notify"

async function generateAndSavePdfs(requestId: string) {
  try {
    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: {
        items: true,
        createdBy: { select: { name: true, email: true } },
        approvalLogs: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
        attachments: { include: { uploadedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } }
      }
    })
    if (!req) return
    const { renderToBuffer } = await import("@react-pdf/renderer")
    const { RequestPdfDocument } = await import("@/components/request-pdf")
    const React = await import("react")
    const dir = join(process.cwd(), "public", "pdfs", (req as any).documentNo)
    await mkdir(dir, { recursive: true })
    for (const item of req.items) {
      if (!["CLAIM_PASSED", "COMPLETED"].includes(item.itemStatus)) continue
      const element = React.default.createElement(RequestPdfDocument as any, { req, item })
      const buffer = await (renderToBuffer as any)(element)
      const filename = `${(req as any).documentNo}_${(item as any).so}.pdf`
      await writeFile(join(dir, filename), buffer)
    }
    console.log(`[pdf] saved ${req.items.length} PDFs for ${(req as any).documentNo}`)
  } catch (err) {
    console.error("[pdf] generation error:", err)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  const sessionClaimToken = (session.user as any).claimNextToken || null
  const forwarderName = (session.user as any).name || role
  const { id } = await params
  const body = await req.json()
  const { final, nextEmail, nextName } = body

  // Must be Claim P1 (master) or Claim Next Approver (guest via magic link)
  const isClaimP1 = (role.startsWith("CLAIM_") && role !== "CLAIM_NEXT_APPROVER") || role.startsWith("DVM_") || role === "SCM_NYK" || role === "SCM_NYG"
  const isClaimNext = role === "CLAIM_NEXT_APPROVER"
  // Derive forwarder's dept (used when saving forward)
  const forwarderDept = role.startsWith("DVM_") ? role.replace("DVM_", "")
    : role.startsWith("CLAIM_") && role !== "CLAIM_NEXT_APPROVER" ? role.replace("CLAIM_", "")
    : role === "SCM_NYK" ? "NYK"
    : role === "SCM_NYG" ? "NYG"
    : null
  if (!isClaimP1 && !isClaimNext) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const request = await prisma.airRequest.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // P2+ must be the designated approver (check email, not token — token can be stale across sessions)
  const userEmail = session.user?.email || ""
  if (isClaimNext && (!userEmail || (request as any).claimNextEmail !== userEmail)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดำเนินการ" }, { status: 403 })
  }

  if (request.status !== "PENDING_CLAIM" && request.status !== "PENDING_CLAIM_GW") {
    return NextResponse.json({ error: "เอกสารไม่ได้อยู่ในสถานะ PENDING_CLAIM" }, { status: 400 })
  }

  if (final) {
    // FINAL APPROVE: mark claim items as CLAIM_PASSED → advance if done
    const claimDept = (request as any).claimDepartment

    await (prisma.airRequest as any).update({
      where: { id },
      data: {
        claimNextEmail: null,
        claimNextToken: null,
        claimNextName: null,
        items: {
          updateMany: {
            where: {
              requestId: id,
              ...(claimDept ? { claimDepartment: claimDept } : {}),
              itemStatus: "LOG_PASSED",
            },
            data: { itemStatus: "CLAIM_PASSED" },
          },
        },
      },
    })

    const freshItems = await prisma.airRequestItem.findMany({
      where: { requestId: id },
      select: { itemStatus: true },
    })
    const nonRej = freshItems.filter(i => i.itemStatus !== "REJECTED")
    const stillPending = nonRej.some(i => i.itemStatus === "LOG_PASSED")
    if (!stillPending) {
      await prisma.airRequest.update({ where: { id }, data: { status: "COMPLETED" } })
      notifyClaimFinalToAccounting(id).catch(() => {})
      generateAndSavePdfs(id).catch(() => {})
    }

    return NextResponse.json({ ok: true, action: "final" })
  } else {
    // FORWARD: generate token → save → send email to next approver
    if (!nextEmail) return NextResponse.json({ error: "nextEmail required" }, { status: 400 })

    const token = randomBytes(32).toString("hex")
    await (prisma.airRequest as any).update({
      where: { id },
      data: {
        claimNextEmail: nextEmail,
        claimNextToken: token,
        claimNextName: nextName || null,
        // Record which dept is being forwarded so CLAIM_NEXT_APPROVER can filter correctly
        ...(forwarderDept ? { claimDepartment: forwarderDept } : {}),
      },
    })

    await notifyClaimNext(id, nextEmail, nextName || nextEmail, forwarderName, token)

    return NextResponse.json({ ok: true, action: "forwarded", to: nextEmail })
  }
}
