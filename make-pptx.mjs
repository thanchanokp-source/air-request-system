import pptxgen from "pptxgenjs"

const prs = new pptxgen()
prs.layout = "LAYOUT_WIDE"

const C = {
  navy:    "1E3A8A",
  blue:    "3B82F6",
  green:   "059669",
  emerald: "047857",
  amber:   "D97706",
  purple:  "7C3AED",
  indigo:  "4338CA",
  gray:    "6B7280",
  white:   "FFFFFF",
  bg:      "F0F4FF",
}

const LIGHT = {
  "1E3A8A": "DBEAFE",
  "3B82F6": "DBEAFE",
  "059669": "DCFCE7",
  "047857": "D1FAE5",
  "D97706": "FEF3C7",
  "7C3AED": "EDE9FE",
  "4338CA": "E0E7FF",
  "6B7280": "F3F4F6",
  "7C2D12": "FEE2E2",
  "0F766E": "CCFBF1",
  "065F46": "D1FAE5",
}
const lt = (c) => LIGHT[c] || "F3F4F6"

function txt(s, text, o) {
  s.addText(text, {
    x:o.x, y:o.y, w:o.w, h:o.h||0.4, fontSize:o.size||13,
    bold:o.bold||false, color:o.color||"222222",
    align:o.align||"left", valign:o.valign||"middle",
    fontFace:"Calibri", wrap:true,
  })
}

// ── SLIDE 1 — Title ──────────────────────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: C.navy }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.18, fill:{color:C.blue} })
  s.addShape(prs.ShapeType.rect, { x:0, y:7.32, w:13.33, h:0.18, fill:{color:C.blue} })

  txt(s, "Air Request System", { x:1.5, y:1.8, w:10.33, h:1.0, size:42, bold:true, color:C.white, align:"center" })
  txt(s, "Approval Flow", { x:1.5, y:2.85, w:10.33, h:0.7, size:36, color:"93C5FD", align:"center" })
  txt(s, "Nan Yang Textile  ·  Approval Process Overview", { x:1.5, y:3.7, w:10.33, h:0.5, size:16, color:"BFDBFE", align:"center" })

  ;[
    { label:"NYG Flow", color:C.blue,    x:3.5 },
    { label:"GW Flow",  color:C.emerald, x:6.83 },
  ].forEach(c => {
    s.addShape(prs.ShapeType.roundRect, { x:c.x, y:4.6, w:2.3, h:0.55, fill:{color:c.color}, rectRadius:0.28 })
    txt(s, c.label, { x:c.x, y:4.6, w:2.3, h:0.55, size:15, bold:true, color:C.white, align:"center" })
  })
}

// ── SLIDE 2 — NYG Overview ───────────────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: C.bg }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.82, fill:{color:C.navy} })
  txt(s, "NYG Approval Flow — Overview", { x:0.4, y:0, w:12, h:0.82, size:22, bold:true, color:C.white })

  const steps = [
    { n:"1", role:"MER USER",    action:"Create Request",          color:C.blue,   status:"PENDING_VP_MER" },
    { n:"2", role:"VP MER",      action:"Approve by Style",        color:C.indigo, status:"PENDING_SCM" },
    { n:"3", role:"SCM USER",    action:"Assign Claim Dept / SO",  color:C.amber,  status:"PENDING_SCM" },
    { n:"4", role:"VP SCM",      action:"Approve by Style",        color:C.purple, status:"PENDING_PRESIDENT" },
    { n:"5", role:"PRESIDENT",   action:"Approve by Style",        color:"7C2D12", status:"PENDING_LOGISTICS" },
    { n:"6", role:"LOGISTICS",   action:"Enter Invoice / Booking", color:C.green,  status:"PENDING_CLAIM" },
    { n:"7", role:"DVM (Claim)", action:"Approve per SO",          color:"0F766E", status:"PENDING_VP_CLAIM" },
    { n:"8", role:"VP CLAIM",    action:"Final Approve per SO",    color:C.navy,   status:"COMPLETED" },
  ]

  const bw=2.8, bh=1.35, px=3.23, py=1.75
  steps.forEach((st, i) => {
    const col=i%4, row=Math.floor(i/4)
    const x=0.4+col*px, y=1.05+row*py
    s.addShape(prs.ShapeType.roundRect, { x, y, w:bw, h:bh, fill:{color:C.white}, line:{color:st.color, width:2}, rectRadius:0.12 })
    s.addShape(prs.ShapeType.roundRect, { x, y, w:0.18, h:bh, fill:{color:st.color}, rectRadius:0.09 })
    s.addShape(prs.ShapeType.ellipse, { x:x+0.22, y:y+0.1, w:0.42, h:0.42, fill:{color:st.color} })
    txt(s, st.n, { x:x+0.22, y:y+0.1, w:0.42, h:0.42, size:13, bold:true, color:C.white, align:"center" })
    txt(s, st.role,   { x:x+0.7, y:y+0.08, w:2.0, h:0.38, size:11, bold:true, color:st.color })
    txt(s, st.action, { x:x+0.7, y:y+0.44, w:2.0, h:0.4,  size:10, color:"333333" })
    s.addShape(prs.ShapeType.roundRect, { x:x+0.22, y:y+0.9, w:bw-0.44, h:0.3, fill:{color:lt(st.color)}, rectRadius:0.08 })
    txt(s, "→ "+st.status, { x:x+0.22, y:y+0.9, w:bw-0.44, h:0.3, size:8, color:st.color, align:"center" })
  })

  s.addShape(prs.ShapeType.roundRect, { x:0.4, y:6.8, w:12.5, h:0.42, fill:{color:"FEF3C7"}, line:{color:C.amber, width:1}, rectRadius:0.08 })
  txt(s, "★  Partial Forwarding: SCM สามารถ forward ทีละ style ได้ — VP SCM และ PRESIDENT อนุมัติได้ทันทีที่แต่ละ style พร้อม", { x:0.6, y:6.8, w:12.2, h:0.42, size:10, color:"92400E" })
}

// ── SLIDE 3 — NYG Step 1–3 ───────────────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: C.bg }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.82, fill:{color:C.navy} })
  txt(s, "NYG Flow — Step 1–3: Create → VP MER → SCM", { x:0.4, y:0, w:12, h:0.82, size:20, bold:true, color:C.white })

  const cards = [
    { step:"Step 1", role:"MER USER", color:C.blue,
      items:["กรอก Request ใหม่ (New Request)","ระบุ Brand / Style / SO / Qty / Date","แนบ Template Excel (.xlsx)","ส่งให้ VP MER พิจารณา"], status:"→ PENDING_VP_MER" },
    { step:"Step 2", role:"VP MER", color:C.indigo,
      items:["เห็น Request ใน APPROVALS","Approve / Reject แยกตาม Style","สามารถ Reject บาง Style ได้","เมื่อ Approve ทุก Style → ส่งไป SCM"], status:"→ PENDING_SCM" },
    { step:"Step 3", role:"SCM USER", color:C.amber,
      items:["เห็น SO ที่ VP MER อนุมัติแล้ว","กำหนด Claim Dept ให้แต่ละ SO","ใส่ Reason Delay (ถ้ามี)","Partial Forward ได้ (ทีละ style)","VP SCM จะ Approve style ที่ forward แล้ว"], status:"→ VP SCM อนุมัติ" },
  ]
  cards.forEach((c, i) => {
    const x=0.4+i*4.3
    s.addShape(prs.ShapeType.roundRect, { x, y:1.0, w:4.1, h:5.5, fill:{color:C.white}, line:{color:c.color, width:2.5}, rectRadius:0.15 })
    s.addShape(prs.ShapeType.roundRect, { x, y:1.0, w:4.1, h:0.62, fill:{color:c.color}, rectRadius:0.15 })
    txt(s, c.step+"  "+c.role, { x:x+0.15, y:1.0, w:3.8, h:0.62, size:14, bold:true, color:C.white })
    c.items.forEach((item, j) => {
      s.addShape(prs.ShapeType.ellipse, { x:x+0.22, y:1.82+j*0.72, w:0.2, h:0.2, fill:{color:c.color} })
      txt(s, item, { x:x+0.5, y:1.75+j*0.72, w:3.45, h:0.58, size:11, color:"333333" })
    })
    s.addShape(prs.ShapeType.roundRect, { x:x+0.2, y:5.85, w:3.7, h:0.52, fill:{color:lt(c.color)}, line:{color:c.color, width:1}, rectRadius:0.1 })
    txt(s, c.status, { x:x+0.2, y:5.85, w:3.7, h:0.52, size:11, bold:true, color:c.color, align:"center" })
  })
}

// ── SLIDE 4 — NYG Step 4–6 ───────────────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: C.bg }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.82, fill:{color:C.navy} })
  txt(s, "NYG Flow — Step 4–6: VP SCM → President → Logistics", { x:0.4, y:0, w:12, h:0.82, size:20, bold:true, color:C.white })

  const cards = [
    { step:"Step 4", role:"VP SCM", color:C.purple,
      items:["เห็น Style ที่ SCM forward แล้ว","Approve / Reject แยกตาม Style","Back to SCM ได้ถ้าข้อมูลไม่ครบ","เมื่อ Approve ทุก Style → PRESIDENT"], status:"→ PENDING_PRESIDENT" },
    { step:"Step 5", role:"PRESIDENT", color:"7C2D12",
      items:["เห็น Style ที่ VP SCM อนุมัติแล้ว","Approve / Reject แยกตาม Style","Back to SCM ได้ถ้าต้องการ","เมื่อ Approve ทุก Style → LOGISTICS"], status:"→ PENDING_LOGISTICS" },
    { step:"Step 6", role:"LOGISTICS", color:C.green,
      items:["ใส่ Invoice No / Booking Date","ใส่ Actual Air Freight (THB)","Confirm ทีละ SO (Partial ได้)","PDF Booking + Logistics File พร้อม Download"], status:"→ PENDING_CLAIM" },
  ]
  cards.forEach((c, i) => {
    const x=0.4+i*4.3
    s.addShape(prs.ShapeType.roundRect, { x, y:1.0, w:4.1, h:5.5, fill:{color:C.white}, line:{color:c.color, width:2.5}, rectRadius:0.15 })
    s.addShape(prs.ShapeType.roundRect, { x, y:1.0, w:4.1, h:0.62, fill:{color:c.color}, rectRadius:0.15 })
    txt(s, c.step+"  "+c.role, { x:x+0.15, y:1.0, w:3.8, h:0.62, size:14, bold:true, color:C.white })
    c.items.forEach((item, j) => {
      s.addShape(prs.ShapeType.ellipse, { x:x+0.22, y:1.82+j*0.72, w:0.2, h:0.2, fill:{color:c.color} })
      txt(s, item, { x:x+0.5, y:1.75+j*0.72, w:3.45, h:0.58, size:11, color:"333333" })
    })
    s.addShape(prs.ShapeType.roundRect, { x:x+0.2, y:5.85, w:3.7, h:0.52, fill:{color:lt(c.color)}, line:{color:c.color, width:1}, rectRadius:0.1 })
    txt(s, c.status, { x:x+0.2, y:5.85, w:3.7, h:0.52, size:11, bold:true, color:c.color, align:"center" })
  })
}

// ── SLIDE 5 — NYG Step 7–8 ───────────────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: C.bg }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.82, fill:{color:C.navy} })
  txt(s, "NYG Flow — Step 7–8: Claim → VP Claim → COMPLETED", { x:0.4, y:0, w:12, h:0.82, size:20, bold:true, color:C.white })

  const cards = [
    { step:"Step 7", role:"DVM / CLAIM", color:"0F766E",
      items:["เห็น SO ที่ LOGISTICS forward แล้ว","Claim Dept ตรงกับที่ SCM กำหนด","Approve / Reject แยกตาม SO","มีระบบ Priority (P1 ต้องอนุมัติก่อน P2)","เมื่อทุก Priority อนุมัติ → VP CLAIM"], status:"→ PENDING_VP_CLAIM" },
    { step:"Step 8", role:"VP CLAIM", color:C.navy,
      items:["เห็น SO ที่ DVM อนุมัติครบแล้ว","Approve / Reject แยกตาม SO","มีระบบ Priority เช่นกัน","เมื่อทุก Priority VP อนุมัติ → COMPLETED","PDF Final File พร้อม Download"], status:"→ COMPLETED ✓" },
  ]
  cards.forEach((c, i) => {
    const x=1.5+i*5.3
    s.addShape(prs.ShapeType.roundRect, { x, y:1.0, w:5.0, h:5.6, fill:{color:C.white}, line:{color:c.color, width:2.5}, rectRadius:0.15 })
    s.addShape(prs.ShapeType.roundRect, { x, y:1.0, w:5.0, h:0.62, fill:{color:c.color}, rectRadius:0.15 })
    txt(s, c.step+"  "+c.role, { x:x+0.15, y:1.0, w:4.7, h:0.62, size:14, bold:true, color:C.white })
    c.items.forEach((item, j) => {
      s.addShape(prs.ShapeType.ellipse, { x:x+0.22, y:1.82+j*0.72, w:0.2, h:0.2, fill:{color:c.color} })
      txt(s, item, { x:x+0.5, y:1.75+j*0.72, w:4.3, h:0.58, size:11, color:"333333" })
    })
    s.addShape(prs.ShapeType.roundRect, { x:x+0.2, y:5.88, w:4.6, h:0.52, fill:{color:lt(c.color)}, line:{color:c.color, width:1}, rectRadius:0.1 })
    txt(s, c.status, { x:x+0.2, y:5.88, w:4.6, h:0.52, size:11, bold:true, color:c.color, align:"center" })
  })

  s.addShape(prs.ShapeType.roundRect, { x:0.3, y:6.82, w:12.73, h:0.44, fill:{color:"ECFDF5"}, line:{color:"0F766E", width:1}, rectRadius:0.1 })
  txt(s, "Claim Departments: COMMERCIAL  ·  PROCUREMENT  ·  NYK  ·  NYG  ·  PRODUCTION", { x:0.5, y:6.82, w:12.33, h:0.44, size:11, color:"065F46", align:"center" })
}

// ── SLIDE 6 — GW Overview ────────────────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: "F0FDF4" }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.82, fill:{color:C.emerald} })
  txt(s, "GW Approval Flow — Overview", { x:0.4, y:0, w:12, h:0.82, size:22, bold:true, color:C.white })

  const steps = [
    { n:"1", role:"MER GW",       action:"Create Request",                   color:C.green,   status:"PENDING_VP_MER_GW" },
    { n:"2", role:"VP MER GW",    action:"Approve by Style",                 color:"065F46",  status:"PENDING_PRESIDENT_GW" },
    { n:"3", role:"PRESIDENT GW", action:"Approve by Style",                 color:"7C2D12",  status:"PENDING_LOGISTICS_GW" },
    { n:"4", role:"LOGISTICS GW", action:"Enter Invoice\n+ Select Claim Dept", color:C.blue,  status:"PENDING_CLAIM_GW" },
    { n:"5", role:"CLAIM GW",     action:"Approve per SO\n(Batch Select)",   color:C.emerald, status:"COMPLETED" },
  ]

  const bw=2.2, bh=3.8
  const startX=(13.33-(steps.length*bw+(steps.length-1)*0.22))/2
  steps.forEach((st, i) => {
    const x=startX+i*(bw+0.22), y=1.3
    s.addShape(prs.ShapeType.roundRect, { x, y, w:bw, h:bh, fill:{color:C.white}, line:{color:st.color, width:2.5}, rectRadius:0.14 })
    s.addShape(prs.ShapeType.ellipse, { x:x+bw/2-0.3, y:y+0.14, w:0.6, h:0.6, fill:{color:st.color} })
    txt(s, st.n, { x:x+bw/2-0.3, y:y+0.14, w:0.6, h:0.6, size:18, bold:true, color:C.white, align:"center" })
    txt(s, st.role,   { x:x+0.1, y:y+0.86, w:bw-0.2, h:0.52, size:11, bold:true, color:st.color, align:"center" })
    txt(s, st.action, { x:x+0.1, y:y+1.44, w:bw-0.2, h:0.75, size:10, color:"333333", align:"center" })
    s.addShape(prs.ShapeType.roundRect, { x:x+0.1, y:y+2.95, w:bw-0.2, h:0.7, fill:{color:lt(st.color)}, line:{color:st.color, width:1}, rectRadius:0.08 })
    txt(s, st.status, { x:x+0.1, y:y+2.95, w:bw-0.2, h:0.7, size:8.5, bold:true, color:st.color, align:"center" })
    if (i < steps.length-1) {
      s.addShape(prs.ShapeType.line, { x:x+bw+0.02, y:y+bh/2, w:0.18, h:0, line:{color:C.gray, width:2, endArrowType:"triangle"} })
    }
  })

  s.addShape(prs.ShapeType.roundRect, { x:0.5, y:5.45, w:12.33, h:1.72, fill:{color:"ECFDF5"}, line:{color:C.emerald, width:1.5}, rectRadius:0.12 })
  txt(s, "GW vs NYG — ความแตกต่างหลัก", { x:0.8, y:5.5, w:11.7, h:0.4, size:13, bold:true, color:C.emerald })
  ;[
    "✦  ไม่มีขั้นตอน SCM / VP SCM — ลดขั้นตอนได้ 2 ขั้น",
    "✦  LOGISTICS GW เป็นผู้เลือก Claim Dept (ไม่ใช่ SCM)",
    "✦  CLAIM GW สามารถ Batch Approve หลาย SO พร้อมกันได้",
    "✦  ไม่มี VP CLAIM — CLAIM GW อนุมัติแล้วจบ COMPLETED ทันที",
  ].forEach((d, i) => txt(s, d, { x:0.8, y:5.96+i*0.27, w:11.7, h:0.28, size:10, color:"065F46" }))
}

// ── SLIDE 7 — GW Step Detail ─────────────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: "F0FDF4" }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.82, fill:{color:C.emerald} })
  txt(s, "GW Flow — Step Detail", { x:0.4, y:0, w:12, h:0.82, size:22, bold:true, color:C.white })

  const cards = [
    { step:"Step 1–2", role:"MER GW  →  VP MER GW", color:C.green,
      items:["MER GW สร้าง Request ใหม่","VP MER GW Approve / Reject แยก Style","เมื่อ Approve ครบ → PRESIDENT GW"] },
    { step:"Step 3", role:"PRESIDENT GW", color:"7C2D12",
      items:["Approve / Reject แยกตาม Style","เมื่อ Approve ครบ → LOGISTICS GW","PDF Booking File พร้อม Download"] },
    { step:"Step 4", role:"LOGISTICS GW", color:C.blue,
      items:["ใส่ Invoice No / Booking Date","ใส่ Actual Air Freight (THB)","เลือก Claim Dept (Supplier ใน/นอก/NYK)","Confirm ทีละ SO (Partial ได้)"] },
    { step:"Step 5", role:"CLAIM GW", color:C.emerald,
      items:["เห็นเฉพาะ Request ของ Claim Dept ตัวเอง","Batch Approve: Checkbox หลาย SO พร้อมกัน","Approve / Reject ทีละ SO ก็ได้","เมื่อ Approve ทุก SO → COMPLETED ✓"] },
  ]
  cards.forEach((c, i) => {
    const col=i%2, row=Math.floor(i/2)
    const x=0.4+col*6.5, y=1.0+row*3.15
    s.addShape(prs.ShapeType.roundRect, { x, y, w:6.1, h:2.9, fill:{color:C.white}, line:{color:c.color, width:2}, rectRadius:0.14 })
    s.addShape(prs.ShapeType.roundRect, { x, y, w:6.1, h:0.58, fill:{color:c.color}, rectRadius:0.14 })
    txt(s, c.step+"   "+c.role, { x:x+0.15, y, w:5.8, h:0.58, size:12, bold:true, color:C.white })
    c.items.forEach((item, j) => {
      s.addShape(prs.ShapeType.ellipse, { x:x+0.22, y:y+0.75+j*0.55, w:0.18, h:0.18, fill:{color:c.color} })
      txt(s, item, { x:x+0.5, y:y+0.68+j*0.55, w:5.45, h:0.5, size:10.5, color:"222222" })
    })
  })
}

// ── SLIDE 8 — Item Status + Files ───────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: C.bg }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.82, fill:{color:C.navy} })
  txt(s, "Item Status Flow (SO Level) & PDF Files", { x:0.4, y:0, w:12, h:0.82, size:20, bold:true, color:C.white })

  txt(s, "NYG", { x:0.3, y:1.0, w:0.7, h:0.38, size:12, bold:true, color:C.navy })
  const nygSt = [
    {s:"PENDING",c:C.gray},{s:"VP MER\nPASSED",c:C.indigo},{s:"PASSED",c:C.amber},
    {s:"VP\nPASSED",c:C.purple},{s:"PRES\nPASSED",c:"7C2D12"},{s:"LOG\nPASSED",c:C.green},
    {s:"CLAIM\nPASSED",c:"0F766E"},{s:"COMPLETED",c:C.navy},
  ]
  const bw2=1.38, gap=0.12
  nygSt.forEach((st, i) => {
    const x=0.3+i*(bw2+gap)
    s.addShape(prs.ShapeType.roundRect, { x, y:1.45, w:bw2, h:0.88, fill:{color:st.c}, rectRadius:0.1 })
    txt(s, st.s, { x, y:1.45, w:bw2, h:0.88, size:9, bold:true, color:C.white, align:"center" })
    if (i<nygSt.length-1) s.addShape(prs.ShapeType.line, { x:x+bw2, y:1.89, w:gap, h:0, line:{color:"AAAAAA", width:2, endArrowType:"triangle"} })
  })

  txt(s, "GW", { x:0.3, y:2.68, w:0.7, h:0.38, size:12, bold:true, color:C.emerald })
  const gwSt = [{s:"PENDING",c:C.gray},{s:"PRES PASSED",c:"7C2D12"},{s:"LOG PASSED",c:C.blue},{s:"COMPLETED",c:C.emerald}]
  const bw3=2.5, gap3=0.4
  gwSt.forEach((st, i) => {
    const x=0.3+i*(bw3+gap3)
    s.addShape(prs.ShapeType.roundRect, { x, y:3.1, w:bw3, h:0.7, fill:{color:st.c}, rectRadius:0.1 })
    txt(s, st.s, { x, y:3.1, w:bw3, h:0.7, size:11, bold:true, color:C.white, align:"center" })
    if (i<gwSt.length-1) s.addShape(prs.ShapeType.line, { x:x+bw3, y:3.45, w:gap3, h:0, line:{color:"AAAAAA", width:2, endArrowType:"triangle"} })
  })

  txt(s, "PDF Files ที่แต่ละขั้นตอน", { x:0.3, y:4.1, w:12.7, h:0.42, size:13, bold:true, color:C.navy })
  const cX=[0.3,2.55,7.6], cW=[2.2,5.0,5.0]
  ;["FILE","NYG","GW"].forEach((h, i) => {
    s.addShape(prs.ShapeType.rect, { x:cX[i], y:4.6, w:cW[i], h:0.36, fill:{color:C.navy} })
    txt(s, h, { x:cX[i]+0.05, y:4.6, w:cW[i]-0.1, h:0.36, size:11, bold:true, color:C.white, align:"center" })
  })
  ;[
    {col:"BOOKING FILE", nyg:"หลัง President Approve (PRES_PASSED+)", gw:"หลัง President GW Approve (PRES_PASSED+)"},
    {col:"LOGISTICS FILE", nyg:"หลัง Logistics Enter Invoice (LOG_PASSED+)", gw:"หลัง Logistics GW Confirm (LOG_PASSED+)"},
    {col:"FINAL FILE", nyg:"หลัง VP CLAIM Approve (COMPLETED)", gw:"หลัง CLAIM GW Approve (COMPLETED)"},
  ].forEach((row, r) => {
    const bg=r%2===0?C.white:"F0F8FF"
    ;[row.col,row.nyg,row.gw].forEach((v, i) => {
      s.addShape(prs.ShapeType.rect, { x:cX[i], y:4.98+r*0.5, w:cW[i], h:0.5, fill:{color:bg}, line:{color:"E5E7EB", width:0.5} })
      txt(s, v, { x:cX[i]+0.08, y:4.98+r*0.5, w:cW[i]-0.16, h:0.5, size:10, color:i===0?"1E40AF":"333333", bold:i===0 })
    })
  })
}

// ── SLIDE 9 — Comparison Table ───────────────────────────────
{
  const s = prs.addSlide()
  s.background = { color: C.bg }
  s.addShape(prs.ShapeType.rect, { x:0, y:0, w:13.33, h:0.82, fill:{color:C.navy} })
  txt(s, "NYG vs GW — เปรียบเทียบสรุป", { x:0.4, y:0, w:12, h:0.82, size:22, bold:true, color:C.white })

  const rows = [
    {label:"จำนวนขั้นตอน",        nyg:"8 ขั้นตอน",     gw:"5 ขั้นตอน"},
    {label:"ผู้กำหนด Claim Dept", nyg:"SCM USER",       gw:"LOGISTICS GW"},
    {label:"VP SCM",              nyg:"มี ✓",            gw:"ไม่มี ✗"},
    {label:"PRESIDENT",           nyg:"มี ✓",            gw:"มี ✓"},
    {label:"VP CLAIM",            nyg:"มี ✓",            gw:"ไม่มี ✗"},
    {label:"Batch Approve",       nyg:"ไม่มี",           gw:"มี ✓ (CLAIM GW)"},
    {label:"Partial Forwarding",  nyg:"มี ✓ (SCM)",      gw:"มี ✓ (LOGISTICS GW)"},
    {label:"SCM FILE",            nyg:"มี ✓",            gw:"ไม่มี ✗"},
  ]
  const cX=[0.5,4.7,9.1], cW=[3.8,4.0,4.0]
  ;["รายการ","NYG","GW"].forEach((h, i) => {
    s.addShape(prs.ShapeType.rect, { x:cX[i], y:1.0, w:cW[i], h:0.48, fill:{color:[C.navy,C.blue,C.emerald][i]} })
    txt(s, h, { x:cX[i]+0.1, y:1.0, w:cW[i]-0.2, h:0.48, size:13, bold:true, color:C.white, align:"center" })
  })
  rows.forEach((row, r) => {
    const bg=r%2===0?C.white:"EFF6FF"
    const nygC = row.nyg.includes("✓")?"1D4ED8":row.nyg.includes("✗")?"DC2626":"333333"
    const gwC  = row.gw.includes("✓") ?"065F46":row.gw.includes("✗") ?"DC2626":"333333"
    ;[row.label,row.nyg,row.gw].forEach((v, i) => {
      s.addShape(prs.ShapeType.rect, { x:cX[i], y:1.5+r*0.58, w:cW[i], h:0.58, fill:{color:bg}, line:{color:"E5E7EB", width:0.5} })
      txt(s, v, { x:cX[i]+0.1, y:1.5+r*0.58, w:cW[i]-0.2, h:0.58, size:11, bold:i===0, color:["333333",nygC,gwC][i]||"333333", align:i===0?"left":"center" })
    })
  })
}

await prs.writeFile({ fileName: "C:/Projects/air-request-system/AirRequest-Flow-Presentation.pptx" })
console.log("Done!")
