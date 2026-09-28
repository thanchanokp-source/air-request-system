// Add kanchana.ch@nanyangtextile.com as a VISITOR (read-only viewer — sees every BU, no actions),
// and generate a SET-PASSWORD link so she creates her own password (no default password).
//   node scripts/add_viewer_kanchana.mjs           → DRY RUN
//   node scripts/add_viewer_kanchana.mjs --apply    → commit + print the set-password link
import { PrismaClient } from "@prisma/client"
import { randomBytes } from "crypto"
const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")
const EMAIL = "kanchana.ch@nanyangtextile.com"
const NAME = "Kanchana Ch"
const ROLE = "VISITOR"
const BASE = (process.env.APP_URL || process.env.NEXTAUTH_URL || "https://demoairrequest.nanyangtextile.com").replace(/\/$/, "")

const u = await prisma.user.findFirst({ where: { email: EMAIL } })
const token = randomBytes(32).toString("hex")
const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
const link = `${BASE}/set-password?token=${token}`

if (u) {
  const roles = [...new Set([...(u.roles || []), ROLE])]
  console.log(`\nพบ user: ${u.name || u.email} · role=${u.role} · roles=[${roles.join(", ")}] · bu=${u.bu} · hasPassword=${!!u.password}`)
  console.log(`\nPLAN → เพิ่ม role ${ROLE}${u.role ? "" : " (เป็น role หลัก)"} + สร้างลิงก์ตั้ง password (7 วัน)`)
  if (APPLY) {
    const data = { roles, isActive: true, bu: "ALL", resetToken: token, resetTokenExpiry: expiry }
    if (!u.role) data.role = ROLE
    await prisma.user.update({ where: { id: u.id }, data })
    console.log(`\n✅ APPLIED\n🔗 ลิงก์ตั้ง password (ส่งให้ kanchana):\n${link}`)
  } else console.log(`\n🔎 DRY RUN — เพิ่ม --apply เพื่อบันทึกจริง + สร้างลิงก์`)
} else {
  console.log(`\nไม่พบ user ${EMAIL}`)
  console.log(`PLAN → สร้าง user ใหม่: role=${ROLE} (view-only) · bu=ALL · ไม่มี password (ตั้งผ่านลิงก์)`)
  if (APPLY) {
    await prisma.user.create({ data: { email: EMAIL, name: NAME, role: ROLE, roles: [ROLE], bu: "ALL", isActive: true, resetToken: token, resetTokenExpiry: expiry } })
    console.log(`\n✅ APPLIED — สร้าง ${EMAIL} เป็น ${ROLE}\n🔗 ลิงก์ตั้ง password (ส่งให้ kanchana):\n${link}`)
  } else console.log(`\n🔎 DRY RUN — เพิ่ม --apply เพื่อบันทึกจริง + สร้างลิงก์`)
}
await prisma.$disconnect()
