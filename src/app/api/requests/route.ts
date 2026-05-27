import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDocumentNo } from "@/lib/docno"
import { notifyStatusChange } from "@/lib/notify"

const parseDate = (val: any): Date | null => {
  if (!val) return null
  const d = new Date(val)
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
    const { items } = body
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items" }, { status: 400 })
    }

    const descNames = [...new Set(items.map((i: any) => String(i["DESCRIPTION"] || "")).filter(Boolean))] as string[]
    const portNames = [...new Set(items.map((i: any) => String(i["Port"] || "")).filter(Boolean))] as string[]

    const [descList, portList] = await Promise.all([
      prisma.masterDescription.findMany({ where: { name: { in: descNames } } }),
      prisma.masterPort.findMany({ where: { port: { in: portNames } } })
    ])

    const descWeights: Record<string, number> = {}
    for (const d of descList) descWeights[d.name] = d.weightPerUnit

    const portRates: Record<string, number> = {}
    for (const p of portList) portRates[p.port] = p.ratePerKg

    const first = items[0]
    const docNo = await generateDocumentNo()

    const request = await prisma.airRequest.create({
      data: {
        documentNo: docNo,
        brandName: String(first["Brand name"] || first["BRAND"] || ""),
        buName: String(first["BU"] || ""),
        status: "PENDING_VP_MER",
        createdById: userId,
        items: {
          create: items.map((item: any) => {
            const desc = String(item["DESCRIPTION"] || "")
            const port = String(item["Port"] || "")
            const qty = Number(item["QTY Request ship Air (pcs)"] || 0)
            const weight = descWeights[desc] || 0
            const rate = portRates[port] || 0
            const gw = qty * weight
            return {
              style: String(item["STYLE"] || ""),
              so: String(item["SO"] || ""),
              customerPO: String(item["CUSTOMER PO"] || ""),
              description: desc,
              gmtType: String(item["GMT_TYPE"] || ""),
              originalShipmentDate: parseDate(item["Original Shipment Date"]),
              planShipmentDate: parseDate(item["Plan Shipment Date"]),
              qtyOriginalShipment: Number(item["QTY Original Shipment (pcs)"] || 0),
              qtyRequestAir: qty,
              reasonDelay: String(item["Reason delay"] || ""),
              factory: String(item["Factory"] || ""),
              country: String(item["Country"] || ""),
              port,
              grossWeight: gw,
              airFreight: gw * rate,
              marketRatePerKg: rate > 0 ? rate : null,
            }
          })
        }
      }
    })

    notifyStatusChange(request.id, "PENDING_VP_MER").catch(() => {})
    return NextResponse.json({ id: request.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
