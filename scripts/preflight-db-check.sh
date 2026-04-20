#!/usr/bin/env bash
# Wait for PostgreSQL, then verify the target database exists (pg_database).
#
# Environment (defaults align with docker-compose.yml):
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (name to check; default: comments)
#
# Usage:
#   export PGPASSWORD=postgres
#   ./scripts/preflight-db-check.sh
#
# Requires: postgresql-client (`pg_isready`, `psql`).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-comments}"

if ! command -v psql >/dev/null 2>&1; then
  echo "preflight-db-check.sh: psql not found. Install postgresql-client." >&2
  exit 1
fi

"$ROOT/scripts/wait-for-db.sh"

export PGPASSWORD="${PGPASSWORD:-postgres}"
escaped="${PGDATABASE//\'/''}"
Q="SELECT 1 FROM pg_database WHERE datname = '${escaped}';"
if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -Atqc "$Q" | grep -qx 1; then
  echo "preflight-db-check.sh: database \"$PGDATABASE\" exists."
  exit 0
fi

echo "preflight-db-check.sh: database \"$PGDATABASE\" does NOT exist. Create it or fix POSTGRES_DB / volume (see DEPLOYMENT.md)." >&2
exit 1
