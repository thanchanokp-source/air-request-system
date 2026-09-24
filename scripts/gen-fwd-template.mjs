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
const pathArg = args.find(a => !a.startsWith("--"))
const out = resolve(pathArg || join(root, "docs", "templates", SAMPLE ? "FWD_ACTUAL_sample.xlsx" : "FWD_ACTUAL_template.xlsx"))

// A real document, exactly as the system would mail it (grey columns already filled in).
// Kept here only as an EXAMPLE for showing the forwarder what to expect.
const SAMPLE_DOC = {
  id: "cmpl-example-docid-0020",
  documentNo: "PULL_NYG_2609_0020", bu: "NYG", invoiceNo: "",
  packages: [{ qty: 4, uom: "ROL" }],
  items: [{
    soNoDoc: "6-25-09-0123", poNoDoc: "PO-2509-7781", vendorName: "ECLAT TEXTILE CO., LTD.",
    country: "TAIWAN", port: "TPE", incoterm: "FCA", weight: 71.37, cartons: 4,
    needDate: "2026-10-03", airFreightCost: 824.22,
    pickupAddress: "ECLAT TEXTILE CO., LTD., NO.28, WU CHUAN ROAD, WU KU IND PARK, TAIPEI, TAIWAN, TW",
  }],
}

// 1. compile the shared column config
rmSync(tmp, { recursive: true, force: true })
execFileSync("npx", ["tsc", join(root, "src/lib/pull-fwd-template.ts"), "--outDir", tmp, "--module", "es2022", "--target", "es2020", "--moduleResolution", "bundler"], { stdio: "inherit", shell: true })
const cfgPath = join(tmp, "pull-fwd-template.js")
if (!existsSync(cfgPath)) { console.error("compile failed:", cfgPath); process.exit(1) }
const { REF_COLS, FILL_COLS, FWD_SHEET, REF_FILL, FILL_FILL, refRow } = await import(pathToFileURL(cfgPath).href)

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
  const isFill = i >= refCount && i < headers.length - 1
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isFill ? FILL_FILL : REF_FILL } }
  c.font = { bold: true, size: 10 }
  c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
  c.border = { top: thin, bottom: thin, left: thin, right: thin }
})
widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
ws.views = [{ state: "frozen", ySplit: 2 }]

// format hint row (italic grey) — tells the FWD how each green cell should look
const hintRow = ws.addRow([...REF_COLS.map(() => ""), ...FILL_COLS.map(c => c.hint || (c.type === "number" ? "number" : "")), ""])
hintRow.font = { italic: true, size: 9, color: { argb: "FF9CA3AF" } }

// Data rows: the sample carries one real document; the blank template gets 3 empty rows.
const dataRows = SAMPLE ? [[...refRow(SAMPLE_DOC), ...FILL_COLS.map(() => ""), SAMPLE_DOC.id]] : [null, null, null]
for (const vals of dataRows) {
  const row = ws.addRow(vals || headers.map(() => ""))
  headers.forEach((_, i) => {
    const c = row.getCell(i + 1)
    c.border = { top: thin, bottom: thin, left: thin, right: thin }
    if (i >= refCount && i < headers.length - 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6FBF3" } }
  })
}
ws.getColumn(headers.length).hidden = true // _DOCID — filled by the system, must not be edited

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
FILL_COLS.forEach(c => line(c.header, [c.type === "number" ? "number (no currency symbol)" : c.type === "date" ? "date — YYYY-MM-DD" : "text", c.hint ? `e.g. ${c.hint}` : ""].filter(Boolean).join(" · ")))

mkdirSync(dirname(out), { recursive: true })
await wb.xlsx.writeFile(out)
rmSync(tmp, { recursive: true, force: true })
console.log("Template written:", out)
console.log("Fill columns:", FILL_COLS.map(c => c.header).join(" | "))
