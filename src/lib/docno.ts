import { prisma } from "./prisma"
export async function generateDocumentNo(): Promise<string> {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const prefix = `AIR-${yy}${mm}-`
  const last = await prisma.airRequest.findFirst({ where: { documentNo: { startsWith: prefix } }, orderBy: { documentNo: "desc" } })
  const seq = last ? parseInt(last.documentNo.slice(-4)) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}
export const generateDocNo = generateDocumentNo
