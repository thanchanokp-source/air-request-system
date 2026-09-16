import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { supabase, BUCKET } from "@/lib/supabase-storage"

// Download a Pull Material attachment — streamed through the app server (same origin), mirroring
// /api/attachments/[attachmentId] so self-hosted Supabase signed-URL host issues don't apply.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { attachmentId } = await params

  const att = await (prisma as any).pullMaterialAttachment.findUnique({ where: { id: attachmentId } })
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase.storage.from(BUCKET).download(att.filePath)
  if (error || !data) return NextResponse.json({ error: "Storage error", detail: error?.message || "download failed" }, { status: 500 })

  const buf = Buffer.from(await data.arrayBuffer())
  const safeName = encodeURIComponent(att.fileName || "file")
  return new NextResponse(buf, {
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=60",
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id
  const u: any = session.user
  const isAdmin = u.role === "ADMIN" || (Array.isArray(u.roles) && u.roles.includes("ADMIN"))
  const { attachmentId } = await params

  const att = await (prisma as any).pullMaterialAttachment.findUnique({ where: { id: attachmentId } })
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!isAdmin && att.uploadedById && att.uploadedById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await supabase.storage.from(BUCKET).remove([att.filePath]).catch(() => {})
  await (prisma as any).pullMaterialAttachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ ok: true })
}
