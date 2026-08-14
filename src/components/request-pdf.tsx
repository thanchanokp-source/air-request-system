import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer"
import { getSplits, deptLabel, chainFor, sumPlanField } from "@/lib/claim"
import { soCurrency, splitByCurrency, fmtSplit } from "@/lib/currency"

// Thai-capable font (Sarabun) so Thai text (reasons, names, remarks) renders.
// Registered as two families to keep the existing regular/bold style split.
Font.register({ family: "Sarabun", src: "/fonts/Sarabun-Regular.ttf" })
Font.register({ family: "SarabunB", src: "/fonts/Sarabun-Bold.ttf" })
Font.registerHyphenationCallback((word: string) => [word]) // avoid breaking Thai words

// HAWB#/INVOICE are long unbroken digit strings. With the "never split a word" hyphenation
// callback above, react-pdf can't break them inside a narrow fixed-width column, so they OVERFLOW
// and overlap the next column. Insert a zero-width space (U+200B, an explicit line-break
// opportunity honoured independently of hyphenation) every 4 chars → the number wraps to multiple
// lines within its own column instead of bleeding out.
const ZWSP = String.fromCharCode(0x200B)
const softWrap = (v: any) => { const s = String(v ?? "").trim(); return s ? s.replace(/(.{4})/g, "$1" + ZWSP) : "-" }

// Company letterhead — edit here if the legal entity / address changes.
const COMPANY = {
  name: "Nan Yang Garment Co., Ltd.",
  thai: "Nan Yang Garment Co., Ltd.", // Thai legal-name line (localized to English)
  address: "27 Phetkasem Rd, Nong Khang Phlu, Nong Khaem, Bangkok 10160, Thailand",
}

// Letterhead differs per BU (each is a separate legal entity / factory).
const COMPANIES: Record<string, { name: string; thai: string; address: string }> = {
  NYG: COMPANY,
  EA:  { name: "ELITE APPARATECH LLC", thai: "", address: "Street No 5, Long Khanh Industrial Zone, Binh Loc Ward, Dong Nai City, Viet Nam." },
  TRM: { name: "TRIMAX CO., LTD", thai: "", address: "KM.7 LUANGPRABANG RD., VIENTIANE LAO P.D.R" },
  GW:  { name: "บริษัท กรอสเวล จำกัด", thai: "", address: "27 Phetkasem rd, Nongkangploo, Nongkham, Thailand, 10160" },
}
const companyFor = (bu?: string) => COMPANIES[String(bu || "").toUpperCase()] || COMPANY

const fmtDate = (v: any) => {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "-"
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${String(d.getDate()).padStart(2, "0")} ${M[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "-"
// Signature title cleanup (all BU): the SCM NYG chain's final (EVP PROD) → "EVP"; drop the
// "(GW)" suffix on President. Everything else prints as captured.
const cleanTitle = (t: any) => {
  const s = String(t || "").trim().replace(/\s*\(GW\)\s*$/i, "")  // drop the "(GW)" suffix (GM/President/DPM…)
  if (/^president/i.test(s)) return "President"
  if (/claim approver/i.test(s) || /^evp\b/i.test(s)) return "EVP"
  return s
}

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
  th: { color: "#fff", fontFamily: "SarabunB", fontSize: 6.3, paddingHorizontal: 3, paddingVertical: 4, textAlign: "center", borderRightWidth: 0.5, borderRightColor: "#4B6CB7" },
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
  // Flowing variants (Combined / All-SO: SOs run continuously, not one page each)
  // marginTop:auto sinks the signatures to the BOTTOM of the (last) page instead of
  // sitting right under the table. paddingTop keeps a gap when the page is nearly full.
  sigWrapFlow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: "auto", paddingTop: 18 },
  pageFlow: { fontFamily: "Sarabun", fontSize: 8.5, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 44, color: "#1a1a1a" },
  soBlockFlow: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#D1D5DB" },
  sigCol: { width: "19%", alignItems: "center", marginBottom: 6 },
  sigSpace: { height: 26, width: "100%", justifyContent: "flex-end" },
  sigImg: { height: 24, marginBottom: 1, objectFit: "contain" },
  sigLine: { borderBottomWidth: 0.6, borderBottomColor: "#333", width: "100%", marginBottom: 2 },
  sigName: { fontSize: 9, fontFamily: "SarabunB", textAlign: "center" },
  sigTitle: { fontSize: 8, color: "#555", textAlign: "center", marginTop: 1 },
  sigDate: { fontSize: 7, color: "#888", textAlign: "center", marginTop: 1.5 },
  footer: { position: "absolute", bottom: 14, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between", fontSize: 6.3, color: "#aaa" },
})

type Signer = { title: string; name: string; date: any; verb: string; sig?: string | null; crNo?: string | null }

// Approval signers for a request: real e-sign snapshots (image + name + position +
// datetime + CR), falling back to the expected approver chain (name only) for
// documents signed before e-signatures existed. Same for every SO of one document.
function computeSigners(req: any): Signer[] {
  const isGW = req?.bu === "GW"
  const approveLogs = (req?.approvalLogs || []).filter((l: any) => l.action === "APPROVE")
  let sigList: any[] = ((req?.approvalSignatures || []) as any[])
    // NYG: the SCM user only assigns claim depts (not a formal approver) → hide their signature in the PDF.
    .filter((sg: any) => !(!isGW && sg.role === "SCM_USER"))
    .slice()
    .sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())

  // NYG: stamp only the LAST signatory of each chain/claim — VP Merchandise, VP SCM, the
  // FINAL approver of each claim department, and the President. Intermediate approvers
  // (DVM MER, PURCHASING/SOURCING, SCM NYK Approver, factory-group claimers…) are collapsed
  // into their chain's last signer. (GW keeps its full DPM → GM → President stamps.)
  if (!isGW && sigList.length) {
    // role → chain group. Same person may sign twice (e.g. VP MER for merch AND commercial
    // claim) → collapse per group to the last-signed, so each chain shows once.
    // VP_MER_EA = the LAST EA merch approver (peshan/"DVM"); keep it as the MERCH signatory
    // (DVM_MER_EA / sally / "ADVM" is the intermediate step → collapsed, like NYG's DVM_MER).
    const KEEP_GROUP: Record<string, string> = { VP_MER: "MERCH", VP_MER_EA: "MERCH", VP_MER_TRM: "MERCH", VP_SCM: "SCM", PRESIDENT: "PRESIDENT" }
    const CLAIM_DEPT: Record<string, string> = {
      CLAIM_PROCUREMENT: "PROCUREMENT", DVM_PROCUREMENT: "PROCUREMENT", VP_PROCUREMENT: "PROCUREMENT",
      CLAIM_PRODUCTION: "PRODUCTION", VP_PRODUCTION: "PRODUCTION",
      SCM_NYK_APPROVER: "NYK", SCM_NYK_EVP: "NYK", SCM_NYK: "NYK",
    }
    const groups = new Map<string, any[]>()
    for (const sg of sigList) {
      const key = KEEP_GROUP[sg.role] ? `KEEP_${KEEP_GROUP[sg.role]}`
        : CLAIM_DEPT[sg.role] ? `CLAIM_${CLAIM_DEPT[sg.role]}` : null
      if (!key) continue // drop intermediate / non-terminal signatories
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(sg)
    }
    // sigList is time-sorted → the last element of each group is that chain's final signer.
    sigList = [...groups.values()]
      .map(g => ({ ...g[g.length - 1], crNo: g[g.length - 1].crNo || g.map(x => x.crNo).filter(Boolean).pop() || null }))
      .sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())
  }

  // GW: stamp GM + President (DPM dropped) + the FINAL signer of each claim department chain
  // (e.g. SCM NYG → EVP PROD; NYK → SCM NYK EVP). Intermediate claim signers (entry, VP SCM NYG,
  // VP PROD …) are collapsed away. In GW a CLAIM_NEXT_APPROVER is always the SCM NYG chain, so
  // group them under "SCM NYG"; SCM NYK's 3 roles group under "SCM NYK".
  if (isGW && sigList.length) {
    const LINEAR = new Set(["GM_GW", "PRESIDENT_GW"])
    const linear = sigList.filter((sg: any) => LINEAR.has(sg.role))
    const claim = sigList.filter((sg: any) => !LINEAR.has(sg.role) && sg.role !== "VP_MER_GW" && sg.role !== "DPM_GW")
    const deptKey = (sg: any): string =>
      (sg.role === "CLAIM_NEXT_APPROVER" || sg.positionLabel === "Claim Approver") ? "SCM NYG"
      : /SCM_NYK/.test(sg.role) ? "SCM NYK"
      : (sg.positionLabel || sg.role)
    const byDept = new Map<string, any>()
    for (const sg of claim) {
      const k = deptKey(sg); const prev = byDept.get(k)
      if (!prev || new Date(sg.signedAt).getTime() >= new Date(prev.signedAt).getTime()) byDept.set(k, sg)
    }
    // Title = the LAST position of that dept's forced chain (EVP PROD / VP …) when it has one.
    const claimKept = [...byDept.entries()].map(([k, sg]) => {
      const chain = chainFor(k); const lastLbl = chain.length > 1 ? chain[chain.length - 1]?.label : null
      return { ...sg, positionLabel: lastLbl || sg.positionLabel }
    })
    sigList = [...linear, ...claimKept].sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())
  }
  const signers: Signer[] = []
  if (sigList.length) {
    for (const sg of sigList) {
      signers.push({ title: sg.positionLabel || sg.role || "Approver", name: sg.approverName || "", date: sg.signedAt, verb: "Approved", sig: sg.signatureData || null, crNo: sg.crNo || null })
    }
  } else {
    const chain: [string, string][] = isGW
      ? [["PENDING_GM_GW", "GM"], ["PENDING_PRESIDENT_GW", "President"]]
      : [["PENDING_VP_MER", "VP Merchandise"], ["PENDING_VP_SCM", "VP SCM"], ["PENDING_PRESIDENT", "President"]]
    for (const [status, label] of chain) {
      const log = approveLogs.find((l: any) => l.fromStatus === status)
      signers.push({ title: label, name: log?.user?.name || "", date: log?.createdAt, verb: log ? "Approved" : "" })
    }
  }
  return signers
}

// flow = inline (used at the end of a combined doc); otherwise absolute at page bottom.
function SignatureRow({ signers, flow }: { signers: Signer[]; flow?: boolean }) {
  return (
    <View style={flow ? s.sigWrapFlow : s.sigWrap} wrap={false}>
      {signers.map((sg, i) => (
        <View key={i} style={s.sigCol}>
          <View style={s.sigSpace}>
            {sg.sig ? <Image src={sg.sig} style={s.sigImg} /> : null}
            <View style={s.sigLine} />
          </View>
          <Text style={s.sigName}>( {sg.name || "-"} )</Text>
          <Text style={s.sigTitle}>{cleanTitle(sg.title)}</Text>
          <Text style={s.sigDate}>{sg.verb ? `${sg.verb} ${fmtDate(sg.date)}` : "Pending"}</Text>
          {sg.crNo ? <Text style={s.sigDate}>CR: {sg.crNo}</Text> : null}
        </View>
      ))}
    </View>
  )
}

function ItemPage({ req, item }: { req: any; item: any }) {
  const isGW = req.bu === "GW"
  const signers = computeSigners(req)

  const splits = getSplits(item)
  const claimText = splits.length
    ? splits.map((sp: any) => `${sp.dept} ${sp.pct}%`).join(",  ")
    : ((isGW ? req.claimDepartment : item.claimDepartment) || "-")
  // Reason now comes from the claim splits (REASON 1/2/3); fall back to the legacy
  // reasonDelay for documents uploaded before that column was removed.
  const reasonText = (splits.map((sp: any) => sp.reason).filter(Boolean).join("; ")) || item.reasonDelay || "-"

  const est = Number(item.airFreight) || 0
  const actual = item.actualAirFreight != null ? Number(item.actualAirFreight) : null
  const grandTotal = actual != null ? actual : est
  const CUR = soCurrency(req.bu, item.brand ?? req.brandName) // this SO's currency (EA/RHONE → USD)
  const dept = isGW ? "GW" : "NYG"
  const C = { no: 16, so: 48, style: 54, sub: 28, hawb: 46, inv: 48, qty: 34, gross: 40, est: 48, act: 48 }

  const body = (
    <>
      {/* Letterhead */}
      <View style={s.lh}>
        <Image style={s.logo} src="/LOGO.png" />
        <View style={s.lhMid}>
          <Text style={s.coName}>{companyFor(req.bu).name}</Text>
          {companyFor(req.bu).thai ? <Text style={s.coThai}>{companyFor(req.bu).thai}</Text> : null}
          <Text style={s.coAddr}>{companyFor(req.bu).address}</Text>
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
          ["Request By (Merchandise)", (() => {
            const base = String(req.createdBy?.name || req.createdBy?.email || "").split("@")[0]
            return base ? base.split(".")[0] : "-"
          })()],
          ["Factory", item.factory || "-"],
          ["Country", item.country || "-"],
        ] as [string, string][]).map(([l, v]) => (
          <View key={l} style={s.gcell}>
            <Text style={s.glabel}>{l} :</Text>
            <Text style={s.gval}>{v}</Text>
          </View>
        ))}
        <View style={s.gcellFull}>
          <Text style={s.glabel}>Reason :</Text>
          <Text style={s.gval}>{reasonText}</Text>
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
          <Text style={[s.th, { width: C.est }]}>EST. ({CUR})</Text>
          <Text style={[s.th, { width: C.act, borderRightWidth: 0 }]}>ACTUAL ({CUR})</Text>
        </View>
        <View style={s.tr}>
          <Text style={[s.td, { width: C.no }]}>1</Text>
          <Text style={[s.td, { width: C.so }]}>{item.so || "-"}</Text>
          <Text style={[s.td, { width: C.style }]}>{item.style || "-"}</Text>
          <Text style={[s.td, { width: C.sub }]}>{item.sub || "-"}</Text>
          <Text style={[s.tdL, { flex: 1 }]}>{item.description || "-"}</Text>
          <Text style={[s.td, { width: C.hawb }]}>{softWrap(item.hawbNo)}</Text>
          <Text style={[s.td, { width: C.inv }]}>{softWrap(item.invoiceNo)}</Text>
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
          this SO&apos;s actual air freight ({fmtNum(actual)} {CUR}) is its allocated share of the HAWB bill total.
        </Text>
      )}

      {/* Claim + remarks */}
      <Text style={s.remark}><Text style={s.remarkLabel}>Claim to : </Text>{claimText}</Text>
      <Text style={s.remark}><Text style={s.remarkLabel}>Additional Remarks : </Text>{reasonText}</Text>

      {/* Total box — amount with THB inline */}
      <View style={s.totalBoxWrap}>
        <View style={s.totalBox}>
          <View style={s.totalBoxRowLast}>
            <Text style={s.totalBoxK}>TOTAL</Text>
            <Text style={s.totalBoxV}>{fmtNum(grandTotal)} <Text style={{ fontSize: 8, color: "#111" }}>{CUR}</Text></Text>
          </View>
        </View>
      </View>

    </>
  )

  return (
    <Page size="A4" style={s.page}>
      {body}
      <SignatureRow signers={signers} />
      <View style={s.footer} fixed>
        <Text>Generated by Air Request System</Text>
        <Text>{companyFor(req.bu).name}</Text>
      </View>
    </Page>
  )
}

// Single by-SO download — same consolidated layout as Combined, just one SO row.
export function RequestPdfDocument({ req, item }: { req: any; item: any }) {
  return <CombinedPdfDocument pages={[{ req, item }]} />
}

// Combined / All-SO — ONE consolidated document (landscape): single letterhead,
// one DETAILS table where every SO is a row carrying Factory/Country/Reason/Claim,
// descriptions listed once up top (A, B, C…) and referenced by letter, one grand
// total, and the signature ONCE at the end (all SO share the same approvers).
export function CombinedPdfDocument({ pages, hawbNo }: { pages: { req: any; item: any }[]; hawbNo?: string }) {
  // ALL SOs (across every document) flow into ONE continuous table under a single header.
  // The header lists every document number and the TOTAL sums exactly these pages (the filtered set).
  const docNos = [...new Set(pages.map(p => p.req?.documentNo).filter(Boolean))]
  const title = docNos.length <= 1 ? `${docNos[0] || "Combined"}` : `Combined_${docNos.length}docs`
  return <Document title={title}><DocSection pages={pages} hawbNo={hawbNo} /></Document>
}

function DocSection({ pages, hawbNo }: { pages: { req: any; item: any }[]; hawbNo?: string }) {
  const req = pages[0]?.req || {}
  // Header spans every source document (the SOs may come from several docs, one continuous table).
  const allDocNos = [...new Set(pages.map(p => p.req?.documentNo).filter(Boolean))]
  const allBrands = [...new Set(pages.map(p => p.req?.brandName).filter(Boolean))]
  const allBus = [...new Set(pages.map(p => p.req?.buName || p.req?.bu).filter(Boolean))]
  const isGW = req.bu === "GW"
  const dept = isGW ? "GW" : "NYG"
  const rows = pages.map(p => p.item)
  const signers = computeSigners(req)
  const requestBy = (() => { const b = String(req.createdBy?.name || req.createdBy?.email || "").split("@")[0]; return b ? b.split(".")[0] : "-" })()
  // Unique descriptions → labelled A, B, C… and referenced by letter in the table.
  const descList: string[] = []
  for (const it of rows) { const d = (it.description || "").trim(); if (d && !descList.includes(d)) descList.push(d) }
  const descLabel = (d: any) => { const i = descList.indexOf((d || "").trim()); return i >= 0 ? String.fromCharCode(65 + i) : "-" }
  const reasonOf = (item: any) => { const sp = getSplits(item); return (sp.map((x: any) => x.reason).filter(Boolean).join("; ")) || item.reasonDelay || "-" }
  const claimOf = (item: any) => {
    const sp = getSplits(item)
    return sp.length ? sp.map((x: any) => `${x.dept} ${x.pct}%`).join(", ") : ((isGW ? req.claimDepartment : item.claimDepartment) || "-")
  }
  // Plan totals count each split-shipment group once (split rows copy the plan → would double).
  const totQty = sumPlanField(rows, i => i.qtyRequestAir)
  const totGross = sumPlanField(rows, i => i.grossWeight)
  const anyActual = rows.some(i => i.actualAirFreight != null)
  // Claim split by department (across all SO): amount = (Actual, else Est) × claim %.
  // Sum the RAW (un-rounded) shares first, then round ONCE per dept — otherwise
  // rounding each SO before adding makes the dept total drift from the grand TOTAL
  // (e.g. 29,687.5 + 20,312.5 = 50,000, but round-each = 29,688 + 20,313 = 50,001).
  // A GW document can mix currencies (RHONE SOs are USD, the rest THB), so each dept's claim is
  // tracked per-currency and never summed across the two.
  const claimByDeptRaw: Record<string, { THB: number; USD: number }> = {}
  for (const it of rows) {
    const base = it.actualAirFreight != null ? Number(it.actualAirFreight) : (Number(it.airFreight) || 0)
    const cur = soCurrency(req.bu, it.brand ?? req.brandName)
    for (const sp of getSplits(it)) {
      if (!sp.dept) continue
      if (!claimByDeptRaw[sp.dept]) claimByDeptRaw[sp.dept] = { THB: 0, USD: 0 }
      claimByDeptRaw[sp.dept][cur] += base * (Number(sp.pct) || 0) / 100
    }
  }
  const claimByDept: Record<string, { THB: number; USD: number }> = {}
  for (const [d, v] of Object.entries(claimByDeptRaw)) claimByDept[d] = { THB: Math.round(v.THB), USD: Math.round(v.USD) }
  const claimDeptRows = Object.entries(claimByDept)
  // Per-SO currency (EA / GW-RHONE → USD, else THB). One SO's amount is labelled with its own unit;
  // any total over several SOs is split so THB and USD are never added into one figure.
  const soCur = (it: any) => soCurrency(req.bu, it.brand ?? req.brandName)
  const splitLabel = (pick: (it: any) => any) =>
    fmtSplit(splitByCurrency(rows.map(it => ({ amount: Number(pick(it)) || 0, bu: req.bu, brand: it.brand ?? req.brandName }))))
  // Portrait A4 (usable ~551pt). REASON takes the remaining width (flex) and wraps.
  // Widths must fit each column's content: STYLE/DESC/FACTORY are single tokens that CAN'T
  // wrap, so a too-narrow column overflows and overlaps its neighbour. Fixed cols sum ≈ 482
  // → REASON (flex) gets the rest.
  const C = { no: 14, so: 42, style: 52, sub: 20, desc: 24, fac: 38, ctry: 44, hawb: 42, inv: 46, qty: 26, gross: 30, est: 36, act: 36, claim: 44 }
  const content = (
    <>
        {/* Letterhead */}
        <View style={s.lh}>
          <Image style={s.logo} src="/LOGO.png" />
          <View style={s.lhMid}>
            <Text style={s.coName}>{companyFor(req.bu).name}</Text>
            {companyFor(req.bu).thai ? <Text style={s.coThai}>{companyFor(req.bu).thai}</Text> : null}
            <Text style={s.coAddr}>{companyFor(req.bu).address}</Text>
          </View>
          <View style={s.docBox}>
            <Text style={s.docLabel}>Document No.</Text>
            <Text style={[s.docVal, allDocNos.length > 1 ? { fontSize: 8, lineHeight: 1.35 } : {}]}>{allDocNos.join("\n") || req.documentNo}</Text>
          </View>
        </View>
        <View style={s.rule} />
        <View style={s.titleBar}>
          <Text style={s.title}>AIR FREIGHT REQUEST</Text>
          <Text style={s.deptBadgeAbs}>{dept}</Text>
        </View>
        <View style={s.blackRule} />

        {/* Doc-level info (Request By moved below the table, next to TOTAL) */}
        <View style={s.grid}>
          {([
            ["Date", fmtDate(req.createdAt)],
            ["Brand", allBrands.join(", ") || "-"],
            ["BU", allBus.join(", ") || dept],
            ...(hawbNo ? [["HAWB No.", hawbNo]] as [string, string][] : []),
            ...(req.crNo ? [["CR No.", req.crNo]] as [string, string][] : []),
          ] as [string, string][]).map(([l, v]) => (
            <View key={l} style={s.gcell}>
              <Text style={s.glabel}>{l} :</Text>
              <Text style={s.gval}>{v}</Text>
            </View>
          ))}
        </View>

        {/* Description legend — listed once, referenced by letter in the table */}
        {descList.length > 0 && (
          <View style={{ marginTop: 4, marginBottom: 2 }}>
            <Text style={s.secLabel}>DESCRIPTION</Text>
            {descList.map((d, i) => (
              <Text key={i} style={{ fontSize: 7.5, marginBottom: 0.5 }}>{String.fromCharCode(65 + i)} = {d}</Text>
            ))}
          </View>
        )}

        {/* All SO in one table — Factory / Country / Reason / Claim as columns */}
        <Text style={s.secLabel}>DETAILS</Text>
        <View style={s.table}>
          <View style={s.thead} fixed>
            <Text style={[s.th, { width: C.no }]}>No.</Text>
            <Text style={[s.th, { width: C.so }]}>S/O NO.</Text>
            <Text style={[s.th, { width: C.style }]}>STYLE</Text>
            <Text style={[s.th, { width: C.sub }]}>SUB</Text>
            <Text style={[s.th, { width: C.desc }]}>DESC</Text>
            <Text style={[s.th, { width: C.fac }]}>FACTORY</Text>
            <Text style={[s.th, { width: C.ctry }]}>COUNTRY</Text>
            <Text style={[s.th, { flex: 1 }]}>REASON</Text>
            <Text style={[s.th, { width: C.hawb }]}>HAWB#</Text>
            <Text style={[s.th, { width: C.inv }]}>INVOICE</Text>
            <Text style={[s.th, { width: C.qty }]}>QTY AIR</Text>
            <Text style={[s.th, { width: C.gross }]}>GROSS</Text>
            <Text style={[s.th, { width: C.est }]}>EST.</Text>
            <Text style={[s.th, { width: C.act }]}>ACTUAL</Text>
            <Text style={[s.th, { width: C.claim, borderRightWidth: 0 }]}>CLAIM</Text>
          </View>
          {rows.map((item, idx) => (
            <View style={s.tr} key={idx} wrap={false}>
              <Text style={[s.td, { width: C.no }]}>{idx + 1}</Text>
              <Text style={[s.td, { width: C.so }]}>{item.so || "-"}</Text>
              <Text style={[s.td, { width: C.style }]}>{item.style || "-"}</Text>
              <Text style={[s.td, { width: C.sub }]}>{item.sub || "-"}</Text>
              <Text style={[s.td, { width: C.desc }]}>{descLabel(item.description)}</Text>
              <Text style={[s.td, { width: C.fac }]}>{item.factory || "-"}</Text>
              <Text style={[s.td, { width: C.ctry }]}>{item.country || "-"}</Text>
              <Text style={[s.tdL, { flex: 1 }]}>{reasonOf(item)}</Text>
              <Text style={[s.td, { width: C.hawb }]}>{softWrap(item.hawbNo)}</Text>
              <Text style={[s.td, { width: C.inv }]}>{softWrap(item.invoiceNo)}</Text>
              <Text style={[s.td, { width: C.qty }]}>{fmtNum(item.qtyRequestAir)}</Text>
              <Text style={[s.td, { width: C.gross }]}>{item.grossWeight != null ? fmtNum(item.grossWeight, 2) : "-"}</Text>
              <Text style={[s.tdR, { width: C.est }]}>{fmtNum(item.airFreight)} {soCur(item)}</Text>
              <Text style={[s.tdR, { width: C.act }]}>{item.actualAirFreight != null ? `${fmtNum(item.actualAirFreight)} ${soCur(item)}` : "-"}</Text>
              <Text style={[s.tdL, { width: C.claim, borderRightWidth: 0 }]}>{claimOf(item)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.tdR, { flex: 1, fontFamily: "SarabunB" }]}>TOTAL</Text>
            <Text style={[s.td, { width: C.qty, fontFamily: "SarabunB" }]}>{fmtNum(totQty)}</Text>
            <Text style={[s.td, { width: C.gross, fontFamily: "SarabunB" }]}>{fmtNum(totGross, 2)}</Text>
            <Text style={[s.tdR, { width: C.est, fontFamily: "SarabunB" }]}>{splitLabel(it => it.airFreight)}</Text>
            <Text style={[s.tdR, { width: C.act, fontFamily: "SarabunB", color: "#1E3A8A" }]}>{anyActual ? splitLabel(it => it.actualAirFreight) : "-"}</Text>
            <Text style={[s.td, { width: C.claim, borderRightWidth: 0 }]}> </Text>
          </View>
        </View>

        {/* Request By (left) + Grand total (right), same row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <View style={{ flexDirection: "row", flex: 1, paddingRight: 12 }}>
            <Text style={s.glabel}>Request By (Merchandise) : </Text>
            <Text style={[s.gval, { flex: 1 }]}>{requestBy}</Text>
          </View>
          <View style={s.totalBox}>
            <View style={s.totalBoxRowLast}>
              <Text style={s.totalBoxK}>TOTAL</Text>
              <Text style={s.totalBoxV}>{anyActual ? splitLabel(it => it.actualAirFreight) : splitLabel(it => it.airFreight)}</Text>
            </View>
          </View>
        </View>

        {/* Claim breakdown by department — how much each dept claims */}
        {claimDeptRows.length > 0 && (
          <View style={{ marginTop: 8, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 3, borderStyle: "solid", maxWidth: 260 }} wrap={false}>
            <View style={{ flexDirection: "row", backgroundColor: "#1e3a8a", paddingVertical: 3, paddingHorizontal: 8 }}>
              <Text style={{ color: "#fff", fontSize: 8, flex: 1 }}>CLAIM BY DEPARTMENT</Text>
              <Text style={{ color: "#fff", fontSize: 8, textAlign: "right", width: 90 }}>CLAIM</Text>
            </View>
            {claimDeptRows.map(([d, amt], i) => (
              <View key={d} style={{ flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 8, borderTopWidth: i === 0 ? 0 : 0.5, borderTopColor: "#e2e8f0", borderStyle: "solid" }}>
                <Text style={{ fontSize: 8, flex: 1 }}>{deptLabel(d)}</Text>
                <Text style={{ fontSize: 8, textAlign: "right", width: 90 }}>{fmtSplit(amt)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Signature — ONCE, at the end */}
        <SignatureRow signers={signers} flow />
    </>
  )
  return (
    <Page size="A4" style={s.pageFlow} wrap>
      {content}
      <View style={s.footer} fixed>
        <Text>Generated by Air Request System</Text>
        <Text>{companyFor(req.bu).name}</Text>
      </View>
    </Page>
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

// ─── Print by HAWB (cross-document) ───────────────────────────────────────────
// One HAWB# → all its SO across ANY document(s): total charge + INV + SO list.
export function HawbReportPdf({ hawbNo, items, generatedDate }: {
  hawbNo: string
  items: any[]
  generatedDate?: string
}) {
  const fmt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmt0 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 })
  const totalQty = items.reduce((s, i) => s + (i.qtyActualShip ?? i.qtyRequestAir ?? 0), 0)
  const totalVwt = items.reduce((s, i) => s + (i.grossWeight ?? 0), 0)
  const totalAmt = items.reduce((s, i) => s + (i.actualAirFreight ?? 0), 0)
  const docs = [...new Set(items.map(i => i.documentNo).filter(Boolean))]
  const brands = [...new Set(items.map(i => i.brand).filter(Boolean))]
  const C = { no: 26, doc: 82, so: 64, style: 58, inv: 82, qty: 46, vwt: 58, amt: 84 }
  return (
    <Document title={`HAWB_${hawbNo}`}>
      <Page size="A4" orientation="landscape" style={hw.page} wrap>
        <Text style={hw.title}>HAWB REPORT</Text>
        <View style={hw.headerBox}>
          {[
            { label: "HAWB NO.", value: hawbNo || "—" },
            { label: "TOTAL AIR CHARGE (THB)", value: fmt2(totalAmt) },
            { label: "TOTAL QTY (PCS)", value: fmt0(totalQty) },
            { label: "CONTAINS", value: `${items.length} SO · ${docs.length} doc` },
            { label: "BRAND", value: brands.join(", ") || "—" },
          ].map((c, i, arr) => (
            <View key={c.label} style={i < arr.length - 1 ? hw.headerCell : hw.headerCellLast}>
              <Text style={hw.headerLabel}>{c.label}</Text>
              <Text style={hw.headerValue}>{c.value}</Text>
            </View>
          ))}
        </View>
        <View style={hw.table}>
          <View style={hw.thead} fixed>
            {([["#", C.no], ["DOC NO.", C.doc], ["S/O NO.", C.so], ["STYLE", C.style], ["INVOICE NO.", C.inv], ["QTY", C.qty], ["WEIGHT (KG)", C.vwt], ["AIR CHARGE (THB)", C.amt]] as [string, number][]).map(([label, w], i, arr) => (
              <Text key={label} style={[hw.th, { width: w, ...(i === arr.length - 1 ? { borderRightWidth: 0 } : {}) }]}>{label}</Text>
            ))}
          </View>
          {items.map((item, i) => {
            const qty = item.qtyActualShip ?? item.qtyRequestAir ?? 0
            return (
              <View key={item.id ?? i} style={i % 2 === 0 ? hw.tr : hw.trAlt} wrap={false}>
                <Text style={[hw.td, { width: C.no }]}>{i + 1}</Text>
                <Text style={[hw.tdLeft, { width: C.doc }]}>{item.documentNo || "—"}</Text>
                <Text style={[hw.tdLeft, { width: C.so }]}>{item.so || "—"}</Text>
                <Text style={[hw.td, { width: C.style }]}>{item.style || "—"}</Text>
                <Text style={[hw.tdLeft, { width: C.inv }]}>{item.invoiceNo || "—"}</Text>
                <Text style={[hw.td, { width: C.qty }]}>{qty}</Text>
                <Text style={[hw.td, { width: C.vwt }]}>{item.grossWeight != null ? fmt2(item.grossWeight) : "—"}</Text>
                <Text style={[hw.td, { width: C.amt, borderRightWidth: 0 }]}>{item.actualAirFreight != null ? fmt2(item.actualAirFreight) : "—"}</Text>
              </View>
            )
          })}
          <View style={hw.totalRow}>
            <Text style={[hw.td, { width: C.no + C.doc + C.so + C.style + C.inv, textAlign: "right", fontFamily: "SarabunB", borderRightWidth: 0.5, borderRightColor: "#93C5FD" }]}>TOTAL ({items.length} SO)</Text>
            <Text style={[hw.td, { width: C.qty, fontFamily: "SarabunB" }]}>{fmt0(totalQty)}</Text>
            <Text style={[hw.td, { width: C.vwt, fontFamily: "SarabunB" }]}>{fmt2(totalVwt)}</Text>
            <Text style={[hw.td, { width: C.amt, fontFamily: "SarabunB", color: "#1E3A8A", borderRightWidth: 0 }]}>{fmt2(totalAmt)}</Text>
          </View>
        </View>
        <View style={hw.footer}>
          <Text>Generated{generatedDate ? `: ${generatedDate}` : ""}</Text>
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
              <Text style={s.coName}>{companyFor(pages[0]?.req?.bu).name}</Text>
              {companyFor(pages[0]?.req?.bu).thai ? <Text style={s.coThai}>{companyFor(pages[0]?.req?.bu).thai}</Text> : null}
              <Text style={s.coAddr}>{companyFor(pages[0]?.req?.bu).address}</Text>
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
