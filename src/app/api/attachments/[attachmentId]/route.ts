import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { supabase, BUCKET } from "@/lib/supabase-storage"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { attachmentId } = await params

  const att = await prisma.requestAttachment.findUnique({ where: { id: attachmentId } })
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Stream the bytes THROUGH the app server (same origin as the domain) instead of redirecting to a
  // Supabase signed URL. Self-hosted Supabase generates signed URLs on its own (often internal) host,
  // which the user's browser cannot reach after the domain migration → "can't open file". Proxying the
  // download here keeps it on the app domain and preserves the auth check above.
  const { data, error } = await supabase.storage.from(BUCKET).download(att.filePath)
  if (error || !data) return NextResponse.json({ error: "Storage error", detail: error?.message || "download failed", path: att.filePath }, { status: 500 })

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
  const role = (session.user as any).role as string
  const { attachmentId } = await params

  const att = await prisma.requestAttachment.findUnique({ where: { id: attachmentId } })
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isAdmin = role === "ADMIN"

  // The uploader can delete their own attachment; ADMIN can delete any.
  if (att.uploadedById !== userId && !isAdmin) {
    return NextResponse.json({ error: "Forbidden — เฉพาะคนที่อัปโหลด หรือ admin เท่านั้นที่ลบได้" }, { status: 403 })
  }

  // MER files are locked after submission — VP MER must reject for a redo (admin bypasses).
  if (!isAdmin && (role === "MER_USER" || role === "MER_GW")) {
    return NextResponse.json({ error: "Files cannot be deleted after submission. Please have the VP Merchandise Reject to redo" }, { status: 400 })
  }

  await supabase.storage.from(BUCKET).remove([att.filePath])
  await prisma.requestAttachment.delete({ where: { id: attachmentId } })

  return NextResponse.json({ ok: true })
}
