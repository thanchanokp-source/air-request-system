import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const U = (s) => String(s ?? "").trim().toUpperCase()
const EXCHANGE_RATE = 32
const destForBu = (bu) => (({ NYG: "BKK", GW: "BKK", EA: "VTE", TRM: "LAOS" })[U(bu)] || "BKK")
const TIERS = [0.5, 1, 2, 3, 5, 10, 15, 20, 25, 30]
const courierUsd = (rows, port, dest, w, carrier) => {
  if (!w || w > 30) return null
  const t = TIERS.find(x => x >= w); if (t == null) return null
  const P = U(port), D = U(dest), C = carrier.toUpperCase()
  const r = rows.find(x => U(x.origin) === P && U(x.destination || "BKK") === D && String(x.carrier || "").toUpperCase().includes(C))
  if (!r) return null
  const thb = Number((r.rates || {})[String(t)]); if (!thb || isNaN(thb)) return null
  return Math.round(thb / EXCHANGE_RATE * 100) / 100
}

// Usage: node scripts/check_doc_freight.mjs PULL_NYG_2609_0001   (or omit for latest doc)
const docNo = process.argv[2] || ""
try {
  const req = docNo
    ? await p.pullMaterialRequest.findFirst({ where: { documentNo: docNo }, include: { items: true } })
    : await p.pullMaterialRequest.findFirst({ orderBy: { createdAt: "desc" }, include: { items: true } })
  if (!req) { console.log("ไม่พบเอกสาร", docNo); process.exit(0) }

  const d0 = req.items.find(i => i.airFreightCost != null) || req.items[0] || {}
  const port = d0.port, weight = Number(d0.weight) || 0, dest = destForBu(req.bu)
  console.log(`\nเอกสาร ${req.documentNo} · BU ${req.bu}`)
  console.log(`  port(air) = "${port}"  · seaPort = "${d0.seaPort}"  · country = "${d0.country}"`)
  console.log(`  weight = ${weight} kg  · dest(by BU) = ${dest}`)
  console.log(`  airFreightCost = ${d0.airFreightCost}  · originCost = ${d0.originCost}`)

  const air = await p.pullFreightAir.findMany({ where: { origin: port || "__none__" } })
  console.log(`\nAIR master origin="${port}": ${air.length} rows`)
  air.slice(0, 5).forEach(a => console.log(`   dest=${a.destination} · rates=${JSON.stringify(a.rates)}`))

  const cour = await p.pullFreightCourier.findMany({ where: { origin: port || "__none__" } })
  console.log(`\nCOURIER master origin="${port}": ${cour.length} rows`)
  cour.forEach(c => console.log(`   carrier=${c.carrier} · dest=${c.destination}`))

  const rows = await p.pullFreightCourier.findMany()
  console.log(`\nคำนวณ courier (weight=${weight}, dest=${dest}):  DHL=${courierUsd(rows, port, dest, weight, "DHL")}  FEDEX=${courierUsd(rows, port, dest, weight, "FEDEX")}`)
  if (!port) console.log(`   ⚠️ เอกสารไม่มี air port → air/courier match ไม่ได้ (จัดซื้อต้องเลือก Air Port)`)
  else if (weight > 30) console.log(`   ⚠️ weight ${weight} > 30kg → courier = null`)
  else if (weight === 0) console.log(`   ⚠️ weight = 0 → courier ต้องมีน้ำหนัก`)
} catch (e) { console.error("ERR:", e.message) } finally { await p.$disconnect() }
