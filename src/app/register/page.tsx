"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

const POSITIONS = [
  { value: "MER", label: "MER" },
  { value: "SCM", label: "SCM" },
  { value: "LOGISTICS", label: "LOGISTICS" },
]

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", bu: "NYG", position: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.email.toLowerCase().endsWith("@nanyangtextile.com")) {
      setError("ต้องใช้ email ของบริษัท (@nanyangtextile.com)")
      return
    }
    if (form.password !== form.confirm) {
      setError("รหัสผ่านไม่ตรงกัน")
      return
    }
    if (form.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร")
      return
    }
    setLoading(true)
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, email: form.email, password: form.password, bu: form.bu, position: form.position })
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setDone(true)
    } else {
      setError(data.error || "เกิดข้อผิดพลาด")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #bfdbfe 0%, #e0e7ff 50%, #ddd6fe 100%)" }}>
      <div className="relative w-full max-w-md px-4">
        <div className="flex justify-center mb-0 relative z-10">
          <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ marginBottom: "-40px" }}>
            <Image src="/LOGO.png" alt="Nan Yang Textile" width={56} height={56} className="object-contain" unoptimized />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl px-10 pt-14 pb-10">
          {done ? (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">📧</div>
              <h2 className="text-lg font-bold text-gray-800">ตรวจสอบ Email ของคุณ</h2>
              <p className="text-gray-500 text-sm leading-relaxed">ส่ง link ยืนยันไปที่ email แล้ว<br/>กรุณาคลิก link เพื่อเริ่มใช้งาน</p>
              <p className="text-xs text-gray-400">Link มีอายุ 24 ชั่วโมง</p>
            </div>
          ) : (
          <>
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-800">สมัครใช้งาน</h1>
            <p className="text-gray-400 text-xs mt-1">Air Request System · Nan Yang Textile</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
            <input type="email" placeholder="Email (@nanyangtextile.com)" value={form.email} onChange={set("email")} required
              autoComplete="off"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />

            <div className="grid grid-cols-2 gap-3">
              <select value={form.bu} onChange={set("bu")} required
                className="bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="NYG">NYG</option>
                <option value="GW">GW</option>
              </select>
              <select value={form.position} onChange={set("position")} required
                className="bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">-- Position --</option>
                {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <input type="password" placeholder="รหัสผ่าน (6 ตัวขึ้นไป)" value={form.password} onChange={set("password")} required
              autoComplete="new-password"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />

            <input type="password" placeholder="ยืนยันรหัสผ่าน" value={form.confirm} onChange={set("confirm")} required
              autoComplete="new-password"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />

            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
              style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
              {loading ? "กำลังสมัคร..." : "สมัครใช้งาน"}
            </button>

            <p className="text-center text-xs text-gray-400 pt-1">
              มีบัญชีแล้ว?{" "}
              <Link href="/login" className="text-blue-600 font-medium hover:underline">เข้าสู่ระบบ</Link>
            </p>
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
