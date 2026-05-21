import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { supabase, BUCKET } from "@/lib/supabase-storage"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const attachments = await prisma.requestAttachment.findMany({
    where: { requestId: id },
    include: { uploadedBy: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" }
  })
  return NextResponse.json(attachments)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id
  const { id } = await params

  const form = await req.formData()
  const file = form.get("file") as File
  const itemId = form.get("itemId") as string | null
  const claimDept = form.get("claimDept") as string | null

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const ext = file.name.split(".").pop() || "bin"
  const storagePath = `${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const attachment = await prisma.requestAttachment.create({
    data: {
      requestId: id,
      itemId: itemId || null,
      uploadedById: userId,
      fileName: file.name,
      filePath: storagePath,
      fileSize: buffer.length,
      mimeType: file.type || "application/octet-stream",
      claimDept: claimDept || null,
    },
    include: { uploadedBy: { select: { name: true, role: true } } }
  })

  return NextResponse.json(attachment)
}
