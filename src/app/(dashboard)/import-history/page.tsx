"use client"
import { useState } from "react"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"

// Admin-only: backfill historical (already-complete) documents from the MER template.
// Creates each doc as COMPLETED — no approval flow, no emails.
export default function ImportHistoryPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [rows, setRows] = useState<any[]>([])
  const [readCount, setReadCount] = useState(0)
  const [fileName, setFileName] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (session && role !== "ADMIN") {
    return <div className="text-center py-20 text-gray-400">This page is for Admin only.</div>
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null); setResult(null); setRows([])
    const f = e.target.files?.[0]; if (!f) return
    setFileName(f.name)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array", cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
      // Auto-detect the header row = the first row matching ≥3 known column names
      // (works for both the MER template and simpler historical layouts).
      const norm = (v: any) => String(v ?? "").trim()
      const KNOWN = ["document", "no_document", "brand name", "brand", "bu", "style", "so",
        "country", "factory", "hawb#", "inv no.", "actual airfreight", "claim dept 1", "reason delay"]
      const hIdx = aoa.findIndex(r => {
        const s = (r || []).map(c => norm(c).toLowerCase())
        return s.filter(c => KNOWN.includes(c)).length >= 3
      })
      if (hIdx < 0) { setError("Header row not found — need columns like Document / Brand name / BU / HAWB# / Actual Airfreight."); return }
      const headers = (aoa[hIdx] || []).map(norm)
      const body = aoa.slice(hIdx + 1)
      // Keep any row that has content in the RAW sheet row (not just mapped headers)
      // so nothing is dropped by merged cells / unheadered columns.
      const kept = body.filter(r => (r || []).some(c => norm(c)))
      const dataRows = kept.map(r => {
        const o: any = {}
        headers.forEach((h, i) => { if (h) o[h] = (r || [])[i] ?? "" })
        return o
      })
      if (dataRows.length === 0) { setError("No data rows found."); return }
      setReadCount(body.length)
      setRows(dataRows)
    } catch (err: any) {
      setError("Could not read the file: " + (err?.message || "unknown error"))
    }
  }

  const doImport = async () => {
    if (rows.length === 0) return
    if (!confirm(`Import ${rows.length} row(s) as COMPLETED historical documents?\n\nThey will NOT go through approval and NO emails are sent.`)) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch("/api/requests/import-history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      })
      const d = await res.json()
      if (res.ok) { setResult(`✓ Imported ${d.createdDocs} document(s), ${d.createdItems} SO — all set to COMPLETED.`); setRows([]); setFileName("") }
      else setError(d.error || "Import failed")
    } catch (err: any) {
      setError(err?.message || "Import failed")
    }
    setLoading(false)
  }

  const cols = rows.length ? Object.keys(rows[0]) : []

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Import History (Completed)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Admin only — backfill old, already-complete documents using the MER template. Creates it as <strong>COMPLETED</strong> (no approval, no email). <strong>One uploaded file = one document</strong> — every row becomes an SO of that document, with a newly generated Document No.</p>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-4">
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium cursor-pointer hover:bg-blue-700">
          ⬆ Choose Excel file
          <input type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
        </label>
        {fileName && <span className="ml-3 text-sm text-gray-600">{fileName} · read <strong>{readCount}</strong> row(s) → importing <strong>{rows.length}</strong> SO{readCount !== rows.length && <span className="text-amber-600"> ({readCount - rows.length} blank skipped)</span>}</span>}

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm whitespace-pre-line">{error}</div>}
        {result && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{result}</div>}

        {rows.length > 0 && (
          <>
            <div className="border rounded-lg overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr><th className="px-3 py-2 text-left font-bold text-gray-700">#</th>
                    {cols.map(c => <th key={c} className="px-3 py-2 text-left font-bold text-gray-700 whitespace-nowrap">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      {cols.map((c, j) => <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{String(r[c] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && <p className="text-xs text-gray-400">Showing first 50 of {rows.length} rows — all will be imported.</p>}
            <button onClick={doImport} disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {loading ? "Importing…" : `Import ${rows.length} row(s) as COMPLETED`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
