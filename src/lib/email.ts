import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { ciphers: "SSLv3" },
})

export async function sendMail(to: string | string[], subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return
  const recipients = Array.isArray(to) ? to.join(",") : to
  if (!recipients) return
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject,
    html,
  })
}
