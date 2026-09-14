// Diagnose a claim doc's approve-button / reminder routing.
// Usage (on the SERVER, where prod DB env is set):
//   node scripts/diag_claim.mjs AIR_NYG_2608_0015 jariya amphron sahaphat rushan
// Read-only. Prints doc status, per-item splits, ClaimForward rows, and matching user records.
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const doc = process.argv[2]
const names = process.argv.slice(3)
if (!doc) { console.log("usage: node scripts/diag_claim.mjs <DOC_NO> [name...]"); process.exit(1) }

const j = (v) => JSON.stringify(v)

const req = await prisma.airRequest.findFirst({
  where: { documentNo: doc },
  include: { items: true, claimForwards: true },
}).catch(e => { console.log("query error:", String(e).slice(0, 200)); return null })

if (!req) { console.log(`Doc ${doc} not found`); process.exit(0) }

console.log(`\n=== DOC ${req.documentNo} · bu=${req.bu} · status=${req.status} · logisticsSent=${req.logisticsSent} ===`)
console.log(`assignedDvmMer=${req.assignedDvmMer || "-"} assignedVpMer=${req.assignedVpMer || "-"} assignedVpScm=${req.assignedVpScm || "-"}`)

console.log(`\n--- ITEMS (${req.items.length}) ---`)
for (const it of req.items) {
  const splits = Array.isArray(it.claimDepts) ? it.claimDepts : []
  console.log(`SO ${it.so || "-"}/${it.sub || ""} itemStatus=${it.itemStatus} factory=${it.factory || "-"}`)
  for (const s of splits) console.log(`    dept=${s.dept} pct=${s.pct} status=${s.status || "-"} crNo=${s.crNo || "-"}`)
  if (!splits.length) console.log("    (no splits)")
}

console.log(`\n--- CLAIM FORWARDS (${req.claimForwards.length}) ---`)
for (const f of req.claimForwards) {
  console.log(`dept=${f.dept} position=${f.position} branch=${f.branch || "-"} nextEmail=${f.nextEmail || "-"} nextName=${f.nextName || "-"} itemIds=${Array.isArray(f.itemIds) ? f.itemIds.length : f.itemIds} createdAt=${f.createdAt?.toISOString?.().slice(0,10)}`)
}

if (names.length) {
  console.log(`\n--- USERS matching [${names.join(", ")}] ---`)
  for (const n of names) {
    const us = await prisma.user.findMany({
      where: { OR: [{ email: { contains: n, mode: "insensitive" } }, { name: { contains: n, mode: "insensitive" } }] },
      select: { email: true, name: true, role: true, roles: true, bu: true, priority: true, procurementType: true, claimDepartment: true, isActive: true },
    }).catch(() => [])
    if (!us.length) { console.log(`  "${n}": (no user found)`); continue }
    for (const u of us) console.log(`  ${u.name} <${u.email}> active=${u.isActive} role=${u.role} roles=${j(u.roles)} bu=${u.bu} priority=${u.priority} procurementType=${u.procurementType || "-"} claimDepartment=${u.claimDepartment || "-"}`)
  }
}

await prisma.$disconnect()
