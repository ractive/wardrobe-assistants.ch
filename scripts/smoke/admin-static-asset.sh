#!/usr/bin/env bash
# iter-41 §D — Smoke: admin `_next/static/` chunks resolve via the
# decoupled CDN (storage-backed pull zone), not via the Magic Container.
#
# Reads the chunk path from the live admin HTML so we don't have to keep a
# build-time hash in lockstep with prod. Asserts:
#   1) The admin HTML references chunk URLs at `ADMIN_STATIC_BASE_URL` (i.e.
#      the assetPrefix was inlined at build time and matches what we expect).
#   2) Fetching one of those chunk URLs returns 200 +
#      `content-type: application/javascript` (or `text/javascript`).
#
# Usage:
#   ADMIN_BASE_URL=https://admin.wardrobe-assistants.ch \
#   ADMIN_STATIC_BASE_URL=https://wardrobe-assistants-admin-static.b-cdn.net \
#   scripts/smoke/admin-static-asset.sh
#
# Defaults match the prod deployment if envs are unset.
set -euo pipefail

ADMIN_BASE_URL="${ADMIN_BASE_URL:-${BASE_URL:-https://admin.wardrobe-assistants.ch}}"
ADMIN_STATIC_BASE_URL="${ADMIN_STATIC_BASE_URL:-https://wardrobe-assistants-admin-static.b-cdn.net}"

fail=0

# Pull the login page (anonymous, always reachable) and look for a chunk
# reference at the expected origin. Use the unauthenticated /login route so
# we don't depend on a session cookie.
html=$(curl -sS --max-time 15 "$ADMIN_BASE_URL/login" || true)

if [[ -z "$html" ]]; then
  echo "FAIL  could not fetch $ADMIN_BASE_URL/login"
  exit 1
fi

# Extract the first chunk URL that points at the static-asset host. Pull
# zones append a trailing query/space, so stop at the first quote.
# Escape regex metacharacters in the base URL (mostly `.`) so a slightly
# different hostname can't accidentally match. `|| true` keeps the script
# from hard-exiting under `set -e` when grep finds no match — we want the
# helpful failure message below to print.
escaped_base=$(printf '%s' "$ADMIN_STATIC_BASE_URL" | sed 's/[.]/\\./g')
chunk_url=$(printf '%s' "$html" \
  | grep -oE "${escaped_base}/_next/static/[^\"'<> ]+\.js" \
  | head -1 || true)

if [[ -z "$chunk_url" ]]; then
  echo "FAIL  no chunk URL referencing $ADMIN_STATIC_BASE_URL found in $ADMIN_BASE_URL/login"
  echo "      (assetPrefix may not have been baked into the build — check ADMIN_ASSET_PREFIX in deploy.yml)"
  fail=1
else
  echo "FOUND chunk: $chunk_url"

  read -r code ctype < <(
    curl -sS --max-time 15 -o /dev/null \
      -w "%{http_code} %{content_type}\n" "$chunk_url" || echo "000 -"
  )

  if [[ "$code" == "200" && ( "$ctype" == application/javascript* || "$ctype" == text/javascript* ) ]]; then
    echo "PASS  GET chunk -> $code ($ctype)"
  else
    echo "FAIL  GET chunk -> $code ($ctype)"
    fail=1
  fi
fi

exit "$fail"
