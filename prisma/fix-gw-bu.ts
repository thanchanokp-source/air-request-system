// Fixes existing users whose role is a GW role but whose bu was saved as "NYG".
// Usage: npx tsx prisma/fix-gw-bu.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, bu: true } })
  const isGwRole = (r: string) => r.endsWith("_GW") || r.startsWith("SCM_NYK") || r.startsWith("SCM_NYG")
  const wrong = users.filter(u => isGwRole(u.role) && u.bu !== "GW")
  if (wrong.length === 0) { console.log("All GW-role users already have bu = GW."); return }

  for (const u of wrong) {
    await prisma.user.update({ where: { id: u.id }, data: { bu: "GW" } })
    console.log(`  fixed: ${u.email} (${u.role})  ${u.bu} -> GW`)
  }
  console.log(`Updated ${wrong.length} user(s) to bu = GW.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
