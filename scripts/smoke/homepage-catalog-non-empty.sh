#!/usr/bin/env bash
# iter-38 §D.2 — Smoke: homepage /booking-request renders a non-empty service
# catalog. Fails if the catalog JSON is empty (zero `"id"` occurrences).
#
# Usage: BASE_URL=https://wardrobe-assistants.ch scripts/smoke/homepage-catalog-non-empty.sh
set -euo pipefail

BASE_URL="${BASE_URL:-https://wardrobe-assistants.ch}"
URL="$BASE_URL/booking-request"

html=$(curl -sS "$URL")
count=$(printf '%s' "$html" | grep -c '"id"' || true)

if [[ "$count" -gt 0 ]]; then
  echo "PASS  $URL -> $count \"id\" occurrences"
  exit 0
else
  echo "FAIL  $URL -> 0 \"id\" occurrences (catalog appears empty)"
  exit 1
fi
