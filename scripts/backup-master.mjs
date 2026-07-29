// Back up ALL master data → timestamped JSON under scripts/backups/.
// Restore with:  node scripts/restore-master.mjs scripts/backups/master-backup-<stamp>.json
import { PrismaClient } from "@prisma/client"
import { mkdirSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const prisma = new PrismaClient()
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, "backups")
mkdirSync(outDir, { recursive: true })

const data = {
  _meta: { takenAt: new Date().toISOString(), source: "backup-master.mjs" },
  MasterBrand:       await prisma.masterBrand.findMany({ orderBy: { name: "asc" } }),
  MasterBU:          await prisma.masterBU.findMany({ orderBy: { name: "asc" } }),
  MasterDescription: await prisma.masterDescription.findMany({ orderBy: { name: "asc" } }),
  MasterDelayCode:   await prisma.masterDelayCode.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
  MasterFreightRate: await prisma.masterFreightRate.findMany({ orderBy: { country: "asc" } }),
  AppSetting:        await prisma.appSetting.findMany(),
}

const stamp = data._meta.takenAt.replace(/[:.]/g, "-")
const file = join(outDir, `master-backup-${stamp}.json`)
writeFileSync(file, JSON.stringify(data, null, 2), "utf8")

console.log("✓ Master backup saved:")
console.log("  " + file)
for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) console.log(`  ${k}: ${v.length} rows`)
await prisma.$disconnect()
