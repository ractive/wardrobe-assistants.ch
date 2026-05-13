---
title: Iteration 16f — Defense-in-depth security
type: iteration
order: 17.7
status: done
---

# Iteration 16f — Defense-in-depth security

The Group 2 / Medium-severity items from the [consolidated security audit](../../audits/audit-2026-05-09-consolidated.md) — server-side hardening that's independent of the UI cleanup track. Could land in parallel with iter-16d/e but plan-ordered after them for clarity.

This is a server-only iteration. **No UI changes.** Touches: Better Auth, query layer, action error paths, smoke tests, runbooks, GitHub Actions security workflows.

## Pre-flight

- [x] iter-16b (edge hardening) merged. The high-severity wave is in place; this iteration adds depth.
- [x] [Consolidated security audit](../../audits/audit-2026-05-09-consolidated.md) §7 Group 2 re-read.

## Scope — rate limiting [3/3]

Closes **C-SEC-02**. In-memory sliding window OK for the single-container deploy; revisit if scaled.

- [x] Add a small `apps/admin/src/lib/rate-limit.ts` helper: sliding-window keyed by IP+identifier (e.g., email for login). Pure in-memory `Map` with TTL eviction; abstracted so a future Upstash/Redis swap is mechanical.
- [x] Apply at the Better Auth route handler boundary: login = 5/15min per IP+email; password reset = 3/hour per email; signup (if reachable) = 3/hour per IP. Inviteuser server action = 10/hour per admin.
- [x] Smoke test: exhaust the limit; assert 429 (or equivalent error result) with `Retry-After` header.

## Scope — audit log [4/4]

Closes **C-SEC-10**. Cheap, high-value compliance/IR primitive.

- [x] New schema `packages/db/src/schema/audit_log.ts`:

  ```ts
  audit_log(id text pk, actor_user_id text not null, action text not null,
            target_id text, target_type text, metadata text /* json */,
            created_at integer)
  ```

- [x] Drizzle migration + aggregator entry.
- [x] Add an `auditLog(actor, action, target?, metadata?)` helper in `apps/admin/src/lib/audit-log.ts`. Emit from inside `withPermission` for any *mutating* action — pass through the verified userId. All current mutating actions (invite/delete/message user, create/update/delete event, assign/unassign, message assignees) get a one-liner.
- [x] Smoke test: invite a user, assert `audit_log` row exists with the right `actor_user_id`, `action`, `target_id`.

## Scope — query-level authorization [2/2]

Closes **C-SEC-09**. Defense-in-depth — currently auth gating is route-only.

- [x] Add `assertPermission()` to the entry of every sensitive `listX/getById` in `features/{users,events}/server/queries.ts`. Re-uses the existing `assertPermission` helper from `lib/permissions.ts`.
- [x] Update the iter-15c smoke harness pattern to assert that calling `listUsers()` *without* the right perm throws — i.e., the query is now a security boundary, not just the route.

## Scope — error message sanitization [3/3]

Closes **C-SEC-08**. The `err.message` exposure in user-facing action results and `lib/email.ts`.

iter-16e added a `fallbackErrorMessage` option to `useFormAction` (the form-side toast path), so the **server side is the only remaining gap**: once thrown errors carry generic strings, the hook's `err.message` display becomes safe by construction. Don't change `useFormAction` again here — fix the throw sites.

- [x] In `apps/admin/src/lib/email.ts:54`, replace `throw new Error(\`Resend send failed: ${error.message}\`)` with a generic message; log the full error server-side.
- [x] In `apps/admin/src/features/users/server/actions.ts` lines 86, 99, 161, replace `err.message` propagation with generic strings (`"Failed to update profile"`, `"Failed to send message"`); log the underlying error server-side.
- [x] Pair with audit-log: include a correlation ID in the audit-log row + the server-side log; expose that ID in the user-facing toast so support can find the entry. _Leave the intentional `withPermission`-thrown `PermissionError` / `UnauthenticatedError` messages alone — those are user-facing by design._

## Scope — missing-`user_profile` regression test [1/1]

Closes **C-SEC-13**. Pins the 2026-05-09 incident.

- [x] Smoke test: create a Better Auth user without seeding `user_profile`; assert that every gated action (e.g., `listUsers`, `inviteUser`, `createEvent`) returns the deny result, and that any `<HasPermission>`-wrapped UI returns null in render.

## Scope — down-migration runbook [1/1]

Closes **C-INF-01**.

- [x] Add `kb/runbooks/migration-recovery.md`: "container won't start because migration X failed." Covers `MIGRATE_ON_BOOT=false` escape, how to inspect via `hoppy db`, manual rollback recipe (Drizzle has no automatic down-migration), and when to call for help. Cross-link from `iac-runbook.md`.

## Scope — security scanning workflows [3/4]

Closes **C-SEC-12**.

- [x] `.github/dependabot.yml`: weekly updates for `npm` (root + workspaces) and `github-actions`.
- [x] `.github/workflows/codeql.yml`: weekly CodeQL scan, JS/TS, SARIF upload.
- [x] Add Trivy scan step to `.github/workflows/deploy.yml`'s `build-admin` job: scan the built image, fail on HIGH/CRITICAL vulns. Pin Trivy action to a SHA per the iter-16b convention.
- [ ] GitHub repo settings: enable secret scanning + push protection.

## Scope — `trustedOrigins` + password floor (Group 3 hygiene) [2/2]

Cheap rides. Closes **C-SEC-14** and **C-SEC-15**.

- [x] Add `trustedOrigins: [env.betterAuthUrl]` to Better Auth config in `apps/admin/src/lib/auth.ts` (verify exact API shape against `node_modules/better-auth` first per CLAUDE.md).
- [x] Bump `min(8)` → `min(12)` in `apps/admin/src/lib/login-schema.ts` for new passwords. Update set-password UI to add a strength hint ("Use a passphrase you don't reuse"). No character-class rules.

## Verify [3/5]

- [x] `npm run verify` — green.
- [x] Smoke tests: rate limit triggers 429; audit log records every gated mutation; query-level authz denies non-admin reads; profile-less user can't perform any gated action.
- [ ] Manual: failing email send shows generic toast; server log has full error + correlation ID; correlation ID matches the audit-log row.
- [ ] CodeQL workflow passes; Dependabot opens at least one PR within a week of merge.
- [x] `kb/runbooks/migration-recovery.md` is complete and cross-linked.

## Deferred (genuinely incomplete at merge)

Code-side scope is complete. The unchecked items above are deferred by
nature, not skipped:

- **GitHub repo settings: secret scanning + push protection** — repo
  admin UI toggle, not code. Tracked separately; flip immediately
  post-merge. Doesn't block the code-side closing of C-SEC-12 (the
  scanning *workflows* are live).
- **Manual verify: failing email send shows generic toast + correlation
  ID** — runtime check that needs a real Resend failure to observe
  end-to-end. Pre-merge unit/smoke coverage already pins the throw-site
  contract; the manual pass is a follow-up.
- **CodeQL workflow passes; Dependabot opens at least one PR** —
  weekly cadence; first run lands after merge by definition. Workflow
  files are in place and validated by `npm run verify`.

## Out of scope (deliberate)

- **`error.tsx` / `not-found.tsx` / `loading.tsx` boundaries.** Those are UI; iter-16e.
- **Rate-limit storage in Redis/Upstash.** Single-container in-memory is fine; revisit at scale.
- **Audit-log UI.** Just the storage primitive here. A future iter can add a viewer page.
- **PII column encryption.** C-SEC-28 / S-28 — accepted risk for current threat model.
- **`requireEmailVerification` flow change.** Document the rationale in `auth-and-permissions.md`; don't flip the flag without an invite-token-expiry redesign (separate iter).

## Critical files

New:
- `apps/admin/src/lib/rate-limit.ts`
- `apps/admin/src/lib/audit-log.ts`
- `packages/db/src/schema/audit_log.ts`
- `packages/db/migrations/<next-number>_audit_log.sql`
- `kb/runbooks/migration-recovery.md`
- `.github/dependabot.yml`
- `.github/workflows/codeql.yml`

Edited:
- `apps/admin/src/lib/auth.ts` — `trustedOrigins`
- `apps/admin/src/lib/login-schema.ts` — password floor
- `apps/admin/src/lib/email.ts` — generic message
- `apps/admin/src/app/api/auth/[...all]/route.ts` (or wherever the route handler is mounted) — rate-limit middleware
- `apps/admin/src/features/{users,events}/server/actions.ts` — generic errors + audit emits
- `apps/admin/src/features/{users,events}/server/queries.ts` — `assertPermission` at entry
- Smoke tests in both feature suites
- `.github/workflows/deploy.yml` — Trivy step
- `kb/admin-architecture/auth-and-permissions.md` — `requireEmailVerification` rationale; query-level authz pattern
- `packages/db/src/schema.ts` — re-export `audit_log`

## Done when [7/8]

- [x] Rate limiter active on auth + invite paths; 429 surfaces in smoke.
- [x] `audit_log` table exists; every gated mutation emits a row.
- [x] Sensitive query functions deny without permission.
- [x] No `err.message` reaches end users from actions or email send paths.
- [x] Profile-less smoke test pins the 2026-05-09 incident as a regression.
- [x] Migration-recovery runbook exists.
- [ ] Dependabot + CodeQL + Trivy + secret scanning all live.
- [x] `trustedOrigins` set; password floor at 12.
