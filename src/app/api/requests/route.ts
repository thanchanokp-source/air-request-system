import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDocumentNo } from "@/lib/docno"
import { notifyStatusChange, notifyMissingMaster } from "@/lib/notify"
import { sendMail } from "@/lib/email"
import { canonCountry } from "@/lib/freight"
import { attachGarmentPo } from "@/lib/bom"
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
  // NOTE: BU visibility is filtered CLIENT-side (via the BU toggle + viewableBus). The API
  // returns every request so cross-BU roles (Accounting, SCM_NYK, claim forwards) never lose
  // sight of a document. Do NOT BU-scope here — it hid legitimately-shared GW/NYG data.
  const where = {}
  const requests = await prisma.airRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      // claimApprovals (who approved which SO) so the approvals queue can hide a doc
      // from the OTHER SCM NYK approver once one of them has claimed it.
      items: { include: { claimApprovals: { select: { userId: true, role: true } } } },
      // Forced-position forward rows → show who each claim dept is currently waiting on.
      claimForwards: { select: { dept: true, nextName: true, nextEmail: true, position: true, itemIds: true } },
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
  // Attach the garment PO(s) from the Bill of Material (RPA reference) for recheck at claim.
  await attachGarmentPo(requests as any)
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id

  try {
    const body = await req.json()
    const { items, assignedVpMer, assignedDvm, bu, isTest, historical } = body
    const role = (session.user as any).role
    // Only ADMIN may create TEST documents (all their emails reroute to the admin, hidden from users).
    const isTestDoc = !!isTest && role === "ADMIN"
    // Admin can IMPORT old/completed documents as a record only — saved straight as COMPLETED,
    // no approval flow, no emails, no first-approver pick required.
    const isHistorical = !!historical && role === "ADMIN"
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items" }, { status: 400 })
    }
    const isGW = bu === "GW"
    const isEA = bu === "EA"   // EA = same flow as NYG, only the top-3 approvers differ
    // First-approver pick is required for the NORMAL flow only (historical imports skip approval).
    if (!isHistorical) {
      // MER picks the FIRST approver from master: GW → DPM (assignedVpMer), NYG/EA → DVM/ADVM (assignedDvm).
      if (!assignedVpMer && isGW) {
        return NextResponse.json({ error: "Please select a DPM (GW)" }, { status: 400 })
      }
      if (!assignedDvm && !isGW) {
        return NextResponse.json({ error: isEA ? "Please select an ADVM (EA)" : "Please select a DVM Merchandise" }, { status: 400 })
      }
    }

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

    // Gross Weight = QTY Air × WT Charge/pc of the DESCRIPTION (MER no longer types weight).
    // The description must exist in Master Description with a WT Charge > 0. Any description
    // that's missing / has no WT Charge → the doc is HELD (pendingWeight) until LG adds it.
    // Normalise for matching: case-insensitive, trim, and collapse repeated spaces so
    // "t-shirt", "T-SHIRT", "  T-SHIRT " all match the same Master Description.
    const descKey = (s: string) => String(s || "").trim().toUpperCase().replace(/\s*,\s*/g, ",").replace(/\s+/g, " ")
    const descList = await (prisma as any).masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
    const descWeights: Record<string, number> = {}
    for (const d of descList) descWeights[descKey(d.name)] = d.weightPerUnit || 0
    const descKeys = Object.keys(descWeights)
    // Levenshtein ratio — catches typos / plurals / minor variations, but a REORDER of the same
    // words (e.g. JACKET,PULLOVER,SWEATSHIRT vs JACKET,SWEATSHIRT,PULLOVER) scores low, so those
    // stay distinct. Only truly-unknown descriptions fall through (→ held + alert LG/jariya).
    const lev = (a: string, b: string) => {
      const m = a.length, n = b.length
      if (!m) return n; if (!n) return m
      const dp = Array.from({ length: n + 1 }, (_, j) => j)
      for (let i = 1; i <= m; i++) {
        let prev = dp[0]; dp[0] = i
        for (let j = 1; j <= n; j++) {
          const tmp = dp[j]
          dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
          prev = tmp
        }
      }
      return dp[n]
    }
    const FUZZY_MIN = 0.85 // ≥85% similar → treat as the same description
    const wtChargeFor = (desc: string): number => {
      const k = descKey(desc)
      if (!k) return 0
      if (descWeights[k] != null) return descWeights[k]        // exact (after normalise)
      let best = "", ratio = 0
      for (const mk of descKeys) {
        const r = 1 - lev(k, mk) / Math.max(k.length, mk.length, 1)
        if (r > ratio) { ratio = r; best = mk }
      }
      return ratio >= FUZZY_MIN ? descWeights[best] : 0        // no close match → 0 (held + alert)
    }
    const missingDescriptions = [...new Set(items
      .map((i: any) => String(col(i, "DESCRIPTION") || "").trim())
      .filter((d: string) => d && wtChargeFor(d) <= 0))] as string[]

    const first = items[0]
    const buCodeForNo = isGW ? "GW" : isEA ? "EA" : "NYG"
    // TEST docs get their own throwaway number (timestamp) so they never touch the real per-BU
    // running sequence and never collide with each other.
    const docNo = isTestDoc
      ? `TEST-${buCodeForNo}-${Date.now().toString().slice(-8)}`
      : await generateDocumentNo(buCodeForNo)

    // MER picked the 1st approver (assignedDvm) → route straight to that DVM/ADVM stage.
    // (Fallback to the VP stage only if — unexpectedly — no DVM was picked.)
    const initialStatus = isHistorical ? "COMPLETED"
      : isGW ? "PENDING_VP_MER_GW"
      : isEA ? (assignedDvm ? "PENDING_DVM_MER_EA" : "PENDING_VP_MER_EA")
      : (assignedDvm ? "PENDING_DVM_MER" : "PENDING_VP_MER")

    const request = await prisma.airRequest.create({
      data: {
        documentNo: docNo,
        brandName: String(col(first, "Brand name") || col(first, "BRAND") || ""),
        buName: String(col(first, "BU") || ""),
        bu: isGW ? "GW" : isEA ? "EA" : "NYG",
        status: initialStatus,
        isTest: isTestDoc,
        createdById: userId,
        assignedVpMer,
        assignedDvmMer: !isGW ? (assignedDvm || null) : null,
        // Hold from the first approver until every Country has a rate AND every
        // description has a WT Charge (so Gross/Est. Air Freight can be computed).
        pendingRate: !isHistorical && missingRates.length > 0,
        pendingWeight: !isHistorical && missingDescriptions.length > 0,
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
            const qtyOrig = Number(col(item, "QTY Original Shipment (pcs)") || 0)
            const rate = freightRates[rateKey(country)] || 0
            // Gross Weight & Est. Air Freight are computed from QTY ORIGINAL Shipment (always
            // filled by MER) × WT Charge — NOT QTY Air (which MER may leave blank → would be 0).
            // 0 only if the description has no WT Charge yet (held).
            // Historical import already carries a real WEIGHT(KG) in the file → use it directly
            // (old descriptions like "KNITTED SHIRT" aren't in Master, so recomputing = 0). Normal
            // uploads still compute Gross = QTY Original × WT Charge from Master Description.
            const fileWeight = Number(String(col(item, "WEIGHT(KG)") ?? col(item, "WEIGHT") ?? "").replace(/,/g, "")) || 0
            const gw = (isHistorical && fileWeight > 0)
              ? fileWeight
              : qtyOrig * wtChargeFor(String(col(item, "DESCRIPTION") || ""))
            // GW: read up to 3 claim splits from Excel (CLAIM DEPT 1/2/3 + %CLAIM + REASON)
            // airCost is computed at display time from actualAirFreight so it stays accurate.
            let claimDepts: any = null
            let claimDept: string | null = null
            let claimPct: number | null = null
            if (isGW) {
              // Template may show short labels (NYK / NYG); store the canonical GW dept
              // values the app matches on (SCM NYK / SCM NYG). GW / SUPPLIER unchanged.
              const normGwDept = (raw: string) => {
                const s = raw.trim()
                const u = s.toUpperCase()
                if (u === "NYK") return "SCM NYK"
                if (u === "NYG") return "SCM NYG"
                return s
              }
              const splits = [1, 2, 3]
                .map(n => ({
                  dept: normGwDept(String(col(item, `CLAIM DEPT ${n}`) || "")),
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
              ...(isHistorical && { itemStatus: "COMPLETED" }),
              ...(isGW && { claimDepartment: claimDept, claimDepts, claimPercentage: claimPct }),
            }
          })
        }
      }
    })

    // Only notify the first approver when BOTH the rate AND all WT Charges are complete.
    // If a country rate or a description WT Charge is missing, the doc is HELD and the
    // approver is notified later, once LG adds them (see releaseHeldDocs in lib/freight.ts).
    if (isHistorical) {
      // Historical import → saved as COMPLETED record, no approver notification.
    } else if (missingRates.length === 0 && missingDescriptions.length === 0) {
      try {
        await notifyStatusChange(request.id, initialStatus)
      } catch (err) {
        console.error("[notify] send failed:", err)
      }
    } else {
      // Master data incomplete → doc is HELD. Alert the master-data maintainers with the exact
      // missing countries (rate) / descriptions (WT Charge) so they can add them and release it.
      await notifyMissingMaster(
        request.id,
        missingRates.map((x: any) => x.country),
        missingDescriptions,
      ).catch(() => {})
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

    // WT Charge missing for one or more descriptions → alert LG + jariya to add them in
    // Master Description. The doc is HELD (pendingWeight) and reaches the approver only
    // after the WT Charge is entered (releaseHeldDocs recomputes Gross + releases).
    if (missingDescriptions.length > 0) {
      try {
        const APP_URL = process.env.APP_URL || "http://localhost:3000"
        const rowsHtml = missingDescriptions.map(d => `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;font-weight:600">${d}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;color:#b45309">— add WT Charge —</td>
        </tr>`).join("")
        const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0"><tr><td align="center">
  <table width="460" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#b45309;padding:20px;text-align:center">
      <p style="margin:0;color:#fde68a;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">⚠ WT CHARGE MISSING</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif;margin:0 0 8px">Document <strong>${docNo}</strong> has description(s) with no <strong>WT Charge</strong> in Master Description — Gross Weight / Est. Air Freight cannot be computed, and the document is <strong>on hold</strong> until you add them.</p>
      <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 12px"><strong>Please add WT Charge for these in Master &gt; Description</strong>:</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 18px">
        <thead><tr style="background:#fef3c7">
          <th style="padding:6px 10px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#92400e">DESCRIPTION</th>
          <th style="padding:6px 10px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#92400e">WT CHARGE/PC (KG)</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="color:#64748b;font-size:12px;font-family:Arial,sans-serif;margin:0 0 20px">Once added, the document is released automatically to the next approver.</p>
      <div style="text-align:center">
        <a href="__LINK__" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;font-family:Arial,sans-serif">Open Master Description →</a>
      </div>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`
        const subject = `[WT Charge Missing] ${docNo} — no WT Charge for (${missingDescriptions.join(", ")})`
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
          const link = `${APP_URL}/api/magic-login?token=${token}&redirect=/master/description`
          await sendMail(u.email, subject, html.replace("__LINK__", link))
        }
        if (!recips.some((u: any) => (u.email || "").toLowerCase() === EXTRA_EMAIL)) {
          await sendMail(EXTRA_EMAIL, subject, html.replace("__LINK__", `${APP_URL}/master/description`))
        }
      } catch (err) {
        console.error("[notify] missing WT-charge email failed:", err)
      }
    }

    return NextResponse.json({ id: request.id, missingRates, missingDescriptions })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
