"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

const NYG_REQUIRED = [
  "STYLE", "SO", "CUSTOMER PO", "DESCRIPTION",
  "Original Shipment Date", "Plan Shipment Date",
  "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)",
  "Reason delay", "Factory", "Country", "Port", "WEIGHT(KG)",
  "Brand name", "BU",
]

const GW_REQUIRED = [
  "STYLE", "SO", "CUSTOMER PO", "DESCRIPTION",
  "Original Shipment Date", "Plan Shipment Date",
  "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)",
  "Reason delay", "Claim", "Country", "Port", "WEIGHT(KG)",
  "Brand name", "BU",
]

export default function NewRequestPage() {
  const { data: session } = useSession()
  const userBu = (session?.user as any)?.bu || "NYG"
  const isGW = userBu === "GW"

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const [vpMerSelected, setVpMerSelected] = useState<{ name: string; email: string } | null>(null)
  const [vpMerUsers, setVpMerUsers] = useState<any[]>([])

  useEffect(() => {
    const role = isGW ? "VP_MER_GW" : "VP_MER"
    fetch(`/api/users/by-role?role=${role}`)
      .then(r => r.json())
      .then(users => {
        const list = Array.isArray(users) ? users : []
        setVpMerUsers(list)
        if (list.length === 1) setVpMerSelected({ name: list[0].name, email: list[0].email })
      })
  }, [isGW])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError("")
    setPreview([])
    const form = new FormData()
    form.append("file", f)
    const res = await fetch("/api/upload", { method: "POST", body: form })
    const data = await res.json()
    if (!data.rows || data.rows.length === 0) {
      setError("ไม่พบข้อมูลในไฟล์ กรุณาตรวจสอบและอัพโหลดใหม่")
      return
    }
    const required = isGW ? GW_REQUIRED : NYG_REQUIRED
    const cols = Object.keys(data.rows[0]).map((c: string) => c.toLowerCase())

    // 1. ตรวจ discriminating column — ถ้าไม่มี = ผิด template
    const discriminator = isGW ? "claim" : "factory"
    if (!cols.includes(discriminator)) {
      setError("ข้อมูลไม่ถูกต้อง กรุณาใช้ template ที่กำหนด")
      return
    }

    // 2. ตรวจ required columns ครบไหม — ถ้าไม่ครบ = ผิด template
    const missing = required.filter(c => !cols.includes(c.toLowerCase()))
    if (missing.length > 0) {
      setError("ข้อมูลไม่ถูกต้อง กรุณาใช้ template ที่กำหนด")
      return
    }

    // 3. ตรวจ WEIGHT(KG) มีข้อมูลทุก row ไหม
    const getVal = (row: any, key: string) => {
      const k = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase())
      return k ? row[k] : null
    }
    const missingWeight = data.rows.some((row: any) => {
      const w = getVal(row, "WEIGHT(KG)")
      return w === null || w === undefined || w === ""
    })
    if (missingWeight) {
      setError("กรุณาเพิ่มข้อมูลช่อง WEIGHT(KG)")
      return
    }

    setPreview(data.rows)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || preview.length === 0) return
    if (!vpMerSelected) { setError(`กรุณาเลือก ${isGW ? "VP MER GW" : "VP MER"} ก่อน Submit`); return }
    setLoading(true)
    setError("")
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: preview,
        assignedVpMer: vpMerSelected.email,
        bu: userBu,
      })
    })
    const data = await res.json()
    if (data.id && file) {
      const attachForm = new FormData()
      attachForm.append("file", file)
      await fetch(`/api/requests/${data.id}/attachments`, { method: "POST", body: attachForm })
    }
    setLoading(false)
    if (data.id) {
      if (data.missingPorts?.length > 0) {
        alert(`⚠️ Port ต่อไปนี้ไม่มีใน Master — Est. Air Freight จะเป็น 0:\n\n${data.missingPorts.join(", ")}\n\nกรุณาเพิ่ม Rate ใน Master > Port แล้วใช้ Recalculate`)
      }
      router.push(`/requests/${data.id}`)
    } else {
      setError(data.error || "Something went wrong")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">New Air Request</h1>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${isGW ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
          {userBu}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Select VP MER */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="font-semibold text-gray-800">
            เลือก {isGW ? "VP MER GW" : "VP MER"} <span className="text-red-500">*</span>
          </h2>

          {vpMerUsers.length === 0 ? (
            <p className="text-sm text-red-500">ไม่พบผู้อนุมัติใน Master — กรุณาเพิ่ม {isGW ? "VP_MER_GW" : "VP_MER"} ใน User Management</p>
          ) : vpMerUsers.length === 1 ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-green-800">{vpMerUsers[0].name}</p>
                <p className="text-xs text-green-600">{vpMerUsers[0].email}</p>
              </div>
              <span className="ml-auto text-xs text-green-500 font-medium">Auto-selected</span>
            </div>
          ) : (
            <select
              value={vpMerSelected?.email || ""}
              onChange={e => {
                const u = vpMerUsers.find(u => u.email === e.target.value)
                setVpMerSelected(u ? { name: u.name, email: u.email } : null)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">-- เลือก {isGW ? "VP MER GW" : "VP MER"} --</option>
              {vpMerUsers.map(u => (
                <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
              ))}
            </select>
          )}
        </div>

        {/* Upload Excel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Upload Excel File</h2>
            <a href={isGW ? "/api/template?bu=GW" : "/api/template?bu=NYG"} download
              className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">
              ⬇ Download Template {isGW ? "(GW)" : "(NYG)"}
            </a>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {preview.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Preview ({preview.length} rows)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(preview[0] || {}).map(k => (
                      <th key={k} className="text-left px-3 py-2 font-medium text-gray-600">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {Object.values(row).map((v: any, j) => (
                        <td key={j} className="px-3 py-2 text-gray-700">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || preview.length === 0 || !vpMerSelected}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Submitting..." : "Submit Request"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
