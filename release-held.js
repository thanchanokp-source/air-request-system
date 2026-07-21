// Recompute + release documents HELD for missing master data (mirrors releaseHeldDocs
// in src/lib/freight.ts). Run after adding master data via a script (the UI does this
// automatically). Gross = QTY ORIGINAL × WT Charge; Est = Gross × rate.
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const COUNTRY_ALIAS = {
  "USA":"USA","US":"USA","UNITED STATES":"USA","UNITED STATES OF AMERICA":"USA","AMERICA":"USA",
  "UK":"UK","UNITED KINGDOM":"UK","GREAT BRITAIN":"UK","ENGLAND":"UK",
}
const canonCountry = c => { const raw = String(c||"").trim().toUpperCase().replace(/\./g,"").replace(/\s+/g," ").trim(); return COUNTRY_ALIAS[raw] || raw }
const descKey = s => String(s||"").trim().toUpperCase().replace(/\s*,\s*/g,",").replace(/\s+/g," ")

async function main() {
  const held = await prisma.airRequest.findMany({ where: { OR: [{ pendingRate: true }, { pendingWeight: true }] }, include: { items: true } })
  console.log(`Held docs: ${held.length}`)
  const rateList = await prisma.masterFreightRate.findMany({ where: { isActive: true } })
  const rates = {}; for (const r of rateList) rates[canonCountry(r.country)] = r.ratePerKg
  const descList = await prisma.masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
  const wts = {}; for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0

  for (const doc of held) {
    const items = doc.items
    const rateOk = items.filter(i => i.country).every(i => (rates[canonCountry(i.country)] || 0) > 0)
    const wtOk = items.filter(i => i.description).every(i => (wts[descKey(i.description)] || 0) > 0)
    for (const it of items) {
      const wt = wts[descKey(it.description)] || 0
      const rate = rates[canonCountry(it.country)] || 0
      const gross = (it.qtyOriginalShipment || 0) * wt
      await prisma.airRequestItem.update({ where: { id: it.id }, data: { grossWeight: gross, airFreight: gross * rate, marketRatePerKg: rate > 0 ? rate : null } }).catch(() => {})
    }
    await prisma.airRequest.update({ where: { id: doc.id }, data: { pendingRate: !rateOk, pendingWeight: !wtOk } })
    console.log(`  ${doc.documentNo}: rateOk=${rateOk} wtOk=${wtOk} → released=${rateOk && wtOk}`)
  }
  console.log("Done. (Approver notification not sent — release via the Master UI to auto-notify.)")
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
