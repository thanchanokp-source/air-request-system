import { prisma } from "./prisma"
import { sendMail } from "./email"

const APP_URL = process.env.APP_URL || "http://localhost:3000"

// Format: [ROLE] action — DOC
const STATUS_SUBJECT: Record<string, string> = {
  // NYG
  PENDING_VP_MER:      "[VP MER] รอ Approve",
  PENDING_SCM:         "[SCM User] รอ Assign Claim",
  PENDING_VP_SCM:      "[VP SCM] รอ Approve",
  PENDING_PRESIDENT:   "[President] รอ Approve",
  PENDING_LOGISTICS:   "[Logistics] รอใส่ข้อมูล HAWB",
  PENDING_CLAIM:       "[Claim] รอ Approve",
  PENDING_VP_CLAIM:    "[VP Claim] รอ Approve",
  PENDING_VP_NYK:      "[VP NYK] รอ Approve",
  // GW
  PENDING_VP_MER_GW:   "[DPM – GW] รอ Approve",
  PENDING_DPM_GW:      "[DPM – GW] รอ Approve",
  PENDING_GM_GW:       "[GM – GW] รอ Approve",
  PENDING_PRESIDENT_GW:"[President – GW] รอ Approve",
  PENDING_LOGISTICS_GW:"[Logistics – GW] รอใส่ข้อมูล",
  PENDING_CLAIM_GW:    "[Claim – GW] รอ Approve",
  // Final
  COMPLETED:           "[เสร็จสิ้น] Approve ครบแล้ว",
  REJECTED:            "[Rejected] เอกสารถูก Reject",
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

function buildHtml(req: any, newStatus: string, link: string, approveUrl?: string, rejectUrl?: string, magicLink?: string) {
  const statusLabel: Record<string,string> = {
    PENDING_VP_MER:"Pending VP MER", PENDING_SCM:"Pending SCM", PENDING_VP_SCM:"Pending VP SCM",
    PENDING_PRESIDENT:"Pending President", PENDING_LOGISTICS:"Pending Logistics",
    PENDING_CLAIM:"Pending Claim (DVM)", PENDING_VP_CLAIM:"Pending VP Claim",
    PENDING_VP_NYK:"Pending VP NYK", COMPLETED:"Completed", REJECTED:"Rejected",
  }
  const totalSo = req.items?.length || 0
  const styles = [...new Set((req.items||[]).map((i:any) => i.style).filter(Boolean))].join(", ")

  const openBtn = magicLink
    ? `<a href="${magicLink}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif">เปิดเอกสารในระบบ →</a>`
    : `<a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">เปิดเอกสาร →</a>`

  const buttons = approveUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:16px" colspan="3" align="center">
                ${openBtn}
              </td>
            </tr>
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
    </table>
  ` : `
    <div style="text-align:center;margin-top:24px">
      ${openBtn}
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

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`
  const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
  <tr><td align="center">
    <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <tr><td style="background:#1e3a8a;padding:24px;text-align:center">
        <p style="margin:0;color:#93c5fd;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">Nan Yang Textile</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
      </td></tr>
      <tr><td style="padding:36px">
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 8px">ยืนยัน Email ของคุณ</p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 24px">คลิกปุ่มด้านล่างเพื่อยืนยันตัวตนและเริ่มใช้งานระบบ Air Request</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">ยืนยัน Email →</a>
        </div>
        <p style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;text-align:center;margin:0">Link มีอายุ 24 ชั่วโมง · ถ้าไม่ได้สมัคร กรุณาเพิกเฉยอีเมลนี้</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  await sendMail(email, "[Air Request] ยืนยัน Email เพื่อเริ่มใช้งาน", html)
}

export async function sendPasswordSetupEmail(email: string, name: string, token: string) {
  const link = `${APP_URL}/set-password?token=${token}`
  const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
  <tr><td align="center">
    <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <tr><td style="background:#1e3a8a;padding:24px;text-align:center">
        <p style="margin:0;color:#93c5fd;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">Nan Yang Textile</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
      </td></tr>
      <tr><td style="padding:36px">
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 8px">สวัสดี <strong>${name}</strong></p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 24px">Admin ได้สร้าง Account ในระบบ Air Request ให้คุณแล้ว<br>กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านและเริ่มใช้งาน</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">ตั้งรหัสผ่าน →</a>
        </div>
        <p style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;text-align:center;margin:0">Link มีอายุ 48 ชั่วโมง · ถ้าไม่ได้สมัคร กรุณาเพิกเฉยอีเมลนี้</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
  await sendMail(email, "[Air Request] ตั้งรหัสผ่านเพื่อเริ่มใช้งาน", html)
}

export async function notifyStatusChange(requestId: string, newStatus: string) {
  try {
    const rolesToNotify = STATUS_ROLES[newStatus]

    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: { select: { claimDepartment: true, assignedDvm: true } } }
    })
    if (!req) return

    // For PENDING_VP_MER — send magic link to open in web (no email approve/reject buttons)
    if (newStatus === "PENDING_VP_MER") {
      const assignedEmail = (req as any).assignedVpMer
      const token = (req as any).vpMerToken
      if (!assignedEmail) return
      const link = `${APP_URL}/requests/${requestId}`
      const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
      const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      await sendMail([assignedEmail], `${subject} — ${req.documentNo}`, html)
      return
    }

    // For PENDING_VP_MER_GW — send magic link to open in web (no email approve/reject buttons)
    if (newStatus === "PENDING_VP_MER_GW") {
      const assignedEmail = (req as any).assignedVpMer
      const token = (req as any).vpMerToken
      if (!assignedEmail) return
      const link = `${APP_URL}/requests/${requestId}`
      const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
      const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      await sendMail([assignedEmail], `${subject} — ${req.documentNo}`, html)
      return
    }

    // PENDING_PRESIDENT — send magic link to President
    if (newStatus === "PENDING_PRESIDENT") {
      const presidentUser = await (prisma.user as any).findFirst({ where: { role: "PRESIDENT", isActive: true }, select: { email: true } })
      if (!presidentUser) return
      const token = (req as any).presidentToken
      const link = `${APP_URL}/requests/${req.id}`
      const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
      const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
      await sendMail([presidentUser.email], `[President] รอ Approve — ${(req as any).documentNo}`, html)
      return
    }

    // After President approves (NYG) — notify LOGISTICS + ACCOUNTING only (SCM already notified via PENDING_SCM)
    if (newStatus === "PRESIDENT_APPROVED_NYG") {
      const link = `${APP_URL}/requests/${requestId}`
      const lgToken = (req as any).logisticsToken
      const acToken = (req as any).accountingToken
      const lgMagicLink = lgToken ? `${APP_URL}/api/magic-login?token=${lgToken}&redirect=/approvals` : undefined
      const acMagicLink = acToken ? `${APP_URL}/api/magic-login?token=${acToken}&redirect=/approvals` : undefined
      const lgHtml = buildHtml(req, "PENDING_SCM", link, undefined, undefined, lgMagicLink)
      const acHtml = buildHtml(req, "PENDING_SCM", link, undefined, undefined, acMagicLink)
      const lgUsers = await (prisma.user as any).findMany({ where: { role: "LOGISTICS", isActive: true }, select: { email: true } })
      const acUsers = await (prisma.user as any).findMany({ where: { role: "ACCOUNTING", isActive: true }, select: { email: true } })
      const lgEmails = lgUsers.map((u: any) => u.email).filter(Boolean)
      const acEmails = acUsers.map((u: any) => u.email).filter(Boolean)
      const documentNo = (req as any).documentNo
      if (lgEmails.length) await sendMail(lgEmails, `[Logistics] President Approved — กรุณาเตรียม Booking — ${documentNo}`, lgHtml)
      if (acEmails.length) await sendMail(acEmails, `[Accounting] President Approved (Alert 1) — ${documentNo}`, acHtml)
      return
    }

    // PENDING_SCM — send magic link to SCM user
    if (newStatus === "PENDING_SCM") {
      const scmToken = (req as any).scmToken
      const scmUsers = await (prisma.user as any).findMany({ where: { role: "SCM_USER", isActive: true }, select: { email: true } })
      const scmEmails = scmUsers.map((u: any) => u.email).filter(Boolean)
      if (!scmEmails.length) return
      const link = `${APP_URL}/requests/${requestId}`
      const magicLink = scmToken ? `${APP_URL}/api/magic-login?token=${scmToken}&redirect=/approvals` : undefined
      const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
      await sendMail(scmEmails, `[SCM User] รอ Assign Claim — ${(req as any).documentNo}`, html)
      return
    }

    // SCM assigned specific VP SCM → send magic link to that person
    if (newStatus === "SCM_ASSIGNED_VP_SCM") {
      const assignedEmail = (req as any).assignedVpScm
      if (!assignedEmail) return
      const vpScmToken = (req as any).vpScmToken
      const link = `${APP_URL}/requests/${requestId}`
      const magicLink = vpScmToken ? `${APP_URL}/api/magic-login?token=${vpScmToken}&redirect=/approvals` : undefined
      const html = buildHtml(req, "PENDING_SCM", link, undefined, undefined, magicLink)
      const documentNo = (req as any).documentNo
      await sendMail([assignedEmail], `[VP SCM] SCM ส่งเรื่องให้ Approve — ${documentNo}`, html)
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
      await sendMail(recipients, `${subject} — ${req.documentNo}`, html)
      return
    }

    // For PENDING_CLAIM — send only to assignedDvm per item (if set)
    if (newStatus === "PENDING_CLAIM") {
      const assignedEmails = [...new Set(req.items.map((i:any) => i.assignedDvm).filter(Boolean))]
      if (assignedEmails.length > 0) {
        const link = `${APP_URL}/requests/${requestId}`
        const html = buildHtml(req, newStatus, link)
        const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
        await sendMail(assignedEmails, `${subject} — ${req.documentNo}`, html)
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

    await sendMail(recipients, `${subject} — ${req.documentNo}`, html)
  } catch (err) {
    // Email failure should never break the approval flow
    console.error("[notify] email error:", err)
  }
}

export async function notifyClaimNext(
  requestId: string,
  toEmail: string,
  toName: string,
  fromName: string,
  token: string
) {
  const APP_URL = process.env.APP_URL || "http://localhost:3000"
  try {
    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      select: { documentNo: true, brandName: true, claimDepartment: true, bu: true }
    })
    if (!req) return

    const magicLink = `${APP_URL}/api/magic-login?token=${token}&redirect=/requests/${requestId}`
    const dept = req.claimDepartment || "Claim"
    const subject = `[Claim – ${dept}] รอ Approve — ${req.documentNo}`

    const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
  <tr><td align="center">
    <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <tr><td style="background:#1e3a8a;padding:20px;text-align:center">
        <p style="margin:0;color:#93c5fd;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">Nan Yang Textile</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
      </td></tr>
      <tr><td style="padding:32px 36px">
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 4px">สวัสดีคุณ <strong>${toName}</strong></p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 20px"><strong>${fromName}</strong> ได้ส่งต่อเอกสารให้คุณ Approve</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
          <tr><td style="border-bottom:1px solid #f1f5f9;padding:8px 0">
            <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">DOC NO</span><br>
            <span style="color:#1e3a8a;font-size:15px;font-weight:700;font-family:Arial,sans-serif">${req.documentNo}</span>
          </td></tr>
          <tr><td style="border-bottom:1px solid #f1f5f9;padding:8px 0">
            <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">BRAND</span><br>
            <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${req.brandName}</span>
          </td></tr>
          <tr><td style="padding:8px 0">
            <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">CLAIM DEPT</span><br>
            <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${dept}</span>
          </td></tr>
        </table>
        <div style="text-align:center;margin-top:24px">
          <a href="${magicLink}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">เปิดเอกสาร →</a>
        </div>
        <p style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;text-align:center;margin-top:16px">Link มีอายุ 8 ชั่วโมง</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

    await sendMail(toEmail, subject, html)
  } catch (err) {
    console.error("[notify] claimNext error:", err)
  }
}

export async function notifyClaimFinalToAccounting(requestId: string) {
  try {
    const req = await (prisma.airRequest as any).findUnique({
      where: { id: requestId },
      include: { items: true }
    })
    if (!req) return

    const accountingUsers = await (prisma.user as any).findMany({
      where: { role: "ACCOUNTING", isActive: true },
      select: { email: true }
    })
    const recipients: string[] = accountingUsers.map((u: any) => u.email).filter(Boolean)
    if (!recipients.length) return

    const link = `${APP_URL}/requests/${requestId}`
    const token = req.accountingToken
    const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/requests/${requestId}` : link
    const totalSo = req.items?.length || 0
    const depts = [...new Set((req.items || []).map((i: any) => i.claimDepartment).filter(Boolean))].join(", ")
    const styles = [...new Set((req.items || []).map((i: any) => i.style).filter(Boolean))].join(", ")

    const openBtn = `<a href="${magicLink}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif">เปิดเอกสารในระบบ →</a>`

    const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
  <tr><td align="center">
    <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <tr><td style="background:#1e3a8a;padding:20px;text-align:center">
        <p style="margin:0;color:#93c5fd;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif;text-transform:uppercase">Nan Yang Textile</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
      </td></tr>
      <tr><td style="padding:32px 36px">
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 4px">แผนก <strong>Accounting</strong></p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 24px">เอกสาร Claim ผ่านการ Approve ครบแล้ว — กรุณาดำเนินการต่อ</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="border-bottom:1px solid #f1f5f9;padding:8px 0">
            <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">DOC NO</span><br>
            <span style="color:#1e3a8a;font-size:15px;font-weight:700;font-family:Arial,sans-serif">${req.documentNo}</span>
          </td></tr>
          <tr><td style="border-bottom:1px solid #f1f5f9;padding:8px 0">
            <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">BRAND</span><br>
            <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${req.brandName || "-"}</span>
          </td></tr>
          <tr><td style="border-bottom:1px solid #f1f5f9;padding:8px 0">
            <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">CLAIM DEPT</span><br>
            <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${depts || "-"}</span>
          </td></tr>
          <tr><td style="border-bottom:1px solid #f1f5f9;padding:8px 0">
            <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">STYLE</span><br>
            <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${styles || `${totalSo} SO(s)`}</span>
          </td></tr>
        </table>
        <div style="text-align:center;margin-top:28px">${openBtn}</div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

    await sendMail(recipients, `[Accounting] Claim Approved — ${req.documentNo}`, html)
  } catch (err) {
    console.error("[notify] accounting final error:", err)
  }
}
