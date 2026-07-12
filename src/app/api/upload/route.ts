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
    // The template has a merged "section" row above the real header row. Read the
    // sheet as a matrix and locate the header row (the one containing the key
    // columns) so both 1-row and 2-row templates parse correctly.
    const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
    const norm = (v: any) => String(v ?? "").trim()
    const isHeader = (r: any[]) => {
      const set = (r || []).map((c) => norm(c).toLowerCase())
      return set.includes("so") && set.includes("style")
    }
    let hIdx = aoa.findIndex(isHeader)
    if (hIdx < 0) hIdx = 0
    const headers = (aoa[hIdx] || []).map(norm)
    const normalizedRows = aoa
      .slice(hIdx + 1)
      .filter((r) => Array.isArray(r) && r.some((c) => c !== null && norm(c) !== ""))
      .map((r) => {
        const o: any = {}
        headers.forEach((h, i) => { if (h) o[h] = r[i] ?? null })
        return o
      })
    return NextResponse.json({ rows: normalizedRows, count: normalizedRows.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
