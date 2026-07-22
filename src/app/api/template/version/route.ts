import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readFileSync } from "fs"
import path from "path"
import crypto from "crypto"

export const runtime = "nodejs"

// A "version" fingerprint of the download template for a BU. It changes whenever the
// template's valid data changes — the active Master Descriptions (names + weights) and
// Master Freight Rates (country + rate) — or the static template file itself is replaced.
// The New Request page compares this against the version the user last downloaded (stored
// in the browser) to show a "template updated — please re-download" hint. Content-hash
// (not a timestamp) so add / edit / delete of any valid-data row is detected, and a user
// who already has the latest never sees the hint.
export async function GET(req: NextRequest) {
  const bu = req.nextUrl.searchParams.get("bu") || "NYG"
  const parts: string[] = []
  try {
    // Hash the file CONTENT (not mtime — on Vercel mtime = deploy time, which would flip
    // the version on every redeploy). Same file bytes → same hash across deploys.
    const buf = readFileSync(path.join(process.cwd(), "public", `air-request-template_${bu}.xlsx`))
    parts.push("f:" + crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12))
  } catch { /* file missing → just skip */ }
  try {
    const descs: any[] = await (prisma as any).masterDescription.findMany({
      where: { isActive: true }, select: { name: true, weightPerUnit: true }, orderBy: { name: "asc" },
    })
    parts.push("d:" + descs.map(d => `${d.name}=${d.weightPerUnit}`).join("|"))
    const rates: any[] = await (prisma as any).masterFreightRate.findMany({
      where: { isActive: true }, select: { country: true, ratePerKg: true }, orderBy: { country: "asc" },
    })
    parts.push("r:" + rates.map(r => `${r.country}=${r.ratePerKg}`).join("|"))
  } catch { /* db read failed → version still reflects the file */ }
  const version = crypto.createHash("sha1").update(parts.join("~")).digest("hex").slice(0, 12)
  return NextResponse.json({ version })
}
