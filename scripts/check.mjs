// Pre-deploy gate — the checks whose failures actually break the running site.
//   node scripts/check.mjs          (or: npm run check)
// Runs on Windows before pushing AND on the server inside deploy.sh before the build.
//
// Why these three:
//   1. Hooks rules   — a hook after an early return renders a different number of hooks on the
//                      second render: React error #310, the whole page tree dies at runtime.
//   2. lib -> app    — a file in src/lib importing a "use client" page module drags that client
//                      graph into the server bundle and breaks the RSC manifest (blank pages).
//   3. TypeScript    — plain type errors.
// Type errors and lint noise that do NOT break runtime (no-explicit-any …) are deliberately not here.
import { execFileSync } from "child_process"
import { readdirSync, readFileSync, statSync } from "fs"
import { join, resolve } from "path"
import { fileURLToPath } from "url"

const root = resolve(fileURLToPath(import.meta.url), "../..")
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "pipe", shell: true, encoding: "utf8" })
let failed = 0
const fail = (title, detail) => { failed++; console.error(`\n✗ ${title}\n${detail}`) }
const pass = (title) => console.log(`✓ ${title}`)

// ── 1. Hooks rules (React #310 and friends) ────────────────────────────────────────────────────
try {
  run("npx", ["eslint", "--config", "eslint.critical.mjs", "src"])
  pass("hooks rules (no hook after an early return / inside a condition)")
} catch (e) {
  fail("hooks rules violated — this is what causes React #310 in production", (e.stdout || e.message || "").trim())
}

// ── 2. No src/lib or src/components importing from src/app ─────────────────────────────────────
const walk = (dir) => readdirSync(dir).flatMap(name => {
  const p = join(dir, name)
  return statSync(p).isDirectory() ? walk(p) : [p]
})
const offenders = []
for (const base of ["src/lib", "src/components"]) {
  let files = []
  try { files = walk(join(root, base)).filter(f => /\.(ts|tsx)$/.test(f)) } catch { continue }
  for (const f of files) {
    const src = readFileSync(f, "utf8")
    const m = src.match(/from\s+"@\/app\/[^"]+"/g)
    if (m) offenders.push(`${f.replace(root + "\\", "").replace(root + "/", "")} -> ${m.join(", ")}`)
  }
}
if (offenders.length) fail("src/lib or src/components imports from src/app (breaks the RSC build)", offenders.join("\n"))
else pass("no lib/component imports from app pages")

// ── 3. TypeScript ──────────────────────────────────────────────────────────────────────────────
try {
  run("npx", ["tsc", "--noEmit"])
  pass("typescript")
} catch (e) {
  fail("typescript errors", (e.stdout || e.message || "").trim().split("\n").slice(0, 20).join("\n"))
}

console.log()
if (failed) { console.error(`${failed} check(s) failed — fix before deploying.`); process.exit(1) }
console.log("all checks passed — safe to build/deploy.")
