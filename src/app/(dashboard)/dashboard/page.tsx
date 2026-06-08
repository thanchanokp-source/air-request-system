"use client"
import { useEffect, useState, useMemo } from "react"
import * as XLSX from "xlsx"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts"
import { MultiSelect } from "@/components/ui/multi-select"

// ─── Colors (red pastel) ───────────────────────────────────────────────────
const C_EST  = "#f9c2c2"
const C_ACT  = "#e07878"
const C_ORIG = "#f5b8c8"
const C_AIR  = "#f0907a"
const C_RSN  = ["#e07878","#f0907a","#f9c2c2","#d96060","#f5b8c8","#c8a0a0"]
const C_PIE  = ["#e07878","#f0907a","#f9c2c2","#d96060","#f5b8c8","#e8a090","#fad0d0","#c89090","#dab0b0"]

// ─── Formatters ────────────────────────────────────────────────────────────
const fmtK  = (v: any) => { const n = Number(v); if (n>=1e6) return `${(n/1e6).toFixed(1)}M`; if (n>=1e3) return `${(n/1e3).toFixed(0)}K`; return String(Math.round(n)) }
const fmtNum = (v: any, dec = 0) => v != null ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dec }) : "0"
const fmtDate = (v: any) => { if (!v) return "-"; const d = new Date(v); if (isNaN(d.getTime())) return "-"; const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${String(d.getDate()).padStart(2,"0")}/${M[d.getMonth()]}/${d.getFullYear()}` }
const fmtMonth = (ym: string) => { const [y,m] = ym.split("-"); const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${M[parseInt(m)-1]} ${y.slice(2)}` }
const fmtPct = (v: number, sign = true) => isFinite(v) ? `${sign && v>0 ? "+" : ""}${v.toFixed(1)}%` : "-"

// ─── Constants ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ["PENDING_VP_MER","PENDING_SCM","PENDING_VP_SCM","PENDING_PRESIDENT","PENDING_LOGISTICS","PENDING_CLAIM","PENDING_VP_CLAIM","COMPLETED","REJECTED"]
const STATUS_LABELS: Record<string,string> = {
  PENDING_VP_MER:"VP MER", PENDING_SCM:"SCM", PENDING_VP_SCM:"VP SCM",
  PENDING_PRESIDENT:"President", PENDING_LOGISTICS:"Logistics",
  PENDING_CLAIM:"Claim", PENDING_VP_CLAIM:"VP Claim", COMPLETED:"Completed", REJECTED:"Rejected"
}
const CLAIM_DEPTS = ["COMMERCIAL","PROCUREMENT","NYK","NYG","PRODUCTION"]
const MONTH_OPTS = [
  {value:"01",label:"Jan"},{value:"02",label:"Feb"},{value:"03",label:"Mar"},{value:"04",label:"Apr"},
  {value:"05",label:"May"},{value:"06",label:"Jun"},{value:"07",label:"Jul"},{value:"08",label:"Aug"},
  {value:"09",label:"Sep"},{value:"10",label:"Oct"},{value:"11",label:"Nov"},{value:"12",label:"Dec"},
]

// ─── Chart Components ──────────────────────────────────────────────────────
function CostBar({ data, height=200, onBarClick, drillLabel, onBack }: {
  data:{name:string;est:number;actual:number}[]; height?:number
  onBarClick?:(n:string)=>void; drillLabel?:string; onBack?:()=>void
}) {
  const renderEstLabel = (props:any) => {
    const {x,y,width,value} = props
    if(!value) return null
    return <text x={x+width/2} y={y-5} textAnchor="middle" fill="#374151" fontSize={12} fontWeight="700">{fmtK(value)}</text>
  }
  const renderActualLabel = (props:any) => {
    const {x,y,width,value,index} = props
    if(!value) return null
    const est = data[index]?.est
    const valLabel = fmtK(value)
    if(!est) return <text x={x+width/2} y={y-5} textAnchor="middle" fill="#374151" fontSize={12} fontWeight="700">{valLabel}</text>
    const pct = (value-est)/est*100
    const arrow = pct>0?"↑":pct<0?"↓":"→"
    const pctColor = pct>0?"#ef4444":"#10b981"
    return <text x={x+width/2} y={y-5} textAnchor="middle" fill={pctColor} fontSize={12} fontWeight="700">{valLabel} ({arrow}{Math.abs(pct).toFixed(0)}%)</text>
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
            <XAxis dataKey="name" tick={{fontSize:13}} angle={-35} textAnchor="end" interval={0}/>
            <YAxis tick={{fontSize:13}} tickFormatter={fmtK} width={40}/>
            <Tooltip formatter={(v:any,n:any)=>[fmtNum(v),n]}/>
            <Bar dataKey="est" name="Est. (THB)" fill="#c05050" radius={[2,2,0,0]}
              cursor={onBarClick?"pointer":undefined} onClick={(d:any)=>onBarClick?.(d.name)}>
              <LabelList content={renderEstLabel}/>
            </Bar>
            <Bar dataKey="actual" name="Actual (THB)" fill="#f5c0c0" radius={[2,2,0,0]}
              cursor={onBarClick?"pointer":undefined} onClick={(d:any)=>onBarClick?.(d.name)}>
              <LabelList content={renderActualLabel}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 pt-1 pb-0.5">
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#c05050"}}/><span className="text-xs text-gray-600">Est. (THB)</span></div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#f5c0c0"}}/><span className="text-xs text-gray-600">Actual (THB)</span></div>
        </div>
      </>}
    </div>
  )
}

function QtyBar({ data, height=200 }: { data:{name:string;orig:number;air:number;airRate:number}[]; height?:number }) {
  const renderOrigLabel = (props:any) => {
    const {x,y,width,value} = props
    if(!value) return null
    return <text x={x+width/2} y={y-5} textAnchor="middle" fill="#374151" fontSize={12} fontWeight="700">{fmtNum(value)}</text>
  }
  const renderAirLabel = (props:any) => {
    const {x,y,width,value,index} = props
    if(!value) return null
    const rate = data[index]?.airRate ?? 0
    const rateColor = rate>50?"#ef4444":rate>20?"#f59e0b":"#10b981"
    const arrow = rate>50?"↑":rate>20?"→":""
    return <text x={x+width/2} y={y-5} textAnchor="middle" fill={rateColor} fontSize={12} fontWeight="700">{fmtNum(value)} ({arrow}{rate}%)</text>
  }
  return (
    <div className="bg-white rounded-xl border p-3">
      {data.length===0?<div className="flex items-center justify-center text-xs text-gray-300" style={{height}}>No data</div>:<>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{top:20,right:8,left:0,bottom:52}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="name" tick={{fontSize:13}} angle={-35} textAnchor="end" interval={0}/>
            <YAxis tick={{fontSize:13}} width={40}/>
            <Tooltip formatter={(v:any,n:any,p:any)=>{
              if(n==="QTY Air") return [`${fmtNum(v)} pcs — Air Rate: ${p?.payload?.airRate??0}%`,n]
              return [fmtNum(v)+" pcs",n]
            }}/>
            <Bar dataKey="orig" name="QTY Orig." fill="#c05070" radius={[2,2,0,0]}>
              <LabelList content={renderOrigLabel}/>
            </Bar>
            <Bar dataKey="air"  name="QTY Air"  fill="#f5c0c8" radius={[2,2,0,0]}>
              <LabelList content={renderAirLabel}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 pt-1 pb-0.5">
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#c05070"}}/><span className="text-xs text-gray-600">QTY Orig.</span></div>
          <div className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#f5c0c8"}}/><span className="text-xs text-gray-600">QTY Air</span></div>
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
          : <span className="text-[10px] text-gray-400">Click แท่งเพื่อ drill down</span>
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
                <XAxis dataKey="name" tick={{fontSize:13}} angle={-35} textAnchor="end" interval={0}/>
                <YAxis tick={{fontSize:13}} width={38} unit="d"/>
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

const gradRed = (n: number) => Array.from({length: n}, (_,i) => {
  const t = n <= 1 ? 0 : i / (n - 1)
  const r = Math.round(184 + (252-184)*t)
  const g = Math.round(48  + (228-48)*t)
  const b = Math.round(48  + (228-48)*t)
  return `rgb(${r},${g},${b})`
})

const gradRange = (n: number, dark: string, light: string) => {
  const px = (h: string) => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)] as [number,number,number]
  const [dr,dg,db]=px(dark), [lr,lg,lb]=px(light)
  return Array.from({length: n}, (_,i) => {
    const t = n <= 1 ? 0 : i / (n - 1)
    return `rgb(${Math.round(dr+(lr-dr)*t)},${Math.round(dg+(lg-dg)*t)},${Math.round(db+(lb-db)*t)})`
  })
}

function ReasonPanel({ rows, height=200 }: { rows:any[]; height?:number }) {
  const [mode, setMode] = useState<'count'|'cost'|'qty'>('count')
  const data = useMemo(()=>{
    const m:Record<string,{count:number;cost:number;qty:number}>={}
    rows.forEach(r=>{ const k=r.reasonDelay||"N/A"; if(!m[k])m[k]={count:0,cost:0,qty:0}; m[k].count++; m[k].cost+=r.actualAirFreight||0; m[k].qty+=Number(r.qtyRequestAir)||0 })
    return Object.entries(m).map(([name,v])=>({name,count:v.count,cost:Math.round(v.cost),qty:Math.round(v.qty)}))
      .sort((a,b)=>mode==='cost'?b.cost-a.cost:mode==='qty'?b.qty-a.qty:b.count-a.count)
  },[rows,mode])
  const total = data.reduce((s,d)=>s+(mode==='cost'?d.cost:mode==='qty'?d.qty:d.count),0)
  const barH = Math.max(height, data.length*30+80)
  const MODES:[string,string,string][] = [['count','SO Count','#e07878'],['cost','Actual Cost','#d96060'],['qty','Actual QTY','#f0907a']]
  return (
    <div className="bg-white rounded-xl border p-3">
      <p className="text-[11px] font-extrabold mb-2 uppercase tracking-wide" style={{color:"#6b1a1a"}}>DELAY REASON</p>
      <div className="flex gap-1 mb-3">
        {MODES.map(([m,label,color])=>(
          <button key={m} onClick={()=>setMode(m as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${mode===m?'text-white border-transparent':'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            style={mode===m?{background:color}:{}}>
            {label}
          </button>
        ))}
      </div>
      {data.length===0?<div className="flex items-center justify-center text-xs text-gray-300" style={{height}}>No data</div>
      : mode==='count'
        ? <div className="flex items-center gap-4">
            <div className="shrink-0 relative" style={{width:160,height:160}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.map(d=>({name:d.name,value:d.count}))} dataKey="value" cx="50%" cy="50%" outerRadius={72} innerRadius={42}>
                    {data.map((_,i)=><Cell key={i} fill={gradRed(data.length)[i]}/>)}
                  </Pie>
                  <Tooltip formatter={(v:any)=>[`${v} SO (${total>0?((v/total)*100).toFixed(1):0}%)`]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-gray-800 leading-none">{total}</span>
                <span className="text-[10px] font-medium text-gray-400 mt-0.5">Total SO</span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {data.map((d,i)=>(
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{background:gradRed(data.length)[i]}}/>
                  <span className="flex-1 truncate text-gray-700 font-medium" title={d.name}>{d.name}</span>
                  <span className="font-bold text-gray-800 shrink-0">{d.count}</span>
                  <span className="text-gray-400 w-10 text-right shrink-0 text-xs">{total>0?((d.count/total)*100).toFixed(0):0}%</span>
                </div>
              ))}
            </div>
          </div>
        : <ResponsiveContainer width="100%" height={barH}>
            <BarChart data={data} layout="vertical" margin={{top:4,right:48,left:4,bottom:8}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:12}} tickFormatter={mode==='cost'?fmtK:undefined} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:12}} width={100} interval={0}/>
              <Tooltip formatter={(v:any)=>mode==='cost'?[fmtNum(v)+' THB','Actual Cost']:[fmtNum(v)+' pcs','QTY Air']}/>
              <Bar dataKey={mode==='cost'?'cost':'qty'} fill={mode==='cost'?C_ACT:C_AIR} radius={[0,3,3,0]}>
                <LabelList dataKey={mode==='cost'?'cost':'qty'} position="right" style={{fontSize:11,fill:'#374151',fontWeight:600}} formatter={(v:any)=>mode==='cost'?fmtK(v):fmtNum(v)}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
      const k=r.reasonDelay||"N/A"; if(!m[k])m[k]={total:0,count:0}
      m[k].total+=days; m[k].count++
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

function LogisticsCostBar({ rows }: { rows:any[] }) {
  const data = useMemo(()=>{
    const m:Record<string,{cost:number;qty:number;soCount:number}>={}
    rows.forEach(r=>{
      const k=r.request?.brandName||"N/A"
      if(!m[k])m[k]={cost:0,qty:0,soCount:0}
      m[k].cost+=r.actualAirFreight||0
      m[k].qty+=Number(r.qtyRequestAir)||0
      m[k].soCount++
    })
    return Object.entries(m)
      .filter(([,v])=>v.qty>0)
      .map(([name,v])=>({name,costPerUnit:Math.round(v.cost/v.qty*100)/100,totalCost:Math.round(v.cost),totalQty:v.qty,soCount:v.soCount}))
      .sort((a,b)=>b.costPerUnit-a.costPerUnit)
  },[rows])

  const max = data[0]?.costPerUnit || 1

  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col">
      <p className="text-[11px] font-extrabold mb-1 uppercase tracking-wide" style={{color:"#6b1a1a"}}>LOGISTICS COST PER UNIT</p>
      <p className="text-[10px] text-gray-400 mb-2">Actual Air Freight ÷ QTY Air shipped</p>
      {data.length===0
        ?<div className="flex items-center justify-center text-xs text-gray-300 h-40">No data</div>
        :<div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1.5 px-2 text-gray-500 font-semibold text-[11px] w-1/2">BRAND</th>
                <th className="text-right py-1.5 px-2 text-gray-500 font-semibold text-[11px]">COST/PCS (THB)</th>
                <th className="text-right py-1.5 px-2 text-gray-500 font-semibold text-[11px]">TOTAL (THB)</th>
                <th className="text-right py-1.5 px-2 text-gray-500 font-semibold text-[11px]">QTY</th>
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
                    <td className="py-2 px-2 text-right font-bold" style={{color:"#a04020"}}>{fmtNum(d.costPerUnit,2)}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{fmtNum(d.totalCost)}</td>
                    <td className="py-2 px-2 text-right text-gray-500">{fmtNum(d.totalQty)}</td>
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

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
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

  const allSOs = useMemo(()=>requests.flatMap(r=>(r.items||[]).map((item:any)=>({...item,request:r}))), [requests])

  const filtered = useMemo(()=>allSOs.filter(row=>{
    const r = row.request
    const d = row.originalShipmentDate ? new Date(row.originalShipmentDate) : null
    const yr = d&&!isNaN(d.getTime()) ? String(d.getFullYear()) : ""
    const mo = d&&!isNaN(d.getTime()) ? String(d.getMonth()+1).padStart(2,"0") : ""
    return (!yearFilter  || yr===yearFilter) &&
           (!monthFilter.length || monthFilter.includes(mo)) &&
           (!statusFilter || (
             statusFilter==="PENDING"   ? (row.itemStatus !== "COMPLETED" && row.itemStatus !== "REJECTED") :
             statusFilter==="COMPLETED" ? row.itemStatus === "COMPLETED" :
             statusFilter==="REJECTED"  ? row.itemStatus === "REJECTED" : true
           )) &&
           (!brandFilter  || r.brandName===brandFilter) &&
           (!soF.length   || soF.includes(row.so)) &&
           (!cpF.length   || cpF.includes(row.customerPO)) &&
           (!portFilter   || row.port===portFilter) &&
           (!countryFilter|| row.country===countryFilter) &&
           (!claimF.length|| claimF.includes(row.claimDepartment))
  }), [allSOs,yearFilter,monthFilter,statusFilter,brandFilter,soF,cpF,portFilter,countryFilter,claimF])

  // ─── KPI ────────────────────────────────────────────────────────────────
  const totalSO    = filtered.length
  const totalQOrig = filtered.reduce((s,r)=>s+(Number(r.qtyOriginalShipment)||0),0)
  const totalQAir  = filtered.reduce((s,r)=>s+(Number(r.qtyRequestAir)||0),0)
  const totalEst   = filtered.reduce((s,r)=>s+(r.airFreight||0),0)
  const totalAct   = filtered.reduce((s,r)=>s+(r.actualAirFreight||0),0)
  const airRatePct = totalQOrig>0 ? totalQAir/totalQOrig*100 : 0
  const varPct     = totalEst>0 && totalAct>0 ? (totalAct-totalEst)/totalEst*100 : null
  const compDone   = filtered.filter(r=>r.itemStatus==="COMPLETED").length
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
    if(!r.originalShipmentDate) return "N/A"
    const d=new Date(r.originalShipmentDate); if(isNaN(d.getTime())) return "N/A"
    return fmtMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`)
  }
  const moSort = (r:any) => {
    if(!r.originalShipmentDate) return ""; const d=new Date(r.originalShipmentDate)
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

  const brandCost  = useMemo(()=>buildCost(filtered,r=>r.request.brandName),[filtered])
  const brandQty   = useMemo(()=>buildQty(filtered,r=>r.request.brandName),[filtered])
  const brandDelay = useMemo(()=>buildDelay(filtered,r=>r.request.brandName),[filtered])

  const cRows = (r:any) => drillCountry ? r.country===drillCountry : true
  const cKey  = (r:any) => drillCountry ? r.port : r.country
  const countryCost  = useMemo(()=>buildCost(filtered.filter(cRows),cKey),[filtered,drillCountry])
  const countryQty   = useMemo(()=>buildQty(filtered.filter(cRows),cKey),[filtered,drillCountry])
  const countryDelay = useMemo(()=>buildDelay(filtered.filter(cRows),cKey),[filtered,drillCountry])

  const buCost  = useMemo(()=>buildCost(filtered,r=>r.request.buName),[filtered])
  const buQty   = useMemo(()=>buildQty(filtered,r=>r.request.buName),[filtered])
  const buDelay = useMemo(()=>buildDelay(filtered,r=>r.request.buName),[filtered])

  const deptCost  = useMemo(()=>buildCost(filtered,r=>r.claimDepartment||"Unassigned"),[filtered])
  const deptQty   = useMemo(()=>buildQty(filtered,r=>r.claimDepartment||"Unassigned"),[filtered])
  const deptDelay = useMemo(()=>buildDelay(filtered,r=>r.claimDepartment||"Unassigned"),[filtered])

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
  const years    = useMemo(()=>[...new Set(allSOs.map(r=>r.originalShipmentDate?String(new Date(r.originalShipmentDate).getFullYear()):"").filter(Boolean))].sort().reverse(),[allSOs])
  const brands   = [...new Set(requests.map((r:any)=>r.brandName).filter(Boolean))].sort()
  const sos      = [...new Set(allSOs.map(r=>r.so).filter(Boolean))].sort()
  const cps      = [...new Set(allSOs.map(r=>r.customerPO).filter(Boolean))].sort()
  const ports    = [...new Set(allSOs.map(r=>r.port).filter(Boolean))].sort()
  const countries= [...new Set(allSOs.map(r=>r.country).filter(Boolean))].sort()
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
        "BRAND":          row.request.brandName,
        "BU":             row.request.buName,
        "ORIG. DATE":     fmtDate(row.originalShipmentDate),
        "PLAN DATE":      fmtDate(row.planShipmentDate),
        "QTY ORIG":       row.qtyOriginalShipment,
        "QTY AIR":        row.qtyRequestAir,
        "AIR RATE%":      Number(ar.toFixed(1)),
        "EST. (THB)":     row.airFreight ?? 0,
        "ACTUAL (THB)":   row.actualAirFreight ?? 0,
        "VAR%":           vp != null ? Number(vp.toFixed(1)) : "",
        "COUNTRY":        row.country,
        "PORT":           row.port,
        "FACTORY":        row.factory,
        "CLAIM DEPT":     row.claimDepartment ?? "",
        "DELAY REASON":   row.reasonDelay ?? "",
        "STATUS":         row.request.status,
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
      <h1 className="text-2xl font-bold text-gray-900">DASHBOARD</h1>

      {/* ── KPI ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
        {([
          ["TOTAL SO","SO",totalSO,"text-blue-700","bg-blue-50 border-blue-200",`${compDone} completed`],
          ["EST. AIRFREIGHT","THB",fmtK(totalEst),"text-sky-700","bg-sky-50 border-sky-200",`${fmtNum(totalEst)} THB`],
          ["ACTUAL AIRFREIGHT","THB",fmtK(totalAct),"text-teal-700","bg-teal-50 border-teal-200",`${fmtNum(totalAct)} THB`],
          ["ACTUAL vs EST","%",varPct!=null?(varPct>0?"↑":"↓")+Math.abs(varPct).toFixed(1)+"%":"N/A",varPct!=null&&varPct>0?"text-red-600":varPct!=null&&varPct<0?"text-green-600":"text-gray-400","bg-orange-50 border-orange-200",varPct!=null?`Variance ${fmtPct(varPct)}`:"Actual N/A"],
          ["QTY PLAN","pcs",fmtNum(totalQOrig),"text-purple-700","bg-purple-50 border-purple-200","Original shipment"],
          ["QTY SHIP AIR","pcs",fmtNum(totalQAir),"text-orange-700","bg-orange-50 border-orange-200","Requested air"],
          ["SHIP RATE","%",fmtPct(airRatePct,false),"text-indigo-700","bg-indigo-50 border-indigo-200",`Air vs Plan qty`],
        ] as [string,string,any,string,string,string][]).map(([label,unit,value,tc,bg,sub])=>(
          <div key={label} className={`${bg} border rounded-xl p-4`}>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
            <p className={`text-3xl font-extrabold ${tc} mt-1 leading-none`}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

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
          <select value={portFilter} onChange={e=>setPortFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Port</option>
            {ports.map((p:any)=><option key={p} value={p}>{p}</option>)}
          </select>
          <select value={countryFilter} onChange={e=>setCountryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All Country</option>
            {countries.map((c:any)=><option key={c} value={c}>{c}</option>)}
          </select>
          <MultiSelect label="Claim Dept" options={CLAIM_DEPTS} value={claimF} onChange={setClaimF}/>
        </div>
      </div>

      {/* ── Delay Reason Overview (below filters) ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReasonPanel rows={filtered} height={180}/>
        <LogisticsCostBar rows={filtered}/>
      </div>

      {/* ── Column Headers ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="text-center text-[11px] font-bold text-white rounded-lg py-2 tracking-wide" style={{background:"#6b1a1a"}}>EST vs ACTUAL AIR FREIGHT (THB)</div>
        <div className="text-center text-[11px] font-bold text-white rounded-lg py-2 tracking-wide" style={{background:"#6b1a1a"}}>QTY ORIGINAL vs QTY AIR (pcs)</div>
        <div className="text-center text-[11px] font-bold text-white rounded-lg py-2 tracking-wide" style={{background:"#6b1a1a"}}>AVG DELAY DAYS (Plan − Original)</div>
      </div>

      {/* ── Row 1: By Ship Month ─────────────────────────────────────────── */}
      <SectionRow label="By Ship Month"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CostBar  data={monthlyCost}  height={H}/>
        <QtyBar   data={monthlyQty}   height={H}/>
        <DelayBar data={monthlyDelay} rows={filtered} groupFn={moKey} height={H}/>
      </div>

      {/* ── Row 2: By Brand ─────────────────────────────────────────────── */}
      <SectionRow label="By Brand"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CostBar  data={brandCost}  height={H}/>
        <QtyBar   data={brandQty}   height={H}/>
        <DelayBar data={brandDelay} rows={filtered} groupFn={(r:any)=>r.request?.brandName||"N/A"} height={H}/>
      </div>

      {/* ── Row 3: By Country → Port ─────────────────────────────────────── */}
      <SectionRow label={drillCountry ? `By Port — ${drillCountry}` : "By Country → Port"}/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CostBar data={countryCost} height={H}
          drillLabel={drillCountry||undefined}
          onBarClick={!drillCountry?(name)=>setDrillCountry(name):undefined}
          onBack={drillCountry?()=>setDrillCountry(null):undefined}/>
        <QtyBar   data={countryQty}   height={H}/>
        <DelayBar data={countryDelay} rows={filtered.filter(cRows)} groupFn={cKey} height={H}/>
      </div>

      {/* ── Row 4: By BU ────────────────────────────────────────────────── */}
      <SectionRow label="By BU"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CostBar  data={buCost}  height={H}/>
        <QtyBar   data={buQty}   height={H}/>
        <DelayBar data={buDelay} rows={filtered} groupFn={(r:any)=>r.request?.buName||"N/A"} height={H}/>
      </div>

      {/* ── Row 5: By Claim Dept ─────────────────────────────────────────── */}
      <SectionRow label="By Claim Dept"/>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CostBar  data={deptCost}  height={H}/>
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{background:"#c87070"}}>{["DOC NO","SO","STYLE","BRAND","BU","ORIG. DATE","QTY ORIG","QTY AIR","AIR RATE%","EST. (THB)","ACTUAL (THB)","VAR%","COUNTRY","PORT","CLAIM DEPT","DELAY REASON"].map(h=>
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-semibold text-[11px] tracking-wide text-white">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={16} className="text-center py-10 text-gray-400">Loading...</td></tr>}
              {!loading && filtered.map((row,i)=>{
                const ar = row.qtyOriginalShipment>0 ? row.qtyRequestAir/row.qtyOriginalShipment*100 : 0
                const vp = row.airFreight>0&&row.actualAirFreight>0 ? (row.actualAirFreight-row.airFreight)/row.airFreight*100 : null
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{row.request.documentNo}</td>
                    <td className="px-3 py-1.5 font-medium">{row.so}</td>
                    <td className="px-3 py-1.5">{row.style}</td>
                    <td className="px-3 py-1.5">{row.request.brandName}</td>
                    <td className="px-3 py-1.5">{row.request.buName}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(row.originalShipmentDate)}</td>
                    <td className="px-3 py-1.5">{row.qtyOriginalShipment}</td>
                    <td className="px-3 py-1.5 font-semibold">{row.qtyRequestAir}</td>
                    <td className="px-3 py-1.5">
                      <span className={`font-semibold ${ar>50?"text-red-600":ar>20?"text-amber-600":"text-green-600"}`}>
                        {ar.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-blue-700">{fmtNum(row.airFreight)}</td>
                    <td className="px-3 py-1.5 text-green-700 font-medium">{fmtNum(row.actualAirFreight)}</td>
                    <td className="px-3 py-1.5">
                      {vp!=null&&<span className={`font-medium ${vp>10?"text-red-600":vp<-10?"text-green-600":"text-gray-500"}`}>{fmtPct(vp)}</span>}
                    </td>
                    <td className="px-3 py-1.5">{row.country}</td>
                    <td className="px-3 py-1.5">{row.port}</td>
                    <td className="px-3 py-1.5">{row.claimDepartment||"-"}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate" title={row.reasonDelay}>{row.reasonDelay||"-"}</td>
                  </tr>
                )
              })}
              {!loading&&filtered.length===0&&<tr><td colSpan={16} className="text-center py-10 text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
