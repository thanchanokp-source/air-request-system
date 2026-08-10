import { prisma } from "./prisma"
import { sendMail } from "./email"
import { getSplits, claimEntryRoles, claimVpRoles, vpProdGroup, prodGroupCovers } from "./claim"
import { supabase, BUCKET } from "./supabase-storage"
import { MASTER_EDITOR_EMAILS } from "./master-access"
import { runWithTestMail } from "./test-ctx"
import { randomUUID } from "crypto"

// For a TEST document (isTest), all its emails reroute to the admin who created it. Returns that
// admin's email, else null (real doc → normal recipients).
async function docTestRecipient(requestId: string): Promise<string | null> {
  const r = await (prisma.airRequest as any).findUnique({
    where: { id: requestId }, select: { isTest: true, createdBy: { select: { email: true } } } as any,
  }).catch(() => null)
  return r?.isTest ? (r.createdBy?.email ?? null) : null
}

const APP_URL = process.env.APP_URL || "http://localhost:3000"

// Personal magic-login link for a user. REUSES the existing loginToken while it's still
// valid instead of minting a new one each time — otherwise a later notify would rotate the
// per-user token and silently invalidate every earlier email link (e.g. LG reopening the
// link after entering Actual would be forced to log in). New token only if missing/expired.
async function getLoginToken(uid: string): Promise<string | null> {
  try {
    const u = await (prisma.user as any).findUnique({ where: { id: uid }, select: { loginToken: true, loginTokenExpiry: true } })
    const valid = u?.loginToken && u?.loginTokenExpiry && new Date(u.loginTokenExpiry).getTime() > Date.now()
    if (valid) return u.loginToken
    const token = randomUUID()
    await (prisma.user as any).update({ where: { id: uid }, data: { loginToken: token, loginTokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })
    return token
  } catch { return null }
}
async function magicLoginFor(uid: string, redirect = "/approvals"): Promise<string> {
  const token = await getLoginToken(uid)
  return `${APP_URL}/api/magic-login?token=${token}&redirect=${encodeURIComponent(redirect)}`
}

// Read-only FYI recipients CC'd on the SCM NYK claim step (both BU). They are informed
// only — no approval action. Edit this list to add/remove FYI watchers.
const NYK_CLAIM_READONLY_CC = ["patchareewan.a@nanyangtextile.com", "stacy.h@nanyangtextile.com"]

// Format: [ROLE] action — DOC
const STATUS_SUBJECT: Record<string, string> = {
  // NYG
  PENDING_DVM_MER:     "[DVM Merchandise] Pending Approval",
  PENDING_VP_MER:      "[VP Merchandise] Pending Approval",
  PENDING_SCM:         "[SCM User] Pending Claim Assignment",
  PENDING_VP_SCM:      "[VP SCM] Pending Approval",
  PENDING_PRESIDENT:   "[President] Pending Approval",
  PENDING_LOGISTICS:   "[Logistics] Pending HAWB Details",
  PENDING_CLAIM:       "[Claim] Pending Approval",
  PENDING_VP_CLAIM:    "[VP Claim] Pending Approval",
  PENDING_DVM_MER_EA:  "[ADVM – EA] Pending Approval",
  PENDING_VP_MER_EA:   "[DVM – EA] Pending Approval",
  PENDING_DVM_MER_TRM: "[DVM – TRM] Pending Approval",
  PENDING_VP_MER_TRM:  "[VP – TRM] Pending Approval",
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
  PENDING_DVM_MER:      ["DVM_MER"],
  PENDING_VP_MER:       ["VP_MER"],
  PENDING_DVM_MER_EA:   ["DVM_MER_EA"],
  PENDING_VP_MER_EA:    ["VP_MER_EA"],
  PENDING_DVM_MER_TRM:  ["DVM_MER_TRM"],
  PENDING_VP_MER_TRM:   ["VP_MER_TRM"],
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
  // PENDING_CLAIM_GW handled by its own block (SCM NYK / SCM NYG only —
  // GW + SUPPLIER auto-approve, no alert). No generic CLAIM_GW notify.
}

// Extract claim dept from role string
const deptFromRole = (r: string) =>
  r.startsWith("DVM_") ? r.replace("DVM_","") :
  r.startsWith("CLAIM_") ? r.replace("CLAIM_","") :
  ["VP_COMMERCIAL","VP_PROCUREMENT","VP_NYK","VP_PRODUCTION"].includes(r) ? r.replace("VP_","") : null

// Bulletproof button — renders identically on Outlook Desktop (VML), Outlook Web,
// and mobile. line-height (not padding) centers text so no engine breaks it.
function emailButton(url: string, label: string, bg: string, width = 240): string {
  return `
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:44px;v-text-anchor:middle;width:${width}px;" arcsize="18%" strokecolor="${bg}" fillcolor="${bg}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${label}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${url}" style="background-color:${bg};border-radius:8px;color:#ffffff;display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;line-height:44px;height:44px;text-align:center;text-decoration:none;width:${width}px;-webkit-text-size-adjust:none;mso-hide:all;">${label}</a>
<!--<![endif]-->`
}

// Always-available manual login link (public /login page — never expires, no token).
const loginLinkBlock = () => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td align="center"><p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Or log in to the system with your account</p><a href="${APP_URL}/login" style="color:#1e3a8a;font-size:12px;font-weight:600;font-family:Arial,sans-serif;text-decoration:underline">${APP_URL}/login</a></td></tr></table>`

// Shared <head> — charset, mobile viewport, and MSO fixes (DPI, table spacing).
const EMAIL_HEAD = `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  body{margin:0!important;padding:0!important;width:100%!important;background-color:#f1f5f9}
  @media only screen and (max-width:480px){.email-card{width:100%!important}}
</style>
</head>`

// All distinct brands on the document (one doc can span several brands) → comma-joined for email.
const docBrands = (req: any) => {
  const bs = [...new Set((req?.items || []).map((i: any) => i.brand).filter(Boolean))]
  return bs.length ? bs.join(", ") : (req?.brandName || "-")
}

function buildHtml(req: any, newStatus: string, link: string, approveUrl?: string, rejectUrl?: string, magicLink?: string, statusOverride?: string) {
  const statusLabel: Record<string,string> = {
    PENDING_DVM_MER:"Pending DVM Merchandise",
    // EA merch stages (backend roles DVM_MER_EA/VP_MER_EA; shown as ADVM → DVM)
    PENDING_DVM_MER_EA:"Pending ADVM (EA)", PENDING_VP_MER_EA:"Pending DVM (EA)",
    PENDING_DVM_MER_TRM:"Pending DVM (TRM)", PENDING_VP_MER_TRM:"Pending VP (TRM)",
    PENDING_VP_MER:"Pending VP Merchandise", PENDING_SCM:"Pending SCM", PENDING_VP_SCM:"Pending VP SCM",
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

  const openBtn = emailButton(magicLink || link, magicLink ? "Open Document in System →" : "Open Document →", "#1e3a8a", 240)

  const buttons = approveUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px">
      <tr><td align="center" style="padding-bottom:16px">${openBtn}</td></tr>
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:8px">${emailButton(rejectUrl || link, "REJECT", "#ef4444", 120)}</td>
          <td style="padding-left:8px">${emailButton(approveUrl, "APPROVE", "#22c55e", 120)}</td>
        </tr></table>
      </td></tr>
    </table>
  ` : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">${openBtn}</td></tr></table>
  `

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
${EMAIL_HEAD}
<body style="margin:0;padding:0;background-color:#f1f5f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0">
    <tr>
      <td align="center">
        <table role="presentation" class="email-card" width="440" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;max-width:440px">
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
                    <span style="color:#1e3a8a;font-size:15px;font-weight:700;font-family:Arial,sans-serif">${req.documentNo}</span>${(req as any).revised ? `<span style="display:inline-block;margin-left:8px;background:#fef3c7;color:#b45309;font-size:10px;font-weight:800;letter-spacing:1px;padding:2px 8px;border-radius:6px;font-family:Arial,sans-serif;vertical-align:middle">↻ REVISE</span>` : ""}
                  </td>
                </tr>
                <tr>
                  <td style="border-bottom:1px solid #f1f5f9;padding:10px 0">
                    <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">BRAND</span><br>
                    <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${docBrands(req)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="border-bottom:1px solid #f1f5f9;padding:10px 0">
                    <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">STATUS</span><br>
                    <span style="color:#1d4ed8;font-size:14px;font-weight:600;font-family:Arial,sans-serif">${statusOverride || statusLabel[newStatus] || newStatus}</span>
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
              ${loginLinkBlock()}
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

// Passwordless login link — user requested to log in; one-time link (30 min).
export async function sendLoginLinkEmail(email: string, name: string, token: string) {
  const link = `${APP_URL}/api/magic-login?token=${token}&redirect=/dashboard`
  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
${EMAIL_HEAD}
<body style="margin:0;padding:0;background-color:#f1f5f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0"><tr><td align="center">
    <table role="presentation" class="email-card" width="440" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;max-width:440px">
      <tr><td style="background:#1e3a8a;padding:24px;text-align:center">
        <p style="margin:0;color:#93c5fd;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">Nan Yang Textile</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
      </td></tr>
      <tr><td style="padding:32px 36px">
        <p style="color:#1e293b;font-size:15px;font-family:Arial,sans-serif;margin:0 0 4px">Hello <strong>${name}</strong></p>
        <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 20px">Click below to log in to the Air Request system. No password needed.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">${emailButton(link, "Log in →", "#1e3a8a", 240)}</td></tr></table>
        <p style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;text-align:center;margin:16px 0 0">Link valid for 30 minutes · If you did not request this, please ignore.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
  await sendMail(email, "Your Air Request login link", html)
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
        ${loginLinkBlock()}
        <p style="color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;text-align:center;margin:16px 0 0">Link valid for 24 hours · If you did not register, please ignore this email.</p>
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

// SCM NYK claims only after Logistics has entered INV + Actual air for every NYK SO — the claim
// amount = Actual × %, so NYK can't act before those numbers exist. Alert is held until then.
function nykLgReady(req: any): boolean {
  const nyk = (req.items || []).filter((i: any) => i.itemStatus !== "REJECTED" && getSplits(i).some((s: any) => s.dept === "SCM NYK" || s.dept === "NYK"))
  return nyk.length > 0 && nyk.every((i: any) => i.invoiceNo && i.actualAirFreight != null)
}

// Map the claim splits present on a doc → recipient groups. Only SCM NYK / SCM NYG
// get alerted — GW + SUPPLIER claims are auto-approved (no approval, no email).
function gwClaimGroups(depts: Set<string>, req: any): { role: string; label: string; claimDept?: string; token?: string }[] {
  const groups: { role: string; label: string; claimDept?: string; token?: string }[] = []
  // NYK entry point is the APPROVER (EVP + CR user are alerted later, after approve).
  // Accept both the canonical "SCM NYK" and the short "NYK" (defensive — depends on import path).
  if (depts.has("SCM NYK") || depts.has("NYK")) groups.push({ role: "SCM_NYK_APPROVER", label: "SCM NYK", token: (req as any).scmNykApproverToken })
  if (depts.has("SCM NYG") || depts.has("NYG")) groups.push({ role: "SCM_NYG", label: "SCM NYG", token: (req as any).scmNygToken })
  // GW + SUPPLIER need NO approval (auto-approved) → do NOT alert / create groups for
  // them. Only SCM NYK / SCM NYG approve.
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

// SCM NYK has 2 approvers who split work BY BRAND. Their alert shows the doc's
// brand(s) so each recognises the ones they own, and BOTH are alerted in parallel
// (first to approve locks the other — see approve route).
function nykBrandLabel(req: any): string {
  const brands = [...new Set((req.items || []).map((i: any) => i.brand).filter(Boolean))]
  return brands.length ? brands.join(", ") : (req.brandName || "-")
}

// Admin resend: send the document summary directly to ONE typed email (any person), using the
// given status for the header/subject. No magic link — read-only view.
export async function notifyDocToEmail(requestId: string, email: string, status: string): Promise<number> {
  try {
    if (!email.includes("@")) return 0
    const req: any = await prisma.airRequest.findUnique({ where: { id: requestId }, include: { items: true } })
    if (!req) return 0
    const link = `${APP_URL}/requests/${requestId}`
    const label = STATUS_SUBJECT[status] || status
    await sendMail([email.trim()], `${label} — ${req.documentNo}`, buildHtml(req, status, link))
    return 1
  } catch (e) { console.error("[notify] doc-to-email failed:", e); return 0 }
}

// Re-send the GW claim notification to ONLY the SCM NYK approvers (the other roles were already
// notified). Cross-BU: no bu filter. Each approver gets their own ?as= magic link.
export async function notifyGwClaimNyk(requestId: string): Promise<number> {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyGwClaimNykImpl(requestId))
}
async function notifyGwClaimNykImpl(requestId: string): Promise<number> {
  try {
    const req: any = await prisma.airRequest.findUnique({ where: { id: requestId }, include: { items: true } })
    if (!req) return 0
    const depts = new Set<string>()
    for (const it of req.items) getSplits(it).forEach((s: any) => depts.add(s.dept))
    if (!depts.has("SCM NYK") && !depts.has("NYK")) return 0
    // Only once Logistics has filled INV + Actual air for the NYK SOs.
    if (!nykLgReady(req)) return 0
    const users = await (prisma.user as any).findMany({
      where: { isActive: true, OR: [{ role: "SCM_NYK_APPROVER" }, { roles: { has: "SCM_NYK_APPROVER" } }] },
      select: { email: true },
    })
    const link = `${APP_URL}/requests/${requestId}`
    const token = (req as any).scmNykApproverToken
    const subj = `[Claim – SCM NYK] Pending Approval — Brand: ${nykBrandLabel(req)} — ${req.documentNo}`
    let sent = 0
    for (const u of users) {
      if (!u.email) continue
      const perLink = token ? `${APP_URL}/api/magic-login?token=${token}&as=${encodeURIComponent(u.email)}&redirect=/approvals` : undefined
      await sendMail(u.email, subj, buildHtml(req, "PENDING_CLAIM_GW", link, undefined, undefined, perLink))
      sent++
    }
    return sent
  } catch (e) { console.error("[notify] resend NYK failed:", e); return 0 }
}

// Auto-cascade: after a claim approver at priority `afterPriority` approves,
// email the NEXT priority level (the immediate next, not everyone above) of the
// same role/dept so the chain runs to the last priority with NO manual forward.
export async function notifyClaimNextPriority(
  requestId: string, role: string | string[], claimDept: string | null | undefined, afterPriority: number, label?: string,
) {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyClaimNextPriorityImpl(requestId, role, claimDept, afterPriority, label))
}
async function notifyClaimNextPriorityImpl(
  requestId: string,
  role: string | string[],
  claimDept: string | null | undefined,
  afterPriority: number,
  label?: string,
) {
  try {
    const req = await prisma.airRequest.findUnique({ where: { id: requestId } })
    if (!req) return
    const roleList = Array.isArray(role) ? role : [role]
    // Multi-role aware: match the primary role OR any role in roles[].
    const where: any = {
      // Cross-BU claim roles (e.g. Claim-Production, VP-Production) have bu = "ALL".
      isActive: true, bu: { in: [(req as any).bu, "ALL"] }, priority: { gt: afterPriority },
      OR: [{ role: { in: roleList } }, { roles: { hasSome: roleList } }],
    }
    if (claimDept) where.claimDepartment = claimDept
    const higher = await (prisma.user as any).findMany({
      where, select: { email: true, priority: true }, orderBy: { priority: "asc" },
    })
    if (!higher.length) return // this was the last priority — chain complete
    const nextP = higher[0].priority
    const recipients = higher.filter((u: any) => u.priority === nextP).map((u: any) => u.email).filter(Boolean)
    if (!recipients.length) return
    const link = `${APP_URL}/requests/${requestId}`
    const tokenField = CLAIM_ROLE_TOKEN[roleList[0]]
    const token = tokenField ? (req as any)[tokenField] : null
    const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
    const html = buildHtml(req, "PENDING_CLAIM_GW", link, undefined, undefined, magicLink)
    const tag = label || claimDept || "Claim"
    await sendMail(recipients, `[Claim – ${tag}] Pending Approval (Priority ${nextP}) — ${(req as any).documentNo}`, html)
  } catch (err) {
    console.error("[notify] next-priority cascade error:", err)
  }
}

// Public entry — reroute to the doc's admin if it's a TEST doc, then run the real notifier.
export async function notifyStatusChange(requestId: string, newStatus: string) {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyStatusChangeImpl(requestId, newStatus))
}

async function notifyStatusChangeImpl(requestId: string, newStatus: string) {
  try {
    const rolesToNotify = STATUS_ROLES[newStatus]

    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: { select: { id: true, so: true, brand: true, factory: true, claimDepartment: true, claimDepts: true, assignedDvm: true, itemStatus: true } } }
    })
    if (!req) return

    // NYK APPROVER approved → alert SCM_NYK_EVP (approve) + SCM_NYK (enter CR) in
    // parallel, including the LG data (INV / HAWB / Actual) for context.
    if (newStatus === "NYK_APPROVER_DONE") {
      const items = await prisma.airRequestItem.findMany({
        where: { requestId, itemStatus: { not: "REJECTED" } },
        select: { so: true, brand: true, invoiceNo: true, hawbNo: true, actualAirFreight: true, claimDepts: true, claimDepartment: true, claimPercentage: true }
      })
      const nykItems = items.filter((i: any) => getSplits(i).some(s => s.dept === "SCM NYK" || s.dept === "NYK"))
      if (nykItems.length === 0) return
      const nykBrands = [...new Set(nykItems.map((i: any) => i.brand).filter(Boolean))].join(", ")
      const brandTag = nykBrands ? ` [${nykBrands}]` : ""
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
          const users = await (prisma.user as any).findMany({ where: { role, isActive: true, bu: { in: [(req as any).bu, "ALL"] } }, select: { email: true } })
          emails = users.map((u: any) => u.email).filter(Boolean)
        }
        if (!emails.length) return
        const token = (req as any)[tokenField]
        const magic = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : link
        const html = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0"><tr><td align="center">
  <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#1e3a8a;padding:20px;text-align:center">
      <p style="margin:0;color:#93c5fd;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif;text-transform:uppercase">Nan Yang Textile</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="color:#1e3a8a;font-size:15px;font-weight:700;font-family:Arial,sans-serif;margin:0 0 4px">${(req as any).documentNo}</p>
      <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 14px">${intro}</p>
      ${lgTable}
      <div style="text-align:center;margin-top:22px">${emailButton(magic, "Open Document →", "#1e3a8a")}</div>
      ${loginLinkBlock()}
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p></td></tr>
  </table>
</td></tr></table></body></html>`
        await sendMail(emails, `${subject} — ${(req as any).documentNo}`, html)
      }
      await sendNyk("SCM_NYK_EVP", "scmNykEvpToken", `[Claim – NYK EVP]${brandTag} Pending Approval`, "The NYK Approver has approved. Please review and approve.", (req as any).assignedScmNykEvp)
      await sendNyk("SCM_NYK", "scmNykToken", `[Claim – NYK]${brandTag} Please enter CR NO`, "The NYK Approver has approved. Please enter the CR NO for this document.", (req as any).assignedScmNykCr)
      // Read-only FYI copy — CC watchers who are informed but take NO action (both BU).
      if (NYK_CLAIM_READONLY_CC.length) {
        const fyiHtml = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0"><tr><td align="center">
  <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#475569;padding:20px;text-align:center">
      <p style="margin:0;color:#cbd5e1;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif;text-transform:uppercase">Nan Yang Textile · FYI</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="color:#1e3a8a;font-size:15px;font-weight:700;font-family:Arial,sans-serif;margin:0 0 4px">${(req as any).documentNo}</p>
      <p style="color:#64748b;font-size:13px;font-family:Arial,sans-serif;margin:0 0 4px">📄 <b>FYI (read only)</b> — SCM NYK claim reached. No action needed from you.</p>
      ${lgTable}
      <div style="text-align:center;margin-top:22px">${emailButton(link, "View Document →", "#475569")}</div>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p></td></tr>
  </table>
</td></tr></table></body></html>`
        await sendMail(NYK_CLAIM_READONLY_CC, `[Claim – NYK · FYI]${brandTag} ${(req as any).documentNo}`, fyiHtml).catch(() => {})
      }
      return
    }

    // Claim dept rejected an SO → alert MER (GW) to re-select the claim department.
    if (newStatus === "CLAIM_REJECTED_GW") {
      const rejItems = await prisma.airRequestItem.findMany({ where: { requestId, itemStatus: "CLAIM_REJECT_GW" }, select: { so: true, itemComment: true } })
      const isImport = !!(req as any).nykDirect
      // Import (NYK Direct) docs skip Merchandise → there is no MER uploader to re-assign the claim.
      // ONLY these go to the admins + Jariya. Normal GW docs still go back to Merchandise (MER_GW).
      const emails: string[] = []
      if (isImport) {
        const admins = await (prisma.user as any).findMany({ where: { role: "ADMIN", isActive: true }, select: { email: true } })
        admins.forEach((u: any) => u.email && emails.push(u.email))
        emails.push("jariya.t@nanyangtextile.com")
      } else {
        const merUsers = await (prisma.user as any).findMany({ where: { role: "MER_GW", isActive: true }, select: { email: true } })
        merUsers.forEach((u: any) => u.email && emails.push(u.email))
        const creator = await (prisma.user as any).findUnique({ where: { id: (req as any).createdById }, select: { email: true } })
        if (creator?.email) emails.push(creator.email)
      }
      const recipients = [...new Set(emails)] as string[]
      if (!recipients.length) return
      const link = `${APP_URL}/requests/${requestId}`
      const rows = rejItems.map((i: any) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.so}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.itemComment || "-"}</td></tr>`).join("")
      const html = `<div style="font-family:Arial;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
        <p style="font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin:0">Nan Yang Textile · Air Request</p>
        <h2 style="font-size:18px;margin:6px 0 2px">${(req as any).documentNo}</h2>
        <p style="font-size:13px;color:#b91c1c;margin:8px 0;font-weight:600">${isImport ? "SCM NYK has rejected this <b>imported (NYK Direct)</b> document. This document has no Merchandise step — <b>admin</b> please review and re-import / fix the following SO(s):" : "A claim department has rejected the claim. Please re-select the claim department for the following SO(s):"}</p>
        <table style="border-collapse:collapse;width:100%;font-size:12px;font-family:Arial"><thead><tr style="background:#fef2f2"><th style="padding:6px 10px;text-align:left">SO</th><th style="padding:6px 10px;text-align:left">Reason</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="text-align:center;margin-top:20px"><a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700">Open Document →</a></div>
        ${loginLinkBlock()}
      </div>`
      const subject = isImport
        ? `[Admin] Imported doc rejected by SCM NYK — please handle — ${(req as any).documentNo}`
        : `[Merchandise – GW] Claim Rejected — please re-assign — ${(req as any).documentNo}`
      await sendMail(recipients, subject, html)
      return
    }

    // For PENDING_DVM_MER (NYG first approver, before VP MER) — MER picked ONE DVM MER at upload
    // (assignedDvmMer) → notify only that person. Fallback (no pick) → all DVM MER, priority-1 batch.
    if (newStatus === "PENDING_DVM_MER") {
      const link = `${APP_URL}/requests/${requestId}`
      const token = (req as any).vpMerToken
      const assignedEmail = (req as any).assignedDvmMer
      if (assignedEmail) {
        // ?as= → clicking logs in as that specific DVM (or the admin testing) → /approvals.
        const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&as=${encodeURIComponent(assignedEmail)}&redirect=/approvals` : undefined
        await sendMail([assignedEmail], `${STATUS_SUBJECT[newStatus]} — ${req.documentNo}`, buildHtml(req, newStatus, link, undefined, undefined, magicLink))
        return
      }
      const users = await (prisma.user as any).findMany({
        where: {
          isActive: true, bu: (req as any).bu,
          OR: [{ role: "DVM_MER" }, { roles: { has: "DVM_MER" } }],
        },
        select: { email: true, priority: true },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      })
      const withP = users.filter((u: any) => u.priority != null)
      const firstBatch = withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : users
      const recipients = [...new Set(firstBatch.map((u: any) => u.email).filter(Boolean))] as string[]
      if (!recipients.length) return
      const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
      const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
      await sendMail(recipients, `${STATUS_SUBJECT[newStatus]} — ${req.documentNo}`, html)
      return
    }

    // For PENDING_VP_MER — send magic link to open in web (no email approve/reject buttons).
    // NYG: MER doesn't pick a VP MER → assignedVpMer is null → notify ALL active VP MER.
    if (newStatus === "PENDING_VP_MER") {
      const assignedEmail = (req as any).assignedVpMer
      const token = (req as any).vpMerToken
      let emails: string[]
      if (assignedEmail) {
        emails = [assignedEmail]
      } else {
        const users = await (prisma.user as any).findMany({ where: { isActive: true, bu: { in: ["NYG", "ALL"] }, OR: [{ role: "VP_MER" }, { roles: { has: "VP_MER" } }] }, select: { email: true } })
        emails = users.map((u: any) => u.email).filter(Boolean)
      }
      if (!emails.length) return
      const link = `${APP_URL}/requests/${requestId}`
      const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&redirect=/approvals` : undefined
      const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      await sendMail(emails, `${subject} — ${req.documentNo}`, html)
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

    // PENDING_PRESIDENT_GW — magic link to President (GW). Match roles[] too so one person
    // can be President of both BUs (holds PRESIDENT + PRESIDENT_GW).
    if (newStatus === "PENDING_PRESIDENT_GW") {
      const users = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: "PRESIDENT_GW" }, { roles: { has: "PRESIDENT_GW" } }] }, select: { email: true } })
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

    // PENDING_LOGISTICS_GW (after GM approves) — Logistics ∥ Claim run in parallel.
    // (President is the FINAL approver, after Claim+Logistics complete.)
    // Notify 3 groups: Logistics (booking), Claim departments (per split), Accounting (read alert).
    if (newStatus === "PENDING_LOGISTICS_GW") {
      const link = `${APP_URL}/requests/${requestId}`
      // 1) Logistics GW
      const lgUsers = await (prisma.user as any).findMany({ where: { role: "LOGISTICS_GW", isActive: true }, select: { email: true } })
      const lgEmails = lgUsers.map((u: any) => u.email).filter(Boolean)
      if (lgEmails.length) {
        const t = (req as any).logisticsToken
        const ml = t ? `${APP_URL}/api/magic-login?token=${t}&redirect=/approvals` : undefined
        await sendMail(lgEmails, `[Logistics – GW] GM Approved — Please prepare Booking — ${req.documentNo}`, buildHtml(req, newStatus, link, undefined, undefined, ml))
      }
      // 2) Claim departments are notified by the PENDING_CLAIM_GW block (the GM-approve flow
      // fires that status too). Do NOT alert them here as well, or each claim approver gets
      // TWO emails ("GM Approved — Pending Claim" + "Pending Approval") for one document.
      // 3) Accounting (read alert) — this BU only (GW → ACCOUNTING_GW).
      const acUsers = await (prisma.user as any).findMany({ where: { role: { in: ["ACCOUNTING", "ACCOUNTING_GW"] }, isActive: true, bu: { in: [(req as any).bu, "ALL"] } }, select: { email: true } })
      const acEmails = acUsers.map((u: any) => u.email).filter(Boolean)
      if (acEmails.length) {
        const t = (req as any).accountingToken
        const ml = t ? `${APP_URL}/api/magic-login?token=${t}&redirect=/requests/${requestId}` : undefined
        await sendMail(acEmails, `[Accounting – GW] GM Approved (Alert) — ${req.documentNo}`, buildHtml(req, newStatus, link, undefined, undefined, ml))
      }
      return
    }

    // PENDING_PRESIDENT — send magic link to President (roles[] too → one person can be
    // President of both BUs).
    if (newStatus === "PENDING_PRESIDENT") {
      const presidentUser = await (prisma.user as any).findFirst({ where: { isActive: true, OR: [{ role: "PRESIDENT" }, { roles: { has: "PRESIDENT" } }] }, select: { email: true } })
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
      const lgUsers = await (prisma.user as any).findMany({ where: (req as any).bu === "TRM"
        ? { isActive: true, OR: [{ role: "LOGISTICS_TRM" }, { roles: { has: "LOGISTICS_TRM" } }] }
        : { isActive: true, bu: { in: [(req as any).bu || "NYG", "ALL"] }, OR: [{ role: "LOGISTICS" }, { roles: { has: "LOGISTICS" } }] }, select: { email: true } })
      const acUsers = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: "ACCOUNTING" }, { roles: { has: "ACCOUNTING" } }] }, select: { email: true } })
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
      const scmUsers = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: "SCM_USER" }, { roles: { has: "SCM_USER" } }] }, select: { email: true } })
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
        // SCM_NYK_* are CROSS-BU (a person's bu may be NYG/ALL) → don't scope NYK by the doc's
        // bu, or the NYK approver never gets the GW claim email. Match roles[] too (multi-role).
        const isNyk = g.role.startsWith("SCM_NYK")
        const where: any = { isActive: true, OR: [{ role: g.role }, { roles: { has: g.role } }] }
        // SCM_NYG is also cross-BU (the person handling GW's NYG claim usually has bu "NYG" or
        // "ALL") → include "ALL" so a bu="ALL" holder isn't filtered out by the doc's bu ("GW").
        if (!isNyk) where.bu = { in: [(req as any).bu, "ALL"] }
        if (g.claimDept) where.claimDepartment = g.claimDept
        const users = await (prisma.user as any).findMany({ where, select: { email: true, priority: true }, orderBy: { priority: "asc" } })
        const magicLink = g.token ? `${APP_URL}/api/magic-login?token=${g.token}&redirect=/approvals` : undefined
        const html = buildHtml(req, newStatus, link, undefined, undefined, magicLink)
        if (g.role === "SCM_NYK_APPROVER") {
          // HOLD the SCM NYK alert until Logistics has entered INV + Actual air. If not ready yet,
          // skip — LG's "Save & Send" will trigger notifyGwClaimNyk once the numbers are in.
          if (!nykLgReady(req)) continue
          // 2 approvers (by brand) → send EACH their OWN link (?as=email) so clicking
          // logs in as THEM (not the first user). Show brand(s).
          const subj = `[Claim – SCM NYK] Pending Approval — Brand: ${nykBrandLabel(req)} — ${req.documentNo}`
          for (const u of users) {
            if (!u.email) continue
            const perLink = g.token ? `${APP_URL}/api/magic-login?token=${g.token}&as=${encodeURIComponent(u.email)}&redirect=/approvals` : undefined
            await sendMail(u.email, subj, buildHtml(req, "PENDING_CLAIM_GW", link, undefined, undefined, perLink))
          }
          continue
        }
        // Priority chain: alert only the LOWEST priority first; each approval
        // auto-cascades to the next priority (notifyClaimNextPriority).
        const withP = users.filter((u: any) => u.priority != null)
        const firstBatch = withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : users
        const recipients = firstBatch.map((u: any) => u.email).filter(Boolean)
        if (!recipients.length) continue
        await sendMail(recipients, `[Claim – ${g.label}] Pending Approval — ${req.documentNo}`, html)
      }
      return
    }

    // For PENDING_ACCOUNTING — all departments approved; notify Accounting (read-only).
    if (newStatus === "PENDING_ACCOUNTING") {
      await notifyClaimFinalToAccounting(requestId)
      return
    }

    // For PENDING_CLAIM / PENDING_VP_CLAIM — split PER claim department (like GW):
    // alert ONLY the first approver of each dept (lowest priority). After they approve,
    // the approve route auto-cascades to the next priority (notifyClaimNextPriority).
    // Multi-role aware (primary role OR roles[]); no cross-department / everyone blast.
    //   PENDING_CLAIM     → DVM step  (items LOG_PASSED,   split awaiting first approval)
    //   PENDING_VP_CLAIM  → VP step   (items CLAIM_PASSED, split = CLAIM_PASSED)
    if (newStatus === "PENDING_CLAIM" || newStatus === "PENDING_VP_CLAIM") {
      const isVp = newStatus === "PENDING_VP_CLAIM"
      const gate = isVp ? "CLAIM_PASSED" : "LOG_PASSED"
      const deptItems = new Map<string, any[]>()
      for (const it of req.items) {
        if (it.itemStatus !== gate) continue
        for (const s of getSplits(it)) {
          if (isVp) { if (s.status !== "CLAIM_PASSED") continue }          // VP: DVM done, awaiting VP
          else { if (s.status != null && s.status !== "CLAIM_PENDING") continue } // DVM: not yet acted
          if (!deptItems.has(s.dept)) deptItems.set(s.dept, [])
          deptItems.get(s.dept)!.push(it)
        }
      }
      const docLink = `${APP_URL}/requests/${requestId}`
      // Personal magic-login so clicking the email logs the approver in as THEMSELVES and
      // lands on /approvals (the doc then shows in their queue). Reused for LG below.
      const magicFor = (uid: string) => magicLoginFor(uid)
      if (deptItems.size > 0) {
        for (const [dept, items] of deptItems) {
          const deptRoles = isVp ? claimVpRoles(dept) : claimEntryRoles(dept)
          // PRODUCTION entry: route by the SO's factory group. The entry VP is the
          // priority-1 CLAIM_PRODUCTION person whose claimDepartment = that G-group
          // (G1/G3 vs G2/G4). EVP (priority 2) is reached later via forward, not now.
          if (!isVp && dept === "PRODUCTION") {
            const byGroup = new Map<string, any[]>()
            for (const it of items) {
              // No factory G-group (e.g. EA, which has ONE production approver, not per-G) →
              // bucket "ALL" so an all-G claimer (claimDepartment="ALL") receives it.
              const g = vpProdGroup((it as any).factory) || "ALL"
              if (!byGroup.has(g)) byGroup.set(g, [])
              byGroup.get(g)!.push(it)
            }
            for (const [g, gItems] of byGroup) {
              const usAll = await prisma.user.findMany({
                where: {
                  // Claim-Production people are cross-BU (bu = "ALL"), so match this BU OR "ALL".
                  isActive: true, bu: { in: [(req as any).bu, "ALL"] },
                  OR: [{ role: { in: deptRoles } }, { roles: { hasSome: deptRoles } }],
                } as any,
                select: { id: true, email: true, priority: true, claimDepartment: true },
                orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
              })
              // Match by normalized G-group ("G1"/"G3"/"G1/G3") — or "ALL" covers every group.
              const us = usAll.filter((u: any) => prodGroupCovers(u.claimDepartment, g))
              const withP = us.filter((u: any) => u.priority != null)
              const firstBatch = withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : us.slice(0, 1)
              for (const u of firstBatch) {
                if (!u.email) continue
                const html = buildHtml(req, newStatus, docLink, undefined, undefined, await magicFor(u.id))
                await sendMail(u.email, `[Claim – PRODUCTION ${g}] Pending Approval — ${gItems.length} SO — ${req.documentNo}`, html)
              }
            }
            continue
          }
          // NYK claim uses the 3-role sub-flow (Action Approver → EVP + CR user), NOT the
          // forced-position chain. Alert the Action Approver(s); they pick EVP + CR next.
          if (!isVp && dept === "NYK") {
            // Include the brand(s) so each NYK approver can tell if it's their brand.
            const brands = [...new Set((items as any[]).map(it => it.brand).filter(Boolean))].join(", ")
            const brandTag = brands ? ` [${brands}]` : ""
            // SCM_NYK_APPROVER is CROSS-BU (users' bu is often NYG even on GW docs) and may hold the
            // role in roles[] rather than as the primary role → no bu filter, match role OR roles[].
            const us = await prisma.user.findMany({
              where: { isActive: true, OR: [{ role: "SCM_NYK_APPROVER" }, { roles: { has: "SCM_NYK_APPROVER" } }] } as any,
              select: { id: true, email: true },
              orderBy: [{ createdAt: "asc" }],
            })
            for (const u of us) {
              if (!u.email) continue
              // Recipient is the SCM NYK Action Approver, NOT a DVM → show the correct status.
              const html = buildHtml(req, newStatus, docLink, undefined, undefined, await magicFor(u.id), "Pending Claim — SCM NYK Approver")
              await sendMail(u.email, `[Claim – NYK]${brandTag} Pending Approval — ${items.length} SO — ${req.documentNo}`, html)
            }
            continue
          }
          // COMMERCIAL claim = the SAME merch people picked on this doc: DVM MER (entry,
          // assignedDvmMer) → VP MER (VP, assignedVpMer). Route to THAT specific person, not the
          // priority-1 DVM MER. (Falls through to the generic role-priority branch if unset.)
          if (dept === "COMMERCIAL") {
            const email = isVp ? (req as any).assignedVpMer : (req as any).assignedDvmMer
            if (email) {
              const u = await prisma.user.findFirst({ where: { email, isActive: true } as any, select: { id: true, email: true } })
              if (u?.email) {
                const html = buildHtml(req, newStatus, docLink, undefined, undefined, await magicFor(u.id))
                await sendMail(u.email, `[Claim${isVp ? " VP" : ""} – COMMERCIAL] Pending Approval — ${items.length} SO — ${req.documentNo}`, html)
                continue
              }
            }
            // else: no assigned person → fall through to the generic role-priority branch below
          }
          // Procurement entry goes to PURCHASING only (they decide: approve or forward to
          // Sourcing). Sourcing is reached later via forward, not the initial alert.
          const procEntryFilter = (!isVp && dept === "PROCUREMENT") ? { procurementType: "PURCHASING" } : {}
          const users = await prisma.user.findMany({
            where: {
              // Some claim roles are cross-BU (bu = "ALL") — match this BU OR "ALL".
              isActive: true, bu: { in: [(req as any).bu, "ALL"] }, ...procEntryFilter,
              OR: [{ role: { in: deptRoles } }, { roles: { hasSome: deptRoles } }],
            },
            select: { id: true, email: true, priority: true },
            orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
          })
          const withP = users.filter((u: any) => u.priority != null)
          const firstBatch = withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : users.slice(0, 1)
          const label = dept.replace(/_/g, " ")
          // Send EACH approver their OWN email (separate) so the magic link resolves per person.
          for (const u of firstBatch) {
            if (!u.email) continue
            const html = buildHtml(req, newStatus, docLink, undefined, undefined, await magicFor(u.id))
            await sendMail(u.email, `[Claim${isVp ? " VP" : ""} – ${label}] Pending Approval — ${items.length} SO — ${req.documentNo}`, html)
          }
        }
      }
      // NYG: Logistics runs IN PARALLEL with Claim → alert LG (enter INV / HAWB / Actual Air)
      // when the doc first enters the claim stage. Only at the DVM step (PENDING_CLAIM).
      if (!isVp && (req as any).bu !== "GW") {
        // BU-scoped: NYG docs → NYG Logistics; EA docs → EA Logistics (quynh). Cross-BU LG (bu="ALL") sees both.
        const lgUsers = await prisma.user.findMany({ where: ((req as any).bu === "TRM"
          ? { isActive: true, OR: [{ role: "LOGISTICS_TRM" }, { roles: { has: "LOGISTICS_TRM" } }] }
          : { isActive: true, role: "LOGISTICS", bu: { in: [(req as any).bu || "NYG", "ALL"] } }) as any, select: { id: true, email: true } })
        for (const u of lgUsers) {
          if (!u.email) continue
          const html = buildHtml(req, "PENDING_LOGISTICS", docLink, undefined, undefined, await magicFor(u.id))
          await sendMail(u.email, `[Logistics] Ready for HAWB / Actual (parallel with Claim) — ${req.documentNo}`, html)
        }
      }
      return
    }

    // Merch approval stages (NYG DVM/VP Merchandise + EA ADVM/DVM) → send EACH approver their
    // OWN ?as= magic link (reuses vpMerToken) so they (or an admin testing) click once to log
    // in as themselves and act — no manual login.
    const MERCH_ROLE: Record<string, string> = {
      PENDING_DVM_MER: "DVM_MER", PENDING_VP_MER: "VP_MER",
      PENDING_DVM_MER_EA: "DVM_MER_EA", PENDING_VP_MER_EA: "VP_MER_EA",
      PENDING_DVM_MER_TRM: "DVM_MER_TRM", PENDING_VP_MER_TRM: "VP_MER_TRM",
    }
    if (MERCH_ROLE[newStatus]) {
      const mrole = MERCH_ROLE[newStatus]
      const link = `${APP_URL}/requests/${requestId}`
      const token = (req as any).vpMerToken
      const subject = STATUS_SUBJECT[newStatus] || "Air Request Update"
      // EA: MER picked ADVM (assignedDvmMer, step 1), ADVM picked DVM (assignedVpMer, step 2) →
      // notify only that chosen person. Fallback (no pick) → all holders of the stage role.
      const assignedEmail = (newStatus === "PENDING_DVM_MER_EA" || newStatus === "PENDING_DVM_MER_TRM") ? (req as any).assignedDvmMer
        : (newStatus === "PENDING_VP_MER_EA" || newStatus === "PENDING_VP_MER_TRM") ? (req as any).assignedVpMer : null
      const mUsers = assignedEmail
        ? [{ email: assignedEmail }]
        : await (prisma.user as any).findMany({
            where: { isActive: true, OR: [{ role: mrole }, { roles: { has: mrole } }] }, select: { email: true },
          })
      for (const u of mUsers) {
        if (!u.email) continue
        const magicLink = token ? `${APP_URL}/api/magic-login?token=${token}&as=${encodeURIComponent(u.email)}&redirect=/approvals` : undefined
        await sendMail(u.email, `${subject} — ${req.documentNo}`, buildHtml(req, newStatus, link, undefined, undefined, magicLink))
      }
      return
    }

    // For claim statuses, filter by depts that actually have items
    const activeDepts = new Set(req.items.map((i:any) => i.claimDepartment).filter(Boolean))

    // Match the primary role OR any held role (roles[]), so ONE person can serve a role
    // in both BUs (e.g. SCM User in NYG + Claim-SCM NYG in GW). rolesToNotify is already
    // BU-specific by name (e.g. SCM_USER = NYG only), so no separate BU filter is needed.
    const users = await (prisma.user as any).findMany({
      where: { isActive: true, OR: [{ role: { in: rolesToNotify } }, { roles: { hasSome: rolesToNotify } }] },
      select: { email: true, role: true, roles: true }
    })

    // Filter: for PENDING_CLAIM / PENDING_VP_CLAIM, only notify users whose dept has items
    const recipients = users
      .filter((u: any) => {
        const dept = deptFromRole(u.role)
        if (!dept) return true
        if (newStatus === "PENDING_CLAIM" || newStatus === "PENDING_VP_CLAIM") {
          return activeDepts.has(dept)
        }
        return true
      })
      .map((u: any) => u.email)

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

// Re-alert the ENTRY approver(s) of ONE claim dept — used when a later position sends the
// claim back to the previous/entry position. Mirrors the PENDING_CLAIM entry resolution:
// NYK → Action Approver; PRODUCTION → priority-1 VP by factory G-group; PROCUREMENT →
// Purchasing; others → priority-1 of the dept.
export async function notifyClaimEntry(requestId: string, dept: string) {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyClaimEntryImpl(requestId, dept))
}
async function notifyClaimEntryImpl(requestId: string, dept: string) {
  try {
    const req = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: { select: { id: true, factory: true, claimDepts: true, claimDepartment: true, itemStatus: true } } },
    })
    if (!req) return
    const bu = (req as any).bu
    const docLink = `${APP_URL}/requests/${requestId}`
    const magicFor = (uid: string) => magicLoginFor(uid)
    const deptItems = (req.items as any[]).filter(it => it.itemStatus !== "REJECTED" && getSplits(it).some((s: any) => s.dept === dept))
    if (!deptItems.length) return
    const sendTo = async (uid: string, email: string | null, label: string) => {
      if (!email) return
      const html = buildHtml(req, "PENDING_CLAIM", docLink, undefined, undefined, await magicFor(uid))
      await sendMail(email, `[Claim – ${label}] Sent back — Pending Approval — ${deptItems.length} SO — ${req.documentNo}`, html)
    }
    if (dept === "NYK") {
      // SCM_NYK is cross-BU (users' bu may be NYG even on a GW doc) → don't filter by bu.
      const us = await prisma.user.findMany({ where: { isActive: true, OR: [{ role: "SCM_NYK_APPROVER" }, { roles: { has: "SCM_NYK_APPROVER" } }] } as any, select: { id: true, email: true } })
      for (const u of us) await sendTo(u.id, u.email, "NYK")
      return
    }
    if (dept === "PRODUCTION") {
      const groups = new Set(deptItems.map(it => vpProdGroup(it.factory)).filter(Boolean) as string[])
      const usAll = await prisma.user.findMany({ where: { isActive: true, bu, OR: [{ role: "CLAIM_PRODUCTION" }, { roles: { has: "CLAIM_PRODUCTION" } }] } as any, select: { id: true, email: true, priority: true, claimDepartment: true } })
      for (const g of groups) {
        const us = usAll.filter((u: any) => prodGroupCovers(u.claimDepartment, g))
        const withP = us.filter((u: any) => u.priority != null).sort((a: any, b: any) => a.priority - b.priority)
        const first = withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : us.slice(0, 1)
        for (const u of first) await sendTo(u.id, (u as any).email, `PRODUCTION ${g}`)
      }
      return
    }
    const roles = claimEntryRoles(dept)
    const procFilter = dept === "PROCUREMENT" ? { procurementType: "PURCHASING" } : {}
    const us = await prisma.user.findMany({ where: { isActive: true, bu, ...procFilter, OR: [{ role: { in: roles } }, { roles: { hasSome: roles } }] } as any, select: { id: true, email: true, priority: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] })
    const withP = us.filter((u: any) => u.priority != null)
    const first = withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : us.slice(0, 1)
    for (const u of first) await sendTo(u.id, u.email, dept.replace(/_/g, " "))
  } catch (e) {
    console.error("[notify] claim-entry error:", e)
  }
}

export async function notifyClaimNext(
  requestId: string, toEmail: string, toName: string, fromName: string, token: string, deptOverride?: string | null
) {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyClaimNextImpl(requestId, toEmail, toName, fromName, token, deptOverride))
}
async function notifyClaimNextImpl(
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
      select: { documentNo: true, brandName: true, claimDepartment: true, bu: true, items: { select: { brand: true } } }
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
            <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${docBrands(req)}</span>
          </td></tr>
          <tr><td style="padding:8px 0">
            <span style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;text-transform:uppercase">CLAIM DEPT</span><br>
            <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${dept}</span>
          </td></tr>
        </table>
        <div style="text-align:center;margin-top:24px">
          ${emailButton(magicLink, "Open Document →", "#1e3a8a")}
        </div>
        ${loginLinkBlock()}
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
      where: { role: { in: ["ACCOUNTING", "ACCOUNTING_GW"] }, isActive: true, bu: { in: [(req as any).bu, "ALL"] } },
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
            <span style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif">${docBrands(req)}</span>
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
        ${loginLinkBlock()}
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

// A claim approver could not find a person for the required position — ask ADMIN
// to add them as a user so they become selectable.
export async function notifyAdminAddPerson(opts: {
  position: string; suggestedName?: string; requesterName?: string; documentNo?: string; bu?: string; requestId?: string
}) {
  try {
    const admins = await (prisma.user as any).findMany({
      where: { role: "ADMIN", isActive: true }, select: { email: true }
    })
    const to: string[] = admins.map((a: any) => a.email).filter(Boolean)
    if (to.length === 0) { console.warn("[notify] add-person: no ADMIN user with an email — nobody to notify"); return }
    const link = opts.requestId ? `${APP_URL}/requests/${opts.requestId}` : `${APP_URL}/users`
    const row = (k: string, v: string) =>
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:12px;font-family:Arial,sans-serif;width:130px">${k}</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:700;font-family:Arial,sans-serif">${v || "—"}</td></tr>`
    const html = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0"><tr><td align="center">
  <table width="460" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#b91c1c;padding:18px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:16px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:1px">ADD APPROVER REQUEST</h1></td></tr>
    <tr><td style="padding:26px 32px">
      <p style="color:#374151;font-size:13px;line-height:1.6;font-family:Arial,sans-serif;margin:0 0 16px">A claim approver could not find anyone for a required position. Please add this person as a user so they can be selected.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Position needed", opts.position)}
        ${row("Suggested name", opts.suggestedName || "")}
        ${row("Business Unit", opts.bu || "")}
        ${row("Document", opts.documentNo || "")}
        ${row("Requested by", opts.requesterName || "")}
      </table>
      <div style="text-align:center;margin-top:22px">${emailButton(`${APP_URL}/users`, "Manage Users →", "#b91c1c")}</div>
      ${loginLinkBlock()}
    </td></tr>
    <tr><td style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p></td></tr>
  </table>
</td></tr></table></body></html>`
    await sendMail(to, `[Admin] Add approver for ${opts.position}${opts.documentNo ? " — " + opts.documentNo : ""}`, html)
  } catch (err) {
    console.error("[notify] add-person error:", err)
  }
}

// Item 2 — when Logistics finishes entering INV + HAWB (Actual Air) and hits "Save & Send",
// email each claim department's claimer(s) for this doc with:
//   (a) the LG-attached files (INV / AWB / Expense / Combine), and
//   (b) the system-generated signed PDF (signatures captured so far → GM for GW / VP SCM for NYG).
// Sent per-department (each dept's SOs), to whoever holds that dept's entry claim role
// (COMMERCIAL → DVM MER, etc. via claimEntryRoles). Both BU.
// Forward a REJECTION (NYG, before SCM claim) to a manually-typed email — the rejecter
// types any address (NOT looked up from the company directory). Sends the rejected style's
// SO data + the reject reason. Recipient just reads it (no login / no action).
export async function notifyRejectionForward(requestId: string, toEmail: string, style: string, reason: string, rejectedBy?: string) {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyRejectionForwardImpl(requestId, toEmail, style, reason, rejectedBy))
}
async function notifyRejectionForwardImpl(requestId: string, toEmail: string, style: string, reason: string, rejectedBy?: string) {
  try {
    const req: any = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: true, createdBy: { select: { name: true, email: true } } },
    })
    if (!req) return
    const items = (req.items as any[]).filter(i => i.style === style)
    const cell = (v: any, right = false) => `<td style="padding:6px 10px;border-bottom:1px solid #eee${right ? ";text-align:right" : ""}">${v}</td>`
    const rows = items.map(i => `<tr>${cell(i.so)}${cell(i.style)}${cell(i.customerPO || "-")}${cell(i.description || "-")}${cell((i.qtyRequestAir || 0).toLocaleString(), true)}${cell(i.reasonDelay || "-")}</tr>`).join("")
    const html = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#dc2626;padding:18px 24px">
      <p style="margin:0;color:#fecaca;font-size:10px;letter-spacing:2px;font-family:Arial;text-transform:uppercase">Air Request · Rejected</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-family:Arial;font-weight:800">${req.documentNo} — Style ${style}</h1>
    </td></tr>
    <tr><td style="padding:20px 24px">
      <p style="color:#334155;font-size:13px;font-family:Arial;margin:0 0 4px">Requested by: <strong>${req.createdBy?.name || req.createdBy?.email || "-"}</strong>${rejectedBy ? ` · Rejected by: <strong>${rejectedBy}</strong>` : ""}</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin:10px 0">
        <p style="margin:0;color:#991b1b;font-size:12px;font-weight:700;font-family:Arial">Reason for rejection:</p>
        <p style="margin:4px 0 0;color:#7f1d1d;font-size:13px;font-family:Arial">${reason || "-"}</p>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:12px;font-family:Arial;margin-top:8px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:6px 10px;text-align:left">SO</th><th style="padding:6px 10px;text-align:left">STYLE</th>
          <th style="padding:6px 10px;text-align:left">CUSTOMER PO</th><th style="padding:6px 10px;text-align:left">DESCRIPTION</th>
          <th style="padding:6px 10px;text-align:right">QTY AIR</th><th style="padding:6px 10px;text-align:left">REASON DELAY</th>
        </tr></thead><tbody>${rows}</tbody></table>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial">Air Request System · Nan Yang Textile Group</p></td></tr>
  </table>
</td></tr></table></body></html>`
    await sendMail([toEmail], `[Air Request · Rejected] ${req.documentNo} — ${style}`, html)
  } catch (e) { console.error("[notify] rejection forward failed:", e) }
}

// Tell the MER creator (the person who uploaded the request) that their document got rejected —
// including WHO rejected it and, if the rejecter forwarded it, WHICH email it was forwarded to.
// NYG only. Recipient = req.createdBy.email.
export async function notifyRejectionToCreator(requestId: string, style: string, reason: string, rejectedBy?: string, forwardEmail?: string) {
  try {
    const req: any = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: true, createdBy: { select: { name: true, email: true } } },
    })
    if (!req?.createdBy?.email) return
    const items = (req.items as any[]).filter(i => i.style === style)
    const cell = (v: any, right = false) => `<td style="padding:6px 10px;border-bottom:1px solid #eee${right ? ";text-align:right" : ""}">${v}</td>`
    const rows = items.map(i => `<tr>${cell(i.so)}${cell(i.style)}${cell(i.customerPO || "-")}${cell(i.description || "-")}${cell((i.qtyRequestAir || 0).toLocaleString(), true)}${cell(i.reasonDelay || "-")}</tr>`).join("")
    const fwLine = forwardEmail
      ? `<p style="margin:6px 0 0;color:#334155;font-size:13px;font-family:Arial">Forwarded to: <strong style="color:#dc2626">${forwardEmail}</strong></p>`
      : ""
    const html = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#dc2626;padding:18px 24px">
      <p style="margin:0;color:#fecaca;font-size:10px;letter-spacing:2px;font-family:Arial;text-transform:uppercase">Air Request · Document Rejected</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-family:Arial;font-weight:800">${req.documentNo} — Style ${style}</h1>
    </td></tr>
    <tr><td style="padding:20px 24px">
      <p style="color:#334155;font-size:13px;font-family:Arial;margin:0">Dear <strong>${req.createdBy?.name || req.createdBy?.email}</strong>, your document was rejected${rejectedBy ? ` by <strong>${rejectedBy}</strong>` : ""}</p>
      ${fwLine}
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin:12px 0">
        <p style="margin:0;color:#991b1b;font-size:12px;font-weight:700;font-family:Arial">Reason for rejection:</p>
        <p style="margin:4px 0 0;color:#7f1d1d;font-size:13px;font-family:Arial">${reason || "-"}</p>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:12px;font-family:Arial;margin-top:8px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:6px 10px;text-align:left">SO</th><th style="padding:6px 10px;text-align:left">STYLE</th>
          <th style="padding:6px 10px;text-align:left">CUSTOMER PO</th><th style="padding:6px 10px;text-align:left">DESCRIPTION</th>
          <th style="padding:6px 10px;text-align:right">QTY AIR</th><th style="padding:6px 10px;text-align:left">REASON DELAY</th>
        </tr></thead><tbody>${rows}</tbody></table>
      <p style="margin:14px 0 0;color:#64748b;font-size:12px;font-family:Arial">Please edit and upload the document again.</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial">Air Request System · Nan Yang Textile Group</p></td></tr>
  </table>
</td></tr></table></body></html>`
    await sendMail([req.createdBy.email], `[Air Request · Rejected] ${req.documentNo} — ${style}`, html)
  } catch (e) { console.error("[notify] rejection to creator failed:", e) }
}

// GW "Back to Merchandise" — DPM/GM sent the whole document back to the MER (GW) to fix and
// re-submit (NOT a hard reject). Emails the MER creator with the reason + the full SO list.
export async function notifyBackToMerGw(requestId: string, reason: string, byName?: string) {
  try {
    const req: any = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: true, createdBy: { select: { name: true, email: true } } },
    })
    if (!req?.createdBy?.email) return
    const items = (req.items as any[]).filter(i => i.itemStatus !== "REJECTED")
    const cell = (v: any, right = false) => `<td style="padding:6px 10px;border-bottom:1px solid #eee${right ? ";text-align:right" : ""}">${v}</td>`
    const rows = items.map(i => `<tr>${cell(i.so)}${cell(i.style)}${cell(i.customerPO || "-")}${cell(i.description || "-")}${cell((i.qtyRequestAir || 0).toLocaleString(), true)}</tr>`).join("")
    const html = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#ea580c;padding:18px 24px">
      <p style="margin:0;color:#fed7aa;font-size:10px;letter-spacing:2px;font-family:Arial;text-transform:uppercase">Air Request · Back to Merchandise (${req.bu || "GW"})</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-family:Arial;font-weight:800">${req.documentNo}</h1>
    </td></tr>
    <tr><td style="padding:20px 24px">
      <p style="color:#334155;font-size:13px;font-family:Arial;margin:0">Dear <strong>${req.createdBy?.name || req.createdBy?.email}</strong>, the document was sent back to Merchandise for editing${byName ? ` by <strong>${byName}</strong>` : ""}</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 14px;margin:12px 0">
        <p style="margin:0;color:#9a3412;font-size:12px;font-weight:700;font-family:Arial">Reason (Back to Merchandise):</p>
        <p style="margin:4px 0 0;color:#7c2d12;font-size:13px;font-family:Arial">${reason || "-"}</p>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:12px;font-family:Arial;margin-top:8px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:6px 10px;text-align:left">SO</th><th style="padding:6px 10px;text-align:left">STYLE</th>
          <th style="padding:6px 10px;text-align:left">CUSTOMER PO</th><th style="padding:6px 10px;text-align:left">DESCRIPTION</th>
          <th style="padding:6px 10px;text-align:right">QTY AIR</th>
        </tr></thead><tbody>${rows}</tbody></table>
      <p style="margin:14px 0 0;color:#64748b;font-size:12px;font-family:Arial">Please edit and click Re-submit to send it back for approval again.</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial">Air Request System · Nan Yang Textile Group</p></td></tr>
  </table>
</td></tr></table></body></html>`
    await sendMail([req.createdBy.email], `[Air Request · Back to Merchandise] ${req.documentNo}`, html)
  } catch (e) { console.error("[notify] back-to-mer (GW) failed:", e) }
}

// When Merchandise RE-SUBMITS a revised document, also notify the Logistics team (by BU) with the
// revise reason — LG needs to know what changed (qty / ship date / etc.) for their booking.
export async function notifyReviseToLg(requestId: string, reason: string, byName?: string) {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyReviseToLgImpl(requestId, reason, byName))
}
async function notifyReviseToLgImpl(requestId: string, reason: string, byName?: string) {
  try {
    const req = await (prisma.airRequest as any).findUnique({ where: { id: requestId }, select: { documentNo: true, bu: true, brandName: true } })
    if (!req) return
    const bu = req.bu || "NYG"
    const lgRoles = bu === "GW" ? ["LOGISTICS_GW"] : bu === "TRM" ? ["LOGISTICS_TRM"] : ["LOGISTICS"]
    const us = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: { in: lgRoles } }, { roles: { hasSome: lgRoles } }] }, select: { email: true, bu: true } })
    const recipients = us.filter((u: any) => bu === "TRM" || !u.bu || u.bu === "ALL" || u.bu === bu).map((u: any) => u.email).filter(Boolean)
    if (!recipients.length) return
    const link = `${APP_URL}/logistics`
    const html = `<div style="font-family:Arial;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
      <p style="font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin:0">Nan Yang Textile · Air Request</p>
      <h2 style="font-size:18px;margin:6px 0 2px">${req.documentNo}</h2>
      <p style="font-size:13px;color:#334155;margin:8px 0">เอกสารนี้ถูก <b>แก้ไข &amp; ส่งใหม่ (Revise)</b>${byName ? ` โดย ${byName}` : ""} — กรุณาตรวจข้อมูลก่อนจอง/บันทึก LG</p>
      ${reason ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin:10px 0">
        <p style="margin:0;color:#b45309;font-size:12px;font-weight:700;font-family:Arial">เหตุผลที่แก้ไข (Revise reason):</p>
        <p style="margin:4px 0 0;color:#92400e;font-size:13px;font-family:Arial;white-space:pre-wrap">${reason}</p></div>` : ""}
      <div style="text-align:center;margin-top:18px"><a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700">เปิด LG Booking →</a></div>
      ${loginLinkBlock()}
    </div>`
    await sendMail(recipients, `[Logistics] Document revised — ${req.documentNo}`, html)
  } catch (e) { console.error("[notify] revise-to-LG failed:", e) }
}

// Recall — MER (creator) / Admin / Jariya pulls an in-flight document back to Merchandise.
// Alert whoever is CURRENTLY holding it (so they stop), FYI everyone who already approved,
// and confirm to the creator. TEST docs reroute to the admin.
export async function notifyRecall(requestId: string, byName?: string, reason?: string) {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyRecallImpl(requestId, byName, reason))
}
async function notifyRecallImpl(requestId: string, byName?: string, reason?: string) {
  try {
    const req: any = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: { items: true, createdBy: { select: { name: true, email: true } }, approvalLogs: { include: { user: { select: { email: true } } } } },
    })
    if (!req) return
    const bu = req.bu || "NYG"
    const holders = new Set<string>()
    const add = (e?: string | null) => { if (e) holders.add(String(e).toLowerCase()) }
    const addRole = async (roles: string[], scopeBu = true) => {
      const where: any = { isActive: true, OR: [{ role: { in: roles } }, { roles: { hasSome: roles } }] }
      if (scopeBu) where.bu = { in: [bu, "ALL"] }
      const us = await (prisma.user as any).findMany({ where, select: { email: true } })
      us.forEach((u: any) => add(u.email))
    }
    // TRM logistics = the LOGISTICS_TRM role (Urairat, whose bu=GW) → query by role, NOT bu.
    // Other non-GW BUs use the shared LOGISTICS role scoped by the doc's BU.
    const lgRoles = bu === "TRM" ? ["LOGISTICS_TRM"] : ["LOGISTICS"]
    const lgScope = bu !== "TRM"
    switch (req.status) {
      case "PENDING_DVM_MER": req.assignedDvmMer ? add(req.assignedDvmMer) : await addRole(["DVM_MER"]); break
      case "PENDING_DVM_MER_EA": req.assignedDvmMer ? add(req.assignedDvmMer) : await addRole(["DVM_MER_EA"]); break
      case "PENDING_DVM_MER_TRM": req.assignedDvmMer ? add(req.assignedDvmMer) : await addRole(["DVM_MER_TRM"]); break
      case "PENDING_VP_MER": req.assignedVpMer ? add(req.assignedVpMer) : await addRole(["VP_MER"]); break
      case "PENDING_VP_MER_EA": req.assignedVpMer ? add(req.assignedVpMer) : await addRole(["VP_MER_EA"]); break
      case "PENDING_VP_MER_TRM": req.assignedVpMer ? add(req.assignedVpMer) : await addRole(["VP_MER_TRM"]); break
      case "PENDING_SCM": await addRole(["SCM_USER"]); break
      case "PENDING_VP_SCM": req.assignedVpScm ? add(req.assignedVpScm) : await addRole(["VP_SCM"]); break
      case "PENDING_PRESIDENT": await addRole(["PRESIDENT"]); break
      case "PENDING_LOGISTICS": await addRole(lgRoles, lgScope); break
      case "PENDING_VP_MER_GW": req.assignedVpMer ? add(req.assignedVpMer) : await addRole(["DPM_GW", "VP_MER_GW"]); break
      case "PENDING_GM_GW": await addRole(["GM_GW"]); break
      case "PENDING_PRESIDENT_GW": await addRole(["PRESIDENT_GW"]); break
      case "PENDING_ACCOUNTING": await addRole(["ACCOUNTING", "ACCOUNTING_GW"]); break
      case "PENDING_LOGISTICS_GW":
      case "PENDING_CLAIM_GW": {
        await addRole(["LOGISTICS_GW"])
        const depts = new Set<string>(); for (const it of req.items) getSplits(it).forEach((s: any) => depts.add(s.dept))
        for (const g of gwClaimGroups(depts, req)) await addRole([g.role], !g.role.startsWith("SCM_NYK"))
        break
      }
      case "PENDING_CLAIM":
      case "PENDING_VP_CLAIM": {
        await addRole(lgRoles, lgScope)
        const depts = new Set<string>(); for (const it of req.items) getSplits(it).forEach((s: any) => depts.add(s.dept))
        for (const d of depts) { const roles = [...claimEntryRoles(d), ...claimVpRoles(d)]; if (roles.length) await addRole(roles) }
        break
      }
    }
    // Forwarded claim approvers currently holding SO(s)
    const fwds = await (prisma as any).claimForward.findMany({ where: { requestId }, select: { nextEmail: true } })
    fwds.forEach((f: any) => add(f.nextEmail))

    const creator = req.createdBy?.email ? String(req.createdBy.email).toLowerCase() : null
    const priorApprovers = new Set<string>()
    for (const l of (req.approvalLogs || [])) if (l.action === "APPROVE" && l.user?.email) priorApprovers.add(String(l.user.email).toLowerCase())
    const holderList = [...holders].filter(e => e !== creator)
    const fyiList = [...priorApprovers].filter(e => e !== creator && !holders.has(e))

    const link = `${APP_URL}/requests/${requestId}`
    const reasonBlock = reason ? `<p style="margin:8px 0 0;color:#7c2d12;font-size:13px;font-family:Arial"><b>Reason:</b> ${reason}</p>` : ""
    const mk = (headline: string, sub: string) => `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#7c3aed;padding:18px 24px">
      <p style="margin:0;color:#ede9fe;font-size:10px;letter-spacing:2px;font-family:Arial;text-transform:uppercase">Air Request · Recalled</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-family:Arial;font-weight:800">${req.documentNo}</h1>
    </td></tr>
    <tr><td style="padding:20px 24px">
      <p style="margin:0;color:#334155;font-size:14px;font-family:Arial;font-weight:700">${headline}</p>
      <p style="margin:6px 0 0;color:#64748b;font-size:13px;font-family:Arial">${sub}${byName ? ` — by ${byName}` : ""}</p>
      ${reasonBlock}
      <p style="margin:16px 0 0"><a href="${link}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-family:Arial;font-weight:700">Open Document</a></p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial">Air Request System · Nan Yang Textile Group</p></td></tr>
  </table></td></tr></table></body></html>`
    if (holderList.length) await sendMail(holderList, `[Recalled] ${req.documentNo} — recalled, no action needed`, mk("This document was recalled.", "It has been pulled back to Merchandise — you don't need to act on it"))
    if (fyiList.length) await sendMail(fyiList, `[Recalled · FYI] ${req.documentNo}`, mk("A document you approved was recalled.", "It has been pulled back to Merchandise and will restart approval"))
    if (creator) await sendMail([creator], `[Recalled] ${req.documentNo} — returned to you`, mk("Your document was recalled.", "Edit it and press Re-submit to send it back for approval"))
  } catch (e) { console.error("[notify] recall failed:", e) }
}

// Topic 6 — Logistics rejected an SO and bounced it back before the claim split. FYI-alert every
// person who already approved this document (distinct approvers from the approval log) + the creator.
export async function notifyLgRejectFyi(requestId: string, so: string, reason: string, byName?: string) {
  try {
    const req: any = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: {
        createdBy: { select: { email: true } },
        approvalLogs: { include: { user: { select: { email: true } } } },
      },
    })
    if (!req) return
    const emails = [...new Set([
      req.createdBy?.email,
      ...(req.approvalLogs || []).map((l: any) => l.user?.email),
    ].filter(Boolean))] as string[]
    if (!emails.length) return
    const link = `${APP_URL}/requests/${requestId}`
    const html = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#b45309;padding:18px 24px">
      <p style="margin:0;color:#fde68a;font-size:10px;letter-spacing:2px;font-family:Arial;text-transform:uppercase">Air Request · Logistics Rejected an SO (FYI)</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-family:Arial;font-weight:800">${req.documentNo} — SO ${so}</h1>
    </td></tr>
    <tr><td style="padding:20px 24px">
      <p style="color:#334155;font-size:13px;font-family:Arial;margin:0">Logistics${byName ? ` (<strong>${byName}</strong>)` : ""} sent back SO <strong>${so}</strong> (not an air item / not in the projection) to before the Claim split step for editing</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin:12px 0">
        <p style="margin:0;color:#92400e;font-size:12px;font-weight:700;font-family:Arial">Reason:</p>
        <p style="margin:4px 0 0;color:#78350f;font-size:13px;font-family:Arial">${reason || "-"}</p>
      </div>
      <p style="margin:14px 0 0;font-family:Arial"><a href="${link}" style="color:#b45309;font-size:13px">Open Document →</a></p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial">Air Request System · Nan Yang Textile Group · This email is for your information (FYI)</p></td></tr>
  </table>
</td></tr></table></body></html>`
    await sendMail(emails, `[Air Request · FYI] Logistics sent back SO ${so} — ${req.documentNo}`, html)
  } catch (e) { console.error("[notify] lg-reject FYI failed:", e) }
}

// A new document is HELD because Master data is incomplete — some COUNTRY has no freight rate
// and/or some DESCRIPTION has no WT Charge (so Gross / Est. Air Freight can't be computed).
// Alert the people who maintain Master (ADMIN / Logistics / the master-editor allowlist) with
// the exact missing items, so they can add them and release the doc.
export async function notifyMissingMaster(requestId: string, missingCountries: string[], missingDescriptions: string[]) {
  try {
    const countries = [...new Set(missingCountries.filter(Boolean))]
    const descs = [...new Set(missingDescriptions.filter(Boolean))]
    if (!countries.length && !descs.length) return
    const req: any = await prisma.airRequest.findUnique({
      where: { id: requestId },
      select: { documentNo: true, bu: true, createdBy: { select: { name: true, email: true } } },
    })
    if (!req) return
    const editors = await (prisma.user as any).findMany({
      where: { isActive: true, OR: [{ role: { in: ["ADMIN", "LOGISTICS", "LOGISTICS_GW"] } }, { email: { in: MASTER_EDITOR_EMAILS } }] },
      select: { email: true },
    })
    const recips = [...new Set((editors as any[]).map(u => u.email).filter(Boolean))]
    if (!recips.length) return
    const li = (v: string) => `<li style="margin:2px 0;color:#7c2d12;font-size:13px;font-family:Arial">${v}</li>`
    const rateBlock = countries.length ? `
      <p style="margin:12px 0 2px;color:#9a3412;font-size:12px;font-weight:700;font-family:Arial">Freight Rate (Master Rate) must be added for country:</p>
      <ul style="margin:0;padding-left:18px">${countries.map(li).join("")}</ul>` : ""
    const wtBlock = descs.length ? `
      <p style="margin:12px 0 2px;color:#9a3412;font-size:12px;font-weight:700;font-family:Arial">WT Charge (Master Description) must be added for:</p>
      <ul style="margin:0;padding-left:18px">${descs.map(li).join("")}</ul>` : ""
    const html = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#d97706;padding:18px 24px">
      <p style="margin:0;color:#fde68a;font-size:10px;letter-spacing:2px;font-family:Arial;text-transform:uppercase">Air Request · Incomplete Master</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-family:Arial;font-weight:800">${req.documentNo} — ${req.bu || "NYG"}</h1>
    </td></tr>
    <tr><td style="padding:20px 24px">
      <p style="color:#334155;font-size:13px;font-family:Arial;margin:0">The document is <strong>Held</strong> because the Master data is incomplete — Gross Weight / Est. Air Freight cannot be calculated (= 0)</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin:12px 0">${rateBlock}${wtBlock}</div>
      <p style="margin:10px 0 0;color:#64748b;font-size:12px;font-family:Arial">Add the data to Master Rate / Master Description and the system will calculate and release the document automatically.</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial">Air Request System · Nan Yang Textile Group</p></td></tr>
  </table>
</td></tr></table></body></html>`
    await sendMail(recips, `[Master needs data] ${req.documentNo} — ${countries.length ? `${countries.length} rate` : ""}${countries.length && descs.length ? " + " : ""}${descs.length ? `${descs.length} WT` : ""}`, html)
  } catch (e) { console.error("[notify] missing-master alert failed:", e) }
}

// ── Weekly "stuck document" reminder (Mon 08:00 ICT via Vercel Cron) ─────────────────
// Emails each approver a DIGEST of documents waiting on THEM, with how many days each has
// been sitting at the current stage + days since it was first submitted.
export async function sendWeeklyStuckAlerts(): Promise<{ docs: number; emailsSent: number }> {
  const ACTIVE_STATUSES = [
    "PENDING_DVM_MER", "PENDING_VP_MER",
    "PENDING_DVM_MER_EA", "PENDING_VP_MER_EA", "PENDING_DVM_MER_TRM", "PENDING_VP_MER_TRM",
    "PENDING_SCM", "PENDING_VP_SCM", "PENDING_PRESIDENT",
    "PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_LOGISTICS",
    "PENDING_VP_MER_GW", "PENDING_DPM_GW", "PENDING_GM_GW", "PENDING_PRESIDENT_GW",
    "PENDING_CLAIM_GW", "PENDING_LOGISTICS_GW",
  ]
  // Stages with a SPECIFIC assigned person (picked per-document) → remind only THAT person,
  // not every holder of the role. Everything else stays role-based (SCM/President/Logistics/Claim).
  const ASSIGNED_FOR: Record<string, (d: any) => string | null | undefined> = {
    PENDING_DVM_MER: d => d.assignedDvmMer, PENDING_DVM_MER_EA: d => d.assignedDvmMer, PENDING_DVM_MER_TRM: d => d.assignedDvmMer,
    PENDING_VP_MER: d => d.assignedVpMer, PENDING_VP_MER_EA: d => d.assignedVpMer, PENDING_VP_MER_TRM: d => d.assignedVpMer,
    PENDING_VP_MER_GW: d => d.assignedVpMer, PENDING_VP_SCM: d => d.assignedVpScm,
  }
  const docs = await (prisma.airRequest as any).findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    include: { approvalLogs: { orderBy: { createdAt: "desc" }, take: 1 }, items: true, claimForwards: true },
  })
  if (!docs.length) return { docs: 0, emailsSent: 0 }
  const now = Date.now()
  const daysAgo = (d: any) => Math.floor((now - new Date(d).getTime()) / 86400000)

  const digest = new Map<string, { docNo: string; stage: string; daysStage: number; daysTotal: number; bu: string }[]>()
  for (const doc of docs) {
    const docBu = doc.bu || "NYG"
    let recips: string[]
    const assignedGetter = ASSIGNED_FOR[doc.status]
    const assignedEmail = assignedGetter?.(doc)
    if (assignedEmail) {
      // Merch / VP SCM stages → only the specific person picked on this document.
      recips = [assignedEmail]
    } else if (["PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_CLAIM_GW"].includes(doc.status)) {
      // Claim stages → remind ONLY the claim depts that are ACTUALLY on this document (a
      // COMMERCIAL-only doc must not ping Procurement/NYK). COMMERCIAL = the merch person picked;
      // other depts by their entry/VP roles; plus Logistics (parallel) until Save & Send.
      const NO_APPROVAL = ["GW", "SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]
      const doneSt = ["DEPT_APPROVED", "COMPLETED", "REJECTED"]
      const pendingDepts = new Set<string>()
      for (const it of (doc.items || [])) for (const s of getSplits(it)) if (s.dept && !doneSt.includes(String(s.status || "")) && !NO_APPROVAL.includes(s.dept)) pendingDepts.add(s.dept)
      const set = new Set<string>()
      const addE = (e: any) => { if (e) set.add(String(e).toLowerCase()) }
      // A forwarded approver (per dept) is the CURRENT holder for their SOs → alert only them,
      // NOT the whole department. Track which depts are already forwarded so we don't also ping
      // the entry-role people (they've already handed it on).
      const forwardedDepts = new Set<string>()
      for (const f of (doc.claimForwards || [])) if (pendingDepts.has(f.dept) && f.nextEmail && (!Array.isArray(f.itemIds) || f.itemIds.length)) { addE(f.nextEmail); forwardedDepts.add(f.dept) }
      const roleSet = new Set<string>()
      for (const d of pendingDepts) {
        if (forwardedDepts.has(d)) continue // already forwarded → only the current holder above
        if (d === "COMMERCIAL") { addE(doc.assignedDvmMer || doc.assignedVpMer); continue }
        // Not yet forwarded → still at the ENTRY step, so remind only the entry role (the VP is
        // reached later via a forward, which is handled by the branch above — never ping VP early).
        for (const r of claimEntryRoles(d)) roleSet.add(r)
      }
      if (roleSet.size) {
        const us = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: { in: [...roleSet] } }, { roles: { hasSome: [...roleSet] } }] }, select: { email: true, bu: true, role: true, roles: true } })
        for (const u of us) {
          const held = [u.role, ...(u.roles || [])]
          const isNyk = held.some((r: string) => r && r.startsWith("SCM_NYK")) // NYK is cross-BU (bu often NYG)
          if (isNyk || !u.bu || u.bu === "ALL" || u.bu === docBu) addE(u.email)
        }
      }
      if (!doc.logisticsSent) {
        const lgRoles = docBu === "GW" ? ["LOGISTICS_GW"] : docBu === "TRM" ? ["LOGISTICS_TRM"] : ["LOGISTICS"]
        const lgUs = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: { in: lgRoles } }, { roles: { hasSome: lgRoles } }] }, select: { email: true, bu: true } })
        for (const u of lgUs) { if (docBu === "TRM" || !u.bu || u.bu === "ALL" || u.bu === docBu) addE(u.email) }
      }
      recips = [...set]
    } else if (doc.status === "PENDING_SCM") {
      // PENDING_SCM spans TWO sub-stages: SCM assigns claim (items PENDING) then VP SCM approves
      // (items PASSED). Remind SCM only while it still has SOs to assign; once everything is assigned,
      // remind VP SCM instead — otherwise SCM keeps getting alerts for work they've already finished
      // (and their Approvals queue is empty).
      const its = doc.items || []
      const needAssign = its.some((i: any) => i.itemStatus === "PENDING")
      const needVp = its.some((i: any) => i.itemStatus === "PASSED")
      const set2 = new Set<string>()
      const addE2 = (e: any) => { if (e) set2.add(String(e).toLowerCase()) }
      if (needAssign) {
        const us = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: "SCM_USER" }, { roles: { has: "SCM_USER" } }] }, select: { email: true, bu: true } })
        for (const u of us) if (!u.bu || u.bu === "ALL" || u.bu === docBu) addE2(u.email)
      }
      if (needVp) {
        if (doc.assignedVpScm) addE2(doc.assignedVpScm)
        else {
          const vps = await (prisma.user as any).findMany({ where: { isActive: true, OR: [{ role: "VP_SCM" }, { roles: { has: "VP_SCM" } }] }, select: { email: true, bu: true } })
          for (const u of vps) if (!u.bu || u.bu === "ALL" || u.bu === docBu) addE2(u.email)
        }
      }
      recips = [...set2]
    } else {
      // Role-based stages (or no assignee set) → all active holders of the role, scoped by BU.
      const rolesToNotify: string[] | undefined = STATUS_ROLES[doc.status]
      if (!rolesToNotify || !rolesToNotify.length) continue
      const users = await (prisma.user as any).findMany({
        where: { isActive: true, OR: [{ role: { in: rolesToNotify } }, { roles: { hasSome: rolesToNotify } }] },
        select: { email: true, bu: true },
      })
      recips = users.filter((u: any) => !u.bu || u.bu === "ALL" || u.bu === docBu).map((u: any) => u.email).filter(Boolean)
    }
    if (!recips.length) continue
    const lastAction = doc.approvalLogs?.[0]?.createdAt || doc.createdAt
    const row = {
      docNo: doc.documentNo, bu: docBu,
      stage: (STATUS_SUBJECT[doc.status] || doc.status).replace(/^\[/, "").replace(/\].*$/, ""),
      daysStage: daysAgo(lastAction), daysTotal: daysAgo(doc.createdAt),
    }
    for (const email of recips) {
      if (!digest.has(email)) digest.set(email, [])
      digest.get(email)!.push(row)
    }
  }

  let emailsSent = 0
  for (const [email, rows] of digest) {
    rows.sort((a, b) => b.daysStage - a.daysStage)
    const trs = rows.map(r => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.docNo}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.bu}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.stage}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;${r.daysStage >= 7 ? "color:#dc2626;font-weight:700" : ""}">${r.daysStage} days</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#64748b">${r.daysTotal} days</td></tr>`).join("")
    const html = `<!DOCTYPE html><html>${EMAIL_HEAD}<body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0"><tr><td align="center">
  <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#b45309;padding:18px 24px">
      <p style="margin:0;color:#fde68a;font-size:10px;letter-spacing:2px;font-family:Arial;text-transform:uppercase">Weekly Reminder</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:18px;font-family:Arial;font-weight:800">Documents Pending Action (${rows.length})</h1>
    </td></tr>
    <tr><td style="padding:20px 24px">
      <p style="color:#64748b;font-size:13px;font-family:Arial;margin:0 0 12px">The documents below are still awaiting action from you (red = pending over 7 days). Please log in to approve / fill in data.</p>
      <table style="border-collapse:collapse;width:100%;font-size:12px;font-family:Arial">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:6px 10px;text-align:left">Document</th><th style="padding:6px 10px;text-align:left">BU</th>
          <th style="padding:6px 10px;text-align:left">Stage</th><th style="padding:6px 10px;text-align:right">Pending at this stage</th>
          <th style="padding:6px 10px;text-align:right">Total since created</th></tr></thead>
        <tbody>${trs}</tbody></table>
      <div style="text-align:center;margin-top:18px">${emailButton(`${APP_URL}/approvals`, "Open Approval Queue →", "#b45309")}</div>
    </td></tr></table>
</td></tr></table></body></html>`
    await sendMail([email], `[Reminder] ${rows.length} documents pending action`, html).catch(() => {})
    emailsSent++
  }
  return { docs: docs.length, emailsSent }
}

// Resolve WHO actually handles one claim dept on THIS document — the SAME person(s) the
// initial PENDING_CLAIM alert targets, NOT every holder of the dept's role:
//   COMMERCIAL → the specific DVM MER picked on this doc (assignedDvmMer)
//   NYK        → the SCM NYK Action Approver(s) (cross-BU)
//   PRODUCTION → priority-1 CLAIM_PRODUCTION by the SO's factory G-group
//   PROCUREMENT→ PURCHASING priority-1 only
//   others     → the dept's priority-1 batch
// GW: SCM NYG → SCM_NYG; GW / SUPPLIER auto-approve → nobody to notify.
async function claimEntryUsersForDept(req: any, dept: string, items: any[]): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = []
  const push = (arr: any[]) => { for (const u of arr) if (u?.email) out.push({ id: u.id, email: u.email }) }

  // COMMERCIAL = the merch person picked on this doc.
  if (dept === "COMMERCIAL") {
    const email = (req as any).assignedDvmMer
    if (email) {
      const u = await prisma.user.findFirst({ where: { email, isActive: true } as any, select: { id: true, email: true } })
      if (u?.email) return [{ id: u.id, email: u.email }]
    }
    // no pick → fall through to the generic role-priority branch
  }
  // NYK = the 3-role Action Approver(s), cross-BU (match role OR roles[]).
  if (dept === "NYK" || dept === "SCM NYK") {
    const us = await prisma.user.findMany({
      where: { isActive: true, OR: [{ role: "SCM_NYK_APPROVER" }, { roles: { has: "SCM_NYK_APPROVER" } }] } as any,
      select: { id: true, email: true }, orderBy: [{ createdAt: "asc" }],
    })
    push(us)
    return out
  }
  // Which role(s) approve this dept's claim?
  let deptRoles: string[]
  if (req.bu === "GW") {
    if (dept === "SCM NYG" || dept === "NYG") deptRoles = ["SCM_NYG"]
    else return [] // GW / SUPPLIER = auto-approve → no claimer to notify
  } else deptRoles = claimEntryRoles(dept)

  // PRODUCTION entry → priority-1 by factory G-group.
  if (dept === "PRODUCTION") {
    const byGroup = new Map<string, any[]>()
    // No factory G-group (e.g. EA — one production approver, not per-G) → bucket "ALL" so an
    // all-G claimer (claimDepartment="ALL", e.g. theerawee) still receives the LG-files alert.
    for (const it of items) { const g = vpProdGroup((it as any).factory) || "ALL"; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g)!.push(it) }
    for (const [g] of byGroup) {
      const usAll = await prisma.user.findMany({
        where: { isActive: true, bu: { in: [(req as any).bu, "ALL"] }, OR: [{ role: { in: deptRoles } }, { roles: { hasSome: deptRoles } }] } as any,
        select: { id: true, email: true, priority: true, claimDepartment: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      })
      const us = usAll.filter((u: any) => prodGroupCovers(u.claimDepartment, g))
      const withP = us.filter((u: any) => u.priority != null)
      push(withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : us.slice(0, 1))
    }
    return out
  }
  // PROCUREMENT entry → PURCHASING only; others → dept priority-1 batch.
  const procFilter = dept === "PROCUREMENT" ? { procurementType: "PURCHASING" } : {}
  const users = await prisma.user.findMany({
    where: { isActive: true, bu: { in: [(req as any).bu, "ALL"] }, ...procFilter, OR: [{ role: { in: deptRoles } }, { roles: { hasSome: deptRoles } }] } as any,
    select: { id: true, email: true, priority: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })
  const withP = users.filter((u: any) => u.priority != null)
  push(withP.length ? withP.filter((u: any) => u.priority === withP[0].priority) : users.slice(0, 1))
  return out
}

export async function notifyLgFilesToClaimers(requestId: string) {
  return runWithTestMail(await docTestRecipient(requestId), () => notifyLgFilesToClaimersImpl(requestId))
}
async function notifyLgFilesToClaimersImpl(requestId: string) {
  try {
    const req: any = await prisma.airRequest.findUnique({
      where: { id: requestId },
      include: {
        items: true,
        createdBy: { select: { name: true, email: true } },
        approvalLogs: { include: { user: { select: { name: true, role: true, email: true } } }, orderBy: { createdAt: "asc" } },
        attachments: { include: { uploadedBy: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
        approvalSignatures: { orderBy: { signedAt: "asc" } },
      } as any,
    })
    if (!req) return
    const items = (req.items as any[]).filter(i => i.itemStatus !== "REJECTED")
    if (!items.length) return

    // (b) Combined signed PDF. Graph caps a whole message at ~4 MB — a big PDF would make
    // Graph REJECT the entire email (→ claimers get nothing). So attach the PDF only when
    // it's small enough; otherwise skip it and rely on the "Open Document" link.
    const MAX_INLINE = 3 * 1024 * 1024
    const fileAtts: { filename: string; contentBase64: string; contentType?: string }[] = []
    let pdfBytes = 0
    let pdfB64: string | null = null
    try {
      const { renderToBuffer } = await import("@react-pdf/renderer")
      const { CombinedPdfDocument } = await import("@/components/request-pdf")
      const React = await import("react")
      const el = React.default.createElement(CombinedPdfDocument as any, { pages: items.map(item => ({ req, item })) })
      const buf = await (renderToBuffer as any)(el)
      pdfBytes = (buf as any).length || 0
      pdfB64 = Buffer.from(buf).toString("base64")
    } catch (e) { console.error("[notify] claimer PDF render failed:", e) }
    const attachPdf = !!pdfB64 && pdfBytes <= MAX_INLINE
    if (attachPdf) fileAtts.push({ filename: `${req.documentNo}.pdf`, contentBase64: pdfB64!, contentType: "application/pdf" })

    // (a) LG-attached files — inline only if the running total stays under the budget.
    const lgCats = ["INV", "AWB", "EXPENSE", "COMBINE"]
    const lgAtts = (req.attachments || []).filter((x: any) => lgCats.includes(x.category))
    const lgTotal = lgAtts.reduce((s: number, a: any) => s + (a.fileSize || 0), 0)
    const inlineLg = attachPdf && (pdfBytes + lgTotal <= MAX_INLINE)
    if (inlineLg) {
      for (const a of lgAtts) {
        try {
          const { data } = await supabase.storage.from(BUCKET).download(a.filePath)
          if (data) {
            const ab = await (data as any).arrayBuffer()
            fileAtts.push({ filename: a.fileName, contentBase64: Buffer.from(ab).toString("base64"), contentType: a.mimeType || "application/octet-stream" })
          }
        } catch (e) { console.error("[notify] LG file download failed:", a.filePath, e) }
      }
    }
    // Download links (shown when files are too big to attach) — the doc PDF is always attached.
    const linksHtml = (!inlineLg && lgAtts.length)
      ? `<div style="margin:0 0 14px"><p style="color:#334155;font-size:13px;font-family:Arial,sans-serif;margin:0 0 6px"><strong>Attachments from Logistics</strong> (large files — click to download):</p>${lgAtts.map((a: any) => `<a href="${APP_URL}/api/attachments/${a.id}" style="display:block;font-family:Arial,sans-serif;font-size:12px;color:#1e3a8a;text-decoration:none;padding:2px 0">📎 ${a.fileName}</a>`).join("")}</div>`
      : ""

    // Group SOs by claim dept → email each dept's claimers.
    const deptSOs = new Map<string, string[]>()
    for (const it of items) for (const s of getSplits(it)) {
      if (!s.dept) continue
      if (!deptSOs.has(s.dept)) deptSOs.set(s.dept, [])
      deptSOs.get(s.dept)!.push(it.so)
    }
    const emailedSet = new Set<string>() // lower-cased emails already notified (avoid dup)
    for (const [dept, sos] of deptSOs) {
      // Only the people who actually handle this dept's claim on THIS document — same
      // resolution as the PENDING_CLAIM alert (picked COMMERCIAL DVM, PURCHASING p1, etc.),
      // NOT a blast to every holder of the dept's role.
      const deptItems = items.filter(it => getSplits(it).some(s => s.dept === dept))
      const recipients = await claimEntryUsersForDept(req, dept, deptItems)
      if (!recipients.length) continue
      // Each claimer gets a magic-login link straight to the document (where the generated
      // PDF is always downloadable) — so even if the PDF is too big to inline, they can get it.
      for (const u of recipients) {
      const openLink = await magicLoginFor(u.id, `/requests/${requestId}`)
      const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0"><tr><td align="center">
  <table width="500" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#1e3a8a;padding:20px;text-align:center">
      <p style="margin:0;color:#bfdbfe;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">CLAIM · ${dept.replace(/_/g, " ")}</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif;margin:0 0 6px">Document <strong>${req.documentNo}</strong> — Logistics has completed the data entry (${sos.length} SO)</p>
      <p style="color:#64748b;font-size:12px;font-family:Arial,sans-serif;margin:0 0 14px">${attachPdf ? "Attached: PDF document (signed) with this email" : "PDF document: click the button below to open/download (too large to attach)"} ${inlineLg && lgAtts.length ? "+ files from Logistics" : ""}</p>
      ${linksHtml}
      <div style="text-align:center;margin-top:8px">
        <a href="${openLink}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;font-family:Arial,sans-serif">Open Document / Download PDF →</a>
      </div>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`
      await sendMail(u.email, `[Claim – ${dept.replace(/_/g, " ")}] Logistics files ready — ${req.documentNo} (${sos.length} SO)`, html, fileAtts)
      emailedSet.add(String(u.email).toLowerCase())
      }
    }

    // FYI when Logistics is done (all BU): only the person who ENTERED THE DATA (the document
    // creator) + the FIRST person who APPROVED it. EXCLUDE the President. (Claim depts already
    // got their own email above; anyone already emailed is skipped.)
    const involved = new Map<string, string>() // lower-email → display name
    if ((req as any).createdBy?.email) involved.set(String((req as any).createdBy.email).toLowerCase(), (req as any).createdBy.name || (req as any).createdBy.email)
    const firstAppr = ((req as any).approvalLogs || []).find((l: any) =>
      l.action === "APPROVE" && l.user?.email && l.user?.role !== "PRESIDENT" && l.user?.role !== "PRESIDENT_GW")
    if (firstAppr?.user?.email) involved.set(String(firstAppr.user.email).toLowerCase(), firstAppr.user.name || firstAppr.user.email)
    // NYK only: also let the CR-NO person (SCM NYK CR user) know Logistics is done.
    const hasNyk = items.some((it: any) => getSplits(it).some((s: any) => s.dept === "NYK" || s.dept === "SCM NYK"))
    if (hasNyk && (req as any).assignedScmNykCr) {
      const cr = String((req as any).assignedScmNykCr)
      involved.set(cr.toLowerCase(), cr.split("@")[0])
    }
    const fyiLink = `${APP_URL}/requests/${requestId}`
    for (const [email, name] of involved) {
      if (emailedSet.has(email)) continue
      const fyiHtml = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0"><tr><td align="center">
  <table width="500" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#475569;padding:20px;text-align:center">
      <p style="margin:0;color:#cbd5e1;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">FYI · LOGISTICS COMPLETE</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif;margin:0 0 6px">Hello ${name},</p>
      <p style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif;margin:0 0 6px">Document <strong>${req.documentNo}</strong> — Logistics has completed the data entry (INV / HAWB / Actual Air). This is an FYI to all parties involved — no action required.</p>
      <p style="color:#64748b;font-size:12px;font-family:Arial,sans-serif;margin:0 0 14px">${attachPdf ? "Attached: the signed PDF document." : "Open the document below for the full details / PDF."}</p>
      <div style="text-align:center;margin-top:8px">
        <a href="${fyiLink}" style="display:inline-block;background:#475569;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;font-family:Arial,sans-serif">View Document →</a>
      </div>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`
      await sendMail(email, `[FYI] Logistics complete — ${req.documentNo}`, fyiHtml, fileAtts)
      emailedSet.add(email)
    }
  } catch (err) {
    console.error("[notify] LG-files-to-claimers error:", err)
  }
}

// Item 4 — weekly (Monday) reminder to Logistics: list documents that have reached a stage
// where LG can enter data but still have SO with NO Actual Air Freight (not filled yet).
// Emails the BU's LG role-holders a table with one-click Open-Document links.
export async function notifyLgPendingReminder(): Promise<{ sent: number; docs: number }> {
  // PENDING_SCM excluded — LG only acts AFTER VP SCM approves (doc → PENDING_PRESIDENT), so don't
  // remind LG while the doc is still at the SCM stage. Mirrors the Approvals-queue visibility rule.
  const NYG_ST = ["PENDING_PRESIDENT", "PENDING_CLAIM", "PENDING_VP_CLAIM"]
  const GW_ST = ["PENDING_CLAIM_GW", "PENDING_LOGISTICS_GW", "PENDING_PRESIDENT_GW"]
  const docs: any[] = await prisma.airRequest.findMany({
    where: { status: { in: [...NYG_ST, ...GW_ST] } },
    include: { items: { select: { itemStatus: true, actualAirFreight: true } } },
    orderBy: { createdAt: "asc" },
  })
  const pending = docs.filter(d => d.items.some((i: any) => i.itemStatus !== "REJECTED" && i.actualAirFreight == null))
  if (!pending.length) return { sent: 0, docs: 0 }

  const byBu: Record<string, any[]> = { NYG: [], GW: [] }
  for (const d of pending) byBu[d.bu === "GW" ? "GW" : "NYG"].push(d)

  let sent = 0
  for (const bu of ["NYG", "GW"] as const) {
    const list = byBu[bu]
    if (!list.length) continue
    const lgRole = bu === "GW" ? "LOGISTICS_GW" : "LOGISTICS"
    const lgUsers: any[] = await (prisma.user as any).findMany({ where: { isActive: true, role: lgRole }, select: { id: true, email: true } })
    for (const u of lgUsers) {
      if (!u.email) continue
      // One personal login token reused across this user's doc links (persists so older
      // email links keep working — not rotated on every notify).
      const token = await getLoginToken(u.id)
      const rows = list.map(d => {
        const missing = d.items.filter((i: any) => i.itemStatus !== "REJECTED" && i.actualAirFreight == null).length
        const link = `${APP_URL}/api/magic-login?token=${token}&redirect=/requests/${d.id}`
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;font-weight:600">${d.documentNo}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;color:#b45309">${missing} SO without Actual</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee"><a href="${link}" style="font-family:Arial,sans-serif;font-size:12px;color:#1e3a8a;font-weight:700;text-decoration:none">Open Document →</a></td>
        </tr>`
      }).join("")
      const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0"><tr><td align="center">
  <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#1e3a8a;padding:20px;text-align:center">
      <p style="margin:0;color:#bfdbfe;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">⏰ LOGISTICS REMINDER (${bu})</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-family:Arial,sans-serif;font-weight:800;letter-spacing:2px">AIR REQUEST</h1>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="color:#1e293b;font-size:14px;font-family:Arial,sans-serif;margin:0 0 14px">There are <strong>${list.length}</strong> documents still awaiting Logistics to enter INV / HAWB / Actual Air Freight — please go in and complete them.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#eff6ff">
          <th style="padding:6px 10px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#1e40af">DOC NO</th>
          <th style="padding:6px 10px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#1e40af">Status</th>
          <th style="padding:6px 10px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#1e40af"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif">Air Request System · Nan Yang Textile Group · Automatic reminder every Monday</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`
      await sendMail(u.email, `[Reminder] Documents awaiting Logistics data entry (${bu}) — ${list.length} docs`, html)
      sent++
    }
  }
  return { sent, docs: pending.length }
}
