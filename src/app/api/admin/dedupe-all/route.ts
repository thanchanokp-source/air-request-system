import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { planDedupeAll, deleteItemsOfDoc, mailAdmins } from "@/lib/dedupe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Admin: remove duplicate rows in EVERY document (rules in lib/dedupe — same as the MER upload).
//   POST { preview: true }  → candidates (nothing written)
//   POST { itemIds: [...] } → delete those candidates (re-checked against a fresh plan first)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 })
  const userId = (session!.user as any).id
  const body = await req.json().catch(() => ({}))
  try {
    const plan = await planDedupeAll()
    if (body.preview) {
      const docs = new Map<string, number>()
      for (const c of plan) docs.set(c.documentNo, (docs.get(c.documentNo) || 0) + 1)
      return NextResponse.json({ ok: true, preview: true, total: plan.length,
        docs: [...docs.entries()].map(([documentNo, rows]) => ({ documentNo, rows })).sort((a, b) => b.rows - a.rows),
        rows: plan })
    }
    // only ids that are STILL duplicates right now (someone may have booked / edited since the preview)
    const want = new Set<string>(Array.isArray(body.itemIds) ? body.itemIds : [])
    const ok = plan.filter(c => want.has(c.itemId))
    if (!ok.length) return NextResponse.json({ error: "ไม่มีแถวที่ยังเป็นแถวซ้ำ (ลองกดลองดูใหม่)" }, { status: 400 })
    const byDoc = new Map<string, typeof ok>()
    for (const c of ok) byDoc.set(c.requestId, [...(byDoc.get(c.requestId) || []), c])
    let deleted = 0, docsDeleted = 0
    const lines: string[] = []
    for (const [requestId, cs] of byDoc) {
      const r = await deleteItemsOfDoc(requestId, cs.map(c => c.itemId), userId, `Admin ลบแถวซ้ำ (ซ้ำกับ ${[...new Set(cs.map(c => c.twinDoc))].join(", ")})`)
      deleted += r.deleted; if (r.docDeleted) docsDeleted++
      lines.push(`${cs[0].documentNo}: ลบ ${r.deleted} แถว${r.docDeleted ? " (เอกสารว่าง → ลบทั้งเอกสาร)" : ` · เหลือ ${r.remaining}`}`)
    }
    await mailAdmins(`[Air Request] ลบแถวซ้ำ ${deleted} แถว จาก ${byDoc.size} เอกสาร`, lines)
    return NextResponse.json({ ok: true, deleted, docs: byDoc.size, docsDeleted, lines })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "dedupe failed" }, { status: 500 })
  }
}
