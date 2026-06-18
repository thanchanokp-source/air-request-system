"use client"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
            <Image src="/LOGO.png" alt="Nan Yang Textile" width={110} height={110} className="object-contain" />
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

            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
              {loading ? "Logging in..." : "LOGIN"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
