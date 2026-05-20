const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const h = await bcrypt.hash('password123', 10)
  const users = [
    { email: 'mer@nanyang.com', name: 'MER User', role: 'MER_USER', password: h },
    { email: 'vp.mer@nanyang.com', name: 'VP MER', role: 'VP_MER', password: h },
    { email: 'scm@nanyang.com', name: 'SCM User', role: 'SCM_USER', password: h },
    { email: 'vp.scm@nanyang.com', name: 'VP SCM', role: 'VP_SCM', password: h },
    { email: 'president@nanyang.com', name: 'President', role: 'PRESIDENT', password: h },
    { email: 'logistics@nanyang.com', name: 'Logistics', role: 'LOGISTICS', password: h },
    { email: 'claim@nanyang.com', name: 'Claim', role: 'CLAIM', password: h }
  ]
  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: u })
  }
  console.log('Users seeded OK')
}

main().catch(console.error).finally(() => prisma.$disconnect())
