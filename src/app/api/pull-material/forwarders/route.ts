import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Forwarder contact master (Pull RM Phase 2). LG picks a FWD here when mailing the actual-entry
// template; sending to a brand-new address upserts it, so the list fills itself over time.
const canEdit = (u: any) => !!u && (u.role === "ADMIN" || u.roles?.includes("LOGISTICS_IMPORT") || u.roles?.includes("ADMIN"))

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // ?all=1 → include disabled contacts too (the master page shows everything).
  const all = new URL(req.url).searchParams.get("all") === "1"
  const rows = await (prisma as any).pullForwarder.findMany({ where: all ? {} : { isActive: true }, orderBy: { name: "asc" } })
  return NextResponse.json({ rows })
}

// Create / update one forwarder contact (Admin + Logistics Import).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canEdit(session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const b = await req.json()
  const name = String(b.name || "").trim()
  const email = String(b.email || "").trim().toLowerCase()
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "invalid email" }, { status: 400 })
  const row = await (prisma as any).pullForwarder.upsert({
    where: { name },
    update: { ...(email ? { email } : {}), ...(b.contactName !== undefined ? { contactName: b.contactName || null } : {}), ...(b.tel !== undefined ? { tel: b.tel || null } : {}), ...(b.isActive !== undefined ? { isActive: !!b.isActive } : {}) },
    create: { name, email, contactName: b.contactName || null, tel: b.tel || null },
  })
  return NextResponse.json({ ok: true, row })
}

// Edit one contact (Admin + Logistics Import). Renaming is allowed — the doc keeps its own copy of
// the name it was sent to, so history is not rewritten.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canEdit(session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const email = b.email !== undefined ? String(b.email || "").trim().toLowerCase() : undefined
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "invalid email" }, { status: 400 })
  const row = await (prisma as any).pullForwarder.update({
    where: { id: b.id },
    data: {
      ...(b.name !== undefined ? { name: String(b.name).trim() } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(b.contactName !== undefined ? { contactName: b.contactName || null } : {}),
      ...(b.tel !== undefined ? { tel: b.tel || null } : {}),
      ...(b.isActive !== undefined ? { isActive: !!b.isActive } : {}),
    },
  })
  return NextResponse.json({ ok: true, row })
}

// Remove a contact (Admin + Logistics Import) — hard delete; the documents keep their own fwdName/fwdEmail.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canEdit(session?.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await (prisma as any).pullForwarder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
