export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { supabase, BUCKET } from "@/lib/supabase-storage"
import React from "react"
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica" },
  title: { fontSize: 13, fontWeight: "bold", marginBottom: 2 },
  sub: { fontSize: 8, color: "#666", marginBottom: 12 },
  section: { marginBottom: 14 },
  hawbHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#1e3a5f", color: "#fff", padding: "5 8", borderRadius: 3, marginBottom: 4
  },
  hawbTitle: { fontSize: 9, fontWeight: "bold", color: "#fff" },
  hawbMeta: { fontSize: 7.5, color: "#cce" },
  statsRow: {
    flexDirection: "row", gap: 12,
    backgroundColor: "#f0f4ff", padding: "4 8", marginBottom: 6,
    borderRadius: 2
  },
  statItem: { flexDirection: "row", gap: 4 },
  statLabel: { color: "#555" },
  statValue: { fontWeight: "bold" },
  table: { width: "100%" },
  thead: { flexDirection: "row", backgroundColor: "#f5f5f5", borderBottom: "1 solid #ddd" },
  tbody: {},
  tr: { flexDirection: "row", borderBottom: "0.5 solid #eee" },
  th: { padding: "3 4", color: "#444", fontWeight: "bold" },
  td: { padding: "3 4" },
  colSO:    { width: "11%" },
  colStyle: { width: "13%" },
  colPO:    { width: "13%" },
  colClaim: { width: "10%" },
  colInv:   { width: "12%" },
  colQty:   { width: "8%", textAlign: "right" },
  colVWT:   { width: "8%", textAlign: "right" },
  colAVG:   { width: "12%", textAlign: "right" },
  colAmt:   { width: "13%", textAlign: "right" },
  totalRow: { flexDirection: "row", backgroundColor: "#f9f9f9", borderTop: "1 solid #ccc", marginTop: 2 },
  totalLabel: { width: "75%", padding: "3 4", fontWeight: "bold", textAlign: "right", color: "#333" },
  totalValue: { width: "13%", padding: "3 4", fontWeight: "bold", textAlign: "right" },
  footer: { position: "absolute", bottom: 16, left: 24, right: 24, flexDirection: "row", justifyContent: "space-between", color: "#aaa", fontSize: 7 },
})

function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return "—"
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function ReportDoc({ request, hawbs }: { request: any; hawbs: any[] }) {
  const allItems = hawbs.flatMap(h => h.items)
  const grandTotal = allItems.reduce((s: number, i: any) => s + (i.actualAirFreight ?? 0), 0)

  return React.createElement(Document, {},
    React.createElement(Page, { size: "A4", orientation: "landscape", style: styles.page },
      React.createElement(Text, { style: styles.title }, `Logistics Air Freight Report — ${request.documentNo}`),
      React.createElement(Text, { style: styles.sub },
        `Brand: ${request.brandName}  ·  BU: ${request.buName}  ·  Date: ${new Date().toLocaleDateString("th-TH")}`
      ),

      ...hawbs.map((hawb: any) => {
        const totalQty = hawb.items.reduce((s: number, i: any) => s + (i.qtyActualShip ?? i.qtyRequestAir), 0)
        const totalVWT = hawb.items.reduce((s: number, i: any) => s + (i.grossWeight ?? 0), 0)
        const costPerPc = totalQty > 0 ? hawb.totalCharge / totalQty : 0
        const hawbTotal = hawb.items.reduce((s: number, i: any) => s + (i.actualAirFreight ?? 0), 0)

        return React.createElement(View, { key: hawb.id, style: styles.section },
          React.createElement(View, { style: styles.hawbHeader },
            React.createElement(Text, { style: styles.hawbTitle }, `HAWB: ${hawb.hawbNo}`),
            React.createElement(Text, { style: styles.hawbMeta },
              `Total Charge: ${fmt(hawb.totalCharge)} THB  ·  PCS/HAWB: ${totalQty}  ·  AVG/PC: ${fmt(costPerPc)} THB`
            )
          ),
          React.createElement(View, { style: styles.table },
            React.createElement(View, { style: styles.thead },
              React.createElement(Text, { style: [styles.th, styles.colSO] }, "SO"),
              React.createElement(Text, { style: [styles.th, styles.colStyle] }, "STYLE"),
              React.createElement(Text, { style: [styles.th, styles.colPO] }, "PO"),
              React.createElement(Text, { style: [styles.th, styles.colClaim] }, "CLAIM TO"),
              React.createElement(Text, { style: [styles.th, styles.colInv] }, "INV NO"),
              React.createElement(Text, { style: [styles.th, styles.colQty] }, "QTY"),
              React.createElement(Text, { style: [styles.th, styles.colVWT] }, "VWT(KG)"),
              React.createElement(Text, { style: [styles.th, styles.colAVG] }, "AVG/PC (THB)"),
              React.createElement(Text, { style: [styles.th, styles.colAmt] }, "AIR CHARGE (THB)")
            ),
            ...hawb.items.map((item: any) =>
              React.createElement(View, { key: item.id, style: styles.tr },
                React.createElement(Text, { style: [styles.td, styles.colSO] }, item.so),
                React.createElement(Text, { style: [styles.td, styles.colStyle] }, item.style),
                React.createElement(Text, { style: [styles.td, styles.colPO] }, item.customerPO || "—"),
                React.createElement(Text, { style: [styles.td, styles.colClaim] }, item.claimDepartment || "—"),
                React.createElement(Text, { style: [styles.td, styles.colInv] }, item.invoiceNo || "—"),
                React.createElement(Text, { style: [styles.td, styles.colQty] }, String(item.qtyActualShip ?? item.qtyRequestAir)),
                React.createElement(Text, { style: [styles.td, styles.colVWT] }, fmt(item.grossWeight, 2)),
                React.createElement(Text, { style: [styles.td, styles.colAVG] }, fmt(costPerPc)),
                React.createElement(Text, { style: [styles.td, styles.colAmt] }, fmt(item.actualAirFreight))
              )
            ),
            React.createElement(View, { style: styles.totalRow },
              React.createElement(Text, { style: styles.totalLabel }, `Total (${hawb.items.length} SO, PCS: ${totalQty}, VWT: ${fmt(totalVWT, 2)} kg)`),
              React.createElement(Text, { style: styles.totalValue }, `${fmt(hawbTotal)} THB`)
            )
          )
        )
      }),

      React.createElement(View, { style: [styles.totalRow, { marginTop: 8 }] },
        React.createElement(Text, { style: styles.totalLabel }, `GRAND TOTAL (${hawbs.length} HAWB, ${allItems.length} SO)`),
        React.createElement(Text, { style: styles.totalValue }, `${fmt(grandTotal)} THB`)
      ),

      React.createElement(View, { style: styles.footer },
        React.createElement(Text, {}, `Generated: ${new Date().toLocaleString("th-TH")}`),
        React.createElement(Text, {}, "Nan Yang Textile — Air Request System")
      )
    )
  )
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role
  if (role !== "LOGISTICS") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const request = await prisma.airRequest.findUnique({ where: { id }, select: { documentNo: true, brandName: true, buName: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const hawbs = await prisma.hawbGroup.findMany({
    where: { requestId: id },
    include: {
      items: {
        select: {
          id: true, so: true, style: true, customerPO: true, claimDepartment: true,
          invoiceNo: true, qtyRequestAir: true, qtyActualShip: true,
          grossWeight: true, actualAirFreight: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  })

  if (hawbs.length === 0) return NextResponse.json({ error: "ยังไม่มี HAWB" }, { status: 400 })

  const buffer = await renderToBuffer(React.createElement(ReportDoc, { request, hawbs }) as React.ReactElement<any>)

  const fileName = `LG_Report_${request.documentNo}_${Date.now()}.pdf`
  const storagePath = `${id}/${fileName}`

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: "application/pdf", upsert: true
  })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const attachment = await prisma.requestAttachment.create({
    data: {
      requestId: id,
      uploadedById: userId,
      fileName,
      filePath: storagePath,
      fileSize: buffer.length,
      mimeType: "application/pdf",
      claimDept: "LOGISTICS",
    },
    include: { uploadedBy: { select: { name: true, role: true } } }
  })

  return NextResponse.json(attachment)
}
