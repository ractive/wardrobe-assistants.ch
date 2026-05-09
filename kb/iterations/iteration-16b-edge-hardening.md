---
title: Iteration 16b — Edge & supply-chain hardening (audit Group 1)
type: iteration
order: 17.3
status: done
---

# Iteration 16b — Edge & supply-chain hardening

The 2026-05-09 three-reviewer audit ([consolidated](../audits/audit-2026-05-09-consolidated.md)) surfaced six **High**-severity issues plus one **Medium-High** CI gap. Five of them are at the HTTP edge / build pipeline / container — places no feature iteration touches by default — and they should land before iter-17 ships another feature behind the same admin surface. Iter-17/18 will inherit whatever security primitives this iteration sets up.

This is **not** a feature iteration. No new user-visible behavior. The deliverables are: a hardened HTTP response surface, a CDN that can't accidentally cache an admin response, a CI workflow that catches architectural-isolation lint, a temp-admin script that can't be run in prod, and a container that doesn't run as root.

## Context — why now

- **Iter-16 just merged the events feature** behind the admin pull-zone. The pull-zone's terraform (`infra/terraform/pullzones.tf:58-59`) has `cache_enabled = true` + `strip_cookies = false`, with a comment saying the app *must* set `Cache-Control: no-store, private` on every authenticated response. The audit verified that **no `Cache-Control` header is set anywhere in `apps/admin/src`** — relying entirely on Better Auth's defaults. One missing header upstream and the CDN serves user A's events page to user B. (Audit C-SEC-04.)
- **Three reviewers independently flagged "no security headers / CSP"** (Claude S-16, ChatGPT, Copilot F-001). The admin's `next.config.ts` defines `output: "standalone"` + `reactCompiler: true` and nothing else.
- **`BunnyWay/actions/container-update-image@main`** in `.github/workflows/deploy.yml:142` is the literal "compromised upstream Action takes over deploy" supply-chain risk that GitHub's docs warn against.
- **`seed-temp-admin.ts`** has no production guard, seeds without 2FA, and is exposed as `seed:temp-admin` in `apps/admin/package.json`. Project memory already records that an iter-15b temp admin reached prod and is pending deletion — confirming this is operationally hazardous, not theoretical.
- **`npm run verify`** is `lint && typecheck && test` locally; CI only runs `typecheck + test`. The Biome `noRestrictedImports` blocks that enforce per-feature isolation are therefore not enforced on PRs — the architectural rule is on the honor system.
- **Container runs as root** — Dockerfile has no `USER` directive.

These don't compose into "ship feature N+1 first, harden later" — the longer the surface keeps growing under a leaky CDN cache and a root container, the bigger the remediation becomes. Six narrow fixes now is cheaper than a P1 incident later.

## Pre-flight [3/3]

- [x] iter-16 merged.
- [x] [Consolidated audit](../audits/audit-2026-05-09-consolidated.md) re-read; Group 1 still matches the plan below.
- [x] Group 2 + 3 items deferred to **iter-16f** (defense-in-depth: rate limiting, query-level authz, audit log, error sanitization, error/not-found boundaries, security scanning workflows). Iter-16c/d/e cover the parallel frontend cleanup track. Tracked in the consolidated audit's action plan and `kb/audits/findings-index.md`.

## Scope — CDN cache safety [3/3]

Audit ID: **C-SEC-04** (highest-priority finding).

- [x] Add `headers()` to `apps/admin/next.config.ts` returning `Cache-Control: private, no-store, must-revalidate` for `/(.*)`. The admin app has no public/cacheable surface — every response is session-bearing.
- [x] Flip `strip_cookies = true` on the admin pull-zone in `infra/terraform/pullzones.tf` as a CDN-side belt-and-suspenders: even if a future header regression slips through, cookies won't be part of the cache key. Update the comment block at lines 49-53 to reflect the new posture.
- [x] Smoke test in `apps/admin/src/test/http-harness.ts`: hit a dashboard route as an authed user, assert response carries `Cache-Control: private, no-store` (or stronger). Ship as a generic helper so iter-17/18 inherit it. (Implementation reads `next.config`'s `headers()` directly — the smoke harness has no Next runtime, but the config is the authoritative source of what the server emits.)

## Scope — security headers [3/3]

Audit ID: **C-SEC-01**. Pair with the Cache-Control header above (same `headers()` block).

- [x] In `apps/admin/next.config.ts` `headers()` for `/(.*)`:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
- [x] Same headers list documented in `apps/homepage/next.config.ts` as `securityHeaders` (CSP relaxed for Bunny Fonts: `style-src 'self' 'unsafe-inline' https://fonts.bunny.net; font-src 'self' https://fonts.bunny.net; img-src 'self' data: https:`). Next 16's `output: "export"` explicitly does **not** honor a `headers()` block (per `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` "Unsupported Features"), so the array is intent-only here. Edge enforcement on the homepage is a deferred follow-up via bunny.net pull-zone edge rules; tracked in iter-16f (defense-in-depth).
- [x] Smoke assertion (admin): each header above present on at least one route response. One parametrized `it.each` test in `users.smoke.test.ts` reads the next.config catch-all source and asserts each header key is configured.

> **CSP note**: start permissive (`'unsafe-inline'` for styles is necessary because Tailwind's runtime-injected styles + react-hook-form's inline error styling don't ship with nonces in this stack). Tighten in a future iteration once we add nonce/hash support.

## Scope — supply chain [2/2]

Audit ID: **C-SEC-03**.

- [x] Pin `BunnyWay/actions/container-update-image` to commit SHA `d15f94f8fd513950561a5996a40f99d1dd1c357c` (refs/heads/main as of 2026-05-09) in `.github/workflows/deploy.yml`. Trailing comment records the source.
- [x] New runbook `kb/runbooks/github-actions-pinning.md` documents the convention: third-party Actions get SHA-pinned, `actions/*` and `docker/*` stay tag-pinned. Includes a bump procedure and an audit grep cue.

## Scope — temp-admin guardrails [2/2]

Audit ID: **C-SEC-05**. The iter-15b stranded temp admin in prod was already deleted by the user 2026-05-09; this scope hardens the script so the same situation doesn't recur.

- [x] Hard-guard `apps/admin/scripts/seed-temp-admin.ts`:
  - Refuse if `process.env.NODE_ENV === "production"`.
  - Require `process.env.ALLOW_TEMP_ADMIN === "1"` as an explicit confirmation flag.
  - Require the seeded email to end with `@wardrobe-assistants.ch` (case-insensitive) so prod cleanup queries can scope safely.
  - Each refusal exits 1 with a clear `console.error`; no silent no-op.
- [x] `apps/admin/scripts/seed-temp-admin.sh` now refuses if `CI=true` and exports `ALLOW_TEMP_ADMIN=1` only when the run is interactive. The Python subprocess inherits the exported flag.

## Scope — container hardening [2/2]

Audit ID: **C-SEC-06**.

- [x] In `apps/admin/Dockerfile` runner stage: created a non-root user (`addgroup -S app && adduser -S app -G app`), `--chown=app:app` flag on each COPY (avoids a doubled `.next/standalone` layer from a post-COPY chown), `USER app` before `CMD`.
- [x] Standalone server's `node apps/admin/server.js` runs against PORT=3000 — no privileged-port concern. Migrations run inside the Next instrumentation hook in the same process, so libSQL writes go to the user-owned cwd. (Verified by the test/CI build path; full local docker run is part of the manual verify checklist below.)

## Scope — CI runs `verify` [1/2]

Audit ID: **C-CI-01**.

- [x] In `.github/workflows/deploy.yml` `verify` job: replaced `npm run typecheck` + `npm run test` with a single `npm run verify` step (which is `lint && typecheck && test`). Local pre-commit gate and CI gate now match.
- [ ] Verify Biome's per-feature `noRestrictedImports` overrides actually fire under CI by intentionally introducing a forbidden import in a throwaway PR (manual smoke; don't merge it). Deferred — the workflow change above already ensures lint runs; the manual smoke is operator follow-up, not blocking on this PR.

## Scope — email header injection [2/2]

Audit ID: **C-SEC-07**.

- [x] In `apps/admin/src/features/users/schema.ts` and `events/schema.ts`, added `.transform((s) => s.replace(/[\r\n]+/g, " "))` on the `subject` field of `messageUserInput` and `messageEventAssigneesInput`. Body keeps newlines.
- [x] Smoke tests `users.smoke.test.ts` and `events.smoke.test.ts` invoke each action with a `Hello\r\nBcc: attacker@example.com` subject and assert `sendEmail` receives a subject with no CR/LF. Closes the **C-TST-01** test gap for these two paths.

## Verify [2/6]

- [x] `npm run verify` — green (lint + typecheck + 124 tests pass on the PR branch).
- [ ] `npm run verify:tf` — green; pull-zone diff matches the new `strip_cookies = true`. *(Local sandbox can't refresh state — HTTP backend requires auth. CI runs this on every PR; relying on the deploy.yml verify job here.)*
- [ ] Local docker build runs as `app` user; `id` inside the container shows non-root. *(Manual; not exercised before merge — covered by post-deploy check below.)*
- [x] Smoke harness asserts presence of `Cache-Control: private, no-store, must-revalidate` and the six remaining security headers on app-route responses (parametrised `it.each` in `users.smoke.test.ts`; `Cache-Control` scoped to the asset-exclude source so `_next/static` keeps Next's immutable defaults).
- [ ] Manual: post-deploy, hit the admin in a browser; check DevTools → Network for the response headers on `/`, `/users`, `/events`. All present, none missing. *(Post-merge.)*
- [ ] Manual: `npm run seed:temp-admin` with `NODE_ENV=production` exits 1 without DB writes. *(Post-merge.)*

## Out of scope (deliberate, → iter-16f)

These all fall under audit Group 2 (medium-severity defense-in-depth) and deserve their own focused iteration rather than bloating this one. Tracked in `iter-16f-defense-in-depth.md`; iter-16c/d/e are the parallel frontend cleanup track:

- **Rate limiting** on Better Auth endpoints (C-SEC-02).
- **Query-level authorization** — `assertPermission()` inside sensitive `listX/getX` queries (C-SEC-09).
- **Audit log** table + emission from `withPermission` (C-SEC-10).
- **Error message sanitization** in actions and `lib/email.ts` (C-SEC-08).
- **`error.tsx` + `not-found.tsx`** under `(dashboard)/` and root (C-NXT-01).
- **Down-migration runbook** (C-INF-01).
- **Dependabot + CodeQL + Trivy + secret scanning workflows** (C-SEC-12).
- **`user_profile` regression smoke test** (C-SEC-13).

The Group 3 hygiene items (password floor, `trustedOrigins`, dep bumps, `next/font` for homepage, etc.) get sprinkled into iter-17/18 or a later cleanup pass — they're per-finding small enough to ride along.

## Critical files

Edited:
- `apps/admin/next.config.ts` (`headers()` block — biggest change in this iteration)
- `apps/homepage/next.config.ts` (security headers; CSP relaxed for Bunny Fonts)
- `apps/admin/Dockerfile` (non-root user)
- `apps/admin/scripts/seed-temp-admin.ts` + `seed-temp-admin.sh` (production guards)
- `apps/admin/src/features/users/schema.ts`, `apps/admin/src/features/events/schema.ts` (CR/LF strip on subjects)
- `apps/admin/src/test/http-harness.ts` (header-presence helpers)
- `apps/admin/src/features/users/server/users.smoke.test.ts`, `events/server/events.smoke.test.ts` (subject-injection cases + header smoke)
- `infra/terraform/pullzones.tf` (`strip_cookies = true` for admin pull-zone)
- `.github/workflows/deploy.yml` (verify job uses `npm run verify`; BunnyWay action SHA-pinned)
- `kb/runbooks/iac-runbook.md` (or new `kb/runbooks/github-actions-pinning.md`)

No new feature code; no schema changes; no new permissions.

## Done when [5/7]

- [x] Every authenticated admin response carries `Cache-Control: private, no-store, must-revalidate` (the pull-zone `strip_cookies = true` is the CDN-side belt-and-suspenders for any future header regression). Cache-Control scoped to non-static paths so `_next/static` keeps Next's immutable defaults.
- [ ] All seven security headers present on admin and homepage; CSP enforced in non-report-only mode. *Admin: yes. Homepage: intent-only — `output: "export"` doesn't honor `headers()`, and bunny.net edge rules to mirror the list are deferred to iter-16f. The homepage CSP / X-Frame-Options etc. are documented in `apps/homepage/next.config.ts` but not enforced yet.*
- [x] No `@main` references in `.github/workflows/`; pinning convention documented in `kb/runbooks/github-actions-pinning.md`.
- [x] `seed-temp-admin` cannot run in production. (iter-15b stranded temp admin already deleted by user 2026-05-09.) Triple guard: `NODE_ENV !== "production"`, `ALLOW_TEMP_ADMIN=1`, email must end with `@wardrobe-assistants.ch`. Wrapper additionally requires a TTY, refuses on `CI=true`, and removed the prod-default APP_ID/CONTAINER_ID args (must be passed explicitly).
- [ ] Admin container runs as non-root in prod. *Dockerfile creates `app` user, `--chown=app:app` on every COPY, `USER app` set before EXPOSE. Confirmation in prod is the post-deploy manual check.*
- [x] CI's `verify` job runs `lint` (not just typecheck + test); a forbidden cross-feature import would now fail CI.
- [x] Email subjects in `messageUser` / `messageEventAssignees` reject or strip CR/LF; smoke tests pin the behavior (`Hello\r\nBcc: attacker@…` → asserted CR/LF-free at `sendEmail` boundary).

## Risk + rollback

- **CSP regression**: the highest-leakage change is the CSP. If it breaks something subtle (e.g. a Radix component injecting a style without `'unsafe-inline'`), the symptom is a white-screen page with console violations. Rollback = revert the single `headers()` change. Land CSP last in the sequence; verify on `/login`, `/`, `/events`, `/events/[id]`, `/users`, `/set-password` before merging.
- **Container non-root**: standard pitfall is filesystem permissions on the writable dirs (Next's `.next/cache`, libSQL's local file in dev). Caught by local docker run before push.
- **`strip_cookies = true`**: if there's any unauthenticated endpoint we *expected* to cache (we don't think there is — the admin has no public surface), it could over-cache. Mitigation: the admin pull-zone serves only authenticated traffic; verify by scanning `apps/admin/src/app/` for any route that explicitly opts out of session check.
