// User backup + restore (committed to git). Run:  node seed-users.js
// upsert by email → safe to re-run. Default password = "password123" (change after login,
// or use "Email me a login link" on the login page). Add every real user here.
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient()

// [email, name, role, roles[], bu, claimDepartment?, priority?, procurementType?]
const users = [
  ["thanchanok.p@nanyangtextile.com", "Thanchanok P", "ADMIN", ["ADMIN"], "ALL"],
  // ADMIN-equivalent AND a claim approver: DVM Procurement (Purchasing branch), BU NYG.
  ["jariya.t@nanyangtextile.com", "Jariya T", "ADMIN", ["ADMIN", "DVM_PROCUREMENT"], "NYG", null, 1, "PURCHASING"],
  // ── add the rest here, e.g.:
  // ["apisit.n@nanyangtextile.com", "Apisit N", "MER_USER", ["MER_USER"], "NYG"],
  // ["saji.t@nanyangtextile.com",   "Saji T",   "VP_SCM",   ["VP_SCM"],   "NYG"],
]

async function main() {
  const password = await bcrypt.hash("password123", 10)
  for (const [email, name, role, roles, bu, claimDepartment = null, priority = null, procurementType = null] of users) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role, roles, bu, claimDepartment, priority, procurementType, isActive: true },
      create: { email, name, role, roles, bu, claimDepartment, priority, procurementType, isActive: true, password },
    })
  }
  console.log(`Seeded ${users.length} user(s). Default password: password123`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
