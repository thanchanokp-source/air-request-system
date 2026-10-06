// Deleted Pull RM documents — list, inspect, export or restore from the snapshot kept at delete time.
//   node scripts/pull-deleted.mjs                      list the last 30 deletions
//   node scripts/pull-deleted.mjs show PULL_NYG_2610_0004
//   node scripts/pull-deleted.mjs export PULL_NYG_2610_0004     -> writes a .json next to the script
//   node scripts/pull-deleted.mjs restore PULL_NYG_2610_0004    -> recreates the document + its items
//
// Attachment FILES were never removed from the bucket; a restore re-links their metadata rows, so the
// links work again. The restored document keeps its original document number.
import { PrismaClient } from "@prisma/client"
import { writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const prisma = new PrismaClient()
const here = dirname(fileURLToPath(import.meta.url))
const [cmd = "list", docNo] = process.argv.slice(2)
const d = (v) => (v ? new Date(v).toLocaleString("en-GB") : "-")

const findOne = async (no) => {
  if (!no) { console.error("ต้องระบุเลขเอกสาร เช่น PULL_NYG_2610_0004"); process.exit(1) }
  const row = await prisma.pullMaterialDeleted.findFirst({ where: { documentNo: no }, orderBy: { deletedAt: "desc" } })
  if (!row) { console.error(`ไม่พบ snapshot ของ ${no}`); process.exit(1) }
  return row
}

if (cmd === "list") {
  const rows = await prisma.pullMaterialDeleted.findMany({ orderBy: { deletedAt: "desc" }, take: 30 })
  console.log(`deleted documents: ${rows.length}`)
  for (const r of rows) {
    const n = (r.data?.items || []).length
    console.log(`${d(r.deletedAt).padEnd(20)} ${String(r.documentNo).padEnd(22)} ${String(r.bu || "-").padEnd(4)} ${String(r.status || "-").padEnd(20)} ${n} items  by ${r.deletedBy || "-"}${r.reason ? `  (${r.reason})` : ""}`)
  }
} else if (cmd === "show") {
  const row = await findOne(docNo)
  const { request, items, attachments } = row.data || {}
  console.log(`${row.documentNo} · ${row.bu} · ลบเมื่อ ${d(row.deletedAt)} โดย ${row.deletedBy || "-"}`)
  console.log(`status ตอนลบ: ${row.status} · items ${items?.length || 0} · attachments ${attachments?.length || 0}`)
  console.log(`requester: ${request?.requesterName} (${request?.requesterEmail || "-"})`)
  for (const it of items || []) console.log(`  SO ${it.soNoDoc} · PO ${it.poNoDoc || "-"} · ${it.itemName || "-"} · pull ${it.pullMaterialQty ?? "-"}`)
  for (const a of attachments || []) console.log(`  file: ${a.fileName} (${a.filePath})`)
} else if (cmd === "export") {
  const row = await findOne(docNo)
  const file = join(here, `deleted_${row.documentNo}_${row.deletedAt.toISOString().slice(0, 10)}.json`)
  writeFileSync(file, JSON.stringify(row, null, 2), "utf8")
  console.log("written:", file)
} else if (cmd === "restore") {
  const row = await findOne(docNo)
  const { request, items, attachments } = row.data || {}
  const exists = await prisma.pullMaterialRequest.findUnique({ where: { documentNo: row.documentNo } })
  if (exists) { console.error(`${row.documentNo} มีอยู่แล้วในระบบ — ยกเลิกการ restore`); process.exit(1) }
  const { id, createdAt, updatedAt, ...header } = request
  const created = await prisma.pullMaterialRequest.create({
    data: {
      ...header, id,
      items: { create: (items || []).map(({ id: iid, requestId, createdAt: _c, ...it }) => ({ ...it, id: iid })) },
    },
  })
  for (const a of attachments || []) {
    const { id: aid, requestId, createdAt: _ac, ...att } = a
    await prisma.pullMaterialAttachment.create({ data: { ...att, id: aid, requestId: created.id } }).catch(() => {})
  }
  console.log(`restored ${created.documentNo} (${(items || []).length} items, ${(attachments || []).length} files)`)
}
await prisma.$disconnect()
