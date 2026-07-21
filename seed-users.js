// User backup + restore (committed to git). Run:  node seed-users.js
// upsert by email → safe to re-run. Each user has its own password (default "password123").
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient()

const users = [
  { email: "thanchanok.p@nanyangtextile.com", name: "Thanchanok P", role: "ADMIN", roles: ["ADMIN"], bu: "ALL", pw: "1234" },
  // ADMIN-equivalent AND a claim approver: DVM Procurement (Purchasing branch), BU NYG.
  { email: "jariya.t@nanyangtextile.com", name: "Jariya T", role: "ADMIN", roles: ["ADMIN", "DVM_PROCUREMENT"], bu: "NYG", priority: 1, procurementType: "PURCHASING" },
  // Test MER
  { email: "atsadet.n@nanyangtextile.com", name: "Atsadet N", role: "MER_USER", roles: ["MER_USER"], bu: "NYG", pw: "123456" },
  { email: "apisit.n@nanyangtextile.com", name: "Apisit N", role: "MER_GW", roles: ["MER_GW"], bu: "GW", pw: "123456" },
]

async function main() {
  for (const u of users) {
    const password = await bcrypt.hash(u.pw || "password123", 10)
    const data = {
      name: u.name, role: u.role, roles: u.roles, bu: u.bu,
      claimDepartment: u.claimDepartment ?? null, priority: u.priority ?? null,
      procurementType: u.procurementType ?? null, isActive: true,
    }
    await prisma.user.upsert({
      where: { email: u.email },
      update: { ...data, password },
      create: { ...data, email: u.email, password },
    })
  }
  console.log(`Seeded ${users.length} user(s).`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
