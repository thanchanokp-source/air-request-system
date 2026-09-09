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

// Grab an invoice-looking token out of a single line, given the PO value to exclude.
function invFromLine(line: string, po: string, allPos: string[]): string {
  // Prefer a token right after an "invoice / inv" keyword.
  const kw = line.match(/inv(?:oice)?\.?\s*(?:no\.?|number|#|:)?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9/\-]{2,})/i)
  if (kw && kw[1].toUpperCase() !== po.toUpperCase()) return kw[1]
  // Otherwise the first alphanumeric token (with a digit) that isn't a known PO.
  const upos = allPos.map(p => p.toUpperCase())
  const toks = (line.match(/[A-Za-z0-9][A-Za-z0-9/\-]{3,}/g) || []).filter(t => /\d/.test(t) && !upos.includes(t.toUpperCase()))
  return toks[0] || ""
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
  const globals = [...text.matchAll(/inv(?:oice)?\.?\s*(?:no\.?|number|#|:)?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9/\-]{2,})/gi)].map(m => m[1])
  const uniq = [...new Set(globals.map(g => g.toUpperCase()))]
  if (uniq.length === 1) { const only = globals[0]; for (const po of pos) if (!out[po]) out[po] = only }
  return out
}
