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
      },
      async authorize(credentials) {
        // Magic link login — token validates identity without password
        if (credentials?.magicToken) {
          const token = credentials.magicToken
          // Try vpMerToken
          const airReq = await (prisma.airRequest as any).findFirst({ where: { vpMerToken: token } })
          if (airReq) {
            const isGW = airReq.bu === "GW"
            // GW: the same request token also serves the GM stage (after DPM approves).
            if (isGW && airReq.status === "PENDING_GM_GW") {
              const gmUser = await (prisma.user as any).findFirst({ where: { role: "GM_GW", isActive: true } })
              if (gmUser) return { id: gmUser.id, email: gmUser.email, name: gmUser.name, role: "GM_GW", bu: "GW", claimDepartment: null, priority: null }
              return null
            }
            const assignedEmail = airReq.assignedVpMer
            if (!assignedEmail) return null
            const user = await (prisma.user as any).findUnique({ where: { email: assignedEmail } })
            const vpRole = isGW ? "VP_MER_GW" : "VP_MER"
            if (user) {
              // Always grant VP_MER role for this session — they are the designated approver
              return { id: user.id, email: user.email, name: user.name, role: vpRole, bu: isGW ? "GW" : (user.bu || "NYG"), claimDepartment: null, priority: null }
            }
            // Guest VP MER session
            return { id: `vp_mer_guest_${token}`, email: assignedEmail, name: assignedEmail, role: vpRole, bu: isGW ? "GW" : "NYG", claimDepartment: null, priority: null }
          }
          // Try presidentToken
          const presReq = await (prisma.airRequest as any).findFirst({ where: { presidentToken: token } })
          if (presReq) {
            const presUser = await (prisma.user as any).findFirst({ where: { role: "PRESIDENT", isActive: true } })
            if (presUser) {
              return { id: presUser.id, email: presUser.email, name: presUser.name, role: "PRESIDENT", bu: presUser.bu || "NYG", claimDepartment: null, priority: null }
            }
            return null
          }

          // Try scmToken
          const scmReq = await (prisma.airRequest as any).findFirst({ where: { scmToken: token } })
          if (scmReq) {
            const scmUser = await (prisma.user as any).findFirst({ where: { role: "SCM_USER", isActive: true } })
            if (scmUser) return { id: scmUser.id, email: scmUser.email, name: scmUser.name, role: "SCM_USER", bu: scmUser.bu || "NYG", claimDepartment: null, priority: null }
            return null
          }
          // Try vpScmToken — authenticate the specific VP SCM person selected by SCM user
          const vpScmReq = await (prisma.airRequest as any).findFirst({ where: { vpScmToken: token } })
          if (vpScmReq) {
            const assignedEmail = (vpScmReq as any).assignedVpScm
            const vpScmUser = assignedEmail
              ? await (prisma.user as any).findUnique({ where: { email: assignedEmail } })
              : await (prisma.user as any).findFirst({ where: { role: "VP_SCM", isActive: true } })
            if (vpScmUser) return { id: vpScmUser.id, email: vpScmUser.email, name: vpScmUser.name, role: "VP_SCM", bu: vpScmUser.bu || "NYG", claimDepartment: null, priority: null }
            return null
          }
          // Try logisticsToken
          const logReq = await (prisma.airRequest as any).findFirst({ where: { logisticsToken: token } })
          if (logReq) {
            const logUser = await (prisma.user as any).findFirst({ where: { role: "LOGISTICS", isActive: true } })
            if (logUser) return { id: logUser.id, email: logUser.email, name: logUser.name, role: "LOGISTICS", bu: logUser.bu || "NYG", claimDepartment: null, priority: null }
            return null
          }
          // Try accountingToken
          const acReq = await (prisma.airRequest as any).findFirst({ where: { accountingToken: token } })
          if (acReq) {
            const acUser = await (prisma.user as any).findFirst({ where: { role: "ACCOUNTING", isActive: true } })
            if (acUser) return { id: acUser.id, email: acUser.email, name: acUser.name, role: "ACCOUNTING", bu: acUser.bu || "NYG", claimDepartment: null, priority: null }
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
        return { id: user.id, email: user.email, name: user.name, role: user.role, bu: (user as any).bu || "NYG", claimDepartment: (user as any).claimDepartment, priority: (user as any).priority ?? null }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
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
