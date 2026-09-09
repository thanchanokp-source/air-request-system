import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
// Usage: node scripts/check_so.mjs 01260154
const so = process.argv[2] || ""
try {
  const items = await p.airRequestItem.findMany({
    where: so ? { so: { contains: so } } : {},
    include: { request: { select: { documentNo: true, status: true, logisticsSent: true, bu: true } } },
    take: 50,
  })
  if (!items.length) { console.log("no items match SO", so); process.exit(0) }
  const bookable = ["LOG_PASSED", "CLAIM_PASSED", "PRES_PASSED"]
  for (const it of items) {
    const actual = it.actualAirFreight
    const willShow = bookable.includes(it.itemStatus) && !(it.request.logisticsSent && actual)
    console.log(JSON.stringify({
      doc: it.request.documentNo, bu: it.request.bu, so: it.so, sub: it.sub, brand: it.brand,
      itemStatus: it.itemStatus, actualAirFreight: actual, hawbNo: it.hawbNo, invoiceNo: it.invoiceNo,
      logisticsSent: it.request.logisticsSent,
      bookable: bookable.includes(it.itemStatus),
      SHOWS_IN_LG_BOOKING: willShow,
    }))
  }
} catch (e) { console.error("ERR:", e.message) } finally { await p.$disconnect() }
