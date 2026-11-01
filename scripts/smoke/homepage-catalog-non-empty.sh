#!/usr/bin/env bash
# iter-38 §D.2 — Smoke: homepage /booking-request renders a non-empty service
# catalog.
#
# The catalog reaches the page as the `services` prop of the booking form,
# serialized into the inline RSC payload (`self.__next_f.push([1,"..."])`).
# Inside that JS string literal every quote is escaped, so the prop appears as
#   \"services\":[{\"id\":\"...\",...}]   (non-empty)
#   \"services\":[]                       (empty)
# A bare `"id"` grep can't work: it never matches the escaped payload, and
# the escaped form `\"id\"` also matches unrelated nav elements
# (`nav-toggle`, `nav-menu`). So match the `services` prop itself (an array
# that opens with an object vs. an empty array), with the
# backslash optional in case the payload is ever emitted unescaped.
#
# Usage: HOMEPAGE_BASE_URL=https://wardrobe-assistants.ch \
#        scripts/smoke/homepage-catalog-non-empty.sh
#   (Legacy fallback: BASE_URL is accepted if HOMEPAGE_BASE_URL is unset.)
#
# Offline mode: check a saved/built page instead of fetching it, e.g.
#   HOMEPAGE_HTML_FILE=apps/homepage/out/booking-request/index.html \
#     scripts/smoke/homepage-catalog-non-empty.sh
set -euo pipefail

if [[ -n "${HOMEPAGE_HTML_FILE:-}" ]]; then
  URL="$HOMEPAGE_HTML_FILE"
  if [[ ! -r "$URL" ]]; then
    echo "FAIL  $URL -> file not readable"
    exit 1
  fi
  html=$(<"$URL")
else
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
fi

# \\? = optional literal backslash before each quote.
# Only anchor on `[{`, not on the first key, so a change in the admin's key
# order can't turn a healthy catalog into a false failure.
non_empty='\\?"services\\?":\[\{'
empty='\\?"services\\?":\[\]'

# Here-strings, not `printf | grep -q`: with pipefail, grep -q exiting on the
# first match can SIGPIPE printf and turn a match into a failure.
if grep -Eq "$non_empty" <<<"$html"; then
  # Each catalog entry carries exactly one priceType; use it as the count.
  count=$(grep -Eo '\\?"priceType\\?":' <<<"$html" | wc -l | tr -d ' ' || true)
  echo "PASS  $URL -> non-empty services catalog ($count entries)"
  exit 0
elif grep -Eq "$empty" <<<"$html"; then
  echo "FAIL  $URL -> services catalog is empty (\"services\":[])"
  exit 1
else
  echo "FAIL  $URL -> no services prop found in the page payload"
  exit 1
fi
