// Restore a snapshot made by backup-db.js.  Run:  node restore-db.js backups/backup-XXXX.json
// Inserts in FK-safe order, preserving ids. skipDuplicates → safe to run on a partially-filled DB.
const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const prisma = new PrismaClient()

const file = process.argv[2]
if (!file) { console.error("Usage: node restore-db.js <backup.json>"); process.exit(1) }

// FK-safe order: parents before children.
const ORDER = [
  "user", "masterBrand", "masterBU", "masterDescription",
  "masterFreightRate", "billOfMaterial", "appSetting", "pendingApprover",
  "airRequest", "hawbGroup", "airRequestItem", "approvalLog", "requestAttachment",
  "claimForward", "claimApproval", "approvalSignature",
]
const MODEL = {
  user: "user", masterBrand: "masterBrand", masterBU: "masterBU", masterDescription: "masterDescription",
  masterFreightRate: "masterFreightRate",
  billOfMaterial: "billOfMaterial", appSetting: "appSetting", pendingApprover: "pendingApprover",
  airRequest: "airRequest", hawbGroup: "hawbGroup", airRequestItem: "airRequestItem",
  approvalLog: "approvalLog", requestAttachment: "requestAttachment", claimForward: "claimForward",
  claimApproval: "claimApproval", approvalSignature: "approvalSignature",
}

async function main() {
  const data = JSON.parse(fs.readFileSync(file, "utf8"))
  for (const key of ORDER) {
    const rows = data[key]
    if (!Array.isArray(rows) || rows.length === 0) continue
    const res = await prisma[MODEL[key]].createMany({ data: rows, skipDuplicates: true })
    console.log(`${key}: +${res.count}/${rows.length}`)
  }
  console.log("Restore done.")
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
