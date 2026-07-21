import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { supabase, BUCKET } from "@/lib/supabase-storage"

export const runtime = "nodejs"

// Serve the ORIGINAL uploaded file (unchanged: colours/columns/layout) with a claim-dept dropdown
// injected on every "CLAIM DEPT n" column, as a forced download named SCM_<documentNo>.xlsx.
// Done server-side so reading Supabase storage isn't blocked by CORS and the browser downloads
// (instead of opening the Office online viewer with the raw storage filename).
const CLAIM_DEPTS = ["COMMERCIAL", "PROCUREMENT", "NYK", "PRODUCTION"]
const LG_CATS = ["INV", "AWB", "EXPENSE", "COMBINE"]

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const reqDoc = await prisma.airRequest.findUnique({
    where: { id },
    include: { attachments: { include: { uploadedBy: { select: { role: true } } }, orderBy: { createdAt: "asc" } } },
  })
  if (!reqDoc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Original upload = earliest doc-level xlsx that isn't an LG file or an SCM re-upload.
  const att = (reqDoc.attachments as any[]).find(a =>
    !a.itemId && /\.xlsx?$/i.test(a.fileName || "") && !LG_CATS.includes(a.category) && a.uploadedBy?.role !== "SCM_USER")
  if (!att) return NextResponse.json({ error: "No original file found" }, { status: 404 })

  // Fetch the file bytes server-side via a signed URL (proven to work; no client CORS issues).
  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(att.filePath, 3600)
  if (error || !signed) return NextResponse.json({ error: "Storage error" }, { status: 500 })
  const fileRes = await fetch(signed.signedUrl)
  if (!fileRes.ok) return NextResponse.json({ error: "Download failed" }, { status: 500 })
  const buf = Buffer.from(await fileRes.arrayBuffer())

  const ExcelJSMod: any = await import("exceljs")
  const ExcelJS = ExcelJSMod.default || ExcelJSMod
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.worksheets[0]
  if (ws) {
    const claimCols: number[] = []
    ws.getRow(1).eachCell((cell: any, col: number) => {
      if (String(cell.value ?? "").trim().toUpperCase().startsWith("CLAIM DEPT")) claimCols.push(col)
    })
    const listFormula = `"${CLAIM_DEPTS.join(",")}"`
    const lastRow = Math.max(ws.rowCount, 1) + 100
    for (const c of claimCols) {
      for (let r = 2; r <= lastRow; r++) {
        ws.getCell(r, c).dataValidation = {
          type: "list", allowBlank: true, formulae: [listFormula],
          showErrorMessage: true, errorStyle: "error", errorTitle: "Invalid claim dept",
          error: `Please select from the list: ${CLAIM_DEPTS.join(", ")}`,
        }
      }
    }
  }
  const out = await wb.xlsx.writeBuffer()
  const filename = `SCM_${reqDoc.documentNo}.xlsx`
  return new NextResponse(Buffer.from(out as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
