const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function fix() {
  const requests = await p.airRequest.findMany({ include: { items: true } })
  let fixed = 0
  for (const req of requests) {
    if (req.status === 'REJECTED') continue
    const active = req.items.filter(i => i.itemStatus !== 'REJECTED')
    if (req.items.length > 0 && active.length === 0) {
      await p.airRequest.update({ where: { id: req.id }, data: { status: 'REJECTED' } })
      console.log('Fixed:', req.documentNo, req.status, '-> REJECTED')
      fixed++
    }
  }
  console.log('Total fixed:', fixed)
  await p.$disconnect()
}
fix().catch(console.error)
