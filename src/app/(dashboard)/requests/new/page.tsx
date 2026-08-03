"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"
import { validateUploadRows } from "@/lib/upload-validate"

export default function NewRequestPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ""
  const isAdmin = role === "ADMIN"
  // Admin can upload a TEST document for any BU (emails reroute to the admin, hidden from users).
  const [testMode, setTestMode] = useState(false)
  const [historical, setHistorical] = useState(false) // admin: import old doc as COMPLETED (no approval)
  const [testBu, setTestBu] = useState<"NYG" | "GW" | "EA" | "TRM">("NYG")
  const userBu = (isAdmin && (testMode || historical)) ? testBu : ((session?.user as any)?.bu || "NYG")
  const isGW = userBu === "GW"
  const isEA = userBu === "EA"
  const isTRM = userBu === "TRM"

  const [file, setFile] = useState<File | null>(null)
  // GW MER attaches supporting files at upload (they pick the claim dept here, so proof docs
  // travel with the request from the start). GW only.
  const [attachFiles, setAttachFiles] = useState<File[]>([])
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

  // Template freshness: fetch the current template version (a hash of the BU's valid data +
  // file) and compare with the version this browser last downloaded → show a "please
  // re-download" hint only when they differ. Cleared the moment they download the latest.
  const [tplVersion, setTplVersion] = useState<string>("")
  const [tplUpdatedAt, setTplUpdatedAt] = useState<string>("")
  const [tplStale, setTplStale] = useState(false)   // needs download: never downloaded OR have an older version
  useEffect(() => {
    let alive = true
    setTplStale(false)
    fetch(`/api/template/version?bu=${userBu}`).then(r => r.json()).then(d => {
      if (!alive || !d?.version) return
      setTplVersion(d.version)
      setTplUpdatedAt(d.updatedAt || "")
      const seen = typeof window !== "undefined" ? localStorage.getItem(`air-template-ver-${userBu}`) : null
      setTplStale(seen !== d.version)   // red when they've never downloaded this version (incl. first time)
    }).catch(() => {})
    return () => { alive = false }
  }, [userBu])
  // "2026-07-23" → "23/07/2026"
  const fmtTplDate = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[3]}/${m[2]}/${m[1]}` : s }
  const markTemplateDownloaded = () => {
    if (tplVersion && typeof window !== "undefined") localStorage.setItem(`air-template-ver-${userBu}`, tplVersion)
    setTplStale(false)
  }
  const downloadMasterExcel = () => {
    const rows = masterDesc.map((m: any) => ({ "DESCRIPTION": m.name, "WT CHARGE/PC (KG)": m.weightPerUnit }))
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "DESCRIPTION": "", "WT CHARGE/PC (KG)": "" }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Master Description")
    XLSX.writeFile(wb, "Master_Description.xlsx")
  }

  useEffect(() => {
    // MER picks the FIRST approver from master (dropdown, single). By BU:
    //   GW  → DPM_GW (legacy VP_MER_GW)   NYG → DVM_MER   EA → DVM_MER_EA (ADVM)
    const fetches = isGW
      ? ["DPM_GW", "VP_MER_GW"].map(r => fetch(`/api/users/by-role?role=${r}&bu=${userBu}`).then(res => res.json()).catch(() => []))
      : isEA
      ? [fetch(`/api/users/by-role?role=DVM_MER_EA`).then(res => res.json()).catch(() => [])]
      : isTRM
      ? [fetch(`/api/users/by-role?role=DVM_MER_TRM`).then(res => res.json()).catch(() => [])]
      : [fetch(`/api/users/by-role?role=DVM_MER`).then(res => res.json()).catch(() => [])]
    Promise.all(fetches)
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
  }, [isGW, isEA, isTRM, userBu])

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
    // Shared validator (also used by the resubmit re-upload flow) — required columns,
    // SO 8-digit, per-row completeness, number/date formats, GW claim-split sum = 100.
    const { rows, error: verr } = validateUploadRows(data.rows, isGW)
    if (verr) { setError(verr); return }
    setPreview(rows)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || preview.length === 0) return
    const isHistorical = isAdmin && historical
    // Approver pick required only for the normal flow (historical import skips approval).
    if (!isHistorical && !vpMerSelected) {
      setError(isGW ? "Please select a DPM GW before submitting" : isEA ? "Please select an ADVM (EA) before submitting" : isTRM ? "Please select a DVM (TRM) before submitting" : "Please select a DVM Merchandise before submitting")
      return
    }
    setLoading(true)
    setError("")
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: preview,
        assignedVpMer: isGW ? vpMerSelected?.email : null,   // GW: DPM
        assignedDvm: !isGW ? vpMerSelected?.email : null,     // NYG/EA: 1st merch approver (DVM/ADVM)
        bu: userBu,
        isTest: isAdmin && testMode,
        historical: isHistorical,
      })
    })
    const data = await res.json()
    if (data.id && file) {
      const attachForm = new FormData()
      attachForm.append("file", file)
      await fetch(`/api/requests/${data.id}/attachments`, { method: "POST", body: attachForm })
    }
    // GW: upload the MER's supporting attachments too (they chose the claim here).
    if (data.id && isGW && attachFiles.length) {
      for (const f of attachFiles) {
        const form = new FormData()
        form.append("file", f); form.append("category", "MER_GW")
        await fetch(`/api/requests/${data.id}/attachments`, { method: "POST", body: form }).catch(() => {})
      }
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
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${testMode ? "bg-amber-100 text-amber-700" : isGW ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
          {testMode ? `🧪 TEST · ${userBu}` : userBu}
        </span>
      </div>

      {/* Admin TEST upload — creates a test document whose emails reroute to YOU (admin),
          hidden from real users. Pick any BU to test its flow safely. */}
      {isAdmin && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-amber-800 cursor-pointer">
            <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)} className="w-4 h-4" />
            🧪 Upload as Test (emails reroute to admin; real users don't see it / get no email)
          </label>
          {testMode && (
            <select value={testBu} onChange={e => setTestBu(e.target.value as any)}
              className="border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="NYG">BU: NYG</option>
              <option value="GW">BU: GW</option>
              <option value="EA">BU: EA</option>
              <option value="TRM">BU: TRM</option>
            </select>
          )}
          {testMode && <span className="text-xs text-amber-600">The document gets a TEST-… number · each role's magic link goes to your inbox</span>}
        </div>
      )}

      {/* Admin: import OLD documents as a record — saved as COMPLETED, no approval, no emails. */}
      {isAdmin && !testMode && (
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={historical} onChange={e => setHistorical(e.target.checked)} className="w-4 h-4" />
            📁 Import old document (save as COMPLETED — no approval flow, no emails)
          </label>
          {historical && (
            <select value={testBu} onChange={e => setTestBu(e.target.value as any)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="NYG">BU: NYG</option>
              <option value="GW">BU: GW</option>
              <option value="EA">BU: EA</option>
              <option value="TRM">BU: TRM</option>
            </select>
          )}
          {historical && <span className="text-xs text-slate-500">Saved as a completed record · pick the BU that matches the file</span>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Select first approver from Master — GW: DPM · NYG: DVM MER · EA: ADVM. The picked
            person is the ONLY one notified; they in turn pick the next approver (VP / DVM). */}
        {(() => {
          const firstLabel = isGW ? "DPM GW" : isEA ? "ADVM (EA)" : isTRM ? "DVM (TRM)" : "DVM Merchandise"
          const firstRole = isGW ? "DPM_GW" : isEA ? "DVM_MER_EA" : isTRM ? "DVM_MER_TRM" : "DVM_MER"
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <h2 className="font-semibold text-gray-800">
                Select {firstLabel} <span className="text-red-500">*</span>
              </h2>
              {vpMerUsers.length === 0 ? (
                <p className="text-sm text-red-500">No {firstRole} in Master yet — please add one in User Management first</p>
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
                  <option value="">-- Select {firstLabel} --</option>
                  {vpMerUsers.map(u => (
                    <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                  ))}
                </select>
              )}
            </div>
          )
        })()}

        {/* Upload Excel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="font-semibold text-gray-800">Upload Excel File</h2>
            <div className="flex items-center gap-2">
              {tplStale ? (
                <span className="flex items-center gap-1 text-[11px] bg-red-50 border border-red-300 text-red-700 px-2 py-1 rounded-lg font-semibold animate-pulse">
                  ⚠ เทมเพลตอัปเดต{tplUpdatedAt ? ` (${fmtTplDate(tplUpdatedAt)})` : ""} — โปรดดาวน์โหลดล่าสุด
                </span>
              ) : tplVersion ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 font-medium" title={`เวอร์ชัน ${tplVersion.slice(0,8)}`}>
                  ✓ เทมเพลตล่าสุด{tplUpdatedAt ? ` · อัปเดต ${fmtTplDate(tplUpdatedAt)}` : ""}
                </span>
              ) : null}
              <a href={`/api/template?bu=${isGW ? "GW" : isEA ? "EA" : isTRM ? "TRM" : "NYG"}`} download
                onClick={markTemplateDownloaded}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border ${tplStale ? "bg-amber-500 border-amber-500 text-white hover:bg-amber-600" : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"}`}>
                ⬇ Download Template ({isGW ? "GW" : isEA ? "EA" : isTRM ? "TRM" : "NYG"})
              </a>
            </div>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {/* GW only: attach supporting documents (MER picks the claim here, so proof travels along). */}
          {isGW && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-500">📎 แนบเอกสารประกอบ (GW — หลายไฟล์ได้)</p>
              <label className="inline-flex items-center gap-2 border border-emerald-300 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-100 cursor-pointer">
                + เพิ่มไฟล์แนบ
                <input type="file" multiple className="hidden"
                  onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setAttachFiles(p => [...p, ...fs]); e.target.value = "" }} />
              </label>
              {attachFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-2 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                      {f.name}
                      <button type="button" onClick={() => setAttachFiles(p => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 leading-none">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
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
            disabled={loading || preview.length === 0 || (!vpMerSelected && !(isAdmin && historical))}
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
