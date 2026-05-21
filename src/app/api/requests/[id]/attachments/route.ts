import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const UPLOAD_DIR = join(process.cwd(), "uploads")

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
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const dir = join(UPLOAD_DIR, id)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(join(dir, safeName), buffer)

  const attachment = await prisma.requestAttachment.create({
    data: {
      requestId: id,
      itemId: itemId || null,
      uploadedById: userId,
      fileName: file.name,
      filePath: join(id, safeName),
      fileSize: buffer.length,
      mimeType: file.type || "application/octet-stream",
      claimDept: claimDept || null,
    },
    include: { uploadedBy: { select: { name: true, role: true } } }
  })

  return NextResponse.json(attachment)
}
