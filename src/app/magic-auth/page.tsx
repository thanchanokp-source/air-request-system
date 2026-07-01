"use client"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, signOut } from "next-auth/react"

function MagicAuthContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<"loading" | "error">("loading")

  useEffect(() => {
    const token = params.get("token")
    const redirect = params.get("redirect") || "/dashboard"
    if (!token) { setStatus("error"); return }

    signOut({ redirect: false })
      .then(() => signIn("credentials", { magicToken: token, redirect: false }))
      .then(res => {
        if (res?.ok) {
          router.replace(redirect)
        } else {
          setStatus("error")
        }
      })
  }, [])

  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 16 }}>Link ไม่ถูกต้องหรือหมดอายุ</p>
          <a href="/login" style={{ color: "#1d4ed8", fontSize: 14 }}>กลับสู่หน้า Login</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTop: "4px solid #1e3a8a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#64748b", fontSize: 14 }}>กำลังเข้าสู่ระบบ...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

export default function MagicAuthPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTop: "4px solid #1e3a8a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <MagicAuthContent />
    </Suspense>
  )
}
