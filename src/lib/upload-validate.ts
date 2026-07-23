// Shared validation for an uploaded Air Request Excel file.
//
// Used by BOTH the New Request page and the resubmit RE-UPLOAD flow so the two never drift.
// Takes the raw rows returned by /api/upload and returns the real data rows + a single
// human-readable error string (Thai/English, same wording as before) or null when valid.

import { isValidSo } from "@/lib/so"

const NYG_REQUIRED = [
  "STYLE", "SO", "CUSTOMER PO", "DESCRIPTION",
  "Original Shipment Date", "Plan Shipment Date",
  "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)",
  "Factory", "Country", "Brand name", "BU",
]
// GW uses the same required columns as NYG.
const GW_REQUIRED = NYG_REQUIRED

export interface ValidateResult { rows: any[]; error: string | null }

export function validateUploadRows(allRows: any[], isGW: boolean): ValidateResult {
  if (!allRows || allRows.length === 0) {
    return { rows: [], error: "No data found in the file. Please check and upload again" }
  }
  const required = isGW ? GW_REQUIRED : NYG_REQUIRED
  const cols = Object.keys(allRows[0]).map((c: string) => c.toLowerCase())

  if (!cols.includes("factory")) return { rows: [], error: "Invalid data. Please use the specified template" }
  const missing = required.filter(c => !cols.includes(c.toLowerCase()))
  if (missing.length > 0) return { rows: [], error: "Invalid data. Please use the specified template" }

  const cellVal = (row: any, key: string) => {
    const k = Object.keys(row).find(kk => kk.toLowerCase() === key.toLowerCase())
    return k ? row[k] : null
  }
  const hasKey = (v: any) => v != null && String(v).trim() !== ""
  const rows = allRows.filter((row: any) => hasKey(cellVal(row, "SO")) || hasKey(cellVal(row, "STYLE")))
  if (rows.length === 0) {
    return { rows: [], error: "No data rows found — every row is missing both SO and STYLE. Please fill in the template" }
  }

  const getVal = cellVal
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
  const isValidDateVal = (v: any) => {
    const s = String(v).trim()
    if (!isNaN(new Date(s).getTime())) return true
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
    if (m) { const d = +m[1], mo = +m[2]; return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 }
    const m2 = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,})[\s\-]+(\d{2,4})$/)
    if (m2) { const d = +m2[1]; return d >= 1 && d <= 31 && MONTHS.includes(m2[2].slice(0, 3).toLowerCase()) }
    return false
  }
  const isEmpty = (v: any) => v == null || String(v).trim() === ""
  const MER_OPTIONAL = ["Plan Shipment Date", "QTY Request ship Air (pcs)"]
  const perRowRequired = required.filter(f => !["Brand name", "BU", ...MER_OPTIONAL].includes(f))
  const numFields = ["QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)"]
  const dateFields = ["Original Shipment Date", "Plan Shipment Date"]
  const validDepts = (isGW
    ? ["SCM NYK", "SCM NYG", "NYK", "NYG", "GW", "SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]
    : ["COMMERCIAL", "PRODUCTION", "PROCUREMENT", "NYK", "SCM NYK"]
  ).map(d => d.toUpperCase().replace(/\s+/g, " ").trim())

  const errs: string[] = []
  rows.forEach((row: any, idx: number) => {
    const so = getVal(row, "SO") || `Row ${idx + 2}`
    const soRaw = String(getVal(row, "SO") ?? "").trim()
    if (soRaw && !isValidSo(soRaw)) {
      errs.push(`SO ${soRaw}: ต้องเป็นตัวเลข 8 หลัก (ถ้าขึ้นต้นด้วย 0 แล้วเหลือ 7 หลัก ระบบจะเติม 0 ให้อัตโนมัติ)`)
    }
    if (isGW) {
      const soDigits = String(getVal(row, "SO") ?? "").trim().replace(/\D/g, "")
      if (soDigits && (soDigits.startsWith("05") || (soDigits.length === 7 && soDigits.startsWith("5")))) {
        errs.push(`SO ${so}: this SO starts with 05 (or was truncated to 7 digits starting with 5) — please use an SO that starts with 01`)
      }
    }
    for (const f of perRowRequired) if (isEmpty(getVal(row, f))) errs.push(`SO ${so}: missing "${f}"`)
    for (const f of numFields) {
      const v = getVal(row, f)
      if (!isEmpty(v) && isNaN(Number(String(v).replace(/,/g, "")))) errs.push(`SO ${so}: "${f}" must be a number (got "${v}")`)
    }
    for (const f of dateFields) {
      const v = getVal(row, f)
      if (!isEmpty(v) && !isValidDateVal(v)) errs.push(`SO ${so}: "${f}" wrong date format (got "${v}")`)
    }
    const depts = [1, 2, 3].map(n => String(getVal(row, `CLAIM DEPT ${n}`) || "").trim())
    if (depts.some(d => d)) {
      let sum = 0
      for (const n of [1, 2, 3]) {
        const d = depts[n - 1]
        const pctRaw = getVal(row, `%CLAIM${n}`)
        const pctHas = !isEmpty(pctRaw)
        if (d) {
          if (!validDepts.includes(d.toUpperCase().replace(/\s+/g, " ").trim())) errs.push(`SO ${so}: CLAIM DEPT ${n} "${d}" not recognized (check spelling)`)
          const pct = parseFloat(String(pctRaw ?? ""))
          if (isNaN(pct)) errs.push(`SO ${so}: %CLAIM${n} must be a number (got "${pctRaw ?? ""}")`)
          else sum += pct
        } else if (pctHas) {
          errs.push(`SO ${so}: %CLAIM${n} has a value but CLAIM DEPT ${n} is empty`)
        }
      }
      if (Math.round(sum) !== 100) errs.push(`SO ${so}: sum of %CLAIM = ${sum}% (must be 100)`)
    }
  })

  if (errs.length > 0) {
    const shown = errs.slice(0, 40)
    return { rows: [], error: `Found ${errs.length} issue(s) — please fix and re-upload:\n• ${shown.join("\n• ")}${errs.length > 40 ? `\n… and ${errs.length - 40} more` : ""}` }
  }
  return { rows, error: null }
}
