// Where a forwarder short name (e.g. QTM) comes from, and which documents carry it.
//   node scripts/pull-fwd-who.mjs           list every forwarder in the air-rate master + contact master
//   node scripts/pull-fwd-who.mjs QTM       show that one: its rates, its contact, its documents
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const name = (process.argv[2] || "").trim()
const up = (s) => String(s || "").trim().toUpperCase()

const rates = await prisma.pullFreightAir.findMany({ select: { origin: true, country: true, fwd: true, rates: true } })
const contacts = await prisma.pullForwarder.findMany({ orderBy: { name: "asc" } })

if (!name) {
  const byFwd = {}
  for (const r of rates) { const k = r.fwd || "(ไม่ระบุ)"; (byFwd[k] ||= new Set()).add(r.origin) }
  console.log("Forwarders ใน Master Rate (PullFreightAir.fwd):")
  for (const [k, ports] of Object.entries(byFwd).sort()) console.log(`  ${k.padEnd(14)} ${ports.size} port: ${[...ports].slice(0, 12).join(", ")}`)
  console.log("\nForwarders ที่มีอีเมล (MASTER FWD / PullForwarder):")
  for (const c of contacts) console.log(`  ${c.name.padEnd(14)} ${c.email}${c.ccEmails?.length ? ` (cc ${c.ccEmails.join(", ")})` : ""}${c.isActive ? "" : "  [inactive]"}`)
  process.exit(0)
}

console.log(`=== ${name} ===`)
const mine = rates.filter((r) => up(r.fwd) === up(name))
console.log(`Master Rate: ${mine.length} แถว`)
for (const r of mine.slice(0, 20)) console.log(`  ${r.origin} (${r.country || "-"}) ${JSON.stringify(r.rates)}`)
const c = contacts.find((x) => up(x.name) === up(name))
console.log(`Contact: ${c ? `${c.email}${c.ccEmails?.length ? ` cc ${c.ccEmails.join(", ")}` : ""}` : "ยังไม่มีใน MASTER FWD"}`)

const docs = await prisma.pullMaterialRequest.findMany({
  where: { OR: [{ fwdName: { equals: name, mode: "insensitive" } }, { preCostFwd: { equals: name, mode: "insensitive" } }] },
  select: {
    documentNo: true, bu: true, status: true, fwdName: true, preCostFwd: true, preCost: true,
    actualAir: true, actualCurrency: true, fwdRateThbPerKg: true, items: { select: { weight: true, airFreightCost: true } },
  },
  orderBy: { createdAt: "desc" }, take: 30,
})
console.log(`\nเอกสารที่ผูกกับ ${name}: ${docs.length}`)
for (const d of docs) {
  const kg = d.items.reduce((s, i) => s + (Number(i.weight) || 0), 0)
  const est = d.items.reduce((s, i) => s + (Number(i.airFreightCost) || 0), 0)
  const thbKg = kg && d.actualAir != null ? ((d.actualAir * 32.5) / kg).toFixed(1) : "-"
  console.log(`  ${d.documentNo.padEnd(22)} ${String(d.status).padEnd(18)} kg ${kg || "-"}  est ${est ? est.toFixed(1) : "-"} USD  actual ${d.actualAir ?? "-"} USD  => ${thbKg} THB/kg  (fwdName ${d.fwdName || "-"} / preCostFwd ${d.preCostFwd || "-"})`)
}
await prisma.$disconnect()
