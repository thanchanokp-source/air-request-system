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
    const m:Record<string,{cost:number;qty:number}>={}
    rows.forEach(r=>rowReasonEntries(r).forEach(e=>{ if((e.dept||"-")!==drillDept) return; const k=(e.reason||"No Reason").trim(); if(!m[k])m[k]={cost:0,qty:0}; m[k].cost+=e.cost; m[k].qty+=e.qty }))
    return Object.entries(m).map(([name,v])=>({name,cost:Math.round(v.cost),qty:Math.round(v.qty)})).sort((a,b)=>mode==='cost'?b.cost-a.cost:b.qty-a.qty)
  },[rows,mode,drillDept])
  // "Reason" mode: claim department first, then the reasons that make up each dept.
  const deptGroups = useMemo(()=>{
    const m:Record<string,{qty:number;reasons:Record<string,number>}>={}
    rows.forEach(r=>rowReasonEntries(r).forEach(e=>{
      const d=e.dept||"-"; if(!m[d])m[d]={qty:0,reasons:{}}; m[d].qty+=e.qty
      const rk=(e.reason||"No Reason").trim(); m[d].reasons[rk]=(m[d].reasons[rk]||0)+e.qty
    }))
    return Object.entries(m).map(([dept,v])=>({
      dept, qty:Math.round(v.qty),
      reasons:Object.entries(v.reasons).map(([reason,q])=>({reason,qty:Math.round(q)})).sort((a,b)=>b.qty-a.qty),
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

function LogisticsCostBar({ rows, cur="THB" }: { rows:any[]; cur?:string }) {
  const data = useMemo(()=>{
    const m:Record<string,{cost:number;qty:number;soCount:number}>={}
    rows.forEach(r=>{
      const k=soBrand(r)
      if(!m[k])m[k]={cost:0,qty:0,soCount:0}
      m[k].cost+=r.actualAirFreight||0
      m[k].qty+=Number(r.qtyRequestAir)||0
      m[k].soCount++
    })
    return Object.entries(m)
      .filter(([,v])=>v.qty>0)
      .map(([name,v])=>({name,costPerUnit:Math.round(v.cost/v.qty*100)/100,totalCost:Math.round(v.cost),totalQty:v.qty,soCount:v.soCount}))
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
                <th className="text-right py-1.5 px-2 text-gray-500 font-semibold text-[11px] bg-white">TOTAL ({cur})</th>
                <th className="text-right py-1.5 px-2 text-gray-500 font-semibold text-[11px] bg-white">COST/PCS ({cur})</th>
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
  const { bus: viewBus, canAll } = useMemo(() => viewableBus(session?.user), [session])
  const buTabs = useMemo(() => [
    ...(canAll ? [{ v: "ALL", label: "All BU", active: "bg-gray-700 text-white" }] : []),
    ...viewBus.map(b => ({ v: b as string, label: BU_META[b].label, active: BU_META[b].active })),
  ], [viewBus, canAll])

  const [activeBu, setActiveBu] = useState<string>("ALL")
  // EA amounts are stored in USD; every other BU is THB. Label-only — numbers are unchanged.
  const CUR = activeBu === "EA" ? "USD" : "THB"
  // Session loads after first render — default the active BU to the viewer's first allowed
  // BU (or "All BU" for admins) once we know who they are.
  const buInit = useRef(false)
  useEffect(() => {
    if (buInit.current || !session?.user) return
    setActiveBu(canAll ? "ALL" : (viewBus[0] || "NYG"))
    buInit.current = true
  }, [session, canAll, viewBus])

  const [requests, setRequests]   = useState<any[]>([])
  const [loading,  setLoading]    = useState(true)
  const [yearFilter,  setYearFilter]  = useState("")
  const [monthFilter, setMonthFilter] = useState<string[]>([])
  const [statusFilter,setStatusFilter]= useState("")
  const [brandFilter, setBrandFilter] = useState("")
  const [soF,  setSoF]  = useState<string[]>([])
  const [cpF,  setCpF]  = useState<string[]>([])
  const [portFilter,    setPortFilter]    = useState("")
  const [countryFilter, setCountryFilter] = useState("")
  const [claimF, setClaimF] = useState<string[]>([])
  const [drillCountry, setDrillCountry]   = useState<string|null>(null)

  useEffect(() => {
    fetch("/api/requests").then(r=>r.json()).then(d=>{ setRequests(d); setLoading(false) })
  }, [])

  // TEST documents never count in dashboard reporting.
  const buRequests = useMemo(()=>requests.filter(r=> requestInBu(r, activeBu) && !r.isTest), [requests, activeBu])
  const allSOs = useMemo(()=>buRequests.flatMap(r=>(r.items||[]).map((item:any)=>({...item,request:r}))), [buRequests])

  const filtered = useMemo(()=>allSOs.filter(row=>{
    // Period filter is by ACTUAL ship = Plan Shipment Date (not the original date).
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
           (!brandFilter  || brandKey(row).includes(brandFilter)) &&
           (!soF.length   || soF.includes(row.so)) &&
           (!cpF.length   || cpF.includes(row.customerPO)) &&
           (!portFilter   || row.port===portFilter) &&
           (!countryFilter|| countryKey(row.country)===countryFilter) &&
           (!claimF.length|| claimF.includes(row.claimDepartment))
  }), [allSOs,yearFilter,monthFilter,statusFilter,brandFilter,soF,cpF,portFilter,countryFilter,claimF])

  // ─── KPI ────────────────────────────────────────────────────────────────
  const totalSO    = filtered.length
  const totalQOrig = filtered.reduce((s,r)=>s+(Number(r.qtyOriginalShipment)||0),0)
  const totalQAir  = filtered.reduce((s,r)=>s+(Number(r.qtyRequestAir)||0),0)
  const totalEst   = filtered.reduce((s,r)=>s+(r.airFreight||0),0)
  const totalAct   = filtered.reduce((s,r)=>s+(r.actualAirFreight||0),0)
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
    filtered.forEach(r=>{
      const est=Number(r.airFreight)||0
      const cur=rowCur(r)
      for(const s of getSplits(r)){
        const lbl=deptLabel(s.dept)||"-"; const pct=Number(s.pct)||0
        if(!m[lbl]) m[lbl]={amt:{THB:0,USD:0},est:{THB:0,USD:0},qty:0}
        m[lbl].amt[cur]+=splitAirCost(r,s)
        m[lbl].est[cur]+=est*pct/100
        m[lbl].qty+=Math.round((Number(r.qtyRequestAir)||0)*pct/100)
      }
    })
    // _mag = combined magnitude (THB+USD) — used ONLY for relative bar length & ranking, never shown.
    return Object.entries(m).map(([dept,v])=>({
      dept,
      amt:{THB:Math.round(v.amt.THB),USD:Math.round(v.amt.USD)},
      est:{THB:Math.round(v.est.THB),USD:Math.round(v.est.USD)},
      qty:v.qty,
      _mag:(v.amt.THB+v.amt.USD)||(v.est.THB+v.est.USD),
    })).sort((a,b)=>b._mag-a._mag)
  },[filtered])
  const claimAmtTotal = claimByDept.reduce((s,d)=>({THB:s.THB+d.amt.THB,USD:s.USD+d.amt.USD}),{THB:0,USD:0})
  const claimEstTotal = claimByDept.reduce((s,d)=>({THB:s.THB+d.est.THB,USD:s.USD+d.est.USD}),{THB:0,USD:0})
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
  const sos      = [...new Set(allSOs.map(r=>r.so).filter(Boolean))].sort()
  const cps      = [...new Set(allSOs.map(r=>r.customerPO).filter(Boolean))].sort()
  const ports    = [...new Set(allSOs.map(r=>r.port).filter(Boolean))].sort()
  const countries= [...new Set(allSOs.map(r=>countryKey(r.country)).filter(Boolean))].sort()
  const hasFilter= !!(yearFilter||monthFilter.length||statusFilter||brandFilter||soF.length||cpF.length||portFilter||countryFilter||claimF.length)
  const clearAll = ()=>{ setYearFilter(""); setMonthFilter([]); setStatusFilter(""); setBrandFilter(""); setSoF([]); setCpF([]); setPortFilter(""); setCountryFilter(""); setClaimF([]) }

  const H = 210

  const exportExcel = () => {
    const rows = filtered.map(row => {
      const ar = row.qtyOriginalShipment > 0 ? row.qtyRequestAir / row.qtyOriginalShipment * 100 : 0
      const vp = row.airFreight > 0 && row.actualAirFreight > 0 ? (row.actualAirFreight - row.airFreight) / row.airFreight * 100 : null
      return {
        "DOC NO":         row.request.documentNo,
        "SO":             row.so,
        "STYLE":          row.style,
        "SUB":            row.sub ?? "",
        "DESCRIPTION":    row.description ?? "",
        "CUSTOMER PO":    row.customerPO ?? "",
        "BRAND":          soBrand(row),
        "BU":             row.request.buName,
        "ORIG. DATE":     fmtDate(row.originalShipmentDate),
        "PLAN DATE":      fmtDate(row.planShipmentDate),
        "QTY ORIG":       row.qtyOriginalShipment,
        "QTY AIR":        row.qtyRequestAir,
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
      </div>

      {/* ── KPI ─────────────────────────────────────────────────────────── */}
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

      {/* ── Claim by department (each claim's share of the airfreight) ────── */}
      {claimByDept.length>0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-1">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em]">Claim by department</p>
            <p className="text-[11px] text-gray-400 tabular-nums">Actual {fmtSplit(claimAmtTotal,fmtK)} · Est {fmtSplit(claimEstTotal,fmtK)}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {(()=>{ const barMax = Math.max(...claimByDept.map(d=>d._mag), 1); return claimByDept.map(d=>{
              // % label = this dept's share of the TOTAL claim (combined magnitude — all depts sum ~100%).
              const share = claimMagTotal>0 ? d._mag/claimMagTotal*100 : 0
              // Bar length = relative to the LARGEST dept (biggest = full) so the ranking reads at a glance.
              const barPct = d._mag/barMax*100
              const c = deptColor(d.dept)
              return (
                <div key={d.dept} title={`${fmtNum(d.qty)} pcs · ${share.toFixed(0)}% of total claim`}
                  className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-colors">
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
            }) })()}
          </div>
        </div>
      )}

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select value={brandFilter} onChange={e=>setBrandFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Brand</option>
            {brands.map((b:any)=><option key={b} value={b}>{b}</option>)}
          </select>
          <MultiSelect label="SO..." options={sos} value={soF} onChange={setSoF}/>
          <MultiSelect label="Customer PO..." options={cps} value={cpF} onChange={setCpF}/>
          <select value={countryFilter} onChange={e=>setCountryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Country</option>
            {countries.map((c:any)=><option key={c} value={c}>{c}</option>)}
          </select>
          <MultiSelect label="Claim Dept" options={CLAIM_DEPTS} value={claimF} onChange={setClaimF}/>
        </div>
      </div>

      {/* ── Delay Reason Overview (below filters) ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReasonPanel rows={filtered} height={180} cur={curLabel}/>
        <LogisticsCostBar rows={filtered} cur={curLabel}/>
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
            <span className="text-xs font-medium" style={{color:"#fde8e8"}}>{filtered.length} SO(s)</span>
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
              <tr style={{background:"#c87070"}}>{["DOC NO","SO","STYLE","SUB","DESCRIPTION","CUSTOMER PO","BRAND","BU","STATUS","ORIG. DATE","PLAN DATE","QTY ORIG","QTY AIR","AIR RATE%",`EST. (${CUR})`,`ACTUAL (${CUR})`,"INV NO","HAWB NO","VAR%","FACTORY","COUNTRY","CLAIM DEPT","CLAIM %","REASON"].map(h=>
                <th key={h} style={{background:"#c87070"}} className="px-3 py-2 text-left whitespace-nowrap font-semibold text-[11px] tracking-wide text-white">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={24} className="text-center py-10 text-gray-400">Loading...</td></tr>}
              {!loading && filtered.map((row,i)=>{
                const ar = row.qtyOriginalShipment>0 ? row.qtyRequestAir/row.qtyOriginalShipment*100 : 0
                const vp = row.airFreight>0&&row.actualAirFreight>0 ? (row.actualAirFreight-row.airFreight)/row.airFreight*100 : null
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{row.request.documentNo}</td>
                    <td className="px-3 py-1.5 font-medium">{row.so}</td>
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
                    <td className="px-3 py-1.5 font-semibold">{row.qtyRequestAir}</td>
                    <td className="px-3 py-1.5">
                      <span className={`font-semibold ${ar>50?"text-red-600":ar>20?"text-amber-600":"text-green-600"}`}>
                        {ar.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-blue-700">{fmtNum(row.airFreight)}</td>
                    <td className="px-3 py-1.5 text-green-700 font-medium">{fmtNum(row.actualAirFreight)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{row.invoiceNo || "-"}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{row.hawbNo || "-"}</td>
                    <td className="px-3 py-1.5">
                      {vp!=null&&<span className={`font-medium ${vp>10?"text-red-600":vp<-10?"text-green-600":"text-gray-500"}`}>{fmtPct(vp)}</span>}
                    </td>
                    <td className="px-3 py-1.5">{row.factory || "-"}</td>
                    <td className="px-3 py-1.5">{row.country}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{(()=>{const sp=getSplits(row);return sp.length?sp.map((s:any)=>deptLabel(s.dept)).join(" · "):(row.claimDepartment||"-")})()}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{(()=>{const sp=getSplits(row);return sp.length?sp.map((s:any)=>s.pct!=null?`${s.pct}%`:"-").join(" · "):"-"})()}</td>
                    <td className="px-3 py-1.5 max-w-[220px]">{(()=>{const rs=[...new Set(getSplits(row).map((s:any)=>s.reason).filter(Boolean))];const txt=rs.length?rs.join(" · "):"-";return <span className="truncate block" title={txt}>{txt}</span>})()}</td>
                  </tr>
                )
              })}
              {!loading&&filtered.length===0&&<tr><td colSpan={24} className="text-center py-10 text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
