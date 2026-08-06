import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NEXT_STATUS, STYLE_APPROVER_STATUSES, CLAIM_VP_ROLES } from "@/types"
import { notifyStatusChange, notifyClaimNextPriority, notifyLgFilesToClaimers, notifyClaimNext, notifyClaimEntry, notifyRejectionForward, notifyRejectionToCreator, notifyBackToMerGw, notifyLgRejectFyi, notifyRecall, notifyGwClaimNyk } from "@/lib/notify"
import { captureApprovalSignature, SIG_APPROVE_ACTIONS, isSignatureData } from "@/lib/signature"
import { getSplits, deriveGwItemStatus, setDeptSplitStatus, deriveNygItemStatus, gwDeptsForRole, hasPendingGwSplit, hasApprovableGwSplit, approveGwDeptSplits, GW_DEPT_APPROVED, nykSplitStatus, setGwSplitStatus, ownerCanonicalDept, expandClaimDept, itemHasPendingDept, NYG_SPLIT, SPLIT_STATUS, isLastPosition, actingClaimForSO, claimEntryRoles, claimVpRoles } from "@/lib/claim"
import { recomputeRequestFreight } from "@/lib/freight"
import { buildRequestItems } from "@/lib/build-items"

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

// NYK claim is split BY BRAND across the SCM NYK Approvers (2 people). We must NOT
// forward the document to the EVP (k.wallop) + CR user (benjamat) until EVERY
// non-rejected NYK-split SO in the document has been approved by the Approver level.
// This lets the EVP/CR alert fire ONCE — after all brands are approved — not per SO.
// Works for both NYG (dept "NYK") and GW (dept "SCM NYK").
async function allNykApproverApproved(reqId: string): Promise<boolean> {
  const items = await prisma.airRequestItem.findMany({
    where: { requestId: reqId },
    include: { claimApprovals: { select: { role: true } } },
  })
  const nykSOs = items.filter(it =>
    it.itemStatus !== "REJECTED" &&
    getSplits(it).some((s: any) => (s.dept === "NYK" || s.dept === "SCM NYK") && s.status !== "REJECTED"))
  if (nykSOs.length === 0) return false
  return nykSOs.every(it => ((it as any).claimApprovals || []).some((a: any) => a.role === "SCM_NYK_APPROVER"))
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
    const { action, comment, style, itemId, itemIds, claimDepartment, gwClaimDept, logisticsData, itemActuals, soClaimData, soClaimComments, soDvmData, itemLogistics, assignedVpScm, assignedVp } = body

  const request = await prisma.airRequest.findUnique({ where: { id }, include: { items: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // "NYK Direct" GW imports skip the President step — a fully-approved claim jumps straight to
  // Accounting. Passed into deriveGwItemStatus at every GW-claim completion site below.
  const skipPres = !!(request as any).nykDirect
  // A subordinate this doc was forwarded to (LG handoff) may do the SAME Logistics data-entry
  // as an LG actor, but only for THIS doc (matched by email → request.lgForwardEmail).
  const isFwdTarget = !!(request as any).lgForwardEmail && String((session.user as any).email || "").toLowerCase() === String((request as any).lgForwardEmail).toLowerCase()

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

  // RECALL — the creator (MER) or Admin / Jariya pulls a document back to Merchandise to
  // edit + resubmit. The creator may recall ONLY while it is still in early merch review —
  // before VP MER (NYG/EA) / GM (GW) approves; once it has passed that point they must ask
  // the current approver to reject it. Admin / Jariya may recall at any stage (incl. finished).
  if (action === "recall") {
    const email = String((session.user as any).email || "").toLowerCase()
    const isAdminRecaller = userRole === "ADMIN" || email === "jariya.t@nanyangtextile.com"
    const isRecaller = isAdminRecaller || request.createdById === userId
    if (!isRecaller) return NextResponse.json({ error: "You are not allowed to recall this document" }, { status: 403 })
    // Statuses the CREATOR may still recall from — the merch-review window before VP MER / GM approves.
    const MER_RECALL_WINDOW = ["PENDING_DVM_MER", "PENDING_VP_MER", "PENDING_DVM_MER_EA", "PENDING_VP_MER_EA", "PENDING_DVM_MER_TRM", "PENDING_VP_MER_TRM", "PENDING_VP_MER_GW", "PENDING_GM_GW"]
    if (isAdminRecaller) {
      // At-MER / draft = nothing to pull back; everything else (incl. COMPLETED / REJECTED) is fine.
      if (["PENDING_MER", "PENDING_MER_GW", "DRAFT"].includes(request.status)) {
        return NextResponse.json({ error: `Cannot recall a document at status ${request.status}` }, { status: 400 })
      }
    } else if (!MER_RECALL_WINDOW.includes(request.status)) {
      return NextResponse.json({ error: `Cannot recall — the document has passed Merchandise review (status ${request.status}). Please ask the current approver to reject it.` }, { status: 400 })
    }
    // Alert the CURRENT holder(s) + FYI prior approvers + confirm to creator — BEFORE the
    // status changes, so the resolver still sees who currently holds it.
    await notifyRecall(id, (session.user as any).name || email || undefined, comment || undefined).catch(() => {})
    const backStatus = request.bu === "GW" ? "PENDING_MER_GW" : "PENDING_MER"
    // Clear the in-flight state so the resubmitted flow starts clean.
    await (prisma as any).claimForward.deleteMany({ where: { requestId: id } })
    await (prisma as any).approvalSignature.deleteMany({ where: { requestId: id } })
    await (prisma as any).claimApproval.deleteMany({ where: { item: { requestId: id } } })
    await (prisma as any).hawbGroup.deleteMany({ where: { requestId: id } })
    for (const it of request.items as any[]) {
      const splits = Array.isArray(it.claimDepts)
        ? (it.claimDepts as any[]).map((s: any) => ({ dept: s.dept, pct: s.pct, reason: s.reason ?? null }))
        : it.claimDepts
      await prisma.airRequestItem.update({
        where: { id: it.id },
        data: {
          itemStatus: it.itemStatus === "REJECTED" ? "REJECTED" : "PENDING",
          actualAirFreight: null, invoiceNo: null, hawbNo: null, bookingDate: null, qtyActualShip: null, hawbGroupId: null,
          claimDepts: splits as any,
        },
      })
    }
    await prisma.airRequest.update({
      where: { id },
      data: {
        status: backStatus, logisticsSent: false, crNo: null,
        claimNextEmail: null, claimNextToken: null, claimNextName: null,
        rejectionReason: comment ? `Recalled: ${comment}` : null,
      },
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "RECALL", fromStatus: request.status, toStatus: backStatus, comment: `Recalled${comment ? `: ${comment}` : ""}` },
    })
    return NextResponse.json(await getUpdated())
  }

  // EDIT ITEMS — the creator / MER edits SO rows while the document sits back at Merchandise
  // (PENDING_MER / PENDING_MER_GW, after a recall or an SCM/DPM send-back), then resubmits.
  // Editable: NYG/EA → style, original ship date, qty original, factory, country.
  //           GW      → the above + per-SO claim dept / % / reason (splits must total 100).
  if (action === "edit_items") {
    const email = String((session.user as any).email || "").toLowerCase()
    const isAdmin = userRole === "ADMIN" || email === "jariya.t@nanyangtextile.com"
    const isMerRole = ["MER_USER", "MER_EA", "MER_GW", "MER_TRM"].includes(userRole)
    const canEdit = ["PENDING_MER", "PENDING_MER_GW"].includes(request.status)
      && (isAdmin || isMerRole || request.createdById === userId)
    if (!canEdit) return NextResponse.json({ error: "You cannot edit this document now" }, { status: 403 })
    const isGW = request.bu === "GW"
    const edits: any[] = Array.isArray(body.edits) ? body.edits : []
    const byId = new Map((request.items as any[]).map((it: any) => [it.id, it]))
    // GW template short labels → canonical dept values the app matches on.
    const normGwDept = (raw: string) => {
      const s = String(raw || "").trim()
      const u = s.toUpperCase()
      if (u === "NYK") return "SCM NYK"
      if (u === "NYG") return "SCM NYG"
      return s
    }
    for (const e of edits) {
      const cur = byId.get(e.itemId)
      if (!cur) continue
      const data: any = {}
      if (typeof e.style === "string") data.style = e.style.trim()
      if (typeof e.factory === "string") data.factory = e.factory.trim()
      if (typeof e.country === "string") data.country = e.country.trim()
      if (e.originalShipmentDate !== undefined) {
        const d = e.originalShipmentDate ? new Date(e.originalShipmentDate) : null
        data.originalShipmentDate = d && !isNaN(d.getTime()) ? d : null
      }
      if (e.qtyOriginalShipment !== undefined && e.qtyOriginalShipment !== null && String(e.qtyOriginalShipment) !== "") {
        const q = Number(String(e.qtyOriginalShipment).replace(/,/g, ""))
        if (!isNaN(q) && q >= 0) data.qtyOriginalShipment = Math.round(q)
      }
      if (isGW && Array.isArray(e.claimDepts)) {
        const splits = e.claimDepts
          .map((s: any) => ({ dept: normGwDept(s.dept), pct: Number(s.pct) || 0, reason: (s.reason ?? "").toString().trim() || null }))
          .filter((s: any) => s.dept)
        const sum = splits.reduce((a: number, s: any) => a + (Number(s.pct) || 0), 0)
        if (splits.length && Math.round(sum) !== 100) {
          return NextResponse.json({ error: `SO ${cur.so || cur.style}: claim % ต้องรวมได้ 100 (ตอนนี้ ${sum})` }, { status: 400 })
        }
        if (splits.length) {
          data.claimDepts = splits as any
          data.claimDepartment = splits[0].dept
          data.claimPercentage = splits[0].pct || null
        }
      }
      if (Object.keys(data).length) {
        await prisma.airRequestItem.update({ where: { id: e.itemId }, data })
      }
    }
    // Gross / Est. Air Freight depend on qty original + country → recompute the whole doc.
    await recomputeRequestFreight(id).catch(() => {})
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "EDIT_ITEMS", fromStatus: request.status, toStatus: request.status, comment: `Edited ${edits.length} SO(s) before resubmit` },
    }).catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // REPLACE ITEMS — the creator / MER re-uploads a corrected Excel file while the document sits
  // back at Merchandise (PENDING_MER / PENDING_MER_GW). All existing SO rows are deleted and
  // rebuilt from the new file (same mapping/validation as a fresh upload), then they resubmit.
  if (action === "replace_items") {
    const email = String((session.user as any).email || "").toLowerCase()
    const isAdmin = userRole === "ADMIN" || email === "jariya.t@nanyangtextile.com"
    const isMerRole = ["MER_USER", "MER_EA", "MER_GW", "MER_TRM"].includes(userRole)
    const canEdit = ["PENDING_MER", "PENDING_MER_GW"].includes(request.status)
      && (isAdmin || isMerRole || request.createdById === userId)
    if (!canEdit) return NextResponse.json({ error: "You cannot replace this document's data now" }, { status: 403 })
    const rows: any[] = Array.isArray(body.rows) ? body.rows : []
    if (!rows.length) return NextResponse.json({ error: "No rows in the uploaded file" }, { status: 400 })
    const isGW = request.bu === "GW"
    const isEA = request.bu === "EA"
    const { items: built, missingRates, missingDescriptions } = await buildRequestItems(rows, { isGW, isEA })
    // Wipe the old rows + any per-item claim state, then recreate from the new file.
    await (prisma as any).claimApproval.deleteMany({ where: { item: { requestId: id } } })
    await (prisma as any).claimForward.deleteMany({ where: { requestId: id } })
    await (prisma as any).hawbGroup.deleteMany({ where: { requestId: id } })
    await prisma.airRequestItem.deleteMany({ where: { requestId: id } })
    await prisma.airRequestItem.createMany({ data: built.map((b: any) => ({ ...b, requestId: id })) })
    await prisma.airRequest.update({
      where: { id },
      data: {
        brandName: String(built[0]?.brand || request.brandName || ""),
        pendingRate: missingRates.length > 0,
        pendingWeight: missingDescriptions.length > 0,
      },
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "REPLACE_ITEMS", fromStatus: request.status, toStatus: request.status, comment: `Re-uploaded file → replaced with ${built.length} SO(s)` },
    }).catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // LG saves logistics data as draft at PENDING_SCM (parallel with SCM — no status change).
  // TRM logistics (Urairat = LOGISTICS_TRM in roles[]) uses the SAME NYG-style flow → accept it too,
  // but only for non-GW docs so her GW logistics still routes to the LOGISTICS_GW branch below.
  if (action === "save_logistics_draft" && (userRole === "LOGISTICS" || (heldRoles.includes("LOGISTICS_TRM") && request.bu !== "GW") || (isFwdTarget && request.bu !== "GW") || (userRole === "ADMIN" && request.bu !== "GW"))) {
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
    // Logistics fills the QTY Air / Plan Ship Date that Merchandise left blank at upload.
    // After updating QTY, recompute Gross + Est. Air Freight for the whole request.
    if (body.itemShipData && typeof body.itemShipData === "object") {
      let qtyChanged = false
      for (const [iid, val] of Object.entries(body.itemShipData)) {
        const d = val as any
        const upd: any = {}
        if (d.qtyRequestAir != null && String(d.qtyRequestAir).trim() !== "") {
          const q = Number(String(d.qtyRequestAir).replace(/,/g, ""))
          if (!isNaN(q)) { upd.qtyRequestAir = q; qtyChanged = true }
        }
        if (d.planShipmentDate) upd.planShipmentDate = new Date(d.planShipmentDate)
        if (Object.keys(upd).length) await prisma.airRequestItem.update({ where: { id: iid }, data: upd })
      }
      if (qtyChanged) await recomputeRequestFreight(id).catch(() => {})
    }
    // Save DRAFT = save data ONLY. No status change, no advancement, no email — nothing goes
    // out. Everything below runs ONLY on "Save & Send" (body.lgComplete).
    if (body.lgComplete) {
      // LG runs in PARALLEL with Claim. Now that Actual is entered, re-derive any item whose
      // claim is fully approved so it can advance to President (needs claim done AND Actual in).
      const nygItems = await prisma.airRequestItem.findMany({ where: { requestId: id } })
      for (const it of nygItems) {
        if (!["LOG_PASSED", "CLAIM_PASSED"].includes(it.itemStatus)) continue
        const ns = deriveNygItemStatus(getSplits(it), true)
        if (ns !== it.itemStatus) await prisma.airRequestItem.update({ where: { id: it.id }, data: { itemStatus: ns } })
      }
      const nd = await recalcDocStatus(id)
      if (nd !== request.status) {
        await prisma.airRequest.update({ where: { id }, data: { status: nd } })
        await notifyStatusChange(id, nd).catch(() => {})
      }
      // Mark LG as sent (chip turns green only now) + email the claimers the files + signed PDF.
      await (prisma.airRequest as any).update({ where: { id }, data: { logisticsSent: true } }).catch(() => {})
      await notifyLgFilesToClaimers(id).catch(() => {})
      await notifyGwClaimNyk(id).catch(() => {}) // LG done (INV+Actual in) → NOW alert SCM NYK claim
    }
    return NextResponse.json(await getUpdated())
  }

  // GW LG "Save Draft" — save the same LG data (Actual / INV / HAWB / Ship Date / QTY by SO)
  // WITHOUT changing status or running the NYG-specific advancement. GW uses its own item
  // statuses, so it must not go through the LOGISTICS (NYG) draft handler above.
  if (action === "save_logistics_draft" && (userRole === "LOGISTICS_GW" || (isFwdTarget && request.bu === "GW") || (userRole === "ADMIN" && request.bu === "GW"))) {
    if (itemActuals && typeof itemActuals === "object") {
      for (const [iid, val] of Object.entries(itemActuals)) {
        const num = parseFloat(String(val))
        if (!isNaN(num)) await prisma.airRequestItem.update({ where: { id: iid }, data: { actualAirFreight: num } })
      }
    }
    if (itemLogistics && typeof itemLogistics === "object") {
      for (const [iid, data] of Object.entries(itemLogistics)) {
        const d = data as any
        await prisma.airRequestItem.update({ where: { id: iid }, data: { invoiceNo: d.invoiceNo || null, bookingDate: d.bookingDate ? new Date(d.bookingDate) : null } })
        if (d.hawbNo !== undefined) {
          try { await prisma.airRequestItem.update({ where: { id: iid }, data: { hawbNo: d.hawbNo || null } as any }) } catch { /* hawbNo not in client */ }
        }
      }
    }
    // Logistics fills the QTY Air / Plan Ship Date (by SO) that Merchandise left blank at upload.
    if (body.itemShipData && typeof body.itemShipData === "object") {
      let qtyChanged = false
      for (const [iid, val] of Object.entries(body.itemShipData)) {
        const d = val as any
        const upd: any = {}
        if (d.qtyRequestAir != null && String(d.qtyRequestAir).trim() !== "") {
          const q = Number(String(d.qtyRequestAir).replace(/,/g, ""))
          if (!isNaN(q)) { upd.qtyRequestAir = q; qtyChanged = true }
        }
        if (d.planShipmentDate) upd.planShipmentDate = new Date(d.planShipmentDate)
        if (Object.keys(upd).length) await prisma.airRequestItem.update({ where: { id: iid }, data: upd })
      }
      if (qtyChanged) await recomputeRequestFreight(id).catch(() => {})
    }
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
        await prisma.airRequest.update({ where: { id }, data: { status: "REJECTED", rejectionReason: comment || "Rejected by DPM (GW)" } })
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
        // Parallel stage → notify BOTH Logistics AND the Claim depts (NYK/NYG). Previously only
        // Logistics was alerted, so claim approvers (incl. SCM NYK) never got an email at GM approve.
        await notifyStatusChange(id, "PENDING_LOGISTICS_GW").catch(() => {})
        await notifyStatusChange(id, "PENDING_CLAIM_GW").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // GW "Back to Merchandise" — DPM or GM sends the WHOLE document back to the MER (GW) with a
  // reason (GW has NO hard reject; MER fixes and re-submits). Emails the MER.
  if (action === "back_to_mer_gw" && (request.status === "PENDING_VP_MER_GW" || request.status === "PENDING_GM_GW")) {
    if (!comment) return NextResponse.json({ error: "Please provide a reason before sending back to Merchandise" }, { status: 400 })
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, itemStatus: { notIn: ["REJECTED"] } },
      data: { itemStatus: "PENDING", itemComment: comment },
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "BACK_TO_MER", fromStatus: request.status, toStatus: "PENDING_MER_GW", comment: `Back to Merchandise: ${comment}` }
    })
    await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_MER_GW", rejectionReason: comment } })
    await notifyBackToMerGw(id, comment, session.user?.name || session.user?.email || undefined).catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // GW "Back to Merchandise" for ONE style only — send just that style's SO back to the MER to
  // edit, while the already-approved styles (VP_MER_PASSED) stay approved. The doc moves to
  // PENDING_MER_GW; on resubmit only the returned (PENDING) style needs DPM re-approval.
  if (action === "back_to_mer_style_gw" && (request.status === "PENDING_VP_MER_GW" || request.status === "PENDING_GM_GW")) {
    if (!style) return NextResponse.json({ error: "style required" }, { status: 400 })
    if (!comment) return NextResponse.json({ error: "Please provide a reason before sending back to Merchandise" }, { status: 400 })
    const n = await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: { notIn: ["REJECTED"] } },
      data: { itemStatus: "PENDING", itemComment: comment },
    })
    if (n.count === 0) return NextResponse.json({ error: "No SO found for that style" }, { status: 400 })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "BACK_TO_MER", fromStatus: request.status, toStatus: "PENDING_MER_GW", comment: `Back to Merchandise (style ${style}): ${comment}` }
    })
    await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_MER_GW", rejectionReason: comment } })
    await notifyBackToMerGw(id, comment, session.user?.name || session.user?.email || undefined).catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // GW MER re-submits after a "Back to Merchandise" → restart approval from DPM.
  if (action === "resubmit_mer_gw" && (userRole === "MER_GW" || userRole === "ADMIN") && request.status === "PENDING_MER_GW") {
    // Keep styles that DPM/GM already approved (VP_MER_PASSED) approved — only the style(s)
    // that were sent back sit at PENDING and need DPM re-approval. (Whole-doc back had already
    // set every style to PENDING, so this is a no-op there.)
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, itemStatus: { notIn: ["REJECTED", "VP_MER_PASSED"] } },
      data: { itemStatus: "PENDING" },
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "RESUBMIT", fromStatus: "PENDING_MER_GW", toStatus: "PENDING_VP_MER_GW", comment: "Merchandise re-submitted" }
    })
    await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_VP_MER_GW", rejectionReason: null } })
    await notifyStatusChange(id, "PENDING_VP_MER_GW").catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // NYG "Back to Merchandise" — SCM user sends the WHOLE document back to the MER who uploaded it
  // (soft return with a reason; MER fixes and re-submits). Works for NYG (PENDING_SCM) and EA docs.
  if (action === "back_to_mer_nyg" && userRole === "SCM_USER" && request.status === "PENDING_SCM") {
    if (!comment) return NextResponse.json({ error: "Please provide a reason before sending back to Merchandise" }, { status: 400 })
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, itemStatus: { notIn: ["REJECTED"] } },
      data: { itemStatus: "PENDING", itemComment: comment },
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "BACK_TO_MER", fromStatus: request.status, toStatus: "PENDING_MER", comment: `Back to Merchandise: ${comment}` }
    })
    await prisma.airRequest.update({ where: { id }, data: { status: "PENDING_MER", rejectionReason: comment } })
    await notifyBackToMerGw(id, comment, session.user?.name || session.user?.email || undefined).catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // NYG/EA MER re-submits after a "Back to Merchandise" → restart approval from the first merch approver.
  if (action === "resubmit_mer_nyg" && ["MER_USER", "MER_EA", "MER_TRM", "ADMIN"].includes(userRole) && request.status === "PENDING_MER") {
    const firstStatus = request.bu === "EA" ? "PENDING_DVM_MER_EA" : request.bu === "TRM" ? "PENDING_DVM_MER_TRM" : "PENDING_DVM_MER"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, itemStatus: { notIn: ["REJECTED"] } },
      data: { itemStatus: "PENDING" },
    })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "RESUBMIT", fromStatus: "PENDING_MER", toStatus: firstStatus, comment: "Merchandise re-submitted" }
    })
    await prisma.airRequest.update({ where: { id }, data: { status: firstStatus, rejectionReason: null } })
    await notifyStatusChange(id, firstStatus).catch(() => {})
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
  // ADVM step — NYG (PENDING_DVM_MER) and EA (PENDING_DVM_MER_EA) share the same logic; EA
  // just advances to its own VP step. (EA = NYG flow, only the top-3 approvers differ.)
  if ((request.status === "PENDING_DVM_MER" || request.status === "PENDING_DVM_MER_EA" || request.status === "PENDING_DVM_MER_TRM") && (action === "approve_style" || action === "reject_style")) {
    if (!style) return NextResponse.json({ error: "Style required" }, { status: 400 })
    if (action === "reject_style" && !comment) return NextResponse.json({ error: "Please provide a reason before rejecting" }, { status: 400 })
    const dvmStatus = request.status
    const nextVpStatus = dvmStatus === "PENDING_DVM_MER_EA" ? "PENDING_VP_MER_EA" : dvmStatus === "PENDING_DVM_MER_TRM" ? "PENDING_VP_MER_TRM" : "PENDING_VP_MER"

    // The DVM/ADVM must pick the NEXT approver (VP MER / EA DVM) from master before approving.
    // Selection is per-document (assignedVpMer); the picked VP is the only one notified next.
    if (action === "approve_style") {
      const vpEmail = assignedVp || (request as any).assignedVpMer
      if (!vpEmail) return NextResponse.json({ error: dvmStatus === "PENDING_DVM_MER_EA" ? "Please select the next approver, DVM (EA), before approving" : dvmStatus === "PENDING_DVM_MER_TRM" ? "Please select the next approver, VP (TRM), before approving" : "Please select VP Merchandise (the next approver) before approving" }, { status: 400 })
      if (assignedVp && assignedVp !== (request as any).assignedVpMer) {
        await prisma.airRequest.update({ where: { id }, data: { assignedVpMer: assignedVp } })
      }
    }

    const newItemStatus = action === "approve_style" ? "DVM_MER_PASSED" : "REJECTED"
    await prisma.airRequestItem.updateMany({
      where: { requestId: id, style, itemStatus: "PENDING" },
      data: { itemStatus: newItemStatus, itemComment: comment || null }
    })
    await prisma.approvalLog.create({
      data: {
        requestId: id, userId,
        action: action === "approve_style" ? "APPROVE" : "REJECT",
        fromStatus: dvmStatus, toStatus: dvmStatus,
        comment: `Style: ${style}${comment ? ` - ${comment}` : ""}`
      }
    })
    // NYG reject → (1) tell the MER creator their doc was rejected + which email it was
    // forwarded to; (2) optionally forward the rejection (data + reason) to a typed email.
    if (action === "reject_style") {
      const fwRaw = body.forwardEmail ? String(body.forwardEmail).trim() : ""
      // Forward only to a company address — ignore anything that is not @nanyangtextile.com.
      const fwEmail = fwRaw.toLowerCase().endsWith("@nanyangtextile.com") ? fwRaw : undefined
      const rejBy = session.user?.name || session.user?.email || undefined
      if (fwEmail) await notifyRejectionForward(id, fwEmail, style, comment || "", rejBy).catch(() => {})
      await notifyRejectionToCreator(id, style, comment || "", rejBy, fwEmail).catch(() => {})
    }

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
        await prisma.airRequest.update({ where: { id }, data: { status: nextVpStatus } })
        await notifyStatusChange(id, nextVpStatus).catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // DVM (2nd merch) step — NYG (PENDING_VP_MER) and EA (PENDING_VP_MER_EA). Both approve →
  // PENDING_SCM (EA merges into the shared NYG SCM/Claim/President pipeline from here on).
  if ((request.status === "PENDING_VP_MER" || request.status === "PENDING_VP_MER_EA" || request.status === "PENDING_VP_MER_TRM") && (action === "approve_style" || action === "reject_style")) {
    const vpMerStatus = request.status
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
        fromStatus: vpMerStatus, toStatus: vpMerStatus,
        comment: `Style: ${style}${comment ? ` - ${comment}` : ""}`
      }
    })
    // NYG/EA reject → (1) tell the MER creator their doc was rejected + which email it was
    // forwarded to; (2) optionally forward the rejection (data + reason) to a typed email.
    if (action === "reject_style") {
      const fwRaw = body.forwardEmail ? String(body.forwardEmail).trim() : ""
      // Forward only to a company address — ignore anything that is not @nanyangtextile.com.
      const fwEmail = fwRaw.toLowerCase().endsWith("@nanyangtextile.com") ? fwRaw : undefined
      const rejBy = session.user?.name || session.user?.email || undefined
      if (fwEmail) await notifyRejectionForward(id, fwEmail, style, comment || "", rejBy).catch(() => {})
      await notifyRejectionToCreator(id, style, comment || "", rejBy, fwEmail).catch(() => {})
    }

    // Advance to PENDING_SCM when the 2nd merch step is done (no PENDING left)
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
  if (request.status === "PENDING_PRESIDENT" && action === "president_approve" && heldRoles.includes("PRESIDENT")) {
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
    // A complete style is now forwarded → it's ready for VP SCM to approve. Notify VP SCM EVERY
    // time this happens — including after VP SCM sent it Back to SCM and SCM re-submitted (the
    // assigned VP SCM is unchanged, so the old "only when assignment changes" check missed it).
    else if (hasCompleteStyleAfterForward) {
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
        // Parallel branches start now. notifyStatusChange(PENDING_CLAIM) already alerts
        // BOTH the claim depts AND Logistics (the PENDING_CLAIM block emails LG "Ready for
        // HAWB / Actual" for NYG). So only add the Accounting alert here — do NOT fire
        // PENDING_LOGISTICS too, or LG gets a duplicate email.
        await notifyStatusChange(id, "PENDING_CLAIM").catch(() => {})
        await notifyStatusChange(id, "PENDING_ACCOUNTING").catch(() => {})
      }
    }
    return NextResponse.json(await getUpdated())
  }

  // GW LOGISTICS (parallel with Claim): enter invoice/HAWB/actual per SO. Saving
  // data does NOT advance the SO — it only completes the Logistics side; the SO
  // reaches Accounting when Claim is also fully approved.
  if (action === "approve" && (userRole === "LOGISTICS_GW" || (isFwdTarget && request.bu === "GW"))) {
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
    // GW Logistics may also fill QTY Air / Plan Ship Date that Merchandise left blank → recompute.
    if (body.itemShipData && typeof body.itemShipData === "object") {
      let qtyChanged = false
      for (const [iid, val] of Object.entries(body.itemShipData)) {
        const d = val as any
        const upd: any = {}
        if (d.qtyRequestAir != null && String(d.qtyRequestAir).trim() !== "") {
          const q = Number(String(d.qtyRequestAir).replace(/,/g, "")); if (!isNaN(q)) { upd.qtyRequestAir = q; qtyChanged = true }
        }
        if (d.planShipmentDate) upd.planShipmentDate = new Date(d.planShipmentDate)
        if (Object.keys(upd).length) await prisma.airRequestItem.update({ where: { id: iid }, data: upd })
      }
      if (qtyChanged) await recomputeRequestFreight(id).catch(() => {})
    }
    // Parallel-stage items (PRES_PASSED). Ready = has actual air freight.
    const freshItems = await prisma.airRequestItem.findMany({ where: { requestId: id, itemStatus: { in: ["PRES_PASSED", "LOG_PASSED"] } } })
    const readyItems = freshItems.filter((i: any) => i.actualAirFreight != null)
    if (readyItems.length === 0) return NextResponse.json({ error: "Please assign a HAWB and enter Total Air for at least 1 SO before confirming" }, { status: 400 })
    // Re-derive: an SO goes to Accounting only if Claim is done AND LG data present.
    for (const item of freshItems) {
      const lgDone = item.actualAirFreight != null
      const derived = deriveGwItemStatus(getSplits(item), lgDone, skipPres)
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
    // "Save & Send" (data complete) → mark LG as sent (chip turns green only now, not on
    // draft) + email the claimers the LG files + signed PDF (item 2).
    if (body.lgComplete) {
      await (prisma.airRequest as any).update({ where: { id }, data: { logisticsSent: true } }).catch(() => {})
      await notifyLgFilesToClaimers(id).catch(() => {})
      await notifyGwClaimNyk(id).catch(() => {}) // LG done (INV+Actual in) → NOW alert SCM NYK claim
    }
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
      await prisma.airRequestItem.update({ where: { id: iid }, data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, itemData.actualAirFreight != null, skipPres) } })
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
    // LG confirmed/sent → chip turns green + gate President on this (not on draft).
    await (prisma.airRequest as any).update({ where: { id }, data: { logisticsSent: true } }).catch(() => {})
    await notifyGwClaimNyk(id).catch(() => {}) // LG done (INV+Actual in) → NOW alert SCM NYK claim
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
    for (const [itemId, deptVal] of Object.entries(soClaimData)) {
      if (!deptVal) continue
      const isArr = Array.isArray(deptVal)
      const firstDept = isArr ? (deptVal as any[])[0]?.dept : String(deptVal)
      if (!firstDept) continue
      await prisma.airRequestItem.update({
        where: { id: itemId },
        data: {
          claimDepartment: firstDept,
          // Persist the FULL splits (dept/pct/reason=Delay Code/reasonDetail) right here on
          // approve — don't rely on the debounced auto-save, which is canceled when this
          // request navigates away, silently dropping the detail (and sometimes the split).
          ...(isArr ? { claimDepts: deptVal as any } : {}),
          itemComment: soClaimComments?.[itemId] ? String(soClaimComments[itemId]) : undefined,
        } as any
      })
    }
    // Scalar-value case only (legacy single-dept forward): pick a doc-level dept.
    const scalarDepts = [...new Set(Object.values(soClaimData).filter(v => v && !Array.isArray(v)))]
    if (scalarDepts.length === 1) upd.claimDepartment = scalarDepts[0] as string
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
    // NYK Direct imports ride the GW claim machinery regardless of the doc's tagged BU.
    const isGW = request.bu === "GW" || !!(request as any).nykDirect
    const expectedStatus = isGW ? "PENDING_CLAIM_GW" : "PENDING_CLAIM"
    if (request.status !== expectedStatus) return NextResponse.json({ error: "Not in the Claim stage" }, { status: 400 })
    const nykDept = isGW ? "SCM NYK" : "NYK"
    const doneStatus = isGW ? GW_DEPT_APPROVED : "COMPLETED"
    // CR NO is now per-SO (usually 1 CR per INV, but an INV can carry several). Accept a per-item map
    // { itemId: crNo }; fall back to a single body.crNo applied to every NYK SO (back-compat).
    const crByItem: Record<string, string> = (body.crByItem && typeof body.crByItem === "object") ? body.crByItem : {}
    const singleCr = body.crNo ? String(body.crNo).trim() : ""
    const crFor = (it: any) => (String(crByItem[it.id] ?? "").trim() || singleCr)
    const items = await prisma.airRequestItem.findMany({ where: { requestId: id }, include: { claimApprovals: { include: { user: { select: { role: true } } } } } })
    const nykSOs = items.filter(it => getSplits(it).some((s: any) => s.dept === nykDept && s.status !== "REJECTED"))
    if (nykSOs.length === 0) return NextResponse.json({ error: "No SCM NYK claim SO awaiting a CR NO" }, { status: 400 })
    // SCM NYK Approver must approve first before the CR user (parallel with EVP) can enter CR.
    const awaitingApprover = nykSOs.filter(it => !((it as any).claimApprovals || []).some((a: any) => a.role === "SCM_NYK_APPROVER"))
    if (awaitingApprover.length > 0) return NextResponse.json({ error: `Waiting for the SCM NYK Approver to approve all SOs before entering the CR NO (${awaitingApprover.length} SO remaining)` }, { status: 400 })
    // Every NYK SO must have a CR NO before we finalize (enter-all-then-close).
    const missingCr = nykSOs.filter(it => !crFor(it))
    if (missingCr.length > 0) return NextResponse.json({ error: `Please enter a CR NO for every INV/SO before finalizing (${missingCr.length} SO still missing)` }, { status: 400 })
    const distinctCrs = [...new Set(nykSOs.map(crFor).filter(Boolean))]
    await prisma.airRequest.update({ where: { id }, data: { crNo: distinctCrs.join(", ") } as any })
    let finalizedCount = 0
    for (const it of items) {
      const splits = getSplits(it)
      if (!splits.some((s: any) => s.dept === nykDept && s.status !== "REJECTED" && s.status !== doneStatus)) continue
      const cr = crFor(it)
      const appr: any[] = (it as any).claimApprovals || []
      const hasApprover = appr.some((a: any) => a.role === "SCM_NYK_APPROVER")
      const hasEvp = appr.some((a: any) => a.role === "SCM_NYK_EVP")
      const splitStatus = nykSplitStatus({ approver: hasApprover, evp: hasEvp, cr: !!cr }, doneStatus)
      const updated = setGwSplitStatus(splits, [nykDept], splitStatus, cr)  // per-SO CR NO
      await prisma.airRequestItem.update({ where: { id: it.id }, data: { claimDepts: updated as any, itemStatus: isGW ? deriveGwItemStatus(updated, !!(request as any).logisticsSent, skipPres) : deriveNygItemStatus(updated, !!(request as any).logisticsSent) } })
      finalizedCount++
    }
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `CR NO: ${distinctCrs.join(", ")} — SCM NYK finalized ${finalizedCount} SO` }
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
      data: { requestId: id, userId, action: "BACK_TO_SCM", fromStatus: request.status, toStatus: "PENDING_CLAIM_REJECT_GW", comment: `SO: ${itemData.so} — Claim rejected, back to Merchandise: ${comment}` }
    })
    const nextDocStatus = await recalcDocStatusGW(id)
    if (nextDocStatus !== request.status) await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
    await notifyStatusChange(id, "CLAIM_REJECTED_GW").catch(() => {})
    return NextResponse.json(await getUpdated())
  }

  // Case 6: Logistics rejects an SO that was wrongly included (not air / not in projection) →
  // bounce it back to the stage BEFORE the claim split (NYG: SCM re-assigns; GW: MER re-selects
  // the claim dept), and FYI everyone who already approved the document.
  if (action === "lg_reject_so" && (["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM", "ADMIN"].includes(userRole) || heldRoles.some(r => ["LOGISTICS", "LOGISTICS_GW", "LOGISTICS_TRM"].includes(r)))) {
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    if (!comment) return NextResponse.json({ error: "Please provide a reason before rejecting the SO" }, { status: 400 })
    const item = request.items.find((i: any) => i.id === itemId)
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    const isGWDoc = request.bu === "GW"
    await (prisma as any).claimApproval.deleteMany({ where: { itemId } })
    if (isGWDoc) {
      // GW: the claim split is chosen by MER → send the SO back to MER to re-handle (before claim).
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { itemStatus: "CLAIM_REJECT_GW", itemComment: comment } as any })
      await prisma.approvalLog.create({ data: { requestId: id, userId, action: "LG_REJECT_SO", fromStatus: request.status, toStatus: "PENDING_CLAIM_REJECT_GW", comment: `SO: ${item.so} — Logistics rejected (back before claim): ${comment}` } })
      const nextDocStatus = await recalcDocStatusGW(id)
      if (nextDocStatus !== request.status) await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
      await notifyStatusChange(id, "CLAIM_REJECTED_GW").catch(() => {})
    } else {
      // NYG: the claim split is assigned by SCM → reset the SO and send it back to SCM (before claim).
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { itemStatus: "PENDING", claimDepartment: null, claimDepts: null, itemComment: comment } as any })
      await prisma.approvalLog.create({ data: { requestId: id, userId, action: "LG_REJECT_SO", fromStatus: request.status, toStatus: "PENDING_SCM", comment: `SO: ${item.so} — Logistics rejected (back before claim): ${comment}` } })
      const nextDocStatus = await recalcDocStatus(id)
      await prisma.airRequest.update({ where: { id }, data: { status: nextDocStatus } })
      if (nextDocStatus === "PENDING_SCM") await notifyStatusChange(id, "PENDING_SCM").catch(() => {})
    }
    // FYI: alert every approver who already passed this document.
    await notifyLgRejectFyi(id, item.so, comment, session.user?.name || session.user?.email || undefined).catch(() => {})
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
    }
    // MER re-submitted the re-assigned SO → it's back in Claim. Alert claim approvers every time
    // (even if the doc status is unchanged because other SOs are still being re-worked).
    if (nextDocStatus === "PENDING_CLAIM_GW") await notifyStatusChange(id, "PENDING_CLAIM_GW").catch(() => {})
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
    if (userRole === "SCM_NYK_APPROVER" && (body.evpEmail || body.crEmail)) {
      await prisma.airRequest.update({ where: { id }, data: { assignedScmNykEvp: body.evpEmail || null, assignedScmNykCr: body.crEmail || null } as any })
    }

    const myDepts = gwDeptsForRole(userRole, userClaimDept)
    // Priority chain (CLAIM_GW / SCM_NYG) — resolve once for all items.
    const allApprovers = (userRole === "CLAIM_GW" || userRole === "SCM_NYG")
      ? await (prisma.user as any).findMany({ where: { role: userRole, isActive: true, priority: { not: null }, bu: { in: [request.bu, "ALL"] } }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] })
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
        await prisma.airRequestItem.update({ where: { id: it.id }, data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, lgDone, skipPres) } })
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
          await prisma.airRequestItem.update({ where: { id: it.id }, data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, lgDone, skipPres) } })
        }
        count++
      }
    }
    if (count === 0) return NextResponse.json({ error: "No SO to approve (already handled or not your turn)" }, { status: 400 })

    await prisma.approvalLog.create({ data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `Batch approve ${count} SO — ${userRole}` } })
    // Alert EVP + CR user ONCE — only after EVERY brand/SO is Approver-approved,
    // so the whole document moves to the EVP/CR step together (not per SO/brand).
    if (userRole === "SCM_NYK_APPROVER" && await allNykApproverApproved(id)) await notifyStatusChange(id, "NYK_APPROVER_DONE").catch(() => {})
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
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, itemLgDone, skipPres), itemComment: comment || null } })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — SCM NYK ${userRole === "SCM_NYK_APPROVER" ? "Approver" : "EVP"} approved` }
      })
      // Approver picks the specific CR-entry person + VP/EVP approver (one per doc).
      // Alert them only on the FIRST assignment (null → set), not per SO/brand.
      if (userRole === "SCM_NYK_APPROVER" && (body.evpEmail || body.crEmail)) {
        const cur = await (prisma.airRequest as any).findUnique({ where: { id }, select: { assignedScmNykEvp: true, assignedScmNykCr: true, scmNykEvpToken: true, scmNykToken: true } })
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
      // Alert EVP + CR user ONCE — only after EVERY brand/SO is Approver-approved,
      // so the whole document moves to the EVP/CR step together (not per SO/brand).
      if (userRole === "SCM_NYK_APPROVER" && await allNykApproverApproved(id)) await notifyStatusChange(id, "NYK_APPROVER_DONE").catch(() => {})
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

    // Priority chain for this role — include cross-BU holders (bu = "ALL", e.g. SCM_NYG,
    // Claim-Production) so the priority gating sees the whole chain, not just BU-scoped users.
    const allApprovers = await (prisma.user as any).findMany({
      where: { role: userRole, isActive: true, priority: { not: null }, bu: { in: [request.bu, "ALL"] } },
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
        data: { claimDepts: updated as any, itemStatus: deriveGwItemStatus(updated, itemLgDone, skipPres), itemComment: comment || null },
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
    let myFwdRows: any[] = []
    if (userRole === "CLAIM_NEXT_APPROVER") {
      const email = (session.user?.email || "").toLowerCase()
      const tok = (session.user as any).claimNextToken || null
      // MERGE every forward addressed to this person (e.g. the Production EVP gets one forward
      // from the G1/G3 approver and one from the G2/G4 approver) → finish them together, no
      // matter which link they came in on. Scope to the dept of the row matching their token.
      const tokRow = tok ? await (prisma as any).claimForward.findFirst({ where: { requestId: id, token: tok } }) : null
      const allRows = await (prisma as any).claimForward.findMany({ where: { requestId: id } })
      myFwdRows = allRows.filter((r: any) => String(r.nextEmail || "").toLowerCase() === email && (!tokRow || r.dept === tokRow.dept))
      ownerRow = tokRow || myFwdRows[0]
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
      // Union EVERY forward row addressed to this person (not just the link's token) so the
      // EVP finishes all SOs forwarded to them across the G-groups in one action.
      const rowsForIds = myFwdRows.length ? myFwdRows : [ownerRow]
      const anyWhole = rowsForIds.some((r: any) => !Array.isArray(r.itemIds) || !r.itemIds.length)
      const unionIds = new Set<string>(rowsForIds.flatMap((r: any) => Array.isArray(r.itemIds) ? r.itemIds : []))
      ownedIds = anyWhole ? deptPendingIds : deptPendingIds.filter((x) => unionIds.has(x))
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
      const itemStatus = isGW ? deriveGwItemStatus(updated, !!(request as any).logisticsSent, skipPres) : deriveNygItemStatus(updated, !!(request as any).logisticsSent)
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
    // PROCUREMENT special rule: Purchasing (entry, pos 0) is a pass-through. A back from
    // Sourcing (whose previous is Purchasing) must go to SCM to RE-PICK the claim dept — NOT
    // back to Purchasing. VP→Sourcing (prior is pos>0) still goes to the previous person.
    const procToScm = dept === "PROCUREMENT" && (!prior || (prior.position ?? 0) === 0)
    if (prior && !procToScm) {
      const priorIds = Array.from(new Set([...(Array.isArray(prior.itemIds) ? prior.itemIds : []), ...selIds]))
      await (prisma as any).claimForward.update({ where: { id: prior.id }, data: { itemIds: priorIds } })
      await notifyClaimNext(id, prior.nextEmail, prior.nextName || prior.nextEmail, (session.user as any).name || "", prior.token, `${dept} — sent back (${selIds.length} SO)`).catch(() => {})
    } else if (procToScm) {
      // Reset ONLY the PROCUREMENT split of each SO to SCM_REASSIGN (keep dept + %). SCM re-picks
      // the dept and re-forwards. Other depts' splits are untouched.
      const procRows = await (prisma as any).claimForward.findMany({ where: { requestId: id, dept } })
      for (const r of procRows) {
        const kept = (Array.isArray(r.itemIds) ? r.itemIds : []).filter((x: string) => !selIds.includes(x))
        await (prisma as any).claimForward.update({ where: { id: r.id }, data: { itemIds: kept } })
      }
      for (const sid of selIds) {
        await (prisma as any).claimApproval.deleteMany({ where: { itemId: sid, role: { in: ["CLAIM_PROCUREMENT", "VP_PROCUREMENT", "DVM_PROCUREMENT"] } } })
        const it = await prisma.airRequestItem.findUnique({ where: { id: sid } })
        if (!it) continue
        const splits = setDeptSplitStatus(getSplits(it), dept, SPLIT_STATUS.SCM_REASSIGN)
        const ns = deriveNygItemStatus(splits as any, !!(request as any).logisticsSent)
        await prisma.airRequestItem.update({ where: { id: sid }, data: { claimDepts: splits as any, itemStatus: ns, itemComment: comment } as any })
      }
      await notifyStatusChange(id, "PENDING_SCM").catch(() => {})
    } else {
      // Back to the entry owner (position 0) — they regain the SO in their queue.
      await notifyClaimEntry(id, dept).catch(() => {})
    }
    return NextResponse.json(await getUpdated())
  }

  // SCM re-picks the claim dept for a split that a claim approver sent back (SCM_REASSIGN).
  // The % is LOCKED — SCM only chooses the department (same or different) → the split re-enters
  // that dept's chain from its entry. Other splits of the SO are untouched.
  if (action === "scm_reassign_split" && heldRoles.includes("SCM_USER")) {
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
    const newDept = String(body.newDept || "").trim()
    if (!newDept) return NextResponse.json({ error: "Please select a claim department" }, { status: 400 })
    const it = await prisma.airRequestItem.findUnique({ where: { id: itemId } })
    if (!it || it.requestId !== id) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    const splits = getSplits(it)
    const idx = splits.findIndex((s: any) => s.status === SPLIT_STATUS.SCM_REASSIGN)
    if (idx < 0) return NextResponse.json({ error: "No split awaiting re-assignment" }, { status: 400 })
    const newSplits = splits.map((s: any, i: number) => i === idx ? { ...s, dept: newDept, status: null, crNo: null } : s)
    const ns = deriveNygItemStatus(newSplits as any, !!(request as any).logisticsSent)
    await prisma.airRequestItem.update({ where: { id: itemId }, data: { claimDepts: newSplits as any, itemStatus: ns } as any })
    await prisma.approvalLog.create({
      data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${it.so} — SCM re-assigned claim to ${newDept}` }
    })
    await notifyClaimEntry(id, newDept).catch(() => {})
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
      await prisma.airRequestItem.update({ where: { id: itemId }, data: { claimDepts: updated as any, itemStatus: deriveNygItemStatus(updated, !!(request as any).logisticsSent), itemComment: comment || null } })
      await prisma.approvalLog.create({
        data: { requestId: id, userId, action: "APPROVE", fromStatus: request.status, toStatus: request.status, comment: `SO: ${itemData.so} — SCM NYK ${userRole === "SCM_NYK_APPROVER" ? "Approver" : "EVP"} approved` }
      })
      if (userRole === "SCM_NYK_APPROVER" && (body.evpEmail || body.crEmail)) {
        // Store the chosen people + a UNIQUE magic-login token each, so their email
        // link logs in AS them (via assignedScmNyk* in auth) — not as whoever's already
        // logged in. Tokens are created ONCE (first SO approved); later SOs reuse them,
        // so EVP/CR are emailed a single time (not once per SO).
        const cur = await prisma.airRequest.findUnique({ where: { id }, select: { scmNykEvpToken: true, scmNykToken: true } as any })
        const setEvp = !!body.evpEmail && !(cur as any)?.scmNykEvpToken
        const setCr = !!body.crEmail && !(cur as any)?.scmNykToken
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
      // Alert EVP + CR user ONCE — only after EVERY brand/SO is Approver-approved,
      // so the whole document moves to the EVP/CR step together (not per SO/brand).
      if (userRole === "SCM_NYK_APPROVER" && await allNykApproverApproved(id)) await notifyStatusChange(id, "NYK_APPROVER_DONE").catch(() => {})
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
      const newItemStatus = deriveNygItemStatus(updatedSplits, !!(request as any).logisticsSent)
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
  } else if (action === "back_to_scm") {
    // A "Back to SCM" must always alert SCM — even when the doc status is unchanged (VP SCM and
    // SCM both operate at PENDING_SCM, so a status-change check alone would skip the email).
    await notifyStatusChange(id, "PENDING_SCM").catch(() => {})
  }

  return NextResponse.json(await getUpdated())
}
