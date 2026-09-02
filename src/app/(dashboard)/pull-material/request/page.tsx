"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { buColor } from "../_StageWork"

const MAROON = "#6b1a1a"
const BUS = ["NYG", "EA", "TRM", "GW"]

type Bom = {
  soNoDoc: string; customerName?: string; customerPo?: string; vendorName?: string
  poNoDoc?: string; style?: string; brand?: string; gmtType?: string
  shipmentDate?: string; orderQty?: number
  itemCode?: string; itemName?: string; bomQty?: number; bomUom?: string; consumption?: number
  bu?: string; soYear?: string; groupCode?: string; ou?: string; cpartNo?: string; partDesc?: string
  itemNo?: string; poqtyBomdummy?: number; poDate?: string; updInhouse?: string
  status?: string; poUsername?: string; mrdDate?: string; mrdNeedDate?: string; mrd2?: string
}

// Columns SCM sees when selecting material lines (per BOM spec)
const MAT_COLS: { k: keyof Bom; label: string; kind?: "date" | "num" }[] = [
  { k: "bu", label: "BU" }, { k: "soYear", label: "SO YEAR" }, { k: "soNoDoc", label: "SO NO" },
  { k: "poNoDoc", label: "PO NO" },
  { k: "customerName", label: "CUST NAME" }, { k: "groupCode", label: "GROUP" }, { k: "ou", label: "OU" },
  { k: "itemCode", label: "ITEM CODE" }, { k: "itemNo", label: "ITEM NO" },
  { k: "itemName", label: "ITEM NAME" }, { k: "consumption", label: "CONSUMPTION", kind: "num" },
  { k: "cpartNo", label: "CPART" }, { k: "partDesc", label: "PART DESC" },
  { k: "orderQty", label: "ORDER QTY", kind: "num" },
  { k: "poqtyBomdummy", label: "POQTY BOMDUMMY", kind: "num" },
  { k: "poDate", label: "PO DATE", kind: "date" }, { k: "updInhouse", label: "UPD INHOUSE", kind: "date" },
  { k: "vendorName", label: "VEND NAME" }, { k: "status", label: "STATUS" }, { k: "poUsername", label: "POUSERNAME" },
  { k: "mrdDate", label: "MRD DATE", kind: "date" }, { k: "mrdNeedDate", label: "MRD NEED", kind: "date" },
  { k: "mrd2", label: "MRD2", kind: "date" },
]
type ScmInfo = { inHouseAirDate: string; inHouseSeaDate: string; sewingStartDate: string; reasonAirPick: string; grossWeightKg: string; airFreightCost: string }
type CartItem = Bom & ScmInfo & { key: string; pullGarment: number; pullMaterialQty: number }

const fmt = (n: any) => (n == null || isNaN(Number(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString("en-GB") }

export default function ScmRequestPage() {
  const { data: session, status } = useSession()
  const roles: string[] = [(session?.user as any)?.role, ...(((session?.user as any)?.roles) || [])].filter(Boolean)
  const canScm = roles.includes("ADMIN") || roles.includes("SCM_PULL")
  const canPc = roles.includes("ADMIN") || roles.includes("PURCHASING")
  const isAdmin = canScm || canPc // gate: SCM_PULL / PURCHASING / ADMIN can create a request
  // requestType decides the approval TAIL (SCM → VP SCM → President · PC → DVM Pur → VP Pur).
  // Real users: derived from role (no toggle). Admin: a toggle to preview BOTH request UIs.
  const isRealAdmin = roles.includes("ADMIN")
  const derivedReqType: "SCM" | "PURCHASING" = roles.includes("PURCHASING") && !roles.includes("SCM_PULL") ? "PURCHASING" : "SCM"
  const [adminReqType, setAdminReqType] = useState<"SCM" | "PURCHASING">("SCM")
  const reqType: "SCM" | "PURCHASING" = isRealAdmin ? adminReqType : derivedReqType

  const [bu, setBu] = useState("NYG")
  const [q, setQ] = useState("")
  const [poQ, setPoQ] = useState("")
  const [vendQ, setVendQ] = useState("")
  const [results, setResults] = useState<Bom[]>([])
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const params = useSearchParams()
  const [tab, setTab] = useState<"request" | "approve">(params.get("tab") === "approve" ? "approve" : "request")
  // The air-decision tab adapts to the logged-in role: SCM_PULL → SCM decision (→ VP SCM);
  // PURCHASING → PC decision (→ DVM Pur). Derived from role — no manual toggle.
  const decType: "SCM" | "PC" = roles.includes("PURCHASING") && !roles.includes("SCM_PULL") ? "PC" : "SCM"
  const dec = decType === "PC"
    ? { decisionStatus: "PENDING_PC_DECISION", nextStatus: "PENDING_VP_PUR" }   // PC decision → single PC approver (by BU)
    : { decisionStatus: "PENDING_SCM_DECISION", nextStatus: "PENDING_DVM_SCM" } // SCM decision → DVM SCM first

  // Multi-SO selection: tick several SOs from the search, pull materials across all of them at once.
  const [pickedSos, setPickedSos] = useState<Bom[]>([])
  const [matBySo, setMatBySo] = useState<Record<string, Bom[]>>({})
  const [loadingMat, setLoadingMat] = useState(false)
  const [pullGarment, setPullGarment] = useState("")
  const [ticked, setTicked] = useState<Set<string>>(new Set()) // keyed by `${soNoDoc}|${itemCode}`
  const emptyScm = { inHouseAirDate: "", inHouseSeaDate: "", sewingStartDate: "", reasonAirPick: "", grossWeightKg: "", airFreightCost: "" }
  const [scm, setScm] = useState({ ...emptyScm })

  const [cart, setCart] = useState<CartItem[]>([])
  const [pcMissing, setPcMissing] = useState<{ po: string; vend: string; reason: string }[]>([])
  const [pcBusy, setPcBusy] = useState(false)
  // PC interactive: pick vendor → select some POs → one total weight → pull all materials.
  const [pcVendors, setPcVendors] = useState<string[]>([])
  const [pcVend, setPcVend] = useState("")
  const [pcVendQ, setPcVendQ] = useState("")
  const [pcVendOpen, setPcVendOpen] = useState(false)
  const [pcPos, setPcPos] = useState<any[]>([])
  const [pcSelPos, setPcSelPos] = useState<Set<string>>(new Set())
  const [pcSelMats, setPcSelMats] = useState<Bom[]>([]) // materials of the selected POs (shown below)
  const [pcManualOpen, setPcManualOpen] = useState(false)
  const [pcManualVend, setPcManualVend] = useState("")
  const [pcManualPo, setPcManualPo] = useState("")
  const [pcPullQty, setPcPullQty] = useState<Record<string, string>>({}) // per-PO "Pull PO" qty (editable; default = sum)
  const [pcWeight, setPcWeight] = useState("")
  const [pcLoad, setPcLoad] = useState(false)
  // Excel import staging: found (VEND, PO) rows → fill ONE total weight on-screen, then Add.
  const [pcStaged, setPcStaged] = useState<{ vend: string; po: string; mats: Bom[] }[]>([])
  const [pcStageWeight, setPcStageWeight] = useState("")
  const [remark, setRemark] = useState("")
  const [isTest, setIsTest] = useState(false)
  // Regular (fast-track) vs Irregular (full approval), per doc. Auto-suggested from SO prefix "02";
  // (the Hong-Kong-port / weight<45kg parts are only known after Purchase, so those refine later).
  const [mode, setMode] = useState<"REGULAR" | "IRREGULAR">("IRREGULAR")
  const [modeTouched, setModeTouched] = useState(false)
  const suggestRegular = cart.length > 0 && cart.every(c => String(c.soNoDoc || "").startsWith("02"))
  const [submitting, setSubmitting] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  // Requester is always the logged-in user (creator) — no manual field.
  const requesterName = (session?.user as any)?.name || (session?.user as any)?.email || ""

  // BOM data freshness (from the daily refresh job → insert_date)
  useEffect(() => {
    fetch("/api/bom", { method: "POST" }).then(r => r.json()).then(d => setLastSync(d.lastSync || null)).catch(() => {})
  }, [])

  // Keep the mode following the auto-suggestion until the user overrides it manually.
  useEffect(() => { if (!modeTouched) setMode(suggestRegular ? "REGULAR" : "IRREGULAR") }, [suggestRegular, modeTouched])

  const sync = (() => {
    if (!lastSync) return null
    const d = new Date(lastSync)
    if (isNaN(d.getTime())) return null
    const stale = d.toDateString() !== new Date().toDateString()
    return { txt: d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }), stale }
  })()

  // Debounced search-as-you-type → dropdown of matching SOs (by SO number, PO and/or vendor)
  useEffect(() => {
    if (!q.trim() && !poQ.trim() && !vendQ.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const qs = new URLSearchParams({ bu, limit: "30" })
        if (q.trim()) qs.set("q", q.trim())
        if (poQ.trim()) qs.set("po", poQ.trim())
        if (vendQ.trim()) qs.set("vend", vendQ.trim())
        const r = await fetch(`/api/bom?${qs.toString()}`).then(r => r.json())
        setResults(Array.isArray(r.rows) ? r.rows : []); setSearchErr(r.error || null); setOpen(true)
      } finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [q, poQ, vendQ, bu])

  // Materials of every picked SO, combined (each line keeps its own soNoDoc/orderQty).
  const materials: Bom[] = pickedSos.flatMap(s => matBySo[s.soNoDoc] || [])
  const matKey = (m: Bom) => `${m.soNoDoc}|${m.itemCode}`

  // Toggle an SO in/out of the selection; fetch its materials on add.
  const togglePickSo = async (b: Bom) => {
    const on = pickedSos.some(s => s.soNoDoc === b.soNoDoc)
    if (on) {
      setPickedSos(p => p.filter(s => s.soNoDoc !== b.soNoDoc))
      setMatBySo(p => { const n = { ...p }; delete n[b.soNoDoc]; return n })
      setTicked(p => new Set([...p].filter(k => !k.startsWith(`${b.soNoDoc}|`))))
      return
    }
    setPickedSos(p => [...p, b]); setLoadingMat(true)
    try {
      const r = await fetch(`/api/bom?bu=${bu}&so=${encodeURIComponent(b.soNoDoc)}`).then(r => r.json())
      setMatBySo(p => ({ ...p, [b.soNoDoc]: Array.isArray(r.rows) ? r.rows : [] }))
    } finally { setLoadingMat(false) }
  }
  const clearPicked = () => { setPickedSos([]); setMatBySo({}); setTicked(new Set()); setPullGarment(""); setScm({ ...emptyScm }) }

  const toggle = (key: string) => setTicked(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })
  const allKeys = materials.filter(m => m.itemCode).map(matKey)
  const allTicked = allKeys.length > 0 && allKeys.every(k => ticked.has(k))
  const toggleAll = () => setTicked(() => allTicked ? new Set() : new Set(allKeys))

  // material qty scales with pull garment: bomQty * (pullGarment / orderQty)
  const calcQty = (m: Bom, garment: number) =>
    (m.bomQty && m.orderQty) ? Math.round((m.bomQty * garment / m.orderQty) * 100) / 100 : 0

  const addToCart = () => {
    const g = Number(pullGarment)
    if (!g || g <= 0) return alert("Enter the number of garments to pull first.")
    const picked = materials.filter(m => m.itemCode && ticked.has(matKey(m)))
    if (picked.length === 0) return alert("Tick at least one material line.")
    const add = picked.map(m => ({
      ...m, key: `${m.soNoDoc}|${m.itemCode}`,
      pullGarment: g, pullMaterialQty: calcQty(m, g), ...scm,
    }))
    setCart(prev => [...prev.filter(c => !add.some(a => a.key === c.key)), ...add])
    clearPicked()
  }
  const removeCart = (key: string) => setCart(p => p.filter(c => c.key !== key))

  // Load the vendor list for the PC picker whenever BU / branch changes.
  useEffect(() => {
    if (reqType !== "PURCHASING") return
    setPcVend(""); setPcPos([]); setPcSelPos(new Set()); setPcVendQ("")
    fetch(`/api/bom?bu=${bu}&vendors=1`).then(r => r.json()).then(d => setPcVendors(d.vendors || [])).catch(() => {})
  }, [bu, reqType])

  const matK = (m: any) => `${m.soNoDoc}|${m.itemCode}`
  const pickPcVend = async (v: string) => {
    setPcVend(v); setPcVendQ(""); setPcVendOpen(false); setPcSelPos(new Set()); setPcSelMats([]); setPcLoad(true)
    try { const d = await fetch(`/api/bom?bu=${bu}&vendorPos=${encodeURIComponent(v)}`).then(r => r.json()); setPcPos(Array.isArray(d.pos) ? d.pos : []) }
    finally { setPcLoad(false) }
  }
  // Fetch + add a PO's materials to the "selected" list (dedup); or remove them on deselect.
  const addPoMats = async (po: string) => {
    const d = await fetch(`/api/bom?bu=${bu}&poFull=${encodeURIComponent(po)}&vend=${encodeURIComponent(pcVend)}`).then(r => r.json())
    const mats: Bom[] = Array.isArray(d.rows) ? d.rows : []
    setPcSelMats(prev => [...prev.filter(x => !mats.some(y => matK(y) === matK(x))), ...mats])
    return mats.length
  }
  const togglePcPo = async (po: string) => {
    if (pcSelPos.has(po)) {
      setPcSelPos(p => { const n = new Set(p); n.delete(po); return n })
      setPcSelMats(prev => prev.filter(m => m.poNoDoc !== po))
      return
    }
    setPcSelPos(p => new Set(p).add(po)); setPcLoad(true)
    try { await addPoMats(po) } finally { setPcLoad(false) }
  }
  const allPosSel = pcPos.length > 0 && pcPos.every((p: any) => pcSelPos.has(p.po))
  const [pcPoQ, setPcPoQ] = useState("")
  const pcFilteredPos = pcPos.filter((p: any) => !pcPoQ.trim() || String(p.po).toLowerCase().includes(pcPoQ.trim().toLowerCase()))
  // Enter in the PO search box → select every PO currently matching (fetch their materials), then clear.
  const selectFilteredPos = async () => {
    const toAdd = pcFilteredPos.filter((p: any) => !pcSelPos.has(p.po))
    if (!toAdd.length) { setPcPoQ(""); return }
    setPcLoad(true)
    try {
      setPcSelPos(p => { const n = new Set(p); toAdd.forEach((x: any) => n.add(x.po)); return n })
      for (const p of toAdd) await addPoMats(p.po)
    } finally { setPcLoad(false); setPcPoQ("") }
  }
  // Manual add: Purchasing types a Vendor + PO themselves (PO may not be in the system). If the PO
  // has BOM materials → pull them; otherwise add a single manual placeholder row so it's still recorded.
  const addManualPo = async () => {
    const po = pcManualPo.trim(); if (!po) return alert("กรอกเลข PO ก่อน")
    const vend = pcManualVend.trim() || pcVend
    setPcLoad(true)
    try {
      const qs = new URLSearchParams({ bu, poFull: po }); if (vend) qs.set("vend", vend)
      const d = await fetch(`/api/bom?${qs.toString()}`).then(r => r.json())
      const mats: Bom[] = Array.isArray(d.rows) ? d.rows : []
      if (mats.length) {
        setPcSelMats(prev => [...prev.filter(x => !mats.some(y => matK(y) === matK(x))), ...mats])
      } else {
        const manual: any = { soNoDoc: po, itemCode: `MANUAL-${po}`, itemName: "(กรอกเอง — ไม่มีใน BOM)", poNoDoc: po, vendorName: vend || null, groupCode: null, poqtyBomdummy: null, bomUom: null, bomQty: 0, orderQty: 0 }
        setPcSelMats(prev => prev.some(x => matK(x) === matK(manual)) ? prev : [...prev, manual])
      }
      setPcSelPos(p => new Set(p).add(po))
      setPcManualPo(""); setPcManualVend("")
    } finally { setPcLoad(false) }
  }
  const removePcMat = (key: string) => setPcSelMats(prev => prev.filter(m => matK(m) !== key))
  const removePcPo = (po: string) => { setPcSelPos(p => { const n = new Set(p); n.delete(po); return n }); setPcSelMats(prev => prev.filter(m => m.poNoDoc !== po)) }

  // Per-PO summary of the selected materials: count + SUM(poqtyBomdummy). "Pull PO" defaults to the sum.
  const pcPoSum: Record<string, { count: number; sum: number; vend: string | null }> = {}
  pcSelMats.forEach(m => { const po = m.poNoDoc || "-"; const g = (pcPoSum[po] ||= { count: 0, sum: 0, vend: (m as any).vendorName || null }); g.count++; g.sum += Number(m.poqtyBomdummy) || 0 })
  const pcPullOf = (po: string) => pcPullQty[po] ?? String(pcPoSum[po]?.sum ?? 0)

  // Add: the per-PO "Pull PO" qty is distributed across its materials (by poqtyBomdummy share).
  const addPcToCart = () => {
    if (!pcSelMats.length) return alert("เลือก PO / material ก่อน")
    const w = pcWeight === "" ? null : (Number(pcWeight) || null)
    const addItems = pcSelMats.map((m, idx) => {
      const po = m.poNoDoc || "-"
      const g = pcPoSum[po]
      const pullPO = Number(pcPullOf(po)) || 0
      const share = g && g.sum > 0 ? (Number(m.poqtyBomdummy) || 0) / g.sum : (g && g.count ? 1 / g.count : 0)
      const q = Math.round(pullPO * share * 100) / 100
      return { ...m, key: matK(m), pullGarment: Number(m.orderQty) || 0, pullMaterialQty: q, weight: idx === 0 ? w : null, ...emptyScm }
    })
    setCart(prev => [...prev.filter(c => !addItems.some(a => a.key === c.key)), ...addItems])
    setPcVend(""); setPcPos([]); setPcSelPos(new Set()); setPcSelMats([]); setPcWeight(""); setPcPullQty({})
    alert(`เพิ่ม ${addItems.length} material · น้ำหนักรวม ${w ?? "-"} kg`)
  }

  // ── PC (Purchasing) flow: Vendor + PO + Weight via Excel — pull EVERY material under the PO. ──
  // Export a BU-scoped template: VEND_NAME / PO_NO to fill, + a "Vendors" reference sheet.
  // (Weight is entered on-screen AFTER import, not in the file.)
  const pcExport = async () => {
    setPcBusy(true)
    try {
      const ExcelJS = (await import("exceljs")).default
      const d = await fetch(`/api/bom?bu=${bu}&vendors=1`).then(r => r.json())
      const vendors: string[] = d.vendors || []
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Pull")
      const hr = ws.addRow(["VEND_NAME", "PO_NO"])
      hr.eachCell((c: any) => { c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } } })
      ws.columns = [{ width: 36 }, { width: 22 }] as any
      const vs = wb.addWorksheet("Vendors")
      vs.addRow([`Vendor (${bu}) — ref`]); vs.getCell("A1").font = { bold: true }
      vs.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } }
      vendors.forEach(v => vs.addRow([v])); vs.getColumn(1).width = 42
      if (vendors.length) for (let r = 2; r <= 300; r++) {
        ws.getCell(`A${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`Vendors!$A$2:$A$${vendors.length + 1}`] } as any
      }
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `PullRM_PC_${bu}_template.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } finally { setPcBusy(false) }
  }

  // Import (VEND, PO) → validate each against the system → STAGE the found ones (weight entered
  // on-screen after). Rows whose PO/Vendor aren't in the system are reported (not staged).
  const pcImport = async (file: File) => {
    const XLSX = await import("xlsx")
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
    const ws = wb.Sheets["Pull"] || wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[]
    const pick = (r: any, ...keys: string[]) => { for (const k of keys) if (r[k] !== undefined && r[k] !== "") return String(r[k]).trim(); return "" }
    setPcBusy(true)
    const missing: { po: string; vend: string; reason: string }[] = []
    const staged: { vend: string; po: string; mats: Bom[] }[] = []
    const seen = new Set<string>()
    try {
      for (const r of rows) {
        const vend = pick(r, "VEND_NAME", "Vendor", "VENDOR")
        const po = pick(r, "PO_NO", "PO", "PONO")
        if (!po && !vend) continue
        const key = `${po}|${vend}`.toLowerCase(); if (seen.has(key)) continue; seen.add(key)
        const qs = new URLSearchParams({ bu, poFull: po }); if (vend) qs.set("vend", vend)
        const d = await fetch(`/api/bom?${qs.toString()}`).then(r => r.json())
        const mats: Bom[] = Array.isArray(d.rows) ? d.rows : []
        if (!mats.length) { missing.push({ po, vend, reason: d.error ? "อ่านข้อมูลไม่ได้" : "ไม่พบ PO/Vendor ในระบบ" }); continue }
        staged.push({ vend: vend || String(mats[0].vendorName || ""), po, mats })
      }
      setPcStaged(prev => [...prev.filter(s => !staged.some(x => x.po === s.po && x.vend === s.vend)), ...staged])
      setPcMissing(missing)
      alert(`พบ ${staged.length} PO${missing.length ? ` · ⚠ ไม่พบ ${missing.length}` : ""} — ใส่น้ำหนักรวมด้านล่างแล้วกด Add`)
    } finally { setPcBusy(false) }
  }

  // Add the imported (staged) POs to the cart with the ONE total weight entered on-screen.
  const addStagedToCart = () => {
    if (!pcStaged.length) return
    const w = pcStageWeight === "" ? null : (Number(pcStageWeight) || null)
    const addItems: any[] = []
    let first = true
    for (const s of pcStaged) for (const m of s.mats) {
      addItems.push({ ...m, key: `${m.soNoDoc}|${m.itemCode}`, pullGarment: Number(m.orderQty) || 0, pullMaterialQty: Number(m.bomQty) || 0, weight: first ? w : null, ...emptyScm })
      first = false
    }
    setCart(prev => [...prev.filter(c => !addItems.some(a => a.key === c.key)), ...addItems])
    setPcStaged([]); setPcStageWeight("")
    alert(`เพิ่ม ${addItems.length} รายการ · น้ำหนักรวม ${w ?? "-"} kg`)
  }

  const submit = async () => {
    if (!requesterName.trim()) return alert("No signed-in user found.")
    if (cart.length === 0) return alert("No items in the request yet.")
    if (!confirm(`Submit Pull Material request with ${cart.length} item(s)?`)) return
    setSubmitting(true)
    try {
      const r = await fetch("/api/pull-material", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bu, requesterName, requesterEmail: (session?.user as any)?.email, remark, items: cart, requestType: reqType, isTest, mode }),
      })
      const d = await r.json()
      if (r.ok) { alert(`Submitted: ${d.request?.documentNo}${isTest ? " (TEST — emails reroute to you)" : ""}`); setCart([]); setRemark(""); setIsTest(false); setModeTouched(false) }
      else alert(`Error: ${d.error || "submit failed"}`)
    } finally { setSubmitting(false) }
  }

  if (status === "loading") return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
  if (!isAdmin) return (
    <div className="p-10 max-w-lg mx-auto text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="text-lg font-bold mt-3" style={{ color: MAROON }}>Pull Material</h1>
      <p className="text-sm text-gray-500 mt-2">เฉพาะผู้ที่มีสิทธิ์ (SCM / Purchasing) — ติดต่อ Admin เพื่อขอสิทธิ์</p>
    </div>
  )

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>SCM — Pull Material</h1>
        <p className="text-sm text-gray-500">Request: pick SO / material + pull qty · Send Approve: decide air after LG + PC fill their data</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([["request", "1 · Request"], ["approve", "2 · Send Approve"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-current" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            style={tab === k ? { color: MAROON, borderColor: MAROON } : undefined}>{label}</button>
        ))}
      </div>

      {tab === "approve" ? (
        <>
          {/* Decision branch is derived from the signed-in role (no manual toggle):
              SCM_PULL → SCM decision · PURCHASING → PC decision. Admin tests via "View as". */}
          <SendApprove bu={bu} setBu={setBu} decisionStatus={dec.decisionStatus} nextStatus={dec.nextStatus} />
        </>
      ) : <>

      {/* BU tabs */}
      <div className="flex gap-1.5">
        {BUS.map(b => (
          <button key={b} onClick={() => { setBu(b); setResults([]); clearPicked() }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
            style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
        ))}
      </div>

      {/* Request type is derived from the signed-in role (no manual toggle):
          SCM_PULL → SCM (→ VP SCM → President) · PURCHASING → PC (→ DVM Pur → VP Pur). */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-400">
        Request type:
        {isRealAdmin ? (
          <span className="inline-flex gap-1">
            {(["SCM", "PURCHASING"] as const).map(t => (
              <button key={t} onClick={() => setAdminReqType(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${reqType === t ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                style={reqType === t ? { background: MAROON } : undefined}>{t === "SCM" ? "SCM request" : "Purchasing request"}</button>
            ))}
            <span className="ml-1 self-center text-amber-600">· admin preview both</span>
          </span>
        ) : (
          <>
            <span className="font-semibold text-gray-600">{reqType === "SCM" ? "SCM" : "Purchasing"}</span>
            <span>{reqType === "SCM" ? "→ VP SCM → President" : "→ DVM Pur → VP Pur"}</span>
          </>
        )}
      </div>

      {reqType === "PURCHASING" ? (
        /* ── PC (Purchasing): pick vendor → select some POs → one total weight → pull every material ── */
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800">Purchasing — เลือก Vendor → PO → ใส่น้ำหนักรวม</h2>
            <p className="text-xs text-gray-500 mt-0.5">เลือก vendor แล้วติ๊ก PO ที่จะ pull (บางหรือทั้งหมด) · ใส่น้ำหนักรวมก้อนเดียว · ระบบดึง<b>ทุก material ใต้ PO</b>ให้</p>
          </div>

          {/* 1 · Vendor picker (type-ahead from this BU's vendors) */}
          <div className="relative max-w-lg">
            <label className="text-xs font-semibold text-gray-600 block mb-1">1 · Vendor</label>
            {pcVend ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2 font-medium">🏭 {pcVend}</span>
                <button onClick={() => { setPcVend(""); setPcPos([]); setPcSelPos(new Set()) }} className="text-xs text-gray-400 hover:text-red-500">เปลี่ยน</button>
              </div>
            ) : (
              <>
                <input value={pcVendQ} onChange={e => { setPcVendQ(e.target.value); setPcVendOpen(true) }} onFocus={() => setPcVendOpen(true)}
                  onBlur={() => setTimeout(() => setPcVendOpen(false), 150)} placeholder="พิมพ์ชื่อ vendor…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                {pcVendOpen && (
                  <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-72 overflow-auto">
                    {pcVendors.filter(v => !pcVendQ.trim() || v.toLowerCase().includes(pcVendQ.trim().toLowerCase())).slice(0, 50).map(v => (
                      <button key={v} onMouseDown={() => pickPcVend(v)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 border-b border-gray-50 last:border-0">{v}</button>
                    ))}
                    {pcVendors.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">ไม่มี vendor ใน BU นี้</div>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Manual add — type a Vendor + PO yourself (PO may not be in the system) */}
          <div>
            <button onClick={() => setPcManualOpen(o => !o)} className="text-[11px] text-blue-600 font-medium hover:underline">
              {pcManualOpen ? "− ปิด" : "+ เพิ่ม PO เอง (กรณีไม่มีในระบบ)"}
            </button>
            {pcManualOpen && (
              <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                <div><label className="text-[11px] text-gray-500 block mb-0.5">Vendor</label>
                  <input value={pcManualVend} onChange={e => setPcManualVend(e.target.value)} placeholder={pcVend || "ชื่อ vendor"} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-64" /></div>
                <div><label className="text-[11px] text-gray-500 block mb-0.5">PO NO</label>
                  <input value={pcManualPo} onChange={e => setPcManualPo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addManualPo() } }} placeholder="เลข PO" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-48" /></div>
                <button onClick={addManualPo} disabled={pcLoad || !pcManualPo.trim()} className="px-3 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: MAROON }}>+ เพิ่ม</button>
                <span className="text-[11px] text-gray-400 self-center">ถ้า PO มีใน BOM → ดึง material ให้ · ถ้าไม่มี → เพิ่มเป็นรายการกรอกเอง</span>
              </div>
            )}
          </div>

          {/* 2 · PO selection */}
          {pcVend && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-600">2 · เลือก PO ({pcSelPos.size}/{pcPos.length})</label>
                {pcPos.length > 0 && <button onClick={() => setPcSelPos(allPosSel ? new Set() : new Set(pcPos.map((p: any) => p.po)))} className="text-[11px] text-red-600 font-medium">{allPosSel ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}</button>}
              </div>
              {pcPos.length > 0 && (
                <input value={pcPoQ} onChange={e => setPcPoQ(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); selectFilteredPos() } }}
                  placeholder="🔎 พิมพ์ PO แล้ว Enter เพื่อเลือก (พิมพ์บางส่วนได้ → เลือกทุกตัวที่ตรง)"
                  className="w-full mb-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
              )}
              {pcLoad && pcPos.length === 0 ? <p className="text-xs text-gray-400">กำลังโหลด PO…</p> :
                pcPos.length === 0 ? <p className="text-xs text-gray-400">ไม่พบ PO ของ vendor นี้</p> : (
                  <div className="border rounded-xl overflow-auto max-h-56">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0"><tr>
                        {["", "PO NO", "BRAND", "STYLE", "CUSTOMER", "SHIP DATE"].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {pcFilteredPos.map((p: any) => (
                          <tr key={p.po} className={`hover:bg-gray-50 ${pcSelPos.has(p.po) ? "bg-red-50/40" : ""}`}>
                            <td className="px-3 py-1.5"><input type="checkbox" checked={pcSelPos.has(p.po)} onChange={() => togglePcPo(p.po)} /></td>
                            <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{p.po}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{p.brand || "-"}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{p.style || "-"}</td>
                            <td className="px-3 py-1.5 max-w-[160px] truncate" title={p.customerName || ""}>{p.customerName || "-"}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(p.shipmentDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}

          {/* Selected materials (from the ticked POs) — with a delete button per row */}
          {pcSelMats.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-600">Material ที่เลือก ({pcSelMats.length}) · {pcSelPos.size} PO</label>
                <button onClick={() => { setPcSelMats([]); setPcSelPos(new Set()) }} className="text-[11px] text-red-600 font-medium hover:underline">🗑 ล้างทั้งหมด</button>
              </div>
              <div className="border rounded-xl overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0"><tr>
                    {["ITEM NAME", "GROUP", "PO NO", "POQTY BOMDUMMY", "UOM", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {pcSelMats.map(m => (
                      <tr key={matK(m)} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 max-w-[260px] truncate" title={m.itemName || m.itemCode || ""}>{m.itemName || m.itemCode || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{m.groupCode || "-"}</td>
                        <td className="px-3 py-1.5 font-medium whitespace-nowrap">{m.poNoDoc || "-"}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmt(m.poqtyBomdummy)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{m.bomUom || "-"}</td>
                        <td className="px-3 py-1.5 text-center"><button onClick={() => removePcMat(matK(m))} className="text-gray-300 hover:text-red-500" title="ลบรายการนี้">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {[...pcSelPos].map(po => (
                  <span key={po} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 rounded-full px-2 py-0.5">{po}
                    <button onClick={() => removePcPo(po)} className="text-gray-400 hover:text-red-600" title="ลบทั้ง PO">✕</button>
                  </span>
                ))}
              </div>

              {/* Summary BY PO — sum of qty + editable "Pull PO" (default = sum) */}
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-600 block mb-1">สรุปตาม PO (แก้ Pull PO ได้)</label>
                <div className="border rounded-xl overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50"><tr>
                      {["PO NO", "VENDOR", "# ITEM", "SUM POQTY", "PULL PO", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {Object.keys(pcPoSum).map(po => (
                        <tr key={po} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{po}</td>
                          <td className="px-3 py-1.5 max-w-[200px] truncate" title={pcPoSum[po].vend || ""}>{pcPoSum[po].vend || "-"}</td>
                          <td className="px-3 py-1.5 text-right">{pcPoSum[po].count}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(pcPoSum[po].sum)}</td>
                          <td className="px-3 py-1.5">
                            <input type="number" value={pcPullOf(po)} onChange={e => setPcPullQty(p => ({ ...p, [po]: e.target.value }))}
                              className="w-28 border border-red-300 rounded-lg px-2 py-1 text-xs text-right font-semibold text-red-800 focus:outline-none focus:ring-2 focus:ring-red-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                          </td>
                          <td className="px-3 py-1.5 text-center"><button onClick={() => removePcPo(po)} className="text-gray-300 hover:text-red-500" title="ลบทั้ง PO">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Pull PO = จำนวนที่จะ pull ต่อ PO (default = ยอดรวม, แก้ได้) · ระบบกระจายให้แต่ละ material ตามสัดส่วน</p>
              </div>
            </div>
          )}

          {/* 3 · total weight + add */}
          {pcSelMats.length > 0 && (
            <div className="flex items-end gap-3 flex-wrap rounded-xl border-2 border-red-200 bg-red-50/50 px-4 py-3">
              <div>
                <label className="text-sm font-bold block mb-1" style={{ color: MAROON }}>3 · น้ำหนักรวม (kg)<span className="text-red-500"> *</span></label>
                <input value={pcWeight} onChange={e => setPcWeight(e.target.value)} type="number" placeholder="0" min={0}
                  className="w-40 border-2 border-red-300 rounded-xl px-4 py-2 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-300 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={{ color: MAROON }} />
              </div>
              <span className="text-xs text-gray-500 self-center">รวมทุก PO ที่เลือก ({pcSelPos.size} PO · {pcSelMats.length} material) — ใช้คิด Est Air</span>
              <button onClick={addPcToCart} disabled={pcLoad} className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ml-auto" style={{ background: MAROON }}>
                {pcLoad ? "…" : "+ Add to request"}
              </button>
            </div>
          )}

          {/* Excel alternative */}
          <div className="border-t pt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400">หรือทำเป็นชุดด้วย Excel:</span>
            <button onClick={pcExport} disabled={pcBusy} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50">⬇ Export ({bu})</button>
            <label className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 cursor-pointer ${pcBusy ? "opacity-50" : ""}`}>⬆ Import
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={pcBusy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pcImport(f) }} />
            </label>
            {pcBusy && <span className="text-xs text-gray-400">กำลังประมวลผล…</span>}
          </div>

          {/* Imported POs (staged) → enter ONE total weight → Add */}
          {pcStaged.length > 0 && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-sky-800">📥 PO ที่ import ได้ ({pcStaged.length}) · material รวม {pcStaged.reduce((s, x) => s + x.mats.length, 0)}</p>
                <button onClick={() => setPcStaged([])} className="text-[11px] text-gray-400 hover:text-red-500">✕ ล้าง</button>
              </div>
              <div className="max-h-32 overflow-auto"><table className="w-full text-xs">
                <thead><tr className="text-gray-500"><th className="text-left px-2 py-1">Vendor</th><th className="text-left px-2 py-1">PO</th><th className="text-right px-2 py-1"># material</th></tr></thead>
                <tbody>{pcStaged.map((s, i) => <tr key={i} className="border-t border-sky-100"><td className="px-2 py-1">{s.vend || "-"}</td><td className="px-2 py-1 font-medium">{s.po}</td><td className="px-2 py-1 text-right">{s.mats.length}</td></tr>)}</tbody>
              </table></div>
              <div className="flex items-end gap-3 flex-wrap pt-1">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: MAROON }}>น้ำหนักรวม (kg)<span className="text-red-500"> *</span></label>
                  <input value={pcStageWeight} onChange={e => setPcStageWeight(e.target.value)} type="number" placeholder="0" min={0}
                    className="w-40 border-2 border-red-300 rounded-xl px-4 py-2 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-300 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={{ color: MAROON }} />
                </div>
                <span className="text-xs text-gray-500 self-center">รวมทุก PO ที่ import — ใช้คิด Est Air</span>
                <button onClick={addStagedToCart} className="px-4 py-2 rounded-lg text-white text-sm font-semibold ml-auto" style={{ background: MAROON }}>+ Add to request</button>
              </div>
            </div>
          )}

          {pcMissing.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">⚠ ไม่พบข้อมูลในระบบ ({pcMissing.length})</p>
              <div className="max-h-40 overflow-auto"><table className="w-full text-xs">
                <thead><tr className="text-amber-700"><th className="text-left px-2 py-1">Vendor</th><th className="text-left px-2 py-1">PO</th><th className="text-left px-2 py-1">เหตุผล</th></tr></thead>
                <tbody>{pcMissing.map((m, i) => <tr key={i} className="border-t border-amber-200"><td className="px-2 py-1">{m.vend || "-"}</td><td className="px-2 py-1 font-medium">{m.po || "-"}</td><td className="px-2 py-1 text-amber-700">{m.reason}</td></tr>)}</tbody>
              </table></div>
            </div>
          )}
        </div>
      ) : (<>

      {/* Search */}
      <div className="bg-white rounded-xl border p-4">
        {sync && (
          <div className={`mb-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${sync.stale ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-green-50 border-green-300 text-green-800"}`}>
            {sync.stale ? "⚠ BOM may be stale" : "● BOM last updated"}: {sync.txt}
            {sync.stale && <span className="opacity-80">— job may not have run today</span>}
          </div>
        )}
        <div className="relative">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Type SO number…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            <input value={poQ} onChange={e => setPoQ(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="…or PO number"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            <input value={vendQ} onChange={e => setVendQ(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="…or Vendor name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          {searching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>}
          {open && results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-80 overflow-auto">
              {/* Tick MULTIPLE SOs — the dropdown stays open so you can select several at once. */}
              {results.map((b, i) => {
                const on = pickedSos.some(s => s.soNoDoc === b.soNoDoc)
                return (
                  <button key={i} onMouseDown={e => { e.preventDefault(); togglePickSo(b) }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-gray-50 last:border-0 ${on ? "bg-red-50" : "hover:bg-red-50/60"}`}>
                    <input type="checkbox" readOnly checked={on} className="accent-red-700 pointer-events-none" />
                    <span className="flex-1">
                      <span className="font-semibold text-gray-800">{b.soNoDoc}</span>
                      <span className="text-gray-600"> · PO {b.poNoDoc || "-"}</span>
                      <span className="text-gray-500"> · {b.customerName || "-"} · {b.brand || "-"}/{b.gmtType || "-"} · order {fmt(b.orderQty)}</span>
                      <span className="text-violet-600"> · 🏭 {b.vendorName || "-"}</span>
                    </span>
                    {on && <span className="text-red-600 font-bold">✓</span>}
                  </button>
                )
              })}
            </div>
          )}
          {open && (q.trim() || poQ.trim() || vendQ.trim()) && !searching && results.length === 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg px-3 py-2 text-xs">
              {searchErr
                ? <span className="text-red-600">⚠ อ่านตาราง BOM ({bu}) ไม่ได้: {searchErr}</span>
                : <span className="text-gray-400">No SO found</span>}
            </div>
          )}
          {searchErr && !open && <p className="mt-2 text-[11px] text-red-600">⚠ BOM {bu}: {searchErr}</p>}
        </div>
      </div>

      {/* Material lines of every picked SO (multi-select) */}
      {pickedSos.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">Materials · {pickedSos.length} SO เลือก</h2>
            <button onClick={clearPicked} className="text-xs text-gray-400 hover:text-red-500">✕ ล้างที่เลือก</button>
          </div>
          {/* Picked SO chips (removable) */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pickedSos.map(s => (
              <span key={s.soNoDoc} className="inline-flex items-center gap-1 text-[11px] bg-red-50 border border-red-200 text-red-800 rounded-full px-2 py-0.5">
                {s.soNoDoc} <span className="text-gray-400">· order {fmt(s.orderQty)}</span>
                <button onClick={() => togglePickSo(s)} className="text-red-400 hover:text-red-600 ml-0.5">✕</button>
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3 flex-wrap rounded-xl border-2 border-red-200 bg-red-50/50 px-4 py-3">
            <label className="text-sm font-bold" style={{ color: MAROON }}>ดึงกี่ตัว (Pull garments)<span className="text-red-500"> *</span></label>
            <input value={pullGarment} onChange={e => setPullGarment(e.target.value)} type="number" placeholder="0" min={1}
              className="w-40 border-2 border-red-300 rounded-xl px-4 py-2.5 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" style={{ color: MAROON }} />
            <span className="text-xs text-gray-500">คำนวณต่อ SO อัตโนมัติ (แต่ละบรรทัดหารด้วย order qty ของ SO ตัวเอง)</span>
            {!pullGarment && <span className="text-xs font-semibold text-red-500">← กรอกจำนวนก่อนเลือกวัสดุ</span>}
          </div>

          {loadingMat && materials.length === 0 ? <p className="text-sm text-gray-400 mt-3">Loading materials…</p> : (
            <div className="mt-3 border rounded-xl overflow-auto max-h-[340px]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0"><tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap" title="เลือก/ยกเลิกทั้งหมด">
                      <input type="checkbox" checked={allTicked} onChange={toggleAll} /> All
                    </label>
                  </th>
                  {MAT_COLS.map(c => <th key={c.k} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{c.label}</th>)}
                  <th className="px-3 py-2 text-left font-medium text-red-700 whitespace-nowrap">PULL (calc)</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {materials.map((m, i) => {
                    const g = Number(pullGarment) || 0
                    const k = matKey(m)
                    return (
                      <tr key={k + i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <input type="checkbox" checked={!!m.itemCode && ticked.has(k)} onChange={() => m.itemCode && toggle(k)} />
                        </td>
                        {MAT_COLS.map(c => {
                          const v = (m as any)[c.k]
                          return <td key={c.k} className={`px-3 py-1.5 whitespace-nowrap ${c.kind === "num" ? "text-right" : ""}`}>
                            {c.kind === "date" ? fmtDate(v) : c.kind === "num" ? fmt(v) : (v ?? "-")}
                          </td>
                        })}
                        <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap" style={{ color: MAROON }}>
                          {g > 0 ? `${fmt(calcQty(m, g))} ${m.bomUom || ""}` : "-"}
                        </td>
                      </tr>
                    )
                  })}
                  {materials.length === 0 && !loadingMat && <tr><td colSpan={MAT_COLS.length + 2} className="px-3 py-3 text-center text-gray-400">No materials found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">เลือกไว้ {ticked.size} บรรทัด</span>
            <button onClick={addToCart} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>
              + Add to request
            </button>
          </div>
        </div>
      )}
      </>)}

      {/* Cart */}
      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold text-gray-800">Items to pull ({cart.length})</h2>
        <p className="text-xs text-gray-500 mt-1">Requester: <span className="font-medium text-gray-700">{requesterName || "-"}</span></p>
        {cart.length === 0 ? <p className="text-sm text-gray-400 mt-3">No items yet — search an SO and pick materials.</p> : (
          <div className="border rounded-xl overflow-auto mt-3">
            <table className="w-full text-xs">
              <thead className="bg-gray-50"><tr>
                {["SO", "Item No", "Item Code", "Material", "Consumption", "PULL garment", "PULL material", "Unit", ""].map(h =>
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {cart.map(c => (
                  <tr key={c.key} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-semibold text-gray-800">{c.soNoDoc}</td>
                    <td className="px-3 py-1.5">{c.itemNo || "-"}</td>
                    <td className="px-3 py-1.5">{c.itemCode || "-"}</td>
                    <td className="px-3 py-1.5">{c.itemName || c.itemCode}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(c.consumption)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(c.pullGarment)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold" style={{ color: MAROON }}>{fmt(c.pullMaterialQty)}</td>
                    <td className="px-3 py-1.5">{c.bomUom || "-"}</td>
                    <td className="px-3 py-1.5 text-center"><button onClick={() => removeCart(c.key)} className="text-gray-300 hover:text-red-500">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <label className="text-xs font-semibold text-gray-600">Remark</label>
          <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} placeholder="Note for this pull request (optional)"
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        </div>
        {/* Regular / Irregular mode — per document. Regular = fast-track (no wait for approval). */}
        <div className="mt-3 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-600">Mode เอกสาร:</span>
            {(["REGULAR", "IRREGULAR"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setModeTouched(true) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${mode === m ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                style={mode === m ? { background: m === "REGULAR" ? "#15803d" : "#b45309" } : undefined}>
                {m === "REGULAR" ? "🟢 Regular (ไม่ต้องรออนุมัติ)" : "🟠 Irregular (อนุมัติเต็ม)"}
              </button>
            ))}
            {!modeTouched && cart.length > 0 && (
              <span className="text-[11px] text-gray-400">· auto: {suggestRegular ? "Regular (SO ขึ้นต้น 02)" : "Irregular"}</span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Regular = SO ขึ้นต้น <b>02</b> (ทุก port) · หรือ SO <b>01</b> จาก port <b>ฮ่องกง</b> · หรือ SO <b>01</b> น้ำหนัก <b>&lt; 45 kg</b> — ระบบแนะนำให้จาก SO แต่แก้เองได้
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          {isAdmin ? (
            <label className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={isTest} onChange={e => setIsTest(e.target.checked)} />
              🧪 Test document — emails reroute to you (not real recipients) &amp; show who they'd go to
            </label>
          ) : <span />}
          <button onClick={submit} disabled={submitting || cart.length === 0}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: MAROON }}>
            {submitting ? "Submitting…" : "Submit Pull Material →"}
          </button>
        </div>
      </div>
      </>}
    </div>
  )
}

// ── Air Decision — pick which lines go AIR + sew date per line, after PC+LG data. Reused for BOTH
// the SCM decision (PENDING_SCM_DECISION → PENDING_VP_SCM) and the PC decision (PENDING_PC_DECISION
// → PENDING_DVM_PUR) via props. ──
function SendApprove({ bu, setBu, decisionStatus = "PENDING_SCM_DECISION", nextStatus = "PENDING_VP_SCM" }:
  { bu: string; setBu: (b: string) => void; decisionStatus?: string; nextStatus?: string }) {
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState<Record<string, string>>({})
  const [air, setAir] = useState<Record<string, boolean>>({})       // itemId → air?
  const [sew, setSew] = useState<Record<string, string>>({})        // itemId → sew date
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/pull-material?bu=${bu}`).then(r => r.json())
      const rows = (d.requests || []).filter((r: any) => r.status === decisionStatus)
      setReqs(rows)
      // default: every line AIR; prefill sew date from snapshot
      const a: Record<string, boolean> = {}, s: Record<string, string> = {}
      rows.forEach((rq: any) => rq.items.forEach((it: any) => {
        a[it.id] = it.airDecision ? it.airDecision === "AIR" : true
        s[it.id] = it.sewingStartDate ? String(it.sewingStartDate).slice(0, 10) : ""
      }))
      setAir(a); setSew(s)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [bu, decisionStatus]) // eslint-disable-line

  const submit = async (rq: any) => {
    const anyAir = rq.items.some((it: any) => air[it.id])
    if (anyAir && !(reason[rq.id] || "").trim()) return alert("Enter the Reason for Air before requesting approval.")
    if (!confirm(anyAir ? "Send the AIR lines for approval?" : "Mark all lines as NO AIR?")) return
    setBusy(rq.id)
    try {
      const r = await fetch(`/api/pull-material/${rq.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: anyAir ? nextStatus : "NO_AIR",
          itemUpdates: rq.items.map((it: any) => ({
            id: it.id,
            airDecision: air[it.id] ? "AIR" : "NO_AIR",
            sewingStartDate: sew[it.id] || null,
            reasonAirPick: air[it.id] ? (reason[rq.id] || "") : null,
          })),
        }),
      })
      if (r.ok) await load()
    } finally { setBusy(null) }
  }

  return (
    <>
      <div className="flex gap-1.5">{BUS.map(b => (
        <button key={b} onClick={() => setBu(b)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${bu === b ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`} style={bu === b ? { background: buColor(b) } : undefined}>{b}</button>
      ))}</div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        reqs.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No documents pending decision — must pass Purchasing (PC) + LG first</div> :
          reqs.map(rq => (
            <div key={rq.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div><span className="font-bold text-blue-700">{rq.documentNo}</span>
                  <span className="text-xs text-gray-500"> · {rq.requesterName} · {rq.items.length} items</span></div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Pending SCM air decision</span>
              </div>
              <div className="mt-3 border rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    {["✈ AIR", "SO", "OU", "Material", "PULL", "Consumption", "Country", "Incoterm", "G.W.(kg)", "Air Freight", "Sea Freight", "Lead Air", "Lead Sea", "Need Date", "Sew Date"].map(h =>
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rq.items.map((it: any) => (
                      <tr key={it.id} className={`hover:bg-gray-50 ${air[it.id] ? "" : "opacity-50"}`}>
                        <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={!!air[it.id]} onChange={e => setAir(p => ({ ...p, [it.id]: e.target.checked }))} /></td>
                        <td className="px-3 py-1.5 font-semibold text-gray-800">{it.soNoDoc}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.ou || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.itemName || it.itemCode}</td>
                        <td className="px-3 py-1.5">{fmt(it.pullMaterialQty)} {it.bomUom || ""}</td>
                        <td className="px-3 py-1.5">{fmt(it.consumption)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{it.country || "-"}</td>
                        <td className="px-3 py-1.5">{it.incoterm || "-"}</td>
                        <td className="px-3 py-1.5">{fmt(it.weight)}</td>
                        <td className="px-3 py-1.5 font-semibold" style={{ color: MAROON }}>{fmt(it.airFreightCost)}</td>
                        <td className="px-3 py-1.5">{fmt(it.seaFreightCost)}</td>
                        <td className="px-3 py-1.5">{it.leadTimeAir || "-"}</td>
                        <td className="px-3 py-1.5">{it.leadTimeSea || "-"}</td>
                        <td className="px-3 py-1.5">{fmtDate(it.needDate)}</td>
                        <td className="px-3 py-1.5"><input type="date" value={sew[it.id] || ""} onChange={e => setSew(p => ({ ...p, [it.id]: e.target.value }))} className="border border-gray-200 rounded px-2 py-1 text-xs" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <label className="text-xs font-semibold text-gray-600">Reason for Air <span className="text-red-500">*</span></label>
                <input value={reason[rq.id] || ""} onChange={e => setReason(p => ({ ...p, [rq.id]: e.target.value }))} placeholder="Why air is required (for the AIR lines)"
                  className="flex-1 min-w-[240px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                <button onClick={() => submit(rq)} disabled={busy === rq.id} className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: MAROON }}>
                  {busy === rq.id ? "..." : "Submit decision →"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">Ticked lines = request AIR approval · unticked = NO AIR. If no line is ticked the whole doc is marked NO AIR.</p>
            </div>
          ))}
    </>
  )
}
