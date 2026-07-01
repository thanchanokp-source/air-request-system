import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
            const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    // defval: null ensures empty cells still appear as keys (needed for column validation)
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null })
    // Normalize header keys: trim leading/trailing whitespace
    const normalizedRows = rows.map((row: any) => {
      const norm: any = {}
      for (const [k, v] of Object.entries(row)) norm[k.trim()] = v
      return norm
    })
    return NextResponse.json({ rows: normalizedRows, count: normalizedRows.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
