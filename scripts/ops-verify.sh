#!/usr/bin/env bash
# Server/staging verification checklist for DB startup path.
# Runs the same flow documented in DEPLOYMENT.md:
#   1) docker compose up -d comments-db
#   2) pnpm db:preflight
#   3) pnpm db:deploy
#   4) restart API process (pm2)
#   5) curl /health/db
#
# Usage:
#   ./scripts/ops-verify.sh
#   PM2_API_NAME=max-api API_HEALTH_URL=http://127.0.0.1:3001/health/db ./scripts/ops-verify.sh
#   SKIP_PM2_RESTART=1 ./scripts/ops-verify.sh
#
# Env overrides:
#   REPO_ROOT         default: parent dir of this script
#   PM2_API_NAME      default: max-api
#   API_HEALTH_URL    default: http://127.0.0.1:3001/health/db
#   SKIP_PM2_RESTART  default: 0 (set 1 to skip pm2 restart)
#
# Requirements:
#   docker, curl, pnpm
#   pm2 (unless SKIP_PM2_RESTART=1)

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PM2_API_NAME="${PM2_API_NAME:-commentbot-api}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:3001/health/db}"
SKIP_PM2_RESTART="${SKIP_PM2_RESTART:-0}"

step() {
  echo
  echo "==> $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ops-verify.sh: required command not found: $cmd" >&2
    exit 1
  fi
}

run_checked() {
  local label="$1"
  shift
  echo "+ $*"
  if ! "$@"; then
    echo "ops-verify.sh: FAILED at step: $label" >&2
    exit 1
  fi
}

require_cmd docker
require_cmd curl
require_cmd pnpm
if [[ "$SKIP_PM2_RESTART" != "1" ]]; then
  require_cmd pm2
fi

step "Repository root"
echo "REPO_ROOT=$REPO_ROOT"
cd "$REPO_ROOT"

if [[ ! -f ".env.production" ]]; then
  echo "ops-verify.sh: .env.production not found in $REPO_ROOT (required for DATABASE_URL and runtime env)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ".env.production"
set +a

step "1/5 Start postgres service and inspect health"
run_checked "docker compose up comments-db" docker compose up -d comments-db
run_checked "docker compose ps" docker compose ps
run_checked "docker inspect comments-db health" docker inspect comments-db --format "{{json .State.Health}}"

step "2/5 Run db preflight (same as startup logic)"
run_checked "pnpm db:preflight" pnpm db:preflight

step "3/5 Apply server-safe Prisma migrations"
run_checked "pnpm db:deploy" pnpm db:deploy

step "4/5 Restart API process"
if [[ "$SKIP_PM2_RESTART" == "1" ]]; then
  echo "SKIP_PM2_RESTART=1 -> skipping pm2 restart."
else
  run_checked "pm2 restart" pm2 restart "$PM2_API_NAME" --update-env
  run_checked "pm2 logs" pm2 logs "$PM2_API_NAME" --lines 30 --nostream
fi

step "5/5 Smoke health check"
API_HEALTH_URL="http://127.0.0.1:3001/health/db"
echo "health_url=$API_HEALTH_URL"
max_attempts=10
sleep_sec=2
last_http_code=""

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  tmp="$(mktemp)"
  http_code="$(curl -sS -o "$tmp" -w "%{http_code}" "$API_HEALTH_URL" || true)"
  body="$(cat "$tmp")"
  rm -f "$tmp"

  echo "smoke attempt $attempt/$max_attempts: http_code=$http_code"
  if [[ "$http_code" == "200" ]]; then
    echo "smoke success: /health/db returned HTTP 200"
    break
  fi

  last_http_code="$http_code"
  if [[ "$attempt" -lt "$max_attempts" ]]; then
    echo "smoke retry in ${sleep_sec}s; latest body: $body"
    sleep "$sleep_sec"
  fi
done

if [[ "${http_code:-}" != "200" ]]; then
  echo "ops-verify.sh: /health/db did not return HTTP 200 after ${max_attempts} attempts (last=$last_http_code)" >&2
  exit 1
fi

echo
echo "ops-verify.sh: OK — server DB startup path is healthy."
