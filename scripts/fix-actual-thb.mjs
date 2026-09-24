// Fix Pull RM documents whose ACTUAL was typed in THB but stored as if it were USD.
// (Before the THB/USD switch existed, LG typed e.g. 7769 THB into a field the system reads as USD,
//  so the variance against Est went wildly red.)
//
//   node scripts/fix-actual-thb.mjs                      # DRY RUN — list suspects only
//   node scripts/fix-actual-thb.mjs --apply              # convert suspects: value / 32.5, mark THB
//   node scripts/fix-actual-thb.mjs --doc PULL_NYG_2609_0004 --apply   # one document
//   node scripts/fix-actual-thb.mjs --ratio 3 --apply    # loosen/tighten the detection threshold
//
// Detection: a doc is a suspect when actualAir is at least RATIO times its Est air (default 5x).
// A genuine overrun is rarely 5x; a THB-as-USD mistake is ~32x. Docs already marked actualCurrency
// are skipped (they went through the new UI and are already correct).
import { PrismaClient } from "@prisma/client"

const RATE = 32.5
const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const DOC = (() => { const i = args.indexOf("--doc"); return i >= 0 ? args[i + 1] : null })()
const RATIO = (() => { const i = args.indexOf("--ratio"); return i >= 0 ? Number(args[i + 1]) || 5 : 5 })()

const prisma = new PrismaClient()
const r2 = (n) => Math.round(n * 100) / 100

const docs = await prisma.pullMaterialRequest.findMany({
  where: { actualAir: { not: null }, ...(DOC ? { documentNo: DOC } : {}) },
  select: { id: true, documentNo: true, bu: true, actualAir: true, localChargeTh: true, actualCurrency: true, status: true, items: { select: { airFreightCost: true } } },
  orderBy: { documentNo: "asc" },
})

const suspects = []
for (const d of docs) {
  if (d.actualCurrency) continue                       // already recorded through the new UI
  const est = (d.items || []).reduce((s, i) => s + (Number(i.airFreightCost) || 0), 0)
  const act = Number(d.actualAir) || 0
  // With no Est to compare against, fall back to "far too large to be USD for one shipment".
  const suspect = est > 0 ? act >= est * RATIO : act >= 3000
  if (suspect) suspects.push({ ...d, est, act })
}

console.log(`docs with an actual: ${docs.length} · suspects (THB typed as USD): ${suspects.length}${DOC ? ` · filter ${DOC}` : ""}`)
console.log("-".repeat(96))
for (const s of suspects) {
  console.log(
    `${s.documentNo.padEnd(22)} ${String(s.bu).padEnd(4)} est ${String(r2(s.est)).padStart(10)} USD  actual ${String(r2(s.act)).padStart(10)} ` +
    `->  ${String(r2(s.act / RATE)).padStart(9)} USD` + (s.localChargeTh != null ? `   local ${r2(s.localChargeTh)} -> ${r2(s.localChargeTh / RATE)}` : "")
  )
}
if (!suspects.length) { console.log("nothing to fix"); await prisma.$disconnect(); process.exit(0) }

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to convert the rows above.")
  await prisma.$disconnect(); process.exit(0)
}

let n = 0
for (const s of suspects) {
  await prisma.pullMaterialRequest.update({
    where: { id: s.id },
    data: {
      actualAir: r2(s.act / RATE),
      ...(s.localChargeTh != null ? { localChargeTh: r2(Number(s.localChargeTh) / RATE) } : {}),
      actualCurrency: "THB",   // what LG had actually typed
    },
  })
  n++
}
console.log(`\nconverted ${n} document(s) at rate ${RATE}. Values are now USD; actualCurrency = THB.`)
await prisma.$disconnect()
