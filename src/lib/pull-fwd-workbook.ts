// Builds the .xlsx LG mails to the forwarder (and that LG imports back). Shared by the API and the
// preview script so the example file is byte-for-byte the same shape as the real one.
import { REF_COLS, FILL_COLS, FWD_SHEET, REF_FILL, FILL_FILL, LOCK_FILL, refRow, fillRow, type FwdPhase } from "@/lib/pull-fwd-template"

// One row per shipment. Columns of the OTHER phase are locked grey so the FWD fills only what is due.
export async function buildFwdWorkbook(docs: any[], phase: FwdPhase): Promise<Buffer> {
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
