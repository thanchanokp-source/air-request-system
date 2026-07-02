import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

// เก็บเฉพาะ email เหล่านี้ (ที่กำหนดไว้ใน table + admin)
const KEEP_EMAILS = new Set([
  // Admin
  "thanchanok.p@nanyangtextile.com",
  // GW
  "tanarat.s@nanyangtextile.com",
  "jiraporn.c@nanyangtextile.com",
  "rattanakorn.p@nanyangtextile.com",
  "urairat.d@nanyangtextile.com",
  "parach.b@nanyangtextile.com",
  "nuntouchaporn.b@nanyangtextile.com",
  "napisara.p@nanyangtextile.com",
  "thanapon.k@nanyangtextile.com",
  "danunan.l@nanyangtextile.com",
  "sunida.d@nanyangtextile.com",
  "wachira.t@nanyangtextile.com",
  "noppol.a@nanyangtextile.com",
  "sakdipong.s@nanyangtextile.com",
  "parnkanok.f@nanyangtextile.com",
  // NYG
  "autthakarn.s@nanyangtextile.com",
  "jariya.t@nanyangtextile.com",
  "aoyjai.p@nanyangtextile.com",
  "nuttawut.t@nanyangtextile.com",
  "wanna.p@nanyangtextile.com",
  "chanankarn.k@nanyangtextile.com",
  "kanphisha.s@nanyangtextile.com",
  "thanaporn.p@nanyangtextile.com",
  "laorrat.s@nanyangtextile.com",
  "namfon.a@nanyangtextile.com",
  "krittamet.h@nanyangtextile.com",
  "natpreeya.s@nanyangtextile.com",
  "nattawadee.k@nanyangtextile.com",
  "surachok.s@nanyangtextile.com",
  "vorakarn.p@nanyangtextile.com",
  "nidcha.p@nanyangtextile.com",
  "chutima.ch@nanyangtextile.com",
  "juthalak.p@nanyangtextile.com",
])

async function main() {
  const all = await prisma.user.findMany({ select: { id: true, email: true, role: true } })
  const toDelete = all.filter(u => !KEEP_EMAILS.has(u.email))

  if (toDelete.length === 0) {
    console.log("ไม่มี user ที่ต้องลบ")
    return
  }

  console.log(`\nจะลบ ${toDelete.length} users:\n`)
  for (const u of toDelete) {
    console.log(`  - ${u.email} (${u.role})`)
  }

  const ids = toDelete.map(u => u.id)

  // หา AirRequest ที่สร้างโดย user เหล่านี้
  const requests = await prisma.airRequest.findMany({
    where: { createdById: { in: ids } },
    select: { id: true }
  })
  const reqIds = requests.map(r => r.id)
  if (reqIds.length > 0) {
    console.log(`\nลบ ${reqIds.length} AirRequests ที่เกี่ยวข้อง...`)
    // ClaimApproval ผูกกับ item ไม่ใช่ request โดยตรง
    const items = await prisma.airRequestItem.findMany({ where: { requestId: { in: reqIds } }, select: { id: true } })
    const itemIds = items.map(i => i.id)
    if (itemIds.length > 0) {
      await prisma.claimApproval.deleteMany({ where: { itemId: { in: itemIds } } })
    }
    await prisma.approvalLog.deleteMany({ where: { requestId: { in: reqIds } } })
    await prisma.requestAttachment.deleteMany({ where: { requestId: { in: reqIds } } })
    await prisma.airRequestItem.deleteMany({ where: { requestId: { in: reqIds } } })
    await prisma.airRequest.deleteMany({ where: { id: { in: reqIds } } })
  }

  // ลบ related records ของ user แล้วค่อยลบ user
  await prisma.claimApproval.deleteMany({ where: { userId: { in: ids } } })
  await prisma.approvalLog.deleteMany({ where: { userId: { in: ids } } })
  await prisma.requestAttachment.deleteMany({ where: { uploadedById: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })

  console.log(`\nลบแล้ว ${toDelete.length} users ✓\n`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
