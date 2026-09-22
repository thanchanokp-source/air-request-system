// Restore actualAirFreight for ONE SO/SUB in a doc (used after a whole-doc reopen_lg when you
// only wanted to reopen SOME SOs — put the correct value back on the SOs you keep).
// logisticsSent stays as-is; hawb/inv are untouched.
//   node scripts/restore_so_actual.mjs AIR_NYG_2608_0026 01260732 B 25098            → DRY RUN
//   node scripts/restore_so_actual.mjs AIR_NYG_2608_0026 01260732 B 25098 --apply    → commit
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const [doc, so, sub, valRaw] = process.argv.slice(2)
const APPLY = process.argv.includes("--apply")
if (!doc || !so || sub == null || valRaw == null) {
  console.log("usage: node scripts/restore_so_actual.mjs <DOC_NO> <SO> <SUB> <ACTUAL> [--apply]"); process.exit(1)
}
const val = Number(valRaw)
if (!Number.isFinite(val)) { console.log(`ACTUAL '${valRaw}' ไม่ใช่ตัวเลข`); process.exit(1) }

const req = await prisma.airRequest.findFirst({ where: { documentNo: doc }, include: { items: true } })
if (!req) { console.log(`Doc ${doc} not found`); process.exit(0) }

const norm = (s) => String(s ?? "").trim().toUpperCase()
const matches = req.items.filter(it => norm(it.so) === norm(so) && norm(it.sub) === norm(sub))
console.log(`\nDOC ${req.documentNo} · logisticsSent=${req.logisticsSent}`)
if (!matches.length) {
  console.log(`\n❌ ไม่พบ SO ${so}/${sub} ในเอกสารนี้ — SO/SUB ที่มี:`)
  for (const it of req.items) console.log(`   ${it.so}/${it.sub || ""} (actual=${it.actualAirFreight ?? "null"})`)
  process.exit(0)
}
for (const it of matches) console.log(`  MATCH SO ${it.so}/${it.sub || ""} · actual ${it.actualAirFreight ?? "null"} → ${val} · hawb=${it.hawbNo ?? "-"} inv=${it.invoiceNo ?? "-"}`)

if (APPLY) {
  for (const it of matches) await prisma.airRequestItem.update({ where: { id: it.id }, data: { actualAirFreight: val } })
  await prisma.approvalLog.create({ data: { requestId: req.id, userId: req.createdById || undefined, action: "RESTORE_ACTUAL", fromStatus: req.status, toStatus: req.status, comment: `Admin restored actualAirFreight=${val} on SO ${so}/${sub}` } }).catch(() => {})
  console.log(`\n✅ APPLIED — คืน actual=${val} ให้ SO ${so}/${sub} (${matches.length} item)`)
} else {
  console.log(`\n🔎 DRY RUN — เพิ่ม --apply เพื่อบันทึกจริง`)
}
await prisma.$disconnect()
