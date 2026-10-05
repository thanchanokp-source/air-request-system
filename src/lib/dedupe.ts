import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { styleHit, normStyle, shipSubKey } from "@/lib/ship-map"
import { loadShipSource } from "@/lib/ship-source"

// Duplicate-row rules (agreed with the business) — used by the MER upload AND the admin "remove duplicates
// in every document" tool, so both decide the same way. A row is a DUPLICATE only when ALL hold:
//   1. same SO + SUB + STYLE (contains / segment match, as the dashboard) + QTY AIR as a row in ANOTHER
//      active document (not TEST, not REJECTED)
//   2. it sits in the LATER document — the first (original) document is never touched
//   3. it has no HAWB and no ACTUAL (a row LG already booked is never removed)
//   4. the SO+SUB has more air-request rows than real shipment rounds (distinct INV in mp_line / export,
//      at least 1) — so a genuine 2nd round with the same qty is kept

const qtyOf = (r: any) => Number(r.qtyRequestAir) || 0
const booked = (r: any) => {
  const h = String(r?.hawbNo ?? "").trim()
  return (h !== "" && !/^[-.\s]*$/.test(h)) || (Number(r?.actualAirFreight) || 0) > 0
}
// qty must be > 0: MER may leave QTY AIR blank — a blank line is never judged a duplicate
const sameLine = (a: any, b: any) => qtyOf(a) > 0 && qtyOf(a) === qtyOf(b) && styleHit(normStyle(a.style), normStyle(b.style))

/** shipment rounds per "SO|SUB" = distinct INVs in the source with more INVs (min 1 applied by callers) */
export async function loadRoundsBySub(): Promise<Map<string, number>> {
  const src = await loadShipSource()
  const out = new Map<string, number>()
  for (const sk of new Set([...Object.keys(src.mp), ...Object.keys(src.ex)])) {
    const a = new Set((src.mp[sk] || []).map(l => l.inv)).size, b = new Set((src.ex[sk] || []).map(l => l.inv)).size
    out.set(sk, Math.max(a, b))
  }
  return out
}

async function activeItemsForSos(sos8: string[]) {
  return await (prisma.airRequestItem as any).findMany({
    where: { so: { in: sos8 }, itemStatus: { not: "REJECTED" }, request: { isTest: false } },
    select: { id: true, so: true, sub: true, style: true, qtyRequestAir: true, hawbNo: true, actualAirFreight: true, invoiceNo: true, itemStatus: true,
      request: { select: { id: true, documentNo: true, createdAt: true, status: true, createdBy: { select: { name: true, email: true } } } } },
  }) as any[]
}

export type UploadMatch = { documentNo: string; qty: number; status: string; inv: string; hawb: string; by: string; created: string }
export type UploadCheckRow = { index: number; so: string; sub: string; style: string; qty: number; likelyDup: boolean; matches: UploadMatch[] }

/**
 * For the MER upload POPUP: every uploaded row whose SO+SUB+STYLE was already uploaded in an active document,
 * with those old rows (doc, qty, status, INV/HAWB, uploader). likelyDup = the same row would be dropped by
 * findUploadDuplicates (same qty + no spare shipment round). Nothing is blocked — MER decides.
 */
export async function checkUploadDuplicates(rows: { so: string; sub: string; style: string; qtyRequestAir: number }[]): Promise<UploadCheckRow[]> {
  const sos8 = [...new Set(rows.map(r => String(r.so || "")).filter(Boolean))]
  if (!sos8.length) return []
  const existing = await activeItemsForSos(sos8)
  const { drop } = await findUploadDuplicates(rows)
  const bySub = new Map<string, any[]>()
  for (const e of existing) { const k = shipSubKey(e); bySub.set(k, [...(bySub.get(k) || []), e]) }
  const out: UploadCheckRow[] = []
  rows.forEach((r, i) => {
    const ms = (bySub.get(shipSubKey(r)) || []).filter(e => styleHit(normStyle(e.style), normStyle(r.style)))
    if (!ms.length) return
    out.push({ index: i, so: r.so, sub: r.sub, style: r.style, qty: qtyOf(r), likelyDup: drop.has(i),
      matches: ms.map(e => ({ documentNo: e.request?.documentNo || "-", qty: qtyOf(e), status: e.request?.status || e.itemStatus || "",
        inv: e.invoiceNo || "", hawb: e.hawbNo || "", by: e.request?.createdBy?.name || e.request?.createdBy?.email || "",
        created: e.request?.createdAt ? new Date(e.request.createdAt).toISOString().slice(0, 10) : "" })) })
  })
  return out
}

/**
 * A) MER upload. `rows` = the uploaded lines already shaped as { so, sub, style, qtyRequestAir } (index-aligned
 * with the file). Returns the indexes to DROP + a readable list. New rows are always the "later document".
 */
export async function findUploadDuplicates(rows: { so: string; sub: string; style: string; qtyRequestAir: number }[]) {
  const sos8 = [...new Set(rows.map(r => String(r.so || "")).filter(Boolean))]
  if (!sos8.length) return { drop: new Set<number>(), list: [] as string[] }
  const existing = await activeItemsForSos(sos8)
  const rounds = await loadRoundsBySub()
  const bySub = new Map<string, any[]>()
  for (const e of existing) { const k = shipSubKey(e); bySub.set(k, [...(bySub.get(k) || []), e]) }
  const keptNew = new Map<string, number>()
  const drop = new Set<number>(), list: string[] = []
  rows.forEach((r, i) => {
    const sk = shipSubKey(r)
    const ex = bySub.get(sk) || []
    const allowed = Math.max(rounds.get(sk) || 0, 1)
    const total = ex.length + (keptNew.get(sk) || 0)
    const twin = ex.find(e => sameLine(e, r))
    if (twin && total >= allowed) { drop.add(i); list.push(`SO ${r.so} / ${r.sub || "-"} / ${r.style || "-"} · qty ${qtyOf(r)} — ซ้ำกับ ${twin.request?.documentNo || "-"}`) }
    else keptNew.set(sk, (keptNew.get(sk) || 0) + 1)
  })
  return { drop, list }
}

export type DupCandidate = { itemId: string; requestId: string; documentNo: string; so: string; sub: string; style: string; qty: number; twinDoc: string }

/** B) every document: duplicate rows that may be removed (nothing is written) */
export async function planDedupeAll(): Promise<DupCandidate[]> {
  const items = await (prisma.airRequestItem as any).findMany({
    where: { itemStatus: { not: "REJECTED" }, request: { isTest: false } },
    select: { id: true, so: true, sub: true, style: true, qtyRequestAir: true, hawbNo: true, actualAirFreight: true,
      request: { select: { id: true, documentNo: true, createdAt: true } } },
  }) as any[]
  const rounds = await loadRoundsBySub()
  const bySub = new Map<string, any[]>()
  for (const it of items) { const k = shipSubKey(it); bySub.set(k, [...(bySub.get(k) || []), it]) }
  const out: DupCandidate[] = []
  const t = (r: any) => new Date(r.request?.createdAt || 0).getTime()
  for (const [sk, rows] of bySub) {
    const allowed = Math.max(rounds.get(sk) || 0, 1)
    let excess = rows.length - allowed
    if (excess <= 0) continue
    // newest documents first — the original (oldest) is never a candidate
    const sorted = [...rows].sort((a, b) => t(b) - t(a) || String(b.request?.documentNo).localeCompare(String(a.request?.documentNo)))
    for (const r of sorted) {
      if (excess <= 0) break
      if (booked(r)) continue
      const twin = rows.find(o => o.request?.id !== r.request?.id && t(o) <= t(r) && o.id !== r.id && sameLine(o, r)
        && !out.some(c => c.itemId === o.id))
      if (!twin) continue
      out.push({ itemId: r.id, requestId: r.request?.id, documentNo: r.request?.documentNo || "-", so: r.so, sub: r.sub || "",
        style: r.style || "", qty: qtyOf(r), twinDoc: twin.request?.documentNo || "-" })
      excess--
    }
  }
  return out.sort((a, b) => a.documentNo.localeCompare(b.documentNo) || String(a.so).localeCompare(String(b.so)))
}

/** delete rows of ONE document with the same clean-up as the per-item delete; empty document is removed */
export async function deleteItemsOfDoc(requestId: string, itemIds: string[], userId: string, note: string) {
  const doc = await prisma.airRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true } })
  if (!doc || !itemIds.length) return { deleted: 0, remaining: 0, docDeleted: false }
  await (prisma as any).claimApproval.deleteMany({ where: { itemId: { in: itemIds } } }).catch(() => {})
  const cfs = await (prisma as any).claimForward.findMany({ where: { requestId } }).catch(() => [])
  for (const cf of cfs as any[]) {
    const keep = (cf.itemIds || []).filter((x: string) => !itemIds.includes(x))
    if (keep.length !== (cf.itemIds || []).length) {
      if (keep.length === 0) await (prisma as any).claimForward.delete({ where: { id: cf.id } }).catch(() => {})
      else await (prisma as any).claimForward.update({ where: { id: cf.id }, data: { itemIds: keep } }).catch(() => {})
    }
  }
  const del = await prisma.airRequestItem.deleteMany({ where: { id: { in: itemIds }, requestId } })
  const remaining = await prisma.airRequestItem.count({ where: { requestId } })
  await prisma.approvalLog.create({ data: { requestId, userId, action: "DELETE_ITEMS", fromStatus: doc.status, toStatus: doc.status, comment: `${note} · ลบ ${del.count} แถว · เหลือ ${remaining}` } }).catch(() => {})
  if (remaining === 0) {
    await (prisma as any).hawbGroup.deleteMany({ where: { requestId } }).catch(() => {})
    await (prisma as any).approvalSignature.deleteMany({ where: { requestId } }).catch(() => {})
    await (prisma as any).claimForward.deleteMany({ where: { requestId } }).catch(() => {})
    await (prisma as any).requestAttachment.deleteMany({ where: { requestId } }).catch(() => {})
    await (prisma as any).approvalLog.deleteMany({ where: { requestId } }).catch(() => {})
    await prisma.airRequest.delete({ where: { id: requestId } }).catch(() => {})
  }
  return { deleted: del.count, remaining, docDeleted: remaining === 0 }
}

/** email every active ADMIN (best effort) */
export async function mailAdmins(subject: string, lines: string[]) {
  try {
    const admins = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: "ADMIN" }, { roles: { has: "ADMIN" } }] }, select: { email: true } })
    const to = [...new Set((admins as any[]).map(a => a.email).filter(Boolean))]
    if (!to.length) return
    const body = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:13px"><p>${subject}</p><ul>${lines.slice(0, 200).map(l => `<li>${l}</li>`).join("")}</ul>${lines.length > 200 ? `<p>… และอีก ${lines.length - 200} รายการ</p>` : ""}</div>`
    await sendMail(to, subject, body)
  } catch { /* email is best effort */ }
}
