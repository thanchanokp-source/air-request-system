// Reopen ONE claim doc for Logistics to re-enter the actual air freight.
// Keeps every approval (merch/SCM/claim) — only flips logisticsSent back to false and clears the
// LG-entered actual so the doc reappears in LG BOOKING for re-entry. itemStatus stays LOG_PASSED.
//   node scripts/reopen_lg.mjs AIR_NYG_2608_0028           → DRY RUN
//   node scripts/reopen_lg.mjs AIR_NYG_2608_0028 --apply   → commit
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const doc = process.argv[2]
const APPLY = process.argv.includes("--apply")
if (!doc) { console.log("usage: node scripts/reopen_lg.mjs <DOC_NO> [--apply]"); process.exit(1) }

const req = await prisma.airRequest.findFirst({ where: { documentNo: doc }, include: { items: true } })
if (!req) { console.log(`Doc ${doc} not found`); process.exit(0) }

console.log(`\nDOC ${req.documentNo} · status=${req.status} · logisticsSent=${req.logisticsSent}`)
for (const it of req.items) console.log(`  SO ${it.so}/${it.sub || ""} itemStatus=${it.itemStatus} actualAirFreight=${it.actualAirFreight} hawb=${it.hawbNo ?? "-"} inv=${it.invoiceNo ?? "-"}`)

const guard = ["PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_LOGISTICS"]
if (!guard.includes(req.status)) console.log(`\n⚠️ status=${req.status} ไม่ใช่ช่วง Logistics/Claim — ตรวจสอบก่อน apply`)

console.log(`\nPLAN → set logisticsSent=false + clear actualAirFreight on ${req.items.length} item(s) (itemStatus ไม่แตะ)`)
if (APPLY) {
  // lgReopened=true → the next LG "Send" is SILENT (won't re-alert claim/SCM NYK); the send clears it.
  await prisma.airRequest.update({ where: { id: req.id }, data: { logisticsSent: false, lgReopened: true } })
  for (const it of req.items) await prisma.airRequestItem.update({ where: { id: it.id }, data: { actualAirFreight: null } })
  await prisma.approvalLog.create({ data: { requestId: req.id, userId: req.createdById || undefined, action: "REOPEN_LG", fromStatus: req.status, toStatus: req.status, comment: "Admin reopened Logistics — re-enter actual air freight" } }).catch(() => {})
  console.log("\n✅ APPLIED — เอกสารกลับเข้าคิว LG BOOKING ให้กรอก actual ใหม่ (chip Logistics กลับเป็น pending)")
} else {
  console.log("\n🔎 DRY RUN — เพิ่ม --apply เพื่อบันทึกจริง")
}
await prisma.$disconnect()
