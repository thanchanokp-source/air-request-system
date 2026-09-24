import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyPullStage } from "@/lib/pull-notify"
import { recomputePullAir } from "@/lib/pull-freight"
import { itemHasAnyRate } from "@/lib/pull-courier"

// List Pull Material requests (optionally by BU).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const bu = (req.nextUrl.searchParams.get("bu") || "").trim()
  const rows = await (prisma as any).pullMaterialRequest.findMany({
    where: bu ? { bu } : {},
    // category/source are needed by the PDF (it labels INV/Packing from PC vs AWB/summary from LG).
    include: { items: true, attachments: { select: { id: true, fileName: true, category: true, source: true } } },
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
  const requestType = body.requestType === "PURCHASING" ? "PURCHASING" : body.requestType === "SAMPLE" ? "SAMPLE" : "SCM"
  const mode = body.mode === "REGULAR" ? "REGULAR" : "IRREGULAR"
  const isAdmin = (session.user as any).role === "ADMIN"
  const isTest = isAdmin && body.isTest === true // only admin can mark a doc as TEST
  const requesterName = String(body.requesterName || "").trim()
  const items: any[] = Array.isArray(body.items) ? body.items : []
  if (!requesterName) return NextResponse.json({ error: "requesterName required" }, { status: 400 })
  if (items.length === 0) return NextResponse.json({ error: "no items selected" }, { status: 400 })

  // Doc no: <FAMILY>_<BU>_YYMM_<seq> — SCM-keyed docs use SCM_ prefix, Purchase-keyed keep PULL_.
  const now = new Date()
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`
  const family = requestType === "SCM" ? "SCM" : requestType === "SAMPLE" ? "MER" : "PULL"
  const prefix = `${family}_${bu}_${yymm}_`
  const last = await (prisma as any).pullMaterialRequest.findFirst({
    where: { documentNo: { startsWith: prefix } },
    orderBy: { documentNo: "desc" },
    select: { documentNo: true },
  })
  const seq = last ? Number(last.documentNo.slice(prefix.length)) + 1 : 1
  const documentNo = `${prefix}${String(seq).padStart(4, "0")}`

  const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v))
  const dt = (v: any) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d }

  try {
  const created = await (prisma as any).pullMaterialRequest.create({
    data: {
      documentNo, bu, requesterName,
      requesterEmail: body.requesterEmail || null,
      remark: body.remark || null,
      packages: Array.isArray(body.packages) && body.packages.length ? body.packages : undefined,
      poInvoices: body.poInvoices && typeof body.poInvoices === "object" && Object.keys(body.poInvoices).length ? body.poInvoices : undefined,
      vendorEmail: body.vendorEmail || null,
      vendorContact: body.vendorContact || null,
      vendorTel: body.vendorTel || null,
      factory: body.factory || null,
      // Sample (MER): the specific purchaser to alert (they fill Country/Port next). Null → whole PC pool.
      purchaserEmail: body.purchaserEmail || null,
      createdById: userId,
      requestType,
      mode,
      isTest,
      // SCM requests land at Purchasing (they fill Country/Port/Incoterm/Weight there).
      // PURCHASING (PC) requests fill all that ON the request page → straight to DPM approval.
      status: requestType === "PURCHASING" ? "PENDING_VP_PUR" : "PENDING_PURCHASING",
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
          ou: i.ou || null,
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
          // PC-entered at request time (null for SCM requests — Purchasing fills them later)
          weight: num(i.weight),
          country: i.country || null,
          city: i.city || null,
          port: i.port || null,
          seaPort: i.seaPort || null,
          incoterm: i.incoterm || null,
          pickupAddress: i.pickupAddress || null,
          cartons: num(i.cartons),
          boxW: num(i.boxW),
          boxL: num(i.boxL),
          boxH: num(i.boxH),
          needDate: dt(i.needDate),
          etc: dt(i.etc),
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

  // PC requests already carry Country/Port/Incoterm/Weight → auto-compute Est Air before the DPM sees it.
  if (requestType === "PURCHASING") {
    await recomputePullAir(created.id).catch(() => {})
    // GATE: if any line has NO rate in ANY mode (air + sea + courier all missing) → route to LG to fill a
    // rate BEFORE approval, so the approver always sees complete freight. LG adds the rate then forwards.
    const [seaRows, courierRows] = await Promise.all([(prisma as any).pullFreightSea.findMany(), (prisma as any).pullFreightCourier.findMany()])
    const its = await (prisma as any).pullMaterialItem.findMany({ where: { requestId: created.id }, select: { airFreightCost: true, weight: true, port: true, seaPort: true } })
    const missingRate = its.some((i: any) => i.port && Number(i.weight) > 0 && !itemHasAnyRate(i, seaRows, courierRows, created.bu))
    if (missingRate) {
      await (prisma as any).pullMaterialRequest.update({ where: { id: created.id }, data: { status: "PENDING_LG_RATE" } })
      created.status = "PENDING_LG_RATE"
    }
  }

  // Alert the owner(s) of the landing stage: SCM → the Purchasing pool; PC → the DPM approver (by BU).
  console.log(`[pull-create] ${created.documentNo} type=${requestType} → status=${created.status} · notifying`)
  await notifyPullStage(created.id, created.status).catch((e) => console.log(`[pull-create] notify failed: ${String(e).slice(0, 200)}`))

  return NextResponse.json({ request: created })
  } catch (e: any) {
    console.log(`[pull-create] FAILED: ${String(e?.message || e).slice(0, 400)}`)
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 })
  }
}
