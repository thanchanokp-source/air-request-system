// Inspect public.mp_line and match an INVOICE back to it (so_no / sub_no / ex-factory date).
//   node scripts/mpline-inv.mjs                    -> print mp_line columns (marks date-like / *fact* ones)
//   node scripts/mpline-inv.mjs G26655506335       -> rows of that invoice
//   node scripts/mpline-inv.mjs G26655506335 full  -> rows with every column (JSON)
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const [inv, mode] = process.argv.slice(2)

const cols = await prisma.$queryRawUnsafe(
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='mp_line' ORDER BY ordinal_position`)

if (!inv) {
  console.log(`public.mp_line — ${cols.length} columns`)
  for (const c of cols) {
    const hit = /fact|date|inv|so_no|sub/i.test(c.column_name) ? "  <<<" : ""
    console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}${hit}`)
  }
  process.exit(0)
}

// pick whatever the ex-factory column is actually called
const names = cols.map(c => c.column_name)
const exCol = names.find(n => /^ex.?fact/i.test(n)) || names.find(n => /ex.?fty|ex.?factory/i.test(n))
console.log(`ex-factory column = ${exCol || "NOT FOUND — see column list above"}`)

const sel = mode === "full" ? "*" : `so_no, sub_no, invoice_no, style, ship_mode, status, final_pcs${exCol ? `, ${exCol}` : ""}${names.includes("hod_date") ? ", hod_date" : ""}`
const rows = await prisma.$queryRawUnsafe(
  `SELECT ${sel} FROM public.mp_line WHERE UPPER(TRIM(invoice_no)) = UPPER(TRIM($1)) LIMIT 50`, inv)

console.log(`\nINV ${inv} -> ${rows.length} rows in mp_line`)
if (mode === "full") console.log(JSON.stringify(rows, null, 2))
else for (const r of rows) console.log(r)

// and the other direction: what the claim doc holds for this INV
const items = await prisma.airRequestItem.findMany({
  where: { invoiceNo: { equals: inv, mode: "insensitive" } },
  select: { so: true, sub: true, style: true, invoiceNo: true, hawbNo: true, qtyActualShip: true, request: { select: { documentNo: true, bu: true, status: true } } },
  take: 50,
})
console.log(`\nAirRequestItem with this INV -> ${items.length} rows`)
for (const i of items) console.log(`  ${i.request.documentNo} (${i.request.bu}/${i.request.status})  SO ${i.so}/${i.sub || "-"}  HAWB ${i.hawbNo || "-"}  qty ${i.qtyActualShip ?? "-"}`)

await prisma.$disconnect()
