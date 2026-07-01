export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_VP_MER: "Pending VP MER",
  PENDING_SCM: "Pending SCM",
  PENDING_VP_SCM: "Pending VP SCM",
  PENDING_PRESIDENT: "Pending President",
  PENDING_LOGISTICS: "Pending Logistics",
  PENDING_CLAIM: "Pending Claim",
  PENDING_VP_CLAIM: "Pending VP Claim",
  PENDING_VP_NYK: "Pending VP NYK",
  // GW
  PENDING_VP_MER_GW: "Pending DPM (GW)",
  PENDING_PRESIDENT_GW: "Pending President (GW)",
  PENDING_LOGISTICS_GW: "Pending Logistics (GW)",
  PENDING_CLAIM_GW: "Pending Claim (GW)",
  PENDING_SCM_GW: "Pending SCM (GW)",
  PENDING_ACCOUNTING: "Pending Accounting",
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
  PENDING_VP_CLAIM: "bg-violet-100 text-violet-700",
  // GW
  PENDING_VP_MER_GW: "bg-yellow-100 text-yellow-700",
  PENDING_PRESIDENT_GW: "bg-purple-100 text-purple-700",
  PENDING_LOGISTICS_GW: "bg-blue-100 text-blue-700",
  PENDING_CLAIM_GW: "bg-indigo-100 text-indigo-700",
  PENDING_SCM_GW: "bg-orange-100 text-orange-700",
  PENDING_ACCOUNTING: "bg-teal-100 text-teal-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700"
}

export const NEXT_STATUS: Record<string, { approve: string; reject?: string }> = {
  // NYG flow
  PENDING_VP_MER: { approve: "PENDING_PRESIDENT", reject: "REJECTED" },
  PENDING_SCM: { approve: "PENDING_VP_SCM" },
  PENDING_VP_SCM: { approve: "PENDING_CLAIM", reject: "REJECTED" },
  PENDING_PRESIDENT: { approve: "PENDING_SCM", reject: "REJECTED" },
  PENDING_LOGISTICS: { approve: "PENDING_CLAIM" },
  PENDING_CLAIM: { approve: "PENDING_VP_CLAIM", reject: "REJECTED" },
  PENDING_VP_CLAIM: { approve: "COMPLETED", reject: "REJECTED" },
  PENDING_VP_NYK: { approve: "COMPLETED", reject: "REJECTED" },
  // GW flow
  PENDING_VP_MER_GW: { approve: "PENDING_PRESIDENT_GW", reject: "REJECTED" },
  PENDING_PRESIDENT_GW: { approve: "PENDING_LOGISTICS_GW", reject: "REJECTED" },
  PENDING_LOGISTICS_GW: { approve: "PENDING_CLAIM_GW" },
  PENDING_CLAIM_GW: { approve: "PENDING_ACCOUNTING", reject: "REJECTED" },
  PENDING_SCM_GW: { approve: "PENDING_ACCOUNTING", reject: "REJECTED" },
  PENDING_ACCOUNTING: { approve: "COMPLETED", reject: "REJECTED" },
}

export const STYLE_APPROVER_STATUSES = ["PENDING_VP_MER", "PENDING_VP_SCM", "PENDING_PRESIDENT"]

export const CLAIM_VP_ROLES = ["VP_COMMERCIAL", "VP_PROCUREMENT", "VP_NYK", "VP_PRODUCTION"]

export const GW_ROLES = ["VP_MER_GW", "PRESIDENT_GW", "LOGISTICS_GW", "CLAIM_GW", "SCM_NYK", "SCM_NYG", "ACCOUNTING"]
export const ALL_BU_ROLES = ["ADMIN"]
export const GW_CLAIM_DEPTS = ["NYK", "NYG", "GW", "SUPPLIER_IN", "SUPPLIER_OUT"] as const
export const GW_CLAIM_DEPT_LABELS: Record<string, string> = {
  NYK: "NYK", NYG: "NYG", GW: "GW",
  SUPPLIER_IN: "Supplier ใน", SUPPLIER_OUT: "Supplier นอก"
}
export const GW_SCM_DEPTS = ["NYK", "NYG"]

export const ROLE_ACTIONS: Record<string, string[]> = {
  VP_MER: ["PENDING_VP_MER"],
  SCM_USER: ["PENDING_SCM", "PENDING_VP_MER"],
  VP_SCM: ["PENDING_SCM", "PENDING_VP_SCM"],
  PRESIDENT: ["PENDING_SCM", "PENDING_PRESIDENT"],
  LOGISTICS: ["PENDING_SCM", "PENDING_PRESIDENT", "PENDING_LOGISTICS"],
  // Legacy CLAIM_* roles
  CLAIM_COMMERCIAL: ["PENDING_LOGISTICS", "PENDING_CLAIM"],
  CLAIM_PROCUREMENT: ["PENDING_LOGISTICS", "PENDING_CLAIM"],
  CLAIM_NYK: ["PENDING_LOGISTICS", "PENDING_CLAIM"],
  CLAIM_PRODUCTION: ["PENDING_LOGISTICS", "PENDING_CLAIM"],
  // New DVM roles
  DVM_COMMERCIAL: ["PENDING_LOGISTICS", "PENDING_CLAIM"],
  DVM_PROCUREMENT: ["PENDING_LOGISTICS", "PENDING_CLAIM"],
  DVM_NYK: ["PENDING_LOGISTICS", "PENDING_CLAIM"],
  DVM_PRODUCTION: ["PENDING_LOGISTICS", "PENDING_CLAIM"],
  // VP Claim roles
  VP_COMMERCIAL: ["PENDING_LOGISTICS", "PENDING_CLAIM", "PENDING_VP_CLAIM"],
  VP_PROCUREMENT: ["PENDING_LOGISTICS", "PENDING_CLAIM", "PENDING_VP_CLAIM"],
  VP_PRODUCTION: ["PENDING_LOGISTICS", "PENDING_CLAIM", "PENDING_VP_CLAIM"],
  VP_NYK: ["PENDING_LOGISTICS", "PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_VP_NYK"],
  // GW roles
  VP_MER_GW: ["PENDING_VP_MER_GW"],
  PRESIDENT_GW: ["PENDING_PRESIDENT_GW"],
  LOGISTICS_GW: ["PENDING_LOGISTICS_GW"],
  CLAIM_GW: ["PENDING_CLAIM_GW"],
  SCM_NYK: ["PENDING_SCM_GW"],
  SCM_NYG: ["PENDING_SCM_GW"],
  ACCOUNTING: [],
  MER_GW: [],
}
