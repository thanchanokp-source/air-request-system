import { prisma } from "./prisma"

// Document number: AIR_<BU>_<YYMM>_<seq4>  e.g. AIR_NYG_2607_0001 / AIR_GW_2607_0008
// The running number is PER BU + per month (never counts across BUs) and CONTINUES from the
// BU's existing documents — both the new format (AIR_<BU>_YYMM_####) and the legacy shared
// format (AIR-YYMM-####, disambiguated by the bu column). So GW keeps counting from its last
// number instead of restarting at 1, while a freshly-cleared BU (e.g. NYG) starts at 0001.
export async function generateDocumentNo(bu: string = "NYG"): Promise<string> {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yymm = `${yy}${mm}`
  const buCode = bu === "GW" ? "GW" : bu || "NYG"

  const newPrefix = `AIR_${buCode}_${yymm}_`  // new per-BU format
  const oldPrefix = `AIR-${yymm}-`            // legacy shared format (disambiguated by bu column)

  const seqOf = (doc: { documentNo: string } | null) => (doc ? parseInt(doc.documentNo.slice(-4)) || 0 : 0)

  // Highest sequence this BU has used this month, across BOTH formats. bu is a non-nullable
  // String column (default "NYG"), so a plain equality is correct (no null branch needed).
  const [lastNew, lastOld] = await Promise.all([
    prisma.airRequest.findFirst({ where: { documentNo: { startsWith: newPrefix } }, orderBy: { documentNo: "desc" } }),
    prisma.airRequest.findFirst({ where: { documentNo: { startsWith: oldPrefix }, bu: buCode }, orderBy: { documentNo: "desc" } }),
  ])

  const seq = Math.max(seqOf(lastNew), seqOf(lastOld)) + 1
  return `${newPrefix}${String(seq).padStart(4, "0")}`
}
export const generateDocNo = generateDocumentNo
