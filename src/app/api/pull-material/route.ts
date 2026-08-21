import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
      status: "PENDING_PURCHASING",
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
  return NextResponse.json({ request: created })
}
