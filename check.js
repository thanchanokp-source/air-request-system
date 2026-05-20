const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const p = new PrismaClient()

async function main() {
  const h = await bcrypt.hash('password123', 10)
  await p.user.updateMany({ data: { password: h } })
  console.log('All passwords reset to password123')
}

main().catch(console.error).finally(() => p.$disconnect())
