import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { notifyClaimNext, notifyClaimFinalToAccounting } from "@/lib/notify"
import { ownerCanonicalDept, isLastPosition, nextPositionLabel } from "@/lib/claim"

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
  const userClaimDept = (session.user as any).claimDepartment || null
  const forwarderName = (session.user as any).name || role
  const { id } = await params
  const body = await req.json()
  const { final, nextEmail, nextName } = body

  // Must be a claim owner (master role) or a forwarded Claim Next Approver
  const isClaimP1 = (role.startsWith("CLAIM_") && role !== "CLAIM_NEXT_APPROVER") || role.startsWith("DVM_") || role === "SCM_NYK" || role === "SCM_NYG"
  const isClaimNext = role === "CLAIM_NEXT_APPROVER"
  if (!isClaimP1 && !isClaimNext) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const request = await prisma.airRequest.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (request.status !== "PENDING_CLAIM" && request.status !== "PENDING_CLAIM_GW") {
    return NextResponse.json({ error: "The document is not in the Claim stage" }, { status: 400 })
  }

  const userEmail = session.user?.email || ""

  // Determine which department this actor owns + their position in the chain.
  // Entry owner (SCM_NYG etc.) = position 0; a forwarded approver = stored position.
  let forwarderDept: string | null
  let currentPos = 0
  if (isClaimNext) {
    const fwd = userEmail
      ? await (prisma as any).claimForward.findFirst({ where: { requestId: id, nextEmail: userEmail } })
      : null
    if (!fwd) return NextResponse.json({ error: "You are not the current approver for any department on this document" }, { status: 403 })
    forwarderDept = fwd.dept
    currentPos = fwd.position ?? 0
  } else {
    forwarderDept = ownerCanonicalDept(role, userClaimDept)
  }
  if (!forwarderDept) return NextResponse.json({ error: "Cannot determine your claim department" }, { status: 400 })

  // GW finish is handled by the approve route (finalize_claim_dept) so status
  // recalculation stays in one place. Here we only keep the NYG legacy finish.
  if (final && request.bu === "GW") {
    return NextResponse.json({ error: "Use finalize_claim_dept to finish a GW claim department" }, { status: 400 })
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
      await notifyClaimFinalToAccounting(id).catch(() => {})
      generateAndSavePdfs(id).catch(() => {})
    }

    return NextResponse.json({ ok: true, action: "final" })
  } else {
    // FORWARD to the NEXT position in the forced chain (person = free choice,
    // position = enforced). The last position must finish, not forward.
    if (isLastPosition(forwarderDept, currentPos)) {
      return NextResponse.json({ error: "This is the final position — finish the process (cannot forward further)." }, { status: 400 })
    }
    if (!nextEmail) return NextResponse.json({ error: "nextEmail required" }, { status: 400 })
    const nextPos = currentPos + 1

    const token = randomBytes(32).toString("hex")
    await (prisma as any).claimForward.upsert({
      where: { requestId_dept: { requestId: id, dept: forwarderDept } },
      create: { requestId: id, dept: forwarderDept, nextEmail, nextName: nextName || null, token, position: nextPos },
      update: { nextEmail, nextName: nextName || null, token, position: nextPos },
    })

    const posLabel = nextPositionLabel(forwarderDept, currentPos) || forwarderDept
    await notifyClaimNext(id, nextEmail, nextName || nextEmail, forwarderName, token, `${forwarderDept} — ${posLabel}`)

    return NextResponse.json({ ok: true, action: "forwarded", to: nextEmail, dept: forwarderDept, position: nextPos })
  }
}
