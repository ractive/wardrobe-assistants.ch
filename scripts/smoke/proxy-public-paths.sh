#!/usr/bin/env bash
# iter-38 §D.1 — Smoke: admin proxy returns 200 (not 307) for public paths.
#
# Tests that the bunny.net proxy correctly serves the admin's public API
# endpoints without redirecting through auth. Run post-deploy against prod.
#
# Allows 429 (rate-limit) with a warning and continues. Any other non-200
# result fails the script.
#
# Only non-mutating GETs against existing public routes are exercised. A
# POST to /api/public/booking-requests would either always reject (Origin /
# payload gating) or, with a valid payload, create a real booking and
# dispatch notifications — neither is appropriate for a smoke. The
# 307-vs-200 proxy behaviour is sufficiently proven by the GET below.
#
# Usage: ADMIN_BASE_URL=https://admin.wardrobe-assistants.ch \
#        scripts/smoke/proxy-public-paths.sh
#   (Legacy fallback: BASE_URL is accepted if ADMIN_BASE_URL is unset.)
set -euo pipefail

BASE_URL="${ADMIN_BASE_URL:-${BASE_URL:-https://admin.wardrobe-assistants.ch}}"

fail=0

check() {
  local method="$1"
  local path="$2"

  local code
  code=$(curl -sS --max-time 15 -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$path" || echo "000")

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

exit "$fail"
