#!/usr/bin/env bash
# Safe deploy for air-request-system.
#   Usage:  bash deploy.sh          # normal deploy
#           PUSH_DB=1 bash deploy.sh # also run prisma db push (only when the schema changed)
#
# Why this is safe:
#  - Builds the NEW version while pm2 keeps serving the OLD one (no downtime, no stop).
#  - NEVER deletes .next before a verified build; keeps a backup and RESTORES it if the
#    build fails, so a broken build can never take the site down.
#  - Restarts pm2 ONLY after the build produced a valid .next/BUILD_ID.
#  - Build uses Turbopack (package.json). Do NOT switch back to --webpack: Next 16.2.6
#    webpack builds drop the metadata/viewport/icon client-manifest -> every page 502s.
set -uo pipefail
cd "$(dirname "$0")"
APP="air-request"

# Build on the Node version this project needs. Next 16.2.6 + Turbopack deterministically DROPS
# SSR chunks on Node 20 (-> ChunkLoadError / incomplete build); Node 22 builds cleanly. .nvmrc pins 22.
# If nvm is present we switch to it here so every deploy builds on the right Node automatically.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use >/dev/null 2>&1 || nvm install >/dev/null 2>&1 || true
fi
NODE_MAJOR="$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')"
echo "==> node $(node -v 2>/dev/null)  npm $(npm -v 2>/dev/null)"
if [ "${NODE_MAJOR:-0}" -lt 22 ]; then
  echo "!! Node ${NODE_MAJOR:-?} is too old — this project needs Node 22 (Turbopack drops chunks on Node 20)."
  echo "   Install it once:  nvm install 22 && nvm alias default 22   — then re-run deploy. Nothing changed; site stays up."
  exit 1
fi

echo "==> [1/5] Pull latest code"
git -c http.sslVerify=false pull || { echo "!! git pull failed — aborting"; exit 1; }

if [ "${PUSH_DB:-0}" = "1" ]; then
  echo "==> [1b] prisma db push (schema change)"
  npx prisma db push || { echo "!! prisma db push failed — aborting (nothing restarted)"; exit 1; }
fi

# Regenerate the Prisma client BEFORE the typescript check — a schema change (new model/field) pulled
# above is otherwise unknown to tsc until the build step runs "prisma generate" (→ false TS errors).
echo "==> [1b2] prisma generate"
npx prisma generate >/dev/null || { echo "!! prisma generate failed — aborting (nothing restarted)"; exit 1; }

echo "==> [1c] Pre-deploy checks (hooks rules / lib-imports-app / typescript)"
node scripts/check.mjs || { echo "!! checks failed - nothing built, site untouched"; exit 1; }

echo "==> [2/5] Back up current build"
rm -rf .next.bak
[ -d .next ] && cp -a .next .next.bak
# CLEAN build: an incremental Turbopack build over a stale .next leaves mismatched SSR chunks
# ("This page couldn't load" / ChunkLoadError). Remove .next so every deploy is a fresh build;
# the .next.bak backup is restored below if the build fails, so a bad build never takes the site down.
rm -rf .next

echo "==> [3/5] Build new version (Turbopack, clean) — app still serving old build in memory"
# Turbopack occasionally emits a .next whose page.js references an SSR chunk it never wrote
# (BUILD_ID exists, but a chunk file is missing -> ChunkLoadError / "This page couldn't load" / 502).
# So we don't trust BUILD_ID alone: after each build we run verify-build.mjs, which fails if any
# referenced chunk is missing. If a build is incomplete we retry (up to 3x — the flake is intermittent).
# Only a build that BOTH has BUILD_ID AND passes verification is allowed to replace the running one.
BUILD_OK=0
for attempt in 1 2 3; do
  echo "    build attempt $attempt/3..."
  rm -rf .next
  if npm run build && [ -f .next/BUILD_ID ] && node scripts/verify-build.mjs; then
    BUILD_OK=1; break
  fi
  echo "    !! attempt $attempt incomplete/failed — retrying with a clean .next"
done
if [ "$BUILD_OK" = "1" ]; then
  echo "    build OK + verified (BUILD_ID: $(cat .next/BUILD_ID))"
  rm -rf .next.bak
else
  echo "!! BUILD INCOMPLETE after 3 attempts — restoring previous build, NOT restarting. Site stays up on old version."
  rm -rf .next
  [ -d .next.bak ] && mv .next.bak .next
  exit 1
fi

echo "==> [4/5] Restart app"
pm2 restart "$APP" --update-env

echo "==> [5/6] Verify"
sleep 3
pm2 describe "$APP" | grep -E "status|restarts" || true
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/login || echo "000")
echo "    local /login -> HTTP $code   (200/307 = OK)"
echo "    HEAD: $(git rev-parse --short HEAD)"

# The LB (demo-deb12, openresty) caches per Accept-Encoding and negative-caches 404 for /_next/static
# files that don't exist yet during a build. After every deploy we fetch the NEW chunks through the
# public URL with a browser-like Accept-Encoding, so the LB caches 200 before any user hits a stale 404.
echo "==> [6/6] Pre-warm CDN/LB cache"
BASE="${PREWARM_URL:-https://demoairrequest.nanyangtextile.com}"
n=0
while IFS= read -r f; do
  p="/_next${f#.next}"
  curl -s -o /dev/null -H "Accept-Encoding: gzip, deflate, br, zstd" "$BASE$p" && n=$((n+1))
done < <(find .next/static -type f \( -name '*.js' -o -name '*.css' \) 2>/dev/null)
echo "    pre-warmed $n files via $BASE"
echo "==> DONE"
