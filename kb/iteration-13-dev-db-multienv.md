---
title: Iteration 13 — Dev database + per-environment config split
type: iteration
order: 14
status: planned
related: [iteration-07b-admin-app.md, iteration-09-go-live-bunny-infra.md, iac-runbook.md]
---

# Iteration 13 — Dev database + per-environment config split

The admin app currently falls back to `file:./dev.db` when `DATABASE_URL` isn't set, which means there's some local-dev path, but it isn't audited or documented and the rest of the env config (`BETTER_AUTH_URL`, `EMAIL_FROM`, `RESEND_API_KEY`) silently inherits from `.env.local` whose contents may be production values. This iteration formalises the dev experience: a clean local libSQL database with seeded fixtures, a clean dev/prod env split, and a one-command path to "run the admin app locally without touching prod."

## Context — why this is worth ~one focused iteration

Three pain points today:

1. **Risk of accidental prod writes.** A developer with the prod `DATABASE_AUTH_TOKEN` in their shell environment can boot the admin app and write to prod by mistake. The current fallback `file:./dev.db` only kicks in if `DATABASE_URL` is unset entirely.
2. **No reproducible dev fixtures.** `bun dev` against a fresh laptop boots an empty SQLite file. Better Auth needs at least one seeded user to test the sign-in flow, which currently means rerunning iter-7b's seed script against a path that may or may not exist depending on which directory you `bun dev` from.
3. **Environment leakage.** `BETTER_AUTH_URL` defaulting to a prod hostname while `DATABASE_URL` defaults to local breaks Better Auth's cookie-domain logic and produces a confusing 401 loop when you don't notice the mismatch.

The fix: a `.env.local` (developer-edited) + `.env.local.example` (committed) pair specifically for the local-dev profile, plus a `bun run db:reset` script that nukes-and-reseeds the local libSQL file in one step.

## Pre-flight

- [ ] Audit `apps/admin/` for every `process.env.*` reference and list which need dev-vs-prod values. Likely: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `EMAIL_FROM`, `RESEND_API_KEY`, `NODE_ENV`, `PORT`, `HOSTNAME`.
- [ ] Audit `packages/db/` for connection-string handling — confirm `DATABASE_AUTH_TOKEN` is gracefully ignored when the URL is `file:` (no auth needed for local files).
- [ ] Confirm whether `apps/admin/build.db` is a stale leftover or actively used. If stale, delete and gitignore the path that replaces it.

## Scope — local libSQL setup [0/4]

- [ ] Standardise on a single dev DB path: `apps/admin/.dev/dev.db`. Gitignored. Document the path in the README.
- [ ] Update `packages/db` connection logic: when `DATABASE_URL` starts with `file:`, ignore `DATABASE_AUTH_TOKEN` (no auth on local files); when it doesn't, require both to be set and fail-fast otherwise.
- [ ] `bun run db:reset` script (workspace-root): deletes `apps/admin/.dev/dev.db`, reruns Drizzle migrations, runs the seed script (existing iter-7b code) to plant one bootstrap admin user with TOTP-not-enrolled. Idempotent.
- [ ] `bun run db:dump` and `bun run db:restore <file>` scripts using `@libsql/client`'s `Client.execute("SELECT sql FROM sqlite_schema")` + per-table `SELECT *`. Useful for sharing fixtures between machines and for sanity-checks before destructive migrations. Output goes to `apps/admin/.dev/dump-<timestamp>.sql`, gitignored.

## Scope — env config split [0/5]

- [ ] Create `apps/admin/.env.local.example` with safe local-dev defaults: `DATABASE_URL=file:./.dev/dev.db`, `BETTER_AUTH_URL=http://localhost:3000`, `BETTER_AUTH_SECRET=dev-only-not-real-secret-32-chars-x`, `EMAIL_FROM=admin@localhost`, `RESEND_API_KEY=` (empty — see "email in dev" below), `NODE_ENV=development`, `PORT=3000`, `HOSTNAME=0.0.0.0`. Commit; gitignore `.env.local` itself.
- [ ] Add a startup-time guard in `apps/admin/src/lib/env.ts` (or wherever the env loader lives — likely a Zod schema) that refuses to boot if `NODE_ENV === "development"` and `DATABASE_URL` does NOT start with `file:`. This is the "don't accidentally hit prod from dev" tripwire.
- [ ] Symmetric guard for prod: refuse to boot if `NODE_ENV === "production"` and `DATABASE_URL` starts with `file:`. Mainly to surface misconfiguration, not for security.
- [ ] Document the split in `apps/admin/README.md` (or root README) — copy `.env.local.example` to `.env.local`, run `bun run db:reset`, run `bun dev`, sign in with the seeded admin email at `http://localhost:3000`.
- [ ] Update root `package.json` scripts so `bun run dev` chains `db:reset --if-empty` then starts the admin Next.js dev server, ensuring "first-time clone → bun install → bun dev" works without extra steps.

## Scope — email in dev [0/2]

Resend's API key shouldn't fire from `bun dev` even by accident, but the auth flow needs to send a "magic link" / OTP for sign-in. Options:

- [ ] **Pick the path.** Two reasonable choices:
  1. **Console transport** — when `RESEND_API_KEY` is empty in dev, the email layer prints the email body + magic-link to stdout. Lightweight; no extra service.
  2. **Mailpit** (or MailHog) container — local SMTP catcher with a web UI. More realistic; one more thing to install.

  Recommend (1) for now; mailpit is tracked as a future enhancement if the admin grows real templated emails.
- [ ] Implement the chosen path. If (1): a `lib/mail.ts` shim that branches on `process.env.RESEND_API_KEY ? send-via-resend : console.log`.

## Scope — verify [0/3]

- [ ] Fresh-clone smoke test: in a temp directory, `git clone … && bun install && bun run dev`. Should reach `http://localhost:3000` sign-in page within 30s without manual env setup.
- [ ] Sign in with the seeded user, verify the magic-link / OTP shows up in stdout, complete TOTP enrolment, land on the dashboard. Whole flow against `file:./.dev/dev.db`.
- [ ] Confirm prod is unaffected: tofu plan + admin container still healthy after merge.

## Out of scope

- **Mailpit / MailHog container.** Tracked as future. Console transport covers the day-1 dev need.
- **Bunny dev libSQL database.** Considered briefly; rejected because (a) it's another resource to provision and pay for, (b) `file:` SQLite has 100% schema parity with libSQL for our use, and (c) bunny generations on a dev DB add no value.
- **Drizzle Studio integration.** Drizzle's GUI works against `file:` URLs out of the box; calling it out as a docs note in the README is enough — no scripted setup.
- **Multi-developer fixtures sync.** `bun run db:dump`/`db:restore` plus committing a `seed.sql` is the manual workflow. A "shared dev fixtures" feature can come later.
- **Production env value rotation.** Tracked separately (the four leaked secrets from iter-11 — `BETTER_AUTH_SECRET`, `DATABASE_AUTH_TOKEN`, `RESEND_API_KEY`, `TERRAFORM_STATE_STORAGE_KEY`).

## Critical files

- `apps/admin/.env.local.example` (new)
- `apps/admin/src/lib/env.ts` (new or expanded — Zod-validated env schema with NODE_ENV branch)
- `apps/admin/src/lib/mail.ts` (new — console-transport branch)
- `apps/admin/src/lib/db.ts` or `packages/db/index.ts` — gate `DATABASE_AUTH_TOKEN` on `file:` URLs
- `package.json` (root) — `db:reset`, `db:dump`, `db:restore` scripts
- `scripts/db-reset.ts`, `scripts/db-dump.ts` (new)
- `apps/admin/README.md` or root `README.md` — local-dev quickstart
- `.gitignore` — `apps/admin/.dev/*`
- Possible delete: `apps/admin/build.db` if confirmed leftover

## Risks / things to think about

- **Drizzle migrations on first run.** The reset script must run migrations *before* the seed; otherwise the seed inserts into a schema-less DB and silently corrupts. Check that the migration runner is idempotent against an empty file.
- **Better Auth cookie domain in dev.** With `BETTER_AUTH_URL=http://localhost:3000`, the cookie `Domain` is the empty default (host-only). Verify this works with `localhost` rather than `127.0.0.1` — Better Auth treats them as different cookie scopes.
- **Seed user's TOTP.** Seeding a user with TOTP-already-enrolled requires an HMAC secret that survives reseed. Easier path: seed without TOTP, let the dev enrol on first login. Document this in the README.
- **Preview / staging confusion.** This iteration deliberately ships dev only; "staging" against bunny is its own iteration. Don't accidentally land a third "preview" config that creates more questions than it answers.
- **Production drift from changes.** None of the env-loading changes should affect the prod container — `NODE_ENV=production` + `DATABASE_URL=libsql://…` (already set on the bunny container app) takes the prod branch in every guard. Verify with the admin's deploy workflow before merge.

## Done when

- `git clone … && bun install && bun run dev` reaches the sign-in page, completes a sign-in cycle (with magic-link in stdout), and lands on the dashboard — all against a freshly seeded local DB, with prod credentials nowhere in scope.
- Booting `bun dev` with a prod-shaped `DATABASE_URL` in scope fails fast with a clear error.
- Booting the prod container with a `file:` URL fails fast with a clear error.
- `bun run db:reset` reproduces a known-good fixture state in <5 s.
- README explains the dev quickstart in ≤10 lines.
