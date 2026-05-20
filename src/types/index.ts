export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_VP_MER: "Pending VP MER",
  PENDING_SCM: "Pending SCM",
  PENDING_VP_SCM: "Pending VP SCM",
  PENDING_PRESIDENT: "Pending President",
  PENDING_LOGISTICS: "Pending Logistics",
  PENDING_CLAIM: "Pending Claim",
  PENDING_VP_NYK: "Pending VP NYK",
  COMPLETED: "Completed",
  REJECTED: "Rejected"
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_VP_MER: "bg-yellow-100 text-yellow-700",
  PENDING_SCM: "bg-orange-100 text-orange-700",
  PENDING_VP_SCM: "bg-amber-100 text-amber-700",
  PENDING_PRESIDENT: "bg-purple-100 text-purple-700",
  PENDING_LOGISTICS: "bg-blue-100 text-blue-700",
  PENDING_CLAIM: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700"
}

export const NEXT_STATUS: Record<string, { approve: string; reject?: string }> = {
  PENDING_VP_MER: { approve: "PENDING_SCM", reject: "REJECTED" },
  PENDING_SCM: { approve: "PENDING_VP_SCM" },
  PENDING_VP_SCM: { approve: "PENDING_PRESIDENT", reject: "REJECTED" },
  PENDING_PRESIDENT: { approve: "PENDING_LOGISTICS", reject: "REJECTED" },
  PENDING_LOGISTICS: { approve: "PENDING_CLAIM" },
  PENDING_CLAIM: { approve: "COMPLETED", reject: "REJECTED" },
  PENDING_VP_NYK: { approve: "COMPLETED", reject: "REJECTED" },
}

export const STYLE_APPROVER_STATUSES = ["PENDING_VP_MER", "PENDING_VP_SCM", "PENDING_PRESIDENT"]

export const ROLE_ACTIONS: Record<string, string[]> = {
  VP_MER: ["PENDING_VP_MER"],
  SCM_USER: ["PENDING_SCM"],
  VP_SCM: ["PENDING_VP_SCM"],
  PRESIDENT: ["PENDING_PRESIDENT"],
  LOGISTICS: ["PENDING_LOGISTICS"],
  CLAIM_COMMERCIAL: ["PENDING_CLAIM"],
  CLAIM_PROCUREMENT: ["PENDING_CLAIM"],
  CLAIM_NYK: ["PENDING_CLAIM"],
  CLAIM_PRODUCTION: ["PENDING_CLAIM"],
  VP_NYK: ["PENDING_VP_NYK"]
}
