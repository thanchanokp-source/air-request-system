import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NEXT_STATUS, STYLE_APPROVER_STATUSES, CLAIM_VP_ROLES } from "@/types"
import { notifyStatusChange, notifyClaimNextPriority, notifyLgFilesToClaimers, notifyClaimNext, notifyClaimEntry } from "@/lib/notify"
import { captureApprovalSignature, SIG_APPROVE_ACTIONS, isSignatureData } from "@/lib/signature"
import { getSplits, deriveGwItemStatus, setDeptSplitStatus, deriveNygItemStatus, gwDeptsForRole, hasPendingGwSplit, hasApprovableGwSplit, approveGwDeptSplits, GW_DEPT_APPROVED, nykSplitStatus, setGwSplitStatus, ownerCanonicalDept, expandClaimDept, itemHasPendingDept, NYG_SPLIT, isLastPosition, actingClaimForSO, claimEntryRoles, claimVpRoles } from "@/lib/claim"

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
  if (s.has("VP_PASSED")) return "PENDING_SCM"
  if (s.has("PRES_PASSED")) return "PENDING_LOGISTICS"
  if (s.has("LOG_PASSED")) return "PENDING_CLAIM"
  if (s.has("CLAIM_PASSED")) return "PENDING_VP_CLAIM"
  // Claim + Logistics complete → President's FINAL approval, then Accounting.
  if (s.has("PRESIDENT_PENDING")) return "PENDING_PRESIDENT"
  if (s.has("ACCOUNTING_PENDING")) return "PENDING_ACCOUNTING"
  return "COMPLETED"
}

async function recalcDocStatusGW(id: string): Promise<string> {
  const items = await prisma.airRequestItem.findMany({ where: { requestId: id }, select: { itemStatus: true } })
  const nonRej = items.filter(i => i.itemStatus !== "REJECTED")
  if (nonRej.length === 0) return "REJECTED"
  const s = new Set(nonRej.map(i => i.itemStatus))
  // A claim dept sent an SO back to MER to re-select the claim department.
  if (s.has("CLAIM_REJECT_GW")) return "PENDING_CLAIM_REJECT_GW"
  if (s.has("PENDING") || s.has("VP_MER_PASSED") || s.has("PRES_PASSED") || s.has("LOG_PASSED")) return "PENDING_CLAIM_GW"
  if (s.has("SCM_GW_PENDING")) return "PENDING_SCM_GW"
  // Claim + Logistics complete → President's final approval, THEN Accounting.
  if (s.has("PRESIDENT_PENDING")) return "PENDING_PRESIDENT_GW"
  if (s.has("ACCOUNTING_PENDING")) return "PENDING_ACCOUNTING"
  return "COMPLETED"
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role
  const userClaimDept = (session.user as any).claimDepartment || null
  // A person may hold several roles (User.roles[]); the login session carries only
  // the primary role. For CLAIM actions, treat them as holding ALL their roles so a
  // person who is (e.g.) VP MER AND a claim approver can act at the claim step too.
  // Fetched from DB so it works even for sessions issued before roles[] existed.
  const dbUserRoles: string[] = await prisma.user
    .findUnique({ where: { id: userId }, select: { roles: true } as any })
    .then((u: any) => (Array.isArray(u?.roles) ? u.roles : []))
    .catch(() => [])
  const heldRoles: string[] = [userRole, ...dbUserRoles.filter((r: string) => r && r !== userRole)]
  const { id } = await params
  const body = await req.json()
    const { action, comment, style, itemId, itemIds, claimDepartment, gwClaimDept, logisticsData, itemActuals, soClaimData, soClaimComments, soDvmData, itemLogistics, assignedVpScm } = body

  const request = await prisma.airRequest.findUnique({ where: { id }, include: { items: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Capture the approver's signature snapshot for any APPROVE-type action (not
  // data entry, and not Logistics — Logistics is not a signatory). Centralised so
  // every approve handler below records the stamp automatically.
  const isLogisticsEntry = userRole === "LOGISTICS" || userRole === "LOGISTICS_GW"
  if (isSignatureData(body.signatureData)
      && SIG_APPROVE_ACTIONS.has(action) && !(action === "approve" && isLogisticsEntry)) {
    await captureApprovalSignature({
      requestId: id, userId, userRole,
      name: (session.user as any).name || (session.user as any).email || "Approver",
      email: (session.user as any).email || null,
      signatureData: body.signatureData,
      crNo: (request as any).crNo || body.crNo || null,
      branch: (request as any).bu || null,
    })
  }

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
      approvalLogs: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      attachments: { include: { uploadedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } }
    }
  })

  // LG saves logistics data as draft at PENDING_SCM (parallel with SCM — no status change)
  if (action === "save_logistics_draft" && userRole === "LOGISTICS") {
    if (itemActuals && typeof itemActuals === "object") {
      for (const [iid, val] of Object.entries(itemActuals)) {
        const num = parseFloat(String(val))
        if (!isNaN(num)) await prisma.airRequestItem.update({ where: { id: iid }, data: { actualAirFreight: num } })
      }
    }
    if (itemLogistics && typeof itemLogistics === "object") {
      for (const [iid, data] of Object.entries(itemLogistics)) {
        const d = data as any
        // Save invoiceNo + bookingDate (always safe fields)
        await prisma.airRequestItem.update({
          where: { id: iid },
          data: { invoiceNo: d.invoiceNo || null, bookingDate: d.bookingDate ? new Date(d.bookingDate) : null }
        })
        // Save hawbNo separately (field may not exist in older Prisma client builds)
        if (d.hawbNo !== undefined) {
          try {
            await prisma.airRequestItem.update({ where: { id: iid }, data: { hawbNo: d.hawbNo || null } as any })
          } catch { /* hawbNo not yet in Prisma client — skip */ }
        }
      }
    }
    // LG runs in PARALLEL with Claim. Now that Actual may be entered, re-derive any item
    // whose claim is fully approved so it can advance to President (needs claim done AND
    // Actual in). Items still mid-claim are unaffected.
    {
      const nygItems = await prisma.airRequestItem.findMany({ where: { requestId: id } })
      for (const it of nygItems) {
        if (!["LOG_PASSED", "CLAIM_PASSED"].includes(it.itemStatus)) continue
        const ns = deriveNygItemStatus(getSplits(it), (it as any).actualAirFreight != null)
        if (ns !== it.itemStatus) await prisma.airRequestItem.update({ where: { id: it.id }, data: { itemStatus: ns } })
      }
      const nd = await recalcDocStatus(id)
      if (nd !== request.status) {
        await prisma.airRequest.update({ where: { id }, data: { status: nd } })
        await notifyStatusChange(id, nd).catch(() => {})
      }
    }
    // "Save & Send" (data complete) → email the claimers the LG files + signed PDF (item 2).
    if (body.lgComplete) await notifyLgFilesToClaimers(id).catch(() => {})
    return NextResponse.json(await getUpdated())
  }

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
      for (const [itemId, deptVal] of Object.entries(soClaimData)) {
        if (!deptVal) continue
        const isArr = Array.isArray(deptVal)
        const firstDept = isArr ? (deptVal as any[])[0]?.dept : String(deptVal)
        if (!firstDept) continue
        await prisma.airRequestItem.update({
          where: { id: itemId },
          data: {
            claimDepartment: firstDept,
            claimDepts: isArr ? (deptVal as any) : [{ dept: String(deptVal), pct: 100 }],
            itemComment: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined,
          } as any
        })
      }
    }
    return NextResponse.json(await getUpdated())
  }

  if (!statusMap) return NextResponse.json({ error: "Invalid status" }, { status: 400 })

  // GW VP_MER: per-style approve/reject at PENDING_VP_MER_GW
  if (request.status === "PENDING_VP_MER_GW" && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (action === "reject_style" && !comment) return NextResponse.json({ error: "Please provide a reason before rejecting" }, { status: 400 })
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
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED", rejectionReason: comment || "Rejected by VP MER GW" } })
        await notifyStatusChange(id, "REJECTED").catch(() => {})
      } else {
        await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "VP_MER_PASSED" }, data: { itemStatus: "PENDING" } })
        await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_GM_GW" } })
        await notifyStatusChange(id, "PENDING_GM_GW").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // GW GM: per-style approve/reject at PENDING_GM_GW (between DPM and President)
  if (request.status === "PENDING_GM_GW" && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (action === "reject_style" && !comment) return NextResponse.json({ error: "Please provide a reason before rejecting" }, { status: 400 })
    const newItemStatus = action === "approve_style" ? "VP_MER_PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PENDING" },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: action === "approve_style" ? "APPROVE" : "REJECT", fromStatus: "PENDING_GM_GW", toStatus: "PENDING_GM_GW", comment: `Style: ${style}${comment ? ` - ${comment}` : ""}` }
    })
    const pendingCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    if (pendingCount === 0) {
      const passedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "VP_MER_PASSED" } })
      if (passedCount === 0) {
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED", rejectionReason: comment || "Rejected by GM GW" } })
        await notifyStatusChange(id, "REJECTED").catch(() => {})
      } else {
        // President moved to the END: after GM, go straight into the parallel
        // stage (Logistics ∥ Claim). President approves last, before Accounting.
        await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "VP_MER_PASSED" }, data: { itemStatus: "PRES_PASSED" } })
        await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_CLAIM_GW" } })
        await notifyStatusChange(id, "PENDING_LOGISTICS_GW").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // GW PRESIDENT — FINAL approval (whole document, no reject). Reached only when
  // every claim dept is approved AND Logistics data is filled (items PRESIDENT_PENDING).
  if (request.status === "PENDING_PRESIDENT_GW" && action === "president_approve_gw") {
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, itemStatus: { notIn: ["REJECTED"] } },
      data: { itemStatus: "ACCOUNTING_PENDING" },
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: "PENDING_PRESIDENT_GW", toStatus: "PENDING_ACCOUNTING", comment: "President approved — sent to Accounting" }
    })
    await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_ACCOUNTING" } })
    await notifyStatusChange(id, "PENDING_ACCOUNTING").catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // DVM MER per-style (NYG): the FIRST approver, before VP MER. approve → DVM_MER_PASSED,
  // reject → REJECTED. When every style is processed, hand the whole doc to VP MER.
  if (request.status === "PENDING_DVM_MER" && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (action === "reject_style" && !comment) return NextResponse.json({ error: "Please provide a reason before rejecting" }, { status: 400 })

    const newItemStatus = action === "approve_style" ? "DVM_MER_PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PENDING" },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId,
        action: action === "approve_style" ? "APPROVE" : "REJECT",
        fromStatus: "PENDING_DVM_MER", toStatus: "PENDING_DVM_MER",
        comment: `Style: ${style}${comment ? ` - ${comment}` : ""}`
      }
    })

    // When DVM MER is done (no PENDING left) → reset approved items to PENDING and
    // advance to VP MER (which is unchanged from here on).
    const pendingCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    if (pendingCount === 0) {
      const passedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "DVM_MER_PASSED" } })
      if (passedCount === 0) {
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED" } })
        await notifyStatusChange(id, "REJECTED").catch(() => {})
      } else {
        await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "DVM_MER_PASSED" }, data: { itemStatus: "PENDING" } })
        await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_VP_MER" } })
        await notifyStatusChange(id, "PENDING_VP_MER").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // VP MER per-style: approve → VP_MER_PASSED (SCM can start immediately), reject → REJECTED
  if (request.status === "PENDING_VP_MER" && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (action === "reject_style" && !comment) return NextResponse.json({ error: "Please provide a reason before rejecting" }, { status: 400 })

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

    // Advance to PENDING_PRESIDENT when VP MER done (no PENDING left)
    const pendingCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "PENDING" } })
    if (pendingCount === 0) {
      const vpMerPassedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "VP_MER_PASSED" } })
      if (vpMerPassedCount === 0) {
        // All styles rejected
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED" } })
        await notifyStatusChange(id, "REJECTED").catch(() => {})
      } else {
        // President moved to the END — after VP MER, go straight to SCM claim
        // assignment. Reset items to PENDING so SCM can assign the claim dept.
        await prisma.airRequestItem.updateMany({ where: { requestId: id, itemStatus: "VP_MER_PASSED" }, data: { itemStatus: "PENDING" } })
        await (prisma.airRequest as any).update({ where: { id }, data: { status: "PENDING_SCM", scmToken: crypto.randomUUID(), vpScmToken: crypto.randomUUID(), logisticsToken: crypto.randomUUID(), accountingToken: crypto.randomUUID(), presidentToken: crypto.randomUUID() } })
        await notifyStatusChange(id, "PENDING_SCM").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // NYG PRESIDENT — FINAL approval (whole document, no reject). Reached only when
  // all claim departments are approved AND Logistics data is filled (PRESIDENT_PENDING).
  if (request.status === "PENDING_PRESIDENT" && action === "president_approve" && userRole === "PRESIDENT") {
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, itemStatus: { notIn: ["REJECTED"] } },
      data: { itemStatus: "ACCOUNTING_PENDING" },
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: "PENDING_PRESIDENT", toStatus: "PENDING_ACCOUNTING", comment: "President approved — sent to Accounting" }
    })
    await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_ACCOUNTING" } })
    await notifyStatusChange(id, "PENDING_ACCOUNTING").catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // SCM forwards VP_MER_PASSED items at PENDING_VP_MER (same style-complete rule as PENDING_SCM)
  if (request.status === "PENDING_VP_MER" && action === "approve" && userRole !== "LOGISTICS") {
    const toForward = Object.entries(soClaimData || {}).filter(([, dept]) => dept)
    if (toForward.length === 0) return NextResponse.json({ error: "Please assign a Claim Dept for at least 1 SO before forwarding" }, { status: 400 })

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
          { error: `Style "${s}" must have a Claim Dept assigned for all SOs before forwarding (${counts.forwarding}/${counts.total} SO)` },
          { status: 400 }
        )
      }
    }

    for (const [itemId, deptVal] of toForward) {
      const isArr = Array.isArray(deptVal)
      const firstDept = isArr ? (deptVal as any[])[0]?.dept : String(deptVal)
      await prisma.airRequestItem.update({
        where: { id: itemId },
        data: {
          claimDepartment: firstDept || String(deptVal),
          claimDepts: isArr ? (deptVal as any) : [{ dept: String(deptVal), pct: 100 }],
          itemStatus: "PASSED",
          itemComment: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined,
        } as any
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
      await notifyStatusChange(id, newStatus).catch(() => {})
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
        await notifyStatusChange(id, statusMap.approve).catch(() => {})
      }
    }

    return NextResponse.json(await getUpdated())
  }

  const toStatus = action === "back_to_scm" ? "PENDING_SCM"
    : action === "reject" ? statusMap.reject
    : statusMap.approve
  if (!toStatus) return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  // Partial SCM forwarding: forward only assigned items, advance when all done
  if (request.status === "PENDING_SCM" && action === "approve" && userRole !== "LOGISTICS") {
    const toForward = Object.entries(soClaimData || {}).filter(([, dept]) => dept)
    if (toForward.length === 0) return NextResponse.json({ error: "Please assign a Claim Dept for at least 1 SO before forwarding" }, { status: 400 })

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
          { error: `Style "${style}" must have a Claim Dept assigned for all SOs before forwarding (${counts.forwarding}/${counts.total} SO)` },
          { status: 400 }
        )
      }
    }

    for (const [itemId, deptVal] of toForward) {
      const isArr = Array.isArray(deptVal)
      const firstDept = isArr ? (deptVal as any[])[0]?.dept : String(deptVal)
      await prisma.airRequestItem.update({
        where: { id: itemId },
        data: {
          claimDepartment: firstDept || String(deptVal),
          claimDepts: isArr ? (deptVal as any) : [{ dept: String(deptVal), pct: 100 }],
          itemStatus: "PASSED",
          assignedDvm: soDvmData?.[itemId] ? String(soDvmData[itemId]) : undefined,
          itemComment: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined,
        } as any
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

    // Save assignedVpScm if provided by SCM
    if (assignedVpScm) {
      await (prisma.airRequest as any).update({ where: { id }, data: { assignedVpScm } })
    }
    await prisma.airRequest.update({ where: { id }, data: { status: nextStatus } })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: "PENDING_SCM", toStatus: nextStatus, comment }
    })
    if (nextStatus !== "PENDING_SCM") await notifyStatusChange(id, nextStatus).catch(() => {})
    // Notify VP SCM only on first assignment or when changed to a different person
    if (assignedVpScm && (request as any).assignedVpScm !== assignedVpScm) {
      await notifyStatusChange(id, "SCM_ASSIGNED_VP_SCM").catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // VP SCM or President sends a style back to SCM (PASSED or VP_PASSED → PENDING)
  if (action === "back_to_scm_style") {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (!comment) return NextResponse.json({ error: "Please provide a reason before sending back to SCM" }, { status: 400 })
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: { in: ["PASSED", "VP_PASSED"] } },
      data: { itemStatus: "PENDING", claimDepartment: null, claimDepts: null, itemComment: comment } as any
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
    // Alert the SCM user that a style has been sent back for re-work.
    await notifyStatusChange(id, "PENDING_SCM").catch(() => {})
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
    // When no PENDING/PASSED remain → all styles processed by VP SCM
    const remainingActive = await prisma.airRequestItem.count({
      where: { requestId: id, itemStatus: { in: ["PENDING", "PASSED"] } }
    })
    if (remainingActive === 0) {
      const vpPassedCount = await prisma.airRequestItem.count({ where: { requestId: id, itemStatus: "VP_PASSED" } })
      if (vpPassedCount === 0) {
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED" } })
        await notifyStatusChange(id, "REJECTED").catch(() => {})
      } else {
        // Convert VP_PASSED → LOG_PASSED so Claim page can pick them up (LG data already filled in parallel)
        await prisma.airRequestItem.updateMany({
          where: { requestId: id, itemStatus: "VP_PASSED" },
          data: { itemStatus: "LOG_PASSED" }
        })
        await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_CLAIM" } })
        await notifyStatusChange(id, "PENDING_CLAIM").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // GW LOGISTICS (parallel with Claim): enter invoice/HAWB/actual per SO. Saving
  // data does NOT advance the SO — it only completes the Logistics side; the SO
  // reaches Accounting when Claim is also fully approved.
  if (action === "approve" && userRole === "LOGISTICS_GW") {
    if (request.bu !== "GW") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!["PENDING_CLAIM_GW", "PENDING_LOGISTICS_GW", "PENDING_PRESIDENT_GW"].includes(request.status)) {
      return NextResponse.json({ error: "Request is not at the Logistics stage" }, { status: 400 })
    }
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
          data: { invoiceNo: d.invoiceNo || null, hawbNo: d.hawbNo || null, bookingDate: d.bookingDate ? new Date(d.bookingDate) : null } as any
        })
      }
    }
    // Parallel-stage items (PRES_PASSED). Ready = has actual air freight.
    const freshItems = await prisma.airRequestItem.findMany({ where: { requestId: id, itemStatus: { in: ["PRES_PASSED", "LOG_PASSED"] } } })
    const readyItems = freshItems.filter((i: any) => i.actualAirFreight != null)
    if (readyItems.length === 0) return NextResponse.json({ error: "Please assign a HAWB and enter Total Air for at least 1 SO before confirming" }, { status: 400 })
    // Re-derive: an SO goes to Accounting only if Claim is done AND LG data present.
    for (const item of freshItems) {
      const lgDone = item.actualAirFreight != null
      const derived = deriveGwItemStatus(getSplits(item), lgDone)
      if (derived !== item.itemStatus) await prisma.airRequestItem.update({ where: { id: item.id }, data: { itemStatus: derived } })
    }
    const nextStatus = await recalcDocStatusGW(id)
    if (nextStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: nextStatus } })
      await notifyStatusChange(id, nextStatus).catch(() => {})
    }
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: nextStatus, comment }
    })
    // "Save & Send" (data complete) → email the claimers the LG files + signed PDF (item 2).
    if (body.lgComplete) await notifyLgFilesToClaimers(id).catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // GW CLAIM: batch approve multiple SOs at once
  if (action === "batch_approve_so" && userRole === "CLAIM_GW") {
    if (request.bu !== "GW") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (request.status !== "PENDING_CLAIM_GW" && request.status !== "PENDING_LOGISTICS_GW") {
      return NextResponse.json({ error: "Request is not at Claim stage" }, { status: 400 })
    }
    if (!Array.isArray(itemIds) || itemIds.length === 0) return NextResponse.json({ error: "itemIds required" }, { status: 400 })
    const myDepts = gwDeptsForRole(userRole, userClaimDept)
    for (const iid of itemIds) {
      const itemData = await prisma.airRequestItem.findUnique({ where: { id: iid } })
      if (!itemData || itemData.requestId !== id || !["PRES_PASSED", "LOG_PASSED"].includes(itemData.itemStatus)) continue
      const updated = approveGwDeptSplits(getSplits(itemData), myDepts)
      await prisma.airRequestItem.update({ where: { id: iid }, data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, itemData.actualAirFreight != null) } })
    }
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `Batch approve ${itemIds.length} SO(s)` }
    })
    const nextDocStatus = await recalcDocStatusGW(id)
    if (nextDocStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
      await notifyStatusChange(id, nextDocStatus).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // NOTE: GW claim (CLAIM_GW / SCM_NYK / SCM_NYG) is handled by the parallel
  // per-department `approve_so_claim_gw` handler below. Accounting is read-only
  // (no approve) — it is notified when all departments have approved.

  // Logistics: forward SOs that have actualAirFreight (set via HAWB), advance when all done
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
          data: { invoiceNo: d.invoiceNo || null, hawbNo: d.hawbNo || null, bookingDate: d.bookingDate ? new Date(d.bookingDate) : null } as any
        })
      }
    }
    const freshItems = await prisma.airRequestItem.findMany({ where: { requestId: id, itemStatus: "PRES_PASSED" } })
    const readyItems = freshItems.filter((i: any) => i.actualAirFreight != null)
    if (readyItems.length === 0) return NextResponse.json({ error: "Please create a HAWB and calculate Air Freight before confirming" }, { status: 400 })
    for (const item of readyItems) {
      await prisma.airRequestItem.update({ where: { id: item.id }, data: { itemStatus: "LOG_PASSED" } })
    }
    const newStatus = await recalcDocStatus(id)
    if (newStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
      await notifyStatusChange(id, newStatus).catch(() => {})
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
    if (userRole === "CLAIM_NEXT_APPROVER") {
      const userEmail = session.user?.email || ""
      if (!userEmail || (request as any).claimNextEmail !== userEmail) {
        return NextResponse.json({ error: "You do not have permission to perform this action" }, { status: 403 })
      }
    }
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const item = request.items.find((i: any) => i.id === itemId)
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    // Reset the SO for re-assignment: clear claim dept + splits + this SO's approvals.
    await (prisma as any).claimApproval.deleteMany({ where: { itemId } })
    await prisma.airRequestItem.update({
      where: { id: itemId },
      data: { itemStatus: "PENDING", claimDepartment: null, claimDepts: null, itemComment: comment || null } as any
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
    // Alert SCM (re-select claim dept). PENDING_SCM notify targets the SCM user.
    if (newStatus === "PENDING_SCM") await notifyStatusChange(id, "PENDING_SCM").catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // CLAIM_NEXT_APPROVER: approve single SO directly (no priority chain)
  if (action === "approve_so_next" && userRole === "CLAIM_NEXT_APPROVER") {
    const userEmail = session.user?.email || ""
    if (!userEmail || (request as any).claimNextEmail !== userEmail) {
      return NextResponse.json({ error: "You do not have permission to approve this document" }, { status: 403 })
    }
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const itemData = await prisma.airRequestItem.findUnique({ where: { id: itemId } })
    if (!itemData || itemData.requestId !== id) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    await prisma.airRequestItem.update({ where: { id: itemId }, data: { itemStatus: "CLAIM_PASSED" } })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — Approved by forwarded approver` }
    })
    const newStatus = await recalcDocStatus(id)
    if (newStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
      await notifyStatusChange(id, newStatus).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // GW CLAIM (parallel per-department): each dept approves ONLY its own split.
  // Priority chain per role (some depts single approver, some sequential).
  // SCM_NYK must enter CR NO. When all splits approved → item ACCOUNTING_PENDING
  // → doc PENDING_ACCOUNTING (Accounting is read-only, gets notified).
  // SCM NYK (User) enters the CR NO (one per document). Each NYK split becomes
  // DEPT_APPROVED only when the APPROVER + EVP have both approved that SO too.
  if (action === "finalize_cr_gw" && userRole === "SCM_NYK") {
    const isGW = request.bu === "GW"
    const expectedStatus = isGW ? "PENDING_CLAIM_GW" : "PENDING_CLAIM"
    if (request.status !== expectedStatus) return NextResponse.json({ error: "Not in the Claim stage" }, { status: 400 })
    const nykDept = isGW ? "SCM NYK" : "NYK"
    const doneStatus = isGW ? GW_DEPT_APPROVED : "COMPLETED"
    const cr = body.crNo ? String(body.crNo).trim() : ""
    if (!cr) return NextResponse.json({ error: "Please enter CR NO" }, { status: 400 })
    const items = await prisma.airRequestItem.findMany({ where: { requestId: id }, include: { claimApprovals: { include: { user: { select: { role: true } } } } } })
    // SCM NYK Approver must approve first before the CR user (parallel with EVP) can enter CR.
    const nykSOs = items.filter(it => getSplits(it).some((s: any) => s.dept === nykDept && s.status !== "REJECTED"))
    if (nykSOs.length === 0) return NextResponse.json({ error: "No SCM NYK claim SO awaiting a CR NO" }, { status: 400 })
    const awaitingApprover = nykSOs.filter(it => !((it as any).claimApprovals || []).some((a: any) => a.role === "SCM_NYK_APPROVER"))
    if (awaitingApprover.length > 0) return NextResponse.json({ error: `Waiting for the SCM NYK Approver to approve all SOs before entering the CR NO (${awaitingApprover.length} SO remaining)` }, { status: 400 })
    await prisma.airRequest.update({ where: { id }, data: { crNo: cr } as any })
    let finalizedCount = 0
    for (const it of items) {
      const splits = getSplits(it)
      if (!splits.some((s: any) => s.dept === nykDept && s.status !== "REJECTED" && s.status !== doneStatus)) continue
      const appr: any[] = (it as any).claimApprovals || []
      const hasApprover = appr.some((a: any) => a.role === "SCM_NYK_APPROVER")
      const hasEvp = appr.some((a: any) => a.role === "SCM_NYK_EVP")
      const splitStatus = nykSplitStatus({ approver: hasApprover, evp: hasEvp, cr: true }, doneStatus)
      const updated = setGwSplitStatus(splits, [nykDept], splitStatus, cr)
      await prisma.airRequestItem.update({ where: { id: it.id }, data: { claimDepts: updated as any, itemStatus: isGW ? deriveGwItemStatus(updated, it.actualAirFreight != null) : deriveNygItemStatus(updated, it.actualAirFreight != null) } })
      finalizedCount++
    }
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `CR NO: ${cr} — SCM NYK finalized ${finalizedCount} SO` }
    })
    const nextDocStatus = isGW ? await recalcDocStatusGW(id) : await recalcDocStatus(id)
    if (nextDocStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
      await notifyStatusChange(id, nextDocStatus).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // GW claim dept rejects → send SO back to MER (GW) to re-select the claim dept.
  if (action === "claim_back_to_mer_gw" && ["CLAIM_GW", "SCM_NYK_APPROVER", "SCM_NYK_EVP", "SCM_NYG", "CLAIM_NEXT_APPROVER"].includes(userRole)) {
    if (request.bu !== "GW") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (request.status !== "PENDING_CLAIM_GW") return NextResponse.json({ error: "Not in the GW Claim stage" }, { status: 400 })
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    if (!comment) return NextResponse.json({ error: "Please provide a reason" }, { status: 400 })
    const itemData = await prisma.airRequestItem.findUnique({ where: { id: itemId } })
    if (!itemData || itemData.requestId !== id) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    // Clear this SO's claim approvals so re-assignment starts fresh, flag for MER.
    await (prisma as any).claimApproval.deleteMany({ where: { itemId } })
    await prisma.airRequestItem.update({ where: { id: itemId }, data: { itemStatus: "CLAIM_REJECT_GW", itemComment: comment } as any })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "BACK_TO_SCM", fromStatus: request.status, toStatus: "PENDING_CLAIM_REJECT_GW", comment: `SO: ${itemData.so} — Claim rejected, back to MER: ${comment}` }
    })
    const nextDocStatus = await recalcDocStatusGW(id)
    if (nextDocStatus !== request.status) await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
    await notifyStatusChange(id, "CLAIM_REJECTED_GW").catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // MER (GW) re-selects the claim dept for a rejected SO and resubmits to Claim.
  if (action === "resubmit_claim_gw" && userRole === "MER_GW") {
    if (request.bu !== "GW") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const splits = Array.isArray(body.claimDepts) ? body.claimDepts : null
    if (!splits || splits.length === 0) return NextResponse.json({ error: "Please select at least one claim department" }, { status: 400 })
    const totalPctVal = splits.reduce((sum: number, s: any) => sum + (Number(s.pct) || 0), 0)
    if (Math.round(totalPctVal) !== 100) return NextResponse.json({ error: "Total %CLAIM must equal 100" }, { status: 400 })
    const newSplits = splits.map((s: any) => ({ dept: String(s.dept), pct: Number(s.pct) || 0, reason: s.reason || null, status: null, crNo: null }))
    await prisma.airRequestItem.update({
      where: { id: itemId },
      data: { claimDepts: newSplits as any, claimDepartment: newSplits[0].dept, itemStatus: "LOG_PASSED" } as any
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: "PENDING_CLAIM_GW", comment: `SO re-assigned claim dept: ${newSplits.map((s: any) => `${s.dept} ${s.pct}%`).join(", ")}` }
    })
    const nextDocStatus = await recalcDocStatusGW(id)
    if (nextDocStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
      if (nextDocStatus === "PENDING_CLAIM_GW") await notifyStatusChange(id, "PENDING_CLAIM_GW").catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // Batch version of approve_so_claim_gw — approve MANY SO in ONE request so it
  // doesn't fire an email + doc-status recalc per SO (that made 30+ SO very slow).
  // DB writes per item, then a single recalc + single notify at the end.
  if (action === "batch_approve_claim_gw" && ["CLAIM_GW", "SCM_NYK_APPROVER", "SCM_NYK_EVP", "SCM_NYG"].includes(userRole)) {
    if (request.bu !== "GW") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (request.status !== "PENDING_CLAIM_GW") return NextResponse.json({ error: "Not in the GW Claim stage" }, { status: 400 })
    if (!Array.isArray(itemIds) || itemIds.length === 0) return NextResponse.json({ error: "itemIds required" }, { status: 400 })
    const crNo = (request as any).crNo || null

    // NYK Approver assigns the CR-entry person + EVP once for the whole document.
    // Notify EVP/CR only on the FIRST assignment (null → set), not every batch/SO.
    let gwNykFirstAssign = false
    if (userRole === "SCM_NYK_APPROVER" && (body.evpEmail || body.crEmail)) {
      const cur = await (prisma.airRequest as any).findUnique({ where: { id }, select: { assignedScmNykEvp: true, assignedScmNykCr: true } })
      gwNykFirstAssign = (!!body.evpEmail && !cur?.assignedScmNykEvp) || (!!body.crEmail && !cur?.assignedScmNykCr)
      await prisma.airRequest.update({ where: { id }, data: { assignedScmNykEvp: body.evpEmail || null, assignedScmNykCr: body.crEmail || null } as any })
    }

    const myDepts = gwDeptsForRole(userRole, userClaimDept)
    // Priority chain (CLAIM_GW / SCM_NYG) — resolve once for all items.
    const allApprovers = (userRole === "CLAIM_GW" || userRole === "SCM_NYG")
      ? await (prisma.user as any).findMany({ where: { role: userRole, isActive: true, priority: { not: null }, bu: request.bu }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] })
      : []
    const myPriority = allApprovers.find((u: any) => u.id === userId)?.priority ?? null

    const items = await prisma.airRequestItem.findMany({ where: { requestId: id, id: { in: itemIds as string[] } } })
    let count = 0
    for (const it of items) {
      if (!["PRES_PASSED", "LOG_PASSED"].includes(it.itemStatus)) continue
      const lgDone = (it as any).actualAirFreight != null

      if (userRole === "SCM_NYK_APPROVER" || userRole === "SCM_NYK_EVP") {
        const appr = await (prisma as any).claimApproval.findMany({ where: { itemId: it.id }, include: { user: { select: { role: true } } } })
        const approverDone = appr.some((a: any) => a.role === "SCM_NYK_APPROVER")
        const evpDone = appr.some((a: any) => a.role === "SCM_NYK_EVP")
        if (userRole === "SCM_NYK_APPROVER" && approverDone) continue
        if (userRole === "SCM_NYK_EVP" && (!approverDone || evpDone)) continue
        await (prisma as any).claimApproval.upsert({ where: { itemId_userId: { itemId: it.id, userId } }, create: { itemId: it.id, userId, role: userRole }, update: { createdAt: new Date() } })
        const splitStatus = nykSplitStatus({ approver: approverDone || userRole === "SCM_NYK_APPROVER", evp: evpDone || userRole === "SCM_NYK_EVP", cr: !!crNo })
        const updated = setGwSplitStatus(getSplits(it), ["SCM NYK"], splitStatus, crNo || undefined)
        await prisma.airRequestItem.update({ where: { id: it.id }, data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, lgDone) } })
        count++
      } else {
        if (!hasApprovableGwSplit(it, myDepts)) continue
        // Respect priority order: skip if a lower-priority approver hasn't approved this SO.
        if (myPriority !== null) {
          const lower = allApprovers.filter((u: any) => u.priority !== null && u.priority < myPriority)
          if (lower.length) {
            const done = await (prisma as any).claimApproval.findMany({ where: { itemId: it.id, userId: { in: lower.map((u: any) => u.id) } } })
            if (done.length < lower.length) continue
          }
        }
        await (prisma as any).claimApproval.upsert({ where: { itemId_userId: { itemId: it.id, userId } }, create: { itemId: it.id, userId, role: userRole }, update: { createdAt: new Date() } })
        const allDone = await (prisma as any).claimApproval.findMany({ where: { itemId: it.id, user: { role: userRole } } })
        const approvedIds = new Set(allDone.map((a: any) => a.userId))
        const chainComplete = allApprovers.length === 0 || allApprovers.every((u: any) => approvedIds.has(u.id))
        if (chainComplete) {
          const updated = approveGwDeptSplits(getSplits(it), myDepts)
          await prisma.airRequestItem.update({ where: { id: it.id }, data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, lgDone) } })
        }
        count++
      }
    }
    if (count === 0) return NextResponse.json({ error: "No SO to approve (already handled or not your turn)" }, { status: 400 })

    await prisma.approvalLog.create({ data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `Batch approve ${count} SO — ${userRole}` } })
    if (userRole === "SCM_NYK_APPROVER" && gwNykFirstAssign) await notifyStatusChange(id, "NYK_APPROVER_DONE").catch(() => {})
    const nextDocStatus = await recalcDocStatusGW(id)
    if (nextDocStatus !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
      await notifyStatusChange(id, nextDocStatus).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  if (action === "approve_so_claim_gw" && ["CLAIM_GW", "SCM_NYK_APPROVER", "SCM_NYK_EVP", "SCM_NYG"].includes(userRole)) {
    if (request.bu !== "GW") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (request.status !== "PENDING_CLAIM_GW") return NextResponse.json({ error: "Not in the GW Claim stage" }, { status: 400 })
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const itemData = await prisma.airRequestItem.findUnique({ where: { id: itemId } })
    if (!itemData || itemData.requestId !== id) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    if (!["PRES_PASSED", "LOG_PASSED"].includes(itemData.itemStatus)) return NextResponse.json({ error: "Item already approved" }, { status: 400 })
    const itemLgDone = (itemData as any).actualAirFreight != null

    // ── NYK 3-role sub-flow: APPROVER approves first → then EVP approve ∥ CR entry ──
    if (userRole === "SCM_NYK_APPROVER" || userRole === "SCM_NYK_EVP") {
      const nykApprovals = await (prisma as any).claimApproval.findMany({ where: { itemId }, include: { user: { select: { role: true } } } })
      const approverDone = nykApprovals.some((a: any) => a.role === "SCM_NYK_APPROVER")
      const evpDone = nykApprovals.some((a: any) => a.role === "SCM_NYK_EVP")
      if (userRole === "SCM_NYK_APPROVER" && approverDone) return NextResponse.json({ error: "This SO has already been approved by the SCM NYK Approver" }, { status: 400 })
      if (userRole === "SCM_NYK_EVP") {
        if (!approverDone) return NextResponse.json({ error: "Waiting for the SCM NYK Approver to approve first" }, { status: 400 })
        if (evpDone) return NextResponse.json({ error: "This SO has already been approved by the SCM NYK EVP" }, { status: 400 })
      }
      await (prisma as any).claimApproval.upsert({
        where: { itemId_userId: { itemId, userId } },
        create: { itemId, userId, role: userRole },
        update: { createdAt: new Date() }
      })
      const hasApprover = approverDone || userRole === "SCM_NYK_APPROVER"
      const hasEvp = evpDone || userRole === "SCM_NYK_EVP"
      const crNo = (request as any).crNo || null
      const splitStatus = nykSplitStatus({ approver: hasApprover, evp: hasEvp, cr: !!crNo })
      const updated = setGwSplitStatus(getSplits(itemData), ["SCM NYK"], splitStatus, crNo || undefined)
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, itemLgDone), itemComment: comment || null } })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — SCM NYK ${userRole === "SCM_NYK_APPROVER" ? "Approver" : "EVP"} approved` }
      })
      // Approver picks the specific CR-entry person + VP/EVP approver (one per doc).
      // Alert them only on the FIRST assignment (null → set), not per SO/brand.
      let nykFirstAssignGwSo = false
      if (userRole === "SCM_NYK_APPROVER" && (body.evpEmail || body.crEmail)) {
        const cur = await (prisma.airRequest as any).findUnique({ where: { id }, select: { assignedScmNykEvp: true, assignedScmNykCr: true, scmNykEvpToken: true, scmNykToken: true } })
        nykFirstAssignGwSo = (!!body.evpEmail && !cur?.assignedScmNykEvp) || (!!body.crEmail && !cur?.assignedScmNykCr)
        await prisma.airRequest.update({
          where: { id },
          data: {
            assignedScmNykEvp: body.evpEmail || null,
            assignedScmNykCr: body.crEmail || null,
            ...(body.evpEmail && !cur?.scmNykEvpToken ? { scmNykEvpToken: crypto.randomUUID() } : {}),
            ...(body.crEmail && !cur?.scmNykToken ? { scmNykToken: crypto.randomUUID() } : {}),
          } as any,
        })
      }
      // Approver's approval → alert the chosen EVP + CR user (once, with LG data).
      if (userRole === "SCM_NYK_APPROVER" && nykFirstAssignGwSo) await notifyStatusChange(id, "NYK_APPROVER_DONE").catch(() => {})
      const nextDocStatus = await recalcDocStatusGW(id)
      if (nextDocStatus !== request.status) {
        await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
        await notifyStatusChange(id, nextDocStatus).catch(() => {})
      }
      return NextResponse.json(await getUpdated())
    }

    // Scope CLAIM_GW to its own dept (GW vs SUPPLIER) via the user's claimDepartment.
    const myDepts = gwDeptsForRole(userRole, userClaimDept)
    // SCM NYK can approve/accept WITHOUT a CR number (added later); guard only
    // against re-approving an already-accepted/finalized split.
    if (!hasApprovableGwSplit(itemData, myDepts)) {
      return NextResponse.json({ error: "No claim portion for this department awaiting approval" }, { status: 400 })
    }

    // Priority chain for this role (scoped to the doc's BU — SCM roles exist in both).
    const allApprovers = await (prisma.user as any).findMany({
      where: { role: userRole, isActive: true, priority: { not: null }, bu: request.bu },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
    })
    const currentUser = allApprovers.find((u: any) => u.id === userId)
    const myPriority = currentUser?.priority ?? null
    if (myPriority !== null) {
      const lowerUsers = allApprovers.filter((u: any) => u.priority !== null && u.priority < myPriority)
      if (lowerUsers.length > 0) {
        const done = await (prisma as any).claimApproval.findMany({ where: { itemId, userId: { in: lowerUsers.map((u: any) => u.id) } } })
        if (done.length < lowerUsers.length) {
          const nextUser = allApprovers.find((u: any) => u.priority !== null && u.priority < myPriority && !done.some((d: any) => d.userId === u.id))
          return NextResponse.json({ error: `Must wait for the previous approver in the priority order (Priority ${nextUser?.priority}: ${nextUser?.name})` }, { status: 400 })
        }
      }
    }

    await (prisma as any).claimApproval.upsert({
      where: { itemId_userId: { itemId, userId } },
      create: { itemId, userId, role: userRole },
      update: { createdAt: new Date() }
    })

    // Has this role's whole priority chain now approved?
    const allDone = await (prisma as any).claimApproval.findMany({ where: { itemId, user: { role: userRole } } })
    const approvedIds = new Set(allDone.map((a: any) => a.userId))
    const chainComplete = allApprovers.length === 0 || allApprovers.every((u: any) => approvedIds.has(u.id))

    if (chainComplete) {
      // CLAIM_GW / SCM_NYG → approve their split directly.
      const updated = approveGwDeptSplits(getSplits(itemData), myDepts)
      await prisma.airRequestItem.update({
        where: { id: itemId },
        data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, itemLgDone), itemComment: comment || null },
      })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — ${myDepts.join("/")} approved` }
      })
      const nextDocStatus = await recalcDocStatusGW(id)
      if (nextDocStatus !== request.status) {
        await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
        await notifyStatusChange(id, nextDocStatus).catch(() => {})
      }
    } else {
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — Approved (Priority ${myPriority ?? "–"})` }
      })
      // Auto-cascade to the next priority level (no manual forward) — runs the
      // chain forward until the last priority, which finalizes the split above.
      if (myPriority !== null) {
        notifyClaimNextPriority(id, userRole, userClaimDept, myPriority, myDepts[0]).catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // ── FINISH (per-dept forward model) ────────────────────────────────
  // A claim department (owner role or a forwarded CLAIM_NEXT_APPROVER) finalizes
  // ITS OWN splits across the doc. Other departments are untouched (parallel,
  // independent). Works for both BU. SCM NYK keeps its own CR flow (excluded).
  if (action === "finalize_claim_dept" && heldRoles.some(r => ["CLAIM_GW", "SCM_NYG", "CLAIM_COMMERCIAL", "CLAIM_PRODUCTION", "CLAIM_PROCUREMENT", "CLAIM_NEXT_APPROVER"].includes(r))) {
    const isGW = request.bu === "GW"
    const expected = isGW ? ["PENDING_CLAIM_GW"] : ["PENDING_CLAIM", "PENDING_VP_CLAIM"]
    if (!expected.includes(request.status)) return NextResponse.json({ error: "Not in the Claim stage" }, { status: 400 })

    // Which department does this actor own + their position in the chain?
    let dept: string | null = null
    let currentPos = 0
    let ownerRow: any = null
    if (userRole === "CLAIM_NEXT_APPROVER") {
      const email = session.user?.email || ""
      const tok = (session.user as any).claimNextToken || null
      ownerRow = tok
        ? await (prisma as any).claimForward.findFirst({ where: { requestId: id, token: tok } })
        : (email ? await (prisma as any).claimForward.findFirst({ where: { requestId: id, nextEmail: email } }) : null)
      if (!ownerRow) return NextResponse.json({ error: "You are not the current approver for any department on this document" }, { status: 403 })
      dept = ownerRow.dept
      currentPos = ownerRow.position ?? 0
    } else {
      dept = ownerCanonicalDept(userRole, userClaimDept)
      if (!dept) {
        // Multi-role: the primary role isn't a claim role, but one in roles[] may be.
        // Pick the held claim dept that still has a pending split on THIS document.
        for (const r of heldRoles) {
          const d = ownerCanonicalDept(r, userClaimDept)
          if (d && (request.items as any[]).some((it: any) => itemHasPendingDept(it, d))) { dept = d; break }
        }
      }
    }
    if (!dept) return NextResponse.json({ error: "Cannot determine your claim department" }, { status: 400 })
    // Forced chain: only the LAST position may finish. Earlier positions must
    // forward to the next position first (GW / SUPPLIER are single-position → ok).
    if (!isLastPosition(dept, currentPos)) {
      return NextResponse.json({ error: "You must forward to the next position — only the final position can finish the process." }, { status: 400 })
    }
    const splitDepts = expandClaimDept(dept)
    const doneStatus = isGW ? GW_DEPT_APPROVED : NYG_SPLIT.COMPLETED

    const items = await prisma.airRequestItem.findMany({ where: { requestId: id } })
    // SO ids this actor owns (their forward row's items, or — for the entry owner —
    // dept-pending SO not already forwarded to a later position).
    const deptPendingIds: string[] = items.filter((it: any) => itemHasPendingDept(it, dept!)).map((it: any) => it.id)
    let ownedIds: string[]
    if (ownerRow) {
      ownedIds = Array.isArray(ownerRow.itemIds) && ownerRow.itemIds.length
        ? (ownerRow.itemIds as string[]).filter((x) => deptPendingIds.includes(x))
        : deptPendingIds
    } else {
      const rows = await (prisma as any).claimForward.findMany({ where: { requestId: id, dept } })
      const covered = new Set<string>(rows.flatMap((r: any) => (Array.isArray(r.itemIds) ? r.itemIds : [])))
      ownedIds = deptPendingIds.filter((x) => !covered.has(x))
    }
    const selIds: string[] = (Array.isArray(itemIds) && itemIds.length)
      ? (itemIds as string[]).filter((x) => ownedIds.includes(x))
      : ownedIds
    if (selIds.length === 0) return NextResponse.json({ error: "No pending SO for your department" }, { status: 400 })

    let count = 0
    for (const it of items) {
      if (!selIds.includes(it.id) || !itemHasPendingDept(it, dept)) continue
      const updated = approveGwDeptSplits(getSplits(it), splitDepts, undefined, doneStatus)
      const itemStatus = isGW ? deriveGwItemStatus(updated, (it as any).actualAirFreight != null) : deriveNygItemStatus(updated, (it as any).actualAirFreight != null)
      await prisma.airRequestItem.update({ where: { id: it.id }, data: { claimDepts: updated as any, itemStatus, itemComment: comment || (it as any).itemComment } })
      count++
    }
    if (count === 0) return NextResponse.json({ error: "No pending SO for your department" }, { status: 400 })
    // Clear finalized SO from this actor's row (keep the row + token so their
    // magic link still works as a view-only login after they're done).
    if (ownerRow) {
      const remaining = ownedIds.filter((x) => !selIds.includes(x))
      await (prisma as any).claimForward.update({ where: { id: ownerRow.id }, data: { itemIds: remaining } }).catch(() => {})
    }
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `Claim ${dept} finalized ${count} SO` }
    })
    const next = isGW ? await recalcDocStatusGW(id) : await recalcDocStatus(id)
    if (next !== request.status) {
      await prisma.airRequest.update({ where: { id }, data: { status: next } })
      await notifyStatusChange(id, next).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // Forced-position claim: a forwarded approver sends the SO BACK to the previous
  // position (e.g. Commercial VP → DPM/DVM). Removes their forward row so ownership
  // returns to the prior holder (or the entry owner) + re-alerts them.
  if (action === "claim_back_to_prev" && userRole === "CLAIM_NEXT_APPROVER") {
    if (!comment) return NextResponse.json({ error: "Please provide a reason before sending back" }, { status: 400 })
    const email = session.user?.email || ""
    const tok = (session.user as any).claimNextToken || null
    const ownerRow = tok
      ? await (prisma as any).claimForward.findFirst({ where: { requestId: id, token: tok } })
      : (email ? await (prisma as any).claimForward.findFirst({ where: { requestId: id, nextEmail: email } }) : null)
    if (!ownerRow) return NextResponse.json({ error: "You are not the current approver for any department here" }, { status: 403 })
    const dept = ownerRow.dept
    const items = await prisma.airRequestItem.findMany({ where: { requestId: id } })
    const deptPendingIds = items.filter((it: any) => itemHasPendingDept(it, dept)).map((it: any) => it.id)
    const myIds = Array.isArray(ownerRow.itemIds) && ownerRow.itemIds.length
      ? (ownerRow.itemIds as string[]).filter((x) => deptPendingIds.includes(x))
      : deptPendingIds
    const selIds = Array.isArray(itemIds) && itemIds.length ? (itemIds as string[]).filter((x) => myIds.includes(x)) : myIds
    if (!selIds.length) return NextResponse.json({ error: "No SO to send back" }, { status: 400 })
    // Drop the sent-back SO from my forward row.
    const remaining = (Array.isArray(ownerRow.itemIds) ? ownerRow.itemIds : []).filter((x: string) => !selIds.includes(x))
    await (prisma as any).claimForward.update({ where: { id: ownerRow.id }, data: { itemIds: remaining } })
    // Previous holder = highest-position forward row below mine (else the entry owner).
    const rows = await (prisma as any).claimForward.findMany({ where: { requestId: id, dept } })
    const prior = rows
      .filter((r: any) => r.id !== ownerRow.id && (r.position ?? 0) < (ownerRow.position ?? 0))
      .sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0))[0]
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "BACK", fromStatus: request.status, toStatus: request.status, comment: `Claim ${dept} sent back to previous: ${comment}` }
    })
    if (prior) {
      const priorIds = Array.from(new Set([...(Array.isArray(prior.itemIds) ? prior.itemIds : []), ...selIds]))
      await (prisma as any).claimForward.update({ where: { id: prior.id }, data: { itemIds: priorIds } })
      await notifyClaimNext(id, prior.nextEmail, prior.nextName || prior.nextEmail, (session.user as any).name || "", prior.token, `${dept} — sent back (${selIds.length} SO)`).catch(() => {})
    } else {
      // Back to the entry owner (position 0) — they regain the SO in their queue.
      await notifyClaimEntry(id, dept).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // Per-SO claim/VP approval with priority-based sequential logic
  if (action === "approve_so" || action === "reject_so") {
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    if (request.status === "COMPLETED" || request.status === "REJECTED") {
      return NextResponse.json({ error: "The document is closed and cannot be approved" }, { status: 400 })
    }
    const itemData = await prisma.airRequestItem.findUnique({ where: { id: itemId } })
    if (!itemData) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    if (action === "reject_so") {
      // Reject the whole SO — mark every split rejected so split state stays in sync.
      const rejectedSplits = getSplits(itemData).map(s => ({ ...s, status: "REJECTED" }))
      await prisma.airRequestItem.update({
        where: { id: itemId },
        data: { itemStatus: "REJECTED", itemComment: comment || null, ...(rejectedSplits.length ? { claimDepts: rejectedSplits as any } : {}) },
      })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "REJECT", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so}${comment ? ` - ${comment}` : ""}` }
      })
      const newStatus = await recalcDocStatus(id)
      if (newStatus !== request.status) await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
      return NextResponse.json(await getUpdated())
    }

    // ── NYG SCM NYK dept uses the same 3-role sub-flow as GW (Approver → EVP + CR) ──
    if (userRole === "SCM_NYK_APPROVER" || userRole === "SCM_NYK_EVP") {
      if (!getSplits(itemData).some(s => s.dept === "NYK")) {
        return NextResponse.json({ error: "This SO has no SCM NYK claim portion" }, { status: 400 })
      }
      const nykApprovals = await (prisma as any).claimApproval.findMany({ where: { itemId }, include: { user: { select: { role: true } } } })
      const approverDone = nykApprovals.some((a: any) => a.role === "SCM_NYK_APPROVER")
      const evpDone = nykApprovals.some((a: any) => a.role === "SCM_NYK_EVP")
      if (userRole === "SCM_NYK_APPROVER" && approverDone) return NextResponse.json({ error: "This SO has already been approved by the SCM NYK Approver" }, { status: 400 })
      if (userRole === "SCM_NYK_EVP") {
        if (!approverDone) return NextResponse.json({ error: "Waiting for the SCM NYK Approver to approve first" }, { status: 400 })
        if (evpDone) return NextResponse.json({ error: "This SO has already been approved by the SCM NYK EVP" }, { status: 400 })
      }
      await (prisma as any).claimApproval.upsert({
        where: { itemId_userId: { itemId, userId } },
        create: { itemId, userId, role: userRole },
        update: { createdAt: new Date() }
      })
      const hasApprover = approverDone || userRole === "SCM_NYK_APPROVER"
      const hasEvp = evpDone || userRole === "SCM_NYK_EVP"
      const crNo = (request as any).crNo || null
      const splitStatus = nykSplitStatus({ approver: hasApprover, evp: hasEvp, cr: !!crNo }, "COMPLETED")
      const updated = setGwSplitStatus(getSplits(itemData), ["NYK"], splitStatus, crNo || undefined)
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { claimDepts: updated as any, itemStatus: deriveNygItemStatus(updated, itemData.actualAirFreight != null), itemComment: comment || null } })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — SCM NYK ${userRole === "SCM_NYK_APPROVER" ? "Approver" : "EVP"} approved` }
      })
      let nykFirstAssign = false
      if (userRole === "SCM_NYK_APPROVER" && (body.evpEmail || body.crEmail)) {
        // Store the chosen people + a UNIQUE magic-login token each, so their email
        // link logs in AS them (via assignedScmNyk* in auth) — not as whoever's already
        // logged in. Tokens are created ONCE (first SO approved); later SOs reuse them,
        // so EVP/CR are emailed a single time (not once per SO).
        const cur = await prisma.airRequest.findUnique({ where: { id }, select: { scmNykEvpToken: true, scmNykToken: true } as any })
        const setEvp = !!body.evpEmail && !(cur as any)?.scmNykEvpToken
        const setCr = !!body.crEmail && !(cur as any)?.scmNykToken
        nykFirstAssign = setEvp || setCr
        await prisma.airRequest.update({
          where: { id },
          data: {
            assignedScmNykEvp: body.evpEmail || null,
            assignedScmNykCr: body.crEmail || null,
            ...(setEvp ? { scmNykEvpToken: crypto.randomUUID() } : {}),
            ...(setCr ? { scmNykToken: crypto.randomUUID() } : {}),
          } as any,
        })
      }
      // Alert EVP + CR user ONCE — when the assignment is first made, not per SO.
      if (userRole === "SCM_NYK_APPROVER" && nykFirstAssign) await notifyStatusChange(id, "NYK_APPROVER_DONE").catch(() => {})
      const newStatus = await recalcDocStatus(id)
      if (newStatus !== request.status) {
        await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
        await notifyStatusChange(id, newStatus).catch(() => {})
      }
      return NextResponse.json(await getUpdated())
    }

    // Determine which claim dept + step this user acts on for THIS SO. Forward-direction
    // (dept → approver roles via claimEntryRoles/claimVpRoles) so a person holding several
    // roles is matched correctly, AND special mappings work (e.g. COMMERCIAL → DVM MER / VP MER).
    const itemSplits = getSplits(itemData)
    const acting = actingClaimForSO([userRole, ...heldRoles], itemSplits.map(s => s.dept))
    if (!acting) return NextResponse.json({ error: "Your department is not part of the claim for this SO" }, { status: 403 })
    const dept = acting.dept
    const actingIsVp = acting.isVp
    // Everyone who can act at this step for this dept, matched on role OR roles[].
    const groupRoles = actingIsVp ? claimVpRoles(dept) : claimEntryRoles(dept)
    const groupWhere: any = { OR: [{ role: { in: groupRoles } }, { roles: { hasSome: groupRoles } }] }
    const actingRole = [userRole, ...heldRoles].find((r: string) => groupRoles.includes(r)) || userRole

    // Guard: this approver's department must be one of the item's claim splits.
    if (itemSplits.length > 0 && !itemSplits.some(s => s.dept === dept)) {
      return NextResponse.json({ error: "Your department is not part of the claim for this SO" }, { status: 403 })
    }

    // Get all active approvers at this step with priority set (no priority = excluded).
    const allApprovers = await (prisma.user as any).findMany({
      where: { ...groupWhere, isActive: true, priority: { not: null } },
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
          return NextResponse.json({ error: `Must wait for the previous approver in the priority order (Priority ${nextUser?.priority}: ${nextUser?.name})` }, { status: 400 })
        }
      }
    }

    // Record this approval (recorded as the acting claim role)
    await (prisma as any).claimApproval.upsert({
      where: { itemId_userId: { itemId, userId } },
      create: { itemId, userId, role: actingRole },
      update: { createdAt: new Date() }
    })

    // Check if ALL approvers in this group have now approved
    const allDone = await (prisma as any).claimApproval.findMany({
      where: { itemId, user: groupWhere }
    })
    const approvedIds = new Set(allDone.map((a: any) => a.userId))
    const everyoneApproved = allApprovers.every((u: any) => approvedIds.has(u.id))

    if (everyoneApproved) {
      // Per-split: mark only THIS department's split (DVM done → CLAIM_PASSED, VP done → COMPLETED).
      // The item advances only when every split's department has cleared this level.
      // After the entry (DVM/DPM) priority chain finishes: if a SEPARATE VP approver
      // exists for this dept (role VP_<dept>), advance to the VP stage (CLAIM_PASSED);
      // otherwise this dept uses ONE CLAIM_<dept> priority chain where the top priority
      // IS the VP — so the claim is fully done (COMPLETED). VP-role approvals always
      // complete. This auto-supports both "priority-levels" and "separate VP role" setups.
      let splitStatus: string
      if (actingIsVp) splitStatus = "COMPLETED"
      else {
        const vpRoles = claimVpRoles(dept)
        const vpExists = await (prisma.user as any).count({
          where: { isActive: true, priority: { not: null }, OR: [{ role: { in: vpRoles } }, { roles: { hasSome: vpRoles } }] },
        }) > 0
        splitStatus = vpExists ? "CLAIM_PASSED" : "COMPLETED"
      }
      const updatedSplits = setDeptSplitStatus(getSplits(itemData), dept, splitStatus)
      const newItemStatus = deriveNygItemStatus(updatedSplits, itemData.actualAirFreight != null)
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { claimDepts: updatedSplits as any, itemStatus: newItemStatus, itemComment: comment || null } })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — All ${dept}${actingIsVp ? " VP" : ""} approved${comment ? ` - ${comment}` : ""}` }
      })
      const newStatus = await recalcDocStatus(id)
      if (newStatus !== request.status) {
        await prisma.airRequest.update({ where: { id }, data: { status: newStatus } })
        await notifyStatusChange(id, newStatus).catch(() => {})
      }
    } else {
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — Approved (Priority ${myPriority ?? "–"})${comment ? ` - ${comment}` : ""}` }
      })
      // Auto-cascade (like GW): once THIS priority has approved ALL of its dept SO,
      // email the NEXT priority level automatically (no manual forward). Guarded so
      // it fires once per priority, not once per SO.
      if (myPriority != null) {
        const gate = actingIsVp ? "CLAIM_PASSED" : "LOG_PASSED"
        const gateItems = await prisma.airRequestItem.findMany({ where: { requestId: id, itemStatus: gate } })
        const mine = await (prisma as any).claimApproval.findMany({ where: { userId, item: { requestId: id } }, select: { itemId: true } })
        const mineIds = new Set(mine.map((a: any) => a.itemId))
        const remaining = gateItems.filter((it: any) => getSplits(it).some((s: any) => s.dept === dept) && !mineIds.has(it.id))
        if (remaining.length === 0) {
          await notifyClaimNextPriority(id, groupRoles, null, myPriority, dept).catch(() => {})
        }
      }
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
    await notifyStatusChange(id, upd.status).catch(() => {})
  }

  return NextResponse.json(await getUpdated())
}
