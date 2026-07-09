"use client"
import { signIn } from "next-auth/react"
import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sendingLink, setSendingLink] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const router = useRouter()
  const params = useSearchParams()
  const registered = params.get("registered")

  async function sendLoginLink() {
    if (!email) { setError("Please enter your email first"); return }
    setSendingLink(true); setError("")
    try {
      await fetch("/api/auth/request-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })
      setLinkSent(true)
    } catch { setError("Could not send the login link. Please try again") }
    setSendingLink(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.ok) {
      router.push("/dashboard")
    } else {
      setError("Invalid email or password")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #bfdbfe 0%, #e0e7ff 50%, #ddd6fe 100%)" }}>
      <div className="relative w-full max-w-md px-4">
        {/* Logo circle floating above card */}
        <div className="flex justify-center mb-0 relative z-10">
          <div className="w-36 h-36 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ marginBottom: "-72px" }}>
            <Image src="/LOGO.png" alt="Nan Yang Textile" width={80} height={80} className="object-contain" loading="eager" unoptimized />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl px-10 pt-24 pb-10">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-800">Air Request System</h1>
            <p className="text-gray-400 text-xs mt-1">Nan Yang Textile</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="off"
                className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                required
              />
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                required
              />
            </div>

            {registered && <p className="text-green-600 text-xs text-center">Registration successful — you can now sign in</p>}
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
                      {loading ? "Logging in..." : "LOGIN"}
            </button>

            {/* Passwordless — email me a login link (no password / no admin setup) */}
            <div className="flex items-center gap-2 py-1">
              <div className="h-px bg-gray-200 flex-1" /><span className="text-[11px] text-gray-400">or</span><div className="h-px bg-gray-200 flex-1" />
            </div>
            {linkSent ? (
              <p className="text-green-600 text-xs text-center bg-green-50 border border-green-200 rounded-xl py-2.5 px-3">✓ Login link sent — please check your email<br /><span className="text-green-500">{email}</span></p>
            ) : (
              <button type="button" onClick={sendLoginLink} disabled={sendingLink}
                className="group w-full py-3 rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50 to-blue-100/70 hover:from-blue-100 hover:to-blue-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2.5">
                {sendingLink ? (
                  <span className="text-blue-700 font-semibold text-sm">Sending link…</span>
                ) : (
                  <>
                    <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="5" width="18" height="14" rx="2.5" /><path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
                      </svg>
                    </span>
                    <span className="text-left leading-tight">
                      <span className="block text-sm font-semibold text-blue-800">Email me a login link</span>
                      <span className="block text-[11px] text-blue-500">No password · sent to your @nanyangtextile.com</span>
                    </span>
                  </>
                )}
              </button>
            )}

            <p className="text-center text-xs text-gray-400 pt-1">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-blue-600 font-medium hover:underline">Sign Up</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
