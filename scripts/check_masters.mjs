import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const U = (s) => String(s ?? "").trim().toUpperCase()

try {
  const air = await p.pullFreightAir.findMany({ select: { origin: true, country: true, destination: true, rates: true } })
  const sea = await p.pullFreightSea.findMany({ select: { port: true, country: true, container: true, rate: true } })
  const cour = await p.pullFreightCourier.findMany({ select: { origin: true, country: true, destination: true, carrier: true, rates: true } })

  console.log(`\n=== counts === air=${air.length} sea=${sea.length} courier=${cour.length}`)

  // Air ports (with at least one rate) by country
  const airPorts = new Set(), airByCountry = {}
  for (const r of air) { const hasRate = r.rates && Object.values(r.rates).some(v => Number(v) > 0); if (r.origin && hasRate) { airPorts.add(U(r.origin)); (airByCountry[U(r.country)] ||= new Set()).add(U(r.origin)) } }

  // Courier ports (with rate) by carrier
  const courByPortCarrier = {}
  for (const r of cour) { const hasRate = r.rates && Object.values(r.rates).some(v => Number(v) > 0); if (r.origin && hasRate) (courByPortCarrier[U(r.origin)] ||= new Set()).add(U(r.carrier)) }

  // Sea ports (with rate) by country
  const seaByCountry = {}
  for (const r of sea) { if (r.port && Number(r.rate) > 0) (seaByCountry[U(r.country)] ||= new Set()).add(U(r.port)) }

  // AIR ports that ALSO have courier (DHL & FEDEX) — a doc with this air port shows Air + DHL + FedEx.
  console.log(`\n=== AIR ports that also have COURIER (DHL+FedEx) ===`)
  const good = []
  for (const port of airPorts) {
    const carriers = courByPortCarrier[port]
    if (carriers && [...carriers].some(c => c.includes("DHL")) && [...carriers].some(c => c.includes("FEDEX"))) good.push(port)
  }
  console.log(good.length ? good.join(", ") : "(none — courier ports don't overlap air ports)")

  // Countries complete across all 3 (air port + sea port + courier)
  console.log(`\n=== COUNTRIES with air + sea + courier ===`)
  const allCountries = new Set([...Object.keys(airByCountry), ...Object.keys(seaByCountry)])
  for (const c of [...allCountries].sort()) {
    const aPorts = [...(airByCountry[c] || [])]
    const sPorts = [...(seaByCountry[c] || [])]
    const cPorts = aPorts.filter(pt => courByPortCarrier[pt])
    if (aPorts.length && sPorts.length && cPorts.length) {
      console.log(`✅ ${c} · air=[${aPorts.join(",")}] · sea=[${sPorts.slice(0,4).join(",")}] · courier air-port=[${cPorts.join(",")}]`)
    }
  }

  console.log(`\n=== BEST test candidate (air+courier same port, has sea in country) ===`)
  for (const port of good) {
    const country = Object.keys(airByCountry).find(c => airByCountry[c].has(port))
    const sea = country ? [...(seaByCountry[country] || [])] : []
    console.log(`air port ${port} (${country}) → Air ✓ DHL ✓ FedEx ✓ · sea ports in country: [${sea.slice(0,4).join(",") || "none"}]  ← ทดสอบ: country=${country}, air port=${port}, น้ำหนัก ≤30kg`)
  }
} catch (e) { console.error("ERR:", e.message) } finally { await p.$disconnect() }
