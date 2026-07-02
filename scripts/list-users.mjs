import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const users = await prisma.user.findMany({
  where: { bu: { in: ["NYG","ALL"] } },
  orderBy: [{ role: "asc" }, { priority: "asc" }],
  select: { name: true, email: true, role: true, bu: true, priority: true, isActive: true, procurementType: true }
})
console.log(JSON.stringify(users, null, 2))
await prisma.$disconnect()
