// ── Pull RM Phase 2 — Forwarder (FWD) actual-entry template ─────────────────────────────────────
// ONE place defines the workbook LG mails to the forwarder and the workbook LG imports back:
//   REF_COLS  = data we send TO the FWD (grey, read-only reference)
//   FILL_COLS = what the FWD fills in (green) → each maps to a field on the Pull RM document
// Change the lists here and BOTH the outgoing template and the importer follow — no other file needs
// to be touched.
//
// TWO PHASES — the same sheet is used twice for a shipment:
//   phase 1 (ตอนจอง/ของกำลังไป) : MAWB / HAWB / ETD / ETA / CFM in-house / air freight rate / supplier INV
//   phase 2 (ของถึงแล้ว)        : ACTUAL AIR FREIGHT / LOCAL CHARGE TH / REMARK
// LG picks the phase when mailing; phase-2 columns are locked (grey) in a phase-1 file and vice versa,
// so the FWD only ever types what is due at that moment.
//
// MONEY IS THB IN THE SHEET. The forwarder quotes in baht, the system stores USD — every `thb: true`
// column is divided by EXCHANGE_RATE on import (the doc is then marked actualCurrency = "THB").
//
// AIR only: Sea/Courier docs keep manual LG entry; their mode choice still lands in PullShipModeLog.

export const FWD_SHEET = "FWD_ACTUAL"
export const FWD_RATE = 32.5              // THB → USD, same rate as the rest of Pull RM
export type FwdPhase = 1 | 2

// Reference columns — value pulled from the doc (d = request, i = its first item / shipment line).
// No internal document number / BU here: the forwarder works from SO + PO + supplier.
export const REF_COLS: { header: string; width: number; get: (d: any, i: any) => any }[] = [
  { header: "SO", width: 16, get: (d) => [...new Set((d.items || []).map((x: any) => x.soNoDoc).filter(Boolean))].join(", ") },
  { header: "PO NO", width: 18, get: (d) => [...new Set((d.items || []).map((x: any) => x.poNoDoc).filter(Boolean))].join(", ") },
  { header: "SUPPLIER", width: 24, get: (d) => [...new Set((d.items || []).map((x: any) => x.vendorName).filter(Boolean))].join(", ") },
  { header: "ORIGIN PORT", width: 13, get: (_d, i) => i.port || "" },
  { header: "COUNTRY", width: 14, get: (_d, i) => i.country || "" },
  { header: "INCOTERM", width: 11, get: (_d, i) => i.incoterm || "" },
  { header: "WEIGHT (KG)", width: 12, get: (_d, i) => i.weight ?? "" },
  { header: "CARTONS", width: 12, get: (d, i) => { const p = Array.isArray(d.packages) ? d.packages : []; return p.length ? p.map((x: any) => `${x.qty} ${x.uom}`).join(", ") : (i.cartons ?? "") } },
  { header: "ETC", width: 13, get: (_d, i) => (i.etc ? String(i.etc).slice(0, 10) : "") },
  { header: "NEED DATE", width: 13, get: (_d, i) => (i.needDate ? String(i.needDate).slice(0, 10) : "") },
  { header: "PICKUP ADDRESS", width: 32, get: (_d, i) => i.pickupAddress || "" },
]

// Fill-in columns — the FWD types these; `field` is the document field the importer writes to,
// `type` how to read the cell, `phase` when it is due, `thb` that the value arrives in baht.
export const FILL_COLS: {
  header: string; width: number; field: string; type: "text" | "number" | "date"
  phase: FwdPhase; thb?: boolean; hint?: string
}[] = [
  { header: "MAWB NO", width: 16, field: "mawbNo", type: "text", phase: 1 },
  { header: "HAWB NO", width: 16, field: "hawbNo", type: "text", phase: 1 },
  { header: "FLIGHT ETD", width: 13, field: "flightEtd", type: "date", phase: 1, hint: "pick from list · dd-mmm-yyyy" },
  { header: "FLIGHT ETA", width: 13, field: "flightEta", type: "date", phase: 1, hint: "pick from list · dd-mmm-yyyy" },
  { header: "CFM IN-HOUSE DATE", width: 18, field: "cfmInHouseDate", type: "date", phase: 1, hint: "pick from list · dd-mmm-yyyy" },
  { header: "AIR FREIGHT (THB) /KG", width: 19, field: "fwdRateThbPerKg", type: "number", phase: 1, hint: "THB/kg" },
  { header: "SUPPLIER INV", width: 18, field: "invoiceNo", type: "text", phase: 1 },
  { header: "ACTUAL AIR FREIGHT (THB)", width: 23, field: "actualAir", type: "number", phase: 2, thb: true, hint: "THB" },
  { header: "LOCAL CHARGE TH (THB)", width: 21, field: "localChargeTh", type: "number", phase: 2, thb: true, hint: "THB" },
  { header: "REMARK", width: 28, field: "fwdRemark", type: "text", phase: 2 },
]

export const ALL_HEADERS = [...REF_COLS.map(c => c.header), ...FILL_COLS.map(c => c.header), "_DOCID"]

// Excel fill colours — grey = reference / not this phase, green = please fill in now.
export const REF_FILL = "FFEAECEE"
export const FILL_FILL = "FFE2EFDA"
export const LOCK_FILL = "FFF2F2F2"

// One row of reference values for a document (the shipment line = first item, 1 shipment / 1 doc).
export function refRow(doc: any): any[] {
  const items = doc?.items || []
  const i0 = items.find((x: any) => x.airFreightCost != null) || items[0] || {}
  return REF_COLS.map(c => c.get(doc, i0))
}

// Values already on the doc, so a phase-2 file still shows what the FWD answered in phase 1
// (and a re-send does not ask for the same numbers twice).
export function fillRow(doc: any): any[] {
  return FILL_COLS.map(c => {
    const v = doc?.[c.field]
    if (v == null || v === "") return ""
    if (c.type === "date") return String(v).slice(0, 10)
    if (c.type === "number" && c.thb) return Math.round(Number(v) * FWD_RATE * 100) / 100  // stored USD → show THB
    return v
  })
}

// Read one imported row → { field: value } for the PATCH body (money converted THB → USD).
// Header matching ignores case/spaces so a FWD who retypes the header row still imports cleanly.
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
      if (isNaN(n)) continue
      out[c.field] = c.thb ? Math.round((n / FWD_RATE) * 100) / 100 : n
      if (c.thb) out.actualCurrency = "THB"     // remember what the FWD actually quoted
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
