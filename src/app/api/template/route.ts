import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

export async function GET(req: NextRequest) {
  const bu = req.nextUrl.searchParams.get("bu") || "NYG"
  const filename = `air-request-template_${bu}.xlsx`
  const filePath = path.join(process.cwd(), "public", filename)

  try {
    const buf = await readFile(filePath)
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }
}
