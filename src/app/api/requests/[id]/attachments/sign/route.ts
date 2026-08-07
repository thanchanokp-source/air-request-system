import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabase, BUCKET } from "@/lib/supabase-storage"

// Create a short-lived signed upload URL so the browser can PUT the file DIRECTLY to Supabase
// Storage — bypassing Vercel's ~4.5MB serverless request-body limit (large invoice / email PDFs).
// The client uploads to the returned URL, then registers the file via POST /attachments (JSON).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { fileName } = await req.json().catch(() => ({}))
  if (!fileName) return NextResponse.json({ error: "fileName required" }, { status: 400 })

  const ext = String(fileName).split(".").pop() || "bin"
  const storagePath = `${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath)
  if (error || !data) return NextResponse.json({ error: error?.message || "Could not create upload URL" }, { status: 500 })

  return NextResponse.json({ uploadUrl: data.signedUrl, path: storagePath })
}
