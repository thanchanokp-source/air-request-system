import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const fmtDate = (v: any) => {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "-"
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

const STATUS_TO_POS: Record<string, string> = {
  PENDING_VP_MER: "VP MER",
  PENDING_VP_SCM: "VP SCM",
  PENDING_PRESIDENT: "PRESIDENT",
  PENDING_LOGISTICS: "LOGISTICS",
  PENDING_CLAIM: "CLAIM",
  PENDING_VP_NYK: "VP NYK",
}

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, paddingHorizontal: 40, paddingVertical: 32, color: "#222" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#1E40AF", textAlign: "center", letterSpacing: 0.5, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: "#1E40AF" },
  infoRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  infoLabel: { width: 150, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" },
  infoValue: { flex: 1, fontSize: 8.5 },
  sectionBar: { backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 4, marginTop: 10, marginBottom: 1, flexDirection: "row", borderLeftWidth: 3, borderLeftColor: "#1D4ED8" },
  sectionTitle: { fontFamily: "Helvetica-Bold", color: "#1D4ED8", fontSize: 9 },
  approvalHeaderRow: { flexDirection: "row", backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  approvalRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  approvalPos: { width: 130, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#444" },
  approvalVal: { flex: 1, fontSize: 8.5 },
})

function ItemPage({ req, item }: { req: any; item: any }) {
  const approveLogs = (req.approvalLogs || []).filter((l: any) => l.action === "APPROVE")
  const posMap: Record<string, { name: string; date: string }> = {}
  for (const log of approveLogs) {
    const pos = STATUS_TO_POS[log.fromStatus]
    if (pos && !posMap[pos]) posMap[pos] = { name: log.user?.name || "-", date: fmtDate(log.createdAt) }
  }
  const posOrder = ["VP MER", "VP SCM", "PRESIDENT", "LOGISTICS", "CLAIM", "VP NYK"]
  const shownPos = posOrder.filter(p => posMap[p])

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.title}>AIR REQUEST REPORT</Text>

      {/* Header info */}
      {[
        ["REQUEST DATE", fmtDate(req.createdAt)],
        ["REQUEST NAME", req.createdBy?.name || "-"],
        ["TRACKING ID / NO DOC", req.documentNo],
      ].map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}

      {/* Product Details */}
      <View style={s.sectionBar}><Text style={s.sectionTitle}>PRODUCT DETAILS</Text></View>
      {[
        ["BU", req.buName || "-"],
        ["BRAND NAME", req.brandName || "-"],
        ["SO", item.so || "-"],
        ["CUSTOMER PO", item.customerPO || "-"],
        ["STYLE", item.style || "-"],
        ["GMT TYPE", item.gmtType || "-"],
        ["DESCRIPTION", item.description || "-"],
      ].map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}

      {/* Shipment & Quantity */}
      <View style={s.sectionBar}><Text style={s.sectionTitle}>SHIPMENT & QUANTITY</Text></View>
      {[
        ["ORIGINAL DATE", fmtDate(item.originalShipmentDate)],
        ["QTY ORIGINAL", String(item.qtyOriginalShipment ?? "-")],
        ["PLAN SHIP DATE", fmtDate(item.planShipmentDate)],
        ["QTY REQ", String(item.qtyRequestAir ?? "-")],
        ["COUNTRY / PORT", `${item.country || "-"} / ${item.port || "-"}`],
        ["GROSS WEIGHT", item.grossWeight != null ? `${fmtNum(item.grossWeight, 2)} kg` : "-"],
        ["AIR FREIGHT", item.airFreight != null ? `${fmtNum(item.airFreight)} Baht` : "-"],
      ].map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}

      {/* Reason & Claim */}
      <View style={s.sectionBar}><Text style={s.sectionTitle}>REASON & CLAIM</Text></View>
      {[
        ["CLAIM TO", item.claimDepartment || "-"],
        ["REASON DELAY BY SCM", item.reasonDelay || "-"],
      ].map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}

      {/* Approval Status */}
      <View style={s.sectionBar}><Text style={s.sectionTitle}>APPROVAL STATUS</Text></View>
      <View style={s.approvalHeaderRow}>
        <Text style={[s.approvalPos, { color: "#1D4ED8", fontSize: 8 }]}>POSITION</Text>
        <Text style={[s.approvalVal, { fontFamily: "Helvetica-Bold", color: "#1D4ED8", fontSize: 8 }]}>APPROVER / APPROVE DATE</Text>
      </View>
      {shownPos.length === 0
        ? <View style={s.approvalRow}><Text style={[s.approvalVal, { color: "#999" }]}>No approvals yet</Text></View>
        : shownPos.map(pos => (
            <View key={pos} style={s.approvalRow}>
              <Text style={s.approvalPos}>{pos}</Text>
              <Text style={s.approvalVal}>{posMap[pos].name} / {posMap[pos].date}</Text>
            </View>
          ))
      }
    </Page>
  )
}

export function RequestPdfDocument({ req, item }: { req: any; item: any }) {
  return (
    <Document title={`${req.documentNo}_${item.so}`}>
      <ItemPage req={req} item={item} />
    </Document>
  )
}
