// Backfill EST for LG auto-add documents (SOs shipped but never in an air request).
// They were created with blank description/country → grossWeight/airFreight = 0. This fills:
//   description = master_style.style_type (matched by style_code)   → weight from MasterDescription
//   country     = mp_line.country (matched by SO)                    → rate from MasterFreightRate
// then recomputes gross = qty × weight and EST = gross × rate (same formula as recomputeRequestFreight).
//   node scripts/backfill-auto-est.mjs           → DRY RUN (prints what would change)
//   node scripts/backfill-auto-est.mjs --apply   → commit
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

const soN = (s) => String(s == null ? "" : s).replace(/\D/g, "").replace(/^0+/, "")
const nrm = (s) => String(s == null ? "" : s).trim().toUpperCase()
const descKey = (s) => String(s || "").trim().toUpperCase().replace(/\s*,\s*/g, ",").replace(/\s+/g, " ")
const COUNTRY_ALIAS = { USA: "USA", US: "USA", "UNITED STATES": "USA", "UNITED STATES OF AMERICA": "USA", AMERICA: "USA", UK: "UK", "UNITED KINGDOM": "UK", "GREAT BRITAIN": "UK", ENGLAND: "UK" }
const canonCountry = (c) => { const r = String(c || "").trim().toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim(); return COUNTRY_ALIAS[r] || r }

// 1) auto-add items
const items = await prisma.airRequestItem.findMany({
  where: { reasonDelay: { startsWith: "Auto-add" } },
  select: { id: true, so: true, sub: true, style: true, description: true, country: true, qtyRequestAir: true, qtyOriginalShipment: true, grossWeight: true, airFreight: true, request: { select: { documentNo: true, bu: true } } },
})
if (!items.length) { console.log("No auto-add items found."); await prisma.$disconnect(); process.exit(0) }
console.log(`Found ${items.length} auto-add item(s).`)

// 2) master_style: style_code → style_type
const codes = [...new Set(items.map(i => nrm(i.style)).filter(Boolean))]
const styleType = new Map()
if (codes.length) {
  const rows = await prisma.$queryRawUnsafe(`SELECT UPPER(TRIM(style_code)) AS code, style_type FROM public.master_style WHERE UPPER(TRIM(style_code)) = ANY($1::text[])`, codes)
  for (const r of rows) if (r.style_type) styleType.set(String(r.code), String(r.style_type))
}
// 3) mp_line: SO → country
const soKeys = [...new Set(items.map(i => soN(i.so)).filter(Boolean))]
const countryBySo = new Map()
if (soKeys.length) {
  const rows = await prisma.$queryRawUnsafe(`SELECT ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') AS so, country FROM public.mp_line WHERE country IS NOT NULL AND TRIM(country) <> '' AND ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') = ANY($1::text[])`, soKeys)
  for (const r of rows) if (r.so && !countryBySo.has(String(r.so))) countryBySo.set(String(r.so), String(r.country))
}
// 4) masters: weight (by description) + rate (by country)
const descList = await prisma.masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
const wts = {}; for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0
const rateList = await prisma.masterFreightRate.findMany({ where: { isActive: true } })
const rates = {}; for (const r of rateList) rates[canonCountry(r.country)] = r.ratePerKg

let filled = 0, stillZero = 0
const updates = []
for (const it of items) {
  const desc = it.description && it.description.trim() ? it.description : (styleType.get(nrm(it.style)) || "")
  const country = it.country && it.country.trim() ? it.country : (countryBySo.get(soN(it.so)) || "")
  const wt = wts[descKey(desc)] || 0
  const rate = rates[canonCountry(country)] || 0
  const qty = it.qtyRequestAir || it.qtyOriginalShipment || 0
  const gross = qty * wt
  const est = gross * rate
  const note = wt === 0 ? "⚠ no weight for style_type" : rate === 0 ? "⚠ no rate for country" : "ok"
  if (est > 0) filled++; else stillZero++
  updates.push({ id: it.id, doc: it.request.documentNo, so: it.so, style: it.style, desc, country, qty, gross: Math.round(gross * 100) / 100, est: Math.round(est * 100) / 100, note })
}

console.table(updates.map(u => ({ doc: u.doc, so: u.so, style: u.style, desc: u.desc.slice(0, 28), country: u.country, qty: u.qty, gross: u.gross, est: u.est, note: u.note })))
console.log(`\nWould fill EST on ${filled} item(s); ${stillZero} still 0 (missing weight/rate/country).`)

if (!APPLY) { console.log("\nDRY RUN — re-run with --apply to commit."); await prisma.$disconnect(); process.exit(0) }

let n = 0
for (const u of updates) {
  await prisma.airRequestItem.update({
    where: { id: u.id },
    data: { description: u.desc || null, country: u.country || null, grossWeight: u.gross, airFreight: u.est, marketRatePerKg: (u.est > 0 ? rates[canonCountry(u.country)] : null) },
  }).catch((e) => console.log(`  ! ${u.doc}/${u.so}: ${e.message}`))
  n++
}
console.log(`\n✓ Updated ${n} item(s).`)
await prisma.$disconnect()
