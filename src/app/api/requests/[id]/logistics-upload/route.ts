import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

const parseDate = (val: any): Date | null => {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  if (!["LOGISTICS", "LOGISTICS_GW"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const request = await prisma.airRequest.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const form = await req.formData()
    const file = form.get("file") as File
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(ws)

    if (rows.length === 0) {
      return NextResponse.json({ error: "ไม่พบข้อมูลในไฟล์" }, { status: 400 })
    }

    // Match rows to items by SO + SUB
    const matched: { itemId: string; so: string; invoiceNo: string | null; hawbNo: string | null; qtyActualShip: number | null; actualAirFreight: number | null; bookingDate: Date | null }[] = []
    const unmatched: string[] = []

    for (const row of rows) {
      const so = String(row["SO"] || "").trim()
      const sub = String(row["SUB"] || "").trim()
      if (!so) continue

      const item = request.items.find((i: any) => i.so === so && (i.sub || "") === sub)
      if (!item) {
        unmatched.push(sub ? `${so}/${sub}` : so)
        continue
      }

      const invoiceNo = row["INV NO."] ? String(row["INV NO."]).trim() : (row["Invoice No"] ? String(row["Invoice No"]).trim() : null)
      const hawbNo = row["HAWB#"] ? String(row["HAWB#"]).trim() : null
      const qtyActualShip = row["QTY Actual Ship (pcs)"] != null ? Number(row["QTY Actual Ship (pcs)"]) : null
      const rawFreight = row["Actual Airfreight"] ?? row["Actual Air Freight (THB)"]
      const actualAirFreight = rawFreight != null ? parseFloat(String(rawFreight)) : null
      const bookingDate = parseDate(row["Booking Date"])

      matched.push({ itemId: item.id, so, invoiceNo, hawbNo, qtyActualShip, actualAirFreight: isNaN(actualAirFreight!) ? null : actualAirFreight, bookingDate })
    }

    if (matched.length === 0) {
      return NextResponse.json({ error: "ไม่มี SO ที่ตรงกับ request นี้", unmatched }, { status: 400 })
    }

    // Update matched items
    for (const m of matched) {
      const data: any = {}
      if (m.invoiceNo !== null) data.invoiceNo = m.invoiceNo
      if (m.hawbNo !== null) data.hawbNo = m.hawbNo
      if (m.qtyActualShip !== null && !isNaN(m.qtyActualShip)) data.qtyActualShip = m.qtyActualShip
      if (m.actualAirFreight !== null) data.actualAirFreight = m.actualAirFreight
      if (m.bookingDate !== null) data.bookingDate = m.bookingDate
      if (Object.keys(data).length > 0) {
        await prisma.airRequestItem.update({ where: { id: m.itemId }, data })
      }
    }

    // Return updated request
    const updated = await prisma.airRequest.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        items: {
          include: {
            claimApprovals: {
              include: { user: { select: { id: true, name: true, role: true, priority: true } } },
              orderBy: { createdAt: "asc" }
            }
          }
        },
        approvalLogs: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } }
      }
    })

    return NextResponse.json({ request: updated, matched: matched.length, unmatched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
