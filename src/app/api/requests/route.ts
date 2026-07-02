import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDocumentNo } from "@/lib/docno"
import { notifyStatusChange } from "@/lib/notify"
import { sendMail } from "@/lib/email"
import crypto from "crypto"

// Normalize a year that may be 2-digit or Thai Buddhist (พ.ศ.) to Gregorian.
const normYear = (y: number): number => {
  if (y < 100) return y + 2000          // 26 → 2026
  if (y >= 2400 && y <= 2600) return y - 543 // พ.ศ. 2569 → 2026
  return y
}

// Accepts many user date formats: Excel Date/serial, DD/MM/YY(YY), YYYY-MM-DD,
// separators / - . , 2-digit or Buddhist years, and month-name strings.
const parseDate = (val: any): Date | null => {
  if (val == null || val === "") return null
  // Real Excel date (cellDates:true) → already a Date object
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  // Excel serial number
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(val).trim()
  if (!s) return null

  // ISO-like: YYYY-MM-DD / YYYY/MM/DD
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/)
  if (m) {
    const d = new Date(normYear(+m[1]), +m[2] - 1, +m[3])
    return isNaN(d.getTime()) ? null : d
  }

  // Numeric with separators: a/b/year  (Thai default = DD/MM, auto-detect if a or b > 12)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    let a = +m[1], b = +m[2]
    const year = normYear(+m[3])
    let dd: number, mm: number
    if (a > 12 && b <= 12) { dd = a; mm = b }        // clearly DD/MM
    else if (b > 12 && a <= 12) { mm = a; dd = b }   // clearly MM/DD
    else { dd = a; mm = b }                           // ambiguous → DD/MM (Thai)
    const d = new Date(year, mm - 1, dd)
    return isNaN(d.getTime()) ? null : d
  }

  // Month-name formats (e.g. "13 Feb 2026", "Feb 13, 2026")
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const mine = req.nextUrl.searchParams.get("mine") === "true"
  const claimDept = (mine && role.startsWith("CLAIM_")) ? role.replace("CLAIM_", "") : null
  const where = {}
  let requests = await prisma.airRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      items: true,
      attachments: { include: { uploadedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      approvalLogs: {
        where: { action: "REJECT" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } }
      }
    }
  })

  if (claimDept) {
    requests = requests.map(r => ({
      ...r,
      items: r.items.filter((i: any) => i.claimDepartment === claimDept)
    })).filter(r => r.items.length > 0)
  }
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id

  try {
    const body = await req.json()
    const { items, assignedVpMer, bu } = body
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items" }, { status: 400 })
    }
    if (!assignedVpMer) {
      return NextResponse.json({ error: "กรุณาเลือก VP MER" }, { status: 400 })
    }
    const isGW = bu === "GW"

    // Case-insensitive column lookup (handles template header casing variations)
    const col = (item: any, key: string) => {
      const k = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase()) ?? key
      return item[k]
    }

    const portNames = [...new Set(items.map((i: any) => String(col(i, "Port") || "").trim()).filter(Boolean))] as string[]

    // Case-insensitive: normalize both sides to uppercase
    const portList = await prisma.masterPort.findMany({ where: { isActive: true } })
    const portRates: Record<string, number> = {}
    for (const p of portList) portRates[p.port.trim().toUpperCase()] = p.ratePerKg

    const missingPorts = portNames.filter(p => !(p.toUpperCase() in portRates))

    const first = items[0]
    const docNo = await generateDocumentNo()

    const request = await prisma.airRequest.create({
      data: {
        documentNo: docNo,
        brandName: String(col(first, "Brand name") || col(first, "BRAND") || ""),
        buName: String(col(first, "BU") || ""),
        bu: isGW ? "GW" : "NYG",
        status: isGW ? "PENDING_VP_MER_GW" : "PENDING_VP_MER",
        createdById: userId,
        assignedVpMer,
        vpMerToken: crypto.randomUUID(),
        ...(isGW ? {
          gmToken: crypto.randomUUID(),
          presidentToken: crypto.randomUUID(),
          logisticsToken: crypto.randomUUID(),
          accountingToken: crypto.randomUUID(),
          claimGwToken: crypto.randomUUID(),
          scmNykToken: crypto.randomUUID(),
          scmNygToken: crypto.randomUUID(),
        } : {}),
        items: {
          create: items.map((item: any) => {
            const port = String(col(item, "Port") || "").trim()
            const qty = Number(col(item, "QTY Request ship Air (pcs)") || 0)
            const rate = portRates[port.toUpperCase()] || 0
            const gw = parseFloat(String(col(item, "WEIGHT(KG)") || "0")) || 0
            // GW: read up to 3 claim splits from Excel (CLAIM DEPT 1/2/3 + %CLAIM + REASON)
            // airCost is computed at display time from actualAirFreight so it stays accurate.
            let claimDepts: any = null
            let claimDept: string | null = null
            let claimPct: number | null = null
            if (isGW) {
              const splits = [1, 2, 3]
                .map(n => ({
                  dept: String(col(item, `CLAIM DEPT ${n}`) || "").trim(),
                  pct: parseFloat(String(col(item, `%CLAIM${n}`) ?? "")) || 0,
                  reason: String(col(item, `REASON ${n}`) || "").trim() || null,
                }))
                .filter(s => s.dept)
              if (splits.length > 0) {
                claimDepts = splits
                claimDept = splits[0].dept
                claimPct = splits[0].pct || null
              }
            }
            return {
              style: String(col(item, "STYLE") || ""),
              so: String(col(item, "SO") || ""),
              sub: String(col(item, "SUB") || "") || null,
              customerPO: String(col(item, "CUSTOMER PO") || ""),
              description: String(col(item, "DESCRIPTION") || ""),
              gmtType: String(col(item, "GMT_TYPE") || ""),
              originalShipmentDate: parseDate(col(item, "Original Shipment Date")),
              planShipmentDate: parseDate(col(item, "Plan Shipment Date")),
              qtyOriginalShipment: Number(col(item, "QTY Original Shipment (pcs)") || 0),
              qtyRequestAir: qty,
              reasonDelay: String(col(item, "Reason delay") || ""),
              factory: String(col(item, "Factory") || ""),
              country: String(col(item, "Country") || ""),
              port,
              grossWeight: gw,
              airFreight: gw * rate,
              marketRatePerKg: rate > 0 ? rate : null,
              ...(isGW && { claimDepartment: claimDept, claimDepts, claimPercentage: claimPct }),
            }
          })
        }
      }
    })

    try {
      await notifyStatusChange(request.id, isGW ? "PENDING_VP_MER_GW" : "PENDING_VP_MER")
    } catch (err) {
      console.error("[notify] send failed:", err)
    }

    if (missingPorts.length > 0) {
      try {
        const APP_URL = process.env.APP_URL || "http://localhost:3000"
        const portListHtml = missingPorts.map(p => `<li style="padding:3px 0;font-family:Arial,sans-serif;">${p}</li>`).join("")
        const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
  <tr><td align="center">
    <table width="460" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <tr><td style="background:#b45309;padding:20px;text-align:center">
        <p style="margin:0;color:#fde68a;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">⚠ PORT RATE MISSING</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
      </td></tr>
      <tr><td style="padding:28px 32px">
        <p style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif;margin:0 0 8px">เอกสาร <strong>${docNo}</strong> มี Port ที่ยังไม่มีค่า Freight Rate ใน Master</p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 16px">Est. Air Freight ของ Port ต่อไปนี้จะเป็น 0 — กรุณาเพิ่ม Rate ใน Master &gt; Port:</p>
        <ul style="margin:0 0 20px;padding-left:20px;color:#1e293b;font-size:13px;">
          ${portListHtml}
        </ul>
        <p style="color:#64748b;font-size:12px;font-family:Arial,sans-serif;margin:0 0 20px">หลังเพิ่ม Rate แล้ว ให้เปิดเอกสารแล้วกด <strong>Recalculate</strong> เพื่ออัพเดทยอด</p>
        <div style="text-align:center">
          <a href="${APP_URL}/master/port" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;font-family:Arial,sans-serif">เปิด Master Port →</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`

        const subject = `[Port Missing] ${docNo} — Port ไม่มี Freight Rate (${missingPorts.join(", ")})`
        const lgUsers = await (prisma.user as any).findMany({ where: { role: "LOGISTICS", isActive: true }, select: { email: true } })
        const adminUsers = await (prisma.user as any).findMany({ where: { role: "ADMIN", isActive: true }, select: { email: true } })
        const recipients = [...lgUsers, ...adminUsers].map((u: any) => u.email).filter(Boolean)
        if (recipients.length) await sendMail(recipients, subject, html)
      } catch (err) {
        console.error("[notify] missing port email failed:", err)
      }
    }

    return NextResponse.json({ id: request.id, missingPorts })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
