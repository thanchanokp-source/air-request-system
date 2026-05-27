import { PrismaClient } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"

const prisma = new PrismaClient()
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)
const BUCKET = "air-request-attachments"

async function main() {
  // Get all file paths before deleting DB records
  const attachments = await prisma.requestAttachment.findMany({ select: { filePath: true } })
  const filePaths = attachments.map(a => a.filePath).filter(Boolean)

  // Delete files from Supabase storage
  if (filePaths.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(filePaths)
    if (error) {
      console.error("Storage delete error:", error.message)
    } else {
      console.log(`Deleted ${filePaths.length} file(s) from storage`)
    }
  } else {
    console.log("No files in storage to delete")
  }

  // Delete DB records
  const att = await prisma.requestAttachment.deleteMany()
  const log = await prisma.approvalLog.deleteMany()
  const req = await prisma.airRequest.deleteMany()
  console.log(`Deleted: ${att.count} attachments, ${log.count} logs, ${req.count} requests`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
