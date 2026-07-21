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

// ── Description → WT charge per pc (kg) ──
const descriptions = [
  ["BOXER", 0.12],
  ["GLOVES", 0.03],
  ["HEADBAND", 0.03],
  ["JACKET,Hoodie", 0.41],
  ["JACKET,PULLOVER,SWEATSHIRT", 0.99],
  ["JACKET,SWEATSHIRT,PULLOVER", 0.60],
  ["KNITTED POLO SHIRT", 0.30],
  ["KNITTED SHIRT", 0.25],
  ["PANTS", 0.76],
  ["POLO SHIRT", 0.37],
  ["PULLOVER", 0.35],
  ["PULLOVER,SWEATSHIRT", 0.56],
  ["SHIRT", 0.38],
  ["SHORTS", 0.39],
  ["SLEEVES", 0.07],
  ["TANK,T-shirt", 0.21],
  ["T-SHIRT", 0.26],
]

// ── Brands ── (add when provided)
const brands = []

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
  // Make this list authoritative: drop any old description not in it (no FK — items store a string).
  await prisma.masterDescription.deleteMany({ where: { name: { notIn: descriptions.map(d => d[0]) } } })
  for (const name of brands) {
    await prisma.masterBrand.upsert({ where: { name }, update: { isActive: true }, create: { name, isActive: true } })
  }
  console.log(`Master seeded: ${rates.length} rates, ${descriptions.length} descriptions, ${brands.length} brands`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
