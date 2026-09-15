"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { buColor } from "../_StageWork"
import { seaUsd, courierUsd, destForBu, EXCHANGE_RATE, truckTransportUsd } from "@/lib/pull-courier"

const MAROON = "#6b1a1a"
const GOLD = "#b08d2e"      // luxury accent
const GOLD_SOFT = "#c9a94e"
const BUS = ["NYG", "EA", "TRM", "GW"]
// Landed-cost constants (Thailand-side, baht) — converted to USD via EXCHANGE_RATE at compute time.
const SHIP_CLEAR_BAHT = 1000, LOCAL_AIR_BAHT_KG = 2, STORE_AIR_BAHT_KG = 4.5, STORE_SEA_BAHT = 1500, LOCAL_SEA_BAHT_CBM = 2500
// CBM by shipment weight (sea): <500kg=1, ≤700=2, ≤1000=3, >1000=4.
const cbmOf = (w: number) => (w < 500 ? 1 : w <= 700 ? 2 : w <= 1000 ? 3 : 4)

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

const INCOTERMS = ["FOB", "CIF", "EX-WORK", "FCA"]
const NEEDS_ADDRESS = ["EX-WORK", "FCA"]
// Air weight breaks (kg) → Q-column key (mirror of Logistics / Purchase so Est Air matches downstream).
const BREAK_ORDER = [45, 100, 250, 300, 500, 1000, 2000, 8000]
const breakKey = (w: number) => { let b = 45; for (const x of BREAK_ORDER) if (x <= w) b = x; return "Q" + b }

const fmt = (n: any) => (n == null || isNaN(Number(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }))
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString("en-GB") }
// Earliest of a list of date-ish values (used for system-derived Shipment Date + MRD on the request form).
const earliest = (arr: any[]) => { const t = arr.map(v => (v ? new Date(v).getTime() : NaN)).filter(n => !isNaN(n)); return t.length ? new Date(Math.min(...t)) : null }

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
  const [pcCities, setPcCities] = useState<any[]>([])
  const [pcCityId, setPcCityId] = useState("")
  const [pcFactory, setPcFactory] = useState("") // destination factory (EA/TRM fixed by BU; NYG/GW → G1..G4/GW)
  const [pcVendors, setPcVendors] = useState<string[]>([])
  const [pcUoms, setPcUoms] = useState<string[]>([])
  const [pcVend, setPcVend] = useState("")
  const [pcVendQ, setPcVendQ] = useState("")
  const [pcVendOpen, setPcVendOpen] = useState(false)
  const [vendorAddrLoading, setVendorAddrLoading] = useState(false)
  const [vendorMatched, setVendorMatched] = useState("")
  const [pickupEditing, setPickupEditing] = useState(false)
  const [vendorInfo, setVendorInfo] = useState({ email: "", contactName: "", tel: "" })
  // Per-PO invoice { po: inv } — read from an uploaded doc (Excel now / PDF+OCR later) or typed by hand.
  const [poInvMap, setPoInvMap] = useState<Record<string, string>>({})
  const [invReading, setInvReading] = useState(false)
  const [invMsg, setInvMsg] = useState("")
  const [invModalOpen, setInvModalOpen] = useState(false)
  const [invResults, setInvResults] = useState<{ name: string; status: "reading" | "ok" | "warn" | "none" | "scan" | "error"; detail: string }[]>([])
  const [pcPos, setPcPos] = useState<any[]>([])
  const [pcSelPos, setPcSelPos] = useState<Set<string>>(new Set())
  const [pcSelMats, setPcSelMats] = useState<Bom[]>([]) // materials of the selected POs (shown below)
  const [pcManualOpen, setPcManualOpen] = useState(false)
  const [pcManualVend, setPcManualVend] = useState("")
  const [pcManualPo, setPcManualPo] = useState("")
  const [pcPullQty, setPcPullQty] = useState<Record<string, string>>({}) // per-PO "Pull PO" qty (editable; default = sum)
  const [pcWeight, setPcWeight] = useState("")
  const [pcLoad, setPcLoad] = useState(false)
  // PC purchase info (shipment-level) — moved from the Purchase page into the request. Stamped on every
  // pulled item at submit. Country/Port drive Est Air (freight master); City is separate (Master Purchase).
  const [pcPur, setPcPur] = useState({ country: "", port: "", seaPort: "", incoterm: "", pickup: "", needDate: "", etc: "", pkg: "", boxW: "", boxL: "", boxH: "" })
  // Packing list (per shipment/doc): add lines of { uom, qty }.
  const [pcPkgs, setPcPkgs] = useState<{ uom: string; qty: string }[]>([{ uom: "", qty: "" }])
  const [airRows, setAirRows] = useState<any[]>([])
  const [seaRows, setSeaRows] = useState<any[]>([])
  const [courierRows, setCourierRows] = useState<any[]>([])
  const [truckRows, setTruckRows] = useState<any[]>([])
  // Excel import staging: found (VEND, PO) rows → fill ONE total weight on-screen, then Add.
  const [pcStaged, setPcStaged] = useState<{ vend: string; po: string; mats: Bom[] }[]>([])
  const [pcStageWeight, setPcStageWeight] = useState("")
  const [remark, setRemark] = useState("")
  const [files, setFiles] = useState<File[]>([])   // attachments staged in the form → uploaded after create
  const [isTest, setIsTest] = useState(false)
  // Regular (fast-track) vs Irregular (full approval), per doc. Auto-suggested from SO prefix "02";
  // (the Hong-Kong-port / weight<45kg parts are only known after Purchase, so those refine later).
  const [mode, setMode] = useState<"REGULAR" | "IRREGULAR">("IRREGULAR")
  const [modeTouched, setModeTouched] = useState(false)
  const suggestRegular = cart.length > 0 && cart.every(c => String(c.soNoDoc || "").startsWith("02"))
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4500) }
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
    fetch(`/api/bom?bu=${bu}&uoms=1`).then(r => r.json()).then(d => setPcUoms(d.uoms || [])).catch(() => {})
  }, [bu, reqType])
  // Master Purchase cities (Country/Port/City) for the PC City dropdown.
  useEffect(() => {
    if (reqType !== "PURCHASING") return
    fetch("/api/pull-material/cities").then(r => r.json()).then(d => setPcCities(d.rows || [])).catch(() => {})
  }, [reqType])
  const pcCity = pcCities.find((c: any) => c.id === pcCityId) || null
  // Destination factory options by BU (EA/TRM fixed; NYG & GW pick a G-factory). Default when BU changes.
  const factoryOptions = bu === "EA" ? ["EA"] : bu === "TRM" ? ["TRM"] : ["G1", "G2", "G3", "G4", "GW", "EA", "TRM"]
  useEffect(() => { setPcFactory(bu === "EA" ? "EA" : bu === "TRM" ? "TRM" : "") }, [bu])
  // Freight master (air/sea) for the Country → Port cascade + live Est Air preview.
  useEffect(() => {
    if (reqType !== "PURCHASING") return
    fetch("/api/pull-material/air-rates").then(r => r.json()).then(d => setAirRows(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/sea-rates").then(r => r.json()).then(d => setSeaRows(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/courier-rates").then(r => r.json()).then(d => setCourierRows(d.rows || [])).catch(() => {})
    fetch("/api/pull-material/truck-rates").then(r => r.json()).then(d => setTruckRows(d.rows || [])).catch(() => {})
  }, [reqType])
  const { countries, airByCountry, seaByCountry, seaLtByPort } = useMemo(() => {
    const airByCountry: Record<string, Set<string>> = {}, seaByCountry: Record<string, Set<string>> = {}
    const seaLtByPort: Record<string, string> = {}
    // Normalize country case so "China" / "CHINA" group into ONE entry (ports merged).
    airRows.forEach(r => { const c = String(r.country || "").trim().toUpperCase(); if (c && r.origin) (airByCountry[c] ??= new Set()).add(r.origin) })
    seaRows.forEach(r => { const c = String(r.country || "").trim().toUpperCase(); if (c && r.port) (seaByCountry[c] ??= new Set()).add(r.port); if (r.port && r.leadTime) seaLtByPort[r.port] = r.leadTime })
    const countries = [...new Set([...Object.keys(airByCountry), ...Object.keys(seaByCountry)])].sort()
    return { countries, airByCountry, seaByCountry, seaLtByPort }
  }, [airRows, seaRows])
  // Live Est Air preview from the shipment total weight + chosen port + incoterm (same rule as backend).
  const pcEstAir = useMemo(() => {
    const w = Number(pcWeight) || 0, port = pcPur.port
    const routes = airRows.filter(r => r.origin === port)
    if (!w || !port || !routes.length) return null
    const bk = breakKey(w)
    const cand = routes.map(r => ({ rate: Number(r.rates?.[bk]), tt: r.tt, exw: Number(r.origCostExw) || 0, fca: Number(r.origCostFca) || 0 })).filter(x => x.rate && !isNaN(x.rate))
    if (!cand.length) return null
    const best = cand.reduce((a, b) => (b.rate > a.rate ? b : a))
    const inc = pcPur.incoterm.toUpperCase()
    const add = inc === "EX-WORK" ? best.exw : inc === "FCA" ? best.fca : 0
    return { est: Math.round((best.rate * w + add) * 100) / 100, add, inc }
  }, [pcWeight, pcPur.port, pcPur.incoterm, airRows])

  // Full LANDED-COST compare (Air / Courier / Sea) — every line in USD (baht ÷ EXCHANGE_RATE 32.5).
  // Thailand-side charges (local / store / transport) apply to NYG only; GW/EA/TRM ship abroad.
  const pcCompare = useMemo(() => {
    const w = Number(pcWeight) || 0, port = pcPur.port, dest = destForBu(bu)
    if (!w || (!port && !pcPur.seaPort)) return null
    const R = EXCHANGE_RATE, r2 = (v: number) => Math.round(v * 100) / 100
    const isNyg = bu === "NYG"
    const clear = r2(SHIP_CLEAR_BAHT / R)
    // AIR — freight (USD, from master) + FCA/EXWORK origin cost; + TH charges (NYG).
    const air = pcEstAir ? (() => {
      const freight = r2(pcEstAir.est - pcEstAir.add), fca = r2(pcEstAir.add)
      const local = isNyg ? r2((LOCAL_AIR_BAHT_KG * w) / R) : 0
      const store = isNyg ? r2((STORE_AIR_BAHT_KG * w) / R) : 0
      const transport = isNyg ? (truckTransportUsd(truckRows, pcFactory, "air", w) || 0) : 0
      return { freight, fca, clear, local, store, transport, total: r2(freight + fca + clear + local + store + transport) }
    })() : null
    // COURIER (DHL) — freight only.
    const dhl = courierUsd(courierRows, port, dest, w, "DHL")
    const courier = dhl != null ? { freight: dhl, fca: 0, clear: 0, local: 0, store: 0, transport: 0, total: dhl } : null
    // SEA — LCL rate (USD/CBM) × cbm; + Store (NYG). (Sea local charge rule pending confirm.)
    const seaM = seaUsd(seaRows, pcPur.seaPort || port, pcPur.country)
    const cbm = cbmOf(w)
    const sea = seaM ? (() => {
      const freight = r2(seaM.cost * cbm)
      const local = isNyg ? r2((LOCAL_SEA_BAHT_CBM * cbm) / R) : 0
      const store = isNyg ? r2(STORE_SEA_BAHT / R) : 0
      const transport = isNyg ? (truckTransportUsd(truckRows, pcFactory, "sea", w) || 0) : 0
      return { freight, fca: 0, clear, local, store, transport, total: r2(freight + clear + local + store + transport), cbm }
    })() : null
    return { air, courier, sea, over: w > 100, isNyg }
  }, [pcWeight, pcPur.port, pcPur.seaPort, pcPur.country, pcPur.incoterm, bu, pcFactory, airRows, seaRows, courierRows, truckRows, pcEstAir])

  // Include the PO — the same SO/item can appear under several POs; keying by SO+item alone would
  // collapse them and make one PO "disappear" from the summary.
  const matK = (m: any) => `${m.poNoDoc || "-"}|${m.soNoDoc}|${m.itemCode}`
  const pickPcVend = async (v: string) => {
    setPcVend(v); setPcVendQ(""); setPcVendOpen(false); setPcSelPos(new Set()); setPcSelMats([]); setPcLoad(true); setPickupEditing(false); setVendorMatched("")
    // Auto-fill the Vendor / Pickup address from dc_vendor (contain match on vendor_name).
    setVendorAddrLoading(true)
    fetch(`/api/bom?bu=${bu}&vendorAddr=${encodeURIComponent(v)}`).then(r => r.json())
      .then(d => { setPcPur(p => ({ ...p, pickup: d.address || "" })); setVendorMatched(d.matched || ""); setVendorInfo({ email: d.email || "", contactName: d.contactName || "", tel: d.tel || "" }) }).catch(() => {}).finally(() => setVendorAddrLoading(false))
    try { const d = await fetch(`/api/bom?bu=${bu}&vendorPos=${encodeURIComponent(v)}`).then(r => r.json()); setPcPos(Array.isArray(d.pos) ? d.pos : []) }
    finally { setPcLoad(false) }
  }
  // Read uploaded invoice doc(s) → auto-fill INV per PO (Excel/PDF-text; scan → type by hand).
  // Accepts multiple files: reads each, merges the results, and attaches all to the document.
  const readInvFile = async (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : []
    if (!files.length) return
    const pos = [...new Set(cart.map((c: any) => c.poNoDoc).filter(Boolean))] as string[]
    if (!pos.length) { setInvMsg("เลือก PO ก่อน แล้วค่อยอัปไฟล์"); return }
    // Attach every uploaded file to the document (dedup by name+size).
    setFiles(prev => { const out = [...prev]; for (const f of files) if (!out.some(x => x.name === f.name && x.size === f.size)) out.push(f); return out })
    setInvReading(true); setInvMsg("")
    setInvModalOpen(true)
    setInvResults(files.map(f => ({ name: f.name, status: "reading" as const, detail: "กำลังอ่าน…" })))
    const merged: Record<string, string> = {}
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      let status: "ok" | "warn" | "none" | "scan" | "error" = "none"; let detail = ""
      try {
        const fd = new FormData(); fd.append("file", file); fd.append("pos", pos.join(","))
        const d = await fetch("/api/pull-material/read-invoice", { method: "POST", body: fd }).then(r => r.json())
        if (d.error) { status = "error"; detail = "อ่านไฟล์ไม่ได้" }
        else if (d.kind === "image" || d.kind === "pdf-scanned") { status = "scan"; detail = "ไฟล์สแกน/รูป — ต้อง OCR (พิมพ์ INV เอง)" }
        else {
          const found = (d.pairs || {}) as Record<string, string>
          const present = (d.present || []) as string[]
          const gotPos = Object.keys(found).filter(p => found[p]) // only POs actually in the file
          for (const p of gotPos) if (!merged[p]) merged[p] = found[p]
          if (gotPos.length) {
            status = "ok"; detail = "✓ พบในไฟล์: " + gotPos.map(p => `${p} → ${found[p]}`).join(", ")
          } else if (present.length === 0) {
            status = "warn"; detail = "⚠️ ไม่พบ PO ของเอกสารนี้ในไฟล์เลย — ไม่เติม INV ให้ (คีย์เอง) · ตรวจว่าอัปถูกเอกสาร"
          } else {
            status = "none"; detail = `พบ PO ในไฟล์ (${present.join(", ")}) แต่ไม่เจอเลข INV — คีย์เอง`
          }
        }
      } catch { status = "error"; detail = "เกิดข้อผิดพลาดตอนอ่าน" }
      setInvResults(prev => prev.map((r, idx) => (idx === i ? { ...r, status, detail } : r)))
    }
    setPoInvMap(prev => ({ ...prev, ...merged }))
    const n = Object.keys(merged).length
    setInvMsg(`✓ อ่านเสร็จ ${files.length} ไฟล์ · เติม INV ${n}/${pos.length} PO · 📎 แนบไฟล์แล้ว`)
    setInvReading(false)
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
  const pcPoSum: Record<string, { count: number; sum: number; vend: string | null; uoms: Set<string> }> = {}
  pcSelMats.forEach(m => { const po = m.poNoDoc || "-"; const g = (pcPoSum[po] ||= { count: 0, sum: 0, vend: (m as any).vendorName || null, uoms: new Set<string>() }); g.count++; g.sum += Number(m.poqtyBomdummy) || 0; if (m.bomUom) g.uoms.add(m.bomUom) })
  const pcUomOf = (po: string) => [...(pcPoSum[po]?.uoms || [])].join(", ") || "-"
  const pcPullOf = (po: string) => pcPullQty[po] ?? String(pcPoSum[po]?.sum ?? 0)

  // PC flow = ONE step: the selected POs (+ imported) ARE the request items (no "Add to request").
  // Keep the cart auto-synced from the selection so Submit works in a single go.
  useEffect(() => {
    if (reqType !== "PURCHASING") return
    const sel = pcSelMats.map(m => {
      const po = m.poNoDoc || "-"; const g = pcPoSum[po]
      const pullPO = Number(pcPullQty[po] ?? (g?.sum ?? 0)) || 0
      const share = g && g.sum > 0 ? (Number(m.poqtyBomdummy) || 0) / g.sum : (g && g.count ? 1 / g.count : 0)
      return { ...m, key: matK(m), pullGarment: Number(m.orderQty) || 0, pullMaterialQty: Math.round(pullPO * share * 100) / 100, weight: null, ...emptyScm }
    })
    const staged = pcStaged.flatMap(s => s.mats.map(m => ({ ...m, key: matK(m), pullGarment: Number(m.orderQty) || 0, pullMaterialQty: Number(m.bomQty) || 0, weight: null, ...emptyScm })))
    const merged = [...sel, ...staged.filter(s => !sel.some(x => x.key === s.key))]
    setCart(merged as CartItem[])
  }, [reqType, pcSelMats, pcPullQty, pcStaged]) // eslint-disable-line react-hooks/exhaustive-deps

  // Add: the per-PO "Pull PO" qty is distributed across its materials (by poqtyBomdummy share).
  const addPcToCart = () => {
    if (!pcSelMats.length) return alert("เลือก PO / material ก่อน")
    const addItems = pcSelMats.map((m) => {
      const po = m.poNoDoc || "-"
      const g = pcPoSum[po]
      const pullPO = Number(pcPullOf(po)) || 0
      const share = g && g.sum > 0 ? (Number(m.poqtyBomdummy) || 0) / g.sum : (g && g.count ? 1 / g.count : 0)
      const q = Math.round(pullPO * share * 100) / 100
      // weight is entered once in the "ข้อมูลจัดซื้อ" box → applied to item 0 at submit.
      return { ...m, key: matK(m), pullGarment: Number(m.orderQty) || 0, pullMaterialQty: q, weight: null, ...emptyScm }
    })
    setCart(prev => [...prev.filter(c => !addItems.some(a => a.key === c.key)), ...addItems])
    setPcVend(""); setPcPos([]); setPcSelPos(new Set()); setPcSelMats([]); setPcPullQty({})
    alert(`เพิ่ม ${addItems.length} material`)
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

  // Add the imported (staged) POs to the cart. Weight is entered once in the "ข้อมูลจัดซื้อ" box.
  const addStagedToCart = () => {
    if (!pcStaged.length) return
    const addItems: any[] = []
    for (const s of pcStaged) for (const m of s.mats) {
      addItems.push({ ...m, key: matK(m), pullGarment: Number(m.orderQty) || 0, pullMaterialQty: Number(m.bomQty) || 0, weight: null, ...emptyScm })
    }
    setCart(prev => [...prev.filter(c => !addItems.some(a => a.key === c.key)), ...addItems])
    setPcStaged([]); setPcStageWeight("")
    alert(`เพิ่ม ${addItems.length} รายการ`)
  }

  const OTHER = "__OTHER__"
  const submit = async () => {
    const stop = (m: string) => { showToast(`⚠ ${m}`, false); return undefined }
    if (!requesterName.trim()) return stop("No signed-in user found.")
    if (cart.length === 0) return stop("ยังไม่มีรายการ — เลือก vendor / PO ก่อน")

    // PC requests carry the purchase info here (no separate Purchase stage) → validate + stamp on items.
    let items: any[] = cart
    let pkgs: { uom: string; qty: number }[] = []
    if (reqType === "PURCHASING") {
      const c = pcPur.country === OTHER ? "" : pcPur.country
      const p = pcPur.port === OTHER ? "" : pcPur.port
      const sp = pcPur.seaPort === OTHER ? "" : pcPur.seaPort
      if (!c.trim()) return stop("เลือก / พิมพ์ Country")
      if (!p.trim() && !sp.trim()) return stop("เลือก Air Port หรือ Sea Port")
      if (!pcPur.incoterm) return stop("เลือก Incoterm")
      if (!pcFactory.trim()) return stop("เลือก Factory (โรงงานปลายทาง)")
      if (!pcPur.needDate) return stop("เลือก Need date (in-house)")
      if (!pcPur.etc) return stop("เลือก ETC")
      if (NEEDS_ADDRESS.includes(pcPur.incoterm) && !pcPur.pickup.trim()) return stop(`${pcPur.incoterm} ต้องระบุ Pickup address`)
      if (!String(pcWeight).trim() || !(Number(pcWeight) > 0)) return stop("กรอกน้ำหนักรวม (kg) ในกล่องข้อมูลจัดซื้อ")
      pkgs = pcPkgs.map(x => ({ uom: x.uom.trim(), qty: Number(x.qty) || 0 })).filter(x => x.uom && x.uom !== "__OTHER__" && x.qty > 0)
      if (!pkgs.length) return stop("เพิ่ม Package อย่างน้อย 1 บรรทัด (UOM + จำนวน)")
      const pu = {
        country: c, port: p, seaPort: sp, incoterm: pcPur.incoterm,
        pickupAddress: pcPur.pickup || "",
        city: pcCity?.city || "", needDate: pcPur.needDate || "", etc: pcPur.etc || null,
        cartons: pkgs.reduce((s, x) => s + x.qty, 0), boxW: pcPur.boxW, boxL: pcPur.boxL, boxH: pcPur.boxH,
      }
      // weight (whole shipment) → put on item 0; that's what recomputePullAir reads for Est Air.
      items = cart.map((it, i) => ({ ...it, ...pu, weight: i === 0 ? Number(pcWeight) : null }))
    }
    if (!remark.trim()) return stop("กรุณากรอก Material Description (ช่อง Remark)")
    setSubmitting(true)
    try {
      const r = await fetch("/api/pull-material", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bu, requesterName, requesterEmail: (session?.user as any)?.email, remark, items, requestType: reqType, isTest, mode, factory: pcFactory || null, packages: pkgs, poInvoices: Object.fromEntries(Object.entries(poInvMap).filter(([, v]) => v && v.trim())), vendorEmail: vendorInfo.email, vendorContact: vendorInfo.contactName, vendorTel: vendorInfo.tel }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        // Upload staged attachments to the freshly-created request.
        const rid = d.request?.id
        let upFail = 0
        if (rid && files.length) {
          for (const f of files) {
            const fd = new FormData(); fd.append("file", f); fd.append("category", "PACKING"); fd.append("source", "PC")
            const ur = await fetch(`/api/pull-material/${rid}/attachments`, { method: "POST", body: fd }).catch(() => null)
            if (!ur || !ur.ok) upFail++
          }
        }
        showToast(`✓ ส่งคำขอแล้ว: ${d.request?.documentNo}${files.length ? ` · แนบไฟล์ ${files.length - upFail}/${files.length}` : ""}`, true)
        setCart([]); setRemark(""); setIsTest(false); setModeTouched(false); setFiles([])
        setPcFactory(bu === "EA" ? "EA" : bu === "TRM" ? "TRM" : "")
        setPcPur({ country: "", port: "", seaPort: "", incoterm: "", pickup: "", needDate: "", etc: "", pkg: "", boxW: "", boxL: "", boxH: "" })
        setPcCityId(""); setPcSelMats([]); setPcSelPos(new Set()); setPcPullQty({}); setPcWeight(""); setPcPkgs([{ uom: "", qty: "" }]); setPickupEditing(false); setPoInvMap({}); setInvMsg(""); setVendorInfo({ email: "", contactName: "", tel: "" })
      }
      else showToast(`✕ ส่งไม่สำเร็จ (HTTP ${r.status}): ${d.error || "submit failed"}`, false)
    } catch (e) {
      showToast(`✕ ส่งไม่สำเร็จ: ${String((e as any)?.message || e).slice(0, 140)}`, false)
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
      {/* Full-screen loading overlay while the request is being submitted (+ files uploading) */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-4 border-gray-200 animate-spin" style={{ borderTopColor: MAROON }} />
            <p className="text-sm font-semibold text-gray-700">กำลังส่งคำขอ…</p>
            {files.length > 0 && <p className="text-[11px] text-gray-400">อัปโหลดไฟล์แนบ {files.length} ไฟล์</p>}
          </div>
        </div>
      )}
      {/* Auto-dismiss toast (no OK button) */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 rounded-xl shadow-lg px-4 py-3 text-sm font-medium text-white max-w-sm ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold" style={{ color: MAROON }}>{reqType === "PURCHASING" ? "Purchasing req air" : "SCM — RM REQ AIR"}</h1>
      </div>

      {/* Sub-tabs — Purchasing req air is a direct request (no SCM "Send Approve" step). */}
      <div className="flex gap-1 border-b border-gray-200">
        {(reqType === "PURCHASING"
          ? ([["request", "1 · Request"]] as const)
          : ([["request", "1 · Request"], ["approve", "2 · Send Approve"]] as const)
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-current" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            style={tab === k ? { color: MAROON, borderColor: MAROON } : undefined}>{label}</button>
        ))}
      </div>

      {tab === "approve" && reqType !== "PURCHASING" ? (
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
        <div className="rounded-2xl p-5 space-y-4 shadow-sm" style={{ background: "linear-gradient(180deg,#fffdf8 0%,#ffffff 60%)", border: `1px solid ${GOLD_SOFT}55` }}>
          <div className="flex items-center gap-3">
            <span className="h-8 w-1 rounded-full" style={{ background: `linear-gradient(${GOLD},${MAROON})` }} />
            <h2 className="text-lg font-bold tracking-tight" style={{ color: MAROON }}>Purchasing <span style={{ color: GOLD }}>·</span> Pull Material</h2>
          </div>


          {/* 1 · Vendor picker (type-ahead from this BU's vendors) */}
          <div className="relative max-w-lg">
            <label className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: GOLD }}>1 · Vendor</label>
            {pcVend ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm rounded-lg px-3 py-2 font-medium" style={{ background: "#fbf7ec", border: `1px solid ${GOLD_SOFT}66`, color: MAROON }}>🏭 {pcVend}</span>
                <button onClick={() => { setPcVend(""); setPcPos([]); setPcSelPos(new Set()); setPickupEditing(false); setPcPur(p => ({ ...p, pickup: "" })); setVendorInfo({ email: "", contactName: "", tel: "" }); setVendorMatched("") }} className="text-xs text-gray-400 hover:text-red-500">เปลี่ยน vendor</button>
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

          {/* Vendor / Pickup address — auto-filled from dc_vendor (contain match on vendor_name); "เปลี่ยน" to edit */}
          {pcVend && (
            <div className="max-w-lg">
              <label className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: GOLD }}>ที่อยู่ Vendor
                {vendorAddrLoading && <span className="text-gray-400 normal-case font-normal">· กำลังดึง…</span>}
                {!vendorAddrLoading && vendorMatched && <span className="text-emerald-600 normal-case font-normal"> · match: 🏭 {vendorMatched}</span>}
                {!vendorAddrLoading && !vendorMatched && <span className="text-amber-500 normal-case font-normal"> · ไม่พบใน dc_vendor</span>}
              </label>
              {pickupEditing ? (
                <textarea value={pcPur.pickup} onChange={e => setPcPur(p => ({ ...p, pickup: e.target.value }))} rows={3} autoFocus
                  placeholder="ที่อยู่ vendor / supplier (พิมพ์แก้ได้)"
                  className="w-full border border-amber-300 bg-amber-50 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 text-sm rounded-lg px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 whitespace-pre-wrap min-h-[38px]">
                    {pcPur.pickup || <span className="text-gray-400">— ไม่พบใน dc_vendor · กด “เปลี่ยน” เพื่อพิมพ์เอง —</span>}
                  </div>
                  <button onClick={() => setPickupEditing(true)} className="text-xs text-blue-600 hover:underline whitespace-nowrap mt-2">เปลี่ยน</button>
                </div>
              )}
              {/* Vendor contact — auto-filled from dc_vendor if present, editable */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">Email</label>
                  <input type="email" value={vendorInfo.email} onChange={e => setVendorInfo(v => ({ ...v, email: e.target.value }))} placeholder="email vendor"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">ชื่อผู้ติดต่อ</label>
                  <input value={vendorInfo.contactName} onChange={e => setVendorInfo(v => ({ ...v, contactName: e.target.value }))} placeholder="ชื่อผู้ติดต่อ"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">Tel</label>
                  <input value={vendorInfo.tel} onChange={e => setVendorInfo(v => ({ ...v, tel: e.target.value }))} placeholder="เบอร์โทร"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
              </div>
            </div>
          )}

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
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>2 · เลือก PO ({pcSelPos.size}/{pcPos.length})</label>
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

          {/* Summary BY PO — sum of qty + UOM + editable "Pull PO" (default = sum). ระบบกระจายให้แต่ละ material ตามสัดส่วน */}
          {pcSelMats.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-600">สรุปตาม PO ({pcSelPos.size} PO · {pcSelMats.length} material) — แก้ Pull PO ได้</label>
                <button onClick={() => { setPcSelMats([]); setPcSelPos(new Set()) }} className="text-[11px] text-red-600 font-medium hover:underline">🗑 ล้างทั้งหมด</button>
              </div>
              <div className="border rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    {["PO NO", "VENDOR", "# ITEM", "SUM POQTY", "UOM", "PULL PO", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {Object.keys(pcPoSum).map(po => (
                      <tr key={po} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-semibold text-gray-800 whitespace-nowrap">{po}</td>
                        <td className="px-3 py-1.5 max-w-[200px] truncate" title={pcPoSum[po].vend || ""}>{pcPoSum[po].vend || "-"}</td>
                        <td className="px-3 py-1.5 text-right">{pcPoSum[po].count}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(pcPoSum[po].sum)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{pcUomOf(po)}</td>
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
            </div>
          )}

          {pcSelMats.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap rounded-xl px-4 py-2.5" style={{ background: "#fbf7ec", border: `1px solid ${GOLD_SOFT}66` }}>
              <span className="text-xs font-bold" style={{ color: MAROON }}>✓ เลือกแล้ว {pcSelPos.size} PO · {pcSelMats.length} material</span>
              <span className="text-[11px] text-gray-500">กรอก “ข้อมูลจัดซื้อ” + น้ำหนัก ด้านล่าง แล้วกด Submit ได้เลย</span>
            </div>
          )}

          {/* Excel alternative */}
          <div className="border-t pt-3 flex items-center gap-2 flex-wrap" style={{ borderColor: `${GOLD_SOFT}44` }}>
            <button onClick={pcExport} disabled={pcBusy} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50">⬇ Export ({bu})</button>
            <label className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 cursor-pointer ${pcBusy ? "opacity-50" : ""}`}>⬆ Import
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={pcBusy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pcImport(f) }} />
            </label>
            {pcBusy && <span className="text-xs text-gray-400">กำลังประมวลผล…</span>}
          </div>

          {/* Imported POs (staged) → included automatically; weight in the purchase box → Submit */}
          {pcStaged.length > 0 && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-sky-800">📥 PO ที่ import ได้ ({pcStaged.length}) · material รวม {pcStaged.reduce((s, x) => s + x.mats.length, 0)} — รวมในคำขอให้อัตโนมัติ</p>
                <button onClick={() => setPcStaged([])} className="text-[11px] text-gray-400 hover:text-red-500">✕ ล้าง</button>
              </div>
              <div className="max-h-32 overflow-auto"><table className="w-full text-xs">
                <thead><tr className="text-gray-500"><th className="text-left px-2 py-1">Vendor</th><th className="text-left px-2 py-1">PO</th><th className="text-right px-2 py-1"># material</th></tr></thead>
                <tbody>{pcStaged.map((s, i) => <tr key={i} className="border-t border-sky-100"><td className="px-2 py-1">{s.vend || "-"}</td><td className="px-2 py-1 font-medium">{s.po}</td><td className="px-2 py-1 text-right">{s.mats.length}</td></tr>)}</tbody>
              </table></div>
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
        <h2 className="font-semibold text-gray-800">Items to pull {reqType === "PURCHASING" ? `(${new Set(cart.map(c => c.poNoDoc || "-")).size} PO · ${cart.length} material)` : `(${cart.length})`}</h2>
        <p className="text-xs text-gray-500 mt-1">Requester: <span className="font-medium text-gray-700">{requesterName || "-"}</span></p>
        {cart.length === 0 ? <p className="text-sm text-gray-400 mt-3">No items yet — {reqType === "PURCHASING" ? "เลือก vendor / PO ด้านบน" : "search an SO and pick materials."}</p> :
          reqType === "PURCHASING" ? (
            <p className="text-xs text-gray-400 mt-2">รายการมาจาก “สรุปตาม PO” ด้านบน · กรอกข้อมูลจัดซื้อ + น้ำหนัก แล้วกด Submit</p>
          ) : (
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

        {/* PC purchase info — filled here (no separate Purchase stage); stamped on every item at submit */}
        {reqType === "PURCHASING" && cart.length > 0 && (() => {
          const airPorts = [...(airByCountry[pcPur.country] || [])].sort()
          const seaPorts = [...(seaByCountry[pcPur.country] || [])].sort()
          const lab = "text-[11px] font-semibold text-gray-600 block mb-1"
          const box = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200 disabled:bg-gray-50 disabled:text-gray-400"
          const dimc = "w-16 border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-red-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          return (
            <div className="mt-4 rounded-2xl p-4 space-y-3 shadow-sm" style={{ background: "linear-gradient(180deg,#fffdf7,#ffffff)", border: `1.5px solid ${GOLD_SOFT}77` }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: MAROON }}><span className="h-4 w-1 rounded-full" style={{ background: GOLD }} />ข้อมูลจัดซื้อ <span className="font-normal text-[11px] text-gray-400">(ใช้ทั้งใบ)</span></h3>
                {pcEstAir
                  ? <span className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1">🔒 Est Air ≈ {fmt(pcEstAir.est)} USD{pcEstAir.add ? <span className="text-amber-600"> (+{pcEstAir.inc})</span> : null}</span>
                  : <span className="text-[11px] text-gray-400">กรอก Air Port + น้ำหนักรวม → คำนวณ Est Air อัตโนมัติ</span>}
              </div>
              {/* Weight (once per doc) — drives Est Air */}
              <div className="flex items-center gap-3 flex-wrap rounded-lg bg-white border border-red-200 px-3 py-2">
                <label className="text-sm font-bold" style={{ color: MAROON }}>น้ำหนักรวม (kg) <span className="text-red-500">*</span></label>
                <input value={pcWeight} onChange={e => setPcWeight(e.target.value)} type="number" placeholder="0" min={0}
                  className="w-40 border-2 border-red-300 rounded-xl px-4 py-2 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-300 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={{ color: MAROON }} />
                <span className="text-xs text-gray-500">รวมทั้งใบ ({new Set(cart.map(c => c.poNoDoc || "-")).size} PO) — ใช้คิด Est Air</span>
              </div>

              {/* Live LANDED-COST compare — old-style CARDS, ordered Air → Sea → DHL → Market (all USD) */}
              {pcCompare && (() => {
                const cols: any[] = [
                  { key: "air", label: "✈️ Air", d: pcCompare.air, accent: MAROON },
                  { key: "sea", label: `🚢 Sea (LCL${pcCompare.sea?.cbm ? ` · ${pcCompare.sea.cbm} cbm` : ""})`, d: pcCompare.sea, accent: "#0369a1" },
                  { key: "courier", label: "📦 Courier (DHL)", d: pcCompare.courier, accent: "#b45309", over: pcCompare.over },
                  { key: "market", label: "📈 Market (Air)", d: null, accent: "#7c3aed", market: true },
                ]
                const rows: [string, string][] = [["Freight", "freight"], ["FCA / EX-WORK", "fca"], ["Shipping clear", "clear"], ["Local charge TH", "local"], ["Store / DO", "store"], ["Transport", "transport"]]
                const totals = cols.map(c => c.d?.total).filter((v): v is number => v != null && v > 0)
                const cheapest = totals.length ? Math.min(...totals) : null
                const cell = (c: any, f: string) => { if (c.market) return <span className="text-gray-300">รอ</span>; const v = c.d ? c.d[f] : null; if (v == null) return <span className="text-gray-300">–</span>; return v > 0 ? fmt(v) : <span className="text-gray-300">–</span> }
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-600">เปรียบเทียบต้นทุนขนส่ง (Landed cost) <span className="font-normal text-gray-400">· USD</span></span>
                      <span className="text-[10px] text-gray-400">Rate {EXCHANGE_RATE} · TH charge เฉพาะ NYG</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {cols.map(c => {
                        const best = c.d?.total != null && c.d.total === cheapest
                        return (
                          <div key={c.key} className={`rounded-xl border p-3 ${best ? "ring-2 ring-emerald-300 border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"}`}>
                            <div className="text-xs font-semibold mb-1.5 flex items-center justify-between" style={{ color: c.accent }}>
                              <span>{c.label}</span>{best && <span className="text-[10px] text-emerald-600">ถูกสุด</span>}
                            </div>
                            <div className="space-y-0.5 text-[11px]">
                              {rows.map(([label, f]) => (
                                <div key={f} className="flex justify-between">
                                  <span className="text-gray-400">{label}</span>
                                  <span className="font-medium text-gray-700 tabular-nums">{cell(c, f)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                                <span className="text-gray-600 font-semibold">Total <span className="text-[9px] font-normal text-gray-400">USD</span></span>
                                <span className={`font-bold tabular-nums ${best ? "text-emerald-700" : "text-gray-900"}`}>{c.market ? <span className="text-gray-300 font-normal">รอ</span> : c.d?.total != null ? fmt(c.d.total) : (c.over ? <span className="text-gray-400 text-[10px] font-normal">&gt;100kg</span> : <span className="text-amber-600 text-[10px] font-normal">no master</span>)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1.5">* Transport = ค่ารถ→โรงงาน จาก Truck master (ตาม Factory + น้ำหนัก) · Market price กรอกทีหลัง</div>
                  </div>
                )
              })()}

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className={lab}>Country <span className="text-red-500">*</span></label>
                  <PcPick value={pcPur.country} list={countries} sel={box} placeholder="— country —"
                    onChange={v => { setPcPur(p => ({ ...p, country: v, port: "", seaPort: "" })); setPcCityId("") }} />
                </div>
                <div>
                  <label className={lab}>Air Port <span className="text-red-500">*</span></label>
                  <PcPick value={pcPur.port} list={airPorts} sel={box} disabled={!pcPur.country}
                    placeholder={pcPur.country ? (airPorts.length ? "— air port —" : "no air port") : "country ก่อน"}
                    onChange={v => {
                      // Picking an Air Port syncs the City (from Master Purchase) AND auto-fills the Sea Port
                      // paired with that city — so either dropdown (City or Air Port) fills both ports.
                      const c = pcCities.find((x: any) => String(x.port || "").toUpperCase() === String(v || "").toUpperCase())
                      setPcPur(p => ({ ...p, port: v, ...(c?.seaPort ? { seaPort: c.seaPort } : {}) }))
                      setPcCityId(c ? c.id : "")
                    }} />
                </div>
                <div>
                  <label className={lab}>Sea Port <span className="text-gray-300">(optional)</span></label>
                  <PcPick value={pcPur.seaPort} list={seaPorts} sel={box} disabled={!pcPur.country}
                    placeholder={pcPur.country ? (seaPorts.length ? "— sea port —" : "no sea port") : "country ก่อน"}
                    onChange={v => setPcPur(p => ({ ...p, seaPort: v }))} />
                </div>
                <div>
                  <label className={lab}>Incoterm <span className="text-red-500">*</span></label>
                  <select value={pcPur.incoterm} onChange={e => setPcPur(p => ({ ...p, incoterm: e.target.value }))} className={box}>
                    <option value="">—</option>
                    {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lab}>Factory <span className="text-red-500">*</span> <span className="text-gray-300">(โรงงานปลายทาง)</span></label>
                  <select value={pcFactory} onChange={e => setPcFactory(e.target.value)} className={box}>
                    {factoryOptions.length > 1 && <option value="">— เลือกโรงงาน —</option>}
                    {factoryOptions.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lab}>เมือง / City <span className="text-gray-300">{pcPur.country ? "(เฉพาะประเทศที่เลือก)" : "(auto เติม Country/Port)"}</span></label>
                  <select value={pcCityId} className={box}
                    onChange={e => {
                      const id = e.target.value; setPcCityId(id)
                      const c = pcCities.find((x: any) => x.id === id)
                      // Picking a city AUTO-FILLS Country + Air Port + Sea Port (all from Master Purchase),
                      // so Purchasing never picks the ports by hand. Sea Port falls back to "" if the city has none.
                      if (c) setPcPur(p => ({ ...p, country: c.country || p.country, port: c.port || p.port, seaPort: c.seaPort || "" }))
                    }}>
                    <option value="">— เลือกเมือง —</option>
                    {/* City is LINKED to Country: once a country is picked, only its cities show. */}
                    {pcCities
                      .filter((c: any) => !pcPur.country || String(c.country || "").trim().toUpperCase() === String(pcPur.country).trim().toUpperCase())
                      .map((c: any) => <option key={c.id} value={c.id}>{c.city}{c.port ? ` · ${c.port}` : ""}{c.country ? ` · ${c.country}` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lab}>Need date (in-house) <span className="text-red-500">*</span></label>
                  <input type="date" value={pcPur.needDate} onChange={e => setPcPur(p => ({ ...p, needDate: e.target.value }))} className={box} />
                </div>
                <div>
                  <label className={lab}>Shipment Date <span className="text-gray-300">(จากระบบ)</span></label>
                  <div className={`${box} bg-gray-50 text-gray-700`}>{fmtDate(earliest(cart.map((it: any) => it.shipmentDate)))}</div>
                </div>
                <div>
                  <label className={lab}>MRD <span className="text-gray-300">(จากระบบ · เร็วสุด)</span></label>
                  <div className={`${box} bg-gray-50 text-gray-700`}>{fmtDate(earliest(cart.flatMap((it: any) => [it.shipmentDate, it.mrdDate, it.mrdNeedDate, it.mrd2])))}</div>
                </div>
                <div>
                  <label className={lab}>ETC <span className="text-red-500">*</span></label>
                  <input type="date" value={pcPur.etc} onChange={e => setPcPur(p => ({ ...p, etc: e.target.value }))} className={box} />
                </div>
                <div className="sm:col-span-3">
                  <label className={lab}>Dimension ก×ย×ส (cm) <span className="text-gray-300">— ไม่บังคับ</span></label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" value={pcPur.boxW} onChange={e => setPcPur(p => ({ ...p, boxW: e.target.value }))} placeholder="ก" className={dimc} />
                    <span className="text-gray-300">×</span>
                    <input type="number" value={pcPur.boxL} onChange={e => setPcPur(p => ({ ...p, boxL: e.target.value }))} placeholder="ย" className={dimc} />
                    <span className="text-gray-300">×</span>
                    <input type="number" value={pcPur.boxH} onChange={e => setPcPur(p => ({ ...p, boxH: e.target.value }))} placeholder="ส" className={dimc} />
                  </div>
                </div>
              </div>

              {/* Packing list (per shipment): add lines of UOM + qty */}
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">Package (หีบห่อ) <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => setPcPkgs(p => [...p, { uom: "", qty: "" }])}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50">+ เพิ่ม</button>
                </div>
                <div className="space-y-2">
                  {pcPkgs.map((pk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={pcUoms.includes(pk.uom) ? pk.uom : (pk.uom ? "__OTHER__" : "")}
                        onChange={e => { const v = e.target.value; setPcPkgs(p => p.map((x, j) => j === i ? { ...x, uom: v } : x)) }}
                        className="w-40 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200">
                        <option value="">— UOM —</option>
                        {pcUoms.map(u => <option key={u} value={u}>{u}</option>)}
                        <option value="__OTHER__">➕ อื่นๆ (พิมพ์เอง)</option>
                      </select>
                      {pk.uom !== "" && !pcUoms.includes(pk.uom) && (
                        <input autoFocus value={pk.uom === "__OTHER__" ? "" : pk.uom}
                          onChange={e => setPcPkgs(p => p.map((x, j) => j === i ? { ...x, uom: e.target.value || "__OTHER__" } : x))}
                          placeholder="พิมพ์ UOM" className="w-24 border border-amber-300 bg-amber-50 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                      )}
                      <input type="number" min={0} value={pk.qty} onChange={e => setPcPkgs(p => p.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                        placeholder="จำนวน" className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <button type="button" onClick={() => setPcPkgs(p => p.length > 1 ? p.filter((_, j) => j !== i) : [{ uom: "", qty: "" }])}
                        className="text-gray-300 hover:text-red-500 px-1" title="ลบแถวนี้">✕</button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">เช่น 10 CTN · 2 PALLET — กด “+ เพิ่ม” เพื่อเพิ่มบรรทัด (UOM ดึงจาก BOM)</p>
              </div>

              {NEEDS_ADDRESS.includes(pcPur.incoterm) && (
                <div>
                  <label className={lab}>📍 {pcPur.incoterm} Pickup address <span className="text-red-500">*</span></label>
                  <textarea value={pcPur.pickup} onChange={e => setPcPur(p => ({ ...p, pickup: e.target.value }))} rows={2}
                    placeholder="ที่อยู่รับสินค้า / supplier address (บังคับสำหรับ EX-WORK / FCA)"
                    className="w-full border border-amber-300 bg-amber-50 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </div>
              )}
            </div>
          )
        })()}

        {/* INV per PO — upload a doc to auto-read (Excel now / PDF+OCR later), or type by hand */}
        {reqType === "PURCHASING" && (() => {
          const pos = [...new Set(cart.map((c: any) => c.poNoDoc).filter(Boolean))] as string[]
          if (!pos.length) return null
          return (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50/30 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm font-semibold text-green-800">📄 INV ต่อ PO <span className="text-gray-400 font-normal">(อัปไฟล์ให้ระบบอ่าน · หรือพิมพ์เอง)</span></label>
                <div className="flex items-center gap-2">
                  {Object.values(poInvMap).some(v => v) && !invReading && (
                    <button type="button" onClick={() => { setPoInvMap({}); setInvMsg("") }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-600 bg-white hover:bg-red-50">🧹 ล้าง INV ทั้งหมด</button>
                  )}
                  <label className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${invReading ? "opacity-50 pointer-events-none" : "border-green-400 text-green-700 bg-white hover:bg-green-50 cursor-pointer"}`}>
                    {invReading ? "กำลังอ่าน…" : "⬆ อัปไฟล์อ่าน INV (เลือกได้หลายไฟล์)"}
                    <input type="file" multiple accept=".xlsx,.xls,.csv,.pdf,image/*" className="hidden" onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ""; readInvFile(fs) }} />
                  </label>
                </div>
              </div>
              {invMsg && <p className="mt-1.5 text-[11px] text-gray-600">{invMsg}</p>}
              <div className="mt-3 grid gap-2">
                {pos.map(po => (
                  <div key={po} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white px-2 py-1 rounded shrink-0 min-w-[96px] text-center" style={{ background: MAROON }}>{po}</span>
                    <input value={poInvMap[po] || ""} onChange={e => setPoInvMap(m => ({ ...m, [po]: e.target.value }))} placeholder="เลข Invoice ของ PO นี้…"
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
                    {poInvMap[po] && (
                      <button type="button" onClick={() => setPoInvMap(m => ({ ...m, [po]: "" }))} title="ล้างช่องนี้"
                        className="shrink-0 text-gray-400 hover:text-red-500 text-sm px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Upload / read-INV result popup */}
        {invModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !invReading && setInvModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white">
                <div className="font-bold text-gray-800">{invReading ? "⏳ กำลังอ่านไฟล์…" : "📄 ผลการอ่าน INV"}</div>
                <button onClick={() => setInvModalOpen(false)} disabled={invReading} className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-40">✕</button>
              </div>
              <div className="p-4 space-y-2">
                {invResults.map((r, i) => {
                  const ic = r.status === "reading" ? "⏳" : r.status === "ok" ? "✅" : r.status === "warn" ? "⚠️" : r.status === "scan" ? "🖼️" : r.status === "error" ? "❌" : "⚠️"
                  const col = r.status === "ok" ? "text-emerald-700" : r.status === "reading" ? "text-gray-500" : r.status === "error" ? "text-red-600" : "text-amber-600"
                  return (
                    <div key={i} className="rounded-lg border border-gray-100 p-2.5">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-800"><span>{ic}</span><span className="truncate">{r.name}</span></div>
                      <div className={`text-xs mt-0.5 break-words ${col}`}>{r.detail}</div>
                    </div>
                  )
                })}
              </div>
              {!invReading && (
                <div className="px-5 py-3 border-t border-gray-100 text-right sticky bottom-0 bg-white">
                  <span className="text-xs text-gray-400 mr-3">📎 ไฟล์ถูกแนบกับเอกสารแล้ว · INV ที่ไม่เจอพิมพ์เองได้</span>
                  <button onClick={() => setInvModalOpen(false)} className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold" style={{ background: MAROON }}>ตกลง</button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className="text-xs font-semibold text-gray-600">Material Description (Remark) <span className="text-red-500">*</span></label>
          <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} placeholder="ระบุ Material Description ของงานนี้ (บังคับ)"
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        </div>

        {/* Attachments = PACKING LIST (staged now, uploaded when the request is created). */}
        <div className="mt-3">
          {/* Checklist — เอกสารที่จัดซื้อต้องแนบ */}
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px]">
            <span className="font-semibold text-amber-800">เอกสารที่ต้องแนบ:</span>
            <span className={`ml-2 ${Object.values(poInvMap).some(v => v && v.trim()) ? "text-emerald-700" : "text-gray-500"}`}>{Object.values(poInvMap).some(v => v && v.trim()) ? "✓" : "○"} INV (ด้านบน · ระบบอ่านให้)</span>
            <span className="mx-1.5 text-gray-300">·</span>
            <span className={files.length ? "text-emerald-700" : "text-gray-500"}>{files.length ? "✓" : "○"} Packing List (ด้านล่าง)</span>
            <span className="ml-2 text-gray-400">— AWB / ใบขน แนบทีหลังโดย LG ที่เมนู ATTACH FILES</span>
          </div>
          <label className="text-xs font-semibold text-gray-600">📦 Packing List (แนบไฟล์) <span className="text-gray-400 font-normal">(PDF / Excel / รูป — แนบได้หลายไฟล์)</span></label>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <label className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 cursor-pointer">📎 เลือกไฟล์ Packing List
              <input type="file" multiple className="hidden" onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) setFiles(p => [...p, ...fs]) }} />
            </label>
            {files.length === 0 && <span className="text-[11px] text-gray-400">ยังไม่ได้แนบ Packing List</span>}
          </div>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 rounded-full pl-2.5 pr-1 py-1">
                  📄 <span className="max-w-[200px] truncate" title={f.name}>{f.name}</span>
                  <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span>
                  <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600 px-1" title="ลบไฟล์">✕</button>
                </span>
              ))}
            </div>
          )}
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

        <div className="mt-3 flex items-center justify-end gap-3 flex-wrap">
          {isAdmin && (
            <label className="flex items-center gap-1.5 text-[11px] text-amber-700 cursor-pointer mr-auto">
              <input type="checkbox" checked={isTest} onChange={e => setIsTest(e.target.checked)} />
              🧪 Test (เมลเด้งกลับหาคุณ ไม่ส่ง LG/ผู้อนุมัติจริง)
            </label>
          )}
          <button onClick={submit} disabled={submitting}
            className="group inline-flex items-center gap-2 px-9 py-2.5 rounded-full text-white text-sm font-bold uppercase tracking-[0.2em] transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
            style={{ background: `linear-gradient(135deg, ${MAROON} 0%, #8a2b2b 100%)`, border: `1px solid ${GOLD_SOFT}`, boxShadow: `0 6px 18px ${MAROON}33, inset 0 1px 0 ${GOLD_SOFT}55` }}>
            <span style={{ color: GOLD_SOFT }}>✦</span>
            {submitting ? "กำลังส่ง…" : "Submit"}
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

// Dropdown from a master list + an "Other" choice (type a value not in the master → LG adds its rate).
const OTHER_VAL = "__OTHER__"
function PcPick({ value, list, onChange, disabled, placeholder, sel }:
  { value: string; list: string[]; onChange: (v: string) => void; disabled?: boolean; placeholder: string; sel: string }) {
  const inList = !!value && list.includes(value)
  const isOther = !!value && !inList
  return (
    <>
      <select value={inList ? value : (isOther ? OTHER_VAL : "")} disabled={disabled}
        onChange={e => onChange(e.target.value)} className={sel}>
        <option value="">{placeholder}</option>
        <option value={OTHER_VAL}>➕ Other (พิมพ์เอง → แจ้ง LG)</option>
        {list.length > 0 && <option value="" disabled>──────────</option>}
        {list.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      {isOther && (
        <input type="text" autoFocus value={value === OTHER_VAL ? "" : value}
          onChange={e => onChange(e.target.value || OTHER_VAL)} placeholder="พิมพ์ค่าที่ไม่มีในระบบ"
          className={`${sel} mt-1.5 border-amber-400 bg-amber-50 focus:ring-amber-200`} />
      )}
    </>
  )
}
