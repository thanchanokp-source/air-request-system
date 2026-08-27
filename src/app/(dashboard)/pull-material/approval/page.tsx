"use client"
import { useSession } from "next-auth/react"
import { StageWork } from "../_StageWork"

// Role-adaptive approval. Each approver role sees ONLY the stage it owns and advances it:
//   SCM branch:  VP_SCM (Saji)        PENDING_VP_SCM → PENDING_FINAL
//                PRESIDENT (Khomkrit) PENDING_FINAL  → APPROVED
//   PC branch:   DVM_PUR              PENDING_DVM_PUR → PENDING_VP_PUR
//                VP_PUR               PENDING_VP_PUR  → APPROVED
// Admin sees every stage (incl. legacy PENDING_APPROVAL) so they can push any doc through.
const STAGES = [
  { key: "PENDING_VP_SCM",   roles: ["VP_SCM"],    title: "Approval — VP SCM",         sub: "SCM branch · approve → President (K.Khomkrit)", next: "PENDING_FINAL",  back: "PENDING_SCM_DECISION", backLabel: "Send back to SCM" },
  { key: "PENDING_FINAL",    roles: ["PRESIDENT"], title: "Approval — President",      sub: "SCM branch · final approval",                   next: "APPROVED",       back: "PENDING_VP_SCM",       backLabel: "Send back to VP SCM" },
  { key: "PENDING_DVM_PUR",  roles: ["DVM_PUR"],   title: "Approval — DVM Purchasing", sub: "PC branch · approve → VP Purchasing",           next: "PENDING_VP_PUR", back: "PENDING_PC_DECISION",  backLabel: "Send back to Purchase" },
  { key: "PENDING_VP_PUR",   roles: ["VP_PUR"],    title: "Approval — VP Purchasing",  sub: "PC branch · final approval",                    next: "APPROVED",       back: "PENDING_DVM_PUR",      backLabel: "Send back to DVM Pur" },
  { key: "PENDING_APPROVAL", roles: [],            title: "Approval (legacy)",         sub: "Older documents pending a single approval",     next: "APPROVED",       back: "PENDING_SCM_DECISION", backLabel: "Send back to SCM" },
]

export default function Page() {
  const { data: session } = useSession()
  const myRoles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const isAdmin = myRoles.includes("ADMIN")

  // Stages this user owns. Admin → all; legacy PENDING_APPROVAL only for admin.
  const mine = STAGES.filter(s => isAdmin || s.roles.some(r => myRoles.includes(r)))

  if (mine.length === 0) {
    return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">No approval stage for your role</p></div>
  }

  return (
    <div className="space-y-6">
      {mine.map(s => (
        <StageWork key={s.key}
          title={s.title} subtitle={s.sub} status={s.key} fields={[]}
          roles={s.roles.length ? s.roles : undefined}
          primary={{ label: "Approve", toStatus: s.next, color: "#16a34a" }}
          secondary={{ label: s.backLabel, toStatus: s.back }}
        />
      ))}
    </div>
  )
}
