import ExcelJS from "exceljs"

// ── Color palette ──────────────────────────────────────────────
const C = {
  pink:   "FFCCE5",  // system gen — ระบบ fill
  green:  "E2EFDA",  // dropdown — เลือกจาก list
  white:  "FFFFFF",  // manual — กรอกเอง
  yellow: "FFF2CC",  // LG fills — Logistics กรอก
  headerText: "1F1F1F",
  border: { style: "thin", color: { argb: "FFCCCCCC" } },
}

// ── Shared reference data (update to match master data) ────────
const REF = {
  brands:       ["FANATICS", "LSKD", "JR286", "ASICS", "PUMA"],
  factories:    ["G3", "G4", "G5", "CM1", "CM2", "CM3"],
  descriptions: ["T-SHIRT", "POLO SHIRT", "SHORTS", "JACKET", "PANTS", "HOODIE"],
  countries:    ["USA", "UK", "AUSTRALIA", "JAPAN", "GERMANY", "FRANCE", "CANADA"],
  ports:        [
    "LOS ANGELES, CA, USA", "NEW YORK, NY, USA", "MIAMI, FL, USA",
    "SYDNEY, NSW, AUSTRALIA", "MELBOURNE, VIC, AUSTRALIA",
    "LONDON, UK", "TOKYO, JAPAN", "FRANKFURT, GERMANY",
  ],
  claimDepts:   ["NYK", "NYG", "GW", "Supplier ใน", "Supplier นอก"],
}

// ── Column definitions ─────────────────────────────────────────
const BASE_COLS = [
  { header: "No_Document",                  color: "pink",   width: 18 },
  { header: "Brand name",                   color: "green",  width: 16, ref: "brands" },
  { header: "BU",                           color: "green",  width: 10 },
  { header: "STYLE",                        color: "white",  width: 14 },
  { header: "SO",                           color: "white",  width: 14 },
  { header: "CUSTOMER PO",                  color: "white",  width: 14 },
  { header: "DESCRIPTION",                  color: "green",  width: 28, ref: "descriptions" },
  { header: "WEIGHT(KG)",                   color: "white",  width: 12 },
  { header: "Original Shipment Date",       color: "white",  width: 22 },
  { header: "Plan Shipment Date",           color: "white",  width: 22 },
  { header: "QTY Original Shipment (pcs)",  color: "white",  width: 24 },
  { header: "QTY Request ship Air (pcs)",   color: "white",  width: 24 },
  { header: "Reason delay",                 color: "white",  width: 20 },
]

const NYG_COLS = [
  ...BASE_COLS,
  { header: "Factory",         color: "green",  width: 14, ref: "factories" },
  { header: "Country",         color: "green",  width: 16, ref: "countries" },
  { header: "Port",            color: "green",  width: 28, ref: "ports" },
  { header: "%Claim",          color: "pink",   width: 10 },
  { header: "INV NC",          color: "yellow", width: 16 },
  { header: "Actual Airfreight", color: "yellow", width: 18 },
]

const GW_COLS = [
  ...BASE_COLS,
  { header: "Claim",           color: "green",  width: 20, ref: "claimDepts" },
  { header: "Country",         color: "green",  width: 16, ref: "countries" },
  { header: "Port",            color: "green",  width: 28, ref: "ports" },
  { header: "%Claim",          color: "pink",   width: 10 },
  { header: "INV NC",          color: "yellow", width: 16 },
  { header: "Actual Airfreight", color: "yellow", width: 18 },
]

// ── Build one workbook ─────────────────────────────────────────
async function buildTemplate(bu, cols) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Air Request System"
  wb.created = new Date()

  // ── Reference sheet (hidden) ───────────────────────────────
  const refWs = wb.addWorksheet("_Ref", { state: "veryHidden" })
  const refCols = Object.keys(REF)
  refCols.forEach((key, ci) => {
    const values = REF[key]
    const colLetter = String.fromCharCode(65 + ci)
    refWs.getCell(`${colLetter}1`).value = key
    values.forEach((v, ri) => { refWs.getCell(`${colLetter}${ri + 2}`).value = v })
  })

  // ── Legend sheet ───────────────────────────────────────────
  const legWs = wb.addWorksheet("คำอธิบาย")
  const legend = [
    ["สี", "ความหมาย", "ผู้กรอก"],
    ["สีชมพู",  "ระบบ Generate อัตโนมัติ", "ไม่ต้องกรอก"],
    ["สีเขียว", "Dropdown — เลือกจากรายการ", "MER"],
    ["ขาว",     "กรอกข้อมูลเอง (Manual)",    "MER"],
    ["สีเหลือง","Logistics กรอกภายหลัง",     "Logistics"],
  ]
  legend.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const cell = legWs.getCell(ri + 1, ci + 1)
      cell.value = val
      if (ri === 0) {
        cell.font = { bold: true, color: { argb: "FF" + C.headerText } }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.headerText } }
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      }
      if (ri > 0 && ci === 0) {
        const colors = { สีชมพู: C.pink, สีเขียว: C.green, ขาว: C.white, สีเหลือง: C.yellow }
        const bg = colors[val] || "FFFFFF"
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bg } }
        cell.border = {
          top: C.border, bottom: C.border, left: C.border, right: C.border
        }
      }
    })
  })
  legWs.getColumn(1).width = 14
  legWs.getColumn(2).width = 32
  legWs.getColumn(3).width = 20

  // ── Main data sheet ────────────────────────────────────────
  const ws = wb.addWorksheet(`Air Request ${bu}`)

  // Set column widths + headers
  cols.forEach((col, i) => {
    const wsCol = ws.getColumn(i + 1)
    wsCol.width = col.width

    const cell = ws.getCell(1, i + 1)
    cell.value = col.header
    cell.font = { bold: true, size: 10, color: { argb: "FF" + C.headerText } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + col.color } }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false }
    cell.border = {
      top: C.border, bottom: { style: "medium", color: { argb: "FF999999" } },
      left: C.border, right: C.border,
    }
  })
  ws.getRow(1).height = 28

  // Freeze header row
  ws.views = [{ state: "frozen", ySplit: 1 }]

  // Data rows (2–500) — style + validation
  for (let row = 2; row <= 500; row++) {
    cols.forEach((col, ci) => {
      const cell = ws.getCell(row, ci + 1)

      // Background for non-editable columns
      if (col.color === "pink" || col.color === "yellow") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + col.color } }
      }

      // Dropdown validation
      if (col.ref) {
        const refColIdx = Object.keys(REF).indexOf(col.ref)
        if (refColIdx >= 0) {
          const letter = String.fromCharCode(65 + refColIdx)
          const count = REF[col.ref].length
          cell.dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [`_Ref!$${letter}$2:$${letter}$${count + 1}`],
            showErrorMessage: true,
            errorTitle: "Invalid value",
            error: `กรุณาเลือกจาก dropdown`,
          }
        }
      }

      // BU dropdown inline
      if (col.header === "BU") {
        cell.dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`"${bu}"`],
          showErrorMessage: true,
          errorTitle: "BU ไม่ถูกต้อง",
          error: `Template นี้ใช้สำหรับ ${bu} เท่านั้น`,
        }
        cell.value = bu
      }

      // Date format
      if (col.header.includes("Date")) {
        cell.numFmt = "dd/mm/yyyy"
      }
    })
  }

  return wb
}

// ── Generate both templates ────────────────────────────────────
async function main() {
  console.log("Generating templates...")

  const nygWb = await buildTemplate("NYG", NYG_COLS)
  await nygWb.xlsx.writeFile("public/air-request-template_NYG.xlsx")
  console.log("✅ public/air-request-template_NYG.xlsx")

  const gwWb = await buildTemplate("GW", GW_COLS)
  await gwWb.xlsx.writeFile("public/air-request-template_GW.xlsx")
  console.log("✅ public/air-request-template_GW.xlsx")

  console.log("\nDone! 2 templates generated.")
  console.log("Color guide: 🩷 Pink=system  🟢 Green=dropdown  ⬜ White=manual  🟡 Yellow=LG")
}

main().catch(console.error)
