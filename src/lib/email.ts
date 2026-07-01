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

export async function sendMail(to: string | string[], subject: string, html: string) {
  const sender = process.env.GRAPH_SENDER
  if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !sender) {
    console.warn("[email] Microsoft Graph not configured — skipping")
    return
  }

  const override = process.env.TEST_EMAIL_OVERRIDE
  const originalTo = Array.isArray(to) ? to.join(", ") : to

  const token = await getAccessToken()

  if (override) {
    // TEST MODE: skip real recipients (may be fake), send monitor-only copy
    console.log(`[email][TEST] intercept → ${override}  (meant for: ${originalTo})`)
    const monitorHtml = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:2px solid #f59e0b;overflow:hidden">
      <tr><td style="background:#f59e0b;padding:12px 20px">
        <p style="margin:0;color:#fff;font-size:12px;font-weight:700;font-family:Arial,sans-serif">
          📋 MONITORING COPY — ส่งถึง: ${originalTo}
        </p>
      </td></tr>
      <tr><td style="padding:20px;font-family:Arial,sans-serif;font-size:13px;color:#374151">
        <p style="margin:0 0 16px;color:#6b7280;font-size:12px">⚠️ TEST — meant for: <strong>${originalTo}</strong></p>
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
            subject: `[MONITOR] ${subject}`,
            body: { contentType: "HTML", content: monitorHtml },
            toRecipients: [{ emailAddress: { address: override } }],
          },
          saveToSentItems: false,
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
        },
        saveToSentItems: false,
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
