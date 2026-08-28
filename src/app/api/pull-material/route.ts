import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/email"
import { runWithTestMail } from "@/lib/test-ctx"
import { magicLoginFor } from "@/lib/notify"

const APP_URL = process.env.APP_URL || "http://localhost:3000"

// List Pull Material requests (optionally by BU).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const bu = (req.nextUrl.searchParams.get("bu") || "").trim()
  const rows = await (prisma as any).pullMaterialRequest.findMany({
    where: bu ? { bu } : {},
    include: { items: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ requests: rows })
}

// Create a Pull Material request — snapshot the selected BOM material lines.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id

  const body = await req.json()
  const bu = String(body.bu || "NYG").toUpperCase()
  const requestType = body.requestType === "PURCHASING" ? "PURCHASING" : "SCM"
  const isAdmin = (session.user as any).role === "ADMIN"
  const isTest = isAdmin && body.isTest === true // only admin can mark a doc as TEST
  const requesterName = String(body.requesterName || "").trim()
  const items: any[] = Array.isArray(body.items) ? body.items : []
  if (!requesterName) return NextResponse.json({ error: "requesterName required" }, { status: 400 })
  if (items.length === 0) return NextResponse.json({ error: "no items selected" }, { status: 400 })

  // Doc no: PULL_<BU>_YYMM_<seq>
  const now = new Date()
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`
  const prefix = `PULL_${bu}_${yymm}_`
  const last = await (prisma as any).pullMaterialRequest.findFirst({
    where: { documentNo: { startsWith: prefix } },
    orderBy: { documentNo: "desc" },
    select: { documentNo: true },
  })
  const seq = last ? Number(last.documentNo.slice(prefix.length)) + 1 : 1
  const documentNo = `${prefix}${String(seq).padStart(4, "0")}`

  const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v))
  const dt = (v: any) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d }

  const created = await (prisma as any).pullMaterialRequest.create({
    data: {
      documentNo, bu, requesterName,
      requesterEmail: body.requesterEmail || null,
      remark: body.remark || null,
      createdById: userId,
      requestType,
      isTest,
      // SCM branch: SCM creates → Purchase fills first. PC branch: Purchase creates + fills at once → straight to Logistics.
      status: requestType === "PURCHASING" ? "PENDING_LOGISTICS" : "PENDING_PURCHASING",
      items: {
        create: items.map((i: any) => ({
          soNoDoc: String(i.soNoDoc || ""),
          customerName: i.customerName || null,
          customerPo: i.customerPo || null,
          vendorName: i.vendorName || null,
          poNoDoc: i.poNoDoc || null,
          style: i.style || null,
          brand: i.brand || null,
          gmtType: i.gmtType || null,
          itemCode: i.itemCode || null,
          itemName: i.itemName || null,
          orderQty: num(i.orderQty),
          bomQty: num(i.bomQty),
          bomUom: i.bomUom || null,
          consumption: num(i.consumption),
          shipmentDate: dt(i.shipmentDate),
          soYear: i.soYear || null,
          groupCode: i.groupCode || null,
          cpartNo: i.cpartNo || null,
          partDesc: i.partDesc || null,
          itemNo: i.itemNo || null,
          poqtyBomdummy: num(i.poqtyBomdummy),
          poDate: dt(i.poDate),
          updInhouse: dt(i.updInhouse),
          bomStatus: i.status || i.bomStatus || null,
          poUsername: i.poUsername || null,
          mrdDate: dt(i.mrdDate),
          mrdNeedDate: dt(i.mrdNeedDate),
          mrd2: dt(i.mrd2),
          pullGarment: num(i.pullGarment),
          pullMaterialQty: num(i.pullMaterialQty),
          inHouseAirDate: dt(i.inHouseAirDate),
          inHouseSeaDate: dt(i.inHouseSeaDate),
          sewingStartDate: dt(i.sewingStartDate),
          reasonAirPick: i.reasonAirPick || null,
          grossWeightKg: num(i.grossWeightKg),
          airFreightCost: num(i.airFreightCost),
          // System-suggested weight (ref for Purchasing) = pull qty × consumption per unit.
          weightGenerated: (num(i.pullMaterialQty) && num(i.consumption)) ? Math.round(num(i.pullMaterialQty)! * num(i.consumption)! * 100) / 100 : null,
        })),
      },
    },
    include: { items: true },
  })

  // SCM request lands at Purchasing → alert the whole Purchasing pool (all see the same doc; whoever
  // fills it first advances the status → it drops off everyone else's Purchase queue automatically).
  if (created.status === "PENDING_PURCHASING") {
    const purUsers = await (prisma.user as any).findMany({
      where: { isActive: true, OR: [{ role: "PURCHASING" }, { roles: { has: "PURCHASING" } }] },
      select: { id: true, email: true },
    })
    // De-dupe by email; keep one id per email.
    const seen = new Set<string>()
    const recips = purUsers.filter((u: any) => u.email && !seen.has(u.email.toLowerCase()) && seen.add(u.email.toLowerCase()))
    if (recips.length) {
      const sos = [...new Set((created.items || []).map((i: any) => i.soNoDoc).filter(Boolean))].join(", ")
      const subject = `[Purchasing] New Pull Material — ${created.documentNo}`
      // Send EACH purchasing user their OWN magic link → clicking auto-logs them in as THEIR account
      // (no password) and opens the Purchase queue. Whoever fills it first advances the doc → it drops
      // off everyone else's queue.
      const testTo = isTest ? (String(session.user?.email || "") || null) : null
      await runWithTestMail(testTo, async () => {
        for (const u of recips) {
          const link = await magicLoginFor(u.id, "/pull-material/purchase")
          const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
            <h2 style="color:#6b1a1a;margin:0 0 10px">Pull Material — new request for Purchasing</h2>
            <p><b>${created.documentNo}</b> (${bu}) needs Purchase to fill Country / Port / Incoterm / Weight.</p>
            <table style="border-collapse:collapse;font-size:13px;margin:6px 0">
              <tr><td style="color:#888;padding-right:12px">Requester</td><td>${requesterName}</td></tr>
              <tr><td style="color:#888;padding-right:12px">SO</td><td>${sos || "-"}</td></tr>
              <tr><td style="color:#888;padding-right:12px">Items</td><td>${(created.items || []).length}</td></tr>
            </table>
            <p style="margin-top:14px"><a href="${link}" style="background:#6b1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;display:inline-block">Open Purchase queue →</a></p>
            <p style="color:#9ca3af;font-size:12px;margin-top:12px">This link logs you in automatically (no password). Anyone in Purchasing can take it — once someone submits it to Logistics it leaves the queue for everyone.</p>
          </div>`
          await sendMail([u.email], subject, html).catch(() => {})
        }
      }).catch(() => {})
    }
  }

  return NextResponse.json({ request: created })
}
