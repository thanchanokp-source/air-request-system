import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const fmtDate = (v: any) => {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "-"
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, paddingHorizontal: 40, paddingVertical: 32, color: "#222" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#1E40AF", textAlign: "center", letterSpacing: 0.5, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: "#1E40AF" },
  infoRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  infoLabel: { width: 150, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" },
  infoValue: { flex: 1, fontSize: 8.5 },
  sectionBar: { backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 4, marginTop: 10, marginBottom: 1, flexDirection: "row", borderLeftWidth: 3, borderLeftColor: "#1D4ED8" },
  sectionTitle: { fontFamily: "Helvetica-Bold", color: "#1D4ED8", fontSize: 9 },
  approvalHeaderRow: { flexDirection: "row", backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  approvalRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  approvalPos: { width: 130, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#444" },
  approvalName: { width: 120, fontSize: 8.5 },
  approvalDate: { flex: 1, fontSize: 8, color: "#666" },
})

function ItemPage({ req, item }: { req: any; item: any }) {
  // Build approval chain from approvalLogs for style-level approvals
  const approveLogs = (req.approvalLogs || []).filter((l: any) => l.action === "APPROVE")
  const styleLogsByPos: Record<string, { name: string; date: string }> = {}
  const isGW = req.bu === "GW"
  const styleLevelPositions = isGW
    ? ["VP MER GW", "PRESIDENT GW", "LOGISTICS GW"]
    : ["VP MER", "SCM", "VP SCM", "PRESIDENT", "LOGISTICS"]
  const roleToPos: Record<string, string> = isGW
    ? {
        VP_MER_GW: "VP MER GW",
        PRESIDENT_GW: "PRESIDENT GW",
        LOGISTICS_GW: "LOGISTICS GW",
      }
    : {
        VP_MER: "VP MER",
        SCM_USER: "SCM",
        VP_SCM: "VP SCM",
        PRESIDENT: "PRESIDENT",
        LOGISTICS: "LOGISTICS",
      }
  for (const log of approveLogs) {
    const pos = roleToPos[log.user?.role]
    if (pos && !styleLogsByPos[pos]) {
      styleLogsByPos[pos] = { name: log.user?.name || "-", date: fmtDate(log.createdAt) }
    }
  }

  // DVM approvals for this item (from claimApprovals, role starts with DVM_)
  const dvmApprovals = (item.claimApprovals || [])
    .filter((a: any) => a.role?.startsWith("DVM_") || a.role?.startsWith("CLAIM_"))
    .sort((a: any, b: any) => (a.user?.priority ?? 99) - (b.user?.priority ?? 99))

  // VP approvals for this item (from claimApprovals, role starts with VP_)
  const vpApprovals = (item.claimApprovals || [])
    .filter((a: any) => a.role?.startsWith("VP_") && a.role !== "VP_SCM")
    .sort((a: any, b: any) => (a.user?.priority ?? 99) - (b.user?.priority ?? 99))

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.title}>AIR REQUEST REPORT</Text>

      {/* Header info */}
      {[
        ["REQUEST DATE", fmtDate(req.createdAt)],
        ["REQUEST BY", req.createdBy?.name || "-"],
        ["DOCUMENT NO", req.documentNo],
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
        ["FACTORY", item.factory || "-"],
        ["COUNTRY / PORT", `${item.country || "-"} / ${item.port || "-"}`],
      ].map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}

      {/* Shipment & Quantity */}
      <View style={s.sectionBar}><Text style={s.sectionTitle}>SHIPMENT & QUANTITY</Text></View>
      {[
        ["ORIGINAL SHIP DATE", fmtDate(item.originalShipmentDate)],
        ["PLAN SHIP DATE", fmtDate(item.planShipmentDate)],
        ["QTY ORIGINAL", String(item.qtyOriginalShipment ?? "-")],
        ["QTY REQUEST AIR", String(item.qtyRequestAir ?? "-")],
        ["GROSS WEIGHT", item.grossWeight != null ? `${fmtNum(item.grossWeight, 2)} kg` : "-"],
        ["EST. AIR FREIGHT", item.airFreight != null ? `${fmtNum(item.airFreight)} THB` : "-"],
      ].map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}

      {/* Logistics */}
      <View style={s.sectionBar}><Text style={s.sectionTitle}>LOGISTICS</Text></View>
      {[
        ["INVOICE NO", item.invoiceNo || "-"],
        ["BOOKING DATE", fmtDate(item.bookingDate)],
        ["ACTUAL AIR FREIGHT", item.actualAirFreight != null ? `${fmtNum(item.actualAirFreight)} THB` : "-"],
      ].map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}

      {/* Reason & Claim */}
      <View style={s.sectionBar}><Text style={s.sectionTitle}>REASON & CLAIM</Text></View>
      {[
        ["CLAIM DEPARTMENT", (isGW ? req.claimDepartment : item.claimDepartment) || "-"],
        ["REASON DELAY", item.reasonDelay || "-"],
      ].map(([label, value]) => (
        <View key={label} style={s.infoRow}>
          <Text style={s.infoLabel}>{label}</Text>
          <Text style={s.infoValue}>{value}</Text>
        </View>
      ))}

      {/* Approval Chain */}
      <View style={s.sectionBar}><Text style={s.sectionTitle}>APPROVAL CHAIN</Text></View>
      <View style={s.approvalHeaderRow}>
        <Text style={[s.approvalPos, { color: "#1D4ED8", fontSize: 8, fontFamily: "Helvetica-Bold" }]}>POSITION</Text>
        <Text style={[s.approvalName, { color: "#1D4ED8", fontSize: 8, fontFamily: "Helvetica-Bold" }]}>APPROVER</Text>
        <Text style={[s.approvalDate, { color: "#1D4ED8", fontSize: 8, fontFamily: "Helvetica-Bold" }]}>DATE</Text>
      </View>
      {styleLevelPositions.filter(p => styleLogsByPos[p]).map(pos => (
        <View key={pos} style={s.approvalRow}>
          <Text style={s.approvalPos}>{pos}</Text>
          <Text style={s.approvalName}>{styleLogsByPos[pos].name}</Text>
          <Text style={s.approvalDate}>{styleLogsByPos[pos].date}</Text>
        </View>
      ))}
      {dvmApprovals.map((a: any, i: number) => (
        <View key={`dvm-${i}`} style={s.approvalRow}>
          <Text style={s.approvalPos}>DVM {item.claimDepartment} {a.user?.priority != null ? `(P${a.user.priority})` : ""}</Text>
          <Text style={s.approvalName}>{a.user?.name || "-"}</Text>
          <Text style={s.approvalDate}>{fmtDate(a.createdAt)}</Text>
        </View>
      ))}
      {vpApprovals.map((a: any, i: number) => (
        <View key={`vp-${i}`} style={s.approvalRow}>
          <Text style={s.approvalPos}>VP {item.claimDepartment} {a.user?.priority != null ? `(P${a.user.priority})` : ""}</Text>
          <Text style={s.approvalName}>{a.user?.name || "-"}</Text>
          <Text style={s.approvalDate}>{fmtDate(a.createdAt)}</Text>
        </View>
      ))}
      {styleLevelPositions.every(p => !styleLogsByPos[p]) && dvmApprovals.length === 0 && vpApprovals.length === 0 && (
        <View style={s.approvalRow}><Text style={[s.approvalPos, { color: "#999" }]}>No approvals recorded</Text></View>
      )}
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
