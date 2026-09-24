#!/usr/bin/env bash
# ── Full backup for air-request-system (RUN ON THE SERVER: sysadmin@demosupabase) ───────────────
#   bash scripts/backup-all.sh              # backup into ~/backups/air-request
#   BACKUP_DIR=/mnt/d/backups bash scripts/backup-all.sh
#   KEEP_DAYS=30 bash scripts/backup-all.sh # retention (default 14 days)
#
# What it saves, per run, into <BACKUP_DIR>/<YYYY-mm-dd_HHMM>/ :
#   1. db_air_req_new.sql.gz  — pg_dump of the app schema (data + structure)
#   2. storage/               — Supabase storage files (attachments bucket)
#   3. env.txt                — the server .env (secrets! the folder is chmod 700)
#   4. code.bundle            — a git bundle = the whole repo + history, restorable offline
#   5. master-*.json          — master tables as JSON (via scripts/backup-master.mjs)
#   6. MANIFEST.txt           — what was taken, sizes, and how to restore
#
# Everything is best-effort: a step that cannot run is reported and the rest still completes.
set -uo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/air-request}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$BACKUP_DIR/$STAMP"
mkdir -p "$OUT" && chmod 700 "$BACKUP_DIR" "$OUT"
MANIFEST="$OUT/MANIFEST.txt"
ok() { echo "  ✓ $*"; echo "OK   $*" >> "$MANIFEST"; }
bad() { echo "  ✗ $*"; echo "FAIL $*" >> "$MANIFEST"; }

echo "==> Backup $STAMP → $OUT"
{ echo "air-request-system backup"; echo "taken : $(date -Is)"; echo "host  : $(hostname)"; echo "app   : $APP_DIR"; echo; } > "$MANIFEST"

# ── 1. Database ────────────────────────────────────────────────────────────────────────────────
# DATABASE_URL comes from the server .env. The app keeps its tables in schema `air_req_new`.
DB_URL="$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
SCHEMA="${SCHEMA:-air_req_new}"
echo "==> [1/5] Database (schema $SCHEMA)"
if [ -z "$DB_URL" ]; then
  bad "db — no DATABASE_URL in $APP_DIR/.env"
else
  DUMP="$OUT/db_${SCHEMA}.sql.gz"
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DB_URL" --schema="$SCHEMA" --no-owner --no-privileges 2>"$OUT/db.err" | gzip > "$DUMP"
  else
    # No pg_dump on the host → borrow the one inside the running Postgres container.
    PGC="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Ei 'postgres|supabase-db' | head -1)"
    if [ -n "${PGC:-}" ]; then
      echo "    using pg_dump inside container: $PGC"
      docker exec -i "$PGC" pg_dump "$DB_URL" --schema="$SCHEMA" --no-owner --no-privileges 2>"$OUT/db.err" | gzip > "$DUMP"
    else
      bad "db — pg_dump not found on host and no postgres container detected"
    fi
  fi
  if [ -s "$DUMP" ]; then ok "db → $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1))"; rm -f "$OUT/db.err"
  else bad "db — dump empty, see db.err"; fi
fi

# ── 2. Storage (uploaded attachments) ──────────────────────────────────────────────────────────
# Self-hosted Supabase keeps bucket files inside the storage container / its volume.
echo "==> [2/5] Storage files"
STC="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Ei 'storage' | head -1)"
if [ -n "${STC:-}" ]; then
  mkdir -p "$OUT/storage"
  if docker cp "$STC:/var/lib/storage/." "$OUT/storage/" 2>/dev/null; then
    ok "storage → storage/ ($(du -sh "$OUT/storage" | cut -f1)) from container $STC"
  else
    bad "storage — docker cp failed from $STC (check the path inside the container)"
  fi
else
  bad "storage — no storage container found (if files live on S3, back them up there)"
fi

# ── 3. Secrets ─────────────────────────────────────────────────────────────────────────────────
echo "==> [3/5] .env"
if [ -f .env ]; then cp .env "$OUT/env.txt" && chmod 600 "$OUT/env.txt" && ok ".env → env.txt (contains secrets — keep this folder private)"
else bad ".env not found"; fi

# ── 4. Code (independent of GitLab) ────────────────────────────────────────────────────────────
echo "==> [4/5] Code bundle"
if git -C "$APP_DIR" bundle create "$OUT/code.bundle" --all >/dev/null 2>&1; then
  ok "code → code.bundle ($(du -h "$OUT/code.bundle" | cut -f1)) · restore: git clone code.bundle air-request-system"
else bad "code bundle failed"; fi

# ── 5. Master tables as JSON (human-readable, easy partial restore) ────────────────────────────
echo "==> [5/5] Master tables (JSON)"
if node scripts/backup-master.mjs >/dev/null 2>&1; then
  LATEST="$(ls -t scripts/backups/master-backup-*.json 2>/dev/null | head -1)"
  if [ -n "${LATEST:-}" ]; then cp "$LATEST" "$OUT/" && ok "master → $(basename "$LATEST")"; else bad "master json not produced"; fi
else bad "master json — node scripts/backup-master.mjs failed"; fi

# ── Retention ──────────────────────────────────────────────────────────────────────────────────
find "$BACKUP_DIR" -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null
cat >> "$MANIFEST" <<'EOF'

RESTORE
  db      : gunzip -c db_air_req_new.sql.gz | psql "$DATABASE_URL"
  storage : docker cp storage/. <storage-container>:/var/lib/storage/
  code    : git clone code.bundle air-request-system
  master  : node scripts/restore-master.mjs <master-backup-*.json>
EOF

echo
echo "==> Done → $OUT"
cat "$MANIFEST"
echo
echo "kept backups (retention ${KEEP_DAYS}d):"
ls -1 "$BACKUP_DIR" | tail -5
