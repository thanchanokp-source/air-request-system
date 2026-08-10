import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDocumentNo } from "@/lib/docno"
import { notifyStatusChange } from "@/lib/notify"
import { normalizeSo } from "@/lib/so"
import { buildRequestItems } from "@/lib/build-items"
import crypto from "crypto"

// "NYK Direct" GW import. Special GW flow that SKIPS every approver (MER/DPM/GM/President/LG) and
// lands the document straight at the SCM NYK claim stage — NYK is the only approver. The file
// already carries Logistics data (INV NO / HAWB# / Total HAWB#) + a NYK 100% claim, so:
//   • actual air per SO is computed here from Total HAWB# (split across the HAWB group by QTY Air),
//   • the claim is pre-filled as SCM NYK 100%, itemStatus = PRES_PASSED (the GW claim/NYK stage),
//   • after NYK's 3-role approval completes, the doc goes straight to Accounting (skip President,
//     handled by nykDirect + deriveGwItemStatus skipPresident).
// Only admin or an SCM NYK role may run it. Attachments are uploaded separately to the created doc.
const NYK_ROLES = ["SCM_NYK_APPROVER", "SCM_NYK", "SCM_NYK_EVP"]

const numOf = (v: any) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isNaN(n) ? 0 : n }
const col = (item: any, key: string) => {
  const k = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase()) ?? key
  return item[k]
}
const colLike = (item: any, ...subs: string[]) => {
  const k = Object.keys(item).find(k => { const lk = k.toLowerCase(); return subs.every(s => lk.includes(s.toLowerCase())) })
  return k ? item[k] : ""
}
const parseDate = (v: any): Date | null => {
  if (v == null || v === "") return null
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d.getTime()) ? null : d }
  const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d
}
const normGwDept = (raw: string) => { const u = String(raw || "").trim().toUpperCase(); return u === "NYK" ? "SCM NYK" : u === "NYG" ? "SCM NYG" : String(raw || "").trim() }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role
  const roles: string[] = [role, ...(((session.user as any).roles) || [])]
  const allowed = role === "ADMIN" || roles.some(r => NYK_ROLES.includes(r))
  if (!allowed) return NextResponse.json({ error: "Only Admin or an SCM NYK role can run the NYK Direct import" }, { status: 403 })

  const body = await req.json()
  const items: any[] = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ error: "No rows found in the file" }, { status: 400 })
  // NYK is a SHARED claim across BUs → this import works for any BU. The document is TAGGED with
  // the chosen BU (for reporting/filtering) but always rides the GW-style NYK claim machinery
  // (nykDirect forces the GW claim flow in the approve route + detail page, so the same SCM NYK
  // 3-role can approve it regardless of BU).
  const bu = ["NYG", "GW", "EA", "TRM"].includes(String(body.bu)) ? String(body.bu) : "GW"

  // Total HAWB# is entered ONCE per HAWB group (on one row); spread it across the group's SOs
  // proportional to QTY Air — same formula the Logistics HAWB flow uses:
  //   actual_SO = round( qtyAir_SO × ( Total HAWB / Σ qtyAir in the HAWB group ), 2 )
  const hawbAgg: Record<string, { sumQty: number; total: number }> = {}
  for (const it of items) {
    const hawb = String(col(it, "HAWB#") || "").trim()
    if (!hawb) continue
    const qty = numOf(col(it, "QTY Request ship Air (pcs)") ?? col(it, "QTY AIR"))
    const total = numOf(colLike(it, "total", "hawb"))
    if (!hawbAgg[hawb]) hawbAgg[hawb] = { sumQty: 0, total: 0 }
    hawbAgg[hawb].sumQty += qty
    if (total > 0) hawbAgg[hawb].total = total
  }
  const actualOf = (it: any): number | null => {
    const hawb = String(col(it, "HAWB#") || "").trim()
    const g = hawb ? hawbAgg[hawb] : null
    if (!g || g.sumQty <= 0 || g.total <= 0) return null
    const qty = numOf(col(it, "QTY Request ship Air (pcs)") ?? col(it, "QTY AIR"))
    return Math.round(qty * (g.total / g.sumQty) * 100) / 100
  }

  const first = items[0]
  const documentNo = await generateDocumentNo(bu)
  const userId = (session.user as any).id

  // Compute Gross Weight + EST air freight with the SAME master lookups as a normal upload
  // (gross = QTY Original × weightPerUnit from Master Description; est = gross × country rate).
  // `built[i]` is index-aligned with `items` and carries port/dates/qty too — reuse them, then
  // OVERRIDE the claim (SCM NYK 100%), Logistics (INV/HAWB), actual, and status for NYK Direct.
  const calc = await buildRequestItems(items, { isGW: bu === "GW", isEA: bu === "EA" })
  const built = calc.items

  const itemData = items.map((it: any, idx: number) => {
    const b = built[idx] || {}
    const reason = String(col(it, "REASON 1") || col(it, "Reason delay") || "").trim() || null
    // Claim splits from the file (CLAIM DEPT 1..3 + %CLAIM1..3). "NYK" → "SCM NYK". If the file
    // gives no split, default to SCM NYK 100%. In a NYK import, the SCM NYK portion still awaits
    // SCM NYK approval; any OTHER dept (e.g. COMMERCIAL 50%) is a settled cost-allocation → mark it
    // DEPT_APPROVED so it doesn't block, and only SCM NYK needs to sign off.
    // Tolerant column matching: "CLAIM DEPT 1" / "CLAIMDEPT1" and "%CLAIM1" / "%CLAIM 1" etc.
    const rawSplits = [1, 2, 3]
      .map(n => ({
        dept: normGwDept(String(colLike(it, "claim", "dept", String(n)) || "")),
        pct: numOf(colLike(it, "%", "claim", String(n))),
      }))
      .filter(s => s.dept)
    const claimDepts = (rawSplits.length && rawSplits.reduce((a, s) => a + s.pct, 0) > 0)
      ? rawSplits.map(s => ({ dept: s.dept, pct: s.pct, reason, status: s.dept === "SCM NYK" ? null : "DEPT_APPROVED", crNo: null }))
      : [{ dept: "SCM NYK", pct: 100, reason, status: null, crNo: null }]
    const nykFirst = claimDepts.find(s => s.dept === "SCM NYK") || claimDepts[0]
    return {
      style: b.style ?? String(col(it, "STYLE") || ""),
      so: b.so ?? normalizeSo(col(it, "SO")),
      brand: b.brand ?? (String(col(it, "Brand name") || col(it, "BRAND") || "") || null),
      sub: b.sub ?? null,
      customerPO: b.customerPO ?? String(col(it, "CUSTOMER PO") || ""),
      description: b.description ?? String(col(it, "DESCRIPTION") || ""),
      originalShipmentDate: b.originalShipmentDate ?? parseDate(col(it, "Original Shipment Date")),
      planShipmentDate: b.planShipmentDate ?? parseDate(col(it, "Plan Shipment Date")),
      qtyOriginalShipment: b.qtyOriginalShipment ?? Number(numOf(col(it, "QTY Original Shipment (pcs)"))),
      qtyRequestAir: b.qtyRequestAir ?? Number(numOf(col(it, "QTY Request ship Air (pcs)") ?? col(it, "QTY AIR"))),
      reasonDelay: b.reasonDelay ?? String(col(it, "Reason delay") || ""),
      factory: b.factory ?? String(col(it, "Factory") || ""),
      country: b.country ?? String(col(it, "Country") || ""),
      port: b.port ?? String(col(it, "PORT") || col(it, "Port") || ""),
      grossWeight: b.grossWeight ?? 0,           // = QTY Orig × weightPerUnit (Master Description)
      airFreight: b.airFreight ?? 0,             // = gross × country rate (Master Rate)
      marketRatePerKg: b.marketRatePerKg ?? null,
      invoiceNo: String(col(it, "INV NO.") || col(it, "Invoice No") || "") || null,
      hawbNo: String(col(it, "HAWB#") || "") || null,
      actualAirFreight: actualOf(it),
      claimDepartment: nykFirst.dept,
      claimDepts: claimDepts as any,
      claimPercentage: nykFirst.pct,
      // NYK split pending → the SO sits at the GW claim/NYK stage.
      itemStatus: "PRES_PASSED",
    }
  })

  const request = await prisma.airRequest.create({
    data: {
      documentNo,
      brandName: String(col(first, "Brand name") || col(first, "BRAND") || ""),
      buName: String(col(first, "BU") || bu),
      bu,
      status: "PENDING_CLAIM_GW",
      nykDirect: true,
      logisticsSent: true, // LG data (INV/HAWB/actual) is supplied by the import
      createdById: userId,
      scmNykApproverToken: crypto.randomUUID(),
      scmNykToken: crypto.randomUUID(),
      scmNykEvpToken: crypto.randomUUID(),
      accountingToken: crypto.randomUUID(),
      items: { create: itemData as any },
    },
    include: { items: true },
  })

  // Notify the SCM NYK approver(s) that a claim is waiting (PENDING_CLAIM_GW = parallel claim stage).
  await notifyStatusChange(request.id, "PENDING_CLAIM_GW").catch(() => {})

  return NextResponse.json({ id: request.id, documentNo: request.documentNo, items: request.items.length })
}
