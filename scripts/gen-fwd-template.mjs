// Generate the FORWARDER template workbook (Pull RM Phase 2 — AIR actual entry).
//   node scripts/gen-fwd-template.mjs                 -> docs/templates/FWD_ACTUAL_template.xlsx (blank)
//   node scripts/gen-fwd-template.mjs --sample        -> ..._sample.xlsx (grey columns filled, like a real mail)
//   node scripts/gen-fwd-template.mjs D:\out\fwd.xlsx
//
// Columns come from src/lib/pull-fwd-template.ts — the SAME config the app mails out and imports
// back — so this file can never drift from what the system expects. The TS file is compiled to a
// temp .mjs first (no ts-node needed).
import { execFileSync } from "child_process"
import { mkdirSync, rmSync, existsSync } from "fs"
import { dirname, join, resolve } from "path"
import { fileURLToPath, pathToFileURL } from "url"
import ExcelJS from "exceljs"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")
const tmp = join(here, ".tmp-fwd")
const args = process.argv.slice(2)
const SAMPLE = args.includes("--sample")
const PHASE = args.includes("--phase2") ? 2 : 1   // which half of the sheet is open for typing
const pathArg = args.find(a => !a.startsWith("--"))
const out = resolve(pathArg || join(root, "docs", "templates", (SAMPLE ? "FWD_ACTUAL_sample" : "FWD_ACTUAL_template") + "_P" + PHASE + ".xlsx"))

// A real document, exactly as the system would mail it (grey columns already filled in).
// Kept here only as an EXAMPLE for showing the forwarder what to expect.
const SAMPLE_DOC = {
  id: "example-docid-0004",
  documentNo: "PULL_NYG_2609_0004", bu: "NYG", invoiceNo: "",
  packages: [{ qty: 4, uom: "BOX" }],
  items: [
    { soNoDoc: "6250900412", poNoDoc: "FI2634201", vendorName: "PRO-STRETCH INTERNATIONAL LTD.",
      country: "HONG KONG", port: "HKG", incoterm: "EX-WORK", weight: 42.67, cartons: 4,
      etc: "2026-09-16", needDate: "2026-09-26", airFreightCost: 497.71,
      pickupAddress: "PRO-STRETCH INTERNATIONAL LTD., ROOM 608-609, 6/F, BLOCK B, VIGOR INDUSTRIAL Bldg, HONG KONG, HK" },
    { soNoDoc: "6250900413", poNoDoc: "FI2634202", vendorName: "PRO-STRETCH INTERNATIONAL LTD." },
  ],
}

// 1. compile the shared column config
rmSync(tmp, { recursive: true, force: true })
execFileSync("npx", ["tsc", join(root, "src/lib/pull-fwd-template.ts"), "--outDir", tmp, "--module", "es2022", "--target", "es2020", "--moduleResolution", "bundler"], { stdio: "inherit", shell: true })
const cfgPath = join(tmp, "pull-fwd-template.js")
if (!existsSync(cfgPath)) { console.error("compile failed:", cfgPath); process.exit(1) }
const { REF_COLS, FILL_COLS, FWD_SHEET, REF_FILL, FILL_FILL, LOCK_FILL, refRow } = await import(pathToFileURL(cfgPath).href)

// 2. build the workbook: one data sheet (what the FWD fills) + a README sheet
const wb = new ExcelJS.Workbook()
wb.creator = "Nan Yang Textile — Pull Material (RM REQ AIR)"
const ws = wb.addWorksheet(FWD_SHEET)

const headers = [...REF_COLS.map(c => c.header), ...FILL_COLS.map(c => c.header), "_DOCID"]
const widths = [...REF_COLS.map(c => c.width), ...FILL_COLS.map(c => c.width), 26]
const refCount = REF_COLS.length
const thin = { style: "thin", color: { argb: "FFBFBFBF" } }

const hr = ws.addRow(headers)
hr.height = 32
headers.forEach((_, i) => {
  const c = hr.getCell(i + 1)
  const col = i >= refCount && i < headers.length - 1 ? FILL_COLS[i - refCount] : null
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: !col ? REF_FILL : col.phase === PHASE ? FILL_FILL : LOCK_FILL } }
  c.font = { bold: true, size: 10 }
  c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
  c.border = { top: thin, bottom: thin, left: thin, right: thin }
})
widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
ws.views = [{ state: "frozen", ySplit: 2 }]

// format hint row (italic grey) — tells the FWD how each green cell should look
const hintRow = ws.addRow([...REF_COLS.map(() => ""), ...FILL_COLS.map(c => (c.phase === PHASE ? (c.hint || (c.type === "number" ? "number" : "")) : "phase " + c.phase)), ""])
hintRow.font = { italic: true, size: 9, color: { argb: "FF9CA3AF" } }

// Data rows: the sample carries one real document; the blank template gets 3 empty rows.
const dataRows = SAMPLE ? [[...refRow(SAMPLE_DOC), ...FILL_COLS.map(() => ""), SAMPLE_DOC.id]] : [null, null, null]
for (const vals of dataRows) {
  const row = ws.addRow(vals || headers.map(() => ""))
  headers.forEach((_, i) => {
    const c = row.getCell(i + 1)
    c.border = { top: thin, bottom: thin, left: thin, right: thin }
    if (i >= refCount && i < headers.length - 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_COLS[i - refCount].phase === PHASE ? "FFF6FBF3" : LOCK_FILL } }
  })
}
ws.getColumn(headers.length).hidden = true // _DOCID — filled by the system, must not be edited

// Date cells get a drop-down of real dates (hidden sheet) so the forwarder can never type
// "wed sep 23" or "05/09/26" — the cell always holds a true date value.
const dateCols = FILL_COLS.map((c, i) => ({ c, i })).filter(x => x.c.type === "date" && x.c.phase === PHASE)
if (dateCols.length) {
  const dws = wb.addWorksheet("DATES")
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 30)
  const N = 300
  for (let k = 0; k < N; k++) {
    const d = new Date(start); d.setDate(start.getDate() + k)
    const cell = dws.getCell(k + 1, 1)
    cell.value = d
    cell.numFmt = "dd-mmm-yyyy"
  }
  dws.getColumn(1).width = 16
  dws.state = "veryHidden"
  const source = `=DATES!$A$1:$A$${N}`
  for (const { i } of dateCols) {
    const colIdx = refCount + i + 1
    ws.getColumn(colIdx).numFmt = "dd-mmm-yyyy"
    for (let r = 3; r < 3 + dataRows.length; r++) {
      ws.getCell(r, colIdx).dataValidation = {
        type: "list", allowBlank: true, formulae: [source], showErrorMessage: true,
        errorStyle: "warning", errorTitle: "Pick a date",
        error: "Please choose a date from the drop-down (dd-mmm-yyyy, e.g. 23-Sep-2026).",
        showInputMessage: true, promptTitle: "Date", prompt: "Click the arrow and pick a date (dd-mmm-yyyy).",
      }
    }
  }
}

// README sheet
const rs = wb.addWorksheet("README")
rs.getColumn(1).width = 30
rs.getColumn(2).width = 80
const line = (a, b, bold = false) => { const r = rs.addRow([a, b]); if (bold) r.font = { bold: true }; r.alignment = { vertical: "top", wrapText: true } }
line("Pull Material — AIR actual", "Nan Yang Textile Group", true)
line("", "")
line("Sheet", `"${FWD_SHEET}" — one row per shipment (document)`)
line("Grey columns", "Shipment data from Nan Yang — reference only, please do not change")
line("Green columns", "Please fill these in and return the file by reply mail")
line("_DOCID (hidden)", "System key — must stay as it is, the file cannot be imported without it")
line("", "")
line("Columns to fill", "", true)
FILL_COLS.forEach(c => line((c.phase === PHASE ? "" : "(phase " + c.phase + ") ") + c.header, [c.type === "number" ? "number (no currency symbol)" : c.type === "date" ? "date — pick from the drop-down (dd-mmm-yyyy)" : "text", c.hint ? `e.g. ${c.hint}` : ""].filter(Boolean).join(" · ")))

mkdirSync(dirname(out), { recursive: true })
await wb.xlsx.writeFile(out)
rmSync(tmp, { recursive: true, force: true })
console.log("Template written:", out)
console.log("Fill columns:", FILL_COLS.map(c => c.header).join(" | "))
