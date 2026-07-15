import ExcelJS from "exceljs"

// One-off: remove the "WEIGHT(KG)" column from the existing MER templates. The system no
// longer uses it (Gross = QTY Air × WT Charge/pc from Master Description). We edit the
// EXISTING files in place (via spliceColumns) so all other formatting / dropdowns / the
// merged header stay intact — we do NOT regenerate from the (outdated) generator.
const FILES = [
  "public/air-request-template_NYG.xlsx",
  "public/air-request-template_GW.xlsx",
]

const isWeightHeader = (v) => {
  const s = String((v && v.richText ? v.richText.map(r => r.text).join("") : v) ?? "").trim().toLowerCase()
  return s.replace(/\s+/g, "") === "weight(kg)" || (s.includes("weight") && s.includes("kg"))
}

for (const file of FILES) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  let removed = false
  wb.eachSheet(ws => {
    if (removed) return
    // Find the header row + the WEIGHT column within the first few rows.
    for (let r = 1; r <= 4 && !removed; r++) {
      const row = ws.getRow(r)
      let col = -1
      row.eachCell({ includeEmpty: false }, (cell, c) => { if (col < 0 && isWeightHeader(cell.value)) col = c })
      if (col > 0) {
        ws.spliceColumns(col, 1)   // delete the whole WEIGHT column, shift the rest left
        removed = true
        console.log(`  ${file}: removed WEIGHT column at index ${col} (sheet "${ws.name}", header row ${r})`)
      }
    }
  })
  if (!removed) { console.log(`  ${file}: no WEIGHT column found (nothing changed)`) ; continue }
  await wb.xlsx.writeFile(file)
  console.log(`  ✅ saved ${file}`)
}
console.log("Done.")
