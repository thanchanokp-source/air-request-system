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

export function CombinedPdfDocument({ pages }: { pages: { req: any; item: any }[] }) {
  return (
    <Document title="Booking File — Combined">
      {pages.map((p, i) => <ItemPage key={i} req={p.req} item={p.item} />)}
    </Document>
  )
}

// ─── HAWB PDF (single HAWB, client-side) ─────────────────────────────────────
const hw = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8, paddingHorizontal: 24, paddingVertical: 20, color: "#111" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#1E3A8A", textAlign: "center", letterSpacing: 0.5, marginBottom: 6 },
  headerBox: { flexDirection: "row", gap: 0, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 3, marginBottom: 8, overflow: "hidden" },
  headerCell: { flex: 1, padding: "4 8", borderRightWidth: 1, borderRightColor: "#CBD5E1" },
  headerCellLast: { flex: 1, padding: "4 8" },
  headerLabel: { fontSize: 6.5, color: "#64748B", fontFamily: "Helvetica-Bold", marginBottom: 1.5 },
  headerValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0F172A" },
  table: { borderWidth: 1, borderColor: "#CBD5E1" },
  thead: { flexDirection: "row", backgroundColor: "#1E3A8A" },
  th: { paddingHorizontal: 4, paddingVertical: 4, color: "#FFF", fontFamily: "Helvetica-Bold", fontSize: 6.5, textAlign: "center", borderRightWidth: 0.5, borderRightColor: "#3B5FC0" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0" },
  trAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0", backgroundColor: "#F8FAFF" },
  td: { paddingHorizontal: 4, paddingVertical: 3, fontSize: 7.5, textAlign: "center", borderRightWidth: 0.5, borderRightColor: "#E2E8F0" },
  tdLeft: { paddingHorizontal: 4, paddingVertical: 3, fontSize: 7.5, textAlign: "left", borderRightWidth: 0.5, borderRightColor: "#E2E8F0" },
  totalRow: { flexDirection: "row", backgroundColor: "#EFF6FF", borderTopWidth: 1, borderTopColor: "#93C5FD" },
  footer: { position: "absolute", bottom: 12, left: 24, right: 24, flexDirection: "row", justifyContent: "space-between", color: "#94A3B8", fontSize: 6.5 },
})

const HW = {
  no: 20, so: 52, style: 48, po: 52, claim: 36, inv: 52,
  qty: 30, vwt: 36, avg: 44, amt: 48,
}

interface HawbItem {
  id: string; so: string; style: string; customerPO?: string
  claimDepartment?: string; invoiceNo?: string
  qtyRequestAir: number; qtyActualShip?: number
  grossWeight?: number; actualAirFreight?: number
}

export function HawbPdfDocument({
  hawbNo, totalCharge, items, documentNo, brandName, buName, generatedDate,
}: {
  hawbNo: string; totalCharge: number; items: HawbItem[]
  documentNo: string; brandName: string; buName: string; generatedDate?: string
}) {
  const totalQty  = items.reduce((s, i) => s + (i.qtyActualShip ?? i.qtyRequestAir), 0)
  const totalVwt  = items.reduce((s, i) => s + (i.grossWeight ?? 0), 0)
  const totalAmt  = items.reduce((s, i) => s + (i.actualAirFreight ?? 0), 0)
  const avgPerPc  = totalQty > 0 ? totalCharge / totalQty : 0
  const fmt2      = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmt0      = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 })
  const dated     = generatedDate || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <Document title={`HAWB_${hawbNo}_${documentNo}`}>
      <Page size="A4" orientation="landscape" style={hw.page}>
        <Text style={hw.title}>HAWB REPORT</Text>

        {/* Header strip */}
        <View style={hw.headerBox}>
          {[
            { label: "HAWB NO.", value: hawbNo },
            { label: "DOCUMENT NO.", value: documentNo },
            { label: "BRAND / BU", value: `${brandName} / ${buName}` },
            { label: "TOTAL CHARGE (THB)", value: fmt2(totalCharge) },
            { label: "TOTAL QTY (PCS)", value: String(totalQty) },
            { label: "AVG / PC (THB)", value: fmt2(avgPerPc) },
          ].map((c, i, arr) => (
            <View key={c.label} style={i < arr.length - 1 ? hw.headerCell : hw.headerCellLast}>
              <Text style={hw.headerLabel}>{c.label}</Text>
              <Text style={hw.headerValue}>{c.value}</Text>
            </View>
          ))}
        </View>

        {/* Table */}
        <View style={hw.table}>
          <View style={hw.thead}>
            {([
              ["#", HW.no], ["S/O NO.", HW.so], ["STYLE", HW.style], ["CUSTOMER PO", HW.po],
              ["CLAIM TO", HW.claim], ["INVOICE NO.", HW.inv], ["QTY", HW.qty],
              ["VWT (KG)", HW.vwt], ["AVG/PC (THB)", HW.avg], ["AIR CHARGE (THB)", HW.amt],
            ] as [string, number][]).map(([label, w], i, arr) => (
              <Text key={label} style={[hw.th, { width: w, ...(i === arr.length - 1 ? { borderRightWidth: 0 } : {}) }]}>{label}</Text>
            ))}
          </View>

          {items.map((item, i) => {
            const qty = item.qtyActualShip ?? item.qtyRequestAir
            const RowStyle = i % 2 === 0 ? hw.tr : hw.trAlt
            return (
              <View key={item.id} style={RowStyle}>
                <Text style={[hw.td, { width: HW.no }]}>{i + 1}</Text>
                <Text style={[hw.tdLeft, { width: HW.so }]}>{item.so}</Text>
                <Text style={[hw.td, { width: HW.style }]}>{item.style}</Text>
                <Text style={[hw.tdLeft, { width: HW.po }]}>{item.customerPO || "—"}</Text>
                <Text style={[hw.td, { width: HW.claim }]}>{item.claimDepartment || "—"}</Text>
                <Text style={[hw.tdLeft, { width: HW.inv }]}>{item.invoiceNo || "—"}</Text>
                <Text style={[hw.td, { width: HW.qty }]}>{qty}</Text>
                <Text style={[hw.td, { width: HW.vwt }]}>{item.grossWeight != null ? fmt2(item.grossWeight) : "—"}</Text>
                <Text style={[hw.td, { width: HW.avg }]}>{fmt2(avgPerPc)}</Text>
                <Text style={[hw.td, { width: HW.amt, borderRightWidth: 0 }]}>{item.actualAirFreight != null ? fmt2(item.actualAirFreight) : "—"}</Text>
              </View>
            )
          })}

          {/* Total row */}
          <View style={hw.totalRow}>
            <Text style={[hw.td, { width: HW.no + HW.so + HW.style + HW.po + HW.claim + HW.inv, textAlign: "right", fontFamily: "Helvetica-Bold", borderRightWidth: 0.5, borderRightColor: "#93C5FD" }]}>
              TOTAL ({items.length} SO)
            </Text>
            <Text style={[hw.td, { width: HW.qty, fontFamily: "Helvetica-Bold" }]}>{fmt0(totalQty)}</Text>
            <Text style={[hw.td, { width: HW.vwt, fontFamily: "Helvetica-Bold" }]}>{fmt2(totalVwt)}</Text>
            <Text style={[hw.td, { width: HW.avg }]}> </Text>
            <Text style={[hw.td, { width: HW.amt, fontFamily: "Helvetica-Bold", color: "#1E3A8A", borderRightWidth: 0 }]}>
              {totalAmt > 0 ? fmt2(totalAmt) : "—"}
            </Text>
          </View>
        </View>

        <View style={hw.footer}>
          <Text>Generated: {dated}</Text>
          <Text>Nan Yang Textile — Air Request System</Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── Transportation Booking PDF ───────────────────────────────────────────────
const tb = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 7.5, paddingHorizontal: 28, paddingVertical: 24, color: "#111" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", letterSpacing: 1, marginBottom: 8 },
  headerBox: { borderWidth: 1, borderColor: "#333", marginBottom: 6 },
  headerRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#aaa" },
  headerCell: { flex: 1, paddingHorizontal: 6, paddingVertical: 3, borderRightWidth: 0.5, borderRightColor: "#aaa" },
  headerCellLast: { flex: 1, paddingHorizontal: 6, paddingVertical: 3 },
  headerLabel: { fontSize: 6.5, color: "#666", fontFamily: "Helvetica-Bold", marginBottom: 1 },
  headerValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  remarkRow: { flexDirection: "row", paddingHorizontal: 6, paddingVertical: 3 },
  // Table
  table: { borderWidth: 1, borderColor: "#333", marginTop: 6 },
  tableHead: { flexDirection: "row", backgroundColor: "#1E3A8A" },
  tableHeadCell: { paddingHorizontal: 3, paddingVertical: 4, borderRightWidth: 0.5, borderRightColor: "#3B5FC0", color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 6.5, textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", backgroundColor: "#F8FAFF" },
  tableCell: { paddingHorizontal: 3, paddingVertical: 3, borderRightWidth: 0.5, borderRightColor: "#ddd", fontSize: 7, textAlign: "center" },
  tableCellLeft: { paddingHorizontal: 3, paddingVertical: 3, borderRightWidth: 0.5, borderRightColor: "#ddd", fontSize: 7, textAlign: "left" },
  // Summary
  summaryBox: { marginTop: 6, borderWidth: 1, borderColor: "#333", padding: 6 },
  summaryRow: { flexDirection: "row", marginBottom: 2 },
  summaryLabel: { width: 180, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#444" },
  summaryValue: { flex: 1, fontSize: 7.5 },
  // Signatures
  sigBox: { marginTop: 10, flexDirection: "row", gap: 12 },
  sigCol: { flex: 1 },
  sigLine: { borderBottomWidth: 0.75, borderBottomColor: "#333", marginBottom: 2, marginTop: 18 },
  sigLabel: { fontSize: 6.5, color: "#555", fontFamily: "Helvetica-Bold" },
})

// column widths (total ~770 for A4 landscape content area)
const COL = { no: 22, so: 48, style: 44, desc: 90, factory: 38, country: 34, origDate: 42, planDate: 42, qtyAir: 30, qtyActual: 35, invoice: 52, bookDate: 42, gross: 30, freight: 46 }

function TbHeadCell({ w, children }: { w: number; children: string }) {
  return <Text style={[tb.tableHeadCell, { width: w }]}>{children}</Text>
}
function TbCell({ w, left, children }: { w: number; left?: boolean; children?: any }) {
  return <Text style={[left ? tb.tableCellLeft : tb.tableCell, { width: w }]}>{children ?? "-"}</Text>
}

export function TransportationBookingPdf({ pages, generatedDate }: { pages: { req: any; item: any }[]; generatedDate?: string }) {
  const totalQtyAir = pages.reduce((s, p) => s + (Number(p.item.qtyRequestAir) || 0), 0)
  const totalQtyActual = pages.reduce((s, p) => s + (Number(p.item.qtyActualShip) || 0), 0)
  const totalGross = pages.reduce((s, p) => s + (Number(p.item.grossWeight) || 0), 0)
  const totalEst = pages.reduce((s, p) => s + (Number(p.item.airFreight) || 0), 0)
  const totalActual = pages.reduce((s, p) => s + (Number(p.item.actualAirFreight) || 0), 0)

  // Group brands & document nos for header
  const brands = [...new Set(pages.map(p => p.req.brandName).filter(Boolean))].join(", ")
  const docNos = [...new Set(pages.map(p => p.req.documentNo).filter(Boolean))].join(", ")
  const dated = generatedDate || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

  // Split into chunks of 25 rows per page (landscape A4)
  const ROWS_PER_PAGE = 25
  const chunks: { req: any; item: any }[][] = []
  for (let i = 0; i < pages.length; i += ROWS_PER_PAGE) chunks.push(pages.slice(i, i + ROWS_PER_PAGE))

  return (
    <Document title="Transportation Booking">
      {chunks.map((chunk, pageIdx) => (
        <Page key={pageIdx} size="A4" orientation="landscape" style={tb.page}>
          {/* Title */}
          <Text style={tb.title}>TRANSPORTATION BOOKING</Text>

          {/* Header info box */}
          <View style={tb.headerBox}>
            <View style={tb.headerRow}>
              <View style={tb.headerCell}>
                <Text style={tb.headerLabel}>CUSTOMER</Text>
                <Text style={tb.headerValue}>{brands || "-"}</Text>
              </View>
              <View style={tb.headerCell}>
                <Text style={tb.headerLabel}>DOCUMENT NO.</Text>
                <Text style={tb.headerValue}>{docNos || "-"}</Text>
              </View>
              <View style={tb.headerCell}>
                <Text style={tb.headerLabel}>DATED</Text>
                <Text style={tb.headerValue}>{dated}</Text>
              </View>
              <View style={tb.headerCell}>
                <Text style={tb.headerLabel}>TOTAL QTY AIR (PCS)</Text>
                <Text style={[tb.headerValue, { color: "#1E3A8A" }]}>{totalQtyAir.toLocaleString()}</Text>
              </View>
              <View style={tb.headerCellLast}>
                <Text style={tb.headerLabel}>TOTAL SELECTED SO(S)</Text>
                <Text style={[tb.headerValue, { color: "#1E3A8A" }]}>{pages.length}</Text>
              </View>
            </View>
            <View style={[tb.headerRow, { borderBottomWidth: 0 }]}>
              <View style={tb.headerCell}>
                <Text style={tb.headerLabel}>TYPE OF TRANSPORTATION</Text>
                <Text style={tb.headerValue}>BY AIR</Text>
              </View>
              <View style={tb.headerCell}>
                <Text style={tb.headerLabel}>SUPPLIER NAME</Text>
                <Text style={tb.headerValue}>NANYANG TEXTILE</Text>
              </View>
              <View style={[tb.headerCell, { flex: 3 }]}>
                <Text style={tb.headerLabel}>REMARK</Text>
                <Text style={tb.headerValue}> </Text>
              </View>
            </View>
          </View>

          {/* Table */}
          <View style={tb.table}>
            {/* Head */}
            <View style={tb.tableHead}>
              <TbHeadCell w={COL.no}>#</TbHeadCell>
              <TbHeadCell w={COL.so}>S/O NO.</TbHeadCell>
              <TbHeadCell w={COL.style}>STYLE</TbHeadCell>
              <TbHeadCell w={COL.desc}>DESCRIPTION</TbHeadCell>
              <TbHeadCell w={COL.factory}>FACTORY</TbHeadCell>
              <TbHeadCell w={COL.country}>COUNTRY</TbHeadCell>
              <TbHeadCell w={COL.origDate}>ORIG. SHIP DATE</TbHeadCell>
              <TbHeadCell w={COL.planDate}>PLAN SHIP DATE</TbHeadCell>
              <TbHeadCell w={COL.qtyAir}>QTY AIR</TbHeadCell>
              <TbHeadCell w={COL.qtyActual}>QTY ACTUAL</TbHeadCell>
              <TbHeadCell w={COL.invoice}>INVOICE NO.</TbHeadCell>
              <TbHeadCell w={COL.bookDate}>BOOKING DATE</TbHeadCell>
              <TbHeadCell w={COL.gross}>GROSS KG</TbHeadCell>
              <Text style={[tb.tableHeadCell, { width: COL.freight, borderRightWidth: 0 }]}>ACTUAL FREIGHT{"\n"}(THB)</Text>
            </View>

            {/* Rows */}
            {chunk.map((p, i) => {
              const globalIdx = pageIdx * ROWS_PER_PAGE + i + 1
              const RowStyle = i % 2 === 0 ? tb.tableRow : tb.tableRowAlt
              return (
                <View key={i} style={RowStyle}>
                  <TbCell w={COL.no}>{globalIdx}</TbCell>
                  <TbCell w={COL.so}>{p.item.so}</TbCell>
                  <TbCell w={COL.style}>{p.item.style}</TbCell>
                  <TbCell w={COL.desc} left>{p.item.description}</TbCell>
                  <TbCell w={COL.factory}>{p.item.factory}</TbCell>
                  <TbCell w={COL.country}>{p.item.country}</TbCell>
                  <TbCell w={COL.origDate}>{fmtDate(p.item.originalShipmentDate)}</TbCell>
                  <TbCell w={COL.planDate}>{fmtDate(p.item.planShipmentDate)}</TbCell>
                  <TbCell w={COL.qtyAir}>{p.item.qtyRequestAir}</TbCell>
                  <TbCell w={COL.qtyActual}>{p.item.qtyActualShip ?? "-"}</TbCell>
                  <TbCell w={COL.invoice}>{p.item.invoiceNo ?? "-"}</TbCell>
                  <TbCell w={COL.bookDate}>{fmtDate(p.item.bookingDate)}</TbCell>
                  <TbCell w={COL.gross}>{p.item.grossWeight ? Number(p.item.grossWeight).toFixed(2) : "-"}</TbCell>
                  <Text style={[tb.tableCell, { width: COL.freight, borderRightWidth: 0 }]}>
                    {p.item.actualAirFreight != null ? fmtNum(p.item.actualAirFreight) : "-"}
                  </Text>
                </View>
              )
            })}

            {/* Totals row (last page only) */}
            {pageIdx === chunks.length - 1 && (
              <View style={[tb.tableRow, { backgroundColor: "#EFF6FF" }]}>
                <Text style={[tb.tableCell, { width: COL.no + COL.so + COL.style + COL.desc + COL.factory + COL.country + COL.origDate + COL.planDate, fontFamily: "Helvetica-Bold", textAlign: "right", borderRightWidth: 0.5, borderRightColor: "#ddd" }]}>TOTAL</Text>
                <Text style={[tb.tableCell, { width: COL.qtyAir, fontFamily: "Helvetica-Bold" }]}>{totalQtyAir.toLocaleString()}</Text>
                <Text style={[tb.tableCell, { width: COL.qtyActual, fontFamily: "Helvetica-Bold" }]}>{totalQtyActual > 0 ? totalQtyActual.toLocaleString() : "-"}</Text>
                <Text style={[tb.tableCell, { width: COL.invoice + COL.bookDate, borderRightWidth: 0.5, borderRightColor: "#ddd" }]}> </Text>
                <Text style={[tb.tableCell, { width: COL.gross, fontFamily: "Helvetica-Bold" }]}>{totalGross.toFixed(2)}</Text>
                <Text style={[tb.tableCell, { width: COL.freight, fontFamily: "Helvetica-Bold", borderRightWidth: 0, color: "#1E3A8A" }]}>{totalActual > 0 ? fmtNum(totalActual) : "-"}</Text>
              </View>
            )}
          </View>

          {/* Summary + signatures (last page only) */}
          {pageIdx === chunks.length - 1 && (
            <>
              <View style={tb.summaryBox}>
                <View style={tb.summaryRow}>
                  <Text style={tb.summaryLabel}>ESTIMATE AIRFREIGHT COST (EST.)</Text>
                  <Text style={tb.summaryValue}>THB {fmtNum(totalEst)}</Text>
                </View>
                {totalActual > 0 && (
                  <View style={tb.summaryRow}>
                    <Text style={tb.summaryLabel}>ACTUAL AIRFREIGHT COST</Text>
                    <Text style={[tb.summaryValue, { fontFamily: "Helvetica-Bold", color: "#1E3A8A" }]}>THB {fmtNum(totalActual)}</Text>
                  </View>
                )}
              </View>

              <View style={tb.sigBox}>
                {["MERCHANDISER", "SALES MANAGER", "PRODUCTION DIVISION MANAGER", "VICE PRESIDENT OF PROCUREMENT", "VICE PRESIDENT OF SALES"].map(pos => (
                  <View key={pos} style={tb.sigCol}>
                    <View style={tb.sigLine} />
                    <Text style={tb.sigLabel}>{pos}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Page number */}
          <Text style={{ position: "absolute", bottom: 12, right: 28, fontSize: 6.5, color: "#999" }}>
            Page {pageIdx + 1} / {chunks.length}
          </Text>
        </Page>
      ))}
    </Document>
  )
}
