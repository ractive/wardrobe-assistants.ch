#!/usr/bin/env bash
# iter-38 §D.2 — Smoke: homepage /booking-request renders a non-empty service
# catalog. Fails if the catalog JSON is empty (zero `"id"` occurrences).
#
# Usage: HOMEPAGE_BASE_URL=https://wardrobe-assistants.ch \
#        scripts/smoke/homepage-catalog-non-empty.sh
#   (Legacy fallback: BASE_URL is accepted if HOMEPAGE_BASE_URL is unset.)
set -euo pipefail

BASE_URL="${HOMEPAGE_BASE_URL:-${BASE_URL:-https://wardrobe-assistants.ch}}"
# Homepage is `output: "export"` + `trailingSlash: true` — request the
# trailing-slash form directly to avoid a 308 redirect.
URL="$BASE_URL/booking-request/"

resp=$(curl -sSL --max-time 15 -w $'\n%{http_code}' "$URL" || true)
html="${resp%$'\n'*}"
code="${resp##*$'\n'}"

if [[ "$code" != "200" ]]; then
  echo "FAIL  $URL -> HTTP $code"
  exit 1
fi

count=$(printf '%s' "$html" | grep -c '"id"' || true)

if [[ "$count" -gt 0 ]]; then
  echo "PASS  $URL -> $count \"id\" occurrences"
  exit 0
else
  echo "FAIL  $URL -> 0 \"id\" occurrences (catalog appears empty)"
  exit 1
fi
