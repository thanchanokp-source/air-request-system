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

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(att.filePath, 3600)
  if (error || !data) return NextResponse.json({ error: "Storage error" }, { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role as string
  const { attachmentId } = await params

  const att = await prisma.requestAttachment.findUnique({ where: { id: attachmentId } })
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only the uploader can delete their own attachment
  if (att.uploadedById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // MER files are locked after submission — VP MER must reject for a redo
  if (role === "MER_USER" || role === "MER_GW") {
    return NextResponse.json({ error: "ไม่สามารถลบไฟล์หลังจาก submit แล้ว กรุณาให้ VP MER Reject เพื่อสร้างใหม่" }, { status: 400 })
  }

  await supabase.storage.from(BUCKET).remove([att.filePath])
  await prisma.requestAttachment.delete({ where: { id: attachmentId } })

  return NextResponse.json({ ok: true })
}
