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

echo "==> [1/5] Pull latest code"
git -c http.sslVerify=false pull || { echo "!! git pull failed — aborting"; exit 1; }

if [ "${PUSH_DB:-0}" = "1" ]; then
  echo "==> [1b] prisma db push (schema change)"
  npx prisma db push || { echo "!! prisma db push failed — aborting (nothing restarted)"; exit 1; }
fi

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

echo "==> [5/5] Verify"
sleep 3
pm2 describe "$APP" | grep -E "status|restarts" || true
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/login || echo "000")
echo "    local /login -> HTTP $code   (200/307 = OK)"
echo "    HEAD: $(git rev-parse --short HEAD)"
echo "==> DONE"
