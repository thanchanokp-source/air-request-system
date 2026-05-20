const { PrismaClient } = require('./node_modules/@prisma/client')
const p = new PrismaClient()
async function main() {
  const result = await p.airRequest.updateMany({
    where: { status: "REJECTED" },
    data: { status: "PENDING_SCM" }
  })
  console.log('Updated', result.count, 'request(s) → PENDING_SCM')
  await p.$disconnect()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
