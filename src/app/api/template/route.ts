import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function GET(req: NextRequest) {
  const bu = req.nextUrl.searchParams.get("bu") || "NYG"
  const isGW = bu === "GW"

  const headers = isGW
    ? [
        "No_Document", "Brand name", "BU", "STYLE", "SO", "SUB",
        "CUSTOMER PO", "DESCRIPTION", "WEIGHT(KG)",
        "Original Shipment Date", "Plan Shipment Date",
        "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)",
        "Reason delay", "Claim", "Country", "Port", "%Claim",
        "INV NO.", "HAWB#", "HAWB Total Cost (THB)", "Actual Airfreight",
      ]
    : [
        "No_Document", "Brand name", "BU", "STYLE", "SO", "SUB",
        "CUSTOMER PO", "DESCRIPTION", "WEIGHT(KG)",
        "Original Shipment Date", "Plan Shipment Date",
        "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)",
        "Reason delay", "Factory", "Country", "Port", "%Claim",
        "INV NO.", "HAWB#", "HAWB Total Cost (THB)", "Actual Airfreight",
      ]

  const ws = XLSX.utils.aoa_to_sheet([headers])

  const colWidths = [16, 16, 6, 14, 12, 8, 14, 24, 10, 20, 20, 22, 22, 16, 14, 12, 12, 8, 16, 16, 18, 16]
  ws["!cols"] = colWidths.map(w => ({ wch: w }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, isGW ? "GW" : "NYG")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="air-request-template_${bu}.xlsx"`,
    },
  })
}
