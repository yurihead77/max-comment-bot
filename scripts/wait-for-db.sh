#!/usr/bin/env bash
# Wait until PostgreSQL accepts connections (requires `pg_isready` from postgresql-client).
#
# Defaults match `docker-compose.yml` (comments-db on localhost:5432).
# Override with PGHOST, PGPORT, PGUSER, PGDATABASE if needed.
#
# Usage:
#   ./scripts/wait-for-db.sh
#   PGHOST=comments-db PGPORT=5432 ./scripts/wait-for-db.sh   # from another Docker container on same network

set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-comments}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-60}"
SLEEP_SEC="${SLEEP_SEC:-1}"

if ! command -v pg_isready >/dev/null 2>&1; then
  echo "wait-for-db.sh: pg_isready not found. Install postgresql-client (e.g. apt install postgresql-client)." >&2
  exit 1
fi

for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; then
    echo "wait-for-db.sh: PostgreSQL is ready ($PGHOST:$PGPORT, db=$PGDATABASE)."
    exit 0
  fi
  echo "wait-for-db.sh: attempt $i/$MAX_ATTEMPTS — not ready, sleeping ${SLEEP_SEC}s..." >&2
  sleep "$SLEEP_SEC"
done

echo "wait-for-db.sh: timed out after $MAX_ATTEMPTS attempts." >&2
exit 1
