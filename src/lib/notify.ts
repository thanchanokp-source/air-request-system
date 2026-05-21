import { prisma } from "./prisma"
import { sendMail } from "./email"

const APP_URL = process.env.APP_URL || "http://localhost:3000"

const STATUS_SUBJECT: Record<string, string> = {
  PENDING_SCM:       "มีเอกสารรอ Assign Claim — SCM User",
  PENDING_VP_SCM:    "มีเอกสารรอ Approve — VP SCM",
  PENDING_PRESIDENT: "มีเอกสารรอ Approve — President",
  PENDING_LOGISTICS: "มีเอกสารรอใส่ข้อมูล — Logistics",
  PENDING_CLAIM:     "มีเอกสารรอ Approve — DVM Claim",
  PENDING_VP_CLAIM:  "มีเอกสารรอ Approve — VP Claim",
  PENDING_VP_NYK:    "มีเอกสารรอ Approve — VP NYK",
  COMPLETED:         "เอกสารได้รับการ Approve ครบแล้ว",
  REJECTED:          "เอกสารถูก Reject",
}

// Roles that receive notification per status
const STATUS_ROLES: Record<string, string[]> = {
  PENDING_SCM:       ["SCM_USER"],
  PENDING_VP_SCM:    ["VP_SCM"],
  PENDING_PRESIDENT: ["PRESIDENT"],
  PENDING_LOGISTICS: ["LOGISTICS"],
  PENDING_CLAIM:     ["DVM_COMMERCIAL","DVM_PROCUREMENT","DVM_NYK","DVM_PRODUCTION","CLAIM_COMMERCIAL","CLAIM_PROCUREMENT","CLAIM_NYK","CLAIM_PRODUCTION"],
  PENDING_VP_CLAIM:  ["VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION"],
  PENDING_VP_NYK:    ["VP_NYK"],
}

// Extract claim dept from role string
const deptFromRole = (r: string) =>
  r.startsWith("DVM_") ? r.replace("DVM_","") :
  r.startsWith("CLAIM_") ? r.replace("CLAIM_","") :
  ["VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION"].includes(r) ? r.replace("VP_","") : null

function buildHtml(req: any, newStatus: string, link: string) {
  const statusLabel: Record<string,string> = {
    PENDING_SCM:"Pending SCM", PENDING_VP_SCM:"Pending VP SCM",
    PENDING_PRESIDENT:"Pending President", PENDING_LOGISTICS:"Pending Logistics",
    PENDING_CLAIM:"Pending Claim (DVM)", PENDING_VP_CLAIM:"Pending VP Claim",
    PENDING_VP_NYK:"Pending VP NYK", COMPLETED:"Completed", REJECTED:"Rejected",
  }
  const totalSo = req.items?.length || 0
  const depts = [...new Set((req.items||[]).map((i:any) => i.claimDepartment).filter(Boolean))]

  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#1e3a8a;padding:20px 24px">
      <p style="color:#93c5fd;font-size:12px;margin:0 0 4px">AIR REQUEST SYSTEM</p>
      <h1 style="color:#fff;font-size:18px;margin:0">${STATUS_SUBJECT[newStatus] || "Document Update"}</h1>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        <tr><td style="color:#6b7280;padding:6px 0;width:140px">Document No.</td>
            <td style="font-weight:700;color:#1e3a8a">${req.documentNo}</td></tr>
        <tr><td style="color:#6b7280;padding:6px 0">Brand / BU</td>
            <td>${req.brandName || "-"} / ${req.buName || "-"}</td></tr>
        <tr><td style="color:#6b7280;padding:6px 0">Status</td>
            <td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600">${statusLabel[newStatus] || newStatus}</span></td></tr>
        <tr><td style="color:#6b7280;padding:6px 0">Total SO</td>
            <td>${totalSo} SO(s)${depts.length ? ` · ${depts.join(", ")}` : ""}</td></tr>
      </table>
      <a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
        เปิดเอกสาร →
      </a>
    </div>
    <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #f3f4f6">
      <p style="color:#9ca3af;font-size:11px;margin:0">Nan Yang Textile · Air Request System</p>
    </div>
  </div>
</body>
</html>`
}

export async function notifyStatusChange(requestId: string, newStatus: string) {
  try {
    const rolesToNotify = STATUS_ROLES[newStatus]
    if (!rolesToNotify) return

    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: { select: { claimDepartment: true } } }
    })
    if (!req) return

    // For claim statuses, filter by depts that actually have items
    const activeDepts = new Set(req.items.map((i:any) => i.claimDepartment).filter(Boolean))

    const users = await prisma.user.findMany({
      where: { role: { in: rolesToNotify }, isActive: true },
      select: { email: true, role: true }
    })

    // Filter: for PENDING_CLAIM / PENDING_VP_CLAIM, only notify users whose dept has items
    const recipients = users
      .filter(u => {
        const dept = deptFromRole(u.role)
        if (!dept) return true // non-dept roles get all notifications
        if (newStatus === "PENDING_CLAIM" || newStatus === "PENDING_VP_CLAIM") {
          return activeDepts.has(dept)
        }
        return true
      })
      .map(u => u.email)

    if (!recipients.length) return

    const link = `${APP_URL}/requests/${requestId}`
    const html = buildHtml(req, newStatus, link)
    const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"

    await sendMail(recipients, `[Air Request] ${subject} — ${req.documentNo}`, html)
  } catch (err) {
    // Email failure should never break the approval flow
    console.error("[notify] email error:", err)
  }
}
