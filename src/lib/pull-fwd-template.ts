// ── Pull RM Phase 2 — Forwarder (FWD) actual-entry template ─────────────────────────────────────
// ONE place defines the workbook LG mails to the forwarder and the workbook LG imports back:
//   REF_COLS  = data we send TO the FWD (grey, read-only reference)
//   FILL_COLS = what the FWD fills in (green) → each maps to a field on the Pull RM document
// Change the lists here and BOTH the outgoing template and the importer follow — no other file needs
// to be touched. (Field list is provisional; confirm with the FWD before rollout.)
//
// AIR only for now: Sea/Courier docs keep Phase 1 (LG types the actual) — their mode choice is still
// recorded in PullShipModeLog for later analysis.

export const FWD_SHEET = "FWD_ACTUAL"

// Reference columns — value pulled from the doc (d = request, i = its first item / shipment line).
export const REF_COLS: { header: string; width: number; get: (d: any, i: any) => any }[] = [
  { header: "DOC NO", width: 18, get: (d) => d.documentNo || "" },
  { header: "BU", width: 8, get: (d) => d.bu || "" },
  { header: "SO", width: 14, get: (d) => [...new Set((d.items || []).map((x: any) => x.soNoDoc).filter(Boolean))].join(", ") },
  { header: "PO NO", width: 16, get: (d) => [...new Set((d.items || []).map((x: any) => x.poNoDoc).filter(Boolean))].join(", ") },
  { header: "SUPPLIER", width: 22, get: (d) => [...new Set((d.items || []).map((x: any) => x.vendorName).filter(Boolean))].join(", ") },
  { header: "INVOICE NO", width: 16, get: (d) => d.invoiceNo || "" },
  { header: "ORIGIN PORT", width: 13, get: (_d, i) => i.port || "" },
  { header: "COUNTRY", width: 14, get: (_d, i) => i.country || "" },
  { header: "INCOTERM", width: 11, get: (_d, i) => i.incoterm || "" },
  { header: "WEIGHT (KG)", width: 12, get: (_d, i) => i.weight ?? "" },
  { header: "CARTONS", width: 10, get: (d, i) => { const p = Array.isArray(d.packages) ? d.packages : []; return p.length ? p.map((x: any) => `${x.qty} ${x.uom}`).join(", ") : (i.cartons ?? "") } },
  { header: "NEED DATE", width: 13, get: (_d, i) => (i.needDate ? String(i.needDate).slice(0, 10) : "") },
  { header: "PICKUP ADDRESS", width: 30, get: (_d, i) => i.pickupAddress || "" },
]

// Fill-in columns — the FWD types these; `field` is the document field the importer writes to and
// `type` tells the importer how to read the cell.
export const FILL_COLS: { header: string; width: number; field: string; type: "text" | "number" | "date"; hint?: string }[] = [
  { header: "MAWB NO", width: 16, field: "mawbNo", type: "text" },
  { header: "HAWB NO", width: 16, field: "hawbNo", type: "text" },
  { header: "FLIGHT ETD", width: 13, field: "flightEtd", type: "date", hint: "YYYY-MM-DD" },
  { header: "FLIGHT ETA", width: 13, field: "flightEta", type: "date", hint: "YYYY-MM-DD" },
  { header: "ACTUAL AIR FREIGHT (USD)", width: 22, field: "actualAir", type: "number" },
  { header: "LOCAL CHARGE TH (USD)", width: 20, field: "localChargeTh", type: "number" },
  { header: "CFM IN-HOUSE DATE", width: 18, field: "cfmInHouseDate", type: "date", hint: "YYYY-MM-DD" },
  { header: "REMARK", width: 28, field: "fwdRemark", type: "text" },
]

export const ALL_HEADERS = [...REF_COLS.map(c => c.header), ...FILL_COLS.map(c => c.header), "_DOCID"]

// Excel fill colours — grey = reference, green = please fill in.
export const REF_FILL = "FFEAECEE"
export const FILL_FILL = "FFE2EFDA"

// One row of reference values for a document (the shipment line = first item, 1 shipment / 1 doc).
export function refRow(doc: any): any[] {
  const items = doc?.items || []
  const i0 = items.find((x: any) => x.airFreightCost != null) || items[0] || {}
  return REF_COLS.map(c => c.get(doc, i0))
}

// Read one imported row → { field: value } for the PATCH body. Header matching ignores case/spaces so
// a FWD who retypes the header row still imports cleanly.
export function parseFwdRow(row: Record<string, any>): Record<string, any> {
  const norm = (s: any) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const byNorm: Record<string, any> = {}
  for (const [k, v] of Object.entries(row || {})) byNorm[norm(k)] = v
  const out: Record<string, any> = {}
  for (const c of FILL_COLS) {
    const raw = byNorm[norm(c.header)]
    if (raw === undefined || raw === null || String(raw).trim() === "") continue
    if (c.type === "number") {
      const n = Number(String(raw).replace(/[, ]/g, ""))
      if (!isNaN(n)) out[c.field] = n
    } else if (c.type === "date") {
      const d = excelDate(raw)
      if (d) out[c.field] = d.toISOString().slice(0, 10)
    } else {
      out[c.field] = String(raw).trim()
    }
  }
  return out
}

// Excel serial number OR a date string → Date (null when unreadable).
export function excelDate(v: any): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const n = Number(v)
  if (!isNaN(n) && n > 20000 && n < 80000) return new Date(Math.round((n - 25569) * 86400 * 1000)) // Excel serial → JS
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}
