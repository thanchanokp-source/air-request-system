// Client-side invoice extractor for the Pull Material Purchasing form.
// Reads an uploaded document to text, then best-effort pairs each known PO with an invoice no.
// Excel (.xlsx/.xls) is read directly. PDF/scans return "" here → user types the INV manually
// (OCR is a later phase). All parsing happens in the browser — the file never leaves the machine.

export async function fileToText(file: File): Promise<{ text: string; kind: "excel" | "pdf" | "image" | "other" }> {
  const n = (file.name || "").toLowerCase()
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv")) {
    const XLSX: any = await import("xlsx")
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
    const text = (wb.SheetNames as string[]).map(s => XLSX.utils.sheet_to_csv(wb.Sheets[s])).join("\n")
    return { text, kind: "excel" }
  }
  if (n.endsWith(".pdf")) return { text: "", kind: "pdf" }       // TODO phase 2: pdfjs text / OCR
  if (/\.(png|jpe?g|gif|bmp|webp|tiff?)$/.test(n)) return { text: "", kind: "image" } // TODO phase 2: OCR
  return { text: "", kind: "other" }
}

// Invoice keywords: SI / INV / INV NO / INVOICE / INVOICE NO → then the number.
const INV_KW = /\b(?:invoice|inv|si)\b\.?\s*(?:no\.?|number|#|:)?\s*[:#.\-]?\s*([A-Za-z0-9][A-Za-z0-9/\-]{2,})/i
// …or a token that itself starts with SI/INV then digits (e.g. "SI2614427", "INV-1234").
const INV_PREFIX = /\b((?:SI|INV)[-/]?\d[A-Za-z0-9/\-]*)\b/i

// Grab the invoice number from a single line, given the PO value to exclude.
function invFromLine(line: string, po: string, allPos: string[]): string {
  const upos = allPos.map(p => p.toUpperCase())
  const bad = (t: string) => !t || t.toUpperCase() === po.toUpperCase() || upos.includes(t.toUpperCase()) || !/\d/.test(t)
  const kw = line.match(INV_KW)
  if (kw && !bad(kw[1])) return kw[1]
  const pf = line.match(INV_PREFIX)
  if (pf && !bad(pf[1])) return pf[1]
  return ""
}

// Best-effort { po: invoice } from extracted text, scoped to the POs already in the cart.
export function pairPoInvoice(text: string, pos: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  if (!text || !pos.length) return out
  const lines = text.split(/\r?\n/)
  for (const ln of lines) {
    const U = ln.toUpperCase()
    for (const po of pos) {
      if (!out[po] && U.includes(po.toUpperCase())) {
        const inv = invFromLine(ln, po, pos)
        if (inv) out[po] = inv
      }
    }
  }
  // If the whole doc has exactly one invoice-labelled number, use it for any PO still blank.
  const kwG = [...text.matchAll(new RegExp(INV_KW.source, "gi"))].map(m => m[1])
  const pfG = [...text.matchAll(new RegExp(INV_PREFIX.source, "gi"))].map(m => m[1])
  const globals = [...kwG, ...pfG].filter(t => /\d/.test(t) && !pos.some(p => p.toUpperCase() === t.toUpperCase()))
  const uniq = [...new Set(globals.map(g => g.toUpperCase()))]
  if (uniq.length === 1) { const only = globals[0]; for (const po of pos) if (!out[po]) out[po] = only }
  return out
}
