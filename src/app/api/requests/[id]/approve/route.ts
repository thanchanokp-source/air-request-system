import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NEXT_STATUS, STYLE_APPROVER_STATUSES } from "@/types"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const { id } = await params
  const body = await req.json()
    const { action, comment, style, itemId, claimDepartment, logisticsData, itemActuals, soClaimData, soClaimComments, itemLogistics } = body

  const request = await prisma.airRequest.findUnique({ where: { id }, include: { items: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const statusMap = NEXT_STATUS[request.status]

  const getUpdated = () => prisma.airRequest.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      items: true,
      approvalLogs: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } }
    }
  })

  // Save logistics data without changing status (used when doc is already at PENDING_CLAIM)
  if (action === "save_logistics") {
    if (itemActuals && typeof itemActuals === "object") {
      for (const [itemId, val] of Object.entries(itemActuals)) {
        const num = parseFloat(String(val))
        if (!isNaN(num)) await prisma.airRequestItem.update({ where: { id: itemId }, data: { actualAirFreight: num } })
      }
    }
    if (itemLogistics && typeof itemLogistics === "object") {
      for (const [itemId, data] of Object.entries(itemLogistics)) {
        const d = data as any
        await prisma.airRequestItem.update({
          where: { id: itemId },
          data: { invoiceNo: d.invoiceNo || null, bookingDate: d.bookingDate ? new Date(d.bookingDate) : null }
        })
      }
    }
    return NextResponse.json(await getUpdated())
  }

  if (action === "save_claim_progress") {
    if (soClaimData && typeof soClaimData === "object") {
      for (const [itemId, dept] of Object.entries(soClaimData)) {
        if (dept) await prisma.airRequestItem.update({
          where: { id: itemId },
          data: {
            claimDepartment: String(dept),
            itemComment: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined,
            reasonDelay: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined
          }
        })
      }
    }
    return NextResponse.json(await getUpdated())
  }

  if (!statusMap) return NextResponse.json({ error: "Invalid status" }, { status: 400 })

  if (STYLE_APPROVER_STATUSES.includes(request.status) && action !== "back_to_scm" && action !== "reject") {
    if (!action || !style) return NextResponse.json({ error: "Action and style required" }, { status: 400 })

    const newItemStatus = action === "approve_style" ? "PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PENDING" },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })

    await prisma.approvalLog.create({
      data: {
        requestId: id, userId,
        action: action === "approve_style" ? "APPROVE" : "REJECT",
        fromStatus: request.status, toStatus: request.status,
        comment: `Style: ${style}${comment ? ` - ${comment}` : ""}`
      }
    })

    const pendingCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    if (pendingCount === 0) {
      const passedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PASSED" } })
      if (passedCount === 0) {
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED" } })
      } else {
        await prisma.airRequestItem.updateMany({
          where: { requestId: id, itemStatus: "PASSED" },
          data: { itemStatus: "PENDING" }
        })
        await prisma.airRequest.update({ where: { id }, data: { status: statusMap.approve } })
      }
    }

    return NextResponse.json(await getUpdated())
  }

  const toStatus = action === "back_to_scm" ? "PENDING_SCM"
    : action === "reject" ? statusMap.reject
    : statusMap.approve
  if (!toStatus) return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  // Partial SCM forwarding: forward only assigned items, advance when all done
  if (request.status === "PENDING_SCM" && action === "approve") {
    const toForward = Object.entries(soClaimData || {}).filter(([, dept]) => dept)
    if (toForward.length === 0) return NextResponse.json({ error: "กรุณาระบุ Claim Dept อย่างน้อย 1 SO ก่อน Forward" }, { status: 400 })

    for (const [itemId, dept] of toForward) {
      await prisma.airRequestItem.update({
        where: { id: itemId },
        data: {
          claimDepartment: String(dept),
          itemStatus: "PASSED",
          itemComment: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined,
          reasonDelay: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined
        }
      })
    }

    const stillPending = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    const stillPassed = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PASSED" } })

    let nextStatus = "PENDING_SCM"
    if (stillPending === 0 && stillPassed === 0) {
      const vpPassedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "VP_PASSED" } })
      if (vpPassedCount === 0) {
        nextStatus = "REJECTED"
      } else {
        await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "VP_PASSED" }, data: { itemStatus: "PENDING" } })
        nextStatus = "PENDING_PRESIDENT"
      }
    }

    await prisma.airRequest.update({ where: { id }, data: { status: nextStatus } })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: "PENDING_SCM", toStatus: nextStatus, comment }
    })
    return NextResponse.json(await getUpdated())
  }

  // VP SCM sends a style back to SCM at PENDING_SCM
  if (request.status === "PENDING_SCM" && action === "back_to_scm_style") {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (!comment) return NextResponse.json({ error: "กรุณาระบุเหตุผลก่อน Back to SCM" }, { status: 400 })
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PASSED" },
      data: { itemStatus: "PENDING", claimDepartment: null, itemComment: comment }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId, action: "BACK_TO_SCM",
        fromStatus: "PENDING_SCM", toStatus: "PENDING_SCM",
        comment: `Style: ${style} — ${comment}`
      }
    })
    return NextResponse.json(await getUpdated())
  }

  // VP SCM approves/rejects complete styles at PENDING_SCM (styles fully forwarded by SCM)
  if (request.status === "PENDING_SCM" && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    const newItemStatus = action === "approve_style" ? "VP_PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PASSED" },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId,
        action: action === "approve_style" ? "APPROVE" : "REJECT",
        fromStatus: "PENDING_SCM", toStatus: "PENDING_SCM",
        comment: `Style: ${style}${comment ? ` - ${comment}` : ""}`
      }
    })
    const pendingCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    const passedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PASSED" } })
    if (pendingCount === 0 && passedCount === 0) {
      const vpPassedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "VP_PASSED" } })
      if (vpPassedCount === 0) {
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED" } })
      } else {
        await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "VP_PASSED" }, data: { itemStatus: "PENDING" } })
        await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_PRESIDENT" } })
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // Partial LOGISTICS forwarding: forward SOs with invoice + booking + actual, advance when all done
  if (request.status === "PENDING_LOGISTICS" && action === "approve") {
    if (itemActuals && typeof itemActuals === "object") {
      for (const [iid, val] of Object.entries(itemActuals)) {
        const num = parseFloat(String(val))
        if (!isNaN(num)) await prisma.airRequestItem.update({ where: { id: iid }, data: { actualAirFreight: num } })
      }
    }
    if (itemLogistics && typeof itemLogistics === "object") {
      for (const [iid, data] of Object.entries(itemLogistics)) {
        const d = data as any
        await prisma.airRequestItem.update({
          where: { id: iid },
          data: { invoiceNo: d.invoiceNo || null, bookingDate: d.bookingDate ? new Date(d.bookingDate) : null } as any
        })
      }
    }
    const freshItems = await prisma.airRequestItem.findMany({ where: { requestId: id, itemStatus: "PENDING" } })
    const readyItems = freshItems.filter(i => (i as any).invoiceNo && (i as any).bookingDate && i.actualAirFreight != null)
    if (readyItems.length === 0) return NextResponse.json({ error: "กรุณาใส่ Invoice No / Booking Date / Actual THB อย่างน้อย 1 SO ก่อน Confirm" }, { status: 400 })

    for (const item of readyItems) {
      await prisma.airRequestItem.update({ where: { id: item.id }, data: { itemStatus: "PASSED" } })
    }
    const stillPending = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    const nextStatus = stillPending === 0 ? toStatus : request.status
    if (stillPending === 0) {
      await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "PASSED" }, data: { itemStatus: "PENDING" } })
    }
    await prisma.airRequest.update({ where: { id }, data: { status: nextStatus } })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: "PENDING_LOGISTICS", toStatus: nextStatus, comment }
    })
    return NextResponse.json(await getUpdated())
  }

  const upd: any = { status: toStatus }
  if (claimDepartment) upd.claimDepartment = claimDepartment
  if (soClaimData && typeof soClaimData === "object") {
    for (const [itemId, dept] of Object.entries(soClaimData)) {
      if (dept) await prisma.airRequestItem.update({
        where: { id: itemId },
        data: {
          claimDepartment: String(dept),
          itemComment: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined,
          reasonDelay: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined
        }
      })
    }
    const depts = [...new Set(Object.values(soClaimData).filter(Boolean))]
    if (depts.length === 1) upd.claimDepartment = depts[0] as string
  }

  if (action === "reject" && comment) upd.rejectionReason = comment
  if (logisticsData) {
    upd.invoiceNo = logisticsData.invoiceNo
    upd.bookingDate = logisticsData.bookingDate ? new Date(logisticsData.bookingDate) : null
    upd.airline = logisticsData.airline
  }

  if (itemActuals && typeof itemActuals === "object") {
    for (const [itemId, val] of Object.entries(itemActuals)) {
      const num = parseFloat(String(val))
      if (!isNaN(num)) {
        await prisma.airRequestItem.update({ where: { id: itemId }, data: { actualAirFreight: num } })
      }
    }
  }

  if (itemLogistics && typeof itemLogistics === "object") {
    for (const [itemId, data] of Object.entries(itemLogistics)) {
      const d = data as any
      await prisma.airRequestItem.update({
        where: { id: itemId },
        data: { invoiceNo: d.invoiceNo || null, bookingDate: d.bookingDate ? new Date(d.bookingDate) : null }
      })
    }
  }


  // Back to SCM for a specific SO only
  if (request.status === "PENDING_CLAIM" && action === "back_to_scm_so") {
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const item = request.items.find((i: any) => i.id === itemId)
    await prisma.airRequestItem.update({
      where: { id: itemId },
      data: { itemStatus: "PENDING", claimDepartment: null, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId, action: "BACK_TO_SCM",
        fromStatus: "PENDING_CLAIM", toStatus: "PENDING_SCM",
        comment: `SO: ${item?.so} — ${comment || "Back to SCM"}`
      }
    })
    await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_SCM" } })
    return NextResponse.json(await getUpdated())
  }

  // Per-SO claim approval
  if (request.status === "PENDING_CLAIM" && (action === "approve_so" || action === "reject_so")) {
    const userRole = (session.user as any).role as string
    const userClaimDept = userRole.startsWith("CLAIM_") ? userRole.replace("CLAIM_", "") : null
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const newItemStatus = action === "approve_so" ? "PASSED" : "REJECTED"
    const updated = await prisma.airRequestItem.update({
      where: { id: itemId },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId,
        action: action === "approve_so" ? "APPROVE" : "REJECT",
        fromStatus: request.status, toStatus: request.status,
        comment: `SO: ${updated.so}${comment ? ` - ${comment}` : ""}`
      }
    })
    const deptPending = await prisma.airRequestItem.count({
      where: { requestId: id, claimDepartment: userClaimDept || "", itemStatus: "PENDING" }
    })
    if (deptPending === 0) {
      const allPending = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
      if (allPending === 0) {
        const nykCount = await prisma.airRequestItem.count({
          where: { requestId: id, claimDepartment: "NYK", itemStatus: { not: "REJECTED" } }
        })
        const nextStatus = nykCount > 0 ? "PENDING_VP_NYK" : "COMPLETED"
        await prisma.airRequest.update({ where: { id }, data: { status: nextStatus } })
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // For PENDING_CLAIM: track per-dept approval, advance only when ALL depts done
  if (request.status === "PENDING_CLAIM" && action === "approve") {
    const userRole = (session.user as any).role as string
    const userClaimDept = userRole.startsWith("CLAIM_") ? userRole.replace("CLAIM_", "") : null
    if (userClaimDept) {
      await prisma.airRequestItem.updateMany({
        where: { requestId: id, claimDepartment: userClaimDept, itemStatus: "PENDING" },
        data: { itemStatus: "PASSED" }
      })
    }
    const stillPending = await prisma.airRequestItem.count({
      where: { requestId: id, itemStatus: "PENDING" }
    })
    if (stillPending > 0) {
      upd.status = request.status
    } else {
      const nykCount = await prisma.airRequestItem.count({
        where: { requestId: id, claimDepartment: "NYK", itemStatus: { not: "REJECTED" } }
      })
      upd.status = nykCount > 0 ? "PENDING_VP_NYK" : "COMPLETED"
    }
  }

  await prisma.airRequest.update({ where: { id }, data: upd })

  await prisma.approvalLog.create({
    data: { requestId: id, userId, action: action.toUpperCase(), fromStatus: request.status, toStatus: upd.status, comment }
  })

  return NextResponse.json(await getUpdated())
}
