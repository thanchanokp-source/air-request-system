import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { pairPoInvoice } from "@/lib/inv-extract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Read an uploaded document (Excel / PDF-with-text) and best-effort map each known PO → invoice no.
// Scanned PDFs / images have no text layer → returned as such so the UI asks the user to type it.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file") as File | null
  const pos = String(form.get("pos") || "").split(",").map(s => s.trim()).filter(Boolean)
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 })

  const name = (file.name || "").toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())
  let text = ""
  let kind: "excel" | "pdf" | "pdf-scanned" | "image" | "other" = "other"

  try {
    if (/\.(xlsx|xls|csv)$/.test(name)) {
      kind = "excel"
      const XLSX: any = await import("xlsx")
      const wb = XLSX.read(buf, { type: "buffer" })
      text = (wb.SheetNames as string[]).map(s => XLSX.utils.sheet_to_csv(wb.Sheets[s])).join("\n")
    } else if (name.endsWith(".pdf")) {
      kind = "pdf"
      const { PDFParse } = (await import("pdf-parse")) as any
      const parser = new PDFParse({ data: buf })
      const r = await parser.getText()
      text = String(r?.text || "").trim()
      try { await parser.destroy?.() } catch { /* ignore */ }
      if (!text) kind = "pdf-scanned"
    } else if (/\.(png|jpe?g|gif|bmp|webp|tiff?)$/.test(name)) {
      kind = "image"
    }
  } catch (e: any) {
    return NextResponse.json({ kind, error: e?.message || "read failed", pairs: {}, textLen: 0, found: 0 })
  }

  const { pairs, present } = pairPoInvoice(text, pos)
  return NextResponse.json({ kind, textLen: text.length, pairs, present, found: Object.keys(pairs).length })
}
