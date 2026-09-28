// Fix a HAWB whose actualAirFreight was corrupted by the comma bug (expense typed as "522,130.44"
// was parsed as 522 → actuals ~1000x too small). Re-distributes the CORRECT total across the HAWB's
// SOs by air qty (same as the app). Provide the real total from the invoice — the comma-eaten digits
// cannot be recovered from the DB.
//   node scripts/fix-hawb-total.mjs 37026252430 522130.44           → DRY RUN
//   node scripts/fix-hawb-total.mjs 37026252430 522130.44 --apply   → commit
//   (commas in the total are OK: "522,130.44" also works)
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const args = process.argv.slice(2).filter(a => a !== "--apply")
const APPLY = process.argv.includes("--apply")
const hawbDigits = String(args[0] || "").replace(/\D/g, "")
const total = parseFloat(String(args[1] || "").replace(/,/g, ""))
if (!hawbDigits || !(total > 0)) { console.log("usage: node scripts/fix-hawb-total.mjs <HAWB> <TOTAL> [--apply]"); await prisma.$disconnect(); process.exit(1) }

const all = await prisma.airRequestItem.findMany({
  where: { hawbNo: { not: null } },
  select: { id: true, so: true, sub: true, qtyRequestAir: true, actualAirFreight: true, hawbNo: true, request: { select: { documentNo: true } } },
})
const items = all.filter(i => String(i.hawbNo).replace(/\D/g, "") === hawbDigits)
if (!items.length) { console.log(`No items found for HAWB ${hawbDigits}`); await prisma.$disconnect(); process.exit(0) }

const totq = items.reduce((s, i) => s + (i.qtyRequestAir || 0), 0)
if (totq <= 0) { console.log("Total qty is 0 — cannot distribute."); await prisma.$disconnect(); process.exit(1) }
const perUnit = total / totq
const rows = items.map(i => ({ doc: i.request.documentNo, so: i.so, sub: i.sub, qty: i.qtyRequestAir || 0, old: i.actualAirFreight, neu: Math.round((i.qtyRequestAir || 0) * perUnit * 100) / 100, id: i.id }))
// Make the sum EXACTLY the HAWB total (no rounding drift): the last SO absorbs the remainder.
if (rows.length) {
  const rest = rows.slice(0, -1).reduce((s, r) => s + r.neu, 0)
  rows[rows.length - 1].neu = Math.round((total - rest) * 100) / 100
}

console.log(`\nHAWB ${hawbDigits} · ${items.length} SO · qty ${totq} · target total ${total.toLocaleString()} · per pc ${Math.round(perUnit * 100) / 100}`)
console.table(rows.map(r => ({ doc: r.doc, so: r.so, sub: r.sub, qty: r.qty, old_actual: r.old, new_actual: r.neu })))
console.log(`sum(new) = ${rows.reduce((s, r) => s + r.neu, 0).toLocaleString()}  (should ≈ ${total.toLocaleString()})`)

if (!APPLY) { console.log("\nDRY RUN — add --apply to commit."); await prisma.$disconnect(); process.exit(0) }
let n = 0
for (const r of rows) { await prisma.airRequestItem.update({ where: { id: r.id }, data: { actualAirFreight: r.neu } }).catch(e => console.log(`  ! ${r.so}: ${e.message}`)); n++ }
console.log(`\n✓ Updated ${n} item(s) for HAWB ${hawbDigits}.`)
await prisma.$disconnect()
