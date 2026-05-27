import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendMail(to: string | string[], subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  const recipients = Array.isArray(to) ? to : [to]
  if (!recipients.length) return
  await resend.emails.send({
    from: process.env.SMTP_FROM || "Air Request System <onboarding@resend.dev>",
    to: recipients,
    subject,
    html,
  })
}
