"use client"
import { useEffect, useRef, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import * as XLSX from "xlsx"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  ResponsiveContainer, Cell
} from "recharts"
import { MultiSelect } from "@/components/ui/multi-select"
import { getSplits, splitAirCost, deptLabel } from "@/lib/claim"
import { viewableBus, requestInBu, BU_META } from "@/lib/bu"
import { soCurrency, splitByCurrency, fmtSplit } from "@/lib/currency"

// Delay reasons come from the claim splits (REASON 1/2/3); fall back to the SO's reasonDelay.
function rowReasonEntries(r: any): { reason: string; cost: number; qty: number; dept: string }[] {
  const withReason = getSplits(r).filter((s: any) => s.reason && String(s.reason).trim())
  if (withReason.length === 0) return [{ reason: r.reasonDelay || "No Reason", cost: r.actualAirFreight || 0, qty: Number(r.qtyRequestAir) || 0, dept: deptLabel(r.claimDepartment || "") || "-" }]
  const qty = Number(r.qtyRequestAir) || 0
  return withReason.map((s: any) => ({ reason: String(s.reason).trim(), cost: splitAirCost(r, s), qty: Math.round(qty * (Number(s.pct) || 0) / 100), dept: deptLabel(s.dept) || "-" }))
}

// Group delay reasons that are the SAME but typed differently — case, spacing, punctuation,
// or small typos (e.g. "Release Bom delay" / "Release BOM delay" / "Releasey Bom delay").
// Normalise, then merge by Levenshtein similarity; the most-frequent original spelling
// becomes the group's display label.
const _normReason = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
const _lev = (a: string, b: string) => {
  const m = a.length, n = b.length
  if (!m) return n; if (!n) return m
  const dp = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) { let pr = dp[0]; dp[0] = i; for (let j = 1; j <= n; j++) { const t = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, pr + (a[i - 1] === b[j - 1] ? 0 : 1)); pr = t } }
  return dp[n]
}
const _simReason = (a: string, b: string) => 1 - _lev(a, b) / Math.max(a.length, b.length, 1)
function mergeReasonTally(raw: Record<string, { count: number; cost: number; qty: number; dept?: string }>) {
  const groups: { norm: string; label: string; count: number; cost: number; qty: number; dept: string }[] = []
  for (const [orig, v] of Object.entries(raw).sort((a, b) => b[1].count - a[1].count)) {
    const n = _normReason(orig)
    const g = groups.find(g => g.norm === n || _simReason(g.norm, n) >= 0.85)
    if (g) { g.count += v.count; g.cost += v.cost; g.qty += v.qty }
    else groups.push({ norm: n, label: orig, count: v.count, cost: v.cost, qty: v.qty, dept: v.dept || "-" })
  }
  return groups
}

// ─── Colors (red pastel) ───────────────────────────────────────────────────
const C_EST  = "#f9c2c2"
const C_ACT  = "#e07878"
const C_ORIG = "#f5b8c8"
const C_AIR  = "#f0907a"
const C_RSN  = ["#e07878","#f0907a","#f9c2c2","#d96060","#f5b8c8","#c8a0a0"]
const C_PIE  = ["#e07878","#f0907a","#f9c2c2","#d96060","#f5b8c8","#e8a090","#fad0d0","#c89090","#dab0b0"]
// Distinct color per claim department (labeled bars → color is redundant with the axis text).
const DEPT_COLOR: Record<string,string> = {
  COMMERCIAL:"#4e79a7", PRODUCTION:"#f28e2b", NYK:"#e15759", NYG:"#b07aa1",
  PROCUREMENT:"#59a14f", GW:"#76b7b2", SUPPLIER:"#edc948",
}
const deptColor = (name: any) => DEPT_COLOR[String(name||"").trim().toUpperCase()] || "#9aa0a6"

// ─── Formatters ────────────────────────────────────────────────────────────
const fmtK  = (v: any) => { const n = Number(v); if (n>=1e6) return `${(n/1e6).toFixed(1)}M`; if (n>=1e3) return `${(n/1e3).toFixed(0)}K`; return String(Math.round(n)) }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "0"
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtMonth = (ym: string) => { const [y,m] = ym.split("-"); const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${M[parseInt(m)-1]} ${y.slice(2)}` }
const fmtPct = (v: number, sign = true) => isFinite(v) ? `${sign && v>0 ? "+" : ""}${v.toFixed(1)}%` : "-"

// ─── Constants ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ["PENDING_VP_MER","PENDING_SCM","PENDING_VP_SCM","PENDING_PRESIDENT","PENDING_LOGISTICS","PENDING_CLAIM","PENDING_VP_CLAIM","COMPLETED","REJECTED"]
const STATUS_LABELS: Record<string,string> = {
  PENDING_VP_MER:"VP Merchandise", PENDING_SCM:"SCM", PENDING_VP_SCM:"VP SCM",
  PENDING_PRESIDENT:"President", PENDING_LOGISTICS:"Logistics",
  PENDING_CLAIM:"Claim", PENDING_VP_CLAIM:"VP Claim", COMPLETED:"Completed", REJECTED:"Rejected"
}
// Brand of an SO row — per-item brand (a doc can hold many brands), fallback to
// the document-level brand for older uploads.
const soBrand = (r: any) => r?.brand || r?.request?.brandName || r?.brandName || "N/A"
// Normalised brand key for matching — uppercase + collapse spaces so MER's inconsistent
// entries ("rhone", "RHONE ", "RHONE  X") group together. Filtering uses CONTAINS on this.
const brandKey = (r: any) => soBrand(r).trim().toUpperCase().replace(/\s+/g, " ")
// Group-key that also merges company-suffix variants of the SAME brand
// ("FANATICS" + "FANATICS, INC." → one), used where two spellings must sum together.
const brandGroupKey = (r: any) => soBrand(r).toUpperCase()
  .replace(/[.,]/g, " ")
  .replace(/\b(INC|LTD|LIMITED|CO|COMPANY|CORP|CORPORATION|LLC|PLC)\b/g, " ")
  .replace(/\s+/g, " ").trim()
// Normalised country key — same idea, so "United States" and "UNITED STATES" group as one.
const countryKey = (c: any) => String(c || "").trim().toUpperCase().replace(/\s+/g, " ")
const CLAIM_DEPTS = ["COMMERCIAL","PROCUREMENT","NYK","NYG","PRODUCTION"]
const MONTH_OPTS = [
  {value:"01",label:"Jan"},{value:"02",label:"Feb"},{value:"03",label:"Mar"},{value:"04",label:"Apr"},
  {value:"05",label:"May"},{value:"06",label:"Jun"},{value:"07",label:"Jul"},{value:"08",label:"Aug"},
  {value:"09",label:"Sep"},{value:"10",label:"Oct"},{value:"11",label:"Nov"},{value:"12",label:"Dec"},
]

// ─── Chart Components ──────────────────────────────────────────────────────
// Angled X-axis tick that truncates long category names (e.g. brands) with an ellipsis so
// they don't get clipped off the chart; the full name shows on hover (<title>).
const AngledTick = ({ x, y, payload }: any) => {
  const s = String(payload?.value ?? "")
  const t = s.length > 16 ? s.slice(0, 15) + "…" : s
  return (
    <text x={x} y={y} dy={2} textAnchor="end" transform={`rotate(-35, ${x}, ${y})`} fontSize={9} fill="#6b7280">
      <title>{s}</title>{t}
    </text>
  )
}

function CostBar({ data, height=200, onBarClick, drillLabel, onBack, cur="THB" }: {
  data:{name:string;est:number;actual:number}[]; height?:number
  onBarClick?:(n:string)=>void; drillLabel?:string; onBack?:()=>void; cur?:string
}) {
  const renderEstLabel = (props:any) => {
    const {x,y,width,value} = props
    if(!value) return null
    return <text x={x+width/2} y={y-4} textAnchor="middle" fill="#374151" fontSize={9} fontWeight="700">{fmtK(value)}</text>
  }
  const renderActualLabel = (props:any) => {
    const {x,y,width,value,index} = props
    if(!value) return null
    const est = data[index]?.est
    const valLabel = fmtK(value)
    if(!est) return <text x={x+width/2} y={y-4} textAnchor="middle" fill="#374151" fontSize={9} fontWeight="700">{valLabel}</text>
    const pct = (value-est)/est*100
    const arrow = pct>0?"↑":pct<0?"↓":"→"
    const pctColor = pct>0?"#ef4444":"#10b981"
    // value on top line, variance% on a second line → no horizontal overlap with the Est label.
    return <text x={x+width/2} y={y-4} textAnchor="middle" fill={pctColor} fontSize={9} fontWeight="700">
      <tspan x={x+width/2}>{valLabel}</tspan>
      <tspan x={x+width/2} dy={-9}>{arrow}{Math.abs(pct).toFixed(0)}%</tspan>
    </text>
  }
  return (
    <div className="bg-white rounded-xl border p-3">
      {(onBack||onBarClick||drillLabel)&&(
        <div className="flex items-center justify-between mb-1">
          {drillLabel?<span className="text-xs text-gray-500 font-medium">BY PORT — {drillLabel}</span>:<span/>}
          {onBack&&<button onClick={onBack} className="text-xs text-blue-500 hover:underline">← Back</button>}
          {onBarClick&&!onBack&&<span className="text-xs text-gray-400">Click → Port</span>}
        </div>
      )}
      {data.length===0?<div className="flex items-center justify-center text-xs text-gray-300" style={{height}}>No data</div>:<>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{top:20,right:8,left:0,bottom:52}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="name" tick={<AngledTick/>} interval={0} height={56}/>
            <YAxis tick={{fontSize:10}} tickFormatter={fmtK} width={48}/>
            <Tooltip formatter={(v:any,n:any)=>[fmtNum(v),n]}/>
            <Bar dataKey="est" name={`Est. (${cur})`} fill="#c05050" radius={[2,2,0,0]}
              cursor={onBarClick?"pointer":undefined} onClick={(d:any)=>onBarClick?.(d.name)}>
              <LabelList content={renderEstLabel}/>
            </Bar>
            <Bar dataKey="actual" name={`Actual (${cur})`} fill="#f5c0c0" radius={[2,2,0,0]}
              cursor={onBarClick?"pointer":undefined} onClick={(d:any)=>onBarClick?.(d.name)}>
              <LabelList content={renderActualLabel}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 pt-1 pb-0.5">
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#c05050"}}/><span className="text-xs text-gray-600">Est. ({cur})</span></div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#f5c0c0"}}/><span className="text-xs text-gray-600">Actual ({cur})</span></div>
        </div>
      </>}
    </div>
  )
}

function QtyBar({ data, height=200 }: { data:any[]; height?:number }) {
  // Only the ACTUAL air-shipped qty (plan/original removed per request → no overlap).
  const renderAirLabel = (props:any) => {
    const {x,y,width,value} = props
    if(!value) return null
    return <text x={x+width/2} y={y-4} textAnchor="middle" fill="#374151" fontSize={9} fontWeight="700">{fmtK(value)}</text>
  }
  return (
    <div className="bg-white rounded-xl border p-3">
      {data.length===0?<div className="flex items-center justify-center text-xs text-gray-300" style={{height}}>No data</div>:<>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{top:20,right:8,left:0,bottom:52}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="name" tick={<AngledTick/>} interval={0} height={56}/>
            <YAxis tick={{fontSize:10}} tickFormatter={fmtK} width={44}/>
            <Tooltip formatter={(v:any)=>[fmtNum(v)+" pcs","QTY Air"]}/>
            <Bar dataKey="air" name="QTY Air" fill="#e07878" radius={[2,2,0,0]}>
              <LabelList content={renderAirLabel}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 pt-1 pb-0.5">
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#e07878"}}/><span className="text-xs text-gray-600">QTY Air (pcs)</span></div>
        </div>
      </>}
    </div>
  )
}

function DelayBar({ data: topData, rows, groupFn, height=200 }: {
  data:{name:string;avgDays:number;count:number}[]
  rows:any[]; groupFn:(r:any)=>string; height?:number
}) {
  const [drillKeys, setDrillKeys] = useState<string[]>([])

  const chartData = useMemo(()=>{
    if(drillKeys.length===0) return topData
    const sub = rows.filter(r=>groupFn(r)===drillKeys[0])
    if(drillKeys.length===1){
      const m:Record<string,{total:number;count:number}>={}
      sub.forEach(r=>{
        if(!r.planShipmentDate||!r.originalShipmentDate) return
        const d=Math.round((new Date(r.planShipmentDate).getTime()-new Date(r.originalShipmentDate).getTime())/86400000)
        if(d<=0) return
        const k=r.style||"N/A"; if(!m[k])m[k]={total:0,count:0}
        m[k].total+=d; m[k].count++
      })
      return Object.entries(m).map(([name,v])=>({name,avgDays:Math.round(v.total/v.count),count:v.count}))
        .sort((a,b)=>b.avgDays-a.avgDays)
    }
    if(drillKeys.length===2){
      return sub.filter(r=>r.style===drillKeys[1])
        .filter(r=>r.planShipmentDate&&r.originalShipmentDate)
        .map(r=>({
          name:r.so||"N/A",
          avgDays:Math.max(0,Math.round((new Date(r.planShipmentDate).getTime()-new Date(r.originalShipmentDate).getTime())/86400000)),
          count:1
        }))
        .filter(r=>r.avgDays>0)
        .sort((a,b)=>b.avgDays-a.avgDays)
    }
    return topData
  },[drillKeys,rows,topData,groupFn])

  const barH = Math.max(height, chartData.length*32+80)
  const FILL = ['#e07878','#f0907a','#f9c2c2']
  const isTop = drillKeys.length===0
  const canDrill = drillKeys.length<2

  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="flex items-center justify-between mb-1 min-h-[20px]">
        {drillKeys.length>0
          ? <div className="flex items-center gap-1 text-xs flex-wrap">
              <button onClick={()=>setDrillKeys([])} className="text-blue-500 hover:underline">Top</button>
              {drillKeys.map((k,i)=>(
                <span key={i} className="flex items-center gap-1">
                  <span className="text-gray-400">›</span>
                  <button onClick={()=>setDrillKeys(drillKeys.slice(0,i+1))}
                    className={i===drillKeys.length-1?"font-semibold text-gray-700":"text-blue-500 hover:underline"}>
                    {k}
                  </button>
                </span>
              ))}
            </div>
          : <span className="text-[10px] text-gray-400">Click a bar to drill down</span>
        }
        {drillKeys.length>0&&<button onClick={()=>setDrillKeys(p=>p.slice(0,-1))} className="text-xs text-blue-500 hover:underline shrink-0">← Back</button>}
      </div>

      {chartData.length===0
        ?<div className="flex items-center justify-center text-xs text-gray-300" style={{height}}>No data</div>
        : isTop
          ?<>
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={chartData} margin={{top:20,right:8,left:0,bottom:52}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="name" tick={<AngledTick/>} interval={0} height={56}/>
                <YAxis tick={{fontSize:10}} width={40} unit="d"/>
                <Tooltip formatter={(v:any,_:any,p:any)=>[`${v}d avg (${p?.payload?.count} SO)`,'Avg Delay']}/>
                <Bar dataKey="avgDays" fill={FILL[0]} radius={[2,2,0,0]} cursor="pointer"
                  onClick={(d:any)=>setDrillKeys([d.name])}>
                  {chartData.map((_,i)=><Cell key={i} fill={gradRange(chartData.length,"#a04020","#e8a070")[i]}/>)}
                  <LabelList dataKey="avgDays" position="top" style={{fontSize:12,fill:'#374151',fontWeight:700}} formatter={(v:any)=>`${v}d`}/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 pt-1 pb-0.5">
              <div className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#a04020"}}/><span className="text-xs text-gray-600">Avg Delay Days</span></div>
            </div>
          </>
          :<ResponsiveContainer width="100%" height={barH}>
            <BarChart data={chartData} layout="vertical" margin={{top:4,right:56,left:4,bottom:8}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:12}} allowDecimals={false} unit="d"/>
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={110} interval={0}/>
              <Tooltip formatter={(v:any,_:any,p:any)=>[
                `${v}d${drillKeys.length===1?` avg (${p?.payload?.count} SO)`:''}`,
                drillKeys.length===1?'Avg Delay / Style':'Delay Days']}/>
              <Bar dataKey="avgDays" fill={FILL[drillKeys.length]} radius={[0,3,3,0]}
                cursor={canDrill?"pointer":undefined}
                onClick={canDrill?(d:any)=>setDrillKeys(p=>[...p,d.name]):undefined}>
                {chartData.map((_,i)=><Cell key={i} fill={gradRange(chartData.length,"#a04020","#e8a070")[i]}/>)}
                <LabelList dataKey="avgDays" position="right" style={{fontSize:11,fill:'#374151',fontWeight:600}} formatter={(v:any)=>`${v}d`}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
      }
    </div>
  )
}

const gradRange = (n: number, dark: string, light: string) => {
  const px = (h: string) => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)] as [number,number,number]
  const [dr,dg,db]=px(dark), [lr,lg,lb]=px(light)
  return Array.from({length: n}, (_,i) => {
    const t = n <= 1 ? 0 : i / (n - 1)
    return `rgb(${Math.round(dr+(lr-dr)*t)},${Math.round(dg+(lg-dg)*t)},${Math.round(db+(lb-db)*t)})`
  })
}

function ReasonPanel({ rows, height=200, cur="THB" }: { rows:any[]; height?:number; cur?:string }) {
  const [mode, setMode] = useState<'count'|'cost'|'qty'>('count')
  const [drillDept, setDrillDept] = useState<string|null>(null)   // cost/qty: which claim dept is drilled into
  // Actual Cost / Actual QTY: top level = by claim department; click a bar → its reasons.
  const deptData = useMemo(()=>{
    const m:Record<string,{cost:number;qty:number}>={}
    rows.forEach(r=>rowReasonEntries(r).forEach(e=>{ const k=e.dept||"-"; if(!m[k])m[k]={cost:0,qty:0}; m[k].cost+=e.cost; m[k].qty+=e.qty }))
    return Object.entries(m).map(([name,v])=>({name,cost:Math.round(v.cost),qty:Math.round(v.qty)})).sort((a,b)=>mode==='cost'?b.cost-a.cost:b.qty-a.qty)
  },[rows,mode])
  const drillReasonData = useMemo(()=>{
    if(!drillDept) return []
    const m:Record<string,{cost:number;qty:number;label:string}>={}
    rows.forEach(r=>rowReasonEntries(r).forEach(e=>{ if((e.dept||"-")!==drillDept) return; const rk=(e.reason||"No Reason").trim(); const lk=_normReason(rk)||rk.toLowerCase(); if(!m[lk])m[lk]={cost:0,qty:0,label:rk}; m[lk].cost+=e.cost; m[lk].qty+=e.qty }))
    return Object.values(m).map(v=>({name:v.label,cost:Math.round(v.cost),qty:Math.round(v.qty)})).sort((a,b)=>mode==='cost'?b.cost-a.cost:b.qty-a.qty)
  },[rows,mode,drillDept])
  // "Reason" mode: claim department first, then the reasons that make up each dept.
  const deptGroups = useMemo(()=>{
    const m:Record<string,{qty:number;reasons:Record<string,{qty:number;label:string}>}>={}
    rows.forEach(r=>rowReasonEntries(r).forEach(e=>{
      const d=e.dept||"-"; if(!m[d])m[d]={qty:0,reasons:{}}; m[d].qty+=e.qty
      // group reasons case-insensitively so "Garment Quality" and "Garment quality" merge (keep first label)
      const rk=(e.reason||"No Reason").trim(); const lk=_normReason(rk)||rk.toLowerCase()
      if(!m[d].reasons[lk]) m[d].reasons[lk]={qty:0,label:rk}
      m[d].reasons[lk].qty+=e.qty
    }))
    return Object.entries(m).map(([dept,v])=>({
      dept, qty:Math.round(v.qty),
      reasons:Object.values(v.reasons).map(x=>({reason:x.label,qty:Math.round(x.qty)})).sort((a,b)=>b.qty-a.qty),
    })).sort((a,b)=>b.qty-a.qty)
  },[rows])
  const data = useMemo(()=>{
    const m:Record<string,{count:number;cost:number;qty:number;dept:string}>={}
    rows.forEach(r=>{ rowReasonEntries(r).forEach(e=>{ const k=(e.reason||"No Reason").trim(); if(!m[k])m[k]={count:0,cost:0,qty:0,dept:e.dept}; m[k].count++; m[k].cost+=e.cost; m[k].qty+=e.qty }) })
    return mergeReasonTally(m).map(g=>({name:g.label,count:g.count,cost:Math.round(g.cost),qty:Math.round(g.qty),dept:g.dept}))
      // "Reason" mode now ranks by pieces (qty); cost mode by cost.
      .sort((a,b)=>mode==='cost'?b.cost-a.cost:b.qty-a.qty)
  },[rows,mode])
  const MODES:[string,string,string][] = [['count','Reason','#e07878'],['cost','Department Cost','#d96060'],['qty','Department QTY','#f0907a']]
  return (
    <div className="bg-white rounded-xl border p-3">
      <p className="text-[11px] font-extrabold mb-2 uppercase tracking-wide" style={{color:"#6b1a1a"}}>DELAY REASON</p>
      <div className="flex gap-1 mb-3">
        {MODES.map(([m,label,color])=>(
          <button key={m} onClick={()=>{setMode(m as any); setDrillDept(null)}}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${mode===m?'text-white border-transparent':'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            style={mode===m?{background:color}:{}}>
            {label}
          </button>
        ))}
      </div>
      {data.length===0?<div className="flex items-center justify-center text-xs text-gray-300" style={{height}}>No data</div>
      : mode==='count'
        ? (()=>{
            const totalQ = deptGroups.reduce((s,d)=>s+d.qty,0)
            return (
              <div className="pt-1">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
                  <span>share by claim department</span>
                  <span><b className="text-gray-600">{fmtNum(totalQ)}</b> pcs total</span>
                </div>
                {/* share bar — one segment per claim department */}
                <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
                  {deptGroups.map(d=>{ const p=totalQ>0?d.qty/totalQ*100:0; return (
                    <div key={d.dept} title={`${d.dept}: ${fmtNum(d.qty)} (${p.toFixed(0)}%)`}
                      className="h-full flex items-center justify-center text-white text-[11px] font-bold whitespace-nowrap overflow-hidden"
                      style={{flex:d.qty, minWidth:22, background:deptColor(d.dept)}}>
                      {p>=8 ? `${p.toFixed(0)}%` : ""}
                    </div>
                  )})}
                </div>
                {/* per-department breakdown into reasons */}
                <div className="flex flex-col gap-3.5 mt-4 max-h-[260px] overflow-y-auto pr-1">
                  {deptGroups.map(d=>{
                    const maxR = Math.max(1, ...d.reasons.map(r=>r.qty))
                    return (
                      <div key={d.dept}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{background:deptColor(d.dept)}}/>
                          <span className="text-[12px] font-extrabold uppercase tracking-wide" style={{color:deptColor(d.dept)}}>{d.dept}</span>
                          <span className="ml-auto flex items-baseline gap-2">
                            <span className="text-[13px] font-bold text-gray-800 tabular-nums">{fmtNum(d.qty)}</span>
                            <span className="text-[11px] text-gray-400 tabular-nums w-9 text-right">{totalQ>0?(d.qty/totalQ*100).toFixed(0):0}%</span>
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 pl-4 border-l-2 border-gray-100 ml-1">
                          {d.reasons.map(r=>(
                            <div key={r.reason}>
                              <div className="flex justify-between gap-2 text-[12px] mb-1">
                                <span className="text-gray-500 truncate" title={r.reason}>{r.reason}</span>
                                <span className="text-gray-400 shrink-0 tabular-nums"><b className="text-gray-700">{fmtNum(r.qty)}</b></span>
                              </div>
                              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full" style={{width:`${Math.max(3,r.qty/maxR*100)}%`, background:deptColor(d.dept), opacity:.85}}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()
        : (()=>{
            const chartData = drillDept ? drillReasonData : deptData
            const barH2 = Math.max(height, chartData.length*30+80)
            return (
              <div>
                <div className="flex items-center justify-between mb-1 text-[11px] min-h-[18px]">
                  {drillDept
                    ? <><span className="text-gray-500">Reasons — <b className="text-gray-700">{drillDept}</b></span><button onClick={()=>setDrillDept(null)} className="text-blue-500 hover:underline">← Back to departments</button></>
                    : <span className="text-gray-400">By claim department · click a bar to drill into reasons</span>}
                </div>
                <ResponsiveContainer width="100%" height={barH2}>
                  <BarChart data={chartData} layout="vertical" margin={{top:4,right:48,left:4,bottom:8}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:12}} tickFormatter={mode==='cost'?fmtK:undefined} allowDecimals={false}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={132} interval={0}/>
                    <Tooltip formatter={(v:any)=>mode==='cost'?[fmtNum(v)+' '+cur,'Department Cost']:[fmtNum(v)+' pcs','Department QTY']}/>
                    <Bar dataKey={mode==='cost'?'cost':'qty'} radius={[0,3,3,0]}
                      cursor={drillDept?undefined:'pointer'} onClick={(d:any)=>{ if(!drillDept && d?.name) setDrillDept(d.name) }}>
                      {chartData.map((d:any,i:number)=><Cell key={i} fill={drillDept?deptColor(drillDept):deptColor(d.name)}/>)}
                      <LabelList dataKey={mode==='cost'?'cost':'qty'} position="right" style={{fontSize:11,fill:'#374151',fontWeight:600}} formatter={(v:any)=>mode==='cost'?fmtK(v):fmtNum(v)}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })()
      }
    </div>
  )
}

function DelayDaysPanel({ rows, height=200 }: { rows:any[]; height?:number }) {
  const data = useMemo(()=>{
    const m:Record<string,{total:number;count:number}>={}
    rows.forEach(r=>{
      if(!r.planShipmentDate||!r.originalShipmentDate) return
      const plan=new Date(r.planShipmentDate), orig=new Date(r.originalShipmentDate)
      if(isNaN(plan.getTime())||isNaN(orig.getTime())) return
      const days=Math.round((plan.getTime()-orig.getTime())/86400000)
      if(days<=0) return
      const keys=[...new Set(rowReasonEntries(r).map(e=>e.reason||"No Reason"))]
      keys.forEach(k=>{ if(!m[k])m[k]={total:0,count:0}; m[k].total+=days; m[k].count++ })
    })
    return Object.entries(m).map(([name,v])=>({name,avgDays:Math.round(v.total/v.count),count:v.count}))
      .sort((a,b)=>b.avgDays-a.avgDays)
  },[rows])
  const barH=Math.max(height,data.length*30+80)
  return (
    <div className="bg-white rounded-xl border p-3">
      {data.length===0
        ?<div className="flex items-center justify-center text-xs text-gray-300" style={{height}}>No data</div>
        :<ResponsiveContainer width="100%" height={barH}>
          <BarChart data={data} layout="vertical" margin={{top:4,right:56,left:4,bottom:8}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
            <XAxis type="number" tick={{fontSize:12}} allowDecimals={false} unit="d"/>
            <YAxis type="category" dataKey="name" tick={{fontSize:12}} width={100} interval={0}/>
            <Tooltip formatter={(v:any,_:any,p:any)=>[`${v}d avg (${p?.payload?.count} SO)`,'Avg Delay']}/>
            <Bar dataKey="avgDays" fill="#e07878" radius={[0,3,3,0]}>
              <LabelList dataKey="avgDays" position="right" style={{fontSize:11,fill:'#374151',fontWeight:600}} formatter={(v:any)=>`${v}d`}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      }
    </div>
  )
}

// Paginate a long category chart: show `size` items at a time with ← / → arrows
// (click-through, not a scrollbar). `fromEnd` starts on the LAST window (e.g. the 5 most
// recent months) and keeps items in their original order within each window; ← steps to
// older items, → back toward the latest.
function Paged({ data, size=5, fromEnd=false, children }: { data:any[]; size?:number; fromEnd?:boolean; children:(slice:any[])=>any }) {
  const [page, setPage] = useState(0)   // 0 = default window (last one when fromEnd)
  const total = data?.length || 0
  const pages = Math.max(1, Math.ceil(total / size))
  const p = Math.min(page, pages - 1)
  const start = fromEnd ? Math.max(0, total - (p + 1) * size) : p * size
  const end = fromEnd ? total - p * size : Math.min(total, p * size + size)
  const slice = (data || []).slice(start, end)
  // In fromEnd mode ← goes older (higher page) and → goes newer (lower page); normal mode is the reverse.
  const onLeft = () => setPage(x => fromEnd ? Math.min(pages - 1, x + 1) : Math.max(0, x - 1))
  const onRight = () => setPage(x => fromEnd ? Math.max(0, x - 1) : Math.min(pages - 1, x + 1))
  const leftDisabled = fromEnd ? p >= pages - 1 : p === 0
  const rightDisabled = fromEnd ? p === 0 : p >= pages - 1
  return (
    <div>
      {children(slice)}
      {total > size && (
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <button onClick={onLeft} disabled={leftDisabled}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm">←</button>
          <span className="text-[11px] text-gray-400 tabular-nums">{start + 1}–{end} / {total}</span>
          <button onClick={onRight} disabled={rightDisabled}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm">→</button>
        </div>
      )}
    </div>
  )
}

function LogisticsCostBar({ rows }: { rows:any[] }) {
  const data = useMemo(()=>{
    const m:Record<string,{cost:number;qty:number;soCount:number;curs:Set<string>;disp:string}>={}
    rows.forEach(r=>{
      // Cost/Pcs must divide realized cost by the qty that actually shipped — so
      // both numerator and denominator count ONLY shipped rows (actualAirFreight set).
      // Projection rows (no actual yet) inflated the qty and understated Cost/Pcs.
      if(r.actualAirFreight==null) return
      // Merge company-suffix variants ("FANATICS" + "FANATICS, INC.") into one brand.
      const k=brandGroupKey(r); const raw=soBrand(r)
      if(!m[k])m[k]={cost:0,qty:0,soCount:0,curs:new Set<string>(),disp:raw}
      if(raw.length < m[k].disp.length) m[k].disp = raw   // show the cleanest (shortest) name
      m[k].cost+=r.actualAirFreight||0
      m[k].qty+=Number(r.qtyActualShip??r.qtyRequestAir)||0
      m[k].soCount++
      m[k].curs.add(soCurrency(r.request?.bu ?? r.bu, r.brand ?? r.request?.brandName)) // EA → USD, else THB
    })
    return Object.entries(m)
      .filter(([,v])=>v.qty>0)
      .map(([,v])=>({name:v.disp,costPerUnit:Math.round(v.cost/v.qty*100)/100,totalCost:Math.round(v.cost),totalQty:v.qty,soCount:v.soCount,cur:v.curs.size>1?"mixed":([...v.curs][0]||"THB")}))
      .sort((a,b)=>b.totalCost-a.totalCost)
  },[rows])

  const max = Math.max(1, ...data.map(d=>d.costPerUnit))   // true max (rows now sorted by TOTAL, not cost/pcs)

  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col">
      <p className="text-[11px] font-extrabold mb-1 uppercase tracking-wide" style={{color:"#6b1a1a"}}>LOGISTICS COST PER UNIT</p>
      <p className="text-[10px] text-gray-400 mb-2">Actual Air Freight ÷ QTY Air shipped</p>
      {data.length===0
        ?<div className="flex items-center justify-center text-xs text-gray-300 h-40">No data</div>
        :<div className="flex-1 overflow-y-auto max-h-[340px]">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-200">
                <th className="text-left py-1.5 px-2 text-gray-500 font-semibold text-[11px] w-1/2 bg-white">BRAND</th>
                <th className="text-right py-1.5 px-2 text-gray-500 font-semibold text-[11px] bg-white">QTY</th>
                <th className="text-right py-1.5 px-2 text-gray-500 font-semibold text-[11px] bg-white">TOTAL</th>
                <th className="text-right py-1.5 px-2 text-gray-500 font-semibold text-[11px] bg-white">COST/PCS</th>
                <th className="text-center py-1.5 px-2 text-gray-500 font-semibold text-[11px] bg-white">UOM</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d,i)=>{
                const pct = d.costPerUnit/max*100
                return (
                  <tr key={d.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full shrink-0" style={{width:`${Math.max(pct,4)}%`,maxWidth:'60px',background:gradRange(data.length,"#a04020","#e8a070")[i]}}/>
                        <span className="font-medium text-gray-800 truncate">{d.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-500">{fmtNum(d.totalQty)}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{fmtNum(d.totalCost)}</td>
                    <td className="py-2 px-2 text-right font-bold" style={{color:"#a04020"}}>{fmtNum(d.costPerUnit,2)}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${d.cur==="USD"?"bg-emerald-50 text-emerald-700":d.cur==="mixed"?"bg-amber-50 text-amber-700":"bg-gray-100 text-gray-600"}`}>{d.cur}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      }
    </div>
  )
}

function SectionRow({ label }: { label:string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-extrabold text-gray-700 uppercase tracking-widest shrink-0">{label}</span>
      <div className="flex-1 border-t-2 border-gray-300"/>
    </div>
  )
}

// Per-SO status by position (same scheme as AIR REQUESTS). LG ∥ Claim phase: no Actual air yet →
// PENDING_LG_BOOKING/CLAIM; Actual entered but claim not done → PENDING_CLAIM.
const STATUS_CLS: Record<string, string> = {
  "PENDING_MER": "bg-yellow-100 text-yellow-700", "PENDING_VP_MER": "bg-amber-100 text-amber-700",
  "PENDING_SCM": "bg-orange-100 text-orange-700", "PENDING_VP_SCM": "bg-orange-100 text-orange-800",
  "PENDING_LG_BOOKING/CLAIM": "bg-blue-100 text-blue-700", "PENDING_CLAIM": "bg-indigo-100 text-indigo-700",
  "PENDING_PRESIDENT": "bg-purple-100 text-purple-700", "COMPLETED": "bg-green-100 text-green-700",
  "REJECTED": "bg-red-100 text-red-700",
}
const soStage = (row: any): string => {
  const st = row?.itemStatus, ds = row?.request?.status || ""
  if (st === "REJECTED") return "REJECTED"
  if (st === "COMPLETED" || st === "ACCOUNTING_PENDING") return "COMPLETED"
  if (st === "PRESIDENT_PENDING") return "PENDING_PRESIDENT"
  const air = row?.actualAirFreight != null
  if (["VP_PASSED", "PRES_PASSED", "LOG_PASSED"].includes(st) || ["PENDING_CLAIM", "PENDING_VP_CLAIM", "PENDING_CLAIM_GW"].includes(ds))
    return air ? "PENDING_CLAIM" : "PENDING_LG_BOOKING/CLAIM"
  if (st === "CLAIM_PASSED") return air ? "PENDING_PRESIDENT" : "PENDING_LG_BOOKING/CLAIM"
  if (st === "PASSED") return "PENDING_VP_SCM"
  if (st === "VP_MER_PASSED" || st === "SCM_GW_PENDING") return "PENDING_SCM"
  if (st === "PENDING") {
    if (ds === "PENDING_PRESIDENT" || ds === "PENDING_PRESIDENT_GW") return "PENDING_PRESIDENT"
    if (ds === "PENDING_SCM") return "PENDING_SCM"
    if (ds === "PENDING_VP_SCM") return "PENDING_VP_SCM"
    if (["PENDING_VP_MER", "PENDING_VP_MER_EA", "PENDING_VP_MER_TRM", "PENDING_VP_MER_GW", "PENDING_DPM_GW", "PENDING_GM_GW"].includes(ds)) return "PENDING_VP_MER"
    return "PENDING_MER"
  }
  return "-"
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session } = useSession()
  // Which BU(s) this viewer may toggle between. ADMIN + jariya → all BUs (+ "All BU");
  // everyone else → only their own BU(s). Forward-compatible: add TRM/EA in @/lib/bu.
  const { bus: viewBus } = useMemo(() => viewableBus(session?.user), [session])
  // "All BU" is intentionally omitted here: the dashboard is mp_line-centric and mp_line holds NYG
  // data only, so an "All BU" view would mix BUs the map can't reconcile. Per-BU tabs only.
  const buTabs = useMemo(() =>
    viewBus.map(b => ({ v: b as string, label: BU_META[b].label, active: BU_META[b].active }))
  , [viewBus])

  const [activeBu, setActiveBu] = useState<string>("NYG")
  // EA amounts are stored in USD; every other BU is THB. Label-only — numbers are unchanged.
  const CUR = activeBu === "EA" ? "USD" : "THB"
  // Session loads after first render — default the active BU to the viewer's first allowed
  // BU (or "All BU" for admins) once we know who they are.
  const buInit = useRef(false)
  useEffect(() => {
    if (buInit.current || !session?.user) return
    setActiveBu(viewBus.includes("NYG") ? "NYG" : (viewBus[0] || "NYG"))
    buInit.current = true
  }, [session, viewBus])

  // Admin-only: mp_line reconcile summary (air req plan ↔ mp_line actual, NYG · SHIPPED · AIR PP).
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [mpCounts, setMpCounts] = useState<any>(null)
  const [mpSoSet, setMpSoSet] = useState<Set<string>>(new Set()) // SOs that shipped (in mp_line) — SO-level (page-wide map)
  const [mpQtyBySub, setMpQtyBySub] = useState<Record<string, number>>({}) // "SOkey|SUB" → actual shipped qty (mp_line or export)
  const [mpSrcBySub, setMpSrcBySub] = useState<Record<string, string>>({}) // "SOkey|SUB" → source: "mp_line" | "export"
  const [mpInv, setMpInv] = useState<Record<string, { qty: number; src: string }>>({}) // "SOkey|SUB|INV" → qty of that shipment round
  const [invBySrc, setInvBySrc] = useState<{ mp_line: Record<string, number>; export: Record<string, number> }>({ mp_line: {}, export: {} })
  const [invMeta, setInvMeta] = useState<Record<string, { style: string[]; desc: string[] }>>({}) // SO|SUB|INV → style/description from mp_line/export
  // default ON — dashboard opens in mp_line map mode (NYG/All BU); toggle 🔗 turns it off.
  // Persist the choice so it stays ON across reloads (stored per browser).
  const [mpMode, setMpMode] = useState(true)
  useEffect(() => {
    try { const v = localStorage.getItem("dash_mpMode"); if (v === "0") setMpMode(false) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem("dash_mpMode", mpMode ? "1" : "0") } catch {}
  }, [mpMode])
  const mpSoKey = (s: any) => String(s == null ? "" : s).replace(/\D/g, "").replace(/^0+/, "")
  // Display SO as 8 digits (pad leading zeros) so mp_line (7-digit) and air-req (8-digit) look consistent.
  const so8 = (s: any) => { const d = String(s ?? "").replace(/\D/g, ""); return d ? d.padStart(8, "0") : (s || "-") }
  // Match key onto mp_line = SO (digits, no leading zero) + "|" + SUB (upper/trim).
  const subKey = (row: any) => `${mpSoKey(row?.so)}|${String(row?.sub ?? "").trim().toUpperCase()}`
  // mp_line data is NYG-only → the map toggle works ONLY on the NYG tab (where the whole page is already
  // scoped to NYG, so the numbers match the mp_line card). All BU / GW / TRM / EA stay the normal view.
  const mpAllowed = activeBu === "NYG" || activeBu === "ALL"  // map mp_line = NYG data; shown on NYG + All BU (never GW/TRM/EA)
  const mpActive = mpMode && mpAllowed  // map mp_line mode — open to everyone (NYG/All BU tab)

  const [requests, setRequests]   = useState<any[]>([])
  const [loading,  setLoading]    = useState(true)
  const [yearFilter,  setYearFilter]  = useState("")
  const [monthFilter, setMonthFilter] = useState<string[]>([])
  const [statusFilter,setStatusFilter]= useState("")
  const [brandF, setBrandF] = useState<string[]>([])
  // mp_line card follows the Brand filter → refetch when it changes (open to everyone now).
  const brandFKey = brandF.join(",")
  // Card totals also follow the Actual filter (ALL / HAS / NONE) — refetch when it changes.
  const [actualF, setActualF] = useState<"" | "HAS" | "NONE">("")
  useEffect(() => {
    const p = new URLSearchParams()
    if (brandFKey) p.set("brand", brandFKey)
    if (actualF) p.set("actual", actualF)
    const qs = p.toString() ? `?${p.toString()}` : ""
    fetch(`/api/air-export-map${qs}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
      setMpCounts(d?.counts || null)
      setMpSoSet(new Set(((d?.tabA || []) as any[]).map(r => mpSoKey(r.so)).filter(Boolean)))
      // Actual shipped qty per SO+SUB (mp_line preferred, else sq_report export) + its source.
      const sa = (d?.subActual || {}) as Record<string, { qty: number; src: string }>
      const subQm: Record<string, number> = {}, subSrc: Record<string, string> = {}
      for (const [sk, v] of Object.entries(sa)) { subQm[sk] = Number(v?.qty) || 0; subSrc[sk] = v?.src || "" }
      setMpQtyBySub(subQm); setMpSrcBySub(subSrc)
      setMpInv((d?.invActual || {}) as Record<string, { qty: number; src: string }>)
      setInvBySrc({ mp_line: d?.invMp || {}, export: d?.invEx || {} })
      setInvMeta(d?.invMeta || {})
    }).catch(() => {})
  }, [brandFKey, actualF])
  // ยอด Sale Order ทั้งหมด (SO_ORDER · NYG · ทุก ship mode) — ตาม ปี/เดือน (ship_date) + Brand ที่เลือก
  const [soOrder, setSoOrder] = useState<{ pcs: number; soCount: number; subCount: number; unparsed: number } | null>(null)
  const monthFKey = monthFilter.join(",")
  useEffect(() => {
    if (activeBu !== "NYG") { setSoOrder(null); return }
    const p = new URLSearchParams()
    if (yearFilter) p.set("year", yearFilter)
    if (monthFKey) p.set("months", monthFKey)
    if (brandF.length) p.set("brands", brandF.join("|"))
    fetch(`/api/so-order-summary?${p.toString()}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null).then(d => setSoOrder(d && !d.error ? d : null)).catch(() => setSoOrder(null))
  }, [activeBu, yearFilter, monthFKey, brandFKey])  // eslint-disable-line react-hooks/exhaustive-deps
  const [docF,  setDocF]  = useState<string[]>([])
  const [soF,  setSoF]  = useState<string[]>([])
  const [cpF,  setCpF]  = useState<string[]>([])
  const [portFilter,    setPortFilter]    = useState("")
  const [countryFilter, setCountryFilter] = useState("")
  const [claimF, setClaimF] = useState<string[]>([])
  const [hawbF, setHawbF] = useState<string[]>([])
  // "" = every SO · HAS = actual air filled (shipped & costed) · NONE = still waiting for the actual
  // (actualF is declared above, next to the mp_line card fetch it drives)
  const [drillCountry, setDrillCountry]   = useState<string|null>(null)

  const [poMap, setPoMap] = useState<Record<string,string>>({})

  useEffect(() => {
    fetch("/api/requests").then(r=>r.json()).then(d=>{ setRequests(d); setLoading(false) })
  }, [])

  // SO → PO (po_no_doc) from the Bill of Material, for the dashboard PO column.
  useEffect(() => {
    const sos = Array.from(new Set(requests.flatMap((r:any)=>(r.items||[]).map((i:any)=>i.so).filter(Boolean))))
    if (sos.length===0) return
    fetch("/api/bom/po-map",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sos})})
      .then(r=>r.json()).then(d=>setPoMap(d.map||{})).catch(()=>{})
  }, [requests])

  // TEST documents never count in dashboard reporting.
  const buRequests = useMemo(()=>requests.filter(r=> requestInBu(r, activeBu) && !r.isTest), [requests, activeBu])
  const allSOs = useMemo(()=>buRequests.flatMap(r=>(r.items||[]).map((item:any)=>({...item,request:r}))), [buRequests])

  // Shared filter predicate (every filter EXCEPT the mp_line scope). Works on both air-req rows and
  // the synthetic mp_line rows below (they carry the same field names). actualF is skipped for mp_line
  // rows (they have no per-line air freight).
  const passFilters = (row:any)=>{
    const d = row.planShipmentDate ? new Date(row.planShipmentDate) : null
    const yr = d&&!isNaN(d.getTime()) ? String(d.getFullYear()) : ""
    const mo = d&&!isNaN(d.getTime()) ? String(d.getMonth()+1).padStart(2,"0") : ""
    return (!yearFilter  || yr===yearFilter) &&
           (!monthFilter.length || monthFilter.includes(mo)) &&
           (!statusFilter || (
             statusFilter==="PENDING"   ? (row.itemStatus !== "COMPLETED" && row.itemStatus !== "ACCOUNTING_PENDING" && row.itemStatus !== "REJECTED") :
             statusFilter==="COMPLETED" ? (row.itemStatus === "COMPLETED" || row.itemStatus === "ACCOUNTING_PENDING") :
             statusFilter==="REJECTED"  ? row.itemStatus === "REJECTED" : true
           )) &&
           (!brandF.length|| brandF.includes(brandKey(row))) &&
           (!docF.length  || docF.includes(row.request?.documentNo)) &&
           (!soF.length   || soF.includes(row.so)) &&
           (!cpF.length   || cpF.includes(row.customerPO)) &&
           (!portFilter   || row.port===portFilter) &&
           (!countryFilter|| countryKey(row.country)===countryFilter) &&
           (!claimF.length|| claimF.includes(row.claimDepartment)) &&
           (!hawbF.length || hawbF.includes(row.hawbNo)) &&
           (!actualF || (actualF === "HAS" ? row.actualAirFreight != null : row.actualAirFreight == null))
  }
  const filterDeps = [yearFilter,monthFilter,statusFilter,actualF,brandF,docF,soF,cpF,portFilter,countryFilter,claimF,hawbF]
  // Base = air-req rows after all filters (mp_line scope layered on afterwards).
  const baseFiltered = useMemo(()=>allSOs.filter(passFilters), [allSOs, ...filterDeps])
  // Whole page (KPI · charts): follows the page-wide 🔗 map toggle.
  const filtered = useMemo(()=> mpActive ? baseFiltered.filter(row=>mpSoSet.has(mpSoKey(row.so))) : baseFiltered, [baseFiltered, mpActive, mpSoSet])
  // Data table view — "SHIPPED" = ส่งออกจริง (mp_line lines) · "UNSHIPPED" = ยังไม่มีการส่ง (air-req not in mp_line).
  const [tableView, setTableView] = useState<"SHIPPED"|"UNSHIPPED">("SHIPPED")
  const tableShipped = tableView==="SHIPPED"
  // "ส่งออกแล้ว" = air-req row ที่มี HAWB (LG เติมแล้ว = ship จริง).
  // มี HAWB จริง = ไม่ว่าง และไม่ใช่ placeholder ("-", "N/A", ".", "0")
  const hasHawb = (r:any) => { const h = String(r?.hawbNo ?? "").trim(); return h !== "" && !/^[-.–—\s]*$/.test(h) && !["n/a","na","0","null"].includes(h.toLowerCase()) }
  const invU = (r:any) => String(r?.invoiceNo ?? "").trim().toUpperCase()
  const styleU = (r:any) => String(r?.style ?? "").trim().toUpperCase()
  const docOf = (r:any) => String(r?.request?.documentNo || r?.requestId || "")
  // ส่งออกจริง = air-req rows ที่มี HAWB. Rows of ONE document are all kept (a doc can legitimately carry
  // many lines of the same SO+SUB+INV — e.g. several styles / 216+9 splits). Only a line repeated in
  // ANOTHER document (same SO+SUB+STYLE+INV = อัปซ้ำ) collapses: keep the doc that went furthest
  // (has actual > not rejected > latest doc no). ส่งหลายรอบ (คนละ INV) = คนละ key → คนละแถว.
  const shippedLines = useMemo(()=>{
    const score = (r:any) => (r.actualAirFreight!=null?1000:0) + (r.itemStatus==="REJECTED"?-1000:0)
    const rows = baseFiltered.filter(hasHawb)
    const lineKey = (r:any) => `${subKey(r)}|${styleU(r)}|${invU(r)}`
    const bestDoc = new Map<string, { doc: string; sc: number }>()
    for (const r of rows) {
      const k = lineKey(r), d = docOf(r), sc = score(r), cur = bestDoc.get(k)
      if (!cur || sc > cur.sc || (sc === cur.sc && d > cur.doc)) bestDoc.set(k, { doc: d, sc })
    }
    // A line that already carries an ACTUAL is never dropped — LG really split HAWB money onto it, so
    // dropping it would make ACT ≠ the HAWB total (e.g. 2609_0002 + 0003 both keyed INV …085). Only
    // repeat lines with no actual are treated as duplicate uploads. QTY stays single: lines of one
    // SO+SUB+INV are merged into one row whose QTY = that INV's source qty.
    return rows.filter(r => bestDoc.get(lineKey(r))?.doc === docOf(r) || (Number(r.actualAirFreight) || 0) > 0)
  }, [baseFiltered])
  // ── ส่งออกจริง table/cards = ONE row per shipment round (SO+SUB+INV) ─────────────────────────────
  // The lines of a round (several styles / splits) are MERGED: styles & descriptions joined, QTY ORIG /
  // EST / ACT summed. QTY AIR = that INV's qty from export/mp_line (source with the larger SO+SUB total).
  // A source INV of a shown SO+SUB that NO air-req line carries (LG keyed the wrong INV) is added as its
  // own row "ยังไม่ผูก air req" (EST/ACT 0) → the QTY AIR total equals the export/mp_line total.
  const shipAgg = useMemo(()=>{
    const join = (xs: any[]) => [...new Set(xs.map(x => String(x ?? "").trim()).filter(Boolean))].join(", ")
    const groups = new Map<string, any[]>()
    for (const r of shippedLines) { const k = `${subKey(r)}|${invU(r)}`; const g = groups.get(k) || []; g.push(r); groups.set(k, g) }
    const out: any[] = [], qty = new Map<string, number>(), src = new Map<string, string>()
    const invMismatch = new Set<string>()
    const subsShown = new Map<string, any>()   // SO+SUB → a base line (for synthetic rows)
    for (const [k, rows] of groups) {
      const b = rows[0], sk = subKey(b)
      if (!subsShown.has(sk)) subsShown.set(sk, b)
      const origByStyle = new Map<string, number>()
      for (const r of rows) origByStyle.set(styleU(r), Math.max(origByStyle.get(styleU(r)) || 0, Number(r.qtyOriginalShipment) || 0))
      const acts = rows.map(r => r.actualAirFreight).filter((v: any) => v != null)
      out.push({
        ...b, id: `ship:${k}`, _lines: rows.length,
        style: join(rows.map(r => r.style)), description: join(rows.map(r => r.description)),
        request: { ...b.request, documentNo: join(rows.map(r => r.request?.documentNo)) },
        qtyOriginalShipment: [...origByStyle.values()].reduce((a, c) => a + c, 0),
        qtyRequestAir: rows.reduce((a, r) => a + (Number(r.qtyRequestAir) || 0), 0),
        qtyActualShip: rows.reduce((a, r) => a + (Number(r.qtyActualShip) || 0), 0),
        airFreight: rows.reduce((a, r) => a + (Number(r.airFreight) || 0), 0),
        actualAirFreight: acts.length ? acts.reduce((a: number, v: any) => a + (Number(v) || 0), 0) : null,
      })
    }
    // QTY per round + synthetic rows for source INVs nobody booked
    const bySub = new Map<string, any[]>()
    for (const r of out) { const sk = subKey(r); const g = bySub.get(sk) || []; g.push(r); bySub.set(sk, g) }
    for (const [sk, rows] of bySub) {
      if (mpQtyBySub[sk] == null) { rows.forEach(r => { qty.set(r.id, 0); src.set(r.id, "ไม่พบ") }); continue }
      const s = (mpSrcBySub[sk] || "mp_line") as "mp_line" | "export"
      const invMap = invBySrc[s] || {}
      const srcInvs = Object.keys(invMap).filter(k => k.startsWith(`${sk}|`))
      const rowInvs = new Set(rows.map(r => `${sk}|${invU(r)}`))
      if (!srcInvs.length) {
        // source has this SO+SUB but no INV split → only safe when one round is shown
        rows.forEach((r, i) => { qty.set(r.id, rows.length === 1 && i === 0 ? Number(mpQtyBySub[sk]) || 0 : 0); src.set(r.id, rows.length === 1 ? s : "ไม่พบ") })
        continue
      }
      for (const r of rows) {
        const hit = invMap[`${sk}|${invU(r)}`]
        qty.set(r.id, hit != null ? Number(hit) || 0 : 0); src.set(r.id, hit != null ? s : "ไม่พบ")
        if (hit == null) invMismatch.add(sk)
      }
      const base = subsShown.get(sk)
      for (const ik of srcInvs) {
        if (rowInvs.has(ik)) continue
        invMismatch.add(sk)
        const inv = ik.split("|")[2] || ""
        const meta = invMeta[ik]
        const syn = { ...base, id: `ship:${ik}`, _synthetic: true, _lines: 0, invoiceNo: inv, hawbNo: "",
          style: (meta?.style || []).join(", "), description: (meta?.desc || []).join(", ") || base.description || "",
          request: { ...base.request, documentNo: "-" }, qtyOriginalShipment: 0, qtyRequestAir: 0, qtyActualShip: 0, airFreight: 0, actualAirFreight: null }
        out.push(syn); qty.set(syn.id, Number(invMap[ik]) || 0); src.set(syn.id, s)
      }
    }
    return { rows: out, qty, src, invMismatch }
  }, [shippedLines, mpQtyBySub, mpSrcBySub, invBySrc, invMeta])
  const shippedRows = shipAgg.rows
  // rounds booked per SO+SUB vs real shipment rounds (distinct INV in mp_line/export) — used by the
  // "ยังไม่มีการส่ง" dedupe below
  const shipCntBySub = useMemo(()=>{ const m = new Map<string, number>(); for (const r of shippedRows) if (!r._synthetic) m.set(subKey(r), (m.get(subKey(r))||0)+1); return m }, [shippedRows])
  const invRoundsBySub = useMemo(()=>{ const m = new Map<string, number>(); for (const ik of Object.keys(mpInv)) { const sk = ik.split("|").slice(0,2).join("|"); m.set(sk, (m.get(sk)||0)+1) } return m }, [mpInv])
  const isInvMismatch = (r:any) => shipAgg.invMismatch.has(subKey(r))
  const shipQtyOf = useMemo(()=> (r:any): number => shipAgg.qty.get(r.id) ?? 0, [shipAgg])
  const shipSrcOf = useMemo(()=> (r:any): string => shipAgg.src.get(r.id) ?? "", [shipAgg])
  const shipUnmatched = useMemo(()=> [...shipAgg.src.values()].filter(s => s === "ไม่พบ").length, [shipAgg])
  const shipAlloc = shipAgg
  // ยังไม่มีการส่ง = air-req rows ที่ยังไม่มี HAWB — ตัดแผนที่ซ้ำ "ข้ามเอกสาร" เท่านั้น (ในเอกสารเดียวกันเก็บทุกแถว):
  //   (ก) SO+SUB+STYLE+qty เดียวกันอยู่อีก doc → นับ 1
  //   (ข) บรรทัดเดียวกันนี้ส่งไปแล้วในอีก doc และรอบส่งจริงถูกบันทึกครบแล้ว (แถวส่งจริง ≥ จำนวน INV) → ของซ้ำ
  const unshippedRows = useMemo(()=>{
    const lk = (r:any) => `${subKey(r)}|${styleU(r)}|${Number(r.qtyRequestAir)||0}`
    const shippedDocs = new Map<string, Set<string>>()
    for (const s of shippedLines) { const k = lk(s); const st = shippedDocs.get(k) || new Set<string>(); st.add(docOf(s)); shippedDocs.set(k, st) }
    const firstDoc = new Map<string, string>(), out: any[] = []
    for (const r of baseFiltered) {
      if (hasHawb(r)) continue
      const k = lk(r), d = docOf(r), sk = subKey(r)
      const fd = firstDoc.get(k)
      if (fd && fd !== d) continue
      const sd = shippedDocs.get(k)
      if (sd && ![...sd].every(x => x === d) && (shipCntBySub.get(sk)||0) >= Math.max(invRoundsBySub.get(sk)||0, 1)) continue
      if (!fd) firstDoc.set(k, d)
      out.push(r)
    }
    return out
  }, [baseFiltered, shippedLines, shipCntBySub, invRoundsBySub])
  const qtyAirDisp = (r:any) => tableShipped ? shipQtyOf(r) : r.qtyRequestAir
  // Column definitions — shared by the header, the per-column filter row, and the data cells so they
  // always line up. `get` returns the value used both for the filter's substring match and export.
  const COLS = useMemo<{label:string; get:(r:any)=>any}[]>(()=>[
    {label:"DOC NO",         get:r=>r.request?.documentNo||""},
    {label:"SO",             get:r=>so8(r.so)},
    {label:"PO",             get:r=>poMap[r.so]||""},
    {label:"STYLE",          get:r=>r.style||""},
    {label:"SUB",            get:r=>r.sub||""},
    {label:"DESCRIPTION",    get:r=>r.description||""},
    {label:"CUSTOMER PO",    get:r=>r.customerPO||""},
    {label:"BRAND",          get:r=>soBrand(r)},
    {label:"BU",             get:r=>r.request?.buName||""},
    {label:"STATUS",         get:r=>soStage(r)},
    {label:"ORIG. DATE",     get:r=>fmtDate(r.originalShipmentDate)},
    {label:"PLAN DATE",      get:r=>fmtDate(r.planShipmentDate)},
    {label:"QTY ORIG",       get:r=>r.qtyOriginalShipment},
    {label:"QTY AIR",        get:r=>qtyAirDisp(r)},
    {label:`EST. (${CUR})`,  get:r=>r.airFreight},
    {label:`ACTUAL (${CUR})`,get:r=>r.actualAirFreight},
    {label:"INV NO",         get:r=>r.invoiceNo||""},
    {label:"HAWB NO",        get:r=>r.hawbNo||""},
    {label:"VAR%",           get:r=>{const vp=r.airFreight>0&&r.actualAirFreight>0?(r.actualAirFreight-r.airFreight)/r.airFreight*100:null; return vp==null?"":vp.toFixed(1)}},
    {label:"FACTORY",        get:r=>r.factory||""},
    {label:"COUNTRY",        get:r=>r.country||""},
    {label:"CLAIM DEPT",     get:r=>{const sp=getSplits(r); return sp.length?sp.map((s:any)=>deptLabel(s.dept)).join(" "):(r.claimDepartment||"")}},
    {label:"CLAIM %",        get:r=>{const sp=getSplits(r); return sp.length?sp.map((s:any)=>s.pct!=null?`${s.pct}%`:"").join(" "):""}},
    {label:"REASON",         get:r=>[...new Set(getSplits(r).map((s:any)=>s.reason).filter(Boolean))].join(" ")},
    {label:"อยู่ที่ใคร",       get:r=>Array.isArray(r.request?.pendingWith)?r.request.pendingWith.join(" "):""},
    // SOURCE (admin only) — where the actual QTY came from: mp_line (ตั้งแต่ ก.ย.) หรือ export/sq_report (ก่อนหน้า)
    ...(isAdmin ? [{label:"SOURCE", get:(r:any)=> tableShipped ? shipSrcOf(r) : ""}] : []),
  ], [poMap, tableShipped, shipQtyOf, shipSrcOf, isAdmin, CUR])
  // Rows for the table before per-column filters. ส่งออกจริง = shipped air-req; ยังไม่มีการส่ง = unshipped air-req.
  const tableViewRows = useMemo(()=> tableShipped ? shippedRows : unshippedRows, [tableShipped, shippedRows, unshippedRows])
  // Excel-style per-column filters: colF[idx] = the SET of allowed values for that column (checked in
  // its dropdown). Empty/absent = no filter on that column.
  const [colF, setColF] = useState<Record<number,string[]>>({})
  const [colMenu, setColMenu] = useState<{idx:number; x:number; y:number}|null>(null)
  const [colSearch, setColSearch] = useState("")
  const colOptions = (idx:number) => [...new Set(tableViewRows.map(r=>String(COLS[idx]?.get(r) ?? "")))].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true}))
  const toggleColVal = (idx:number, opt:string) => setColF(f=>{
    const cur = new Set(f[idx]||[]); cur.has(opt)?cur.delete(opt):cur.add(opt)
    const arr=[...cur]; const n={...f}; if(arr.length) n[idx]=arr; else delete n[idx]; return n
  })
  const clearColVal = (idx:number) => setColF(f=>{ const n={...f}; delete n[idx]; return n })
  const tableRows = useMemo(()=>{
    const active = Object.entries(colF).filter(([,v])=>Array.isArray(v)&&v.length>0)
    if (!active.length) return tableViewRows
    return tableViewRows.filter(row => active.every(([idx,vals])=> (vals as string[]).includes(String(COLS[Number(idx)]?.get(row) ?? ""))))
  }, [tableViewRows, colF, COLS])

  // ─── KPI ────────────────────────────────────────────────────────────────
  const totalSO    = filtered.length
  // once per SO+SUB+STYLE (max) — the same order qty repeats on every row/round of that line
  const totalQOrig = (()=>{ const m = new Map<string, number>(); for (const r of filtered) { const k = `${subKey(r)}|${String(r.style??"").trim().toUpperCase()}`; m.set(k, Math.max(m.get(k)||0, Number(r.qtyOriginalShipment)||0)) } let t = 0; m.forEach(v => { t += v }); return t })()
  const totalQAir  = filtered.reduce((s,r)=>s+(Number(r.qtyRequestAir)||0),0)
  const totalEst   = filtered.reduce((s,r)=>s+(r.airFreight||0),0)
  const totalAct   = filtered.reduce((s,r)=>s+(r.actualAirFreight||0),0)
  // ─── Data-table footer totals (based on the table's OWN view: SHIPPED vs ALL) ───
  const tblSO    = tableRows.length
  // QTY ORIG = the line's order qty (SO+SUB+STYLE), repeated on every shipment round/split → count ONCE (max)
  const tblQOrig = (()=>{ const m = new Map<string, number>(); for (const r of tableRows) { const k = `${subKey(r)}|${styleU(r)}`; m.set(k, Math.max(m.get(k)||0, Number(r.qtyOriginalShipment)||0)) } let t = 0; m.forEach(v => { t += v }); return t })()
  const tblEst   = tableRows.reduce((s,r)=>s+(r.airFreight||0),0)
  const tblAct   = tableRows.reduce((s,r)=>s+(r.actualAirFreight||0),0)
  // QTY AIR total: "ส่งออกจริง" sums each row's own shipment round (SO+SUB+INV);
  // "ยังไม่มีการส่ง" sums the planned qty.
  const tblQAir = tableShipped
    ? tableRows.reduce((s,r)=> s + shipQtyOf(r), 0)
    : tableRows.reduce((s,r)=> s + (Number(r.qtyRequestAir) || 0), 0)
  // Currency is per-SO (EA / GW-RHONE → USD, else THB); a doc can mix. Totals are split so THB and
  // USD are never summed. Charts label their axis with the single currency present, or "mixed".
  const rowCur = (r:any) => soCurrency(r.request?.bu ?? r.bu, r.brand ?? r.request?.brandName)
  const splitOf = (pick:(r:any)=>number) => splitByCurrency(filtered.map(r=>({amount:pick(r)||0, bu:r.request?.bu, brand:r.brand??r.request?.brandName})))
  const estSplit   = splitOf(r=>r.airFreight)
  const actSplit   = splitOf(r=>r.actualAirFreight)
  const cursPresent= new Set(filtered.map(rowCur))
  const curLabel   = cursPresent.size > 1 ? "mixed" : ((cursPresent.values().next().value as string) || CUR)
  const airRatePct = totalQOrig>0 ? totalQAir/totalQOrig*100 : 0
  const varPct     = totalEst>0 && totalAct>0 ? (totalAct-totalEst)/totalEst*100 : null
  const compDone   = filtered.filter(r=>r.itemStatus==="COMPLETED"||r.itemStatus==="ACCOUNTING_PENDING").length
  const compPct    = totalSO>0 ? compDone/totalSO*100 : 0

  // ─── Builders ───────────────────────────────────────────────────────────
  const buildCost = (rows:any[], fn:(r:any)=>string) => {
    const m:Record<string,{est:number;actual:number}> = {}
    rows.forEach(r=>{ const k=fn(r)||"N/A"; if(!m[k])m[k]={est:0,actual:0}; m[k].est+=r.airFreight||0; m[k].actual+=r.actualAirFreight||0 })
    return Object.entries(m).map(([name,v])=>({name,est:Math.round(v.est),actual:Math.round(v.actual)})).sort((a,b)=>b.est-a.est)
  }
  const buildQty = (rows:any[], fn:(r:any)=>string) => {
    const m:Record<string,{orig:number;air:number}> = {}
    rows.forEach(r=>{ const k=fn(r)||"N/A"; if(!m[k])m[k]={orig:0,air:0}; m[k].orig+=Number(r.qtyOriginalShipment)||0; m[k].air+=Number(r.qtyRequestAir)||0 })
    return Object.entries(m).map(([name,v])=>({name,orig:Math.round(v.orig),air:Math.round(v.air),airRate:v.orig>0?Math.round(v.air/v.orig*100):0})).sort((a,b)=>b.orig-a.orig)
  }
  const buildDelay = (rows:any[], fn:(r:any)=>string) => {
    const m:Record<string,{total:number;count:number}>={}
    rows.forEach(r=>{
      if(!r.planShipmentDate||!r.originalShipmentDate) return
      const plan=new Date(r.planShipmentDate), orig=new Date(r.originalShipmentDate)
      if(isNaN(plan.getTime())||isNaN(orig.getTime())) return
      const days=Math.round((plan.getTime()-orig.getTime())/86400000)
      if(days<=0) return
      const k=fn(r)||"N/A"; if(!m[k])m[k]={total:0,count:0}
      m[k].total+=days; m[k].count++
    })
    return Object.entries(m).map(([name,v])=>({name,avgDays:Math.round(v.total/v.count),count:v.count}))
      .sort((a,b)=>b.avgDays-a.avgDays)
  }

  const moKey = (r:any) => {
    if(!r.planShipmentDate) return "N/A"
    const d=new Date(r.planShipmentDate); if(isNaN(d.getTime())) return "N/A"
    return fmtMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`)
  }
  const moSort = (r:any) => {
    if(!r.planShipmentDate) return ""; const d=new Date(r.planShipmentDate)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`
  }

  const monthlyCost = useMemo(()=>{
    const m:Record<string,{est:number;actual:number;ym:string}>={}
    filtered.forEach(r=>{ const k=moKey(r); if(k==="N/A") return; if(!m[k])m[k]={est:0,actual:0,ym:moSort(r)}; m[k].est+=r.airFreight||0; m[k].actual+=r.actualAirFreight||0 })
    return Object.entries(m).sort(([,a],[,b])=>a.ym.localeCompare(b.ym)).map(([name,v])=>({name,est:Math.round(v.est),actual:Math.round(v.actual)}))
  },[filtered])

  const monthlyQty = useMemo(()=>{
    const m:Record<string,{orig:number;air:number;ym:string}>={}
    filtered.forEach(r=>{ const k=moKey(r); if(k==="N/A") return; if(!m[k])m[k]={orig:0,air:0,ym:moSort(r)}; m[k].orig+=Number(r.qtyOriginalShipment)||0; m[k].air+=Number(r.qtyRequestAir)||0 })
    return Object.entries(m).sort(([,a],[,b])=>a.ym.localeCompare(b.ym)).map(([name,v])=>({name,orig:Math.round(v.orig),air:Math.round(v.air),airRate:v.orig>0?Math.round(v.air/v.orig*100):0}))
  },[filtered])

  const brandCost  = useMemo(()=>buildCost(filtered,r=>brandKey(r)),[filtered])
  const brandQty   = useMemo(()=>buildQty(filtered,r=>brandKey(r)),[filtered])
  const brandDelay = useMemo(()=>buildDelay(filtered,r=>brandKey(r)),[filtered])

  const cRows = (_r:any) => true
  const cKey  = (r:any) => countryKey(r.country)
  const countryCost  = useMemo(()=>buildCost(filtered.filter(cRows),cKey),[filtered,drillCountry])
  const countryQty   = useMemo(()=>buildQty(filtered.filter(cRows),cKey),[filtered,drillCountry])
  const countryDelay = useMemo(()=>buildDelay(filtered.filter(cRows),cKey),[filtered,drillCountry])

  const buCost  = useMemo(()=>buildCost(filtered,r=>r.request.buName),[filtered])
  const buQty   = useMemo(()=>buildQty(filtered,r=>r.request.buName),[filtered])
  const buDelay = useMemo(()=>buildDelay(filtered,r=>r.request.buName),[filtered])

  const deptCost  = useMemo(()=>buildCost(filtered,r=>r.claimDepartment||"Unassigned"),[filtered])
  const deptQty   = useMemo(()=>buildQty(filtered,r=>r.claimDepartment||"Unassigned"),[filtered])
  const deptDelay = useMemo(()=>buildDelay(filtered,r=>r.claimDepartment||"Unassigned"),[filtered])

  // Claim amount per claim department (each split's share): actual = actualAirFreight × claim%,
  // est = airFreight × claim%. Summed across all filtered SO, biggest first.
  const claimByDept = useMemo(()=>{
    const m: Record<string,{amt:{THB:number,USD:number},est:{THB:number,USD:number},qty:number}> = {}
    // "ยังไม่แบ่ง claim" bucket = rows with NO claim dept yet (auto / not assigned) → their ACTUAL is not
    // in any dept, so track it separately so sum(dept actual) + unassigned = total actual (reconciles).
    const un = {amt:{THB:0,USD:0} as any,est:{THB:0,USD:0} as any,qty:0}
    filtered.forEach(r=>{
      const est=Number(r.airFreight)||0
      const act=Number(r.actualAirFreight)||0   // ACTUAL only — no est fallback
      const cur=rowCur(r)
      const splits=getSplits(r)
      if(splits.length===0){ un.amt[cur]+=act; un.est[cur]+=est; un.qty+=Number(r.qtyRequestAir)||0; return }
      for(const s of splits){
        const lbl=deptLabel(s.dept)||"-"; const pct=Number(s.pct)||0
        if(!m[lbl]) m[lbl]={amt:{THB:0,USD:0},est:{THB:0,USD:0},qty:0}
        m[lbl].amt[cur]+=act*pct/100              // actual ล้วน (ไม่ fallback est)
        m[lbl].est[cur]+=est*pct/100
        m[lbl].qty+=Math.round((Number(r.qtyRequestAir)||0)*pct/100)
      }
    })
    // _mag = combined magnitude (THB+USD) — used ONLY for relative bar length & ranking, never shown.
    const arr = Object.entries(m).map(([dept,v])=>({
      dept,
      amt:{THB:Math.round(v.amt.THB),USD:Math.round(v.amt.USD)},
      est:{THB:Math.round(v.est.THB),USD:Math.round(v.est.USD)},
      qty:v.qty,
      _mag:(v.amt.THB+v.amt.USD)||(v.est.THB+v.est.USD),
      unassigned:false,
    }))
    if(un.amt.THB||un.amt.USD||un.est.THB||un.est.USD) arr.push({
      dept:"ยังไม่แบ่ง claim",
      amt:{THB:Math.round(un.amt.THB),USD:Math.round(un.amt.USD)},
      est:{THB:Math.round(un.est.THB),USD:Math.round(un.est.USD)},
      qty:un.qty, _mag:(un.amt.THB+un.amt.USD)||(un.est.THB+un.est.USD), unassigned:true,
    })
    return arr.sort((a,b)=>b._mag-a._mag)
  },[filtered])
  const claimMagTotal = claimByDept.reduce((s,d)=>s+d._mag,0)

  const monthlyDelay = useMemo(()=>{
    const m:Record<string,{total:number;count:number;ym:string}>={}
    filtered.forEach(r=>{
      if(!r.planShipmentDate||!r.originalShipmentDate) return
      const plan=new Date(r.planShipmentDate), orig=new Date(r.originalShipmentDate)
      if(isNaN(plan.getTime())||isNaN(orig.getTime())) return
      const days=Math.round((plan.getTime()-orig.getTime())/86400000)
      if(days<=0) return
      const k=moKey(r); if(k==="N/A") return
      if(!m[k])m[k]={total:0,count:0,ym:moSort(r)}
      m[k].total+=days; m[k].count++
    })
    return Object.entries(m).sort(([,a],[,b])=>a.ym.localeCompare(b.ym))
      .map(([name,v])=>({name,avgDays:Math.round(v.total/v.count),count:v.count}))
  },[filtered])

  // Pie
  const buildPie = (rows:any[], fn:(r:any)=>string, top=7) => {
    const m:Record<string,number>={}
    rows.forEach(r=>{ const k=fn(r)||"N/A"; m[k]=(m[k]||0)+1 })
    const s=Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
    if(s.length<=top) return s
    const oth=s.slice(top).reduce((acc,i)=>acc+i.value,0)
    return [...s.slice(0,top),{name:"Others",value:oth}]
  }

  // Filter options
  const years    = useMemo(()=>[...new Set(allSOs.map(r=>r.planShipmentDate?String(new Date(r.planShipmentDate).getFullYear()):"").filter(Boolean))].sort().reverse(),[allSOs])
  const brands   = [...new Set(allSOs.map((r:any)=>brandKey(r)).filter((b:string)=>b&&b!=="N/A"))].sort()
  const docNos   = [...new Set(allSOs.map((r:any)=>r.request.documentNo).filter(Boolean))].sort()
  const sos      = [...new Set(allSOs.map(r=>r.so).filter(Boolean))].sort()
  const hawbs    = [...new Set(allSOs.map((r:any)=>r.hawbNo).filter(Boolean))].sort()
  const ports    = [...new Set(allSOs.map(r=>r.port).filter(Boolean))].sort()
  const countries= [...new Set(allSOs.map(r=>countryKey(r.country)).filter(Boolean))].sort()
  const hasFilter= !!(yearFilter||monthFilter.length||statusFilter||actualF||brandF.length||docF.length||soF.length||cpF.length||portFilter||countryFilter||claimF.length||hawbF.length)
  const clearAll = ()=>{ setYearFilter(""); setMonthFilter([]); setStatusFilter(""); setActualF(""); setBrandF([]); setDocF([]); setSoF([]); setCpF([]); setPortFilter(""); setCountryFilter(""); setClaimF([]); setHawbF([]); setColF({}) }

  const H = 210

  const exportExcel = () => {
    const rows = tableRows.map(row => {
      const ar = row.qtyOriginalShipment > 0 ? row.qtyRequestAir / row.qtyOriginalShipment * 100 : 0
      const vp = row.airFreight > 0 && row.actualAirFreight > 0 ? (row.actualAirFreight - row.airFreight) / row.airFreight * 100 : null
      return {
        "DOC NO":         row.request.documentNo,
        "SO":             so8(row.so),
        "STYLE":          row.style,
        "SUB":            row.sub ?? "",
        "DESCRIPTION":    row.description ?? "",
        "CUSTOMER PO":    row.customerPO ?? "",
        "BRAND":          soBrand(row),
        "BU":             row.request.buName,
        "ORIG. DATE":     fmtDate(row.originalShipmentDate),
        "PLAN DATE":      fmtDate(row.planShipmentDate),
        "QTY ORIG":       row.qtyOriginalShipment,
        "QTY AIR":        tableShipped ? shipQtyOf(row) : row.qtyRequestAir,
        ...(isAdmin && tableShipped ? { "SOURCE": shipSrcOf(row) } : {}),
        "AIR RATE%":      Number(ar.toFixed(1)),
        [`EST. (${CUR})`]:     row.airFreight ?? 0,
        [`ACTUAL (${CUR})`]:   row.actualAirFreight ?? 0,
        "INV NO":         row.invoiceNo ?? "",
        "HAWB NO":        row.hawbNo ?? "",
        "VAR%":           vp != null ? Number(vp.toFixed(1)) : "",
        "COUNTRY":        row.country,
        "FACTORY":        row.factory,
        "CLAIM DEPT":     (getSplits(row).map((s:any)=>deptLabel(s.dept)).join(" · ")) || (row.claimDepartment ?? ""),
        "CLAIM %":        getSplits(row).map((s:any)=>s.pct!=null?`${s.pct}%`:"").filter(Boolean).join(" · "),
        "REASON":         ([...new Set(getSplits(row).map((s:any)=>s.reason).filter(Boolean))].join(" · ")),
        "DETAIL":         ([...new Set(getSplits(row).map((s:any)=>s.detail).filter(Boolean))].join(" · ")),
        "STATUS":         soStage(row), // by-position status incl. PENDING_LG_BOOKING/CLAIM (matches the table)
        "อยู่ที่ใคร":       (Array.isArray(row.request.pendingWith) ? row.request.pendingWith.join(", ") : ""),
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Air Request")
    const today = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `air-request-${today}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">DASHBOARD</h1>
        {/* Single-BU users get no toggle (nothing to switch); 2+ BUs / admins get tabs. */}
        {buTabs.length > 1 && (
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
            {buTabs.map(({ v, label, active }) => (
              <button key={v} onClick={() => setActiveBu(v)}
                className={`px-4 py-1.5 transition-colors ${activeBu === v ? active : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {/* Admin toggle (NYG / All BU only — mp_line is NYG data): filter the whole page to mp_line-shipped SOs. */}
        {mpAllowed && (
          <button onClick={() => setMpMode(v => !v)}
            className={`ml-auto text-xs font-bold px-4 py-1.5 rounded-lg border transition-colors ${mpActive ? "bg-teal-600 text-white border-transparent" : "bg-white text-teal-700 border-teal-300 hover:bg-teal-50"}`}
            title="กรองทั้งหน้าให้เหลือเฉพาะ SO ที่ส่งออกจริง (map กับ mp_line) — เฉพาะ NYG">
            🔗 {mpActive ? "เฉพาะที่ map mp_line (ON)" : "map mp_line"}
          </button>
        )}
      </div>
      {mpActive && (
        <div className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 -mt-1">
          🔗 โหมด map (NYG): ทั้งหน้า (KPI · charts · data table) แสดง<b>เฉพาะ SO ที่ส่งออกจริงใน mp_line</b> — เทียบยอดกับการ์ด mp_line ด้านบนได้เลย
        </div>
      )}

      {/* ── mp_line reconcile (admin · NYG) — shows ONLY in map mode (replaces the KPI row) ──
           2 การ์ด: ส่งออกจริง (มี variance rail) + ยังไม่มีการส่งออก · note ยังไม่แบ่งเคลมด้านล่าง */}
      {mpActive && mpCounts && (() => {
        // ส่งออกจริง card = คำนวณจาก shippedRows (ชุดเดียวกับตาราง) → ตัวเลขตรงกับ DATA TABLE เป๊ะ
        const shipSo  = new Set(shippedRows.map((r:any)=>mpSoKey(r.so))).size
        const shipQty = shippedRows.reduce((s:number,r:any)=>s+shipQtyOf(r),0)
        const est = shippedRows.reduce((s:number,r:any)=>s+(Number(r.airFreight)||0),0)
        const act = shippedRows.reduce((s:number,r:any)=>s+(Number(r.actualAirFreight)||0),0)
        const varPct = est > 0 ? Math.round((act - est) / est * 1000) / 10 : null
        const dVal = act - est
        // ยังไม่มีการส่งออก = air-req ที่ SO ไม่มีใน mp_line
        const unSo = new Set(unshippedRows.map((r:any)=>mpSoKey(r.so))).size
        const unEst = unshippedRows.reduce((s:number,r:any)=>s+(Number(r.airFreight)||0),0)
        const unAct = unshippedRows.reduce((s:number,r:any)=>s+(Number(r.actualAirFreight)||0),0)
        const unQtyPlan = unshippedRows.reduce((s:number,r:any)=>s+(Number(r.qtyRequestAir)||0),0) // QTY plan (air) ที่ MER กรอก
        // ยังไม่แบ่งแผนกเคลม (จาก claimByDept)
        const unClaim = (claimByDept as any[]).find(d=>d.unassigned)
        const unClaimAmt = unClaim ? (unClaim.amt.THB + unClaim.amt.USD) : 0
        const unClaimEst = unClaim ? (unClaim.est.THB + unClaim.est.USD) : 0
        // รวม = ส่งจริง + แผน
        const totQty = shipQty + unQtyPlan, totEst = est + unEst, totAct = act + unAct, totSo = shipSo + unSo
        const shipPctEst = totEst > 0 ? (est / totEst * 100) : 0   // สัดส่วน bar คิดจาก est cost
        const planPctEst = 100 - shipPctEst
        const fmtM = (n:number) => n >= 1e6 ? (n/1e6).toFixed(2)+"M" : fmtNum(n)
        // Sale Order (SO_ORDER · ทุก ship mode) — คอลัมน์แรกของการ์ดภาพรวม + % แอร์เทียบยอดขาย
        const soPcs = soOrder?.pcs || 0
        const pctOf = (n:number) => soPcs > 0 ? n / soPcs * 100 : 0
        const airPct = pctOf(totQty), shipPct = pctOf(shipQty), planPct = pctOf(unQtyPlan)
        const wShip = Math.min(shipPct, 100), wPlan = Math.min(planPct, 100 - wShip)
        return (
        <div className="space-y-2.5">
          {/* ── การ์ดภาพรวม (เต็มความกว้าง) ── */}
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-400">ภาพรวม · {totSo.toLocaleString()} SO</p>
            <p className="text-base font-extrabold text-gray-900 mb-3">ส่งแอร์ทั้งหมด</p>
            <div className={`grid grid-cols-1 gap-4 ${soOrder ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
              {/* Sale Order (SO_ORDER · NYG) — ตามปี/เดือน (ship_date) + Brand ที่เลือก */}
              {soOrder && (
                <div className="lg:border-r lg:border-gray-100 lg:pr-4" title="SO_ORDER · NYG · ทุก ship mode · ตามปี/เดือน (ship date) + Brand ที่เลือก">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Sale Order</p>
                  <p className="text-3xl font-extrabold tabular-nums text-slate-700 leading-none mt-0.5">{fmtNum(soPcs)}</p>
                  <p className="text-[11px] text-gray-400 mt-1 tabular-nums">pcs · {soOrder.soCount.toLocaleString()} SO · ทุก ship mode</p>
                  {/* แถบ = Sale Order 100% · เขียว ส่งแอร์จริง · ส้ม แผนแอร์ */}
                  <div className="flex h-1.5 rounded-full bg-slate-200 overflow-hidden mt-2.5">
                    <div className="h-full bg-green-500" style={{width:`${wShip}%`}} title={`ส่งแอร์จริง ${shipPct.toFixed(1)}% ของ Sale Order`}></div>
                    <div className="h-full bg-amber-400" style={{width:`${wPlan}%`}} title={`แผนแอร์ ${planPct.toFixed(1)}% ของ Sale Order`}></div>
                  </div>
                  {soOrder.unparsed > 0 && <p className="text-[10px] text-amber-700 mt-1">⚠ {soOrder.unparsed.toLocaleString()} แถวอ่าน ship_date ไม่ได้ (ไม่นับ)</p>}
                </div>
              )}
              <div>
                <p className="text-[11px] text-gray-400 font-semibold">จำนวน</p>
                <p className="text-3xl font-extrabold tabular-nums text-gray-900 leading-none mt-0.5">{fmtNum(totQty)}</p>
                <p className="text-[11px] text-gray-400 mt-1 tabular-nums">pcs{soOrder && soPcs > 0 && <> · <b className={airPct > 100 ? "text-red-600" : "text-rose-700"}>{airPct.toFixed(1)}%</b> ของ Sale Order</>}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-semibold">Est air cost</p>
                <p className="text-3xl font-extrabold tabular-nums text-sky-700 leading-none mt-0.5">{fmtM(totEst)}</p>
                <p className="text-[11px] text-gray-400 mt-1 tabular-nums">{fmtNum(totEst)} THB</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-semibold">Actual air cost</p>
                <p className="text-3xl font-extrabold tabular-nums text-gray-800 leading-none mt-0.5">{fmtM(totAct)}</p>
                <p className="text-[11px] text-gray-400 mt-1 tabular-nums">{fmtNum(totAct)} THB · เฉพาะส่งจริง</p>
              </div>
            </div>
            {/* progress bar (คิดจาก est cost) */}
            <div className="flex h-2.5 rounded-full bg-gray-100 overflow-hidden mt-4">
              <div className="h-full bg-gradient-to-r from-green-500 to-green-600" style={{width:`${shipPctEst}%`}} title={`ส่งจริง ${shipPctEst.toFixed(1)}%`}></div>
              <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500" style={{width:`${planPctEst}%`}} title={`แผนส่ง ${planPctEst.toFixed(1)}%`}></div>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-green-700"><span className="w-2 h-2 rounded-full bg-green-500"></span>ส่งจริง {shipPctEst.toFixed(1)}%</span>
              <span className="text-gray-400">สัดส่วนตาม est cost</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500"></span>แผนส่ง {planPctEst.toFixed(1)}%</span>
            </div>
          </div>
          {/* ── 2 การ์ด: ส่งจริง / แผนส่ง ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* ส่งจริง */}
            <div className="rounded-xl border border-green-200 bg-green-50/60 px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-green-800">⊘ ส่งจริง</span>
                <span className="text-[11px] font-bold text-green-700 bg-white/70 border border-green-200 rounded-full px-2.5 py-0.5">{shipSo.toLocaleString()} SO</span>
              </div>
              <p className="text-[11px] text-gray-500 font-semibold mt-3">จำนวนส่งจริง (pcs)</p>
              <p className="text-2xl font-extrabold tabular-nums text-green-800 leading-none mt-0.5">{fmtNum(shipQty)}</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Est air cost</p><p className="text-lg font-bold tabular-nums text-gray-700">{fmtNum(est)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Actual air cost</p><p className="text-lg font-bold tabular-nums text-green-700">{fmtNum(act)}</p></div>
              </div>
              <div className="flex items-center justify-between border-t border-green-200/70 mt-3 pt-2.5">
                <span className="text-[11px] text-gray-500 font-semibold">เทียบ est</span>
                <span className={`text-sm font-bold tabular-nums ${varPct==null?"text-gray-400":varPct>0?"text-red-600":"text-green-600"}`}>
                  {varPct==null?"—":`${varPct>0?"↑":"↓"} ${Math.abs(varPct)}% · ${dVal>0?"+":""}${fmtNum(dVal)}`}
                </span>
              </div>
            </div>
            {/* แผนส่ง */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-amber-800">⊟ แผนส่ง</span>
                <span className="text-[11px] font-bold text-amber-700 bg-white/70 border border-amber-200 rounded-full px-2.5 py-0.5">{unSo.toLocaleString()} SO</span>
              </div>
              <p className="text-[11px] text-gray-500 font-semibold mt-3">Qty plan air (MER)</p>
              <p className="text-2xl font-extrabold tabular-nums text-amber-800 leading-none mt-0.5">{fmtNum(unQtyPlan)}</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Est air cost</p><p className="text-lg font-bold tabular-nums text-gray-700">{fmtNum(unEst)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Actual air cost</p><p className="text-lg font-bold tabular-nums text-gray-400">—</p></div>
              </div>
              <div className="flex items-center justify-between border-t border-amber-200/70 mt-3 pt-2.5">
                <span className="text-[11px] text-gray-500 font-semibold">สถานะ</span>
                <span className="text-sm font-bold text-amber-700">ยังไม่ส่งออก</span>
              </div>
            </div>
          </div>
          {/* note: ยังไม่แบ่งแผนกเคลม */}
          {unClaimAmt > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-gray-700">
              <span className="w-5 h-5 rounded-md bg-red-500 text-white grid place-items-center text-[11px] shrink-0">!</span>
              <span>ยังไม่แบ่งแผนกเคลม <b className="text-red-600 tabular-nums">{fmtNum(unClaimAmt)} THB</b> <span className="text-gray-400 tabular-nums">(est {fmtNum(unClaimEst)} THB)</span></span>
            </div>
          )}
        </div>
        )
      })()}

      {/* ── KPI ── (hidden in map mode — the mp_line card above replaces it) ── */}
      {!mpActive && (
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {([
          ["QTY SHIP AIR","pcs",fmtNum(totalQAir),"text-orange-700","bg-orange-50 border-orange-200","Requested air"],
          ["EST. AIRFREIGHT",curLabel,fmtSplit(estSplit,fmtK),"text-sky-700","bg-sky-50 border-sky-200",fmtSplit(estSplit)],
          ["ACTUAL AIRFREIGHT",curLabel,fmtSplit(actSplit,fmtK),"text-teal-700","bg-teal-50 border-teal-200",fmtSplit(actSplit)],
          ["ACTUAL vs EST","%",varPct!=null?(varPct>0?"↑":"↓")+Math.abs(varPct).toFixed(1)+"%":"N/A",varPct!=null&&varPct>0?"text-red-600":varPct!=null&&varPct<0?"text-green-600":"text-gray-400","bg-orange-50 border-orange-200",varPct!=null?`Variance ${fmtPct(varPct)}`:"Actual N/A"],
        ] as [string,string,any,string,string,string][]).map(([label,unit,value,tc,bg,sub])=>(
          <div key={label} className={`${bg} border rounded-xl p-4`}>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
            <p className={`text-3xl font-extrabold ${tc} mt-1 leading-none`}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>
      )}

      {/* ── Claim by department (each claim's share of the airfreight) ────── */}
      {claimByDept.length>0 && (()=>{
        const deptCards = claimByDept.filter(d=>!d.unassigned)   // real depts = cards
        const barMax = Math.max(...deptCards.map(d=>d._mag), 1)
        return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Claim by department</p>
          </div>
          {/* single row — scroll sideways if it can't fit */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {deptCards.map(d=>{
              // % label = this dept's share of the TOTAL claim (all depts + unassigned sum ~100%).
              const share = claimMagTotal>0 ? d._mag/claimMagTotal*100 : 0
              // Bar length = relative to the LARGEST dept (biggest = full) so the ranking reads at a glance.
              const barPct = d._mag/barMax*100
              const c = deptColor(d.dept)
              return (
                <div key={d.dept} title={`${fmtNum(d.qty)} pcs · ${share.toFixed(0)}% of total claim`}
                  className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-colors flex-1 min-w-[150px]">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:c}}/>
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">{d.dept}</span>
                  </div>
                  <p className="text-[22px] font-bold text-gray-900 leading-none tabular-nums">{fmtSplit(d.amt,fmtK)}</p>
                  <div className="mt-3 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${Math.max(2,Math.min(100,barPct))}%`, background:c}}/>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400 tabular-nums">
                    <span className="font-medium text-gray-500">{share.toFixed(0)}% of total</span>
                    <span>est {fmtSplit(d.est,fmtK)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )
      })()}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600">FILTERS</p>
          {hasFilter && <button onClick={clearAll} className="text-xs text-blue-600 hover:underline">Clear all</button>}
        </div>
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-500 w-14 shrink-0">PERIOD</span>
          <select value={yearFilter} onChange={e=>{setYearFilter(e.target.value);setMonthFilter([])}}
            className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm bg-blue-50 font-medium text-blue-700">
            <option value="">All Years</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <div className="w-52">
            <MultiSelect label="All Months" options={MONTH_OPTS.map(m=>m.label)}
              value={monthFilter.map(v=>MONTH_OPTS.find(m=>m.value===v)?.label||v)}
              onChange={labels=>setMonthFilter(labels.map(l=>MONTH_OPTS.find(m=>m.label===l)?.value||l))}/>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-8 gap-2">
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
          {/* Actual air = the SO has been shipped and costed. Filtering on it is how you compare
              like with like (est vs actual) instead of dragging in SOs nobody has billed yet. */}
          <select value={actualF} onChange={e=>setActualF(e.target.value as "" | "HAS" | "NONE")} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">Actual: ALL</option>
            <option value="HAS">มีข้อมูลค่าแอร์</option>
            <option value="NONE">ไม่มีข้อมูลค่าแอร์</option>
          </select>
          <MultiSelect label="All Brand" options={brands} value={brandF} onChange={setBrandF}/>
          <MultiSelect label="Doc No..." options={docNos} value={docF} onChange={setDocF}/>
          <MultiSelect label="SO..." options={sos} value={soF} onChange={setSoF}/>
          <select value={countryFilter} onChange={e=>setCountryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Country</option>
            {countries.map((c:any)=><option key={c} value={c}>{c}</option>)}
          </select>
          <MultiSelect label="Claim Dept" options={CLAIM_DEPTS} value={claimF} onChange={setClaimF}/>
          <MultiSelect label="HAWB#..." options={hawbs} value={hawbF} onChange={setHawbF}/>
        </div>
      </div>

      {/* ── Delay Reason Overview (below filters) ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReasonPanel rows={filtered} height={180} cur={curLabel}/>
        <LogisticsCostBar rows={filtered}/>
      </div>

      {/* ── Column Headers ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="text-center text-[11px] font-bold text-white rounded-lg py-2 tracking-wide" style={{background:"#6b1a1a"}}>EST vs ACTUAL AIR FREIGHT ({curLabel})</div>
        <div className="text-center text-[11px] font-bold text-white rounded-lg py-2 tracking-wide" style={{background:"#6b1a1a"}}>QTY SHIP AIR (pcs)</div>
        <div className="text-center text-[11px] font-bold text-white rounded-lg py-2 tracking-wide" style={{background:"#6b1a1a"}}>AVG DELAY DAYS (Plan − Original)</div>
      </div>

      {/* ── Row 1: By Ship Month ─────────────────────────────────────────── */}
      <SectionRow label="By Ship Month"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Paged data={monthlyCost} fromEnd>{(s)=><CostBar data={s} height={H} cur={curLabel}/>}</Paged>
        <Paged data={monthlyQty} fromEnd>{(s)=><QtyBar data={s} height={H}/>}</Paged>
        <Paged data={monthlyDelay} fromEnd>{(s)=><DelayBar data={s} rows={filtered} groupFn={moKey} height={H}/>}</Paged>
      </div>

      {/* ── Row 2: By Brand ─────────────────────────────────────────────── */}
      <SectionRow label="By Brand"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Paged data={brandCost}>{(s)=><CostBar data={s} height={H} cur={curLabel}/>}</Paged>
        <Paged data={brandQty}>{(s)=><QtyBar data={s} height={H}/>}</Paged>
        <Paged data={brandDelay}>{(s)=><DelayBar data={s} rows={filtered} groupFn={(r:any)=>brandKey(r)} height={H}/>}</Paged>
      </div>

      {/* ── Row 3: By Country ────────────────────────────────────────────── */}
      <SectionRow label="By Country"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Paged data={countryCost}>{(s)=><CostBar data={s} height={H} cur={curLabel}/>}</Paged>
        <Paged data={countryQty}>{(s)=><QtyBar data={s} height={H}/>}</Paged>
        <Paged data={countryDelay}>{(s)=><DelayBar data={s} rows={filtered.filter(cRows)} groupFn={cKey} height={H}/>}</Paged>
      </div>

      {/* ── Row 4: By BU ────────────────────────────────────────────────── */}
      <SectionRow label="By BU"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CostBar  data={buCost}  height={H} cur={curLabel}/>
        <QtyBar   data={buQty}   height={H}/>
        <DelayBar data={buDelay} rows={filtered} groupFn={(r:any)=>r.request?.buName||"N/A"} height={H}/>
      </div>

      {/* ── Row 5: By Claim Dept ─────────────────────────────────────────── */}
      <SectionRow label="By Claim Dept"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CostBar  data={deptCost}  height={H} cur={curLabel}/>
        <QtyBar   data={deptQty}   height={H}/>
        <DelayBar data={deptDelay} rows={filtered} groupFn={(r:any)=>r.claimDepartment||"Unassigned"} height={H}/>
      </div>


      {/* ── Data Table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 flex justify-between items-center" style={{background:"#a03535"}}>
          <h2 className="font-bold text-[11px] uppercase tracking-widest text-white">DATA TABLE</h2>
          <div className="flex items-center gap-3">
            {/* Table-only view toggle: ส่งออกจริง (mp_line) vs แพลนทั้งหมด — independent of the page-wide 🔗 mode */}
            <div className="flex rounded-md overflow-hidden text-[11px] font-semibold" style={{border:"1px solid #ffffff55"}}>
              <button onClick={()=>setTableView("SHIPPED")}
                className="px-2.5 py-1 transition-colors"
                style={tableView==="SHIPPED"?{background:"#fff",color:"#a03535"}:{background:"transparent",color:"#fff"}}>ส่งออกจริง</button>
              <button onClick={()=>setTableView("UNSHIPPED")}
                className="px-2.5 py-1 transition-colors"
                style={tableView==="UNSHIPPED"?{background:"#fff",color:"#a03535"}:{background:"transparent",color:"#fff"}}>ยังไม่มีการส่ง</button>
            </div>
            <span className="text-xs font-medium" style={{color:"#fde8e8"}}>{tableRows.length.toLocaleString()} รายการ</span>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-md transition-colors"
              style={{background:"#ffffff22",color:"#fff",border:"1px solid #ffffff44"}}
              onMouseEnter={e=>(e.currentTarget.style.background="#ffffff44")}
              onMouseLeave={e=>(e.currentTarget.style.background="#ffffff22")}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export Excel
            </button>
          </div>
        </div>
        <div className="overflow-auto max-h-[380px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr style={{background:"#c87070"}}>{COLS.map((c,idx)=>{
                const activeF = (colF[idx]?.length||0) > 0
                return (
                <th key={idx} style={{background:"#c87070"}} className="px-3 py-2 text-left whitespace-nowrap font-semibold text-[11px] tracking-wide text-white">
                  <div className="flex items-center gap-1">
                    <span>{c.label}</span>
                    <button
                      onClick={(e)=>{ const r=(e.currentTarget as HTMLElement).getBoundingClientRect(); setColSearch(""); setColMenu(colMenu?.idx===idx?null:{idx, x:r.left, y:r.bottom}) }}
                      className={`ml-auto shrink-0 rounded px-1 leading-none text-[11px] ${activeF?"bg-white text-[#a03535]":"text-white/70 hover:text-white hover:bg-white/20"}`}
                      title="กรองคอลัมน์นี้">▾</button>
                  </div>
                </th>)
              })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={COLS.length} className="text-center py-10 text-gray-400">Loading...</td></tr>}
              {!loading && tableRows.map((row,i)=>{
                const vp = row.airFreight>0&&row.actualAirFreight>0 ? (row.actualAirFreight-row.airFreight)/row.airFreight*100 : null
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{row.request.documentNo}{String(row.reasonDelay||"").startsWith("Auto-add") && <span className="ml-1 px-1 py-0.5 rounded bg-pink-100 text-pink-700 text-[9px] font-bold align-middle">AUTO</span>}</td>
                    <td className="px-3 py-1.5 font-medium tabular-nums">{so8(row.so)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{poMap[row.so] || "-"}</td>
                    <td className="px-3 py-1.5">{row.style}</td>
                    <td className="px-3 py-1.5">{row.sub || "-"}</td>
                    <td className="px-3 py-1.5 max-w-[200px]"><span className="truncate block" title={row.description || ""}>{row.description || "-"}</span></td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{row.customerPO || "-"}</td>
                    <td className="px-3 py-1.5">{soBrand(row)}</td>
                    <td className="px-3 py-1.5">{row.request.buName}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{(()=>{const s=soStage(row);return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_CLS[s]||"bg-gray-100 text-gray-500"}`}>{s}</span>})()}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(row.originalShipmentDate)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(row.planShipmentDate)}</td>
                    <td className="px-3 py-1.5">{row.qtyOriginalShipment}</td>
                    <td className="px-3 py-1.5 font-semibold" title={tableShipped ? "ยอด ship จริงของรอบนี้ (SO+SUB+INV จาก mp_line / export)" : "QTY AIR (แผน)"}>{tableShipped ? shipQtyOf(row).toLocaleString() : (row.qtyRequestAir ?? "-")}</td>
                    <td className="px-3 py-1.5 text-blue-700">{fmtNum(row.airFreight)}</td>
                    <td className="px-3 py-1.5 text-green-700 font-medium">{fmtNum(row.actualAirFreight)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{row.invoiceNo || "-"}{row._synthetic && <span className="ml-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold" title="INV นี้มีใน export / mp_line แต่ยังไม่มีแถว air request ไหนผูกไว้ — ให้ LG แก้ INV ในหน้า FIX HAWB">ยังไม่ผูก air req</span>}{tableShipped && !row._synthetic && isInvMismatch(row) && <span className="ml-1 text-orange-600 font-bold" title="INV ของ SO+SUB นี้ไม่ตรงกับ export / mp_line (เช่น LG ใส่ INV เดียวให้ทุกแถว) — QTY แบ่งจากยอดรวม SO+SUB">⚠</span>}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{row.hawbNo || "-"}</td>
                    <td className="px-3 py-1.5">
                      {vp!=null&&<span className={`font-medium ${vp>10?"text-red-600":vp<-10?"text-green-600":"text-gray-500"}`}>{fmtPct(vp)}</span>}
                    </td>
                    <td className="px-3 py-1.5">{row.factory || "-"}</td>
                    <td className="px-3 py-1.5">{row.country}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{(()=>{const sp=getSplits(row);return sp.length?sp.map((s:any)=>deptLabel(s.dept)).join(" · "):(row.claimDepartment||"-")})()}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{(()=>{const sp=getSplits(row);return sp.length?sp.map((s:any)=>s.pct!=null?`${s.pct}%`:"-").join(" · "):"-"})()}</td>
                    <td className="px-3 py-1.5 max-w-[220px]">{(()=>{const rs=[...new Set(getSplits(row).map((s:any)=>s.reason).filter(Boolean))];const txt=rs.length?rs.join(" · "):"-";return <span className="truncate block" title={txt}>{txt}</span>})()}</td>
                    <td className="px-3 py-1.5 max-w-[220px]">{(()=>{const pw=Array.isArray(row.request.pendingWith)?row.request.pendingWith:[];const txt=pw.length?pw.join(", "):"-";return <span className="truncate block font-medium text-gray-700" title={txt}>{txt}</span>})()}</td>
                    {isAdmin && <td className="px-3 py-1.5 whitespace-nowrap">{(()=>{const src=tableShipped?shipSrcOf(row):"";return src?<span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${src==="mp_line"?"bg-teal-100 text-teal-700":src==="export"?"bg-amber-100 text-amber-700":"bg-gray-100 text-gray-600"}`} title={src==="LG"?"ใช้ QTY ที่ LG กรอก (หลายแถวใช้ INV เดียวกัน หรือ INV ไม่พบใน mp_line/export)":undefined}>{src}</span>:<span className="text-gray-300">-</span>})()}</td>}
                  </tr>
                )
              })}
              {!loading&&tableRows.length===0&&<tr><td colSpan={COLS.length} className="text-center py-10 text-gray-400">No data</td></tr>}
            </tbody>
            {tableRows.length>0&&(
              <tfoot className="sticky bottom-0">
                <tr className="bg-gray-100 font-bold text-gray-800 border-t-2 border-gray-300">
                  <td className="px-3 py-2 text-right whitespace-nowrap" colSpan={12}>TOTAL ({tblSO.toLocaleString()} รายการ · {tableShipped?"ส่งออกจริง":"ยังไม่มีการส่ง"})</td>
                  <td className="px-3 py-2">{tblQOrig.toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap" title={tableShipped ? "ยอดตั้งต้นจาก export / mp_line ต่อรอบส่ง (SO+SUB+INV) — ผลรวมเท่ายอดในตาราง export / mp_line" : undefined}>
                    {tblQAir.toLocaleString()}
                    {tableShipped && shipUnmatched > 0 && <span className="ml-1.5 text-[10px] font-semibold text-amber-700" title="SO+SUB ที่ไม่พบใน export / mp_line → QTY = 0 (ไม่นับ)">⚠ {shipUnmatched} แถวไม่พบใน export</span>}
                    {tableShipped && shipAlloc.invMismatch.size > 0 && <span className="ml-1.5 text-[10px] font-semibold text-orange-700" title="INV ที่ LG ใส่ใน air request ไม่ตรงกับ INV ใน export / mp_line → แบ่งยอดรวม SO+SUB ให้แทน (ยอดรวมยังเท่า export) · ควรให้ LG แก้ INV ในหน้า FIX HAWB">⚠ {shipAlloc.invMismatch.size} SO+SUB INV ไม่ตรง</span>}
                  </td>
                  <td className="px-3 py-2 text-blue-700">{fmtNum(tblEst)}</td>
                  <td className="px-3 py-2 text-green-700">{fmtNum(tblAct)}</td>
                  <td className="px-3 py-2" colSpan={9 + (isAdmin ? 1 : 0)}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Excel-style column filter dropdown (fixed position so it isn't clipped by the table scroll box) */}
      {colMenu && (()=>{
        const idx = colMenu.idx
        const all = colOptions(idx)
        const opts = all.filter(o=>!colSearch || o.toLowerCase().includes(colSearch.toLowerCase()))
        const winW = typeof window!=="undefined" ? window.innerWidth : 1200
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={()=>setColMenu(null)}/>
            <div className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 w-60 p-2 text-gray-800 flex flex-col"
              style={{left:Math.min(colMenu.x, winW-248), top:colMenu.y+4, maxHeight:340}}>
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[11px] font-bold text-gray-500 truncate">{COLS[idx]?.label}</span>
                <button onClick={()=>{clearColVal(idx); setColMenu(null)}} className="ml-auto text-[10px] text-gray-500 hover:text-red-600">ล้างตัวกรอง</button>
              </div>
              <input autoFocus value={colSearch} onChange={e=>setColSearch(e.target.value)} placeholder="ค้นหา..." className="w-full mb-1.5 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-300"/>
              {opts.length>0 && (()=>{
                const allChecked = opts.every(o=>colF[idx]?.includes(o))
                return (
                  <label className="flex items-center gap-1.5 py-0.5 px-1 text-xs font-semibold cursor-pointer hover:bg-gray-50 rounded border-b mb-0.5">
                    <input type="checkbox" checked={allChecked} onChange={()=>setColF(f=>{
                      const cur = new Set(f[idx]||[])
                      if (allChecked) opts.forEach(o=>cur.delete(o)); else opts.forEach(o=>cur.add(o))
                      const arr=[...cur]; const n={...f}; if(arr.length) n[idx]=arr; else delete n[idx]; return n
                    })}/>
                    <span>(เลือกทั้งหมด)</span>
                  </label>
                )
              })()}
              <div className="overflow-auto" style={{maxHeight:250}}>
                {opts.length===0 && <p className="text-[11px] text-gray-400 px-1 py-2">ไม่พบข้อมูล</p>}
                {opts.map(opt=>{
                  const checked = colF[idx]?.includes(opt) ?? false
                  return (
                    <label key={opt} className="flex items-center gap-1.5 py-0.5 px-1 text-xs cursor-pointer hover:bg-gray-50 rounded">
                      <input type="checkbox" checked={checked} onChange={()=>toggleColVal(idx,opt)}/>
                      <span className="truncate" title={opt||"(ว่าง)"}>{opt||"(ว่าง)"}</span>
                    </label>
                  )
                })}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 px-1 border-t pt-1">ติ๊กค่าที่ต้องการ · ไม่ติ๊ก = แสดงทั้งหมด</div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
