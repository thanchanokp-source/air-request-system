// Render the FORWARDER email exactly as the system sends it, into HTML files you can open.
//   node scripts/preview-fwd-mail.mjs        -> docs/templates/fwd-mail-P1.html + fwd-mail-P2.html
// Uses src/lib/pull-fwd-mail.ts (the same builder the API calls), so the preview can never drift.
import { execFileSync } from "child_process"
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs"
import { dirname, join, resolve } from "path"
import { fileURLToPath, pathToFileURL } from "url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")
const tmp = join(here, ".tmp-mail")
const outDir = join(root, "docs", "templates")

// Example shipments — the same two documents used in the sample workbook.
const DOCS = [
  {
    documentNo: "PULL_NYG_2609_0020", bu: "NYG",
    // already answered in phase 1 — shown back (locked) in the phase-2 file
    mawbNo: "297-12345678", hawbNo: "BKK2609001", flightEtd: "2026-10-01", flightEta: "2026-10-02",
    cfmInHouseDate: "2026-10-03", fwdRateThbPerKg: 78, invoiceNo: "INV-EC-88120",
    items: [{ soNoDoc: "6250900412", poNoDoc: "FI2629916", vendorName: "ECLAT TEXTILE CO., LTD.",
      port: "TPE", country: "TAIWAN", incoterm: "FCA", weight: 71.37, cartons: 4, etc: "2026-09-29",
      needDate: "2026-10-03", airFreightCost: 530.57 }],
  },
  {
    documentNo: "PULL_NYG_2609_0004", bu: "NYG",
    items: [{ soNoDoc: "6250900413", poNoDoc: "FI2634201, FI2634202", vendorName: "PRO-STRETCH INTERNATIONAL LTD.",
      port: "HKG", country: "HONG KONG", incoterm: "EX-WORK", weight: 42.67, cartons: 4, etc: "2026-09-16",
      needDate: "2026-09-26", airFreightCost: 497.71 }],
  },
]

rmSync(tmp, { recursive: true, force: true })
// tsc cannot resolve the "@/lib" alias from the CLI — it still EMITS the JS, so ignore the exit code.
try {
execFileSync("npx", ["tsc",
  join(root, "src/lib/pull-fwd-mail.ts"), join(root, "src/lib/pull-fwd-template.ts"), join(root, "src/lib/pull-fwd-workbook.ts"),
  "--outDir", tmp, "--module", "es2022", "--target", "es2020", "--moduleResolution", "bundler",
], { stdio: "inherit", shell: true })
} catch { /* alias type error only — the .js files are written anyway */ }
// the lib imports itself via the "@/lib/..." alias — rewrite it for the plain-node run
const mailJs = join(tmp, "pull-fwd-mail.js")
if (!existsSync(mailJs)) { console.error("compile failed"); process.exit(1) }
const { readFileSync } = await import("fs")
writeFileSync(mailJs, readFileSync(mailJs, "utf8").replace('"@/lib/pull-fwd-template"', '"./pull-fwd-template.js"'))
const { fwdMailHtml, fwdMailSubject } = await import(pathToFileURL(mailJs).href)
// the workbook builder needs the same alias rewrite
const wbJs = join(tmp, "pull-fwd-workbook.js")
writeFileSync(wbJs, readFileSync(wbJs, "utf8").replace('"@/lib/pull-fwd-template"', '"./pull-fwd-template.js"'))
const { buildFwdWorkbook } = await import(pathToFileURL(wbJs).href)

mkdirSync(outDir, { recursive: true })
for (const phase of [1, 2]) {
  const subject = fwdMailSubject(phase, DOCS)
  const body = fwdMailHtml({
    docs: DOCS, phase, fwdName: "BUGATTI", fileName: `RM_AIR_FWD_P${phase}_2026-09-25.xlsx`,
    actorName: "Nuttawut T. (Logistics Import)",
    note: phase === 1 ? "Kindly confirm the flight by Friday." : undefined,
  })
  const page = `<!doctype html><meta charset="utf-8"><title>${subject}</title>
<body style="background:#f1f5f9;margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:720px;margin:0 auto">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:13px">
      <div style="color:#94a3b8;font-size:11px">SUBJECT</div>
      <div style="font-weight:700">${subject}</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:8px">TO</div>
      <div>operation1@bugattibkk.com · cc: nuttawut.t@nanyangtextile.com</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:8px">ATTACHMENT</div>
      <div>RM_AIR_FWD_P${phase}_2026-09-25.xlsx</div>
    </div>
    ${body}
  </div>
</body>`
  const file = join(outDir, `fwd-mail-P${phase}.html`)
  writeFileSync(file, page, "utf8")
  // the exact attachment that goes with this mail
  const xlsx = join(outDir, `RM_AIR_FWD_P${phase}_example.xlsx`)
  writeFileSync(xlsx, await buildFwdWorkbook(DOCS, phase))
  console.log("written:", file)
  console.log("  subject:", subject)
  console.log("  attachment:", xlsx)
}
rmSync(tmp, { recursive: true, force: true })
