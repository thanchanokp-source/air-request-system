import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// Serve the upload template with a LIVE "DESCRIPTION" dropdown built from the current Master
// Description list — so every download has the latest options (incl. descriptions another MER
// just added). The dropdown only WARNS (doesn't block) → a MER can still type a brand-new
// description, which then goes through the held-until-weight-added flow (alert LG / jariya).
export async function GET(req: NextRequest) {
  const bu = req.nextUrl.searchParams.get("bu") || "NYG"
  const filename = `air-request-template_${bu}.xlsx`
  const filePath = path.join(process.cwd(), "public", filename)

  let buf: Buffer
  try { buf = await readFile(filePath) }
  catch { return NextResponse.json({ error: "Template not found" }, { status: 404 }) }

  try {
    const descs: any[] = await (prisma as any).masterDescription.findMany({
      where: { isActive: true }, select: { name: true }, orderBy: { name: "asc" },
    })
    const names = descs.map(d => String(d.name)).filter(Boolean)
    if (names.length) {
      const ExcelJSMod: any = await import("exceljs")
      const ExcelJS = ExcelJSMod.default || ExcelJSMod
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)
      const ws = wb.worksheets[0]
      if (ws) {
        // Locate the DESCRIPTION header (scan the first few rows).
        let hdrRow = 0, col = 0
        for (let r = 1; r <= 5 && !col; r++) {
          ws.getRow(r).eachCell((cell: any, c: number) => {
            if (!col && String(cell.value ?? "").trim().toUpperCase() === "DESCRIPTION") { hdrRow = r; col = c }
          })
        }
        if (col > 0) {
          // Options live on a very-hidden sheet (avoids Excel's ~255-char inline list limit).
          let lst = wb.getWorksheet("MASTER_DESC")
          if (!lst) lst = wb.addWorksheet("MASTER_DESC")
          lst.state = "veryHidden"
          names.forEach((n, i) => { lst.getCell(i + 1, 1).value = n })
          const ref = `MASTER_DESC!$A$1:$A$${names.length}`
          for (let r = hdrRow + 1; r <= hdrRow + 1000; r++) {
            ws.getCell(r, col).dataValidation = {
              type: "list", allowBlank: true, formulae: [ref],
              showErrorMessage: true, errorStyle: "warning",
              errorTitle: "Not in Master Description",
              error: "Pick from the list — or type a new one (LG / jariya will add its weight).",
            }
          }
          buf = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer)
        }
      }
    }
  } catch {
    // any failure → fall back to the raw static template
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
