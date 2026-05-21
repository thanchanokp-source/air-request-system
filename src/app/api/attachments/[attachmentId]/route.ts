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
  const { attachmentId } = await params

  const att = await prisma.requestAttachment.findUnique({ where: { id: attachmentId } })
  if (att) {
    await supabase.storage.from(BUCKET).remove([att.filePath])
    await prisma.requestAttachment.delete({ where: { id: attachmentId } })
  }

  return NextResponse.json({ ok: true })
}
