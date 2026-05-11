#!/usr/bin/env bash
# Provision the three VAPID env vars on the admin Magic Container.
#
# VAPID lives outside OpenTofu state (see containers.tf header) — this
# script is the canonical way to set or rotate the keys. Rotation
# invalidates every existing browser subscription, so prefer "set once
# and back up the keypair" over "rotate routinely".
#
# Usage:
#   infra/terraform/scripts/set-vapid-env.sh        # generates new keypair
#   infra/terraform/scripts/set-vapid-env.sh <path> # uses keypair from JSON file
#
# Requires: hoppy, jq, npx (web-push package fetched on demand).
# BUNNY_API_KEY must be set in the environment.

set -euo pipefail

APP_ID="h4vme6Uhod4W3Yu"
CONTAINER_ID="h4vme6Uhod4W3Yu-63yu"
VAPID_SUBJECT="${VAPID_SUBJECT:-mailto:info@wardrobe-assistants.ch}"

if [[ -n "${1:-}" ]]; then
  KEYS_FILE="$1"
  echo "Using existing keypair: $KEYS_FILE"
else
  KEYS_FILE=~/secrets-vapid-wardrobe-$(date +%Y%m%d-%H%M%S).json
  umask 077
  echo "Generating VAPID keypair → $KEYS_FILE"
  npx --yes web-push generate-vapid-keys --json > "$KEYS_FILE"
  chmod 600 "$KEYS_FILE"
fi

PUB=$(jq -r .publicKey  "$KEYS_FILE")
PRIV=$(jq -r .privateKey "$KEYS_FILE")

# Shape checks mirror apps/admin/src/lib/env.ts regexes.
[[ "$PUB"  =~ ^[A-Za-z0-9_-]{80,90}$ ]] || { echo "ERR: public key wrong shape"; exit 1; }
[[ "$PRIV" =~ ^[A-Za-z0-9_-]{40,46}$ ]] || { echo "ERR: private key wrong shape"; exit 1; }

echo "Pushing to admin app env (redacted)…"
hoppy --quiet -y container template env \
  --app-id "$APP_ID" \
  --container-id "$CONTAINER_ID" \
  --add "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$PUB" \
  --add "VAPID_PRIVATE_KEY=$PRIV" \
  --add "VAPID_SUBJECT=$VAPID_SUBJECT"

echo "Redeploying…"
hoppy container app deploy --id "$APP_ID"

echo ""
echo "Done. Keypair backed up at: $KEYS_FILE"
echo "Move it to your password manager and delete the local copy."
