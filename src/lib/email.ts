async function getAccessToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Graph token error: ${JSON.stringify(data)}`)
  return data.access_token
}

import { getEmailOverride } from "./settings"

export type MailAttachment = { filename: string; contentBase64: string; contentType?: string }

// Build the Microsoft Graph fileAttachment array (base64 inline). Graph's simple sendMail
// caps the whole message at ~4 MB, so keep attachments small (PDF + a few files).
function graphAttachments(attachments?: MailAttachment[]) {
  if (!attachments?.length) return undefined
  return attachments.filter(a => a.contentBase64).map(a => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: a.filename,
    contentType: a.contentType || "application/octet-stream",
    contentBytes: a.contentBase64,
  }))
}

export async function sendMail(to: string | string[], subject: string, html: string, attachments?: MailAttachment[]) {
  const sender = process.env.GRAPH_SENDER
  if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !sender) {
    console.warn("[email] Microsoft Graph not configured — skipping")
    return
  }

  // DB toggle (admin UI) wins; env var is the fallback. When set, ALL mail goes here.
  const override = await getEmailOverride()
  const originalTo = Array.isArray(to) ? to.join(", ") : to
  const graphAtts = graphAttachments(attachments)

  const token = await getAccessToken()

  if (override) {
    // TEST MODE: skip real recipients (may be fake), send monitor-only copy.
    // Pull the position/role tag from the subject (e.g. "[VP SCM] ..." → "VP SCM") so the
    // tester can tell WHICH stage each intercepted mail is for — vital when several arrive
    // at once (e.g. Claim + Logistics + Accounting all fire when VP SCM approves).
    const posTag = (subject.match(/^\s*\[([^\]]+)\]/)?.[1] || "").trim()
    console.log(`[email][TEST] intercept → ${override}  [${posTag}] (meant for: ${originalTo})`)
    const monitorHtml = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:2px solid #f59e0b;overflow:hidden">
      <tr><td style="background:#f59e0b;padding:12px 20px">
        <p style="margin:0;color:#fff;font-size:12px;font-weight:700;font-family:Arial,sans-serif">
          🧪 TEST — MONITORING COPY
        </p>
      </td></tr>
      <tr><td style="padding:16px 20px 4px;font-family:Arial,sans-serif">
        ${posTag ? `<p style="margin:0 0 8px"><span style="display:inline-block;background:#1e293b;color:#fff;font-size:13px;font-weight:700;padding:4px 12px;border-radius:6px">📍 ${posTag}</span></p>` : ""}
        <p style="margin:0;color:#6b7280;font-size:12px">ปกติจะส่งหา (meant for): <strong style="color:#b45309">${originalTo}</strong></p>
      </td></tr>
      <tr><td style="padding:8px 20px 20px;font-family:Arial,sans-serif;font-size:13px;color:#374151">
        ${html}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

    const monRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            // Prepend the intended recipient (name before @) so several parallel test
            // mails are distinguishable straight from the inbox list, without opening.
            subject: `[TEST→${(Array.isArray(to) ? to[0] : to || "").split("@")[0]}] ${subject}`,
            body: { contentType: "HTML", content: monitorHtml },
            toRecipients: [{ emailAddress: { address: override } }],
            ...(graphAtts ? { attachments: graphAtts } : {}),
          },
          saveToSentItems: true,
        }),
      }
    )
    if (monRes.ok) console.log(`[email][MONITOR] sent to ${override}`)
    else console.warn(`[email][MONITOR] failed: ${monRes.status}`)
    return
  }

  // PRODUCTION: send to real recipients
  console.log(`[email] sending to: ${originalTo}`)
  const recipients = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map(email => ({ emailAddress: { address: email } }))
  if (!recipients.length) return

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: recipients,
          ...(graphAtts ? { attachments: graphAtts } : {}),
        },
        saveToSentItems: true,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    console.error(`[email] sendMail failed: ${res.status}`, err)
    throw new Error(`Graph sendMail failed: ${res.status} ${err}`)
  }
  console.log(`[email] sent to ${originalTo}`)
}
