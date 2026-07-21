const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
prisma.user.findMany({
  select: { email: true, name: true, role: true, roles: true, bu: true, claimDepartment: true, priority: true, procurementType: true, isActive: true },
  orderBy: { email: "asc" },
}).then(us => {
  console.log(`TOTAL USERS: ${us.length}`)
  for (const u of us) console.log(`${u.email} | ${u.name || "-"} | ${u.role} | roles=${JSON.stringify(u.roles)} | bu=${u.bu} | dept=${u.claimDepartment || "-"} | prio=${u.priority ?? "-"} | procT=${u.procurementType || "-"} | active=${u.isActive}`)
}).catch(console.error).finally(() => prisma.$disconnect())
