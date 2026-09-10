import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()

// SOs whose brand was uploaded as PETER MILLAR but should be G/FORE.
const SOS = ["1252021", "1252599", "1250771"]
const FROM = "PETER MILLAR"
const TO = "G/FORE"
const apply = process.argv.includes("--apply")

try {
  const items = await p.airRequestItem.findMany({
    where: { so: { in: SOS }, brand: { contains: FROM, mode: "insensitive" } },
    include: { request: { select: { documentNo: true, bu: true } } },
  })
  if (!items.length) { console.log("ไม่พบ item ที่ brand contains", FROM, "ใน SO", SOS.join(",")); process.exit(0) }

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
