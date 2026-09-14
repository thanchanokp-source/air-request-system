// Set up PROCUREMENT claim approvers (run on the SERVER; prod DB env).
//   node scripts/setup_proc_approvers.mjs           → DRY RUN (prints planned changes)
//   node scripts/setup_proc_approvers.mjs --apply   → commit
// Creates nidcha if missing; adds/sets claim role + priority + procurementType on the others.
// Does NOT modify jariya.t (only reports her procurement status) unless --remove-jariya-proc is passed.
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")
const REMOVE_JARIYA = process.argv.includes("--remove-jariya-proc")

// ── EDIT HERE: fill sriputtra's full email (and correct any others) ────────────
const CONFIG = [
  { email: "nidcha.p@nanyangtextile.com",     name: "Nidcha P",    role: "CLAIM_PROCUREMENT", priority: 1, procurementType: "PURCHASING", bu: "ALL", title: "DPM Procurement", create: true },
  { email: "jarunee.su@nanyangtextile.com",   name: "Jarunee Su",  role: "CLAIM_PROCUREMENT", priority: 1, procurementType: "SOURCING",   bu: "ALL", title: "Sourcing (Procurement)" },
  { email: "sriputtra.r@nanyangtextile.com",  name: "Sriputtra R", role: "CLAIM_PROCUREMENT", priority: 1, procurementType: "SOURCING",   bu: "ALL", title: "Sourcing (Procurement)" },
  { email: "prapakorn.s@nanyangtextile.com",  name: "Prapakorn S", role: "VP_PROCUREMENT",    priority: null, procurementType: null,      bu: "ALL", title: "VP Procurement" },
]
// ──────────────────────────────────────────────────────────────────────────────

const uniq = (a) => [...new Set(a.filter(Boolean))]
let missingEmail = CONFIG.some(c => c.email.includes("?"))
if (missingEmail) console.log("⚠️  ยังมี email ที่เป็น '?' (sriputtra) — แก้ในไฟล์ก่อน apply\n")

for (const c of CONFIG) {
  const existing = await prisma.user.findUnique({ where: { email: c.email } }).catch(() => null)
  const wantRoles = uniq([...(existing?.roles || []), c.role])
  const plan = {
    role: existing?.role && existing.role !== "MER_USER" ? existing.role : c.role, // keep primary if already meaningful
    roles: wantRoles, priority: c.priority, procurementType: c.procurementType, bu: c.bu, title: c.title, claimDepartment: "PROCUREMENT", isActive: true,
  }
  if (!existing) {
    if (!c.create) { console.log(`SKIP (no account, create:false): ${c.email}`); continue }
    if (c.email.includes("?")) { console.log(`SKIP (email not filled): ${c.email}`); continue }
    console.log(`CREATE ${c.email} → role=${c.role} roles=${JSON.stringify(wantRoles)} priority=${c.priority} procType=${c.procurementType} bu=${c.bu} title="${c.title}"`)
    if (APPLY) await prisma.user.create({ data: { email: c.email, name: c.name, ...plan } })
  } else {
    console.log(`UPDATE ${c.email} (was role=${existing.role} roles=${JSON.stringify(existing.roles)} priority=${existing.priority} procType=${existing.procurementType} bu=${existing.bu})`)
    console.log(`     → roles=${JSON.stringify(wantRoles)} priority=${c.priority} procType=${c.procurementType} bu=${c.bu} title="${c.title}"`)
    if (APPLY) await prisma.user.update({ where: { email: c.email }, data: { roles: wantRoles, priority: c.priority, procurementType: c.procurementType, bu: c.bu, title: c.title, claimDepartment: "PROCUREMENT" } })
  }
}

// jariya.t — report only (do NOT modify) unless explicitly told.
const jariya = await prisma.user.findFirst({ where: { email: { contains: "jariya.t", mode: "insensitive" } } }).catch(() => null)
if (jariya) {
  const held = [jariya.role, ...(jariya.roles || [])]
  const hasProc = held.includes("CLAIM_PROCUREMENT")
  console.log(`\njariya.t → role=${jariya.role} roles=${JSON.stringify(jariya.roles)} priority=${jariya.priority} procType=${jariya.procurementType}`)
  if (hasProc) {
    console.log(`  ⚠️ jariya.t ถือ CLAIM_PROCUREMENT อยู่ → ยังเป็น entry procurement ด้วย (เอกสารจะไปหา jariya ด้วย ไม่ใช่ nidcha คนเดียว)`)
    if (REMOVE_JARIYA) {
      const kept = (jariya.roles || []).filter(r => r !== "CLAIM_PROCUREMENT")
      console.log(`  REMOVE CLAIM_PROCUREMENT from jariya.t → roles=${JSON.stringify(kept)}${jariya.role === "CLAIM_PROCUREMENT" ? " (primary role also!)" : ""}`)
      if (APPLY) await prisma.user.update({ where: { id: jariya.id }, data: { roles: kept, ...(jariya.role === "CLAIM_PROCUREMENT" ? { role: "ADMIN" } : {}) } })
    } else {
      console.log(`  (ไม่แตะ jariya — ถ้าต้องการเอาออกจริงๆ ให้เพิ่ม flag --remove-jariya-proc)`)
    }
  } else {
    console.log(`  ✓ jariya.t ไม่มี CLAIM_PROCUREMENT → nidcha จะเป็น entry คนเดียวอยู่แล้ว`)
  }
}

console.log(`\n${APPLY ? "✅ APPLIED" : "🔎 DRY RUN — เพิ่ม --apply เพื่อบันทึกจริง"}`)
await prisma.$disconnect()
