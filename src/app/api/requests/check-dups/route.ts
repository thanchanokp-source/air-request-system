import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { normalizeSo } from "@/lib/so"
import { checkUploadDuplicates } from "@/lib/dedupe"

export const runtime = "nodejs"

// MER upload pre-check (nothing is written): which rows of the file were already uploaded in another
// active document (same SO+SUB+STYLE), with those old rows — shown in a popup so MER decides
// "drop the duplicates" or "upload everything (a new shipment round)".
// POST { items: [...uploaded rows, same shape as /api/requests] } → { rows: UploadCheckRow[] }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const items: any[] = Array.isArray(body?.items) ? body.items : []
  const col = (item: any, key: string) => { const k = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase()) ?? key; return item[k] }
  const shaped = items.map((i: any) => ({
    so: normalizeSo(col(i, "SO")), sub: String(col(i, "SUB") || ""), style: String(col(i, "STYLE") || ""),
    qtyRequestAir: Number(String(col(i, "QTY Request ship Air (pcs)") ?? "").replace(/,/g, "")) || 0,
  }))
  try { return NextResponse.json({ rows: await checkUploadDuplicates(shaped) }) }
  catch (e: any) { return NextResponse.json({ rows: [], error: e?.message || "check failed" }) }
}
