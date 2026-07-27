import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSplits, deptLabel } from "@/lib/claim"

// SCM claim-assignment Excel: MER-upload column layout + SCM claim columns (CLAIM DEPT / %CLAIM /
// REASON=Delay Code / DETAIL, ×3) as REAL in-cell dropdowns (data validation) sourced from a
// "Delay Codes" sheet. Dropdowns are non-strict (SCM may type a value not in the list = "add more").
// Built with exceljs (SheetJS can't emit data validations).
const fmtDate = (v: any) => {
  if (!v) return ""
  const d = new Date(v); if (isNaN(d.getTime())) return ""
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${String(d.getDate()).padStart(2, "0")} ${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const req: any = await prisma.airRequest.findUnique({ where: { id }, include: { items: true } })
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // SCM assigns claim for the styles VP Merchandise passed (not rejected).
  const items = (req.items || []).filter((i: any) => i.itemStatus !== "REJECTED")
  const codes: any[] = await (prisma as any).masterDelayCode.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] })
  const codeList = codes.map(c => c.code)
  // Only NUMBERED definitions (2.1, 3.4 …) — drop header lines like "- PO issued but ...".
  const defList = [...new Set(codes.flatMap(c => (c.definitions || []).filter((d: string) => /^\s*\d/.test(d))))]
  const CLAIM_DEPTS = ["COMMERCIAL", "PRODUCTION", "PROCUREMENT", "NYK"]

  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("SCM")

  const headers = ["No_Document","Brand name","BU","STYLE","SO","SUB","CUSTOMER PO","DESCRIPTION","Original Shipment Date","Plan Shipment Date","QTY Original Shipment (pcs)","QTY Request ship Air (pcs)","Reason delay","Factory","Country","CLAIM DEPT 1","%CLAIM1","REASON 1","DETAIL 1","CLAIM DEPT 2","%CLAIM2","REASON 2","DETAIL 2","CLAIM DEPT 3","%CLAIM3","REASON 3","DETAIL 3"]
  ws.addRow(headers)
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } }

  for (const item of items) {
    const d = getSplits(item)
    ws.addRow([
      req.documentNo || "", req.brandName || item.brand || "", req.bu || "NYG", item.style || "", item.so || "", item.sub || "", item.customerPO || "",
      item.description || "", fmtDate(item.originalShipmentDate), fmtDate(item.planShipmentDate),
      item.qtyOriginalShipment ?? "", item.qtyRequestAir ?? "", item.reasonDelay || "", item.factory || "", item.country || "",
      d[0]?.dept ? deptLabel(d[0].dept) : "", d[0]?.pct ?? "", d[0]?.reason || "", (d[0] as any)?.reasonDetail || "",
      d[1]?.dept ? deptLabel(d[1].dept) : "", d[1]?.pct ?? "", d[1]?.reason || "", (d[1] as any)?.reasonDetail || "",
      d[2]?.dept ? deptLabel(d[2].dept) : "", d[2]?.pct ?? "", d[2]?.reason || "", (d[2] as any)?.reasonDetail || "",
    ])
  }
  const widths = [16,14,6,14,10,8,14,24,18,18,20,20,16,12,12,14,8,18,26,14,8,18,26,14,8,18,26]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  // Reference sheet feeding the dropdowns.
  const lists = wb.addWorksheet("Delay Codes")
  lists.getRow(1).values = ["DELAY CODE", "DETAIL (numbered)", "CLAIM DEPT"]
  lists.getRow(1).font = { bold: true }
  const maxLen = Math.max(codeList.length, defList.length, CLAIM_DEPTS.length)
  for (let i = 0; i < maxLen; i++) {
    lists.getCell(i + 2, 1).value = codeList[i] ?? null
    lists.getCell(i + 2, 2).value = (defList[i] as string) ?? null
    lists.getCell(i + 2, 3).value = CLAIM_DEPTS[i] ?? null
  }
  lists.getColumn(1).width = 26; lists.getColumn(2).width = 80; lists.getColumn(3).width = 16

  // Apply dropdowns to the claim columns for all data rows + spare rows (so SCM can add rows).
  const lastRow = items.length + 50
  const deptCols = ["P", "T", "X"], reasonCols = ["R", "V", "Z"], detailCols = ["S", "W", "AA"]
  const codeRef = `'Delay Codes'!$A$2:$A$${codeList.length + 1}`
  const defRef = `'Delay Codes'!$B$2:$B$${defList.length + 1}`
  const deptRef = `'Delay Codes'!$C$2:$C$${CLAIM_DEPTS.length + 1}`
  const mkDV = (formula: string) => ({ type: "list" as const, allowBlank: true, formulae: [formula], showErrorMessage: false })
  for (let r = 2; r <= lastRow; r++) {
    for (const c of deptCols) ws.getCell(`${c}${r}`).dataValidation = mkDV(deptRef)
    for (const c of reasonCols) ws.getCell(`${c}${r}`).dataValidation = mkDV(codeRef)
    for (const c of detailCols) ws.getCell(`${c}${r}`).dataValidation = mkDV(defRef)
  }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="scm-claim-dept_${req.documentNo}.xlsx"`,
    },
  })
}
