#!/usr/bin/env bash
# Logical backup of the `comments` database (plain SQL) via pg_dump.
#
# Prerequisites: postgresql-client (`pg_dump`), network access to PostgreSQL.
#
# Environment (defaults match docker-compose.yml published on localhost):
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, COMMENTS_DB (default: comments)
#
# Usage:
#   export PGPASSWORD=...   # superuser or role with dump rights (defaults below match compose bootstrap)
#   ./scripts/backup-db.sh                    # writes ./backups/COMMENTS_DB-YYYYMMDD-HHMMSS.sql (never overwrites)
#   ./scripts/backup-db.sh /path/to/dump.sql  # parent dir is created; refuses if file already exists
#
# Exits non-zero if pg_dump fails or the dump file is missing/empty.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-}"

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
COMMENTS_DB="${COMMENTS_DB:-comments}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "backup-db.sh: pg_dump not found. Install postgresql-client." >&2
  exit 1
fi

if [[ -n "${1:-}" ]]; then
  OUT="$1"
  if [[ -e "$OUT" ]]; then
    echo "backup-db.sh: refusing to overwrite existing file: $OUT" >&2
    exit 1
  fi
  parent="$(dirname "$OUT")"
  mkdir -p "$parent"
else
  mkdir -p "$ROOT/backups"
  OUT="$ROOT/backups/${COMMENTS_DB}-$(date +%Y%m%d-%H%M%S).sql"
  if [[ -e "$OUT" ]]; then
    echo "backup-db.sh: unexpected existing file $OUT — aborting" >&2
    exit 1
  fi
fi

echo "backup-db.sh: dumping database \"$COMMENTS_DB\" on $PGHOST:$PGPORT to \"$OUT\" ..." >&2
set +e
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$COMMENTS_DB" --no-owner --no-acl -F p -f "$OUT"
dump_rc=$?
set -e
if [[ "$dump_rc" -ne 0 ]]; then
  echo "backup-db.sh: pg_dump failed (exit $dump_rc)." >&2
  rm -f "$OUT" 2>/dev/null || true
  exit "$dump_rc"
fi

if [[ ! -f "$OUT" ]] || [[ ! -s "$OUT" ]]; then
  echo "backup-db.sh: dump file missing or empty after pg_dump: $OUT" >&2
  rm -f "$OUT" 2>/dev/null || true
  exit 1
fi

echo "backup-db.sh: done ($(wc -c < "$OUT" | tr -d ' ') bytes)." >&2
