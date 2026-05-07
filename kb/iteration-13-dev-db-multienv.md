---
title: Iteration 13 — Dev bootstrap + per-environment env loader
type: iteration
order: 14
status: planned
related: [iteration-07b-admin-app.md, iteration-09-go-live-bunny-infra.md, iac-runbook.md]
---

# Iteration 13 — Dev bootstrap + per-environment env loader

Tighten the local-dev experience for the admin app: a single command takes a fresh clone to a running, signed-in admin instance against a local libSQL file; every env-var read flows through a Zod-validated loader that fails fast on misconfiguration; and the prod/dev boundary is enforced by tripwires rather than by remembering not to set the wrong variable.

## Context — what's already in place (don't redo)

Audit before scoping. Iter-7b and iter-9 left a usable foundation:

- `apps/admin/.env.example` — committed, well-commented, documents `DATABASE_URL=file:./dev.db` as the dev default.
- `apps/admin/scripts/migrate.ts` — Drizzle migrator, locates the migrations folder, fails on missing `DATABASE_URL`.
- `apps/admin/scripts/seed-admin.ts` — idempotent first-admin bootstrap; signs the user up via Better Auth's `signUpEmail` so password hashing matches runtime.
- `packages/db` exports `createDb({ url, authToken })`. libSQL's `createClient` already handles `file:` URLs natively without an auth token.
- `apps/admin/package.json` already has `migrate` and `seed:admin` scripts.
- `*.db` in `.gitignore` covers the local dev database.

User/password handling and MFA aren't this iteration's concern — they'll be revisited in a dedicated auth iteration that figures out the right dev-friendly default for sign-in. Iter-13 doesn't touch `auth.ts` beyond replacing `process.env.X` reads with the new env loader. Transactional email lands in a future iteration too; this iteration prepares the env-shape so that lands cleanly.

## What's missing today

1. There's no central env loader. `process.env.X` reads are scattered across `src/lib/auth.ts` and the two scripts. A typo in an env var name produces a runtime null-pointer at first use rather than a startup failure.
2. Nothing prevents booting the admin in `NODE_ENV=development` against the production libSQL DB, or vice versa.
3. The fresh-clone path takes more than one command (`npm install`, then write `.env.local` from `.env.example`, then `npm -w admin run migrate`, then set `ADMIN_EMAIL`/`ADMIN_PASSWORD`, then `npm -w admin run seed:admin`, then `npm -w admin run dev`). It works, but it's manual every time.
4. `apps/admin/build.db` was a stray 0-byte leftover from a Docker build — already removed in this iteration's prep.

## Pre-flight

- [x] Audit `apps/admin/src/` for every `process.env.X` reference. Capture the list — it's the migration target for the env loader.
- [ ] Confirm there are no other env-reading paths (e.g. middleware, route handlers) that would bypass `src/lib/env.ts`.

## Scope — Zod env loader [0/4]

- [ ] Create `apps/admin/src/lib/env.ts`. Single Zod schema covering: `NODE_ENV` (`development` | `production` | `test`), `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (optional), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `EMAIL_FROM`, `RESEND_API_KEY` (optional in dev, required in prod once email starts being sent — see "Email is forthcoming" below). Export a frozen `env` object.
- [ ] Tripwires (Zod refinements):
  - `NODE_ENV === "development"` and `DATABASE_URL` does NOT start with `file:` → error: "dev must use a local libSQL file; refusing to boot against a remote DB."
  - `NODE_ENV === "production"` and `DATABASE_URL` starts with `file:` → error: "prod must use a remote libSQL DB; refusing to boot against a local file."
  - `NODE_ENV === "production"` and `BETTER_AUTH_SECRET.length !== 64` → error (32 bytes hex).
  - `NODE_ENV === "production"` and `BETTER_AUTH_SECRET` matches the dev placeholder pattern → error.
- [ ] Replace every `process.env.X` read in `src/lib/auth.ts`, `app/**`, `components/**`, and the two scripts with imports from `src/lib/env.ts`. Migration scripts at `scripts/*.ts` import the same loader (the loader has no Next.js dependencies).
- [ ] Add unit tests in `apps/admin/src/lib/env.test.ts` covering each tripwire — feed shaped objects into the schema directly, assert pass/fail. No real env-mutation needed.

## Scope — bootstrap script [0/4]

- [ ] Add `apps/admin/scripts/db-reset.ts`. Steps:
  1. Delete `apps/admin/dev.db` (and any `dev.db-journal`, `dev.db-wal`, `dev.db-shm`) if present.
  2. Run migrations against `file:./dev.db` (reuse the same `migrate.ts` logic; either `import` and call, or `child_process.spawnSync`).
  3. Default `ADMIN_EMAIL=admin@localhost` and `ADMIN_PASSWORD=dev-only-not-secure` in the script's env when not set, then run `seed:admin`.
  4. Print a one-line "now run `npm run dev:admin`" hint plus whatever output `seed:admin` produces.
- [ ] Refuse to run if `NODE_ENV === "production"`. The script is a dev-only construct; the only way to seed prod is via `seed:admin` with explicit env values.
- [ ] Add `db:reset` to `apps/admin/package.json` scripts: `"db:reset": "tsx scripts/db-reset.ts"`.
- [ ] Add `dev:admin` and `db:reset:admin` to root `package.json`:
  - `"dev:admin": "npm -w @wardrobe-assistants/admin run dev"`
  - `"db:reset:admin": "npm -w @wardrobe-assistants/admin run db:reset"`

## Scope — README + .env.example refresh [0/2]

- [ ] Update root `README.md`'s "Getting started" section: a 3-line dev-quickstart for the admin app:
  ```bash
  npm install
  npm run db:reset:admin    # creates apps/admin/dev.db + seeds admin@localhost/dev-only-not-secure
  npm run dev:admin         # starts http://localhost:3000
  ```
- [ ] Update `apps/admin/.env.example`: keep the existing comments; explicitly note that `ADMIN_EMAIL` / `ADMIN_PASSWORD` are only consulted by `seed:admin` and that `db:reset` defaults them in dev.

## Scope — email in dev (forward-looking, half-implemented) [0/2]

The admin will start sending transactional email in a future iteration (password reset, invitations, etc.). This iteration doesn't ship the actual senders, but lays the env shape so that when they land, dev doesn't need a real Resend key.

- [ ] Plan the email-layer shape: a thin wrapper around Resend's SDK lives at `apps/admin/src/lib/mail.ts`. When `env.RESEND_API_KEY` is unset *and* `env.NODE_ENV === "development"`, the wrapper `console.log`s the email body instead of calling Resend. Otherwise it uses the real client.
- [ ] Document this in `apps/admin/.env.example` — `RESEND_API_KEY=` (empty) is the supported dev value; setting it makes dev sends real (useful when testing template work).

## Scope — verify [0/3]

- [ ] Fresh-clone smoke test: in a temp directory, `git clone … && npm install && npm run db:reset:admin && npm run dev:admin`. Should reach `http://localhost:3000` sign-in within ~30s without manual env editing. Sign in as `admin@localhost` / `dev-only-not-secure` — whatever auth steps the admin currently requires, that's the path; iter-13 isn't changing it.
- [ ] Booting `npm run dev:admin` with a prod-shaped `DATABASE_URL` in scope fails fast with a clear Zod error.
- [ ] Booting the prod container with a `file:` URL fails fast with the same error shape.

## Out of scope (deliberate)

- **User/password handling and MFA.** A dedicated future iteration redesigns the user model, the sign-in/sign-up flow, password requirements, and any MFA story (incl. how dev bootstrapping should look once that lands). Iter-13 leaves `src/lib/auth.ts` untouched except for swapping `process.env.X` to the new env loader.
- **Implementing transactional email senders.** Mail wrapper shape is documented; real `mail.send(...)` callsites land in the next email-needing iteration.
- **Mailpit / MailHog container.** When email senders land, console transport (above) covers day-1 dev; mailpit can come if/when templates need visual review.
- **Bunny dev libSQL database.** `file:` SQLite has 100% schema parity with libSQL for our use; bunny generations on a dev DB add no value.
- **Drizzle Studio integration.** Works against `file:` URLs out of the box; mention it once in the README, no scripted setup.
- **Multi-developer fixtures sync.** Single-developer project — defer until it isn't.
- **Production secret rotation.** Tracked separately (the four leaked secrets from iter-11 — `BETTER_AUTH_SECRET`, `DATABASE_AUTH_TOKEN`, `RESEND_API_KEY`, `TERRAFORM_STATE_STORAGE_KEY`).
- **Test-environment NODE_ENV.** `vitest` already sets `NODE_ENV=test`; the env loader's `test` branch reuses dev defaults but doesn't tripwire on `file:` since some tests run against in-memory shapes. Worth a comment in `env.ts` rather than a separate scope item.

## Critical files

- `apps/admin/src/lib/env.ts` (new — Zod schema, tripwires, frozen export)
- `apps/admin/src/lib/env.test.ts` (new — unit tests for tripwires)
- `apps/admin/src/lib/auth.ts` (edit — replace `process.env.*` with `env.*`)
- `apps/admin/scripts/migrate.ts`, `scripts/seed-admin.ts` (edit — same)
- `apps/admin/scripts/db-reset.ts` (new — dev bootstrap)
- `apps/admin/package.json` (edit — add `db:reset` script)
- `package.json` (edit — add `dev:admin`, `db:reset:admin`)
- `apps/admin/.env.example` (edit — clarify dev defaults + email-in-dev behaviour)
- `README.md` (edit — admin dev quickstart)
- Possible new — `apps/admin/src/lib/mail.ts` if we ship the wrapper shape ahead of senders. Otherwise leave as a stub for the next iteration.

## Risks / things to think about

- **Drizzle migrations on first run.** The reset script must run migrations *before* the seed, otherwise the seed inserts into a schema-less DB. Migrate runner is already idempotent against an empty file (verified during iter-7b); double-check after the wrap.
- **Better Auth cookie domain in dev.** With `BETTER_AUTH_URL=http://localhost:3000`, the session cookie is host-only on `localhost`. Verify it works rather than assuming. Cookie name: Better Auth's default.
- **`NODE_ENV` in Next.js.** `next dev` sets `NODE_ENV=development`; `next start` keeps whatever the host set. The env loader runs on the server side at first import; tripwires fire once at boot.
- **`apps/admin/.dev/` vs `apps/admin/dev.db`.** Going with the existing convention (just `dev.db` in the app root). Already covered by the `*.db` gitignore.
- **Production drift from changes.** None of this should affect prod — every guard branches on `NODE_ENV`, and prod sets `NODE_ENV=production` + a `libsql://…` URL on the bunny container app. Verify with the admin's deploy workflow before merge.

## Done when

- `git clone … && npm install && npm run db:reset:admin && npm run dev:admin` reaches the sign-in page, completes a sign-in cycle, and lands on the dashboard — all against `apps/admin/dev.db`, with prod credentials nowhere in scope.
- Booting admin dev with a prod-shaped `DATABASE_URL` fails fast with a clear Zod error.
- Booting the prod container with a `file:` URL fails fast with the same error shape.
- Every `process.env.X` read in `apps/admin/src/` and `apps/admin/scripts/` flows through `src/lib/env.ts`.
- README's "Getting started" section explains the admin dev path in ≤10 lines.
