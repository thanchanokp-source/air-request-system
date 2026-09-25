import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { REF_COLS, FILL_COLS, FWD_SHEET, REF_FILL, FILL_FILL, LOCK_FILL, refRow, fillRow, type FwdPhase } from "@/lib/pull-fwd-template"

// ── Pull RM Phase 2 — mail ONE workbook covering MANY documents ────────────────────────────────
// LG filters the queue (BU / ETC range / port / brand …), ticks the shipments, picks the forwarder
// and the phase, and sends. The FWD gets a single sheet with one row per shipment.
//   phase 1 = booking info (MAWB / HAWB / ETD / ETA / CFM in-house / rate THB per kg / supplier INV)
//   phase 2 = the actual once it has landed (actual air freight / local charge / remark)
// Columns of the other phase are locked grey, so nothing is filled in at the wrong time.

const canUse = (u: any) => !!u && (u.role === "ADMIN" || u.roles?.includes("LOGISTICS_IMPORT") || u.roles?.includes("ADMIN"))

async function buildWorkbook(docs: any[], phase: FwdPhase): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(FWD_SHEET)
  const headers = [...REF_COLS.map(c => c.header), ...FILL_COLS.map(c => c.header), "_DOCID"]
  const widths = [...REF_COLS.map(c => c.width), ...FILL_COLS.map(c => c.width), 26]
  const refCount = REF_COLS.length
  const thin = { style: "thin" as const, color: { argb: "FFBFBFBF" } }
  // Which colour a column gets: reference grey · this-phase green · other-phase locked grey.
  const fillOf = (i: number) => {
    if (i < refCount || i === headers.length - 1) return REF_FILL
    return FILL_COLS[i - refCount].phase === phase ? FILL_FILL : LOCK_FILL
  }

  const hr = ws.addRow(headers)
  hr.height = 30
  headers.forEach((_, i) => {
    const c = hr.getCell(i + 1)
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillOf(i) } }
    c.font = { bold: true, size: 10, color: { argb: i >= refCount && i < headers.length - 1 && FILL_COLS[i - refCount].phase !== phase ? "FFAAAAAA" : "FF000000" } }
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    c.border = { top: thin, bottom: thin, left: thin, right: thin }
  })
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.views = [{ state: "frozen", ySplit: 2, xSplit: 2 }]

  // Format hint row — only for the columns due this phase.
  const hints = headers.map((_, i) => {
    if (i < refCount || i === headers.length - 1) return ""
    const c = FILL_COLS[i - refCount]
    return c.phase === phase ? (c.hint || (c.type === "number" ? "number" : "")) : "phase " + c.phase
  })
  const hintRow = ws.addRow(hints)
  hintRow.font = { italic: true, size: 9, color: { argb: "FF9CA3AF" } }

  for (const doc of docs) {
    const row = ws.addRow([...refRow(doc), ...fillRow(doc), doc.id])
    headers.forEach((_, i) => {
      const c = row.getCell(i + 1)
      c.border = { top: thin, bottom: thin, left: thin, right: thin }
      if (i >= refCount && i < headers.length - 1) {
        const col = FILL_COLS[i - refCount]
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col.phase === phase ? "FFF6FBF3" : LOCK_FILL } }
      }
    })
  }
  ws.getColumn(headers.length).hidden = true // _DOCID — matches the row back to its document
  return Buffer.from(await wb.xlsx.writeBuffer())
}

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

  const actorEmail = (session!.user as any).email as string | undefined
  const actorName = ((session!.user as any).name || actorEmail || "Logistics") as string
  const buf = await buildWorkbook(air, phase)
  const stamp = new Date().toISOString().slice(0, 10)
  const fileName = air.length === 1 ? `${air[0].documentNo}_FWD_P${phase}.xlsx` : `RM_AIR_FWD_P${phase}_${stamp}.xlsx`

  const ask = phase === 1
    ? "MAWB / HAWB / FLIGHT ETD / FLIGHT ETA / CFM IN-HOUSE DATE / AIR FREIGHT (THB) per KG / SUPPLIER INV"
    : "ACTUAL AIR FREIGHT (THB) / LOCAL CHARGE TH (THB) / REMARK"
  const rows = air.map((d: any) => {
    const i0 = (d.items || []).find((x: any) => x.airFreightCost != null) || (d.items || [])[0] || {}
    const pos = [...new Set((d.items || []).map((x: any) => x.poNoDoc).filter(Boolean))].join(", ")
    return `<tr><td style="padding:3px 12px 3px 0">${pos || "-"}</td><td style="padding:3px 12px 3px 0">${i0.port || "-"}</td>` +
      `<td style="padding:3px 12px 3px 0">${i0.weight != null ? i0.weight : "-"} kg</td>` +
      `<td>${i0.etc ? new Date(i0.etc).toLocaleDateString("en-GB") : "-"}</td></tr>`
  }).join("")

  const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
    <h2 style="color:#6b1a1a;margin:0 0 10px">Air shipments — ${phase === 1 ? "please confirm the booking details" : "please fill in the actual charges"}</h2>
    <p>Dear ${fwdName || "Forwarder"},</p>
    <p>Please complete the <b>green columns</b> in the attached file (<b>${fileName}</b>) and reply with the file attached.<br/>
    Grey columns are reference only — please leave them as they are (the hidden <i>_DOCID</i> column must stay).</p>
    <p style="margin:10px 0 4px"><b>${air.length}</b> shipment(s) · to fill now (phase ${phase}): <b>${ask}</b></p>
    <table style="border-collapse:collapse;font-size:12px;margin:8px 0">
      <tr style="color:#6b7280"><td style="padding-right:12px">PO</td><td style="padding-right:12px">ORIGIN</td><td style="padding-right:12px">WEIGHT</td><td>ETC</td></tr>
      ${rows}
    </table>
    ${phase === 1 ? '<p style="color:#6b7280;font-size:12px">The actual charges will be requested again once the goods have arrived.</p>' : ""}
    ${body.note ? `<p style="margin-top:12px;padding:10px;background:#f8fafc;border-left:3px solid #6b1a1a"><b>Note from ${actorName}:</b><br/>${String(body.note).replace(/</g, "&lt;")}</p>` : ""}
    <p style="color:#9ca3af;font-size:12px;margin-top:14px">Sent by ${actorName} · Nan Yang Textile — Logistics Import</p>
  </div>`

  const to = [fwdEmail, ...(actorEmail ? [actorEmail] : [])]
  const testTo = air.every((d: any) => d.isTest) ? (actorEmail || null) : null
  await runWithTestMail(testTo, () =>
    sendMail(to, `[Pull Material] ${phase === 1 ? "Air booking details" : "Air actual charges"} — ${air.length} shipment(s)`, html,
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
