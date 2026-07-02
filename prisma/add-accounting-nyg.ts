import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const u = await prisma.user.upsert({
    where: { email: "ploenta.p@nanyangtextile.com" },
    update: { name: "ploenta.p", role: "ACCOUNTING", bu: "NYG", isActive: true, priority: null, claimDepartment: null },
    create: { email: "ploenta.p@nanyangtextile.com", name: "ploenta.p", role: "ACCOUNTING", bu: "NYG", isActive: true },
  })
  console.log(`✓ ${u.email} → ${u.role} (${u.bu})`)
}
main().catch(console.error).finally(() => prisma.$disconnect())
