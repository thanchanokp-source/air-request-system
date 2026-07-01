import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const USERS: {
  email: string
  role: string
  bu: string
  priority?: number | null
  claimDepartment?: string | null
  procurementType?: string | null
}[] = [
  // ── GW ──────────────────────────────────────────────────────────────────────
  { email: "tanarat.s@nanyangtextile.com",       role: "DPM_GW",                bu: "GW" },
  { email: "jiraporn.c@nanyangtextile.com",       role: "GM_GW",                 bu: "GW" },
  { email: "rattanakorn.p@nanyangtextile.com",    role: "PRESIDENT_GW",          bu: "GW" },
  { email: "urairat.d@nanyangtextile.com",        role: "LOGISTICS_GW",          bu: "GW" },
  { email: "parach.b@nanyangtextile.com",         role: "ACCOUNTING_GW",         bu: "GW" },
  // SCM NYK chain (GW context — enters CR NO)
  { email: "nuntouchaporn.b@nanyangtextile.com",  role: "SCM_NYK",               bu: "GW", priority: 1 },
  { email: "napisara.p@nanyangtextile.com",       role: "SCM_NYK_EVP",           bu: "GW", priority: 2 },
  // Claim GW — dept: GW / SUPPLIER
  { email: "thanapon.k@nanyangtextile.com",       role: "CLAIM_GW", bu: "GW", priority: 1, claimDepartment: "GW" },
  { email: "danunan.l@nanyangtextile.com",        role: "CLAIM_GW", bu: "GW", priority: 1, claimDepartment: "SUPPLIER" },
  // SCM NYG chain (GW context — for claim dept NYG)
  { email: "sunida.d@nanyangtextile.com",         role: "SCM_NYG",               bu: "GW", priority: 1 },
  { email: "wachira.t@nanyangtextile.com",        role: "SCM_NYG_VP",            bu: "GW", priority: 2 },
  { email: "noppol.a@nanyangtextile.com",         role: "SCM_NYG_VP_PROD_G1G3",  bu: "GW", priority: 3 },
  { email: "sakdipong.s@nanyangtextile.com",      role: "SCM_NYG_VP_PROD_G2G4",  bu: "GW", priority: 3 },
  { email: "parnkanok.f@nanyangtextile.com",      role: "SCM_NYG_EVP",           bu: "GW", priority: 4 },

  // ── NYG ─────────────────────────────────────────────────────────────────────
  { email: "autthakarn.s@nanyangtextile.com",     role: "VP_MER",                bu: "NYG" },
  { email: "jariya.t@nanyangtextile.com",         role: "PRESIDENT",             bu: "NYG" },
  { email: "aoyjai.p@nanyangtextile.com",         role: "LOGISTICS",             bu: "NYG" },
  { email: "nuttawut.t@nanyangtextile.com",       role: "SCM_USER",              bu: "NYG" },
  { email: "wanna.p@nanyangtextile.com",          role: "VP_SCM",                bu: "NYG" },
  // Claim Procurement
  { email: "chanankarn.k@nanyangtextile.com",     role: "CLAIM_PROCUREMENT", bu: "NYG", priority: 1, procurementType: "SOURCING" },
  { email: "kanphisha.s@nanyangtextile.com",      role: "CLAIM_PROCUREMENT", bu: "NYG", priority: 1, procurementType: "PURCHASING" },
  { email: "thanaporn.p@nanyangtextile.com",      role: "CLAIM_PROCUREMENT", bu: "NYG", priority: 2 },
  // Claim Production — G1/G3
  { email: "laorrat.s@nanyangtextile.com",        role: "CLAIM_PRODUCTION", bu: "NYG", priority: 1, claimDepartment: "G1G3" },
  { email: "namfon.a@nanyangtextile.com",         role: "CLAIM_PRODUCTION", bu: "NYG", priority: 2, claimDepartment: "G1G3" },
  // Claim Production — G2/G4
  { email: "krittamet.h@nanyangtextile.com",      role: "CLAIM_PRODUCTION", bu: "NYG", priority: 1, claimDepartment: "G2G4" },
  { email: "natpreeya.s@nanyangtextile.com",      role: "CLAIM_PRODUCTION", bu: "NYG", priority: 2, claimDepartment: "G2G4" },
  // Claim Commercial
  { email: "nattawadee.k@nanyangtextile.com",     role: "CLAIM_COMMERCIAL", bu: "NYG", priority: 1 },
  { email: "surachok.s@nanyangtextile.com",       role: "CLAIM_COMMERCIAL", bu: "NYG", priority: 2 },
  // Claim SCM NYG
  { email: "vorakarn.p@nanyangtextile.com",       role: "CLAIM_NYG",  bu: "NYG", priority: 1 },
  { email: "nidcha.p@nanyangtextile.com",         role: "CLAIM_NYG",  bu: "NYG", priority: 2 },
  // Claim SCM NYK
  { email: "chutima.ch@nanyangtextile.com",       role: "CLAIM_NYK",  bu: "NYG", priority: 1 },
  { email: "juthalak.p@nanyangtextile.com",       role: "CLAIM_NYK",  bu: "NYG", priority: 2 },
]

async function main() {
  console.log(`\nUpserting ${USERS.length} users...\n`)
  for (const u of USERS) {
    const name = u.email.split("@")[0]
    const data = {
      name,
      role: u.role,
      bu: u.bu,
      priority: u.priority ?? null,
      claimDepartment: u.claimDepartment ?? null,
      procurementType: u.procurementType ?? null,
      isActive: true,
    }
    await prisma.user.upsert({
      where: { email: u.email },
      update: data,
      create: { email: u.email, ...data },
    })
    console.log(`  ✓  ${u.email.padEnd(45)} → ${u.role}${u.claimDepartment ? ` [${u.claimDepartment}]` : ""}${u.priority != null ? ` P${u.priority}` : ""}`)
  }
  console.log(`\nDone!\n`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
