// Full DB snapshot → timestamped JSON.  Run:  node backup-db.js
// Captures EVERYTHING (users, master, documents, items, logs, claims, BillOfMaterial, ...).
// Keep the file safe; restore with:  node restore-db.js <file>.json
const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const prisma = new PrismaClient()

async function main() {
  const data = {
    _meta: { at: new Date().toISOString(), note: "air-request-system full snapshot" },
    user: await prisma.user.findMany(),
    masterBrand: await prisma.masterBrand.findMany(),
    masterBU: await prisma.masterBU.findMany(),
    masterDescription: await prisma.masterDescription.findMany(),
    masterGMTType: await prisma.masterGMTType.findMany(),
    masterPort: await prisma.masterPort.findMany(),
    masterFreightRate: await prisma.masterFreightRate.findMany(),
    billOfMaterial: await prisma.billOfMaterial.findMany(),
    airRequest: await prisma.airRequest.findMany(),
    hawbGroup: await prisma.hawbGroup.findMany(),
    airRequestItem: await prisma.airRequestItem.findMany(),
    approvalLog: await prisma.approvalLog.findMany(),
    requestAttachment: await prisma.requestAttachment.findMany(),
    claimForward: await prisma.claimForward.findMany(),
    claimApproval: await prisma.claimApproval.findMany(),
    approvalSignature: await prisma.approvalSignature.findMany(),
    pendingApprover: await prisma.pendingApprover.findMany(),
    appSetting: await prisma.appSetting.findMany(),
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dir = "backups"
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  const file = `${dir}/backup-${stamp}.json`
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
  const counts = Object.entries(data).filter(([k]) => k !== "_meta").map(([k, v]) => `${k}=${v.length}`).join(" ")
  console.log(`Backup written: ${file}\n${counts}`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
