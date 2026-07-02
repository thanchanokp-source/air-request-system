// Deletes ALL Air Request documents and their related data.
// KEEPS: users, master data (brand/BU/description/GMT/port).
// Usage: npx tsx prisma/clear-requests.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Delete children first to satisfy foreign keys.
  const ca = await prisma.claimApproval.deleteMany({})
  const al = await prisma.approvalLog.deleteMany({})
  const at = await prisma.requestAttachment.deleteMany({})
  const it = await prisma.airRequestItem.deleteMany({})
  const hg = await prisma.hawbGroup.deleteMany({})
  const rq = await prisma.airRequest.deleteMany({})

  console.log("Cleared Air Request data:")
  console.log(`  ClaimApproval:     ${ca.count}`)
  console.log(`  ApprovalLog:       ${al.count}`)
  console.log(`  RequestAttachment: ${at.count}`)
  console.log(`  AirRequestItem:    ${it.count}`)
  console.log(`  HawbGroup:         ${hg.count}`)
  console.log(`  AirRequest:        ${rq.count}`)
  console.log("Users & master data untouched.")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
