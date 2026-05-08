---
title: Iteration 9 — Go live on bunny.net (homepage + admin)
type: iteration
status: done
order: 10
---

# Iteration 9 — Go live on bunny.net (homepage + admin)

The first user-visible-on-the-internet iteration since iter-7a/7b/8 landed the code. Provision all bunny.net infrastructure for both deploy targets, flip DNS, watch first deploys land green, decommission the old Magic Container.

Two surfaces, two deploy topologies:

- **Homepage** — static export → bunny Storage Zone → bunny Pull Zone → `wardrobe-assistants.ch` / `www.wardrobe-assistants.ch`. No runtime, no DB.
- **Admin** — Docker image → bunny Magic Container → `admin.wardrobe-assistants.ch`. Runtime, libSQL DB, Better Auth, Resend.

Origin-scoped cookies are the security payoff: an XSS on the public homepage cannot read admin session tokens because they live on a different origin.

## Context — why this iteration is operational, not code

By the time this iteration starts, iter-7a + iter-7b + iter-8 have already shipped the code, the CI workflows, and the rename. What's missing is everything that lives on bunny.net (and in GitHub's repo settings) — provisioning that is fundamentally **side-effectful, manual-confirmation-heavy, destructive in places**, and outside the PR diff.

This plan is the runbook. The PR diff for this iteration is small (mostly a `kb/runbook-go-live.md` capture and possibly minor CI tweaks); the value is in the discipline of executing the steps in the right order.

A previous attempt during iter-7a (2026-05-05) created and rolled back the homepage Storage Zone + Pull Zone before any DNS change landed. That attempt surfaced two `hoppy` bugs documented in `kb/hoppy-bug-report-pullzone-storagezone.md` — most importantly `hoppy pull-zone create` cannot bind to a Storage Zone, so a `curl` fallback is required.

## Pre-flight (before any provisioning)

- [x] Confirm `iter-8` (rename) is merged on `origin/main`. (commit `9d0bfbe`, merged in `32bed0a`)
- [x] Confirm `BUNNY_API_KEY` is exported in the local environment.
- [x] `hoppy auth check` passes.
- [x] Capture current state: `hoppy --format json container app list`, `hoppy --format text dns record list --zone-id 775662`, `hoppy --format text storage-zone list`, `hoppy --format text pull-zone list`. Save to `kb/runbook-go-live-pre-state.json` for rollback reference.
- [ ] Confirm with the user: which window is acceptable for the live-site break? The cutover window between detaching hostnames from the old Magic Container's auto Pull Zone and Let's Encrypt issuing certs on the new Pull Zone is typically 1–10 min. HTTP-only access is broken until the cert lands; HTTPS-only browsers see TLS errors during this window.

## Rollback (read this before the homepage Storage/Pull Zone steps)

If TLS does not issue within ~15 min on the new Pull Zone, or the new PZ returns errors after DNS swap:

1. Re-attach the old auto Pull Zone (id `5719318`): `hoppy pull-zone hostname add --id 5719318 --hostname wardrobe-assistants.ch --yes` and the same for `www.wardrobe-assistants.ch`. Hostnames captured in `kb/runbook-go-live-pre-state.json` under `pull_zones_hidden`.
2. Revert DNS records `16538536` (apex) and `16538537` (`www`) in zone `775662` back to `mc-tug74k9naa.b-cdn.net` (original values captured in `runbook-go-live-pre-state.json`).
3. Confirm `https://wardrobe-assistants.ch` resolves to the old Magic Container homepage. The container is still running — no restart needed.
4. **Preserve**, do not delete, the new Storage Zone, Pull Zone, and admin Magic Container so the failure can be diagnosed at leisure. Capture the failure mode (exact error, hoppy command, timestamp) into `kb/runbook-go-live-pre-state.json` (or a sibling `…-rollback.json`) for the post-mortem.

The runbook (`kb/runbook-go-live.md` § Rollback) carries the same procedure with copy-pasteable commands; this section exists so an operator hitting trouble on this iteration plan doesn't have to context-switch to find the rollback steps.

## Scope — homepage infrastructure [0/8]

- [ ] **Storage Zone:** `hoppy storage-zone create --name wardrobe-assistants-homepage --region DE --zone-tier 0 --yes`. Capture `Id`, `Password`, `ReadOnlyPassword` from the response.
- [ ] **Pull Zone:** Use the `curl` workaround (hoppy 0.1.0 cannot bind StorageZoneId via CLI):
  ```bash
  curl -X POST https://api.bunny.net/pullzone \
    -H "Content-Type: application/json" \
    -H "AccessKey: $BUNNY_API_KEY" \
    -d '{"Name":"wardrobe-assistants","StorageZoneId":<storage-id>,"Type":0}'
  ```
  Capture `Id` of the new Pull Zone.
- [ ] **Detach hostnames from old PZ:** `hoppy pull-zone hostname remove --id 5719318 --hostname wardrobe-assistants.ch --yes` and the same for `www.wardrobe-assistants.ch`. **This breaks the live site immediately.** Old container `lzGns1pTQLcqOGM` keeps running but has no public hostname.
- [ ] **Attach hostnames to new PZ:** `hoppy pull-zone hostname add --id <new-pz-id> --hostname wardrobe-assistants.ch --yes` and the same for `www.wardrobe-assistants.ch`.
- [ ] **DNS swap:** Update DNS records `16538536` (apex `@`) and `16538537` (`www`) in zone `775662` from `mc-tug74k9naa.b-cdn.net` to `wardrobe-assistants.b-cdn.net` via `hoppy dns record update`.
- [ ] **TLS:** `hoppy pull-zone hostname load-free-cert --hostname wardrobe-assistants.ch --yes` and the same for `www.wardrobe-assistants.ch`. Wait for issuance; retry if Let's Encrypt is rate-limited.
- [ ] **Force SSL:** `hoppy pull-zone hostname force-ssl --id <new-pz-id> --hostname wardrobe-assistants.ch --enabled true --yes` and the same for `www`.
- [ ] **GitHub secrets:** Set in the repo: `BUNNY_STORAGE_ZONE_NAME=wardrobe-assistants-homepage`, `BUNNY_STORAGE_PASSWORD=<from create response>`, `BUNNY_PULL_ZONE_ID=<new-pz-id>`. `BUNNY_API_KEY` should already exist. Trigger an empty commit on `main` to fire `build-homepage` and upload the first `out/`.

## Scope — admin infrastructure [0/7]

- [ ] **libSQL DB:** Provision on bunny.net Database, EU region. Mint two tokens — full-access for admin runtime, read-only for the future homepage CI build step (unused in this iteration but plumbed). Capture `DATABASE_URL`, `DATABASE_AUTH_TOKEN_FULL`, `DATABASE_AUTH_TOKEN_READONLY`.
- [ ] **Run migrations:** Point iter-7b's `packages/db` Drizzle migrations at the new DB. Verify schema landed.
- [ ] **Seed first admin user:** Run iter-7b's seed script with the user's email. Save the bootstrap TOTP enrollment QR locally; do not commit.
- [ ] **Generate runtime secrets before container create:** `BETTER_AUTH_SECRET` via `openssl rand -base64 32` (capture into 1Password — rotation invalidates sessions). Mint `RESEND_API_KEY` at https://resend.com/api-keys. Confirm libSQL `DATABASE_AUTH_TOKEN_FULL` from the Database step is in hand. These values feed both the `hoppy container app create` env config and the GitHub secrets list.
- [ ] **Magic Container app:** `hoppy container app create` for the admin app, region DE. Configure image registry (bunny container registry, `${{ secrets.BUNNY_REGISTRY }}/${{ vars.ADMIN_APP_ID }}`), entry point, env vars (`DATABASE_URL`, `DATABASE_AUTH_TOKEN_FULL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://admin.wardrobe-assistants.ch`, `RESEND_API_KEY`, `EMAIL_FROM=admin@wardrobe-assistants.ch`). Capture the new app's `Id` for the `ADMIN_APP_ID` GitHub variable.
- [ ] **Hostname + TLS:** Bind `admin.wardrobe-assistants.ch` to the admin container's auto Pull Zone; enable auto-TLS.
- [ ] **DNS:** Add CNAME `admin` → the admin container's CDN hostname (`mc-<id>.b-cdn.net`) in zone `775662`.
- [ ] **GitHub secrets:** Set `ADMIN_APP_ID` (Magic Container app id), `ADMIN_DOCKER_REGISTRY_ID`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN_FULL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`. Trigger first admin Docker build/push/roll.

## Scope — verification [0/5]

- [ ] `curl -I https://wardrobe-assistants.ch` returns `200`, `HTTP/2`, `cache-control` header from bunny edge.
- [ ] `curl -I https://www.wardrobe-assistants.ch` same.
- [ ] Browser test: homepage loads on apex + www; all four pages (home, services, impressum, datenschutz) render; no mixed-content warnings.
- [ ] `curl -I https://admin.wardrobe-assistants.ch/sign-in` returns `200`; sign-in page renders; Better Auth session cookie scoped to `admin.wardrobe-assistants.ch`.
- [ ] Admin TOTP-gated dashboard: sign in with seeded credentials, complete TOTP enrollment, land on "Hello, {email}".

## Scope — decommission [0/2]

- [ ] After 24h of healthy homepage serving from the new Pull Zone, delete the old Magic Container app `lzGns1pTQLcqOGM`. Verify no DNS records still point at `mc-tug74k9naa.b-cdn.net`.
- [ ] Delete the now-orphaned auto Pull Zone `5719318` if bunny doesn't garbage-collect it on app deletion.

## Scope — runbook capture (the only PR-diff-shaped artefact) [2/2]

- [x] Write `kb/runbook-go-live.md` capturing the actual commands run, with output snippets and any deviations from this plan. Future operators should be able to replay this for staging or DR. _(Scaffold landed in this iter-9 PR; operator fills in `Output:` blocks during the live cutover and re-pushes a follow-up commit, then flips status to `complete`.)_
- [x] Update `kb/hoppy-usage-report.md` with notes on what worked / what didn't during this iteration (cross-reference `kb/hoppy-bug-report-pullzone-storagezone.md`). _(Added iter-9 follow-up section: re-confirmed both bugs, recorded two new gaps — Database CLI absent, Magic Container env-var management dashboard-only.)_

## Out of scope

- **Production-grade observability** — log forwarding, alerting on the admin container, metrics dashboards. A later iteration. For now, `hoppy container app overview` + bunny dashboard suffice.
- **Database backups / DR** — bunny.net Database has built-in snapshots; we'll trust those for now.
- **CDN cache rules** — defaults are fine for a static site.
- **Staging environment** — single-environment deploy is intentional at this stage.
- **Custom error pages** — bunny defaults are acceptable.
- **Email deliverability hardening** — SPF/DKIM/DMARC for Resend on the apex domain. A separate small iteration; doesn't block admin going live since transactional email volume is near-zero on day one.

## Critical resources (post-iteration)

| Resource | Identifier | Notes |
|---|---|---|
| Homepage Storage Zone | `wardrobe-assistants-homepage` (id TBD) | Standard tier, DE region |
| Homepage Pull Zone | `wardrobe-assistants` (id TBD) | StorageZoneId-bound; apex + www; auto-TLS |
| Admin Magic Container | `wardrobe-assistants-admin` (id TBD) | Single region DE, Docker Hub origin |
| libSQL DB | bunny.net Database (id TBD) | EU region; two tokens |
| DNS zone | `775662` (`wardrobe-assistants.ch`) | apex, `www`, `admin` CNAMEs |
| GitHub secrets | listed above | Treat as the source of truth for cutover state |

## Risks / things that bite

- **Hostname-detach-then-reattach window** — site is broken from the moment the apex hostname leaves PZ `5719318` until TLS lands on the new PZ. User has accepted this. Schedule for a low-traffic hour.
- **Let's Encrypt rate limits** — first-time issuance for new pull zones can be slow if the apex domain has been hammered with cert requests recently. Plan a 10-min buffer.
- **bunny CDN caching of the broken state** — the failed HTTPS responses may cache briefly on bunny's edge. Use `hoppy purge` against the apex URL after cert issuance if 1xx-3xx responses don't appear within a minute.
- **Magic Container cold start** — first `admin.wardrobe-assistants.ch` request after deploy may take 5–15s. Subsequent requests are fast.
- **Forgotten GitHub secrets** — `build-homepage` will silently fail to upload if `BUNNY_STORAGE_PASSWORD` is missing or wrong. Verify upload logs after the first run.
- **Token confusion** — three different tokens (`BUNNY_API_KEY` for admin operations, `BUNNY_STORAGE_PASSWORD` for storage zone uploads, libSQL `DATABASE_AUTH_TOKEN_*` for DB). Label them clearly in 1Password / pass.

## Done when

- `https://wardrobe-assistants.ch` and `https://www.wardrobe-assistants.ch` serve the static homepage from bunny's edge with valid TLS. ✅ (cdn-pullzone `5798479`, Storage Zone `wardrobe-assistants-ch-homepage` id `1498270`)
- `https://admin.wardrobe-assistants.ch/sign-in` serves the admin sign-in page from the Magic Container with valid TLS. ✅ (Magic Container `h4vme6Uhod4W3Yu`, auto-PZ `5798594`)
- Admin user can sign in with seeded credentials. ✅ verified end-to-end (`POST /api/auth/sign-in/email` returns 200 + session cookie). TOTP not enrolled at runtime — see deviation 5 below.
- ✅ The old Magic Container `lzGns1pTQLcqOGM` and its auto Pull Zone `5719318` were deleted (after sign-in verification, same iteration). DNS was already off them; no traffic disruption.
- `kb/runbook-go-live.md` captures the actual commands run, ready to replay for staging or DR. ✅ (runbook landed in iter-9's earlier PR; this section captures the deviations the runbook's TODO blocks should now be filled with).

## Deviations from the iteration plan

The cutover required several departures from the plan as written. Future operators replaying this for staging or DR should expect them:

1. **Storage Zone name was `wardrobe-assistants-ch-homepage`, not `wardrobe-assistants-homepage`.** Bunny holds storage-zone names in a soft-delete grace period after a previous test creation/deletion of `wardrobe-assistants-homepage` during iter-7a's exploratory side-quest. Re-provisioning under the original name returned `400 storagezone.name_taken`. The `-ch-` suffix (matching the TLD) is unique enough; bunny zone names have no semantic meaning to the operator beyond the GitHub `BUNNY_STORAGE_ZONE_NAME` secret value. Pull Zone name was changed to match (`wardrobe-assistants-ch`).

2. **Homepage `out/` was uploaded directly via the bunny Storage API, not via CI.** The plan called for "trigger first deploy by pushing an empty commit to main." But empty commits don't pass paths-filter (returns no changed files → `build-homepage` skips). And making a tracked-file change to trigger CI would have required a PR — slower than just `curl PUT`-ing the 74 static files via `for f in $(find apps/homepage/out -type f); do curl -X PUT --data-binary @"$f" -H "AccessKey: $PASS" "https://storage.bunnycdn.com/wardrobe-assistants-ch-homepage/$f"; done`. This is the right pattern for ad-hoc seed deploys; document it in the runbook as the standard pre-DNS-cutover content seeding step.

3. **Direct API calls were used in three places where `hoppy` had gaps.** Captured in `kb/hoppy-bug-report-pullzone-storagezone.md` (issues 1+2+3+4) and `kb/hoppy-bug-report-database-cli.md`:
   - Pull Zone create with StorageZoneId binding (hoppy doesn't expose the field) → `curl POST /pullzone`.
   - Storage Zone password retrieval (hoppy strips it from `get` responses) → `curl GET /storagezone/{id}`.
   - bunny.net Database (libSQL) provisioning + token minting — no `hoppy db` subcommand at all → `curl POST /database/v1/databases` and `/v1/databases/{id}/auth/tokens`.

4. **Workflow rewrite became a nested PR, not "minor CI tweaks" as the plan called.** The original `deploy.yml` from iter-7a/7b targeted bunny's container registry with `BUNNY_REGISTRY/USERNAME/PASSWORD` secrets and a homemade `curl` deploy trigger. iter-9 realigned to bunny's canonical pattern from https://docs.bunny.net/magic-containers/deploy-with-github-actions.md: `ghcr.io` for image hosting (uses `GITHUB_TOKEN`, no extra creds), `BunnyWay/actions/container-update-image@main` for the roll, `secrets.BUNNYNET_API_KEY` (the existing pre-iter-7a secret name), `vars.APP_ID` (the existing variable), and `vars.APP_ID != ''` gate so the job skips before the admin app exists. PR #10. Plus three follow-up PRs the cutover surfaced: #11 for an empty-public-dir gitkeep, #12 for dropping migrate-on-boot from the Dockerfile CMD (deps not resolvable from `scripts/migrate.ts` in the standalone runtime image — see deviation 5).

5. **Migrations + TOTP enrollment moved to operator-driven, not container-driven.** The Dockerfile originally ran `node --import tsx apps/admin/scripts/migrate.ts && node apps/admin/server.js` at boot. tsx couldn't resolve `@libsql/client` and `drizzle-orm` from the standalone runner image (Next's standalone bundle contains a minimal node_modules tree under `apps/admin/.next/standalone/node_modules`, not at `/app/node_modules`). The fix dropped migrations from the CMD; operators now run `npm -w apps/admin run migrate` from a workstation with `DATABASE_URL` + `DATABASE_AUTH_TOKEN` in env, before the container deploy. Same machine ran `npm -w apps/admin run seed:admin` to seed the first user. The seed-admin script also had a real bug in iter-7b — `auth.api.enableTwoFactor` was called without an authenticated session and threw `Unauthorized`, leaving newly-created users without TOTP enrolled. Fix in PR #10 also adds a `signInEmail` step to obtain a session cookie before `enableTwoFactor`. **Net behaviour change vs the plan:** the seed prints a TOTP URI + QR + 10 backup codes once (operator must capture them), enrolls 2FA in `account.two_factor` table, but `user.two_factor_enabled` stays `0` until the user verifies a TOTP code at first sign-in. So initial sign-in is email + password only; TOTP gating activates after the user verifies once.

6. **Old Magic Container decommission completed in-iteration, not after 24h.** Plan said "after 24h of healthy homepage serving" delete `lzGns1pTQLcqOGM` and its auto Pull Zone `5719318`. After sign-in was verified end-to-end, the operator confirmed the old infra was dead-air (no DNS, only system hostnames remained) and deletion was safe. `hoppy container app delete --id lzGns1pTQLcqOGM` left the auto-PZ orphaned (bunny didn't reap on app deletion); explicit `hoppy pull-zone delete --id 5719318` cleaned it up. Both deletions verified non-disruptive — both live surfaces still serve `200`.

7. **Operational footgun: env vars on the admin Magic Container were observed empty after a code deploy, breaking sign-in.** **Initially blamed on BunnyWay/actions/container-update-image; investigation refutes that** — see [`bunnyway-actions-investigation.md`](../../tool-reports/bunnyway-actions-investigation.md). Direct PATCH replicating the action's request body preserved env vars; pod recreate also preserved them. The actual culprit is `hoppy container template env`'s "replace all" semantics: with zero `--env` flags it silently wipes everything, and with N flags it replaces the entire env with exactly those N entries (no add-or-update mode). The iter-9 wipe was almost certainly an accidental hoppy invocation with the wrong arg list during the cutover (possibly when a shell variable was empty). Tracked in [`hoppy-bug-report-magic-containers.md` Issue 1 (rewritten)](../../tool-reports/hoppy-bug-report-magic-containers.md#issue-1).
   **Action items:**
   - Defensive engineering: lift `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `BETTER_AUTH_URL`, `EMAIL_FROM` into GitHub repo secrets so a future CI step can reassert the full env list after every code deploy. The container template stops being the env source of truth.
   - Get hoppy fixed: `template env` should refuse zero-`--env` calls without `--clear`, and grow `--add` / `--remove` / `--update` for granular ops.
   - **No upstream issue at BunnyWay/actions** — their PATCH is correct as written.

8. **GitHub secret rename: `BUNNY_API_KEY` → `BUNNYNET_API_KEY`.** Bunny's docs use `BUNNYNET_API_KEY`; the repo had a secret with that name predating iter-7a. iter-9 standardised both `build-homepage` and `build-admin` on `secrets.BUNNYNET_API_KEY` and deleted the redundant `BUNNY_API_KEY`.

9. **Three additional `hoppy` bug-report files** filed in `kb/`:
   - `hoppy-bug-report-pullzone-storagezone.md` — Pull Zone create can't bind StorageZoneId; `pull-zone get` chokes on Magic-Container-backed PZs; `storage-zone get` strips passwords (issue 3, added in this iteration).
   - `hoppy-bug-report-database-cli.md` — no `db` / `database` subcommand at all; full curl-based workaround documented; suggested CLI shape for `hoppy db`, `hoppy db group`, `hoppy db token`.

10. **One feedback memory persisted:** `feedback_redact_bunny_app_envvars` — the bunny Magic Container app GET endpoint returns env-var values plaintext; always redact before printing. Burned during iter-9 by piping `curl /mc/apps/{id}` to `head` for diagnostics, leaking three secrets to the transcript. User declined rotation; the memory enforces "never again."
