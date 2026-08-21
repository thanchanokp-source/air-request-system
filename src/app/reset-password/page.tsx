"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch("/api/auth/request-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }).catch(() => {})
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #bfdbfe 0%, #e0e7ff 50%, #ddd6fe 100%)" }}>
      <div className="relative w-full max-w-md px-4">
        <div className="flex justify-center mb-0 relative z-10">
          <div className="w-28 h-28 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ marginBottom: "-56px" }}>
            <Image src="/LOGO.png" alt="Nan Yang Textile" width={90} height={90} className="object-contain" unoptimized />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl px-10 pt-20 pb-10">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <h2 className="text-lg font-bold text-gray-800">Check your email</h2>
              <p className="text-gray-500 text-sm">If an account exists for that address, we&apos;ve sent a link to set a new password. The link is valid for 48 hours.</p>
              <button onClick={() => router.push("/login")}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <h1 className="text-xl font-bold text-gray-800">Forgot Password</h1>
                <p className="text-gray-400 text-xs mt-1">Enter your company email to get a reset link</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="email" placeholder="name@nanyangtextile.com" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
              <div className="text-center mt-4">
                <button onClick={() => router.push("/login")} className="text-xs text-gray-400 hover:text-gray-600">← Back to Sign In</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
