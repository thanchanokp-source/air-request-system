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

// 2) ReportDB.SO_ORDER_NYG_2020_present (so_no_doc→8 digits + sub_no, unique):
//    producttype → description (→ weight) · shipcountry → country (→ rate)
const so8k = (s) => { const d = String(s == null ? "" : s).replace(/\D/g, ""); return d ? d.padStart(8, "0") : "" }
const infoByKey = new Map(), infoBySo = new Map()
const so8keys = [...new Set(items.map(i => so8k(i.so)).filter(Boolean))]
if (so8keys.length) {
  const rows = await prisma.$queryRawUnsafe(`SELECT lpad(regexp_replace(COALESCE(so_no_doc,''),'\\D','','g'),8,'0') AS so8, UPPER(TRIM(COALESCE(sub_no,''))) AS sub, producttype, shipcountry FROM "ReportDB"."SO_ORDER_NYG_2020_present" WHERE lpad(regexp_replace(COALESCE(so_no_doc,''),'\\D','','g'),8,'0') = ANY($1::text[])`, so8keys)
  for (const r of rows) { const info = { producttype: String(r.producttype || ""), country: String(r.shipcountry || "") }; const kk = `${r.so8}|${r.sub || ""}`; if (!infoByKey.has(kk)) infoByKey.set(kk, info); if (!infoBySo.has(String(r.so8))) infoBySo.set(String(r.so8), info) }
}
const infoOf = (it) => infoByKey.get(`${so8k(it.so)}|${nrm(it.sub)}`) || infoBySo.get(so8k(it.so)) || { producttype: "", country: "" }

// 2b) mp_line ACTUAL shipped weight → weight per pc (gross source; avoids master word-matching).
//     weight/pc = final_gw ÷ final_pcs (fall back to plan_gw ÷ plan_pcs), grouped by SO+SUB.
const mpKeys = [...new Set(items.map(i => soN(i.so)).filter(Boolean))]
const wtByKey = new Map(), wtBySo = new Map()
if (mpKeys.length) {
  const rows = await prisma.$queryRawUnsafe(`SELECT ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') AS so, UPPER(TRIM(COALESCE(sub_no,''))) AS sub, sum(COALESCE(final_gw,0)) gw, sum(COALESCE(final_pcs,0)) pcs, sum(COALESCE(plan_gw,0)) pgw, sum(COALESCE(plan_pcs,0)) ppcs FROM public.mp_line WHERE ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') = ANY($1::text[]) GROUP BY 1,2`, mpKeys)
  for (const r of rows) {
    const gw = Number(r.gw) || 0, pcs = Number(r.pcs) || 0, pgw = Number(r.pgw) || 0, ppcs = Number(r.ppcs) || 0
    const perPc = (pcs > 0 && gw > 0) ? gw / pcs : (ppcs > 0 && pgw > 0) ? pgw / ppcs : 0
    if (perPc > 0) { const k = `${r.so}|${r.sub}`; if (!wtByKey.has(k)) wtByKey.set(k, perPc); if (!wtBySo.has(String(r.so))) wtBySo.set(String(r.so), perPc) }
  }
}
const wtPerPcOf = (it) => wtByKey.get(`${soN(it.so)}|${nrm(it.sub)}`) || wtBySo.get(soN(it.so)) || 0
// 2c) dates: ORIG = original_hod_date · PLAN = hod_date (by SO+SUB)
const dateByKey = new Map()
if (mpKeys.length) {
  const rows = await prisma.$queryRawUnsafe(`SELECT ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') AS so, UPPER(TRIM(COALESCE(sub_no,''))) AS sub, max(original_hod_date) orig, max(hod_date) plan FROM public.mp_line WHERE ltrim(regexp_replace(COALESCE(so_no,''),'\\D','','g'),'0') = ANY($1::text[]) GROUP BY 1,2`, mpKeys)
  for (const r of rows) { const k = `${r.so}|${r.sub}`; if (!dateByKey.has(k)) dateByKey.set(k, { orig: r.orig ? new Date(r.orig) : null, plan: r.plan ? new Date(r.plan) : null }) }
}
const datesOf = (it) => dateByKey.get(`${soN(it.so)}|${nrm(it.sub)}`) || { orig: null, plan: null }
// 4) masters: weight (by description) + rate (by country)
const descList = await prisma.masterDescription.findMany({ where: { isActive: true }, select: { name: true, weightPerUnit: true } })
const wts = {}; for (const d of descList) wts[descKey(d.name)] = d.weightPerUnit || 0
const rateList = await prisma.masterFreightRate.findMany({ where: { isActive: true } })
const rates = {}; for (const r of rateList) rates[canonCountry(r.country)] = r.ratePerKg

let filled = 0, stillZero = 0
const updates = []
for (const it of items) {
  const info = infoOf(it)
  const desc = it.description && it.description.trim() ? it.description : (info.producttype || "")
  const country = it.country && it.country.trim() ? it.country : (info.country || "")
  const wt = wtPerPcOf(it) || wts[descKey(desc)] || 0   // prefer mp_line actual weight/pc; fall back to master
  const rate = rates[canonCountry(country)] || 0
  const qty = it.qtyRequestAir || it.qtyOriginalShipment || 0
  const gross = Math.round(qty * wt * 1000) / 1000
  const est = gross * rate
  const note = wt === 0 ? "⚠ no weight (mp_line + master)" : rate === 0 ? "⚠ no rate for country" : "ok"
  if (est > 0) filled++; else stillZero++
  const dt = datesOf(it)
  updates.push({ id: it.id, doc: it.request.documentNo, so: it.so, style: it.style, desc, country, qty, gross: Math.round(gross * 100) / 100, est: Math.round(est * 100) / 100, note, orig: dt.orig, plan: dt.plan })
}

console.table(updates.map(u => ({ doc: u.doc, so: u.so, style: u.style, desc: u.desc.slice(0, 28), country: u.country, qty: u.qty, gross: u.gross, est: u.est, note: u.note })))
console.log(`\nWould fill EST on ${filled} item(s); ${stillZero} still 0 (missing weight/rate/country).`)

if (!APPLY) { console.log("\nDRY RUN — re-run with --apply to commit."); await prisma.$disconnect(); process.exit(0) }

let n = 0
for (const u of updates) {
  await prisma.airRequestItem.update({
    where: { id: u.id },
    data: { description: u.desc || null, country: u.country || null, grossWeight: u.gross, airFreight: u.est, marketRatePerKg: (u.est > 0 ? rates[canonCountry(u.country)] : null), ...(u.orig ? { originalShipmentDate: u.orig } : {}), ...(u.plan ? { planShipmentDate: u.plan } : {}) },
  }).catch((e) => console.log(`  ! ${u.doc}/${u.so}: ${e.message}`))
  n++
}
console.log(`\n✓ Updated ${n} item(s).`)
await prisma.$disconnect()
