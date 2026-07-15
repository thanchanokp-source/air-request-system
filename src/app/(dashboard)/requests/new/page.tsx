"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"

// Port is no longer used — freight rate is keyed by Brand + Country.
const NYG_REQUIRED = [
  "STYLE", "SO", "CUSTOMER PO", "DESCRIPTION",
  "Original Shipment Date", "Plan Shipment Date",
  "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)",
  "Factory", "Country",
  "Brand name", "BU",
]

const GW_REQUIRED = [
  "STYLE", "SO", "CUSTOMER PO", "DESCRIPTION",
  "Original Shipment Date", "Plan Shipment Date",
  "QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)",
  "Factory", "Country",
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

  // Master Description reference — the DESCRIPTION column in the Excel must match one of these.
  const [masterDesc, setMasterDesc] = useState<any[]>([])
  const [showMaster, setShowMaster] = useState(false)
  useEffect(() => { fetch("/api/master/description").then(r => r.json()).then(d => setMasterDesc(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
  const downloadMasterExcel = () => {
    const rows = masterDesc.map((m: any) => ({ "DESCRIPTION": m.name, "WT CHARGE/PC (KG)": m.weightPerUnit }))
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "DESCRIPTION": "", "WT CHARGE/PC (KG)": "" }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Master Description")
    XLSX.writeFile(wb, "Master_Description.xlsx")
  }

  useEffect(() => {
    // GW first approver may be role DPM_GW or legacy VP_MER_GW — fetch both.
    // Scope by BU so a NYG VP MER never shows up for a GW document (and vice versa).
    const roles = isGW ? ["DPM_GW", "VP_MER_GW"] : ["VP_MER"]
    Promise.all(roles.map(r => fetch(`/api/users/by-role?role=${r}&bu=${userBu}`).then(res => res.json()).catch(() => [])))
      .then(results => {
        const seen = new Set<string>()
        const list: any[] = []
        for (const res of results) {
          if (!Array.isArray(res)) continue
          for (const u of res) { if (u?.email && !seen.has(u.email)) { seen.add(u.email); list.push(u) } }
        }
        setVpMerUsers(list)
        if (list.length === 1) setVpMerSelected({ name: list[0].name, email: list[0].email })
      })
  }, [isGW, userBu])

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
      setError("No data found in the file. Please check and upload again")
      return
    }
    const required = isGW ? GW_REQUIRED : NYG_REQUIRED
    const cols = Object.keys(data.rows[0]).map((c: string) => c.toLowerCase())

    // 1. Check discriminating column — the new NYG/GW template uses the same column (Factory)
    if (!cols.includes("factory")) {
      setError("Invalid data. Please use the specified template")
      return
    }

    // 2. Check whether all required columns are present — if not, the template is wrong
    const missing = required.filter(c => !cols.includes(c.toLowerCase()))
    if (missing.length > 0) {
      setError("Invalid data. Please use the specified template")
      return
    }

    // Skip non-data rows. A real row is identified by SO or STYLE — templates
    // often leave stray values (formatting, a lone 0) in otherwise-empty trailing
    // rows, so "fully blank" isn't enough; require SO or STYLE to treat as data.
    const cellVal = (row: any, key: string) => {
      const k = Object.keys(row).find(kk => kk.toLowerCase() === key.toLowerCase())
      return k ? row[k] : null
    }
    const hasKey = (v: any) => v != null && String(v).trim() !== ""
    const rows = data.rows.filter((row: any) => hasKey(cellVal(row, "SO")) || hasKey(cellVal(row, "STYLE")))
    if (rows.length === 0) {
      setError("No data rows found — every row is missing both SO and STYLE. Please fill in the template")
      return
    }

    // ── 3. Per-row validation: completeness + formats. Collect ALL issues. ──
    const getVal = (row: any, key: string) => {
      const k = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase())
      return k ? row[k] : null
    }
    // Valid date = a real Date/ISO (xlsx returns date cells as Date), or text
    // dd/mm/yyyy, or text "dd Mmm yy" / "dd Mmm yyyy" (e.g. 18 Dec 25).
    const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    const isValidDateVal = (v: any) => {
      const s = String(v).trim()
      if (!isNaN(new Date(s).getTime())) return true
      const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
      if (m) { const d = +m[1], mo = +m[2]; return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 }
      const m2 = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,})[\s\-]+(\d{2,4})$/) // 18 Dec 25
      if (m2) { const d = +m2[1]; return d >= 1 && d <= 31 && MONTHS.includes(m2[2].slice(0, 3).toLowerCase()) }
      return false
    }
    const isEmpty = (v: any) => v == null || String(v).trim() === ""
    // Fields required in EVERY row (Brand/BU are doc-level → checked via columns only).
    const perRowRequired = required.filter(f => !["Brand name", "BU"].includes(f))
    const numFields = ["QTY Original Shipment (pcs)", "QTY Request ship Air (pcs)"]
    const dateFields = ["Original Shipment Date", "Plan Shipment Date"]
    const validDepts = (isGW
      ? ["SCM NYK", "SCM NYG", "GW", "SUPPLIER", "SUPPLIER_IN", "SUPPLIER_OUT"]
      : ["COMMERCIAL", "PRODUCTION", "PROCUREMENT", "NYK", "SCM NYK"]
    ).map(d => d.toUpperCase().replace(/\s+/g, " ").trim())

    const errs: string[] = []
    rows.forEach((row: any, idx: number) => {
      const so = getVal(row, "SO") || `Row ${idx + 2}`
      // completeness
      for (const f of perRowRequired) if (isEmpty(getVal(row, f))) errs.push(`SO ${so}: missing "${f}"`)
      // numbers
      for (const f of numFields) {
        const v = getVal(row, f)
        if (!isEmpty(v) && isNaN(Number(String(v).replace(/,/g, "")))) errs.push(`SO ${so}: "${f}" must be a number (got "${v}")`)
      }
      // dates
      for (const f of dateFields) {
        const v = getVal(row, f)
        if (!isEmpty(v) && !isValidDateVal(v)) errs.push(`SO ${so}: "${f}" wrong date format (got "${v}")`)
      }
      // claim splits: dept spelling, % numeric, dept/% paired, sum = 100
      const depts = [1, 2, 3].map(n => String(getVal(row, `CLAIM DEPT ${n}`) || "").trim())
      if (depts.some(d => d)) {
        let sum = 0
        for (const n of [1, 2, 3]) {
          const d = depts[n - 1]
          const pctRaw = getVal(row, `%CLAIM${n}`)
          const pctHas = !isEmpty(pctRaw)
          if (d) {
            if (!validDepts.includes(d.toUpperCase().replace(/\s+/g, " ").trim())) errs.push(`SO ${so}: CLAIM DEPT ${n} "${d}" not recognized (check spelling)`)
            const pct = parseFloat(String(pctRaw ?? ""))
            if (isNaN(pct)) errs.push(`SO ${so}: %CLAIM${n} must be a number (got "${pctRaw ?? ""}")`)
            else sum += pct
          } else if (pctHas) {
            errs.push(`SO ${so}: %CLAIM${n} has a value but CLAIM DEPT ${n} is empty`)
          }
        }
        if (Math.round(sum) !== 100) errs.push(`SO ${so}: sum of %CLAIM = ${sum}% (must be 100)`)
      }
    })

    if (errs.length > 0) {
      const shown = errs.slice(0, 40)
      setError(`Found ${errs.length} issue(s) — please fix and re-upload:\n• ${shown.join("\n• ")}${errs.length > 40 ? `\n… and ${errs.length - 40} more` : ""}`)
      return
    }

    setPreview(rows)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || preview.length === 0) return
    if (!vpMerSelected) { setError(`Please select a ${isGW ? "DPM GW" : "VP MER"} before submitting`); return }
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
      if (data.missingRates?.length > 0) {
        alert(`⚠️ The following Brand/Country pairs are not in Master — Est. Air Freight will be 0:\n\n${data.missingRates.map((x: any) => `${x.brand} / ${x.country}`).join("\n")}\n\nPlease add the Rate in Master > Rate, then use Recalculate`)
      }
      router.push(`/requests/${data.id}`)
    } else {
      setError(data.error || "Something went wrong")
    }
  }

  return (
    <div className="space-y-6">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[260px]">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-gray-800 text-sm">Submitting request...</p>
              <p className="text-xs text-gray-400 mt-1">Please do not close this page.</p>
            </div>
          </div>
        </div>
      )}
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
            Select {isGW ? "DPM GW" : "VP MER"} <span className="text-red-500">*</span>
          </h2>

          {vpMerUsers.length === 0 ? (
            <p className="text-sm text-red-500">No approver found in Master — please add a {isGW ? "DPM_GW" : "VP_MER"} in User Management</p>
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
              <option value="">-- Select {isGW ? "DPM GW" : "VP MER"} --</option>
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

        {/* Master Description reference — DESCRIPTION in the Excel must match one of these */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold text-gray-800">Master Description</h2>
              <p className="text-xs text-gray-400 mt-0.5">The DESCRIPTION in your Excel must match one of these names (WT CHARGE/PC is used to compute Gross Weight)</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={downloadMasterExcel}
                className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">
                ⬇ Excel
              </button>
              <button type="button" onClick={() => setShowMaster(v => !v)}
                className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 font-medium">
                {showMaster ? "Hide" : "Show"} ({masterDesc.length})
              </button>
            </div>
          </div>
          {showMaster && (
            <div className="border border-gray-200 rounded-lg overflow-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">DESCRIPTION</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">WT CHARGE/PC (KG)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {masterDesc.map((m: any) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-800 font-medium">{m.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">{m.weightPerUnit}</td>
                    </tr>
                  ))}
                  {masterDesc.length === 0 && (
                    <tr><td colSpan={2} className="text-center py-6 text-gray-400">No master descriptions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {preview.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Preview ({preview.length} rows)</h2>
              <p className="text-xs text-gray-400 mt-0.5">All {preview.length} row(s) will be submitted — scroll to view.</p>
            </div>
            <div className="overflow-auto max-h-[520px]">
              {(() => {
                // Port & Reason delay are no longer used — hide them from the preview
                // even if they still exist in the uploaded file.
                const HIDE = ["port", "reason delay"]
                const cols = Object.keys(preview[0] || {}).filter(k => !HIDE.includes(k.trim().toLowerCase()))
                return (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 font-bold text-gray-800 whitespace-nowrap bg-gray-50">#</th>
                        {cols.map(k => (
                          <th key={k} className="text-left px-3 py-2 font-bold text-gray-800 whitespace-nowrap bg-gray-50">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{i + 1}</td>
                          {cols.map((k, j) => (
                            <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{(row as any)[k]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-64 overflow-y-auto">
            <p className="text-red-600 text-xs whitespace-pre-line leading-relaxed">{error}</p>
          </div>
        )}

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
