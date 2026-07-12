import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { notifyClaimNext, notifyClaimFinalToAccounting } from "@/lib/notify"
import { ownerCanonicalDept, isLastPosition, nextPositionLabel, itemHasPendingDept } from "@/lib/claim"
import { captureApprovalSignature, isSignatureData } from "@/lib/signature"

async function generateAndSavePdfs(requestId: string) {
  try {
    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: {
        items: true,
        createdBy: { select: { name: true, email: true } },
        approvalLogs: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
        attachments: { include: { uploadedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
        approvalSignatures: { orderBy: { signedAt: "asc" } },
      } as any
    })
    if (!req) return
    const { renderToBuffer } = await import("@react-pdf/renderer")
    const { RequestPdfDocument } = await import("@/components/request-pdf")
    const React = await import("react")
    const dir = join(process.cwd(), "public", "pdfs", (req as any).documentNo)
    await mkdir(dir, { recursive: true })
    for (const item of req.items as any[]) {
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
  const { final, nextEmail, nextName, branch, itemIds } = body

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
  const claimNextToken = (session.user as any).claimNextToken || null

  // Determine dept + position for this actor. A forwarded approver is scoped to
  // the specific ClaimForward row they logged in with (by token); the entry owner
  // (SCM_NYG etc.) is position 0 and owns SO not yet forwarded.
  let forwarderDept: string | null
  let currentPos = 0
  let ownerRow: any = null
  if (isClaimNext) {
    ownerRow = claimNextToken
      ? await (prisma as any).claimForward.findFirst({ where: { requestId: id, token: claimNextToken } })
      : await (prisma as any).claimForward.findFirst({ where: { requestId: id, nextEmail: userEmail } })
    if (!ownerRow) return NextResponse.json({ error: "You are not the current approver for any department on this document" }, { status: 403 })
    forwarderDept = ownerRow.dept
    currentPos = ownerRow.position ?? 0
  } else {
    forwarderDept = ownerCanonicalDept(role, userClaimDept)
  }
  if (!forwarderDept) return NextResponse.json({ error: "Cannot determine your claim department" }, { status: 400 })

  // The SO ids this actor currently owns (available to forward). A forwarded
  // approver owns their row's itemIds; the entry owner owns dept-pending SO that
  // have NOT already been forwarded to a later position.
  const deptPendingIds: string[] = request.items
    .filter((it: any) => itemHasPendingDept(it, forwarderDept!))
    .map((it: any) => it.id)
  let ownedIds: string[]
  if (ownerRow) {
    ownedIds = Array.isArray(ownerRow.itemIds) && ownerRow.itemIds.length
      ? (ownerRow.itemIds as string[]).filter((x) => deptPendingIds.includes(x))
      : deptPendingIds // legacy null = whole dept
  } else {
    const rows = await (prisma as any).claimForward.findMany({ where: { requestId: id, dept: forwarderDept } })
    const covered = new Set<string>(rows.flatMap((r: any) => (Array.isArray(r.itemIds) ? r.itemIds : [])))
    ownedIds = deptPendingIds.filter((x) => !covered.has(x))
  }

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

    // SO to forward: the selected subset (within owned) or all owned SO.
    const selIds = (Array.isArray(itemIds) && itemIds.length)
      ? (itemIds as string[]).filter((x) => ownedIds.includes(x))
      : ownedIds
    if (selIds.length === 0) return NextResponse.json({ error: "No SO to forward" }, { status: 400 })

    const nextPos = currentPos + 1
    // Branch (Procurement Purchasing/Sourcing) chosen at the branch step; carried forward.
    const branchVal = branch || ownerRow?.branch || null
    const token = randomBytes(32).toString("hex")
    // New forward row scoped to just this subset → its own next person + token.
    await (prisma as any).claimForward.create({
      data: { requestId: id, dept: forwarderDept, nextEmail, nextName: nextName || null, token, position: nextPos, branch: branchVal, itemIds: selIds },
    })
    // Remove the forwarded SO from the actor's own row (forwarded approver only);
    // delete the row if nothing is left with them.
    if (ownerRow) {
      // Keep the row (empty itemIds) instead of deleting so the forwarder's magic
      // link still resolves — clicking their old email logs them in to view the doc.
      const remaining = ownedIds.filter((x) => !selIds.includes(x))
      await (prisma as any).claimForward.update({ where: { id: ownerRow.id }, data: { itemIds: remaining } })
    }

    const posLabel = nextPositionLabel(forwarderDept, currentPos, undefined, branchVal) || forwarderDept
    await notifyClaimNext(id, nextEmail, nextName || nextEmail, forwarderName, token, `${forwarderDept} — ${posLabel} (${selIds.length} SO)`)

    // Signature snapshot: the forwarder approves their claim position before forwarding.
    if (isSignatureData(body.signatureData)) {
      await captureApprovalSignature({
        requestId: id, userId: (session.user as any).id, userRole: role,
        name: forwarderName, email: userEmail || null, signatureData: body.signatureData,
        positionLabel: forwarderDept, crNo: (request as any).crNo || null, branch: (request as any).bu || null,
      })
    }

    return NextResponse.json({ ok: true, action: "forwarded", to: nextEmail, dept: forwarderDept, position: nextPos, count: selIds.length })
  }
}
