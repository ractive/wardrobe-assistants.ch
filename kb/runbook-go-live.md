---
title: Runbook — go live on bunny.net (homepage + admin)
type: runbook
status: in-progress
related: iteration-09-go-live-bunny-infra.md
---

# Runbook — go live on bunny.net (homepage + admin)

The replayable script for the cutover described in `kb/iteration-09-go-live-bunny-infra.md`. This file is the PR-diff-shaped artefact for iter-9: a record of what the operator actually ran, what came back, and any deviations from the iteration plan. Future operators (staging, DR, or a re-do after a rollback) should be able to follow this top-to-bottom.

## How to use this runbook

1. Read the iteration plan first (`kb/iteration-09-go-live-bunny-infra.md`) to understand the why and the risk model.
2. Confirm pre-flight items.
3. For each step, paste the command, run it, and capture the output snippet under "Output" — even if it's just the success line. Real outputs from the first run are checked in alongside this runbook so operators on a re-do can see what "good" looks like.
4. Note any deviation from the plan inline as `> Deviation:` blocks.
5. After the cutover, append the verification curl outputs, then mark the runbook `status: complete`.

## Pre-flight state

Snapshot of bunny.net before any provisioning was attempted: see `kb/runbook-go-live-pre-state.json`. Keep it for rollback reference.

Confirmations needed before kicking off:

- [x] `iter-8` rename merged on `origin/main` (commit `9d0bfbe`, merged in `32bed0a`).
- [x] `BUNNY_API_KEY` exported in operator's shell.
- [x] `hoppy auth check` — API key valid, balance positive, billing enabled.
- [ ] Cutover window agreed with stakeholders. The detach-then-reattach gap breaks the live site for 1–10 min until Let's Encrypt issues against the new Pull Zone. Schedule for a low-traffic hour.

## Homepage infrastructure

### 1. Storage Zone

```bash
hoppy storage-zone create \
  --name wardrobe-assistants-homepage \
  --region DE \
  --zone-tier 0 \
  --yes
```

Capture from the response:

- `Id` → `BUNNY_STORAGE_ZONE_ID` (kept locally; never leaves the operator's notes).
- `Password` → `BUNNY_STORAGE_PASSWORD` (GitHub secret).
- `ReadOnlyPassword` → reserved for future homepage CI build that streams from storage; not used in iter-9.
- `StorageHostname` → record but not currently used; the deploy action in `.github/workflows/deploy.yml` references the zone by name.

Output:

```text
TODO: paste hoppy output here
```

### 2. Pull Zone (curl workaround)

`hoppy pull-zone create` cannot bind to a Storage Zone (see `kb/hoppy-bug-report-pullzone-storagezone.md` issue 1). Use the REST API directly:

```bash
STORAGE_ZONE_ID=<from step 1>
curl -X POST https://api.bunny.net/pullzone \
  -H "Content-Type: application/json" \
  -H "AccessKey: $BUNNY_API_KEY" \
  -d "{\"Name\":\"wardrobe-assistants\",\"StorageZoneId\":${STORAGE_ZONE_ID},\"Type\":0}"
```

Capture `Id` from the response → `BUNNY_PULL_ZONE_ID` (GitHub secret) and `<new-pz-id>` for subsequent hostname commands.

Output:

```text
TODO: paste curl response here
```

### 3. Detach hostnames from old auto Pull Zone

> **This breaks the live site immediately.** The old Magic Container `lzGns1pTQLcqOGM` keeps running but has no public hostname. From this point forward, every minute counts.

```bash
hoppy pull-zone hostname remove --id 5719318 --hostname wardrobe-assistants.ch --yes
hoppy pull-zone hostname remove --id 5719318 --hostname www.wardrobe-assistants.ch --yes
```

Output:

```text
TODO: paste hoppy output here
```

### 4. Attach hostnames to new Pull Zone

```bash
NEW_PZ=<new-pz-id from step 2>
hoppy pull-zone hostname add --id $NEW_PZ --hostname wardrobe-assistants.ch --yes
hoppy pull-zone hostname add --id $NEW_PZ --hostname www.wardrobe-assistants.ch --yes
```

Output:

```text
TODO: paste hoppy output here
```

### 5. DNS swap

DNS zone is `775662`. Records to update (verified in pre-state):

| Id | Name | From | To |
|---|---|---|---|
| 16538536 | `@` (apex) | `mc-tug74k9naa.b-cdn.net` | `wardrobe-assistants.b-cdn.net` |
| 16538537 | `www` | `mc-tug74k9naa.b-cdn.net` | `wardrobe-assistants.b-cdn.net` |

```bash
hoppy dns record update --zone-id 775662 --id 16538536 --value wardrobe-assistants.b-cdn.net --yes
hoppy dns record update --zone-id 775662 --id 16538537 --value wardrobe-assistants.b-cdn.net --yes
```

Output:

```text
TODO: paste hoppy output here
```

### 6. TLS issuance

```bash
hoppy pull-zone hostname load-free-cert --hostname wardrobe-assistants.ch --yes
hoppy pull-zone hostname load-free-cert --hostname www.wardrobe-assistants.ch --yes
```

Note: `load-free-cert` does not take `--id` (it auto-discovers the PZ from the hostname — see `kb/hoppy-usage-report.md` issue 4).

If Let's Encrypt is rate-limited, retry every 60s until issued. Plan a 10-min buffer.

Output:

```text
TODO: paste hoppy output here
```

### 7. Force SSL

```bash
hoppy pull-zone hostname force-ssl --id $NEW_PZ --hostname wardrobe-assistants.ch --enabled true --yes
hoppy pull-zone hostname force-ssl --id $NEW_PZ --hostname www.wardrobe-assistants.ch --enabled true --yes
```

Output:

```text
TODO: paste hoppy output here
```

### 8. GitHub repo configuration

Set as **secrets** (the homepage workflow reads each of these as `${{ secrets.* }}` — see `.github/workflows/deploy.yml`):

- `BUNNY_STORAGE_PASSWORD` — `Password` from step 1.
- `BUNNY_API_KEY` — already configured at the org level; verify it survived org/repo permission boundaries.
- `BUNNY_STORAGE_ZONE_NAME=wardrobe-assistants-homepage` — workflow reads as `${{ secrets.BUNNY_STORAGE_ZONE_NAME }}`.
- `BUNNY_PULL_ZONE_ID=<new-pz-id>` — workflow reads as `${{ secrets.BUNNY_PULL_ZONE_ID }}`.
- `BUNNY_REGISTRY`, `BUNNY_REGISTRY_USERNAME`, `BUNNY_REGISTRY_PASSWORD` — admin Docker push credentials (admin section, but set together to avoid two trips).
- `DATABASE_URL`, `DATABASE_AUTH_TOKEN_FULL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` — admin runtime (admin section).

Set as **variables** (workflow reads via `${{ vars.* }}`):

- `ADMIN_APP_ID=<from admin step 4>` — bunny Magic Container app id; non-sensitive identifier baked into the registry tag and the deploy POST URL.

> Note: the homepage zone identifiers (`BUNNY_STORAGE_ZONE_NAME`, `BUNNY_PULL_ZONE_ID`) are not strictly secret, but the workflow reads them from `secrets` for consistency with the password/API-key triple they sit next to. Don't promote them to `vars` without also editing `.github/workflows/deploy.yml`.

Trigger the first homepage deploy by pushing an empty commit to `main` (or merging this PR — both fire `verify` then `build-homepage`).

```bash
# After merging the PR, watch:
gh run watch
curl -I https://wardrobe-assistants.b-cdn.net/index.html  # confirms storage upload before DNS verification
```

Output:

```text
TODO: paste deploy log + first 200 line for index.html
```

## Admin infrastructure

### 1. libSQL DB

Provision via the bunny.net dashboard (Database → Create) — bunny's CLI does not yet expose Database. Region: EU (DE recommended for proximity to the admin container).

Capture three values:

- `DATABASE_URL` — `libsql://<host>/<db>` form.
- `DATABASE_AUTH_TOKEN_FULL` — full-access token, used by the admin runtime.
- `DATABASE_AUTH_TOKEN_READONLY` — read-only token. Reserved for a future homepage CI build step (e.g. fetching crew data at build time). Not used in iter-9 but mint it now to avoid a second trip.

Store all three in 1Password / pass under labelled entries — see "Token confusion" risk in the iteration plan.

Output:

```text
TODO: paste DB connection params (redacted) here
```

### 2. Run migrations

```bash
cd packages/db
DATABASE_URL=<from step 1> DATABASE_AUTH_TOKEN=<full token> npx drizzle-kit migrate
```

> Verify schema landed: connect with `turso db shell` (or libsql CLI) and `.tables` should list the iter-7b auth + admin tables.

Output:

```text
TODO: paste migration log here
```

### 3. Seed first admin user

Run iter-7b's seed script with the operator's email:

```bash
cd apps/admin
DATABASE_URL=<from step 1> DATABASE_AUTH_TOKEN=<full token> \
  npm run seed -- --email <operator-email>
```

The script prints a bootstrap TOTP enrollment URL/QR — save it locally (1Password attachment, scratch directory). **Do not commit.** It expires after first use; if the operator doesn't enrol on the first sign-in, re-run the seed.

Output:

```
TODO: note "seed completed" and that QR was saved to local 1Password entry "wardrobe-assistants admin bootstrap TOTP"
```

### 4. Magic Container app

```bash
hoppy container app create \
  --name wardrobe-assistants-admin \
  --runtime-type docker \
  --region DE \
  --min 1 --max 1 \
  --registry-id <BUNNY_REGISTRY_ID> \
  --image-namespace ractive \
  --image-name wardrobe-assistants-admin \
  --image-tag latest
```

Capture the new app's `Id` → `ADMIN_APP_ID` (GitHub variable, not secret — workflow reads via `${{ vars.ADMIN_APP_ID }}`).

Configure env vars on the container template (via `hoppy container app update` or the dashboard — the CLI surface for env-var edits is limited; document whichever path was used):

- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN` (the full token)
- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`. 32+ bytes of secure randomness; rotation invalidates all sessions, so capture it once into 1Password before pasting it in.
- `BETTER_AUTH_URL=https://admin.wardrobe-assistants.ch`
- `RESEND_API_KEY` — mint at https://resend.com/api-keys, scope to the admin app's domain.
- `EMAIL_FROM=admin@wardrobe-assistants.ch`

Output:

```text
TODO: paste container app create response (id + endpoint hostname)
```

### 5. Hostname + TLS

After `container endpoint add --cdn` ran during step 4 (or manually if needed), bind the public hostname:

```bash
ADMIN_PZ=<auto-pz id from `hoppy container endpoint list --app-id $ADMIN_APP_ID`>
hoppy pull-zone hostname add --id $ADMIN_PZ --hostname admin.wardrobe-assistants.ch --yes
hoppy pull-zone hostname load-free-cert --hostname admin.wardrobe-assistants.ch --yes
hoppy pull-zone hostname force-ssl --id $ADMIN_PZ --hostname admin.wardrobe-assistants.ch --enabled true --yes
```

Output:

```text
TODO: paste hoppy output here
```

### 6. DNS

```bash
ADMIN_CDN_HOST=mc-<id>.b-cdn.net   # from `hoppy container endpoint list --app-id $ADMIN_APP_ID`
hoppy dns record add \
  --zone-id 775662 \
  --type CNAME \
  --name admin \
  --value $ADMIN_CDN_HOST \
  --yes
```

Use plain `CNAME`, not `PullZone` — the latter rejects Magic-Container auto Pull Zones (see `kb/hoppy-usage-report.md` issue 2).

Output:

```text
TODO: paste hoppy output here
```

### 7. GitHub secrets/vars (admin) and first deploy

Already covered in homepage step 8 — verify all admin-relevant entries are set:

- secrets: `DATABASE_URL`, `DATABASE_AUTH_TOKEN_FULL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `BUNNY_REGISTRY`, `BUNNY_REGISTRY_USERNAME`, `BUNNY_REGISTRY_PASSWORD`.
- vars: `ADMIN_APP_ID`.

Trigger the first admin Docker build/push/roll. Either merge a doc-touching commit on a non-`kb/` path, or push an empty commit. The `build-admin` job's paths-filter excludes `kb/**` and `*.md`, so a runbook-only edit will skip the build.

Output:

```text
TODO: paste workflow run URL and first /sign-in HTTP/2 response
```

## Verification

After all steps complete:

```bash
curl -I https://wardrobe-assistants.ch
curl -I https://www.wardrobe-assistants.ch
curl -I https://admin.wardrobe-assistants.ch/sign-in
```

Expectations:

- Homepage apex + www: `HTTP/2 200`, `cache-control` from bunny edge, no `mc-tug74k9naa` references in headers.
- Admin: `HTTP/2 200` on `/sign-in`, `Set-Cookie` scoped to `Domain=admin.wardrobe-assistants.ch` (or implicit host-only).

Browser checks:

- Homepage: `/`, `/services`, `/impressum`, `/datenschutz` all render; no mixed-content; favicon loads.
- Admin: sign in with seeded credentials, complete TOTP enrollment, land on "Hello, {email}".

Output:

```text
TODO: paste curl -I responses + admin sign-in screenshot path
```

## Decommission (T+24h)

After 24h of healthy homepage serving:

```bash
# Confirm no DNS records still reference the old container hostname
hoppy --format text dns record list --zone-id 775662 | grep mc-tug74k9naa || echo "clean"

# Delete old Magic Container app
hoppy container app delete --id lzGns1pTQLcqOGM --yes

# Verify the auto Pull Zone was reaped
curl -s https://api.bunny.net/pullzone/5719318 -H "AccessKey: $BUNNY_API_KEY"
# Expect 404. If still present, delete:
curl -X DELETE https://api.bunny.net/pullzone/5719318 -H "AccessKey: $BUNNY_API_KEY"
```

Output:

```text
TODO: paste delete responses
```

## Rollback

If TLS does not issue within 15 min, or the new Pull Zone returns errors:

1. Re-attach hostnames to the old auto Pull Zone:
   ```bash
   hoppy pull-zone hostname add --id 5719318 --hostname wardrobe-assistants.ch --yes
   hoppy pull-zone hostname add --id 5719318 --hostname www.wardrobe-assistants.ch --yes
   ```
2. Revert DNS records 16538536 and 16538537 back to `mc-tug74k9naa.b-cdn.net` (values captured in `runbook-go-live-pre-state.json`).
3. The old Magic Container is still running — no restart needed. Site should resolve within DNS TTL (records use TTL 0 → auto, in practice a few minutes).
4. Leave the new Storage Zone and Pull Zone in place; debug at leisure. Delete only after confirming root cause is unrelated to the new resources.

## Deviations from the iteration plan

> _List any places where the operator chose a different command, ordering, or value than what `kb/iteration-09-go-live-bunny-infra.md` prescribed. Future operators reading this for staging/DR need to see what really happened._

- (none yet — populate during cutover)
