import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { REF_COLS, FILL_COLS, FWD_SHEET, REF_FILL, FILL_FILL, refRow } from "@/lib/pull-fwd-template"

// ── Pull RM Phase 2 ────────────────────────────────────────────────────────────────────────────
// LG mails the FORWARDER a workbook: grey columns = the shipment data we already have, green columns
// = what the FWD fills in (MAWB / HAWB / ETD / ETA / actual freight …). The FWD mails it back and LG
// imports it on the LOGISTICS page — so the ACTUAL can come from LG (Phase 1) or the FWD (Phase 2)
// without changing the document flow.
// AIR only: Sea / Courier docs stay on manual LG entry for now.

const canUse = (u: any) => !!u && (u.role === "ADMIN" || u.roles?.includes("LOGISTICS_IMPORT") || u.roles?.includes("ADMIN"))

// Build the .xlsx template for one document (1 shipment / 1 doc → one data row).
async function buildWorkbook(doc: any): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(FWD_SHEET)
  const headers = [...REF_COLS.map(c => c.header), ...FILL_COLS.map(c => c.header), "_DOCID"]
  const widths = [...REF_COLS.map(c => c.width), ...FILL_COLS.map(c => c.width), 26]
  const refCount = REF_COLS.length

  const hr = ws.addRow(headers)
  hr.height = 30
  headers.forEach((_, i) => {
    const c = hr.getCell(i + 1)
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i >= refCount && i < headers.length - 1 ? FILL_FILL : REF_FILL } }
    c.font = { bold: true, size: 10 }
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
  })
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.views = [{ state: "frozen", ySplit: 1 }]

  // Hint row so the FWD knows the expected format, then the real data row.
  const hints = [...REF_COLS.map(() => ""), ...FILL_COLS.map(c => c.hint || ""), ""]
  if (hints.some(Boolean)) {
    const hrow = ws.addRow(hints)
    hrow.font = { italic: true, size: 9, color: { argb: "FF9CA3AF" } }
  }
  ws.addRow([...refRow(doc), ...FILL_COLS.map(() => ""), doc.id])
  ws.getColumn(headers.length).hidden = true // _DOCID — used by the importer to match the doc
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!canUse(session?.user)) return NextResponse.json({ error: "Forbidden — Logistics / Admin only" }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const doc = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, include: { items: true } })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if ((doc.shipMode || doc.approvedMode || "AIR") !== "AIR") {
    return NextResponse.json({ error: "Phase 2 (FWD template) รองรับเฉพาะ mode AIR — mode อื่นให้ LG กรอก actual เอง" }, { status: 400 })
  }

  const fwdName = String(body.fwdName || doc.fwdName || doc.preCostFwd || "").trim()
  const fwdEmail = String(body.fwdEmail || doc.fwdEmail || "").trim().toLowerCase()
  if (!fwdEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fwdEmail)) return NextResponse.json({ error: "กรอกอีเมล Forwarder ให้ถูกต้องก่อนส่ง" }, { status: 400 })
  const actorEmail = (session!.user as any).email as string | undefined
  const actorName = ((session!.user as any).name || actorEmail || "Logistics") as string

  const buf = await buildWorkbook(doc)
  const fileName = `${doc.documentNo}_FWD.xlsx`
  const i0 = (doc.items || []).find((x: any) => x.airFreightCost != null) || (doc.items || [])[0] || {}
  const note = String(body.note || "").trim()

  const rows = [
    ["Document", `${doc.documentNo} (${doc.bu})`],
    ["Origin / Country", [i0.port, i0.country].filter(Boolean).join(" · ") || "-"],
    ["Incoterm", i0.incoterm || "-"],
    ["Weight (kg)", i0.weight != null ? String(i0.weight) : "-"],
    ["Need date (in-house)", i0.needDate ? new Date(i0.needDate).toLocaleDateString("en-GB") : "-"],
  ].map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b7280">${k}</td><td><b>${v}</b></td></tr>`).join("")

  const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
    <h2 style="color:#6b1a1a;margin:0 0 10px">Air shipment — please fill in the actual details</h2>
    <p>Dear ${fwdName || "Forwarder"},</p>
    <p>Please complete the <b>green columns</b> in the attached file (<b>${fileName}</b>) and reply to this mail with the file attached.<br/>
    The grey columns are for reference — please do not change them (the hidden <i>_DOCID</i> column must stay).</p>
    <table style="border-collapse:collapse;font-size:13px;margin:10px 0">${rows}</table>
    <p style="margin:10px 0 4px;color:#6b7280">Columns to fill:</p>
    <p style="margin:0"><b>${FILL_COLS.map(c => c.header).join(" · ")}</b></p>
    ${note ? `<p style="margin-top:12px;padding:10px;background:#f8fafc;border-left:3px solid #6b1a1a"><b>Note from ${actorName}:</b><br/>${note.replace(/</g, "&lt;")}</p>` : ""}
    <p style="color:#9ca3af;font-size:12px;margin-top:14px">Sent by ${actorName} · Nan Yang Textile — Logistics Import</p>
  </div>`

  const to = [fwdEmail, ...(body.cc ? [String(body.cc).trim().toLowerCase()] : []), ...(actorEmail ? [actorEmail] : [])]
  const testTo = doc.isTest ? (actorEmail || null) : null
  await runWithTestMail(testTo, () =>
    sendMail(to, `[Pull Material] Air shipment actual — ${doc.documentNo}`, html,
      [{ filename: fileName, contentBase64: buf.toString("base64"), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }])
  )

  await (prisma as any).pullMaterialRequest.update({
    where: { id },
    data: { fwdName: fwdName || null, fwdEmail, fwdSentAt: new Date(), fwdSentBy: actorEmail || null, fwdSentCount: { increment: 1 } },
  })
  // Remember the contact so the next doc can pick it from the list.
  if (fwdName) {
    await (prisma as any).pullForwarder.upsert({
      where: { name: fwdName }, update: { email: fwdEmail }, create: { name: fwdName, email: fwdEmail },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, sentTo: to, fileName })
}
