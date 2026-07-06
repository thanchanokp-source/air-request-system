import { prisma } from "./prisma"
import { sendMail } from "./email"
import { getSplits } from "./claim"

const APP_URL = process.env.APP_URL || "http://localhost:3000"

// Format: [ROLE] action — DOC
const STATUS_SUBJECT: Record<string, string> = {
  // NYG
  PENDING_VP_MER:      "[VP MER] Pending Approval",
  PENDING_SCM:         "[SCM User] Pending Claim Assignment",
  PENDING_VP_SCM:      "[VP SCM] Pending Approval",
  PENDING_PRESIDENT:   "[President] Pending Approval",
  PENDING_LOGISTICS:   "[Logistics] Pending HAWB Details",
  PENDING_CLAIM:       "[Claim] Pending Approval",
  PENDING_VP_CLAIM:    "[VP Claim] Pending Approval",
  PENDING_VP_NYK:      "[VP NYK] Pending Approval",
  // GW
  PENDING_VP_MER_GW:   "[DPM – GW] Pending Approval",
  PENDING_DPM_GW:      "[DPM – GW] Pending Approval",
  PENDING_GM_GW:       "[GM – GW] Pending Approval",
  PENDING_PRESIDENT_GW:"[President – GW] Pending Approval",
  PENDING_LOGISTICS_GW:"[Logistics – GW] Pending Details",
  PENDING_CLAIM_GW:    "[Claim – GW] Pending Approval",
  // Final
  COMPLETED:           "[Completed] All Approvals Done",
  REJECTED:            "[Rejected] Document Rejected",
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
    // GW
    PENDING_VP_MER_GW:"Pending DPM (GW)", PENDING_GM_GW:"Pending GM (GW)", PENDING_PRESIDENT_GW:"Pending President (GW)",
    PENDING_LOGISTICS_GW:"Pending Logistics (GW)", PENDING_CLAIM_GW:"Pending Claim (GW)",
    PENDING_SCM_GW:"Pending SCM (GW)", PENDING_ACCOUNTING:"Pending Accounting",
  }
  const totalSo = req.items?.length || 0
  const styles = [...new Set((req.items||[]).map((i:any) => i.style).filter(Boolean))].join(", ")

  const openBtn = magicLink
    ? `<a href="${magicLink}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif">Open Document in System →</a>`
    : `<a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Open Document →</a>`

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
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 8px">Verify Your Email</p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 24px">Click the button below to verify your identity and start using the Air Request system.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">Verify Email →</a>
        </div>
        <p style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;text-align:center;margin:0">Link valid for 24 hours · If you did not register, please ignore this email.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  await sendMail(email, "[Air Request] Verify Email to Get Started", html)
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
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 8px">Hello <strong>${name}</strong></p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 24px">An Admin has created an Account for you in the Air Request system.<br>Please click the button below to set your password and get started.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">Set Password →</a>
        </div>
        <p style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;text-align:center;margin:0">Link valid for 48 hours · If you did not register, please ignore this email.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
  await sendMail(email, "[Air Request] Set Your Password to Get Started", html)
}

// Map the claim splits present on a doc → recipient groups. CLAIM_GW is one role
// but split into GW vs SUPPLIER people via User.claimDepartment, so a "GW" claim
// only emails GW-tagged users (not SUPPLIER) and vice-versa.
function gwClaimGroups(depts: Set<string>, req: any): { role: string; label: string; claimDept?: string; token?: string }[] {
  const groups: { role: string; label: string; claimDept?: string; token?: string }[] = []
  // NYK entry point is the APPROVER (EVP + CR user are alerted later, after approve).
  if (depts.has("SCM NYK")) groups.push({ role: "SCM_NYK_APPROVER", label: "SCM NYK", token: (req as any).scmNykApproverToken })
  if (depts.has("SCM NYG")) groups.push({ role: "SCM_NYG", label: "SCM NYG", token: (req as any).scmNygToken })
  if (depts.has("GW")) groups.push({ role: "CLAIM_GW", label: "GW", claimDept: "GW", token: (req as any).claimGwToken })
  if ([...depts].some(d => ["SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"].includes(d))) groups.push({ role: "CLAIM_GW", label: "SUPPLIER", claimDept: "SUPPLIER", token: (req as any).claimGwToken })
  return groups
}

// Magic-link token field for each GW claim role.
const CLAIM_ROLE_TOKEN: Record<string, string> = {
  CLAIM_GW: "claimGwToken",
  SCM_NYG: "scmNygToken",
  SCM_NYK_APPROVER: "scmNykApproverToken",
  SCM_NYK_EVP: "scmNykEvpToken",
  SCM_NYK: "scmNykToken",
}

// Auto-cascade: after a claim approver at priority `afterPriority` approves,
// email the NEXT priority level (the immediate next, not everyone above) of the
// same role/dept so the chain runs to the last priority with NO manual forward.
export async function notifyClaimNextPriority(
  requestId: string,
  role: string,
  claimDept: string | null | undefined,
  afterPriority: number,
  label?: string,
) {
  try {
    const req = await prisma.airRequest.findUnique({ where: { id: requestId } })
    if (!req) return
    const where: any = { role, isActive: true, bu: (req as any).bu, priority: { gt: afterPriority } }
    if (claimDept) where.claimDepartment = claimDept
    const higher = await (prisma.user as any).findMany({
      where, select: { email: true, priority: true }, orderBy: { priority: "asc" },
    })
    if (!higher.length) return // this was the last priority — chain complete
    const nextP = higher[0].priority
    const recipients = higher.filter((u: any) => u.priority === nextP).map((u: any) => u.email).filter(Boolean)
    if (!recipients.length) return
    const link = `${APP_URL}/requests/${requestId}`
    const tokenField = CLAIM_ROLE_TOKEN[role]
    const token = tokenField ? (req as any)[tokenField] : null
    const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
    const html = buildHtml(req, "PENDING_CLAIM_GW", link, undefined, undefined, magicLink)
    const tag = label || claimDept || "Claim"
    await sendMail(recipients, `[Claim – ${tag}] Pending Approval (Priority ${nextP}) — ${(req as any).documentNo}`, html)
  } catch (err) {
    console.error("[notify] next-priority cascade error:", err)
  }
}

export async function notifyStatusChange(requestId: string, newStatus: string) {
  try {
    const rolesToNotify = STATUS_ROLES[newStatus]

    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: { select: { claimDepartment: true, claimDepts: true, assignedDvm: true } } }
    })
    if (!req) return

    // NYK APPROVER approved → alert SCM_NYK_EVP (approve) + SCM_NYK (enter CR) in
    // parallel, including the LG data (INV / HAWB / Actual) for context.
    if (newStatus === "NYK_APPROVER_DONE") {
      const items = await prisma.airRequestItem.findMany({
        where: { requestId, itemStatus: { not: "REJECTED" } },
        select: { so: true, invoiceNo: true, hawbNo: true, actualAirFreight: true, claimDepts: true, claimDepartment: true, claimPercentage: true }
      })
      const nykItems = items.filter((i: any) => getSplits(i).some(s => s.dept === "SCM NYK" || s.dept === "NYK"))
      if (nykItems.length === 0) return
      const link = `${APP_URL}/requests/${requestId}`
      const rows = nykItems.map((i: any) => {
        const nyk = getSplits(i).find(s => s.dept === "SCM NYK" || s.dept === "NYK")
        const actual = i.actualAirFreight ?? 0
        const amt = nyk ? Math.round(actual * (Number(nyk.pct) || 0) / 100 * 100) / 100 : 0
        const cell = (v: any, right = false) => `<td style="padding:6px 10px;border-bottom:1px solid #eee${right ? ";text-align:right" : ""}">${v}</td>`
        return `<tr>${cell(i.so)}${cell(i.invoiceNo || "-")}${cell(i.hawbNo || "-")}${cell(actual.toLocaleString(), true)}${cell(amt.toLocaleString(), true)}</tr>`
      }).join("")
      const lgTable = `<table style="border-collapse:collapse;width:100%;font-size:12px;font-family:Arial;margin-top:12px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:6px 10px;text-align:left">SO</th><th style="padding:6px 10px;text-align:left">INV NO.</th><th style="padding:6px 10px;text-align:left">HAWB#</th><th style="padding:6px 10px;text-align:right">Actual Air (THB)</th><th style="padding:6px 10px;text-align:right">NYK Claim (THB)</th>
        </tr></thead><tbody>${rows}</tbody></table>`
      const sendNyk = async (role: string, tokenField: string, subject: string, intro: string, assignedEmail?: string | null) => {
        // Prefer the specific person the Approver chose; else fall back to role.
        let emails: string[]
        if (assignedEmail) {
          emails = [assignedEmail]
        } else {
          const users = await (prisma.user as any).findMany({ where: { role, isActive: true, bu: (req as any).bu }, select: { email: true } })
          emails = users.map((u: any) => u.email).filter(Boolean)
        }
        if (!emails.length) return
        const token = (req as any)[tokenField]
        const magic = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : link
        const html = `<div style="font-family:Arial;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
          <p style="font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin:0">Nan Yang Textile · Air Request</p>
          <h2 style="font-size:18px;margin:6px 0 2px">${(req as any).documentNo}</h2>
          <p style="font-size:13px;color:#334155;margin:8px 0">${intro}</p>
          ${lgTable}
          <div style="text-align:center;margin-top:20px"><a href="${magic}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700">Open Document →</a></div>
        </div>`
        await sendMail(emails, `${subject} — ${(req as any).documentNo}`, html)
      }
      await sendNyk("SCM_NYK_EVP", "scmNykEvpToken", "[Claim – SCM NYK EVP] Pending Approval", "The SCM NYK Approver has approved. Please review and approve.", (req as any).assignedScmNykEvp)
      await sendNyk("SCM_NYK", "scmNykToken", "[Claim – SCM NYK] Please enter CR NO", "The SCM NYK Approver has approved. Please enter the CR NO for this document.", (req as any).assignedScmNykCr)
      return
    }

    // Claim dept rejected an SO → alert MER (GW) to re-select the claim department.
    if (newStatus === "CLAIM_REJECTED_GW") {
      const rejItems = await prisma.airRequestItem.findMany({ where: { requestId, itemStatus: "CLAIM_REJECT_GW" }, select: { so: true, itemComment: true } })
      const merUsers = await (prisma.user as any).findMany({ where: { role: "MER_GW", isActive: true }, select: { email: true } })
      const emails = merUsers.map((u: any) => u.email).filter(Boolean)
      const creator = await (prisma.user as any).findUnique({ where: { id: (req as any).createdById }, select: { email: true } })
      if (creator?.email) emails.push(creator.email)
      const recipients = [...new Set(emails)] as string[]
      if (!recipients.length) return
      const link = `${APP_URL}/requests/${requestId}`
      const rows = rejItems.map((i: any) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.so}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.itemComment || "-"}</td></tr>`).join("")
      const html = `<div style="font-family:Arial;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
        <p style="font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin:0">Nan Yang Textile · Air Request</p>
        <h2 style="font-size:18px;margin:6px 0 2px">${(req as any).documentNo}</h2>
        <p style="font-size:13px;color:#b91c1c;margin:8px 0;font-weight:600">A claim department has rejected the claim. Please re-select the claim department for the following SO(s):</p>
        <table style="border-collapse:collapse;width:100%;font-size:12px;font-family:Arial"><thead><tr style="background:#fef2f2"><th style="padding:6px 10px;text-align:left">SO</th><th style="padding:6px 10px;text-align:left">Reason</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="text-align:center;margin-top:20px"><a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700">Open Document →</a></div>
      </div>`
      await sendMail(recipients, `[MER – GW] Claim Rejected — please re-assign — ${(req as any).documentNo}`, html)
      return
    }

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

    // PENDING_GM_GW — notify all GM (GW) approvers with a magic link (reuses vpMerToken;
    // authorize resolves it to a GM session while the doc is at PENDING_GM_GW)
    if (newStatus === "PENDING_GM_GW") {
      const gmUsers = await (prisma.user as any).findMany({ where: { role: "GM_GW", isActive: true }, select: { email: true } })
      const recipients = gmUsers.map((u: any) => u.email).filter(Boolean)
      console.log(`[notify] PENDING_GM_GW → GM_GW active recipients: ${recipients.length ? recipients.join(", ") : "NONE (no active GM_GW user)"}`)
      if (!recipients.length) return
      const link = `${APP_URL}/requests/${requestId}`
      const token = (req as any).gmToken
      const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
      const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      await sendMail(recipients, `${subject} — ${req.documentNo}`, html)
      return
    }

    // PENDING_PRESIDENT_GW — magic link to President (GW)
    if (newStatus === "PENDING_PRESIDENT_GW") {
      const users = await (prisma.user as any).findMany({ where: { role: "PRESIDENT_GW", isActive: true }, select: { email: true } })
      const recipients = users.map((u: any) => u.email).filter(Boolean)
      console.log(`[notify] PENDING_PRESIDENT_GW → PRESIDENT_GW active recipients: ${recipients.length ? recipients.join(", ") : "NONE (no active PRESIDENT_GW user)"}`)
      if (!recipients.length) return
      const link = `${APP_URL}/requests/${requestId}`
      const token = (req as any).presidentToken
      const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
      const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      await sendMail(recipients, `${subject} — ${req.documentNo}`, html)
      return
    }

    // PENDING_LOGISTICS_GW (after President approves) — Logistics ∥ Claim run in parallel.
    // Notify 3 groups: Logistics (booking), Claim departments (per split), Accounting (read alert).
    if (newStatus === "PENDING_LOGISTICS_GW") {
      const link = `${APP_URL}/requests/${requestId}`
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      // 1) Logistics GW
      const lgUsers = await (prisma.user as any).findMany({ where: { role: "LOGISTICS_GW", isActive: true }, select: { email: true } })
      const lgEmails = lgUsers.map((u: any) => u.email).filter(Boolean)
      if (lgEmails.length) {
        const t = (req as any).logisticsToken
        const ml = t ? `${APP_URL}/api/magic-login?token=${t}&redirect=/approvals` : undefined
        await sendMail(lgEmails, `[Logistics – GW] President Approved — Please prepare Booking — ${req.documentNo}`, buildHtml(req, newStatus, link, undefined, undefined, ml))
      }
      // 2) Claim departments (parallel) — per-dept recipients (GW≠SUPPLIER)
      const depts = new Set<string>()
      for (const it of req.items) getSplits(it).forEach(s => depts.add(s.dept))
      for (const g of gwClaimGroups(depts, req)) {
        const where: any = { role: g.role, isActive: true, bu: (req as any).bu }
        if (g.claimDept) where.claimDepartment = g.claimDept
        const us = await (prisma.user as any).findMany({ where, select: { email: true, priority: true }, orderBy: { priority: "asc" } })
        // Priority chain: alert only priority 1; approvals cascade upward.
        const usP = us.filter((u: any) => u.priority != null)
        const firstUs = usP.length ? usP.filter((u: any) => u.priority === usP[0].priority) : us
        const em = firstUs.map((u: any) => u.email).filter(Boolean)
        if (!em.length) continue
        const ml = g.token ? `${APP_URL}/api/magic-login?token=${g.token}&redirect=/approvals` : undefined
        await sendMail(em, `[Claim – ${g.label}] President Approved — Pending Claim — ${req.documentNo}`, buildHtml(req, "PENDING_CLAIM_GW", link, undefined, undefined, ml))
      }
      // 3) Accounting (read alert) — GW uses ACCOUNTING_GW; cover both role names.
      const acUsers = await (prisma.user as any).findMany({ where: { role: { in: ["ACCOUNTING", "ACCOUNTING_GW"] }, isActive: true }, select: { email: true } })
      const acEmails = acUsers.map((u: any) => u.email).filter(Boolean)
      if (acEmails.length) {
        const t = (req as any).accountingToken
        const ml = t ? `${APP_URL}/api/magic-login?token=${t}&redirect=/requests/${requestId}` : undefined
        await sendMail(acEmails, `[Accounting – GW] President Approved (Alert) — ${req.documentNo}`, buildHtml(req, newStatus, link, undefined, undefined, ml))
      }
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
      await sendMail([presidentUser.email], `[President] Pending Approval — ${(req as any).documentNo}`, html)
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
      if (lgEmails.length) await sendMail(lgEmails, `[Logistics] President Approved — Please prepare Booking — ${documentNo}`, lgHtml)
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
      await sendMail(scmEmails, `[SCM User] Pending Claim Assignment — ${(req as any).documentNo}`, html)
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
      await sendMail([assignedEmail], `[VP SCM] SCM submitted for Approval — ${documentNo}`, html)
      return
    }

    // For PENDING_CLAIM_GW — parallel per-dept: notify every claim role that has
    // a split on this doc (CLAIM_GW for GW/SUPPLIER, SCM_NYK for NYK, SCM_NYG for NYG).
    if (newStatus === "PENDING_CLAIM_GW") {
      const depts = new Set<string>()
      for (const it of req.items) getSplits(it).forEach(s => depts.add(s.dept))
      const groups = gwClaimGroups(depts, req)
      if (groups.length === 0) return
      const link = `${APP_URL}/requests/${requestId}`
      // Each group = a claim dept's people (GW≠SUPPLIER via claimDepartment).
      for (const g of groups) {
        const where: any = { role: g.role, isActive: true, bu: (req as any).bu }
        if (g.claimDept) where.claimDepartment = g.claimDept
        const users = await (prisma.user as any).findMany({ where, select: { email: true, priority: true }, orderBy: { priority: "asc" } })
        // Priority chain: alert only the LOWEST priority first; each approval
        // auto-cascades to the next priority (notifyClaimNextPriority).
        const withP = users.filter((u: any) => u.priority != null)
        const firstBatch = withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : users
        const recipients = firstBatch.map((u: any) => u.email).filter(Boolean)
        if (!recipients.length) continue
        const magicLink = g.token ? `${APP_URL}/api/magic-login?token=${g.token}&redirect=/approvals` : undefined
        const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
        await sendMail(recipients, `[Claim – ${g.label}] Pending Approval — ${req.documentNo}`, html)
      }
      return
    }

    // For PENDING_ACCOUNTING — all departments approved; notify Accounting (read-only).
    if (newStatus === "PENDING_ACCOUNTING") {
      await notifyClaimFinalToAccounting(requestId)
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
  token: string,
  deptOverride?: string | null
) {
  const APP_URL = process.env.APP_URL || "http://localhost:3000"
  try {
    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      select: { documentNo: true, brandName: true, claimDepartment: true, bu: true }
    })
    if (!req) return

    const magicLink = `${APP_URL}/api/magic-login?token=${token}&redirect=/requests/${requestId}`
    const dept = deptOverride || req.claimDepartment || "Claim"
    const subject = `[Claim – ${dept}] Pending Approval — ${req.documentNo}`

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
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 4px">Hello <strong>${toName}</strong></p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 20px"><strong>${fromName}</strong> has forwarded a document for your Approval.</p>
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
          <a href="${magicLink}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;font-family:Arial,sans-serif">Open Document →</a>
        </div>
        <p style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;text-align:center;margin-top:16px">Link valid for 8 hours</p>
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
      where: { role: { in: ["ACCOUNTING", "ACCOUNTING_GW"] }, isActive: true },
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

    const openBtn = `<a href="${magicLink}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif">Open Document in System →</a>`

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
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 4px"><strong>Accounting</strong> Department</p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 24px">The Claim document has been fully Approved — please proceed.</p>
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
