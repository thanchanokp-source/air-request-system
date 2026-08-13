import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const APPLY = process.argv.includes("apply")

// Split a claim reason of the form  "Delay Code (detail)"  ->  reason="Delay Code", detail="detail".
// Conservative: only a SINGLE trailing (...) with no nested parens, and only when detail is empty.
const re = /^(.+?)\s*\(([^()]+)\)\s*$/

const items = await p.airRequestItem.findMany({
  select: { id: true, so: true, claimDepts: true, request: { select: { documentNo: true } } },
})

let changed = 0, itemsChanged = 0
for (const it of items) {
  const splits = Array.isArray(it.claimDepts) ? it.claimDepts : []
  if (!splits.length) continue
  let touched = false
  const next = splits.map((s) => {
    const reason = String(s?.reason ?? "").trim()
    const curDetail = String(s?.detail ?? s?.reasonDetail ?? "").trim()
    if (!reason || curDetail) return s          // no reason, or detail already set -> skip
    const m = reason.match(re)
    if (!m) return s
    const code = m[1].trim(), det = m[2].trim()
    if (!code || !det) return s
    console.log(`${it.request?.documentNo} · SO ${it.so} · [${s.dept}]  "${reason}"  ->  reason="${code}" | detail="${det}"`)
    changed++; touched = true
    return { ...s, reason: code, detail: det, reasonDetail: det }
  })
  if (touched) {
    itemsChanged++
    if (APPLY) await p.airRequestItem.update({ where: { id: it.id }, data: { claimDepts: next } })
  }
}

console.log(`\n${APPLY ? "✅ APPLIED" : "👀 DRY RUN (ยังไม่แก้จริง)"}: ${changed} split ใน ${itemsChanged} รายการ`)
if (!APPLY) console.log("ถ้าดูแล้วโอเค รันซ้ำเพื่อแก้จริง:  node auto-split-reason.mjs apply")
await p.$disconnect()
