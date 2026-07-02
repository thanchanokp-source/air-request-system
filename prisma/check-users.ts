import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, bu: true, priority: true, claimDepartment: true, procurementType: true },
    orderBy: [{ bu: "asc" }, { role: "asc" }]
  })
  console.log(`\nTotal: ${users.length} users\n`)
  users.forEach(u => {
    const parts = [
      (u.bu || "").padEnd(4),
      (u.role || "").padEnd(28),
      u.priority != null ? `P${u.priority}` : "  ",
      u.claimDepartment ? `[${u.claimDepartment}]`.padEnd(8) : "        ",
      u.procurementType ? `(${u.procurementType})` : "",
      "→", u.email
    ]
    console.log(parts.join(" "))
  })
}
main().catch(console.error).finally(() => prisma.$disconnect())
