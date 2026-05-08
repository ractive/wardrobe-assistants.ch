---
title: Iteration 7b — Admin app + auth ("Hello admin")
type: iteration
status: done
order: 8
---

# Iteration 7b — Admin app + auth ("Hello admin")

The second half of the admin split. Adds `packages/db`, the `apps/admin` Next.js app, Better Auth (email/password + TOTP), Resend for transactional email, and a "Hello, {user.email}" dashboard. Lands on the workspace + verify gate from iter-7a, so typecheck and Vitest fail in CI before the admin Docker build runs.

This iteration deliberately ships only foundations — auth, dashboard shell, seed script — so every subsequent admin feature (quotes, gigs, freelancer invitations, service catalog) lands on stable ground.

## Context — why these decisions matter now

- **Two-deployment topology** (marketing static from 7a, admin runtime here) gives origin-scoped cookies. An XSS on the public marketing site cannot read admin session tokens because they live on a different origin (`admin.wardrobe-assistants.ch`).
- **Shared `packages/db`** lets the marketing site read live data (e.g. service prices) at build time with one schema source of truth, while keeping CRUD authority in admin. Read-only DB token for marketing CI is plumbed here but unused until iter-8.
- **Better Auth with mandatory TOTP** is overkill for one user today and exactly right for an admin surface that will eventually mint quotes and invite freelancers.

## Target architecture additions (over iter-7a)

```
apps/
  admin/            # Next.js 16, output: "standalone"
packages/
  db/               # Drizzle schema + libSQL client; Better Auth tables + (empty) domain tables
.github/workflows/deploy.yml
   └─> verify (from 7a) → build-marketing (from 7a)
                       └─> build-admin (new)
```

DB: **bunny.net Database (libSQL / SQLite, EU region)**. Two auth tokens:

- Full-access token — used by `apps/admin` at runtime
- Read-only token — used by marketing CI at build time (plumbed but unused this iteration)

Stack on the admin side: **Better Auth** (email/password + TOTP MFA), **Drizzle ORM** (libSQL driver, SQLite dialect), **shadcn/ui** + Tailwind v4, react-hook-form + zod, sonner, server actions. **Resend** for verification + password-reset email.

## Scope — `packages/db` [4/4]

- [x] Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `@libsql/client`); SQLite dialect
- [x] `packages/db/src/schema.ts` — Better Auth tables defined with `sqliteTable` (`user`, `session`, `account`, `verification`); IDs `text('id')`, timestamps `integer({ mode: 'timestamp_ms' })`; domain tables left empty
- [x] `packages/db/src/client.ts` — `createDb({ url, authToken })` factory using `drizzle-orm/libsql`; consumers pass their own credentials. Same client works against `file:./dev.db` for dev and `libsql://…` in prod
- [x] `packages/db/drizzle.config.ts` — `dialect: 'sqlite'`; `drizzle-kit generate` produces SQL migrations under `packages/db/migrations/`

## Scope — `apps/admin` [4/4]

- [x] Fresh Next.js 16 app, App Router, TypeScript, Tailwind v4, React Compiler, `output: "standalone"`
- [x] Own `Dockerfile` building from workspace root with `npm ci -w apps/admin --include-workspace-root`; multi-stage; final stage runs `node apps/admin/server.js`
- [x] Migrations applied on container start: `apps/admin/scripts/migrate.ts` invoked from Docker `CMD` before `node server.js`
- [x] Initialize shadcn/ui via `npx shadcn@latest init`; add `button`, `input`, `label`, `form`, `card`, `sonner`; add the `dashboard-01` block as the protected-area shell. Companion deps: `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`

## Scope — Better Auth [5/5]

- [x] `apps/admin/src/lib/auth.ts` — Drizzle adapter, `emailAndPassword`, TOTP plugin (required once enrolled), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- [x] Session cookie: `secure: true`, `sameSite: "lax"`, `httpOnly: true`, host-only on `admin.wardrobe-assistants.ch`
- [x] `apps/admin/src/app/api/auth/[...all]/route.ts` — Better Auth route handler
- [x] `apps/admin/middleware.ts` gates everything except `/login`, `/api/auth/*`, Next.js internals
- [x] `<meta name="robots" content="noindex,nofollow">` in admin root layout; `apps/admin/src/app/robots.ts` returns `Disallow: /` for all user agents

## Scope — Resend [3/3]

- [x] Account + sending domain `wardrobe-assistants.ch` verified (SPF/DKIM/DMARC at the registrar) — operational, outside the PR
- [x] `apps/admin/src/lib/email.ts` — wrapper over `resend` SDK
- [x] Wired into Better Auth's `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword`. Env: `RESEND_API_KEY`, `EMAIL_FROM`

## Scope — login + protected dashboard [3/3]

- [x] `apps/admin/src/app/login/page.tsx` — react-hook-form + zod, two-step (password → TOTP)
- [x] `apps/admin/src/app/(dashboard)/layout.tsx` — server component; calls `auth.api.getSession()`; redirects to `/login` if unauthenticated; uses shadcn `dashboard-01` shell
- [x] `apps/admin/src/app/(dashboard)/page.tsx` — renders "Hello, {user.email}" + sign-out (server action)

## Scope — first-admin seed script [4/4]

- [x] `apps/admin/scripts/seed-admin.ts` — run via `npm -w apps/admin run seed:admin`
- [x] Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env; refuses if missing
- [x] Idempotent; exits 0 if user already exists
- [x] Creates user, marks email verified, generates TOTP secret, prints secret + ASCII QR (`qrcode-terminal`) to stdout once

## Scope — testing additions [2/2]

- [x] Extend root `vitest.config.ts` with workspace projects for `packages/db` and `apps/admin`
- [x] Representative tests:
  - `packages/db`: schema imports cleanly; `createDb({ url: 'file::memory:' })` returns a working client; migrations apply against in-memory libSQL
  - `apps/admin`: zod login schema (valid/invalid cases), middleware redirect for unauthenticated request, `seed-admin.ts` idempotency against in-memory libSQL

## Scope — CI [3/3]

- [x] Extend the `verify` job to also run `npm -w apps/admin run build` so PRs catch admin build breakage before merge (mirrors what iter-7a does for marketing). Cheaper than catching it via a failed Docker push on `main`.
- [x] Add `build-admin` job (`needs: verify`): Docker build/push/roll flow targeted at the new admin Magic Container app (new `APP_ID` GitHub var). Runs only on `push` to `main`. Use `dorny/paths-filter` with `'**'` as the first positive pattern followed by negations (`'!**/*.md'`, `'!**/*.pen'`, `'!kb/**'`, `'!.claude/**'`, `'!.hyalo.toml'`) — negation-only filters always evaluate to false, the leading `'**'` is required.
- [x] Required new GitHub secrets/vars: admin `APP_ID` (var), `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` (secrets)

## Scope — bunny.net infrastructure (operational, outside the PR diff) [4/4]

- [x] Provision libSQL DB on bunny.net Database; mint two auth tokens (full-access for admin runtime, read-only for marketing CI)
- [x] Provision second Magic Container app for admin; bind `admin.wardrobe-assistants.ch`; enable auto-TLS
- [x] DNS: `admin` CNAME → admin Magic Container
- [x] Admin container env: `DATABASE_URL` (libsql://…), `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://admin.wardrobe-assistants.ch`, `RESEND_API_KEY`, `EMAIL_FROM`

## Critical files

- `apps/admin/src/lib/auth.ts` — Better Auth config
- `apps/admin/middleware.ts` — route gating
- `packages/db/src/schema.ts` — Drizzle schema
- `apps/admin/Dockerfile` — admin runtime image
- `.github/workflows/deploy.yml` — adds `build-admin` job

## Out of scope (deferred to later iterations)

- Service catalog CRUD + marketing reading prices at build (iteration 8 — this is what activates the marketing CI's read-only DB credential and the shared `packages/db` types)
- Quotes, gigs, freelancer invitations
- Organization/team membership model (Better Auth's organization plugin enabled later)
- Audit logs, rate limiting, CSP hardening beyond defaults
- Passkey/WebAuthn enrollment (start password+TOTP, evolve later)

## Done when

- `npm -w apps/admin run dev` redirects `/` to `/login`
- `npm -w packages/db run db:generate && db:migrate` against `file:./dev.db` creates the Better Auth tables
- Seed script creates an admin user and prints a TOTP QR; re-running is a no-op
- Login flow: email + password → TOTP prompt → land on `/dashboard`
- `docker build -f apps/admin/Dockerfile .` succeeds; container boots, migrates, serves `/login`
- `npm test` passes new `packages/db` and `apps/admin` tests
- A red test or typecheck blocks the `build-admin` job
- After deploy: `https://admin.wardrobe-assistants.ch/` serves login; full email-password-TOTP cycle lands on dashboard
- `curl https://admin.wardrobe-assistants.ch/robots.txt` returns `Disallow: /`; admin HTML contains `noindex,nofollow`
