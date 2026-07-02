import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash("1234", 10)
  const result = await prisma.user.updateMany({
    where: { role: { not: undefined } },
    data: { password: hash },
  })
  console.log(`✓ ตั้ง password "1234" ให้ ${result.count} users เรียบร้อย`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
