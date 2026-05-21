import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import { join } from "path"

const UPLOAD_DIR = join(process.cwd(), "uploads")

export async function GET(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { attachmentId } = await params

  const att = await prisma.requestAttachment.findUnique({ where: { id: attachmentId } })
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const buffer = await readFile(join(UPLOAD_DIR, att.filePath))
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(att.fileName)}"`,
      "Content-Length": String(buffer.length),
    }
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { attachmentId } = await params
  await prisma.requestAttachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ ok: true })
}
