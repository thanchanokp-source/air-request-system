// The email LG sends to the forwarder (Pull RM Phase 2). Kept here so the API, and the preview
// script under scripts/, render exactly the same thing — one source of truth for the wording.
import { FILL_COLS, type FwdPhase } from "@/lib/pull-fwd-template"

const esc = (t: any) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const dt = (v: any) => { if (!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-GB") }

export const docsLabel = (docs: any[]) => (docs.length === 1 ? docs[0].documentNo : `${docs.length} shipments`)

// Default subject — LG may override it in the send dialog.
export function fwdMailSubject(phase: FwdPhase, docs: any[]): string {
  return `[Pull Material] ${phase === 1 ? "Air booking details" : "Air actual charges"} — ${docsLabel(docs)}`
}

// Default opening paragraph (plain text) — also the placeholder LG edits.
export function fwdMailDetail(phase: FwdPhase): string {
  const cols = FILL_COLS.filter(c => c.phase === phase).map(c => c.header).join(" / ")
  return phase === 1
    ? `Please complete the green columns in the attached file (${cols}) and reply with the file attached.\nGrey columns are reference only - please keep them as they are.`
    : `The goods have arrived. Please fill in the green columns of the attached file (${cols}) and reply with the file attached.\nGrey columns are reference only - please keep them as they are.`
}

// Full HTML body. `detail` / `note` are plain text typed by LG (escaped here).
export function fwdMailHtml(o: {
  docs: any[]; phase: FwdPhase; fwdName?: string; fileName: string
  detail?: string; note?: string; actorName: string
}): string {
  const { docs, phase, fileName, actorName } = o
  const ask = FILL_COLS.filter(c => c.phase === phase).map(c => c.header).join(" / ")
  const detail = (o.detail || fwdMailDetail(phase)).trim()
  const rows = docs.map(d => {
    const i0 = (d.items || []).find((x: any) => x.airFreightCost != null) || (d.items || [])[0] || {}
    const pos = [...new Set((d.items || []).map((x: any) => x.poNoDoc).filter(Boolean))].join(", ")
    const sos = [...new Set((d.items || []).map((x: any) => x.soNoDoc).filter(Boolean))].join(", ")
    return `<tr>
      <td style="padding:4px 12px 4px 0;border-bottom:1px solid #f1f5f9">${esc(sos) || "-"}</td>
      <td style="padding:4px 12px 4px 0;border-bottom:1px solid #f1f5f9">${esc(pos) || "-"}</td>
      <td style="padding:4px 12px 4px 0;border-bottom:1px solid #f1f5f9">${esc(i0.vendorName) || "-"}</td>
      <td style="padding:4px 12px 4px 0;border-bottom:1px solid #f1f5f9">${esc(i0.port) || "-"}</td>
      <td style="padding:4px 12px 4px 0;border-bottom:1px solid #f1f5f9;text-align:right">${i0.weight != null ? esc(i0.weight) : "-"} kg</td>
      <td style="padding:4px 0;border-bottom:1px solid #f1f5f9">${dt(i0.etc)}</td>
    </tr>`
  }).join("")

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.55">
  <div style="background:#6b1a1a;padding:18px 22px;border-radius:8px 8px 0 0">
    <div style="color:#e8b0b0;font-size:10px;letter-spacing:2px">NAN YANG TEXTILE</div>
    <div style="color:#fff;font-size:17px;font-weight:700;margin-top:3px">
      ${phase === 1 ? "AIR SHIPMENT — BOOKING DETAILS" : "AIR SHIPMENT — ACTUAL CHARGES"}
    </div>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;padding:20px 22px">
    <p style="margin:0 0 10px">Dear ${esc(o.fwdName) || "Forwarder"},</p>
    <p style="margin:0 0 12px">${esc(detail).split("\n").join("<br/>")}</p>
    <p style="margin:0 0 6px"><b>${docs.length}</b> shipment(s) · attached file: <b>${esc(fileName)}</b></p>
    <p style="margin:0 0 12px;color:#6b1a1a"><b>Please fill (phase ${phase}):</b> ${esc(ask)}</p>
    <table style="border-collapse:collapse;font-size:12px;width:100%;margin-bottom:12px">
      <tr style="color:#94a3b8;font-size:11px;text-transform:uppercase">
        <td style="padding:0 12px 4px 0">SO</td><td style="padding:0 12px 4px 0">PO</td>
        <td style="padding:0 12px 4px 0">Supplier</td><td style="padding:0 12px 4px 0">Origin</td>
        <td style="padding:0 12px 4px 0;text-align:right">Weight</td><td style="padding:0 0 4px">ETC</td>
      </tr>
      ${rows}
    </table>
    ${phase === 1 ? '<p style="margin:0 0 10px;color:#6b7280;font-size:12px">The actual charges will be requested again once the goods have arrived.</p>' : ""}
    ${o.note ? `<p style="margin:12px 0 0;padding:10px 12px;background:#f8fafc;border-left:3px solid #6b1a1a"><b>Note:</b><br/>${esc(o.note).split("\n").join("<br/>")}</p>` : ""}
    <p style="color:#9ca3af;font-size:11px;margin:16px 0 0;border-top:1px solid #f1f5f9;padding-top:10px">
      Sent by ${esc(actorName)} · Nan Yang Textile — Logistics Import<br/>
      Please keep the hidden <i>_DOCID</i> column in the file untouched, it links each row back to its shipment.
    </p>
  </div>
</div>`
}
