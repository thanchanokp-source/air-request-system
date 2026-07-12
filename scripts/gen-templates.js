// Regenerate the MER upload templates (public/air-request-template_{NYG,GW}.xlsx).
// Layout: Row 1 = merged "who owns which part" section labels, Row 2 = column headers.
// No "Reason delay" column (reason is captured by REASON 1/2/3 at the back).
// Run:  node scripts/gen-templates.js   (close the files in Excel first, or it will be EBUSY)
const ExcelJS = require("exceljs")

const COLS = [
  "No_Document", "Brand name", "BU", "STYLE", "SO", "SUB", "CUSTOMER PO", "DESCRIPTION", "WEIGHT(KG)",
  "Original Shipment Date", "Plan Shipment Date", "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)",
  "Factory", "Country", "Port", "INV NO.", "HAWB#", "Total HAWB#",
  "CLAIM DEPT 1", "%CLAIM1", "ACTUAL AIRFREIGHT1", "REASON 1",
  "CLAIM DEPT 2", "%CLAIM2", "ACTUAL AIRFREIGHT2", "REASON 2",
  "CLAIM DEPT 3", "%CLAIM3", "ACTUAL AIRFREIGHT3", "REASON 3",
]

const SECTIONS = [
  [1, 1, "DOCUMENT", "FF64748B"],
  [2, 16, "MER — FILL BEFORE UPLOAD", "FF1E3A8A"],
  [17, 19, "LOGISTICS — INVOICE / HAWB", "FFB45309"],
  [20, 31, "CLAIM & ACTUAL AIR FREIGHT", "FF15803D"],
]

const colLetter = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }

async function gen(bu) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Air Request")

  for (const [s, e, label, argb] of SECTIONS) {
    if (e > s) ws.mergeCells(`${colLetter(s)}1:${colLetter(e)}1`)
    for (let c = s; c <= e; c++) {
      const cell = ws.getCell(1, c)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = { bottom: { style: "thin", color: { argb: "FFFFFFFF" } }, right: { style: "thin", color: { argb: "FFFFFFFF" } } }
    }
    ws.getCell(1, s).value = label
  }

  COLS.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1)
    cell.value = h
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }
    cell.font = { bold: true, color: { argb: "FF1E293B" }, size: 10 }
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
    cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } }
    ws.getColumn(i + 1).width = Math.min(Math.max(h.length + 3, 12), 26)
  })

  ws.getRow(1).height = 22
  ws.getRow(2).height = 30
  ws.views = [{ state: "frozen", ySplit: 2 }]

  await wb.xlsx.writeFile(`public/air-request-template_${bu}.xlsx`)
  console.log(`OK  ${bu}`)
}

;(async () => {
  for (const bu of ["NYG", "GW"]) {
    try { await gen(bu) } catch (e) { console.log(`FAIL ${bu}: ${e.message} (close the file in Excel and re-run)`) }
  }
})()
