import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { supabase, BUCKET } from "@/lib/supabase-storage"

// List a Pull Material request's attachments.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const rows = await (prisma as any).pullMaterialAttachment.findMany({ where: { requestId: id }, orderBy: { createdAt: "asc" } })
  return NextResponse.json(rows)
}

// Upload a file to a Pull Material request (multipart → Supabase bucket + a metadata row).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id
  const { id } = await params

  const doc = await (prisma as any).pullMaterialRequest.findUnique({ where: { id }, select: { id: true } })
  if (!doc) return NextResponse.json({ error: "Request not found" }, { status: 404 })

  const form = await req.formData()
  const file = form.get("file") as File
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const ext = file.name.split(".").pop() || "bin"
  const storagePath = `pm/${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream", upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = await (prisma as any).pullMaterialAttachment.create({
    data: {
      requestId: id, uploadedById: userId || null,
      fileName: file.name, filePath: storagePath,
      fileSize: buffer.length, mimeType: file.type || "application/octet-stream",
    },
  })
  return NextResponse.json(row)
}
