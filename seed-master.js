// Master data backup + restore (committed to git = permanent backup).
// Run anytime to (re)load all master data:  node seed-master.js
// Uses upsert → safe to re-run; never duplicates. Add new master here whenever it changes.
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

// ── Freight rate by COUNTRY (THB per kg) ── 31 countries (deduped)
const rates = [
  ["MALAYSIA", 35], ["CANADA", 320], ["U.S.A.", 286], ["CHINA", 50],
  ["THE NETHERLANDS", 270], ["MAURITIUS", 295], ["SINGAPORE", 35], ["PAKISTAN", 105],
  ["IRELAND", 250], ["AUSTRALIA", 105], ["UNITED KINGDOM", 275], ["MEXICO", 320],
  ["HONG KONG", 45], ["KOREA", 50], ["JAPAN", 50], ["THAILAND", 5],
  ["FRANCE", 260], ["PANAMA", 290], ["GERMANY", 320], ["BELGIUM", 310],
  ["TAIWAN", 35], ["SOUTH KOREA", 65], ["SAUDI ARABIA", 295], ["U.A.E", 75],
  ["NEW ZEALAND", 280], ["SOUTH AFRICA", 95], ["INDONESIA", 40], ["ALGERIA", 295],
  ["TURKEY", 165], ["PHILIPPINES", 65], ["SWEDEN", 285],
]

// ── Description → WT charge per pc (kg) ── 9 items
const descriptions = [
  ["SHORTS", 0.25],
  ["JACKET,HOODIE,PULLOVER,SEATSHIRT", 0.45],
  ["TANK,T-SHIRT,SHIRT", 0.2],
  ["POLO SHIRT", 0.25],
  ["BOXER", 0.09],
  ["PANTS", 0.35],
  ["HEADBAND", 0.07],
  ["GLOVES", 0.06],
  ["SLEEVES", 0.05],
]

// ── Brands ── (add when provided)
const brands = []
// ── Ports ── (add when provided) [country, port, ratePerKg]
const ports = []
// ── GMT types ── (add when provided)
const gmtTypes = []

async function main() {
  for (const [country, ratePerKg] of rates) {
    await prisma.masterFreightRate.upsert({
      where: { country }, update: { ratePerKg, isActive: true }, create: { country, ratePerKg, isActive: true },
    })
  }
  for (const [name, weightPerUnit] of descriptions) {
    await prisma.masterDescription.upsert({
      where: { name }, update: { weightPerUnit, isActive: true }, create: { name, weightPerUnit, isActive: true },
    })
  }
  for (const name of brands) {
    await prisma.masterBrand.upsert({ where: { name }, update: { isActive: true }, create: { name, isActive: true } })
  }
  for (const [country, port, ratePerKg] of ports) {
    await prisma.masterPort.upsert({ where: { port }, update: { country, ratePerKg, isActive: true }, create: { country, port, ratePerKg, isActive: true } })
  }
  for (const name of gmtTypes) {
    await prisma.masterGMTType.upsert({ where: { name }, update: { isActive: true }, create: { name, isActive: true } })
  }
  console.log(`Master seeded: ${rates.length} rates, ${descriptions.length} descriptions, ${brands.length} brands, ${ports.length} ports, ${gmtTypes.length} gmtTypes`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
