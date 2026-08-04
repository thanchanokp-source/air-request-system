import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDocumentNo } from "@/lib/docno"
import { notifyStatusChange } from "@/lib/notify"
import { normalizeSo } from "@/lib/so"
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

  const itemData = items.map((it: any) => {
    const qty = Number(numOf(col(it, "QTY Request ship Air (pcs)") ?? col(it, "QTY AIR")))
    const reason = String(col(it, "REASON 1") || col(it, "Reason delay") || "").trim() || null
    // Claim = SCM NYK 100% (this import is NYK-only). Status null → PRES_PASSED (awaiting SCM NYK).
    const claimDepts = [{ dept: "SCM NYK", pct: 100, reason, status: null, crNo: null }]
    return {
      style: String(col(it, "STYLE") || ""),
      so: normalizeSo(col(it, "SO")),
      brand: String(col(it, "Brand name") || col(it, "BRAND") || "") || null,
      sub: String(col(it, "SUB") || "") || null,
      customerPO: String(col(it, "CUSTOMER PO") || ""),
      description: String(col(it, "DESCRIPTION") || ""),
      originalShipmentDate: parseDate(col(it, "Original Shipment Date")),
      planShipmentDate: parseDate(col(it, "Plan Shipment Date")),
      qtyOriginalShipment: Number(numOf(col(it, "QTY Original Shipment (pcs)"))),
      qtyRequestAir: qty,
      reasonDelay: String(col(it, "Reason delay") || ""),
      factory: String(col(it, "Factory") || ""),
      country: String(col(it, "Country") || ""),
      grossWeight: numOf(col(it, "WEIGHT(KG)") ?? col(it, "GROSS")) || 0,
      invoiceNo: String(col(it, "INV NO.") || col(it, "Invoice No") || "") || null,
      hawbNo: String(col(it, "HAWB#") || "") || null,
      actualAirFreight: actualOf(it),
      claimDepartment: "SCM NYK",
      claimDepts: claimDepts as any,
      claimPercentage: 100,
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
