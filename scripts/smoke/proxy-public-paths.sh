#!/usr/bin/env bash
# iter-38 §D.1 — Smoke: admin proxy returns 200 (not 307) for public paths.
#
# Tests that the bunny.net proxy correctly serves the admin's public API
# endpoints without redirecting through auth. Run post-deploy against prod.
#
# Allows 429 (rate-limit) with a warning and continues. Any other non-200
# result fails the script.
#
# Usage: BASE_URL=https://admin.wardrobe-assistants.ch scripts/smoke/proxy-public-paths.sh
set -euo pipefail

BASE_URL="${BASE_URL:-https://admin.wardrobe-assistants.ch}"

fail=0

check() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  local args=(-sS -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$path")
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi

  local code
  code=$(curl "${args[@]}" || echo "000")

  if [[ "$code" == "200" ]]; then
    echo "PASS  $method $path -> $code"
  elif [[ "$code" == "429" ]]; then
    echo "WARN  $method $path -> 429 (rate-limited; continuing)"
  else
    echo "FAIL  $method $path -> $code"
    fail=1
  fi
}

check GET /api/public/services
check GET /api/public/health
# Minimal throwaway payload — server should validate and either accept (200)
# or reject with a 4xx. 307 indicates the proxy is sending us to login first,
# which is the failure mode we're guarding against.
check POST /api/public/booking-requests '{"smoke":"iter-38-smoke","_intent":"healthcheck"}'

exit "$fail"
