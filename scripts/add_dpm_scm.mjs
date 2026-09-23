// Give sirinya.t@nanyangtextile.com the DPM_SCM role (approves SCM NYG claim BEFORE Saji/VP_SCM).
// If the user exists → ensure DPM_SCM is in roles[] (keeps other roles). If not → create her.
//   node scripts/add_dpm_scm.mjs            → DRY RUN
//   node scripts/add_dpm_scm.mjs --apply    → commit
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")
const EMAIL = "sirinya.t@nanyangtextile.com"
const ROLE = "DPM_SCM"

const u = await prisma.user.findFirst({ where: { email: EMAIL } })
if (u) {
  const roles = new Set([u.role, ...((u.roles) || [])].filter(Boolean))
  const already = roles.has(ROLE)
  console.log(`\nพบ user: ${u.name || u.email} · role=${u.role} · roles=[${[...roles].join(", ")}] · bu=${u.bu} · active=${u.isActive}`)
  if (already) { console.log(`\n✅ มี ${ROLE} อยู่แล้ว — ไม่ต้องทำอะไร`); process.exit(0) }
  console.log(`\nPLAN → เพิ่ม role ${ROLE} เข้า roles[] (role หลักคงเดิม)`)
  if (APPLY) {
    const newRoles = [...new Set([...(u.roles || []), ROLE])]
    // priority 1 so she is counted as the entry approver for the SCM NYG claim step.
    const data = { roles: newRoles, isActive: true }
    if (u.priority == null) data.priority = 1
    await prisma.user.update({ where: { id: u.id }, data })
    console.log(`\n✅ APPLIED — ${EMAIL} ได้ role ${ROLE} แล้ว (roles=[${newRoles.join(", ")}]${u.priority == null ? ", priority=1" : ""})`)
  } else console.log("\n🔎 DRY RUN — เพิ่ม --apply เพื่อบันทึกจริง")
} else {
  console.log(`\nไม่พบ user ${EMAIL}`)
  console.log(`PLAN → สร้าง user ใหม่: role=${ROLE} · bu=NYG · password="1234" · active`)
  if (APPLY) {
    const hash = await bcrypt.hash("1234", 10)
    await prisma.user.create({ data: { email: EMAIL, name: "Sirinya T", role: ROLE, roles: [ROLE], bu: "NYG", isActive: true, priority: 1, password: hash } })
    console.log(`\n✅ APPLIED — สร้าง ${EMAIL} เป็น ${ROLE} (password "1234")`)
  } else console.log("\n🔎 DRY RUN — เพิ่ม --apply เพื่อบันทึกจริง")
}
await prisma.$disconnect()
