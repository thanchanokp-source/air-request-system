import React from "react"
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"

const MAROON = "#6b1a1a"
const fmt = (n: any) => (n == null || isNaN(Number(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))
const dt = (v: any) => { if (!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-GB") }

const s = StyleSheet.create({
  page: { padding: 34, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  header: { backgroundColor: MAROON, padding: 14, borderRadius: 6, marginBottom: 14, textAlign: "center" },
  brand: { color: "#e8b0b0", fontSize: 8, letterSpacing: 2 },
  title: { color: "#fff", fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 3, letterSpacing: 2 },
  docNo: { fontSize: 13, fontFamily: "Helvetica-Bold", color: MAROON },
  sub: { fontSize: 8, color: "#64748b", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#f8fafc", borderRadius: 6, padding: 8, marginBottom: 10 },
  cell: { width: "25%", paddingVertical: 4, paddingRight: 6 },
  label: { fontSize: 7, color: "#94a3b8", textTransform: "uppercase", marginBottom: 1 },
  val: { fontSize: 9 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: MAROON, marginTop: 6, marginBottom: 4 },
  trH: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#eef2f7" },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569", padding: 4 },
  td: { fontSize: 8, padding: 4 },
  lgBox: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", borderRadius: 6, padding: 8, marginTop: 10 },
  att: { fontSize: 8, color: "#0369a1", marginTop: 2 },
  foot: { position: "absolute", bottom: 24, left: 34, right: 34, textAlign: "center", fontSize: 7, color: "#94a3b8" },
  sig: { marginTop: 14, flexDirection: "row", justifyContent: "flex-end" },
  sigBox: { width: 180, borderTopWidth: 1, borderTopColor: "#94a3b8", paddingTop: 4, textAlign: "center", fontSize: 8, color: "#475569" },
})

function Cell({ label, value }: { label: string; value: any }) {
  return <View style={s.cell}><Text style={s.label}>{label}</Text><Text style={s.val}>{value ?? "-"}</Text></View>
}

export function PullMaterialPdf({ req }: { req: any }) {
  const items = req.items || []
  const d0 = items.find((x: any) => x.airFreightCost != null) || items[0] || {}
  const byPo: Record<string, { qty: number; uoms: Set<string>; vend: string | null }> = {}
  items.forEach((it: any) => { const po = it.poNoDoc || "-"; const g = (byPo[po] ||= { qty: 0, uoms: new Set(), vend: it.vendorName || null }); g.qty += Number(it.pullMaterialQty) || 0; if (it.bomUom) g.uoms.add(it.bomUom) })
  const qtyAir = items.reduce((a: number, i: any) => a + (Number(i.pullMaterialQty) || 0), 0)
  const estTotal = items.reduce((a: number, i: any) => a + (Number(i.airFreightCost) || 0), 0)
  const pkgs = Array.isArray(req.packages) ? req.packages : []
  const pkgStr = pkgs.length ? pkgs.map((p: any) => `${fmt(p.qty)} ${p.uom}`).join(", ") : (d0.cartons ? fmt(d0.cartons) : "-")
  const dimStr = (d0.boxW || d0.boxL || d0.boxH) ? `${d0.boxW || "-"}x${d0.boxL || "-"}x${d0.boxH || "-"} cm` : "-"

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>NAN YANG TEXTILE</Text>
          <Text style={s.title}>PULL MATERIAL</Text>
        </View>

        <Text style={s.docNo}>{req.documentNo} · {req.bu}</Text>
        <Text style={s.sub}>Requester: {req.requesterName || "-"} · {dt(req.createdAt)}</Text>

        <Text style={s.sectionTitle}>Shipment</Text>
        <View style={s.grid}>
          <Cell label="Country" value={d0.country} />
          <Cell label="Port" value={d0.port || d0.seaPort} />
          <Cell label="City" value={d0.city} />
          <Cell label="Incoterm" value={d0.incoterm} />
          <Cell label="QTY Air" value={fmt(qtyAir)} />
          <Cell label="Est Air" value={estTotal ? `${fmt(estTotal)} USD` : "-"} />
          <Cell label="L/T Air" value={d0.leadTimeAir} />
          <Cell label="Weight (kg)" value={d0.weight != null ? fmt(d0.weight) : "-"} />
          <Cell label="Need date" value={d0.needDate ? dt(d0.needDate) : "-"} />
          <Cell label="Package" value={pkgStr} />
          <Cell label="Dimension" value={dimStr} />
          {["EX-WORK", "FCA"].includes(d0.incoterm) ? <Cell label="Pickup address" value={d0.pickupAddress} /> : null}
          {req.remark ? <View style={{ width: "100%", paddingTop: 3 }}><Text style={s.label}>Remark</Text><Text style={s.val}>{req.remark}</Text></View> : null}
        </View>

        <Text style={s.sectionTitle}>By PO</Text>
        <View style={s.trH}>
          <Text style={[s.th, { width: "40%" }]}>PO NO</Text>
          <Text style={[s.th, { width: "35%" }]}>VENDOR</Text>
          <Text style={[s.th, { width: "15%", textAlign: "right" }]}>QTY AIR</Text>
          <Text style={[s.th, { width: "10%" }]}>UOM</Text>
        </View>
        {Object.keys(byPo).map(po => (
          <View style={s.tr} key={po}>
            <Text style={[s.td, { width: "40%", fontFamily: "Helvetica-Bold" }]}>{po}</Text>
            <Text style={[s.td, { width: "35%" }]}>{byPo[po].vend || "-"}</Text>
            <Text style={[s.td, { width: "15%", textAlign: "right", color: MAROON }]}>{fmt(byPo[po].qty)}</Text>
            <Text style={[s.td, { width: "10%" }]}>{[...byPo[po].uoms].join(", ") || "-"}</Text>
          </View>
        ))}

        <Text style={s.sectionTitle}>Logistics — Actual</Text>
        <View style={s.lgBox}>
          <Cell label="HAWB NO" value={req.hawbNo} />
          <Cell label="Invoice NO" value={req.invoiceNo} />
          <Cell label="Actual Air Freight" value={req.actualAir != null ? fmt(req.actualAir) : "-"} />
          <Cell label="Est vs Actual" value={req.actualAir != null ? fmt((Number(req.actualAir) || 0) - estTotal) : "-"} />
        </View>

        {(req.attachments || []).length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={s.sectionTitle}>Attachments</Text>
            {(req.attachments || []).map((a: any) => <Text key={a.id} style={s.att}>- {a.fileName}</Text>)}
          </View>
        ) : null}

        <View style={s.sig}>
          <Text style={s.sigBox}>Approved by (DVM Purchase){req.approverName ? `\n${req.approverName}` : ""}</Text>
        </View>

        <Text style={s.foot} fixed>Pull Material · Nan Yang Textile Group · generated {dt(new Date())}</Text>
      </Page>
    </Document>
  )
}
