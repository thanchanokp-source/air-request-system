import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Supplier claim records of ONE document — Procurement keys the supplier-claim document no. + the amount
// claimed from the supplier (+ files, uploaded via /attachments with category "SUPPLIER_CLAIM:<id>").
// Shown on the document page, in the PDF and on the Document-for-Logistics list ("เคลม supplier แล้ว").
//   GET                                  → list
//   POST { refNo, amount, note? }        → add       (CLAIM_PROCUREMENT / VP_PROCUREMENT / ADMIN)
//   DELETE ?claimId=                     → remove    (same roles; its files are removed too)
const EDIT_ROLES = ["CLAIM_PROCUREMENT", "VP_PROCUREMENT", "ADMIN"]

async function canEdit(session: any) {
  const u = await (prisma.user as any).findUnique({ where: { id: (session.user as any).id }, select: { role: true, roles: true } }).catch(() => null)
  const held = [(session.user as any).role, u?.role, ...((u?.roles as string[]) || [])].filter(Boolean)
  return held.some((r: string) => EDIT_ROLES.includes(r))
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const rows = await (prisma as any).supplierClaim.findMany({ where: { requestId: id }, include: { createdBy: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await canEdit(session))) return NextResponse.json({ error: "เฉพาะทีม Procurement / Admin" }, { status: 403 })
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const refNo = String(b.refNo || "").trim()
  const amount = Number(String(b.amount ?? "").replace(/,/g, ""))
  if (!refNo) return NextResponse.json({ error: "ใส่เลขเอกสารเคลม supplier" }, { status: 400 })
  if (!(amount > 0)) return NextResponse.json({ error: "ใส่ยอดที่เคลม supplier (มากกว่า 0)" }, { status: 400 })
  const doc = await prisma.airRequest.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!doc) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 })
  const row = await (prisma as any).supplierClaim.create({
    data: { requestId: id, refNo, amount: Math.round(amount * 100) / 100, note: String(b.note || "").trim() || null, createdById: (session.user as any).id },
    include: { createdBy: { select: { name: true, email: true } } },
  })
  await prisma.approvalLog.create({ data: { requestId: id, userId: (session.user as any).id, action: "SUPPLIER_CLAIM", fromStatus: doc.status, toStatus: doc.status, comment: `เคลม supplier ${refNo} · ${row.amount.toLocaleString()} THB` } }).catch(() => {})
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await canEdit(session))) return NextResponse.json({ error: "เฉพาะทีม Procurement / Admin" }, { status: 403 })
  const { id } = await params
  const claimId = String(req.nextUrl.searchParams.get("claimId") || "")
  const row = await (prisma as any).supplierClaim.findFirst({ where: { id: claimId, requestId: id } })
  if (!row) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 })
  await prisma.requestAttachment.deleteMany({ where: { requestId: id, category: `SUPPLIER_CLAIM:${claimId}` } }).catch(() => {})
  await (prisma as any).supplierClaim.delete({ where: { id: claimId } })
  return NextResponse.json({ ok: true })
}
