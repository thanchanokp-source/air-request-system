import { prisma } from "./prisma"
import { sendMail } from "./email"

const APP_URL = process.env.APP_URL || "http://localhost:3000"

const STATUS_SUBJECT: Record<string, string> = {
  PENDING_VP_MER:      "มีเอกสาร Air Request ใหม่ รอ Approve — VP MER",
  PENDING_SCM:         "มีเอกสารรอ Assign Claim — SCM User",
  PENDING_VP_SCM:      "มีเอกสารรอ Approve — VP SCM",
  PENDING_PRESIDENT:   "มีเอกสารรอ Approve — President",
  PENDING_LOGISTICS:   "มีเอกสารรอใส่ข้อมูล — Logistics",
  PENDING_CLAIM:       "มีเอกสารรอ Approve — DVM Claim",
  PENDING_VP_CLAIM:    "มีเอกสารรอ Approve — VP Claim",
  PENDING_VP_NYK:      "มีเอกสารรอ Approve — VP NYK",
  // GW
  PENDING_VP_MER_GW:   "มีเอกสาร Air Request ใหม่ (GW) รอ Approve — VP MER",
  PENDING_PRESIDENT_GW:"มีเอกสารรอ Approve — President (GW)",
  PENDING_LOGISTICS_GW:"มีเอกสารรอใส่ข้อมูล — Logistics (GW)",
  PENDING_CLAIM_GW:    "มีเอกสารรอ Approve — Claim (GW)",
  COMPLETED:           "เอกสารได้รับการ Approve ครบแล้ว",
  REJECTED:            "เอกสารถูก Reject",
}

// Roles that receive notification per status
const STATUS_ROLES: Record<string, string[]> = {
  PENDING_VP_MER:       ["VP_MER"],
  PENDING_SCM:          ["SCM_USER"],
  PENDING_VP_SCM:       ["VP_SCM"],
  PENDING_PRESIDENT:    ["PRESIDENT"],
  PENDING_LOGISTICS:    ["LOGISTICS"],
  PENDING_CLAIM:        ["DVM_COMMERCIAL","DVM_PROCUREMENT","DVM_NYK","DVM_PRODUCTION","CLAIM_COMMERCIAL","CLAIM_PROCUREMENT","CLAIM_NYK","CLAIM_PRODUCTION"],
  PENDING_VP_CLAIM:     ["VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION"],
  PENDING_VP_NYK:       ["VP_NYK"],
  // GW — handled separately in notifyStatusChange
  PENDING_PRESIDENT_GW: ["PRESIDENT_GW"],
  PENDING_LOGISTICS_GW: ["LOGISTICS_GW"],
  PENDING_CLAIM_GW:     ["CLAIM_GW"],
}

// Extract claim dept from role string
const deptFromRole = (r: string) =>
  r.startsWith("DVM_") ? r.replace("DVM_","") :
  r.startsWith("CLAIM_") ? r.replace("CLAIM_","") :
  ["VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION"].includes(r) ? r.replace("VP_","") : null

function buildHtml(req: any, newStatus: string, link: string, approveUrl?: string, rejectUrl?: string) {
  const statusLabel: Record<string,string> = {
    PENDING_VP_MER:"Pending VP MER", PENDING_SCM:"Pending SCM", PENDING_VP_SCM:"Pending VP SCM",
    PENDING_PRESIDENT:"Pending President", PENDING_LOGISTICS:"Pending Logistics",
    PENDING_CLAIM:"Pending Claim (DVM)", PENDING_VP_CLAIM:"Pending VP Claim",
    PENDING_VP_NYK:"Pending VP NYK", COMPLETED:"Completed", REJECTED:"Rejected",
  }
  const totalSo = req.items?.length || 0
  const styles = [...new Set((req.items||[]).map((i:any) => i.style).filter(Boolean))].join(", ")

  const buttons = approveUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px">
                <a href="${rejectUrl}" style="display:inline-block;background:#ef4444;color:#ffffff;padding:13px 30px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1.5px;font-family:Arial,sans-serif">REJECT</a>
              </td>
              <td>
                <a href="${approveUrl}" style="display:inline-block;background:#22c55e;color:#ffffff;padding:13px 30px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1.5px;font-family:Arial,sans-serif">APPROVE</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:16px">
          <a href="${link}" style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">เปิดใน Air Request System →</a>
        </td>
      </tr>
    </table>
  ` : `
    <div style="text-align:center;margin-top:24px">
      <a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">เปิดเอกสาร →</a>
    </div>
  `

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f1f5f9">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0">
    <tr>
      <td align="center">
        <table width="400" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a8a;padding:20px;text-align:center">
              <p style="margin:0;color:#93c5fd;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif;text-transform:uppercase">Nan Yang Textile</p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 36px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-bottom:1px solid #f1f5f9;padding:10px 0">
                    <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">DOC NO</span><br>
                    <span style="color:#1e3a8a;font-size:15px;font-weight:700;font-family:Arial,sans-serif">${req.documentNo}</span>
                  </td>
                </tr>
                <tr>
                  <td style="border-bottom:1px solid #f1f5f9;padding:10px 0">
                    <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">BRAND</span><br>
                    <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${req.brandName || "-"}</span>
                  </td>
                </tr>
                <tr>
                  <td style="border-bottom:1px solid #f1f5f9;padding:10px 0">
                    <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">STATUS</span><br>
                    <span style="color:#1d4ed8;font-size:14px;font-weight:600;font-family:Arial,sans-serif">${statusLabel[newStatus] || newStatus}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0">
                    <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">STYLE</span><br>
                    <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${styles || `${totalSo} SO(s)`}</span>
                  </td>
                </tr>
              </table>
              ${buttons}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
              <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function notifyStatusChange(requestId: string, newStatus: string) {
  try {
    const rolesToNotify = STATUS_ROLES[newStatus]
    if (!rolesToNotify) return

    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: { select: { claimDepartment: true, assignedDvm: true } } }
    })
    if (!req) return

    // For PENDING_VP_MER — send only to assigned VP MER with approve/reject buttons
    if (newStatus === "PENDING_VP_MER") {
      const assignedEmail = (req as any).assignedVpMer
      const token = (req as any).vpMerToken
      if (!assignedEmail) return
      const link = `${APP_URL}/requests/${requestId}`
      const approveUrl = token ? `${APP_URL}/api/email-approve?token=${token}&action=approve` : undefined
      const rejectUrl = token ? `${APP_URL}/api/email-approve?token=${token}&action=reject` : undefined
      const html = buildHtml(req, newStatus, link, approveUrl, rejectUrl)
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      await sendMail([assignedEmail], `[Air Request] ${subject} — ${req.documentNo}`, html)
      return
    }

    // For PENDING_VP_MER_GW — send to assigned VP MER GW with approve/reject buttons
    if (newStatus === "PENDING_VP_MER_GW") {
      const assignedEmail = (req as any).assignedVpMer
      const token = (req as any).vpMerToken
      if (!assignedEmail) return
      const link = `${APP_URL}/requests/${requestId}`
      const approveUrl = token ? `${APP_URL}/api/email-approve?token=${token}&action=approve` : undefined
      const rejectUrl = token ? `${APP_URL}/api/email-approve?token=${token}&action=reject` : undefined
      const html = buildHtml(req, newStatus, link, approveUrl, rejectUrl)
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      await sendMail([assignedEmail], `[Air Request] ${subject} — ${req.documentNo}`, html)
      return
    }

    // For PENDING_CLAIM_GW — send to CLAIM_GW users matching claim dept
    if (newStatus === "PENDING_CLAIM_GW") {
      const claimDept = (req as any).claimDepartment
      const users = await (prisma.user as any).findMany({
        where: { role: "CLAIM_GW", isActive: true, ...(claimDept ? { claimDepartment: claimDept } : {}) },
        select: { email: true }
      })
      const recipients = users.map((u: any) => u.email).filter(Boolean)
      if (!recipients.length) return
      const link = `${APP_URL}/requests/${requestId}`
      const html = buildHtml(req, newStatus, link)
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      await sendMail(recipients, `[Air Request] ${subject} — ${req.documentNo}`, html)
      return
    }

    // For PENDING_CLAIM — send only to assignedDvm per item (if set)
    if (newStatus === "PENDING_CLAIM") {
      const assignedEmails = [...new Set(req.items.map((i:any) => i.assignedDvm).filter(Boolean))]
      if (assignedEmails.length > 0) {
        const link = `${APP_URL}/requests/${requestId}`
        const html = buildHtml(req, newStatus, link)
        const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
        await sendMail(assignedEmails, `[Air Request] ${subject} — ${req.documentNo}`, html)
        return
      }
    }

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
        if (!dept) return true
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
