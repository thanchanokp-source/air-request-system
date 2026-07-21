// User backup + restore (committed to git). Run:  node seed-users.js
// upsert by email → safe to re-run. Default password "123456" (thanchanok.p = 1234).
// Rule: a person in ONE BU → that BU; a person acting in NYG AND GW → bu "ALL".
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient()

const users = [
  // ── Admins ──
  { email: "thanchanok.p@nanyangtextile.com", name: "Thanchanok P", role: "ADMIN", roles: ["ADMIN"], bu: "ALL", pw: "1234" },
  // jariya = ADMIN + Claim Procurement (Purchasing), NYG
  { email: "jariya.t@nanyangtextile.com", name: "Jariya T", role: "ADMIN", roles: ["ADMIN", "CLAIM_PROCUREMENT"], bu: "NYG", priority: 1, procurementType: "PURCHASING", pw: "123456" },

  // ── Test MER ──
  { email: "atsadet.n@nanyangtextile.com", name: "Atsadet N", role: "MER_USER", roles: ["MER_USER"], bu: "NYG", pw: "123456" },
  { email: "apisit.n@nanyangtextile.com", name: "Apisit N", role: "MER_GW", roles: ["MER_GW"], bu: "GW", pw: "123456" },

  // ── NYG — DVM Merchandise (also Commercial claim) ──
  { email: "wasa.su@nanyangtextile.com", name: "Wasa Su", role: "DVM_MER", roles: ["DVM_MER"], bu: "NYG" },
  { email: "pornpimol.s@nanyangtextile.com", name: "Pornpimol S", role: "DVM_MER", roles: ["DVM_MER"], bu: "NYG" },
  { email: "asia.c@nanyangtextile.com", name: "Asia C", role: "DVM_MER", roles: ["DVM_MER"], bu: "NYG" },
  { email: "watcharee.b@nanyangtextile.com", name: "Watcharee B", role: "DVM_MER", roles: ["DVM_MER"], bu: "NYG" },
  { email: "onuma.w@nanyangtextile.com", name: "Onuma W", role: "DVM_MER", roles: ["DVM_MER"], bu: "NYG" },

  // ── NYG — VP Merchandise (also VP Commercial claim) ──
  { email: "isawaruk.t@nanyangtextile.com", name: "Isawaruk T", role: "VP_MER", roles: ["VP_MER"], bu: "NYG" },
  { email: "nuttareeporn.h@nanyangtextile.com", name: "Nuttareeporn H", role: "VP_MER", roles: ["VP_MER"], bu: "NYG" },

  // ── NYG — Logistics ──
  { email: "aoyjai.p@nanyangtextile.com", name: "Aoyjai P", role: "LOGISTICS", roles: ["LOGISTICS"], bu: "NYG" },

  // ── NYG — Procurement claim ──
  { email: "jarunee.su@nanyangtextile.com", name: "Jarunee Su", role: "CLAIM_PROCUREMENT", roles: ["CLAIM_PROCUREMENT"], bu: "NYG", priority: 1, procurementType: "SOURCING" },
  { email: "prapakorn.s@nanyangtextile.com", name: "Prapakorn S", role: "VP_PROCUREMENT", roles: ["VP_PROCUREMENT"], bu: "NYG" },

  // ── NYK claim (cross-BU; used by NYG & GW) ──
  { email: "sukanya.s@nanyangtextile.com", name: "Sukanya S", role: "SCM_NYK_APPROVER", roles: ["SCM_NYK_APPROVER"], bu: "NYG", priority: 1 },
  { email: "apissara.l@nanyangtextile.com", name: "Apissara L", role: "SCM_NYK_APPROVER", roles: ["SCM_NYK_APPROVER"], bu: "NYG", priority: 1 },
  { email: "benjamat.j@nanyangtextile.com", name: "Benjamat J", role: "SCM_NYK", roles: ["SCM_NYK"], bu: "NYG", priority: 2 },
  { email: "wallop.u@nanyangtextile.com", name: "Wallop U", role: "SCM_NYK_EVP", roles: ["SCM_NYK_EVP"], bu: "NYG", priority: 2 },

  // ── Multi-BU (act in NYG AND GW → bu "ALL") ──
  { email: "kimita.p@nanyangtextile.com", name: "Kimita P", role: "SCM_USER", roles: ["SCM_USER", "SCM_NYG"], bu: "ALL", priority: 1 },
  { email: "saji.t@nanyangtextile.com", name: "Saji T", role: "VP_SCM", roles: ["VP_SCM"], bu: "ALL", priority: 2 },
  { email: "chotik.c@nanyangtextile.com", name: "Chotik C", role: "PRESIDENT", roles: ["PRESIDENT", "PRESIDENT_GW"], bu: "ALL" },
  { email: "rushan@nanyangtextile.com", name: "Rushan", role: "CLAIM_PRODUCTION", roles: ["CLAIM_PRODUCTION"], bu: "ALL", claimDepartment: "G1/G3", priority: 3 },
  { email: "pk@nanyangtextile.com", name: "PK", role: "CLAIM_PRODUCTION", roles: ["CLAIM_PRODUCTION"], bu: "ALL", claimDepartment: "G2/G4", priority: 3 },
  { email: "khomkrit.h@nanyangtextile.com", name: "Khomkrit H", role: "VP_PRODUCTION", roles: ["VP_PRODUCTION"], bu: "ALL", claimDepartment: "ALL", priority: 4 },

  // ── GW ──
  { email: "oranuch.k@nanyangtextile.com", name: "Oranuch K", role: "DPM_GW", roles: ["DPM_GW"], bu: "GW" },
  { email: "poonyisa.p@nanyangtextile.com", name: "Poonyisa P", role: "GM_GW", roles: ["GM_GW"], bu: "GW" },
  { email: "urairat.d@nanyangtextile.com", name: "Urairat D", role: "LOGISTICS_GW", roles: ["LOGISTICS_GW"], bu: "GW" },
]

async function main() {
  for (const u of users) {
    // Master approvers have NO password (login via magic link / admin "View as").
    // Only accounts with `pw` set (admins, test MER) get a credentials password.
    const password = u.pw ? await bcrypt.hash(u.pw, 10) : null
    const data = {
      name: u.name, role: u.role, roles: u.roles, bu: u.bu,
      claimDepartment: u.claimDepartment ?? null, priority: u.priority ?? null,
      procurementType: u.procurementType ?? null, isActive: true,
    }
    await prisma.user.upsert({
      where: { email: u.email },
      // On re-run, don't wipe a password someone already set — only write it when `pw` is given.
      update: { ...data, ...(password ? { password } : {}) },
      create: { ...data, email: u.email, password },
    })
  }
  console.log(`Seeded ${users.length} user(s).`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
