import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer"
import { getSplits } from "@/lib/claim"

// Thai-capable font (Sarabun) so Thai text (reasons, names, remarks) renders.
// Registered as two families to keep the existing regular/bold style split.
Font.register({ family: "Sarabun", src: "/fonts/Sarabun-Regular.ttf" })
Font.register({ family: "SarabunB", src: "/fonts/Sarabun-Bold.ttf" })
Font.registerHyphenationCallback((word: string) => [word]) // avoid breaking Thai words

// Company letterhead — edit here if the legal entity / address changes.
const COMPANY = {
  name: "Nan Yang Garment Co., Ltd.",
  thai: "บริษัท นันยางการ์เม้นท์ จำกัด ", // trailing space prevents the last glyph being clipped
  address: "27 Phetkasem Rd, Nong Khang Phlu, Nong Khaem, Bangkok 10160, Thailand",
}

const fmtDate = (v: any) => {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "-"
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${String(d.getDate()).padStart(2, "0")} ${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}
const fmtDateTime = (v: any) => {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "-"
  return `${fmtDate(v)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"

// Spell a THB amount in English words (for the "Say total" line, like a formal note).
function bahtInWords(n: number): string {
  if (n == null || isNaN(n)) return ""
  const baht = Math.floor(Math.abs(n))
  const satang = Math.round((Math.abs(n) - baht) * 100)
  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"]
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]
  const below1000 = (x: number): string => {
    let str = ""
    if (x >= 100) { str += ones[Math.floor(x / 100)] + " HUNDRED"; x %= 100; if (x) str += " " }
    if (x >= 20) { str += tens[Math.floor(x / 10)]; x %= 10; if (x) str += " " + ones[x] }
    else if (x > 0) str += ones[x]
    return str
  }
  const scales = ["", "THOUSAND", "MILLION", "BILLION"]
  const groups: number[] = []
  let num = baht
  while (num > 0) { groups.push(num % 1000); num = Math.floor(num / 1000) }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    parts.push(below1000(groups[i]) + (scales[i] ? " " + scales[i] : ""))
  }
  let result = (parts.join(" ") || "ZERO") + " BAHT"
  if (satang > 0) result += ` AND ${below1000(satang)} SATANG`
  return result
}

const s = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 8.5, paddingHorizontal: 34, paddingTop: 26, paddingBottom: 96, color: "#1a1a1a" },
  // Letterhead
  lh: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  logo: { width: 52, height: 52, marginRight: 10, objectFit: "contain" },
  lhMid: { flex: 1, alignItems: "center" },
  coName: { fontSize: 12.5, fontFamily: "SarabunB", color: "#1E3A8A", textAlign: "center" },
  coThai: { fontSize: 8, color: "#555", marginTop: 1, textAlign: "center", paddingHorizontal: 6 },
  coAddr: { fontSize: 6.8, color: "#888", marginTop: 3, textAlign: "center" },
  docBox: { width: 118, alignItems: "flex-end" },
  docLabel: { fontSize: 6.8, color: "#888", fontFamily: "SarabunB" },
  docVal: { fontSize: 12, fontFamily: "SarabunB", color: "#111", marginTop: 1 },
  rule: { borderBottomWidth: 1.3, borderBottomColor: "#1E3A8A", marginTop: 4, marginBottom: 8 },
  // Title bar — centered title, BU badge floated right, black underline
  titleBar: { position: "relative", marginBottom: 6, justifyContent: "center" },
  title: { fontSize: 14, fontFamily: "SarabunB", letterSpacing: 1.5, color: "#111", textAlign: "center" },
  deptBadgeAbs: { position: "absolute", right: 0, top: -1, fontSize: 8, fontFamily: "SarabunB", color: "#1E3A8A", borderWidth: 1, borderColor: "#1E3A8A", paddingHorizontal: 9, paddingVertical: 2.5, borderRadius: 9 },
  blackRule: { borderBottomWidth: 1, borderBottomColor: "#111", marginBottom: 8 },
  // Info grid
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gcell: { width: "33.33%", flexDirection: "row", paddingVertical: 3.5 },
  gcellFull: { width: "100%", flexDirection: "row", paddingVertical: 3.5, borderTopWidth: 0.5, borderTopColor: "#eee", marginTop: 2 },
  glabel: { fontSize: 7.5, fontFamily: "SarabunB", color: "#555", marginRight: 4 },
  gval: { fontSize: 8, color: "#111", flex: 1 },
  // Section label
  secLabel: { fontSize: 8, fontFamily: "SarabunB", color: "#1E3A8A", letterSpacing: 0.5, marginTop: 10, marginBottom: 3 },
  // Details table
  table: { borderWidth: 0.8, borderColor: "#333" },
  thead: { flexDirection: "row", backgroundColor: "#1E3A8A" },
  th: { color: "#fff", fontFamily: "SarabunB", fontSize: 6.8, paddingHorizontal: 3, paddingVertical: 4, textAlign: "center", borderRightWidth: 0.5, borderRightColor: "#4B6CB7" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  td: { fontSize: 7.5, paddingHorizontal: 3, paddingVertical: 4, textAlign: "center", borderRightWidth: 0.5, borderRightColor: "#eee" },
  tdL: { fontSize: 7.5, paddingHorizontal: 3, paddingVertical: 4, textAlign: "left", borderRightWidth: 0.5, borderRightColor: "#eee" },
  tdR: { fontSize: 7.5, paddingHorizontal: 3, paddingVertical: 4, textAlign: "right", borderRightWidth: 0.5, borderRightColor: "#eee" },
  totalRow: { flexDirection: "row", backgroundColor: "#EFF3FB", borderTopWidth: 0.8, borderTopColor: "#333" },
  // Remarks + total
  remark: { fontSize: 7.5, marginTop: 6 },
  remarkLabel: { fontFamily: "SarabunB", color: "#555" },
  totalBoxWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalBox: { width: 190, borderWidth: 0.8, borderColor: "#333" },
  totalBoxRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#ccc" },
  totalBoxRowLast: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
  totalBoxK: { fontSize: 8, fontFamily: "SarabunB", color: "#555" },
  totalBoxV: { fontSize: 10, fontFamily: "SarabunB", color: "#1E3A8A" },
  sayTotal: { fontSize: 7.5, marginTop: 6, fontFamily: "Sarabun", color: "#333" },
  // Signatures pinned near the bottom
  sigWrap: { position: "absolute", bottom: 34, left: 34, right: 34, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  sigCol: { width: "19%", alignItems: "center", marginBottom: 6 },
  sigSpace: { height: 26, width: "100%", justifyContent: "flex-end" },
  sigImg: { height: 24, marginBottom: 1, objectFit: "contain" },
  sigLine: { borderBottomWidth: 0.6, borderBottomColor: "#333", width: "100%", marginBottom: 2 },
  sigName: { fontSize: 7, fontFamily: "SarabunB", textAlign: "center" },
  sigTitle: { fontSize: 6.3, color: "#555", textAlign: "center", marginTop: 0.5 },
  sigDate: { fontSize: 6, color: "#888", textAlign: "center", marginTop: 1 },
  footer: { position: "absolute", bottom: 14, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between", fontSize: 6.3, color: "#aaa" },
})

function ItemPage({ req, item }: { req: any; item: any }) {
  const isGW = req.bu === "GW"
  const approveLogs = (req.approvalLogs || []).filter((l: any) => l.action === "APPROVE")

  // Signature slots = requester + each captured approval signature (real e-sign
  // snapshot: image + name + position + datetime + CR). Falls back to the expected
  // approver chain (name only) for documents signed before e-signatures existed.
  type Signer = { title: string; name: string; date: any; verb: string; sig?: string | null; crNo?: string | null }
  const sigList: any[] = ((req.approvalSignatures || []) as any[]).slice()
    .sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())
  let signers: Signer[] = [
    { title: "Requester", name: req.createdBy?.name || "", date: req.createdAt, verb: "Created" },
  ]
  if (sigList.length) {
    for (const sg of sigList) {
      signers.push({ title: sg.positionLabel || sg.role || "Approver", name: sg.approverName || "", date: sg.signedAt, verb: "Approved", sig: sg.signatureData || null, crNo: sg.crNo || null })
    }
  } else {
    const chain: [string, string][] = isGW
      ? [["PENDING_VP_MER_GW", "DPM"], ["PENDING_GM_GW", "GM"], ["PENDING_PRESIDENT_GW", "President"]]
      : [["PENDING_VP_MER", "VP Merchandising"], ["PENDING_SCM", "SCM"], ["PENDING_VP_SCM", "VP SCM"], ["PENDING_PRESIDENT", "President"]]
    for (const [status, label] of chain) {
      const log = approveLogs.find((l: any) => l.fromStatus === status)
      signers.push({ title: label, name: log?.user?.name || "", date: log?.createdAt, verb: log ? "Approved" : "" })
    }
  }

  const splits = getSplits(item)
  const claimText = splits.length
    ? splits.map((sp: any) => `${sp.dept} ${sp.pct}%`).join(",  ")
    : ((isGW ? req.claimDepartment : item.claimDepartment) || "-")

  const est = Number(item.airFreight) || 0
  const actual = item.actualAirFreight != null ? Number(item.actualAirFreight) : null
  const grandTotal = actual != null ? actual : est
  const dept = isGW ? "GW" : "NYG"
  const C = { no: 16, so: 48, style: 42, sub: 28, hawb: 46, inv: 48, qty: 34, gross: 40, est: 48, act: 48 }

  return (
    <Page size="A4" style={s.page}>
      {/* Letterhead */}
      <View style={s.lh}>
        <Image style={s.logo} src="/LOGO.png" />
        <View style={s.lhMid}>
          <Text style={s.coName}>{COMPANY.name}</Text>
          <Text style={s.coThai}>{COMPANY.thai}</Text>
          <Text style={s.coAddr}>{COMPANY.address}</Text>
        </View>
        <View style={s.docBox}>
          <Text style={s.docLabel}>Document No.</Text>
          <Text style={s.docVal}>{req.documentNo}</Text>
        </View>
      </View>
      <View style={s.rule} />

      {/* Title bar — centered title, BU badge on the right */}
      <View style={s.titleBar}>
        <Text style={s.title}>AIR FREIGHT REQUEST</Text>
        <Text style={s.deptBadgeAbs}>{dept}</Text>
      </View>
      <View style={s.blackRule} />

      {/* Info grid */}
      <View style={s.grid}>
        {([
          ["Date", fmtDate(req.createdAt)],
          ["Brand", req.brandName || "-"],
          ["BU", req.buName || dept],
          ["Request By (MER)", (() => {
            const base = String(req.createdBy?.name || req.createdBy?.email || "").split("@")[0]
            return base ? base.split(".")[0] : "-"
          })()],
          ["Factory", item.factory || "-"],
          ["Country / Port", `${item.country || "-"} / ${item.port || "-"}`],
        ] as [string, string][]).map(([l, v]) => (
          <View key={l} style={s.gcell}>
            <Text style={s.glabel}>{l} :</Text>
            <Text style={s.gval}>{v}</Text>
          </View>
        ))}
        <View style={s.gcellFull}>
          <Text style={s.glabel}>Reason :</Text>
          <Text style={s.gval}>{item.reasonDelay || "-"}</Text>
        </View>
      </View>

      {/* Details */}
      <Text style={s.secLabel}>DETAILS</Text>
      <View style={s.table}>
        <View style={s.thead}>
          <Text style={[s.th, { width: C.no }]}>No.</Text>
          <Text style={[s.th, { width: C.so }]}>S/O NO.</Text>
          <Text style={[s.th, { width: C.style }]}>STYLE</Text>
          <Text style={[s.th, { width: C.sub }]}>SUB</Text>
          <Text style={[s.th, { flex: 1 }]}>DESCRIPTION</Text>
          <Text style={[s.th, { width: C.hawb }]}>HAWB#</Text>
          <Text style={[s.th, { width: C.inv }]}>INVOICE</Text>
          <Text style={[s.th, { width: C.qty }]}>QTY AIR</Text>
          <Text style={[s.th, { width: C.gross }]}>GROSS (KG)</Text>
          <Text style={[s.th, { width: C.est }]}>EST. (THB)</Text>
          <Text style={[s.th, { width: C.act, borderRightWidth: 0 }]}>ACTUAL (THB)</Text>
        </View>
        <View style={s.tr}>
          <Text style={[s.td, { width: C.no }]}>1</Text>
          <Text style={[s.td, { width: C.so }]}>{item.so || "-"}</Text>
          <Text style={[s.td, { width: C.style }]}>{item.style || "-"}</Text>
          <Text style={[s.td, { width: C.sub }]}>{item.sub || "-"}</Text>
          <Text style={[s.tdL, { flex: 1 }]}>{item.description || "-"}</Text>
          <Text style={[s.td, { width: C.hawb }]}>{item.hawbNo || "-"}</Text>
          <Text style={[s.td, { width: C.inv }]}>{item.invoiceNo || "-"}</Text>
          <Text style={[s.td, { width: C.qty }]}>{fmtNum(item.qtyRequestAir)}</Text>
          <Text style={[s.td, { width: C.gross }]}>{item.grossWeight != null ? fmtNum(item.grossWeight, 2) : "-"}</Text>
          <Text style={[s.tdR, { width: C.est }]}>{fmtNum(est)}</Text>
          <Text style={[s.tdR, { width: C.act, borderRightWidth: 0 }]}>{actual != null ? fmtNum(actual) : "-"}</Text>
        </View>
        <View style={s.totalRow}>
          <Text style={[s.tdR, { flex: 1, fontFamily: "SarabunB" }]}>TOTAL</Text>
          <Text style={[s.td, { width: C.qty, fontFamily: "SarabunB" }]}>{fmtNum(item.qtyRequestAir)}</Text>
          <Text style={[s.td, { width: C.gross, fontFamily: "SarabunB" }]}>{item.grossWeight != null ? fmtNum(item.grossWeight, 2) : "-"}</Text>
          <Text style={[s.tdR, { width: C.est, fontFamily: "SarabunB" }]}>{fmtNum(est)}</Text>
          <Text style={[s.tdR, { width: C.act, fontFamily: "SarabunB", color: "#1E3A8A", borderRightWidth: 0 }]}>{actual != null ? fmtNum(actual) : "-"}</Text>
        </View>
      </View>
      {item.hawbNo && actual != null && (
        <Text style={s.remark}>
          <Text style={s.remarkLabel}>HAWB {item.hawbNo} : </Text>
          this SO&apos;s actual air freight ({fmtNum(actual)} THB) is its allocated share of the HAWB bill total.
        </Text>
      )}

      {/* Claim + remarks */}
      <Text style={s.remark}><Text style={s.remarkLabel}>Claim to : </Text>{claimText}</Text>
      <Text style={s.remark}><Text style={s.remarkLabel}>Additional Remarks : </Text>{item.reasonDelay || "-"}</Text>

      {/* Total box — amount with THB inline */}
      <View style={s.totalBoxWrap}>
        <View style={s.totalBox}>
          <View style={s.totalBoxRowLast}>
            <Text style={s.totalBoxK}>TOTAL</Text>
            <Text style={s.totalBoxV}>{fmtNum(grandTotal)} <Text style={{ fontSize: 8, color: "#111" }}>THB</Text></Text>
          </View>
        </View>
      </View>

      {/* Signatures pinned near the bottom */}
      <View style={s.sigWrap}>
        {signers.map((sg, i) => (
          <View key={i} style={s.sigCol}>
            <View style={s.sigSpace}>
              {sg.sig ? <Image src={sg.sig} style={s.sigImg} /> : null}
              <View style={s.sigLine} />
            </View>
            <Text style={s.sigName}>( {sg.name || "-"} )</Text>
            <Text style={s.sigTitle}>{sg.title}</Text>
            <Text style={s.sigDate}>{sg.verb ? `${sg.verb} ${fmtDateTime(sg.date)}` : "Pending"}</Text>
            {sg.crNo ? <Text style={s.sigDate}>CR: {sg.crNo}</Text> : null}
          </View>
        ))}
      </View>

      <View style={s.footer} fixed>
        <Text>Generated by Air Request System</Text>
        <Text>{COMPANY.name}</Text>
      </View>
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
  page: { fontFamily: "Sarabun", fontSize: 8, paddingHorizontal: 24, paddingVertical: 20, color: "#111" },
  title: { fontSize: 13, fontFamily: "SarabunB", color: "#1E3A8A", textAlign: "center", letterSpacing: 0.5, marginBottom: 6 },
  headerBox: { flexDirection: "row", gap: 0, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 3, marginBottom: 8, overflow: "hidden" },
  headerCell: { flex: 1, padding: "4 8", borderRightWidth: 1, borderRightColor: "#CBD5E1" },
  headerCellLast: { flex: 1, padding: "4 8" },
  headerLabel: { fontSize: 6.5, color: "#64748B", fontFamily: "SarabunB", marginBottom: 1.5 },
  headerValue: { fontSize: 9, fontFamily: "SarabunB", color: "#0F172A" },
  table: { borderWidth: 1, borderColor: "#CBD5E1" },
  thead: { flexDirection: "row", backgroundColor: "#1E3A8A" },
  th: { paddingHorizontal: 4, paddingVertical: 4, color: "#FFF", fontFamily: "SarabunB", fontSize: 6.5, textAlign: "center", borderRightWidth: 0.5, borderRightColor: "#3B5FC0" },
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
            <Text style={[hw.td, { width: HW.no + HW.so + HW.style + HW.po + HW.claim + HW.inv, textAlign: "right", fontFamily: "SarabunB", borderRightWidth: 0.5, borderRightColor: "#93C5FD" }]}>
              TOTAL ({items.length} SO)
            </Text>
            <Text style={[hw.td, { width: HW.qty, fontFamily: "SarabunB" }]}>{fmt0(totalQty)}</Text>
            <Text style={[hw.td, { width: HW.vwt, fontFamily: "SarabunB" }]}>{fmt2(totalVwt)}</Text>
            <Text style={[hw.td, { width: HW.avg }]}> </Text>
            <Text style={[hw.td, { width: HW.amt, fontFamily: "SarabunB", color: "#1E3A8A", borderRightWidth: 0 }]}>
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
  page: { fontFamily: "Sarabun", fontSize: 7.5, paddingHorizontal: 28, paddingVertical: 24, color: "#111" },
  title: { fontSize: 14, fontFamily: "SarabunB", textAlign: "center", letterSpacing: 1, marginBottom: 8 },
  headerBox: { borderWidth: 1, borderColor: "#333", marginBottom: 6 },
  headerRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#aaa" },
  headerCell: { flex: 1, paddingHorizontal: 6, paddingVertical: 3, borderRightWidth: 0.5, borderRightColor: "#aaa" },
  headerCellLast: { flex: 1, paddingHorizontal: 6, paddingVertical: 3 },
  headerLabel: { fontSize: 6.5, color: "#666", fontFamily: "SarabunB", marginBottom: 1 },
  headerValue: { fontSize: 8, fontFamily: "SarabunB" },
  remarkRow: { flexDirection: "row", paddingHorizontal: 6, paddingVertical: 3 },
  // Table
  table: { borderWidth: 1, borderColor: "#333", marginTop: 6 },
  tableHead: { flexDirection: "row", backgroundColor: "#1E3A8A" },
  tableHeadCell: { paddingHorizontal: 3, paddingVertical: 4, borderRightWidth: 0.5, borderRightColor: "#3B5FC0", color: "#fff", fontFamily: "SarabunB", fontSize: 6.5, textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", backgroundColor: "#F8FAFF" },
  tableCell: { paddingHorizontal: 3, paddingVertical: 3, borderRightWidth: 0.5, borderRightColor: "#ddd", fontSize: 7, textAlign: "center" },
  tableCellLeft: { paddingHorizontal: 3, paddingVertical: 3, borderRightWidth: 0.5, borderRightColor: "#ddd", fontSize: 7, textAlign: "left" },
  // Summary
  summaryBox: { marginTop: 6, borderWidth: 1, borderColor: "#333", padding: 6 },
  summaryRow: { flexDirection: "row", marginBottom: 2 },
  summaryLabel: { width: 180, fontSize: 7, fontFamily: "SarabunB", color: "#444" },
  summaryValue: { flex: 1, fontSize: 7.5 },
  // Signatures
  sigBox: { marginTop: 10, flexDirection: "row", gap: 12 },
  sigCol: { flex: 1 },
  sigLine: { borderBottomWidth: 0.75, borderBottomColor: "#333", marginBottom: 2, marginTop: 18 },
  sigLabel: { fontSize: 6.5, color: "#555", fontFamily: "SarabunB" },
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
          {/* Letterhead — same identity as the by-SO document */}
          <View style={s.lh}>
            <Image style={s.logo} src="/LOGO.png" />
            <View style={s.lhMid}>
              <Text style={s.coName}>{COMPANY.name}</Text>
              <Text style={s.coThai}>{COMPANY.thai}</Text>
              <Text style={s.coAddr}>{COMPANY.address}</Text>
            </View>
            <View style={s.docBox}>
              <Text style={s.docLabel}>Document No.</Text>
              <Text style={s.docVal}>{docNos || "-"}</Text>
            </View>
          </View>
          <View style={s.blackRule} />
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
                <Text style={[tb.tableCell, { width: COL.no + COL.so + COL.style + COL.desc + COL.factory + COL.country + COL.origDate + COL.planDate, fontFamily: "SarabunB", textAlign: "right", borderRightWidth: 0.5, borderRightColor: "#ddd" }]}>TOTAL</Text>
                <Text style={[tb.tableCell, { width: COL.qtyAir, fontFamily: "SarabunB" }]}>{totalQtyAir.toLocaleString()}</Text>
                <Text style={[tb.tableCell, { width: COL.qtyActual, fontFamily: "SarabunB" }]}>{totalQtyActual > 0 ? totalQtyActual.toLocaleString() : "-"}</Text>
                <Text style={[tb.tableCell, { width: COL.invoice + COL.bookDate, borderRightWidth: 0.5, borderRightColor: "#ddd" }]}> </Text>
                <Text style={[tb.tableCell, { width: COL.gross, fontFamily: "SarabunB" }]}>{totalGross.toFixed(2)}</Text>
                <Text style={[tb.tableCell, { width: COL.freight, fontFamily: "SarabunB", borderRightWidth: 0, color: "#1E3A8A" }]}>{totalActual > 0 ? fmtNum(totalActual) : "-"}</Text>
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
                    <Text style={[tb.summaryValue, { fontFamily: "SarabunB", color: "#1E3A8A" }]}>THB {fmtNum(totalActual)}</Text>
                  </View>
                )}
                <Text style={{ fontSize: 7, fontFamily: "Sarabun", color: "#333", marginTop: 3 }}>
                  Say total : {bahtInWords(totalActual > 0 ? totalActual : totalEst)}
                </Text>
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
