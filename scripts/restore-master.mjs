// Restore master data from a backup JSON made by backup-master.mjs.
// Usage:  node scripts/restore-master.mjs scripts/backups/master-backup-<stamp>.json
// UPSERTS by each table's unique key — existing rows are updated, missing rows re-created.
// Does NOT delete rows that exist in DB but not in the backup (safe, additive).
import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"

const prisma = new PrismaClient()
const file = process.argv[2]
if (!file) { console.error("Usage: node scripts/restore-master.mjs <backup.json>"); process.exit(1) }
const data = JSON.parse(readFileSync(file, "utf8"))
console.log("Restoring from:", file, "(taken", data?._meta?.takenAt + ")")

const strip = ({ id, ...rest }) => rest // let DB keep/generate ids; match on unique key

for (const r of data.MasterBrand || [])
  await prisma.masterBrand.upsert({ where: { name: r.name }, update: strip(r), create: strip(r) })
for (const r of data.MasterBU || [])
  await prisma.masterBU.upsert({ where: { name: r.name }, update: strip(r), create: strip(r) })
for (const r of data.MasterDescription || [])
  await prisma.masterDescription.upsert({ where: { name: r.name }, update: strip(r), create: strip(r) })
for (const r of data.MasterDelayCode || [])
  await prisma.masterDelayCode.upsert({ where: { code: r.code }, update: strip(r), create: strip(r) })
for (const r of data.MasterFreightRate || [])
  await prisma.masterFreightRate.upsert({ where: { country: r.country }, update: strip(r), create: strip(r) })
for (const r of data.AppSetting || [])
  await prisma.appSetting.upsert({ where: { key: r.key }, update: strip(r), create: strip(r) }).catch(() => {})

console.log("✓ Restore complete")
await prisma.$disconnect()
