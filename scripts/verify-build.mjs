// Verify a Turbopack production build is COMPLETE before we ship it — Next 16 + Turbopack
// occasionally emits a .next that references an SSR chunk it never wrote (ChunkLoadError →
// "This page couldn't load" / 502 on authed pages). This scans every built server JS for chunk
// references and fails (exit 1) if any referenced chunk file is missing, so deploy.sh can retry
// or keep the last-good build instead of taking the site down.
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

const SRV = ".next/server"
const CHUNKS = join(SRV, "chunks")

// 1) all chunk files that actually exist (by basename — Turbopack basenames are unique)
const have = new Set()
;(function walk(d) {
  let ents
  try { ents = readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of ents) { const p = join(d, e.name); e.isDirectory() ? walk(p) : have.add(e.name) }
})(CHUNKS)

// 2) every chunk basename referenced anywhere in the built server bundle
const need = new Set()
;(function walk(d) {
  let ents
  try { ents = readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of ents) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith(".js")) {
      const t = readFileSync(p, "utf8")
      for (const m of t.matchAll(/chunks\/(?:ssr\/)?([^"'`)\/\s]+?\._?\.js)/g)) need.add(m[1])
    }
  }
})(SRV)

const missing = [...need].filter(n => !have.has(n))
if (missing.length) {
  console.error(`!! INCOMPLETE BUILD — ${missing.length} referenced chunk(s) missing on disk:`)
  console.error(missing.slice(0, 25).join("\n"))
  process.exit(1)
}
console.log(`✓ build verified — all ${need.size} referenced chunks present (${have.size} chunk files)`)
