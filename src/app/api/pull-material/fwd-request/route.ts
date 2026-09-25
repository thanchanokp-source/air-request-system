import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { type FwdPhase } from "@/lib/pull-fwd-template"
import { fwdMailHtml, fwdMailSubject } from "@/lib/pull-fwd-mail"
import { buildFwdWorkbook } from "@/lib/pull-fwd-workbook"

// ── Pull RM Phase 2 — mail ONE workbook covering MANY documents ────────────────────────────────
// LG filters the queue (BU / ETC range / port / brand …), ticks the shipments, picks the forwarder
// and the phase, and sends. The FWD gets a single sheet with one row per shipment.
//   phase 1 = booking info (MAWB / HAWB / ETD / ETA / CFM in-house / rate THB per kg / supplier INV)
//   phase 2 = the actual once it has landed (actual air freight / local charge / remark)
// Columns of the other phase are locked grey, so nothing is filled in at the wrong time.

const docsLabel = (docs: any[]) => (docs.length === 1 ? docs[0].documentNo : `${docs.length} shipments`)

const canUse = (u: any) => !!u && (u.role === "ADMIN" || u.roles?.includes("LOGISTICS_IMPORT") || u.roles?.includes("ADMIN"))

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canUse(session?.user)) return NextResponse.json({ error: "Forbidden — Logistics / Admin only" }, { status: 403 })
  const body = await req.json().catch(() => ({}))

  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []
  if (!ids.length) return NextResponse.json({ error: "เลือกเอกสารอย่างน้อย 1 ใบ" }, { status: 400 })
  const phase: FwdPhase = body.phase === 2 ? 2 : 1
  const fwdName = String(body.fwdName || "").trim()
  const fwdEmail = String(body.fwdEmail || "").trim().toLowerCase()
  if (!fwdEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fwdEmail)) return NextResponse.json({ error: "กรอกอีเมล Forwarder ให้ถูกต้อง" }, { status: 400 })

  const docs = await (prisma as any).pullMaterialRequest.findMany({ where: { id: { in: ids } }, include: { items: true }, orderBy: { documentNo: "asc" } })
  if (!docs.length) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 })
  // LG must have CONFIRMED the shipping mode first (they are the final say) — that decides whether the
  // shipment even goes by air, and the whole template is an air template.
  const noMode = docs.filter((d: any) => !d.shipMode)
  const air = docs.filter((d: any) => d.shipMode === "AIR")
  if (!air.length) {
    return NextResponse.json({
      error: noMode.length
        ? `ยังไม่ได้ยืนยัน mode ขนส่ง ${noMode.length} ใบ — เปิดเอกสารแล้วกด “ยืนยัน mode (LG ชี้ขาด)” ก่อนส่งให้ FWD`
        : "เอกสารที่เลือกไม่มีใบที่เป็น AIR (Sea/Courier ให้ LG กรอกเอง)",
      noMode: noMode.map((d: any) => d.documentNo),
    }, { status: 400 })
  }

  // Preview: build the very workbook that WOULD be mailed and return it — nothing is sent or saved.
  if (body.preview) {
    const previewBuf = await buildFwdWorkbook(air, phase)
    const name = air.length === 1 ? `${air[0].documentNo}_FWD_P${phase}.xlsx` : `RM_AIR_FWD_P${phase}_preview.xlsx`
    return new NextResponse(new Uint8Array(previewBuf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "X-Doc-Count": String(air.length),
      },
    })
  }

  const actorEmail = (session!.user as any).email as string | undefined
  const actorName = ((session!.user as any).name || actorEmail || "Logistics") as string
  const buf = await buildFwdWorkbook(air, phase)
  const stamp = new Date().toISOString().slice(0, 10)
  const fileName = air.length === 1 ? `${air[0].documentNo}_FWD_P${phase}.xlsx` : `RM_AIR_FWD_P${phase}_${stamp}.xlsx`

  // Subject + opening detail are LG's to change (defaults come from the shared mail builder).
  const subject = String(body.subject || "").trim() || fwdMailSubject(phase, air)
  const html = fwdMailHtml({
    docs: air, phase, fwdName, fileName, actorName,
    detail: String(body.detail || "").trim() || undefined,
    note: String(body.note || "").trim() || undefined,
  })

  // Everyone at the forwarder who should get it: the main address, the CC list LG keeps in MASTER FWD
  // (or typed in the dialog), and the LG user themselves as a copy.
  const ccList = (Array.isArray(body.cc) ? body.cc : String(body.cc || "").split(/[,;\s]+/))
    .map((e: any) => String(e || "").trim().toLowerCase())
    .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e !== fwdEmail)
  const to = [...new Set([fwdEmail, ...ccList, ...(actorEmail ? [actorEmail.toLowerCase()] : [])])]
  const testTo = air.every((d: any) => d.isTest) ? (actorEmail || null) : null
  await runWithTestMail(testTo, () =>
    sendMail(to, subject, html,
      [{ filename: fileName, contentBase64: buf.toString("base64"), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }])
  )

  await (prisma as any).pullMaterialRequest.updateMany({
    where: { id: { in: air.map((d: any) => d.id) } },
    data: { fwdName: fwdName || null, fwdEmail, fwdSentAt: new Date(), fwdSentBy: actorEmail || null, fwdPhase: phase },
  })
  // fwdSentCount is per-doc, so bump it one by one.
  for (const d of air) {
    await (prisma as any).pullMaterialRequest.update({ where: { id: d.id }, data: { fwdSentCount: { increment: 1 } } }).catch(() => {})
  }
  if (fwdName) {
    await (prisma as any).pullForwarder.upsert({ where: { name: fwdName }, update: { email: fwdEmail }, create: { name: fwdName, email: fwdEmail } }).catch(() => {})
  }

  return NextResponse.json({
    ok: true, sentTo: to, fileName, count: air.length, phase,
    skipped: docs.length - air.length,
    skippedNoMode: noMode.map((d: any) => d.documentNo),          // never confirmed by LG
    skippedNotAir: docs.filter((d: any) => d.shipMode && d.shipMode !== "AIR").map((d: any) => d.documentNo),
  })
}
