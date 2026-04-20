#!/usr/bin/env bash
# DANGER: applies a SQL dump with psql. Can destroy or corrupt data if pointed at the wrong database.
#
# Safety rails:
#   - Requires explicit dump path as first argument (non-empty file).
#   - Requires RESTORE_CONFIRM=YES (exact) after you read the warnings below.
#   - Prints host, database, absolute path; waits 5s before running (Ctrl+C to abort).
#
# Environment:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, COMMENTS_DB (default: comments)
#
# Usage:
#   export PGPASSWORD=postgres RESTORE_CONFIRM=YES
#   ./scripts/restore-db.sh /absolute/or/relative/path/to/dump.sql
#
# Recommended flow (manual):
#   1) Stop API and anything else using the DB.
#   2) Ensure target database exists and is the correct one.
#   3) Prefer restoring into an empty DB or accept overwriting objects per dump contents.
#   4) Run prisma migrate deploy if schema must match before data-only restores.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP_RAW="${1:-}"

if [[ -z "$DUMP_RAW" ]]; then
  echo "restore-db.sh: pass the path to a .sql dump file as the first argument." >&2
  echo "restore-db.sh: example: RESTORE_CONFIRM=YES $0 $ROOT/backups/comments-20260101-120000.sql" >&2
  exit 1
fi

if [[ ! -f "$DUMP_RAW" ]]; then
  echo "restore-db.sh: file not found: $DUMP_RAW" >&2
  exit 1
fi

if command -v realpath >/dev/null 2>&1; then
  DUMP="$(realpath "$DUMP_RAW")"
else
  DUMP="$(cd "$(dirname "$DUMP_RAW")" && pwd)/$(basename "$DUMP_RAW")"
fi

if [[ "${RESTORE_CONFIRM:-}" != "YES" ]]; then
  echo "restore-db.sh: refusing to run — set RESTORE_CONFIRM=YES (exact) after you read this script and verified the target." >&2
  exit 1
fi

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
COMMENTS_DB="${COMMENTS_DB:-comments}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

if ! command -v psql >/dev/null 2>&1; then
  echo "restore-db.sh: psql not found. Install postgresql-client." >&2
  exit 1
fi

echo "============================================================================" >&2
echo "restore-db.sh: DESTRUCTIVE / IRREVERSIBLE risk — you are about to run psql -f on:" >&2
echo "  dump_file=$DUMP" >&2
echo "  target_host=$PGHOST target_port=$PGPORT target_database=$COMMENTS_DB user=$PGUSER" >&2
echo "============================================================================" >&2
echo "restore-db.sh: abort with Ctrl+C within 5 seconds if ANY value is wrong." >&2
sleep 5

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$COMMENTS_DB" -v ON_ERROR_STOP=1 -f "$DUMP"
echo "restore-db.sh: psql finished (check messages above for errors)." >&2
