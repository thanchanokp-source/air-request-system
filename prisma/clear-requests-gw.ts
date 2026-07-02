// Deletes ONLY GW Air Request documents (keeps NYG + users + master data).
// Usage: npx tsx prisma/clear-requests-gw.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const gw = await prisma.airRequest.findMany({ where: { bu: "GW" }, select: { id: true } })
  const ids = gw.map(r => r.id)
  if (ids.length === 0) { console.log("No GW requests to delete."); return }

  const ca = await prisma.claimApproval.deleteMany({ where: { item: { requestId: { in: ids } } } })
  const al = await prisma.approvalLog.deleteMany({ where: { requestId: { in: ids } } })
  const at = await prisma.requestAttachment.deleteMany({ where: { requestId: { in: ids } } })
  const it = await prisma.airRequestItem.deleteMany({ where: { requestId: { in: ids } } })
  const hg = await prisma.hawbGroup.deleteMany({ where: { requestId: { in: ids } } })
  const rq = await prisma.airRequest.deleteMany({ where: { bu: "GW" } })

  console.log(`Cleared GW only (${ids.length} document(s)):`)
  console.log(`  ClaimApproval: ${ca.count}  ApprovalLog: ${al.count}  Attachment: ${at.count}`)
  console.log(`  Item: ${it.count}  HawbGroup: ${hg.count}  AirRequest: ${rq.count}`)
  console.log("NYG documents, users & master data untouched.")
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
