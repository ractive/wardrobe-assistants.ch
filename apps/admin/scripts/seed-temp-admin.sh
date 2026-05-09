#!/usr/bin/env bash
# Seed a throwaway admin user against an existing wardrobe-assistants-admin
# Magic Container app. Use for end-to-end verification (e.g. ff-rdp sign-in
# smoke tests). The user is created WITHOUT 2FA so a single email + password
# is enough to sign in.
#
# Usage:
#   apps/admin/scripts/seed-temp-admin.sh                # prod (default)
#   apps/admin/scripts/seed-temp-admin.sh <APP_ID> <CONTAINER_ID>
#
# Output: writes credentials to /tmp/wa-temp-admin-creds (chmod 600). Caller
# is responsible for deletion — see "Cleanup" at the end of the printed
# instructions.
#
# Requires: hoppy authenticated to bunny.net, npm/tsx, BUNNY_API_KEY in env
# (hoppy reads this).
#
# DO NOT run this script with `bash -x` / `set -x`: trace mode would print the
# generated password to the transcript, defeating the redaction logic below.

set -euo pipefail

APP_ID="${1:-h4vme6Uhod4W3Yu}"           # wardrobe-assistants-admin (prod)
CONTAINER_ID="${2:-h4vme6Uhod4W3Yu-63yu}"

# Fail fast on missing tooling rather than a confusing error mid-flight.
command -v hoppy >/dev/null || { echo "hoppy not found in PATH"; exit 1; }
command -v openssl >/dev/null || { echo "openssl not found in PATH"; exit 1; }
command -v python3 >/dev/null || { echo "python3 not found in PATH"; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SEED_SCRIPT="apps/admin/scripts/seed-temp-admin.ts"
[[ -f "${REPO_ROOT}/${SEED_SCRIPT}" ]] || {
  echo "Seed script not found at ${REPO_ROOT}/${SEED_SCRIPT}"
  exit 1
}

ENV_FILE="$(mktemp /tmp/wa-temp-admin-env.XXXXXX)"
CREDS_FILE="/tmp/wa-temp-admin-creds"
trap 'rm -f "${ENV_FILE}"' EXIT

# Fetch container env. `--reveal` returns plaintext values — same shape we
# pass to the seed script. The file is created with default umask, so tighten
# perms immediately.
hoppy container template env \
  --app-id "${APP_ID}" \
  --container-id "${CONTAINER_ID}" \
  --list --format json --reveal >"${ENV_FILE}"
chmod 600 "${ENV_FILE}"

EMAIL="iter-temp-admin-$(date +%s)@wardrobe-assistants.ch"
# Generated password: 24 base64 chars (alnum only) + Aa1! suffix to satisfy
# any "password requires upper/lower/digit/symbol" policy a future tightening
# might add. ~140 bits of entropy.
PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)Aa1!"

# Save creds first so an operator can recover them even if seeding fails halfway.
umask 077
{
  echo "Wardrobe Assistants temp admin (created by seed-temp-admin.sh)"
  echo "Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "App: ${APP_ID}  Container: ${CONTAINER_ID}"
  echo
  echo "Email:    ${EMAIL}"
  echo "Password: ${PASSWORD}"
  echo
  echo "Cleanup (run from a workstation with the prod DB env loaded):"
  echo "  npx -w @wardrobe-assistants/admin tsx -e \\"
  echo "    \"import { createDb } from '@wardrobe-assistants/db'; \\"
  echo "    import { schema } from '@wardrobe-assistants/db/schema'; \\"
  echo "    import { eq } from 'drizzle-orm'; \\"
  echo "    const db = createDb({ url: process.env.DATABASE_URL!, authToken: process.env.DATABASE_AUTH_TOKEN }); \\"
  echo "    const u = await db.select().from(schema.user).where(eq(schema.user.email, '${EMAIL}')).limit(1); \\"
  echo "    if (u.length) { await db.delete(schema.userProfile).where(eq(schema.userProfile.userId, u[0].id)); \\"
  echo "      await db.delete(schema.session).where(eq(schema.session.userId, u[0].id)); \\"
  echo "      await db.delete(schema.account).where(eq(schema.account.userId, u[0].id)); \\"
  echo "      await db.delete(schema.user).where(eq(schema.user.id, u[0].id)); \\"
  echo "      console.log('deleted ${EMAIL}'); }\""
} >"${CREDS_FILE}"
chmod 600 "${CREDS_FILE}"

# Hand env from the JSON file to a Python helper that injects the values into
# tsx's environment without ever shell-quoting them or printing them. Output
# from the seed script is regex-redacted before we echo it, so an accidental
# secret echo from a future code path can't leak.
set +e
_ENV_FILE="${ENV_FILE}" _REPO_ROOT="${REPO_ROOT}" \
  ADMIN_EMAIL="${EMAIL}" ADMIN_PASSWORD="${PASSWORD}" \
  python3 - <<'PY'
import json, os, re, subprocess, sys
with open(os.environ['_ENV_FILE']) as f:
    data = json.load(f)
env = os.environ.copy()
for e in data:
    env[e['name']] = e['value']
r = subprocess.run(
    ['npm', '-w', '@wardrobe-assistants/admin', 'exec', '--', 'tsx', 'scripts/seed-temp-admin.ts'],
    env=env, capture_output=True, text=True, cwd=os.environ['_REPO_ROOT'],
)
def redact(s):
    s = re.sub(r'eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+', '<JWT>', s)
    s = re.sub(r'[0-9a-f]{64}', '<hex64>', s)
    s = re.sub(r'[A-Za-z0-9+/=]{40,}', '<long>', s)
    return s
sys.stdout.write(redact(r.stdout))
sys.stderr.write(redact(r.stderr))
sys.exit(r.returncode)
PY
EXIT=$?
set -e
cat <<EOF

Temp admin seeded.
  Email:    ${EMAIL}
  Password: <see ${CREDS_FILE}>

Credentials saved to ${CREDS_FILE} (chmod 600). It also contains the
cleanup snippet you'll need to remove the user later.
EOF
exit "${EXIT}"
