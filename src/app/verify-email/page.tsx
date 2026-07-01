"use client"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

function VerifyEmailContent() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") || ""

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("ไม่พบ token"); return }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    fetch(`/api/verify-email?token=${token}`, { signal: controller.signal })
      .then(async r => {
        clearTimeout(timeout)
        const text = await r.text()
        try {
          const d = JSON.parse(text)
          if (d.ok) setStatus("success")
          else { setStatus("error"); setMessage(d.error || "เกิดข้อผิดพลาด") }
        } catch {
          setStatus("error"); setMessage("Server error — กรุณาลองใหม่")
        }
      })
      .catch(e => {
        clearTimeout(timeout)
        setStatus("error")
        setMessage(e?.name === "AbortError" ? "หมดเวลา กรุณาลองใหม่" : "เชื่อมต่อไม่ได้")
      })
    return () => { clearTimeout(timeout); controller.abort() }
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #bfdbfe 0%, #e0e7ff 50%, #ddd6fe 100%)" }}>
      <div className="relative w-full max-w-md px-4">
        <div className="flex justify-center mb-0 relative z-10">
          <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ marginBottom: "-40px" }}>
            <Image src="/LOGO.png" alt="Nan Yang Textile" width={56} height={56} className="object-contain" unoptimized />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl px-10 pt-14 pb-10 text-center space-y-4">
          {status === "loading" && (
            <>
              <div className="text-3xl animate-pulse">⏳</div>
              <p className="text-gray-500 text-sm">กำลังยืนยัน email...</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="text-4xl">✅</div>
              <h2 className="text-lg font-bold text-gray-800">ยืนยัน Email สำเร็จ</h2>
              <p className="text-gray-500 text-sm">สามารถเข้าสู่ระบบได้แล้ว</p>
              <button onClick={() => router.push("/login")}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
                เข้าสู่ระบบ
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-4xl">❌</div>
              <h2 className="text-lg font-bold text-gray-800">ยืนยันไม่สำเร็จ</h2>
              <p className="text-red-500 text-sm">{message}</p>
              <Link href="/register" className="block text-xs text-blue-600 hover:underline">สมัครใหม่</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>
}
