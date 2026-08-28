"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { SendApprove } from "../request/page"
import { MAROON } from "../_StageWork"

// PC branch — Purchasing decides which lines go by AIR after LG entered freight
// (PENDING_PC_DECISION → PENDING_DVM_PUR). Same UI as the SCM decision, different stage.
export default function Page() {
  const { data: session } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const canUse = roles.includes("ADMIN") || roles.includes("PURCHASING")
  const [bu, setBu] = useState("NYG")

  if (!canUse) return <div className="p-10 text-center"><div className="text-4xl">🔒</div><p className="mt-2 text-sm text-gray-500">Purchase / Admin only</p></div>

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div><h1 className="text-xl font-bold" style={{ color: MAROON }}>Purchase — Air Decision</h1>
        <p className="text-sm text-gray-500">PC branch · decide which lines go by AIR after Logistics · approve → DVM Purchasing → VP Purchasing</p></div>
      <SendApprove bu={bu} setBu={setBu} decisionStatus="PENDING_PC_DECISION" nextStatus="PENDING_DVM_PUR" />
    </div>
  )
}
