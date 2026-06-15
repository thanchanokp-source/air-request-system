import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NEXT_STATUS, STYLE_APPROVER_STATUSES, CLAIM_VP_ROLES } from "@/types"
import { notifyStatusChange } from "@/lib/notify"

const getClaimDept = (role: string) => {
  if (role.startsWith("DVM_")) return role.replace("DVM_", "")
  if (role.startsWith("CLAIM_")) return role.replace("CLAIM_", "")
  if (CLAIM_VP_ROLES.includes(role)) return role.replace("VP_", "")
  return null
}

async function recalcDocStatus(id: string): Promise<string> {
  const items = await prisma.airRequestItem.findMany({ where: { requestId: id }, select: { itemStatus: true } })
  const nonRej = items.filter(i => i.itemStatus !== "REJECTED")
  if (nonRej.length === 0) return "REJECTED"
  const s = new Set(nonRej.map(i => i.itemStatus))
  if (s.has("PENDING") || s.has("VP_MER_PASSED") || s.has("PASSED")) return "PENDING_SCM"
  if (s.has("VP_PASSED")) return "PENDING_PRESIDENT"
  if (s.has("PRES_PASSED")) return "PENDING_LOGISTICS"
  if (s.has("LOG_PASSED")) return "PENDING_CLAIM"
  if (s.has("CLAIM_PASSED")) return "PENDING_VP_CLAIM"
  return "COMPLETED"
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role
  const { id } = await params
  const body = await req.json()
    const { action, comment, style, itemId, claimDepartment, logisticsData, itemActuals, soClaimData, soClaimComments, soDvmData, itemLogistics } = body

  const request = await prisma.airRequest.findUnique({ where: { id }, include: { items: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const statusMap = NEXT_STATUS[request.status]

  const getUpdated = () => prisma.airRequest.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      items: {
        include: {
          claimApprovals: {
            include: { user: { select: { id: true, name: true, role: true, priority: true } } },
            orderBy: { createdAt: "asc" }
          }
        }
      },
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

  // GW VP_MER: per-style approve/reject at PENDING_VP_MER_GW
  if (request.status === "PENDING_VP_MER_GW" && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (action === "reject_style" && !comment) return NextResponse.json({ error: "กรุณาระบุเหตุผลก่อน Reject" }, { status: 400 })
    const newItemStatus = action === "approve_style" ? "VP_MER_PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PENDING" },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: action === "approve_style" ? "APPROVE" : "REJECT", fromStatus: "PENDING_VP_MER_GW", toStatus: "PENDING_VP_MER_GW", comment: `Style: ${style}${comment ? ` - ${comment}` : ""}` }
    })
    const pendingCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    if (pendingCount === 0) {
      const vpMerPassedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "VP_MER_PASSED" } })
      if (vpMerPassedCount === 0) {
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED" } })
      } else {
        await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "VP_MER_PASSED" }, data: { itemStatus: "PENDING" } })
        await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_PRESIDENT_GW" } })
        notifyStatusChange(id, "PENDING_PRESIDENT_GW").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // GW PRESIDENT: per-style approve/reject at PENDING_PRESIDENT_GW
  if (request.status === "PENDING_PRESIDENT_GW" && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (action === "reject_style" && !comment) return NextResponse.json({ error: "กรุณาระบุเหตุผลก่อน Reject" }, { status: 400 })
    const newItemStatus = action === "approve_style" ? "PRES_PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PENDING" },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: action === "approve_style" ? "APPROVE" : "REJECT", fromStatus: "PENDING_PRESIDENT_GW", toStatus: "PENDING_PRESIDENT_GW", comment: `Style: ${style}${comment ? ` - ${comment}` : ""}` }
    })
    const pendingCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    if (pendingCount === 0) {
      const presPassedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PRES_PASSED" } })
      if (presPassedCount === 0) {
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED" } })
      } else {
        await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_LOGISTICS_GW" } })
        notifyStatusChange(id, "PENDING_LOGISTICS_GW").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // VP MER per-style: approve → VP_MER_PASSED (SCM can start immediately), reject → REJECTED
  if (request.status === "PENDING_VP_MER" && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (action === "reject_style" && !comment) return NextResponse.json({ error: "กรุณาระบุเหตุผลก่อน Reject" }, { status: 400 })

    const newItemStatus = action === "approve_style" ? "VP_MER_PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PENDING" },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId,
        action: action === "approve_style" ? "APPROVE" : "REJECT",
        fromStatus: "PENDING_VP_MER", toStatus: "PENDING_VP_MER",
        comment: `Style: ${style}${comment ? ` - ${comment}` : ""}`
      }
    })

    // Advance to PENDING_SCM when VP MER done (no PENDING left)
    const pendingCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    if (pendingCount === 0) {
      const vpMerPassedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "VP_MER_PASSED" } })
      const passedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PASSED" } })
      if (vpMerPassedCount === 0 && passedCount === 0) {
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED" } })
      } else {
        if (vpMerPassedCount > 0) {
          await prisma.airRequestItem.updateMany({
            where: { requestId: id, itemStatus: "VP_MER_PASSED" },
            data: { itemStatus: "PENDING" }
          })
        }
        await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_SCM" } })
        notifyStatusChange(id, "PENDING_SCM").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // SCM forwards VP_MER_PASSED items at PENDING_VP_MER (same style-complete rule as PENDING_SCM)
  if (request.status === "PENDING_VP_MER" && action === "approve") {
    const toForward = Object.entries(soClaimData || {}).filter(([, dept]) => dept)
    if (toForward.length === 0) return NextResponse.json({ error: "กรุณาระบุ Claim Dept อย่างน้อย 1 SO ก่อน Forward" }, { status: 400 })

    const forwardingIds = new Set(toForward.map(([itemId]) => itemId))
    const allVpMerPassedItems = await prisma.airRequestItem.findMany({
      where: { requestId: id, itemStatus: "VP_MER_PASSED" },
      select: { id: true, style: true }
    })
    const styleMap: Record<string, { total: number; forwarding: number }> = {}
    for (const item of allVpMerPassedItems) {
      if (!styleMap[item.style]) styleMap[item.style] = { total: 0, forwarding: 0 }
      styleMap[item.style].total++
      if (forwardingIds.has(item.id)) styleMap[item.style].forwarding++
    }
    for (const [s, counts] of Object.entries(styleMap)) {
      if (counts.forwarding > 0 && counts.forwarding < counts.total) {
        return NextResponse.json(
          { error: `Style "${s}" ต้องใส่ Claim Dept ครบทุก SO ก่อน Forward (${counts.forwarding}/${counts.total} SO)` },
          { status: 400 }
        )
      }
    }

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
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: "PENDING_VP_MER", toStatus: "PENDING_VP_MER", comment }
    })
    return NextResponse.json(await getUpdated())
  }

  // President: approve/reject VP_PASSED styles (per-style forwarding)
  if ((action === "approve_style" || action === "reject_style") && userRole === "PRESIDENT") {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    const newItemStatus = action === "approve_style" ? "PRES_PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "VP_PASSED" },
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
    const newStatus = await recalcDocStatus(id)
    if (newStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
      notifyStatusChange(id, newStatus).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  if (STYLE_APPROVER_STATUSES.includes(request.status) && userRole === "VP_SCM" && action !== "back_to_scm" && action !== "reject") {
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
        notifyStatusChange(id, statusMap.approve).catch(() => {})
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

    // Validate: if forwarding any SO from a style, ALL pending SOs in that style must be included
    const forwardingIds = new Set(toForward.map(([itemId]) => itemId))
    const allPendingItems = await prisma.airRequestItem.findMany({
      where: { requestId: id, itemStatus: "PENDING" },
      select: { id: true, style: true }
    })
    const styleMap: Record<string, { total: number; forwarding: number }> = {}
    for (const item of allPendingItems) {
      if (!styleMap[item.style]) styleMap[item.style] = { total: 0, forwarding: 0 }
      styleMap[item.style].total++
      if (forwardingIds.has(item.id)) styleMap[item.style].forwarding++
    }
    for (const [style, counts] of Object.entries(styleMap)) {
      if (counts.forwarding > 0 && counts.forwarding < counts.total) {
        return NextResponse.json(
          { error: `Style "${style}" ต้องใส่ Claim Dept ครบทุก SO ก่อน Forward (${counts.forwarding}/${counts.total} SO)` },
          { status: 400 }
        )
      }
    }

    for (const [itemId, dept] of toForward) {
      await prisma.airRequestItem.update({
        where: { id: itemId },
        data: {
          claimDepartment: String(dept),
          itemStatus: "PASSED",
          assignedDvm: soDvmData?.[itemId] ? String(soDvmData[itemId]) : undefined,
          itemComment: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined,
          reasonDelay: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined
        }
      })
    }

    // Use same advance logic as VP SCM path: advance when no complete style forwards remain for VP SCM
    const activeItemsAfterForward = await prisma.airRequestItem.findMany({
      where: { requestId: id, itemStatus: { in: ["PASSED", "PENDING"] } },
      select: { style: true, itemStatus: true }
    })
    const styleStateAfterForward: Record<string, { hasPending: boolean; hasPassed: boolean }> = {}
    for (const item of activeItemsAfterForward) {
      if (!styleStateAfterForward[item.style]) styleStateAfterForward[item.style] = { hasPending: false, hasPassed: false }
      if (item.itemStatus === "PENDING") styleStateAfterForward[item.style].hasPending = true
      if (item.itemStatus === "PASSED") styleStateAfterForward[item.style].hasPassed = true
    }
    const hasCompleteStyleAfterForward = Object.values(styleStateAfterForward).some(s => s.hasPassed && !s.hasPending)

    let nextStatus = "PENDING_SCM"
    if (!hasCompleteStyleAfterForward) {
      const vpPassedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "VP_PASSED" } })
      if (vpPassedCount === 0) {
        const anyRemaining = Object.values(styleStateAfterForward).some(s => s.hasPending)
        if (!anyRemaining) nextStatus = "REJECTED"
      } else {
        await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "VP_PASSED" }, data: { itemStatus: "PENDING" } })
        nextStatus = "PENDING_PRESIDENT"
      }
    }

    await prisma.airRequest.update({ where: { id }, data: { status: nextStatus } })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: "PENDING_SCM", toStatus: nextStatus, comment }
    })
    if (nextStatus !== "PENDING_SCM") notifyStatusChange(id, nextStatus).catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // VP SCM or President sends a style back to SCM (PASSED or VP_PASSED → PENDING)
  if (action === "back_to_scm_style") {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (!comment) return NextResponse.json({ error: "กรุณาระบุเหตุผลก่อน Back to SCM" }, { status: 400 })
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: { in: ["PASSED", "VP_PASSED"] } },
      data: { itemStatus: "PENDING", claimDepartment: null, itemComment: comment }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId, action: "BACK_TO_SCM",
        fromStatus: request.status, toStatus: "PENDING_SCM",
        comment: `Style: ${style} — ${comment}`
      }
    })
    const newStatus = await recalcDocStatus(id)
    if (newStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
    }
    return NextResponse.json(await getUpdated())
  }

  // VP SCM approves/rejects complete styles at PENDING_SCM (styles fully forwarded by SCM)
  if (request.status === "PENDING_SCM" && userRole === "VP_SCM" && (action === "approve_style" || action === "reject_style")) {
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
    const newStatus = await recalcDocStatus(id)
    if (newStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
      notifyStatusChange(id, newStatus).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // GW LOGISTICS: enter invoice/booking/actual per SO at PENDING_LOGISTICS_GW
  if (action === "approve" && userRole === "LOGISTICS_GW") {
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
    const freshItems = await prisma.airRequestItem.findMany({ where: { requestId: id, itemStatus: "PRES_PASSED" } })
    const readyItems = freshItems.filter((i: any) => (i as any).invoiceNo && (i as any).bookingDate && i.actualAirFreight != null)
    if (readyItems.length === 0) return NextResponse.json({ error: "กรุณาใส่ Invoice No / Booking Date / Actual THB อย่างน้อย 1 SO ก่อน Confirm" }, { status: 400 })
    for (const item of readyItems) {
      await prisma.airRequestItem.update({ where: { id: item.id }, data: { itemStatus: "LOG_PASSED" } })
    }
    const remainingPres = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PRES_PASSED" } })
    const nextStatus = remainingPres === 0 ? "PENDING_CLAIM_GW" : request.status
    if (nextStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: nextStatus } })
      notifyStatusChange(id, nextStatus).catch(() => {})
    }
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: nextStatus, comment }
    })
    return NextResponse.json(await getUpdated())
  }

  // GW CLAIM: per-SO approve/reject at PENDING_CLAIM_GW
  if ((action === "approve_so" || action === "reject_so") && userRole === "CLAIM_GW") {
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const itemData = await prisma.airRequestItem.findUnique({ where: { id: itemId } })
    if (!itemData) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    const newItemStatus = action === "approve_so" ? "COMPLETED" : "REJECTED"
    await prisma.airRequestItem.update({ where: { id: itemId }, data: { itemStatus: newItemStatus, itemComment: comment || null } })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: action === "approve_so" ? "APPROVE" : "REJECT", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so}${comment ? ` - ${comment}` : ""}` }
    })
    const remaining = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: { notIn: ["COMPLETED", "REJECTED"] } } })
    if (remaining === 0) {
      const completedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "COMPLETED" } })
      const finalStatus = completedCount > 0 ? "COMPLETED" : "REJECTED"
      await prisma.airRequest.update({ where: { id }, data: { status: finalStatus } })
      if (finalStatus !== request.status) notifyStatusChange(id, finalStatus).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // Logistics: forward SOs with invoice + booking + actual, advance when all done
  if (action === "approve" && userRole === "LOGISTICS") {
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
    const freshItems = await prisma.airRequestItem.findMany({ where: { requestId: id, itemStatus: "PRES_PASSED" } })
    const readyItems = freshItems.filter((i: any) => (i as any).invoiceNo && (i as any).bookingDate && i.actualAirFreight != null)
    if (readyItems.length === 0) return NextResponse.json({ error: "กรุณาใส่ Invoice No / Booking Date / Actual THB อย่างน้อย 1 SO ก่อน Confirm" }, { status: 400 })
    for (const item of readyItems) {
      await prisma.airRequestItem.update({ where: { id: item.id }, data: { itemStatus: "LOG_PASSED" } })
    }
    const newStatus = await recalcDocStatus(id)
    if (newStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
      notifyStatusChange(id, newStatus).catch(() => {})
    }
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: newStatus, comment }
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


  // Back to SCM for a specific SO — works from any stage (PASSED, VP_PASSED, LOG_PASSED, CLAIM_PASSED)
  if (action === "back_to_scm_so") {
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const item = request.items.find((i: any) => i.id === itemId)
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    await prisma.airRequestItem.update({
      where: { id: itemId },
      data: { itemStatus: "PENDING", claimDepartment: null, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId, action: "BACK_TO_SCM",
        fromStatus: request.status, toStatus: "PENDING_SCM",
        comment: `SO: ${item?.so} — ${comment || "Back to SCM"}`
      }
    })
    const newStatus = await recalcDocStatus(id)
    await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
    return NextResponse.json(await getUpdated())
  }

  // Per-SO claim/VP approval with priority-based sequential logic
  if (action === "approve_so" || action === "reject_so") {
    const isVpClaimRole = CLAIM_VP_ROLES.includes(userRole)
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const itemData = await prisma.airRequestItem.findUnique({ where: { id: itemId } })
    if (!itemData) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    if (action === "reject_so") {
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { itemStatus: "REJECTED", itemComment: comment || null } })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "REJECT", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so}${comment ? ` - ${comment}` : ""}` }
      })
      const newStatus = await recalcDocStatus(id)
      if (newStatus !== request.status) await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
      return NextResponse.json(await getUpdated())
    }

    // Determine role group for this dept (DVM_* or VP_*)
    const rolePrefix = isVpClaimRole ? "VP_" : "DVM_"
    const dept = userRole.replace(rolePrefix, "") // e.g. "NYK"
    const groupRole = `${rolePrefix}${dept}`

    // Get all active approvers with priority set — users without priority are excluded
    const allApprovers = await (prisma.user as any).findMany({
      where: { role: groupRole, isActive: true, priority: { not: null } },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
    })

    // Check current user's priority — must have all lower-priority approvals first
    const currentUser = allApprovers.find((u: any) => u.id === userId)
    const myPriority = currentUser?.priority ?? null
    if (myPriority !== null) {
      const lowerUsers = allApprovers.filter((u: any) => u.priority !== null && u.priority < myPriority)
      if (lowerUsers.length > 0) {
        const done = await (prisma as any).claimApproval.findMany({ where: { itemId, userId: { in: lowerUsers.map((u: any) => u.id) } } })
        if (done.length < lowerUsers.length) {
          const nextUser = allApprovers.find((u: any) => u.priority !== null && u.priority < myPriority && !done.some((d: any) => d.userId === u.id))
          return NextResponse.json({ error: `ต้องรอให้ผู้อนุมัติลำดับก่อนหน้าอนุมัติก่อน (Priority ${nextUser?.priority}: ${nextUser?.name})` }, { status: 400 })
        }
      }
    }

    // Record this approval
    await (prisma as any).claimApproval.upsert({
      where: { itemId_userId: { itemId, userId } },
      create: { itemId, userId, role: userRole },
      update: { createdAt: new Date() }
    })

    // Check if ALL approvers in this group have now approved
    const allDone = await (prisma as any).claimApproval.findMany({
      where: { itemId, user: { role: groupRole } }
    })
    const approvedIds = new Set(allDone.map((a: any) => a.userId))
    const everyoneApproved = allApprovers.every((u: any) => approvedIds.has(u.id))

    if (everyoneApproved) {
      const newItemStatus = isVpClaimRole ? "COMPLETED" : "CLAIM_PASSED"
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { itemStatus: newItemStatus, itemComment: comment || null } })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — All ${groupRole} approved${comment ? ` - ${comment}` : ""}` }
      })
      const newStatus = await recalcDocStatus(id)
      if (newStatus !== request.status) {
        await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
        notifyStatusChange(id, newStatus).catch(() => {})
      }
    } else {
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — Approved (Priority ${myPriority ?? "–"})${comment ? ` - ${comment}` : ""}` }
      })
    }

    return NextResponse.json(await getUpdated())
  }

  // For PENDING_CLAIM: legacy batch approve — advances to PENDING_VP_CLAIM instead of COMPLETED
  if (request.status === "PENDING_CLAIM" && action === "approve") {
    const userClaimDept = getClaimDept(userRole)
    if (userClaimDept) {
      await prisma.airRequestItem.updateMany({
        where: { requestId: id, claimDepartment: userClaimDept, itemStatus: "LOG_PASSED" },
        data: { itemStatus: "CLAIM_PASSED" }
      })
    }
    const newStatus = await recalcDocStatus(id)
    upd.status = newStatus
  }

  await prisma.airRequest.update({ where: { id }, data: upd })

  await prisma.approvalLog.create({
    data: { requestId: id, userId, action: action.toUpperCase(), fromStatus: request.status, toStatus: upd.status, comment }
  })

  if (upd.status && upd.status !== request.status) {
    notifyStatusChange(id, upd.status).catch(() => {})
  }

  return NextResponse.json(await getUpdated())
}
