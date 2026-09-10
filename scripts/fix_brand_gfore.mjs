import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()

// SOs whose brand was uploaded as PETER MILLAR but should be G/FORE.
const SOS = ["1252021", "1252599", "1250771"]
const FROM = "PETER MILLAR"
const TO = "G/FORE"
const apply = process.argv.includes("--apply")

try {
  const nz = (s) => String(s ?? "").replace(/^0+/, "") // normalize leading zeros (DB "01252021" vs "1252021")
  const targetSet = new Set(SOS.map(nz))
  // Fetch all PETER MILLAR items, then keep only the target SOs (leading-zero tolerant).
  const all = await p.airRequestItem.findMany({
    where: { brand: { contains: FROM, mode: "insensitive" } },
    include: { request: { select: { documentNo: true, bu: true } } },
  })
  const items = all.filter(i => targetSet.has(nz(i.so)))
  if (!items.length) {
    console.log(`ไม่พบ item ที่ brand contains "${FROM}" ใน SO ${SOS.join(",")}`)
    console.log(`\nPETER MILLAR items ทั้งหมดในระบบ (${all.length}) — SO ที่มี:`)
    console.log([...new Set(all.map(i => i.so))].join(", ") || "(ไม่มี PETER MILLAR เลย)")
    process.exit(0)
  }

  const docs = [...new Set(items.map(i => i.request.documentNo))]
  console.log(`พบ ${items.length} รายการ · เอกสาร: ${docs.join(", ")}\n`)
  for (const it of items) console.log(`${it.request.documentNo} · SO ${it.so} sub ${it.sub} · brand="${it.brand}" → "${TO}"`)

  if (!apply) {
    console.log(`\n(dry-run) ตรวจแล้วถ้าถูกต้อง รันซ้ำด้วย --apply เพื่อแก้จริง:`)
    console.log(`  node scripts/fix_brand_gfore.mjs --apply`)
  } else {
    const r = await p.airRequestItem.updateMany({ where: { id: { in: items.map(i => i.id) } }, data: { brand: TO } })
    console.log(`\n✅ แก้แล้ว ${r.count} รายการ · brand → "${TO}"`)
  }
} catch (e) { console.error("ERR:", e.message) } finally { await p.$disconnect() }
