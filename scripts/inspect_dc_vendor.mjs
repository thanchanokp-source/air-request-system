import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const q = (sql, ...a) => p.$queryRawUnsafe(sql, ...a)
const line = (s) => console.log(s)

try {
  // 1) locate dc_vendor in any schema
  const loc = await q(`SELECT table_schema, table_name FROM information_schema.tables WHERE lower(table_name)='dc_vendor'`)
  if (!loc.length) {
    line("dc_vendor NOT FOUND. Tables containing 'vendor':")
    const alt = await q(`SELECT table_schema, table_name FROM information_schema.tables WHERE lower(table_name) LIKE '%vendor%' ORDER BY 1,2`)
    alt.forEach(r => line(`  ${r.table_schema}.${r.table_name}`))
    process.exit(0)
  }
  const { table_schema: sch } = loc[0]
  const TBL = `"${sch}"."dc_vendor"`
  line(`FOUND: ${sch}.dc_vendor`)

  // 2) columns
  const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=$1 AND lower(table_name)='dc_vendor' ORDER BY ordinal_position`, sch)
  line("\n=== columns ===")
  cols.forEach(c => line(`  ${c.column_name} :: ${c.data_type}`))
  const colNames = cols.map(c => c.column_name)
  const find = (re) => colNames.filter(c => re.test(c.toLowerCase()))
  line("\n  candidate NAME cols  : " + JSON.stringify(find(/name|nm|desc/)))
  line("  candidate CODE cols  : " + JSON.stringify(find(/code|cd|_id$|no$|vend/)))
  line("  candidate ADDR cols  : " + JSON.stringify(find(/addr|address|street|city|country|location|tambon|amphur|province|zip|post/)))

  // 3) count + samples
  const cnt = await q(`SELECT count(*)::int n FROM ${TBL}`)
  line(`\n=== row count: ${cnt[0].n} ===`)
  const smp = await q(`SELECT * FROM ${TBL} LIMIT 4`)
  line(JSON.stringify(smp, null, 2))

  // 4) our vendors = distinct vend_name across the BOM tables (source of truth for pull material)
  const BOM = {
    NYG: `"ReportDB"."NYG_BILL_OF_MATERIALS_EXPORT_CHECK"`,
    NYV: `"ReportDB"."NYV_BILL_OF_MATERIALS_EXPORT_CHECK"`,
    GW:  `"ReportDB"."GW_BILL_OF_MATERIALS_EXPORT_CHECK"`,
    TRM: `"ReportDB"."TRM_BILL_OF_MATERIALS_EXPORT_CHECK"`,
  }
  const ours = new Set()
  for (const [bu, t] of Object.entries(BOM)) {
    try {
      const r = await q(`SELECT DISTINCT vend_name v FROM ${t} WHERE vend_name IS NOT NULL AND vend_name<>''`)
      r.forEach(x => ours.add(String(x.v).trim()))
      line(`\nBOM ${bu}: ${r.length} distinct vendors`)
    } catch (e) { line(`\nBOM ${bu}: ERR ${e.message.split("\n")[0]}`) }
  }
  line(`\nour vendors (union, distinct): ${ours.size}`)

  // 5) mapping test — try to match by each candidate NAME/CODE col of dc_vendor (exact-trim-upper)
  const norm = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ")
  const oursNorm = new Map([...ours].map(v => [norm(v), v]))
  for (const col of [...new Set([...find(/name|nm/), ...find(/code|vend/)])]) {
    try {
      const rows = await q(`SELECT DISTINCT "${col}" v FROM ${TBL} WHERE "${col}" IS NOT NULL AND "${col}"::text<>''`)
      let hit = 0
      const misses = []
      for (const r of rows) { if (oursNorm.has(norm(r.v))) hit++; else if (misses.length < 5) misses.push(r.v) }
      line(`\n[map by dc_vendor."${col}"] dc rows=${rows.length}  matched-to-our-vendors=${hit}  (${((hit / (rows.length || 1)) * 100).toFixed(0)}%)`)
      if (misses.length) line(`   sample unmatched: ${JSON.stringify(misses)}`)
    } catch (e) { line(`\n[map by "${col}"] ERR ${e.message.split("\n")[0]}`) }
  }
} catch (e) {
  console.error("FATAL:", e.message)
} finally { await p.$disconnect() }
