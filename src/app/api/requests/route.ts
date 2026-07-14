import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDocumentNo } from "@/lib/docno"
import { notifyStatusChange } from "@/lib/notify"
import { sendMail } from "@/lib/email"
import { canonCountry } from "@/lib/freight"
import crypto from "crypto"

// Normalize a year that may be 2-digit or Thai Buddhist (B.E.) to Gregorian.
const normYear = (y: number): number => {
  if (y < 100) return y + 2000          // 26 → 2026
  if (y >= 2400 && y <= 2600) return y - 543 // B.E. 2569 → 2026
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
  const where = {}
  const requests = await prisma.airRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      // claimApprovals (who approved which SO) so the approvals queue can hide a doc
      // from the OTHER SCM NYK approver once one of them has claimed it.
      items: { include: { claimApprovals: { select: { userId: true, role: true } } } },
      attachments: { include: { uploadedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      approvalLogs: {
        // REJECT logs (for rejection info) + the "ready to book" approval
        // (VP SCM for NYG / GM for GW) so the Booking File can show who approved.
        where: { OR: [
          { action: "REJECT" },
          { action: "APPROVE", fromStatus: { in: ["PENDING_VP_SCM", "PENDING_GM_GW"] } },
        ] },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } }
      }
    }
  })
  // NOTE: don't filter items server-side by item.claimDepartment — that is only
  // the FIRST split, so multi-split docs (e.g. [SCM NYG, GW]) were wrongly dropped
  // for GW/SUPPLIER users. The client (approvals page) scopes correctly via getSplits.
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
      return NextResponse.json({ error: "Please select a VP MER" }, { status: 400 })
    }
    const isGW = bu === "GW"

    // Case-insensitive column lookup (handles template header casing variations)
    const col = (item: any, key: string) => {
      const k = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase()) ?? key
      return item[k]
    }

    // Freight rate is keyed by BRAND + COUNTRY (MER selects the country; the port
    // is not used). The same country can have different rates per brand.
    const rateKey = (country: string) => canonCountry(country)
    // Freight rate is keyed by COUNTRY only (one country = one rate; brand ignored).
    const combos = [...new Map(items
      .map((i: any) => ({ country: String(col(i, "Country") || "").trim() }))
      .filter((x: any) => x.country)
      .map((x: any) => [rateKey(x.country), x])).values()] as { country: string }[]

    const rateList = await (prisma as any).masterFreightRate.findMany({ where: { isActive: true }, orderBy: { updatedAt: "asc" } })
    const freightRates: Record<string, number> = {}
    for (const r of rateList) freightRates[rateKey(r.country)] = r.ratePerKg   // latest wins if duplicates

    const missingRates = combos.filter(x => !(rateKey(x.country) in freightRates))
    const missingCountryInfo = missingRates

    const first = items[0]
    const docNo = await generateDocumentNo()

    // NYG now has a DVM MER approval step BEFORE VP MER. Only route there if a DVM MER
    // user is actually configured (role or roles[]); otherwise skip straight to VP MER
    // so documents never get stuck at an unstaffed stage.
    const hasDvmMer = !isGW && (await prisma.user.count({
      where: { isActive: true, bu: "NYG", OR: [{ role: "DVM_MER" }, { roles: { has: "DVM_MER" } }] } as any,
    })) > 0
    const initialStatus = isGW ? "PENDING_VP_MER_GW" : (hasDvmMer ? "PENDING_DVM_MER" : "PENDING_VP_MER")

    const request = await prisma.airRequest.create({
      data: {
        documentNo: docNo,
        brandName: String(col(first, "Brand name") || col(first, "BRAND") || ""),
        buName: String(col(first, "BU") || ""),
        bu: isGW ? "GW" : "NYG",
        status: initialStatus,
        createdById: userId,
        assignedVpMer,
        // Hold from VP MER until every Country has a freight rate.
        pendingRate: missingRates.length > 0,
        vpMerToken: crypto.randomUUID(),
        ...(isGW ? {
          gmToken: crypto.randomUUID(),
          presidentToken: crypto.randomUUID(),
          logisticsToken: crypto.randomUUID(),
          accountingToken: crypto.randomUUID(),
          claimGwToken: crypto.randomUUID(),
          claimSupplierToken: crypto.randomUUID(),
          scmNykToken: crypto.randomUUID(),
          scmNykApproverToken: crypto.randomUUID(),
          scmNykEvpToken: crypto.randomUUID(),
          scmNygToken: crypto.randomUUID(),
        } : {}),
        items: {
          create: items.map((item: any) => {
            const port = String(col(item, "Port") || "").trim()   // kept for reference/display only
            const country = String(col(item, "Country") || "").trim()
            const itemBrand = String(col(item, "Brand name") || col(item, "BRAND") || "").trim()
            const qty = Number(col(item, "QTY Request ship Air (pcs)") || 0)
            const rate = freightRates[rateKey(country)] || 0
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
              brand: itemBrand || null,
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
              country,
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

    // Only notify VP MER when the rate is complete. If any Brand+Country pair has
    // no rate, the doc is HELD (pendingRate) — VP MER is notified later, once LG
    // adds the rate (see releasePendingRateDocs in lib/freight.ts).
    if (missingRates.length === 0) {
      try {
        await notifyStatusChange(request.id, initialStatus)
      } catch (err) {
        console.error("[notify] send failed:", err)
      }
    }

    if (missingRates.length > 0) {
      try {
        const APP_URL = process.env.APP_URL || "http://localhost:3000"
        const portRowsHtml = missingCountryInfo.map(x => `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;font-weight:600">${x.country}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;color:#b45309">— add rate —</td>
        </tr>`).join("")
        const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
  <tr><td align="center">
    <table width="460" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <tr><td style="background:#b45309;padding:20px;text-align:center">
        <p style="margin:0;color:#fde68a;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">⚠ FREIGHT RATE MISSING</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
      </td></tr>
      <tr><td style="padding:28px 32px">
        <p style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif;margin:0 0 8px">Document <strong>${docNo}</strong> has Country/countries with no Freight Rate in Master — Est. Air Freight cannot be calculated (shows 0).</p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 12px"><strong>Please add these in Master &gt; Rate</strong> (Country · Rate THB/KG):</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 18px">
          <thead><tr style="background:#fef3c7">
            <th style="padding:6px 10px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#92400e">COUNTRY</th>
            <th style="padding:6px 10px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#92400e">RATE (THB/KG)</th>
          </tr></thead>
          <tbody>${portRowsHtml}</tbody>
        </table>
        <p style="color:#64748b;font-size:12px;font-family:Arial,sans-serif;margin:0 0 20px">After adding the Rate, open the document and click <strong>Recalculate</strong> — the Est. Air Freight will then appear.</p>
        <div style="text-align:center">
          <a href="__LINK__" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;font-family:Arial,sans-serif">Open Master Rate →</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`

        const subject = `[Freight Rate Missing] ${docNo} — no rate for (${missingRates.map(x => x.country).join(", ")})`
        // Notify this BU's Logistics + Admin + a fixed extra recipient. Send a
        // PERSONALISED magic link per recipient so clicking logs THEM in.
        const lgRoles = isGW ? ["LOGISTICS_GW"] : ["LOGISTICS"]
        const EXTRA_EMAIL = "jariya.t@nanyangtextile.com"
        const recips = await (prisma.user as any).findMany({
          where: { isActive: true, OR: [{ role: { in: [...lgRoles, "ADMIN"] } }, { email: EXTRA_EMAIL }] },
          select: { id: true, email: true },
        })
        for (const u of recips) {
          if (!u.email) continue
          const token = crypto.randomUUID()
          await (prisma.user as any).update({ where: { id: u.id }, data: { loginToken: token, loginTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) } })
          const link = `${APP_URL}/api/magic-login?token=${token}&redirect=/master/port`
          await sendMail(u.email, subject, html.replace("__LINK__", link))
        }
        // Ensure the fixed extra recipient always gets it, even if not a system user.
        if (!recips.some((u: any) => (u.email || "").toLowerCase() === EXTRA_EMAIL)) {
          await sendMail(EXTRA_EMAIL, subject, html.replace("__LINK__", `${APP_URL}/master/port`))
        }
      } catch (err) {
        console.error("[notify] missing freight-rate email failed:", err)
      }
    }

    return NextResponse.json({ id: request.id, missingRates })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
