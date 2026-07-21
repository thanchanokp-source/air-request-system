"use client"
import { useEffect, useState } from "react"

export default function SettingsPage() {
  const [override, setOverride] = useState("")
  const [maint, setMaint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const [resendDoc, setResendDoc] = useState("")
  const [resendWho, setResendWho] = useState("all")
  const [resendEmail, setResendEmail] = useState("")
  const [resendMsg, setResendMsg] = useState("")
  const [resendLoading, setResendLoading] = useState(false)

  const resendNotify = async () => {
    if (!resendDoc.trim()) return
    setResendLoading(true); setResendMsg("")
    try {
      const params = new URLSearchParams({ doc: resendDoc.trim() })
      const w = resendWho
      if (w.startsWith("only:")) params.set("only", w.slice(5))
      else if (w.startsWith("status:")) params.set("status", w.slice(7))
      // "all" → no param (server uses each doc's current status)
      if (resendEmail.trim()) params.set("email", resendEmail.trim())
      const r = await fetch(`/api/admin/resend-notify?${params.toString()}`)
      const d = await r.json()
      if (r.ok) {
        const ok = (d.results || []).filter((x: any) => x.ok).map((x: any) => x.documentNo)
        const bad = (d.results || []).filter((x: any) => !x.ok).map((x: any) => `${x.documentNo} (${x.error})`)
        setResendMsg(`✓ Sent: ${ok.join(", ") || "-"}${bad.length ? ` · Not found: ${bad.join(", ")}` : ""}`)
      } else setResendMsg(d.error || "Failed")
    } catch { setResendMsg("Network error") } finally { setResendLoading(false) }
  }

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d && !d.error) { setOverride(d.testEmailOverride || ""); setMaint(!!d.maintenanceMode) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const save = async (patch: any, note: string) => {
    setSaving(true); setMsg("")
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      })
      const d = await r.json()
      if (r.ok) { setOverride(d.testEmailOverride || ""); setMaint(!!d.maintenanceMode); setMsg(`✓ ${note}`) }
      else setMsg(d.error || "Save failed")
    } catch { setMsg("Network error") } finally { setSaving(false) }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-gray-800">SETTINGS <span className="text-sm font-normal text-gray-400">(Admin)</span></h1>
      {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{msg}</p>}

      {/* Test email override */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">🧪 Test Email Override</h2>
          <p className="text-xs text-gray-500 mt-1">
            When an email is entered → <b>all emails</b> in the system are redirected to this single address (not sent to the real master).
            Open the link in the email to log in as each role. Leave blank = send normally.
          </p>
        </div>
        <div className="flex gap-2">
          <input value={override} onChange={e => setOverride(e.target.value)} placeholder="admin@nanyangtextile.com"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={() => save({ testEmailOverride: override }, "Test email saved")} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">Save</button>
          {override && (
            <button onClick={() => save({ testEmailOverride: "" }, "Test email off — sending for real")} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">Clear</button>
          )}
        </div>
        <p className="text-[11px]">
          Status: {override
            ? <span className="text-amber-700 font-medium">🧪 TEST — emails redirected to {override}</span>
            : <span className="text-green-700 font-medium">● Sending for real (production)</span>}
        </p>
      </div>

      {/* Maintenance mode */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-800">🛠️ Maintenance Mode</h2>
            <p className="text-xs text-gray-500 mt-1">
              On = regular users see the "under maintenance" page (admins can still use it normally for testing).
              Turn off when testing is done to make it available to everyone.
            </p>
          </div>
          <button onClick={() => save({ maintenanceMode: !maint }, !maint ? "Site temporarily closed" : "Site enabled")} disabled={saving}
            className={`shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition ${maint ? "bg-red-500" : "bg-gray-300"}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${maint ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <p className="text-[11px]">
          Status: {maint
            ? <span className="text-red-600 font-medium">🔴 Under maintenance (admins only)</span>
            : <span className="text-green-700 font-medium">🟢 Running normally</span>}
        </p>

        {/* Per-browser test bypass — lets THIS browser test the full flow (magic-link as any
            role) while Maintenance is ON. Real users are still blocked. */}
        <div className="border-t border-gray-100 pt-3 mt-1">
          <p className="text-xs font-medium text-gray-700">🔑 Test bypass for this browser</p>
          <p className="text-[11px] text-gray-500 mt-0.5 mb-2">
            Enable while Maintenance is ON → this browser (including magic-link logins as another role) can skip the maintenance page
            to test the full flow · real users are still blocked
          </p>
          <div className="flex gap-2">
            <button disabled={saving}
              onClick={async () => { setSaving(true); const r = await fetch("/api/admin/maintenance-bypass", { method: "POST" }); setSaving(false); setMsg(r.ok ? "✓ Bypass enabled for this browser" : "Failed") }}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              Enable bypass (this browser)
            </button>
            <button disabled={saving}
              onClick={async () => { setSaving(true); const r = await fetch("/api/admin/maintenance-bypass", { method: "DELETE" }); setSaving(false); setMsg(r.ok ? "✓ Bypass disabled" : "Failed") }}
              className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium">
              Disable bypass
            </button>
          </div>
        </div>
      </div>

      {/* Resend notification */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">📤 Resend Notification</h2>
          <p className="text-xs text-gray-500 mt-1">
            Send a <b>duplicate</b> notification email for a document (choose the recipients) — use it for testing / missed emails.
            The email follows the document's current status (if Test Override is on, the email is redirected to the test address).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Document No. (comma-separate for multiple)</label>
            <input value={resendDoc} onChange={e => setResendDoc(e.target.value)} placeholder="AIR-2607-0002, AIR-2607-0003"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Send to (status / group)</label>
            <select value={resendWho} onChange={e => setResendWho(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="all">Current status (default)</option>
              <optgroup label="Specific group">
                <option value="only:nyk">Claim NYK only</option>
                <option value="only:claim">Claim all departments</option>
                <option value="only:logistics">Logistics only</option>
              </optgroup>
              <optgroup label="NYG — all statuses">
                <option value="status:PENDING_DVM_MER">DVM Merchandise</option>
                <option value="status:PENDING_VP_MER">VP Merchandise</option>
                <option value="status:PENDING_SCM">SCM</option>
                <option value="status:PENDING_VP_SCM">VP SCM</option>
                <option value="status:PENDING_LOGISTICS">Logistics (NYG)</option>
                <option value="status:PENDING_CLAIM">Claim (NYG)</option>
                <option value="status:PENDING_VP_CLAIM">VP Claim (NYG)</option>
                <option value="status:PENDING_PRESIDENT">President (NYG)</option>
              </optgroup>
              <optgroup label="GW — all statuses">
                <option value="status:PENDING_VP_MER_GW">DPM (GW)</option>
                <option value="status:PENDING_GM_GW">GM (GW)</option>
                <option value="status:PENDING_CLAIM_GW">Claim (GW)</option>
                <option value="status:PENDING_LOGISTICS_GW">Logistics (GW)</option>
                <option value="status:PENDING_PRESIDENT_GW">President (GW)</option>
                <option value="status:PENDING_SCM_GW">SCM (GW)</option>
                <option value="status:PENDING_ACCOUNTING">Accounting</option>
              </optgroup>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Send to specific email (if set = send only to this person)</label>
            <input value={resendEmail} onChange={e => setResendEmail(e.target.value)} placeholder="name@nanyangtextile.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <button onClick={resendNotify} disabled={resendLoading || !resendDoc.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
            {resendLoading ? "Sending..." : "Resend"}
          </button>
        </div>
        {resendMsg && <p className={`text-xs ${resendMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{resendMsg}</p>}
      </div>
    </div>
  )
}
