import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        magicToken: { label: "Magic Token", type: "text" },
        magicAs: { label: "Magic As (recipient email)", type: "text" },
      },
      async authorize(credentials) {
        // Magic link login — token validates identity without password
        if (credentials?.magicToken) {
          const token = credentials.magicToken
          // Passwordless account login (User.loginToken). REUSABLE until it expires —
          // NOT consumed on first use, so every email link that carries this token keeps
          // working (a person may get many doc links sharing one personal token).
          const loginUser = await (prisma.user as any).findFirst({ where: { loginToken: token } })
          if (loginUser) {
            if (!loginUser.isActive) return null
            if (loginUser.loginTokenExpiry && new Date(loginUser.loginTokenExpiry) < new Date()) return null
            return { id: loginUser.id, email: loginUser.email, name: loginUser.name, role: loginUser.role, roles: (loginUser as any).roles ?? [], bu: (loginUser as any).bu || "NYG", claimDepartment: (loginUser as any).claimDepartment ?? null, priority: (loginUser as any).priority ?? null }
          }
          // Try vpMerToken first (most common — DPM/VP MER)
          const airReq = await (prisma.airRequest as any).findFirst({ where: { vpMerToken: token } })
          if (airReq) {
            const isGW = airReq.bu === "GW"
            const buFor = airReq.bu || "NYG"
            // The merch token resolves to the role of the doc's CURRENT stage (NYG DVM/VP MER,
            // EA ADVM/DVM, or GW DPM).
            const st = airReq.status
            const stageRole = st === "PENDING_DVM_MER" ? "DVM_MER"
              : st === "PENDING_VP_MER" ? "VP_MER"
              : st === "PENDING_DVM_MER_EA" ? "DVM_MER_EA"
              : st === "PENDING_VP_MER_EA" ? "VP_MER_EA"
              : isGW ? "VP_MER_GW" : "VP_MER"
            // Per-recipient (?as=email) → log in AS that specific approver (each real approver's
            // email link resolves to THEM, not the first user). Falls through otherwise.
            const asEmail = String((credentials as any).magicAs || "").toLowerCase()
            if (asEmail) {
              const asU = await (prisma.user as any).findUnique({ where: { email: asEmail } })
              if (asU?.isActive && (asU.role === stageRole || (Array.isArray(asU.roles) && asU.roles.includes(stageRole)))) {
                return { id: asU.id, email: asU.email, name: asU.name, role: stageRole, bu: buFor, claimDepartment: null, priority: asU.priority ?? null }
              }
            }
            // A specific approver chosen from master: DVM/ADVM (assignedDvmMer, picked by MER) or
            // VP/EA-DVM/GW-DPM (assignedVpMer, picked by the 1st approver).
            const assignedEmail = (stageRole === "DVM_MER" || stageRole === "DVM_MER_EA") ? airReq.assignedDvmMer : airReq.assignedVpMer
            if (assignedEmail && ["VP_MER", "VP_MER_GW", "VP_MER_EA", "DVM_MER", "DVM_MER_EA"].includes(stageRole)) {
              const user = await (prisma.user as any).findUnique({ where: { email: assignedEmail } })
              if (user) return { id: user.id, email: user.email, name: user.name, role: stageRole, bu: buFor, claimDepartment: null, priority: null }
              return { id: `vp_mer_guest_${token}`, email: assignedEmail, name: assignedEmail, role: stageRole, bu: buFor, claimDepartment: null, priority: null }
            }
            // Fallback — first active holder of the stage role.
            const u = await (prisma.user as any).findFirst({
              where: { isActive: true, OR: [{ role: stageRole }, { roles: { has: stageRole } }] },
              orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
            })
            if (u) return { id: u.id, email: u.email, name: u.name, role: stageRole, bu: buFor, claimDepartment: null, priority: u.priority ?? null }
            return null
          }
          // GM (GW) — dedicated token, always resolves to a GM_GW session
          const gmReq = await (prisma.airRequest as any).findFirst({ where: { gmToken: token } })
          if (gmReq) {
            const gmUser = await (prisma.user as any).findFirst({ where: { role: "GM_GW", isActive: true } })
            if (gmUser) return { id: gmUser.id, email: gmUser.email, name: gmUser.name, role: "GM_GW", bu: "GW", claimDepartment: null, priority: null }
            return null
          }
          // Try presidentToken
          const presReq = await (prisma.airRequest as any).findFirst({ where: { presidentToken: token } })
          if (presReq) {
            const isGW = presReq.bu === "GW"
            const presRole = isGW ? "PRESIDENT_GW" : "PRESIDENT"
            // Match multi-role holders too (President may hold the role in roles[], not just as
            // primary) — same as SCM/VP SCM/Logistics lookups. Otherwise the magic link fails.
            const presUser = await (prisma.user as any).findFirst({ where: { isActive: true, OR: [{ role: presRole }, { roles: { has: presRole } }] } })
            if (presUser) {
              return { id: presUser.id, email: presUser.email, name: presUser.name, role: presRole, bu: isGW ? "GW" : (presUser.bu || "NYG"), claimDepartment: null, priority: null }
            }
            return null
          }

          // Try scmToken
          const scmReq = await (prisma.airRequest as any).findFirst({ where: { scmToken: token } })
          if (scmReq) {
            const scmUser = await (prisma.user as any).findFirst({ where: { isActive: true, OR: [{ role: "SCM_USER" }, { roles: { has: "SCM_USER" } }] } })
            if (scmUser) return { id: scmUser.id, email: scmUser.email, name: scmUser.name, role: "SCM_USER", bu: scmUser.bu || "NYG", claimDepartment: null, priority: null }
            return null
          }
          // Try vpScmToken — authenticate the specific VP SCM person selected by SCM user
          const vpScmReq = await (prisma.airRequest as any).findFirst({ where: { vpScmToken: token } })
          if (vpScmReq) {
            const assignedEmail = (vpScmReq as any).assignedVpScm
            const vpScmUser = assignedEmail
              ? await (prisma.user as any).findUnique({ where: { email: assignedEmail } })
              : await (prisma.user as any).findFirst({ where: { isActive: true, OR: [{ role: "VP_SCM" }, { roles: { has: "VP_SCM" } }] } })
            if (vpScmUser) return { id: vpScmUser.id, email: vpScmUser.email, name: vpScmUser.name, role: "VP_SCM", bu: vpScmUser.bu || "NYG", claimDepartment: null, priority: null }
            return null
          }
          // Try logisticsToken (BU-aware: LOGISTICS_GW for GW)
          const logReq = await (prisma.airRequest as any).findFirst({ where: { logisticsToken: token } })
          if (logReq) {
            const isGW = logReq.bu === "GW"
            const logRole = isGW ? "LOGISTICS_GW" : "LOGISTICS"
            const logUser = await (prisma.user as any).findFirst({ where: { isActive: true, OR: [{ role: logRole }, { roles: { has: logRole } }] } })
            if (logUser) return { id: logUser.id, email: logUser.email, name: logUser.name, role: logRole, bu: isGW ? "GW" : (logUser.bu || "NYG"), claimDepartment: null, priority: null }
            return null
          }
          // GW claim per-dept tokens. CLAIM_GW is split GW vs SUPPLIER by a
          // separate token so each logs in scoped to its own claimDepartment.
          for (const [field, gwRole, scopeDept] of [["claimGwToken", "CLAIM_GW", "GW"], ["claimSupplierToken", "CLAIM_GW", "SUPPLIER"], ["scmNykApproverToken", "SCM_NYK_APPROVER", null], ["scmNykEvpToken", "SCM_NYK_EVP", null], ["scmNykToken", "SCM_NYK", null], ["scmNygToken", "SCM_NYG", null]] as const) {
            const cReq = await (prisma.airRequest as any).findFirst({ where: { [field]: token } })
            if (cReq) {
              // Per-recipient link (?as=email) → log in AS that specific person for
              // this role. SCM NYK has 2 approvers (by brand); each gets their OWN
              // link, else both would resolve to the first user via findFirst.
              const asEmail = String((credentials as any).magicAs || "").toLowerCase()
              if (asEmail) {
                const asU = await (prisma.user as any).findUnique({ where: { email: asEmail } })
                if (asU && asU.isActive && (asU.role === gwRole || (Array.isArray(asU.roles) && asU.roles.includes(gwRole)))) {
                  return { id: asU.id, email: asU.email, name: asU.name, role: gwRole, bu: cReq.bu || "GW", claimDepartment: (asU as any).claimDepartment ?? scopeDept ?? null, priority: (asU as any).priority ?? null }
                }
              }
              // SCM NYK EVP / CR user: the Approver chose a specific person — resolve
              // to them (grant the role for this session). Else fall back to role.
              const assignedEmail = gwRole === "SCM_NYK_EVP" ? (cReq as any).assignedScmNykEvp
                : gwRole === "SCM_NYK" ? (cReq as any).assignedScmNykCr : null
              if (assignedEmail) {
                const au = await (prisma.user as any).findUnique({ where: { email: assignedEmail } })
                if (au) return { id: au.id, email: au.email, name: au.name, role: gwRole, bu: cReq.bu || "GW", claimDepartment: (au as any).claimDepartment ?? null, priority: (au as any).priority ?? null }
                return { id: `nyk_guest_${token}`, email: assignedEmail, name: assignedEmail, role: gwRole, bu: cReq.bu || "GW", claimDepartment: null, priority: null }
              }
              // SCM_NYK_* are CROSS-BU (users' bu is often NYG even on a GW doc) → do NOT scope
              // them by the doc's bu, or the magic link resolves to nobody. CLAIM_GW / SCM_NYG
              // are BU-specific → keep the bu scope (+ claimDepartment for CLAIM_GW GW vs SUPPLIER).
              const isNykRole = gwRole.startsWith("SCM_NYK")
              const u = await (prisma.user as any).findFirst({ where: { role: gwRole, isActive: true, ...(isNykRole ? {} : { bu: cReq.bu }), ...(scopeDept ? { claimDepartment: scopeDept } : {}) } })
              if (u) return { id: u.id, email: u.email, name: u.name, role: gwRole, bu: cReq.bu || "GW", claimDepartment: (u as any).claimDepartment ?? scopeDept ?? null, priority: (u as any).priority ?? null }
              return null
            }
          }
          // Per-department forward token (ClaimForward) → CLAIM_NEXT_APPROVER
          // scoped to that department (independent per-dept chains, both BU).
          const fwdRow = await (prisma as any).claimForward.findFirst({ where: { token } })
          if (fwdRow) {
            const fReq = await (prisma.airRequest as any).findUnique({ where: { id: fwdRow.requestId } })
            const bu = fReq?.bu || "GW"
            const fUser = await (prisma.user as any).findUnique({ where: { email: fwdRow.nextEmail } })
            if (fUser && fUser.isActive) {
              return { id: fUser.id, email: fUser.email, name: fUser.name, role: "CLAIM_NEXT_APPROVER", bu, claimDepartment: fwdRow.dept, priority: null, claimNextToken: token }
            }
            return { id: `claim_fwd_guest_${token}`, email: fwdRow.nextEmail, name: fwdRow.nextName || "Claim Approver", role: "CLAIM_NEXT_APPROVER", bu, claimDepartment: fwdRow.dept, priority: null, claimNextToken: token }
          }
          // Try accountingToken (BU-aware: GW uses ACCOUNTING_GW)
          const acReq = await (prisma.airRequest as any).findFirst({ where: { accountingToken: token } })
          if (acReq) {
            const isGW = acReq.bu === "GW"
            const acRoles = isGW ? ["ACCOUNTING_GW", "ACCOUNTING"] : ["ACCOUNTING"]
            const acUser = await (prisma.user as any).findFirst({ where: { role: { in: acRoles }, isActive: true } })
            if (acUser) return { id: acUser.id, email: acUser.email, name: acUser.name, role: acUser.role, bu: isGW ? "GW" : (acUser.bu || "NYG"), claimDepartment: null, priority: null }
            return null
          }
          // Try claimNextToken
          const claimReq = await (prisma.airRequest as any).findFirst({ where: { claimNextToken: token } })
          if (claimReq) {
            const claimEmail = claimReq.claimNextEmail || ""
            const claimUser = claimEmail ? await (prisma.user as any).findUnique({ where: { email: claimEmail } }) : null
            // Use the request's claimDepartment (set by forwarder) so session knows which dept to filter
            const resolvedDept = (claimReq as any).claimDepartment || null
            if (claimUser && claimUser.isActive) {
              // Always use CLAIM_NEXT_APPROVER role regardless of their actual system role
              return { id: claimUser.id, email: claimUser.email, name: claimUser.name, role: "CLAIM_NEXT_APPROVER", bu: claimUser.bu || "NYG", claimDepartment: resolvedDept, priority: claimUser.priority ?? null, claimNextToken: token }
            }
            return { id: `claim_guest_${token}`, email: claimEmail, name: claimReq.claimNextName || "Claim Approver", role: "CLAIM_NEXT_APPROVER", bu: claimReq.bu || "NYG", claimDepartment: resolvedDept, priority: null, claimNextToken: token }
          }
          return null
        }

        // Normal email/password login
        if (!credentials?.email || !credentials?.password) return null
        if (!credentials.email.toLowerCase().endsWith("@nanyangtextile.com")) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        if (!user || !user.isActive) return null
        if (!user.password) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role, roles: (user as any).roles ?? [], bu: (user as any).bu || "NYG", claimDepartment: (user as any).claimDepartment, priority: (user as any).priority ?? null }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        ;(token as any).roles = (user as any).roles ?? []
        token.bu = (user as any).bu || "NYG"
        token.claimDepartment = (user as any).claimDepartment
        token.priority = (user as any).priority ?? null
        if ((user as any).claimNextToken) token.claimNextToken = (user as any).claimNextToken
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).roles = (token as any).roles ?? []
        ;(session.user as any).bu = token.bu || "NYG"
        ;(session.user as any).claimDepartment = token.claimDepartment
        ;(session.user as any).priority = token.priority ?? null
        ;(session.user as any).claimNextToken = (token as any).claimNextToken ?? null
      }
      return session
    }
  },
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt"
  }
}
