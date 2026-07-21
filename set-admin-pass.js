const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient()
async function main() {
  const password = await bcrypt.hash("1234", 10)
  const u = await prisma.user.update({
    where: { email: "thanchanok.p@nanyangtextile.com" },
    data: { password, isActive: true, role: "ADMIN", roles: ["ADMIN"], bu: "ALL" },
  })
  console.log("OK: thanchanok.p password=1234, role=ADMIN, active=", u.isActive)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
