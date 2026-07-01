"use client"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"

function SetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") || ""

  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null)
  const [tokenError, setTokenError] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setTokenError("ไม่พบ token"); return }
    fetch(`/api/set-password?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setTokenError(d.error)
        else setUserInfo(d)
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน"); return }
    if (password.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return }
    setLoading(true)
    const res = await fetch("/api/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) setDone(true)
    else setError(data.error || "เกิดข้อผิดพลาด")
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
          {tokenError ? (
            <div className="text-center space-y-3">
              <p className="text-red-500 font-medium">{tokenError}</p>
              <p className="text-gray-400 text-xs">กรุณาติดต่อ Admin เพื่อขอ link ใหม่</p>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <h2 className="text-lg font-bold text-gray-800">ตั้งรหัสผ่านสำเร็จ</h2>
              <p className="text-gray-500 text-sm">สามารถเข้าสู่ระบบได้แล้ว</p>
              <button onClick={() => router.push("/login")}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
                เข้าสู่ระบบ
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <h1 className="text-xl font-bold text-gray-800">ตั้งรหัสผ่าน</h1>
                {userInfo && <p className="text-gray-400 text-xs mt-1">{userInfo.name} · {userInfo.email}</p>}
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="password" placeholder="รหัสผ่านใหม่ (6 ตัวขึ้นไป)" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <input type="password" placeholder="ยืนยันรหัสผ่าน" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
                  {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่าน"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return <Suspense><SetPasswordForm /></Suspense>
}
