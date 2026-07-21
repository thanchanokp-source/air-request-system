// One-off: clear passwords for master-only approver accounts (login via magic link / admin View as).
// Keep passwords only for admins + test MER.
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
const keep = [
  "thanchanok.p@nanyangtextile.com",
  "jariya.t@nanyangtextile.com",
  "atsadet.n@nanyangtextile.com",
  "apisit.n@nanyangtextile.com",
]
prisma.user.updateMany({ where: { email: { notIn: keep } }, data: { password: null } })
  .then(r => console.log(`Cleared password on ${r.count} master account(s).`))
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
