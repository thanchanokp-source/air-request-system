import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const [requests, users, items] = await Promise.all([
    prisma.airRequest.count(),
    prisma.user.count(),
    prisma.airRequestItem.count(),
  ])

  console.log("\n=== Database Status ===")
  console.log(`Users:           ${users}`)
  console.log(`AirRequests:     ${requests}`)
  console.log(`AirRequestItems: ${items}`)

  if (requests > 0) {
    const recent = await prisma.airRequest.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { documentNo: true, status: true, createdAt: true, bu: true }
    })
    console.log("\nล่าสุด 5 รายการ:")
    recent.forEach(r => console.log(`  ${r.documentNo}  [${r.bu}]  ${r.status}  ${r.createdAt.toLocaleDateString("th")}`))
  } else {
    console.log("\n⚠️  ไม่มี AirRequest ในระบบ")
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
