---
title: Iteration 7 — Admin foundation ("Hello admin")
type: iteration
status: planned
order: 7
---

# Iteration 7 — Admin foundation ("Hello admin")

The first step toward an admin area where admins eventually create quotes, invite freelancers for gigs, manage prices, and run the service catalog. This iteration deliberately ships only foundations — workspace restructure, two-app deployment, auth — so every subsequent admin feature lands on stable ground.

## Context — why these decisions matter now

- **Two-deployment topology** (marketing static, admin runtime) gives origin-scoped cookies. An XSS on the public marketing site cannot read admin session tokens because they live on a different origin (`admin.wardrobe-assistants.ch`). Folding admin into the existing app under `/admin` would permanently couple the two surfaces' security boundaries.
- **Shared `packages/db`** lets the marketing site read live data (e.g. service prices) at build time with one schema source of truth, while keeping CRUD authority in admin.
- **Restructuring before admin code exists** is much cheaper than after.

## Target architecture

```
apps/
  marketing/        # Next.js, output: "export"
  admin/            # Next.js, output: "standalone"
packages/
  db/               # Drizzle schema + client; auth tables + (empty) domain tables
package.json        # root, workspaces: ["apps/*", "packages/*"]
kb/                 # stays at root
wardrobe-assistants.pen   # stays at root
.github/workflows/  # one workflow, two jobs (build-marketing, build-admin)
```

**Marketing serving path** (set up once, then read-only at runtime):

```
next build (output: "export")
   └─> apps/marketing/out/   (static HTML/CSS/JS/assets)
         └─> uploaded by CI to:  bunny Storage Zone
               └─> origin of:    bunny Pull Zone
                     └─> bound hostnames: wardrobe-assistants.ch (apex)
                                          www.wardrobe-assistants.ch
                     └─> auto-TLS (Let's Encrypt via hoppy)
```

**Admin serving path**:

```
docker build (Next.js output: "standalone")
   └─> image pushed to ghcr.io
         └─> bunny Magic Container app (admin-dedicated)
               └─> bound hostname: admin.wardrobe-assistants.ch
               └─> auto-TLS
```

DB: **bunny.net Database (libSQL / SQLite, EU region)**. Two auth tokens:
- Full-access token — used by `apps/admin` at runtime.
- Read-only token — used by marketing CI at build time (plumbed but unused this iteration).

Stack on the admin side: **Better Auth** (email/password + TOTP MFA), **Drizzle ORM** (libSQL driver, SQLite dialect), **shadcn/ui** + Tailwind v4, react-hook-form + zod, sonner, server actions. **Resend** for verification + password-reset email.

## Scope — repo restructure (single atomic commit)

- [ ] Add root `package.json` with `"workspaces": ["apps/*", "packages/*"]`
- [ ] Move `src/` → `apps/marketing/src/`; relocate `next.config.ts`, `tsconfig.json`, `Dockerfile`, `next-env.d.ts`, `postcss.config.mjs`, `package.json` into `apps/marketing/`
- [ ] Update `apps/marketing/Dockerfile` `COPY` paths for the new layout
- [ ] Keep `kb/`, `wardrobe-assistants.pen`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.claude/`, `.hyalo.toml`, `biome.json` at the repo root

## Scope — marketing → static export

- [ ] `apps/marketing/next.config.ts`: `output: "standalone"` → `output: "export"`; add `images: { unoptimized: true }` defensively
- [ ] Delete `apps/marketing/Dockerfile` (no longer needed)
- [ ] Verify `out/` contains `index.html`, `services/index.html`, `impressum/index.html`, `datenschutz/index.html`, `sitemap.xml`, `robots.txt`

Marketing is verified compatible: no `cookies()`/`headers()`/`searchParams`/`use server`/`next/image`/`next/font`/runtime `fetch()`. `sitemap.ts` and `robots.ts` pre-render to static files.

## Scope — `packages/db`

- [ ] Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `@libsql/client`); SQLite dialect
- [ ] `packages/db/src/schema.ts` — Better Auth tables defined with `sqliteTable` (`user`, `session`, `account`, `verification`); IDs `text('id')`, timestamps `integer({ mode: 'timestamp_ms' })`; domain tables left empty
- [ ] `packages/db/src/client.ts` — `createDb({ url, authToken })` factory using `drizzle-orm/libsql`; consumers pass their own credentials. Same client works against a local `file:./dev.db` for dev and a remote `libsql://…` URL in prod
- [ ] `packages/db/drizzle.config.ts` — `dialect: 'sqlite'`; `drizzle-kit generate` produces SQL migrations under `packages/db/migrations/`

## Scope — `apps/admin`

- [ ] Fresh Next.js 16 app, App Router, TypeScript, Tailwind v4, React Compiler, `output: "standalone"`
- [ ] Own `Dockerfile` building from workspace root with `npm ci -w apps/admin --include-workspace-root`; multi-stage; final stage runs `node apps/admin/server.js`
- [ ] Migrations applied on container start: `apps/admin/scripts/migrate.ts` invoked from Docker `CMD` before `node server.js`
- [ ] Initialize shadcn/ui via `npx shadcn@latest init`; add `button`, `input`, `label`, `form`, `card`, `sonner`; add the `dashboard-01` block as the protected-area shell
- [ ] Companion deps: `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`, `lucide-react` (already in repo)

## Scope — Better Auth

- [ ] `apps/admin/src/lib/auth.ts` configured with Drizzle adapter, `emailAndPassword`, TOTP plugin (required once enrolled), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- [ ] Session cookie: `secure: true`, `sameSite: "lax"`, `httpOnly: true`, host-only on `admin.wardrobe-assistants.ch`
- [ ] `apps/admin/src/app/api/auth/[...all]/route.ts` — Better Auth route handler
- [ ] `apps/admin/middleware.ts` gates everything except `/login`, `/api/auth/*`, Next.js internals
- [ ] `<meta name="robots" content="noindex,nofollow">` in admin root layout
- [ ] `apps/admin/src/app/robots.ts` returns `Disallow: /` for all user agents

## Scope — Resend

- [ ] Account + sending domain `wardrobe-assistants.ch` verified (SPF/DKIM/DMARC at the registrar) — operational, outside the PR
- [ ] `apps/admin/src/lib/email.ts` — wrapper over `resend` SDK
- [ ] Wired into Better Auth's `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword`
- [ ] Env: `RESEND_API_KEY`, `EMAIL_FROM`

## Scope — login + protected dashboard

- [ ] `apps/admin/src/app/login/page.tsx` — react-hook-form + zod, two-step (password → TOTP)
- [ ] `apps/admin/src/app/(dashboard)/layout.tsx` — server component; calls `auth.api.getSession()`; redirects to `/login` if unauthenticated; uses shadcn `dashboard-01` shell
- [ ] `apps/admin/src/app/(dashboard)/page.tsx` — renders "Hello, {user.email}" + sign-out (server action)

That's the entire user-visible scope.

## Scope — first-admin seed script

- [ ] `apps/admin/scripts/seed-admin.ts` — run via `npm -w apps/admin run seed:admin`
- [ ] Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env; refuses if missing
- [ ] Idempotent; exits 0 if user already exists
- [ ] Creates user, marks email verified, generates TOTP secret, prints secret + ASCII QR (`qrcode-terminal`) to stdout once
- [ ] Operator scans into 1Password/Authy, then deletes env vars from shell history

## Scope — CI

- [ ] Split `.github/workflows/deploy.yml` into two jobs:
  - `build-marketing`: triggers on `apps/marketing/**`, `packages/db/**`, root config; runs `npm -w apps/marketing run build`; uploads `apps/marketing/out/` to bunny Storage Zone via `bunnycdn-storage`; purges Pull Zone via bunny API; uses `DATABASE_URL` + `DATABASE_AUTH_TOKEN_RO` (currently unused, plumbed for next iteration)
  - `build-admin`: triggers on `apps/admin/**`, `packages/db/**`, root config; existing Docker build/push/roll flow targeted at a new bunny Magic Container app dedicated to admin (new `APP_ID` GitHub var)
- [ ] Both jobs share `paths-ignore` (`*.md`, `*.pen`, `kb/**`, `.claude/**`, `.hyalo.toml`)

## Scope — bunny.net infrastructure (operational, outside the PR diff)

- [ ] Provision libSQL DB on bunny.net Database; mint two auth tokens (full-access for admin runtime, read-only for marketing CI)
- [ ] Provision Storage Zone for marketing; create Pull Zone with that Storage Zone as origin; bind apex (`wardrobe-assistants.ch`) and `www.wardrobe-assistants.ch` as Pull Zone hostnames; load free TLS cert + force-SSL on both
- [ ] Provision second Magic Container app for admin; bind `admin.wardrobe-assistants.ch`; enable auto-TLS
- [ ] DNS: `admin` CNAME → admin Magic Container; `www`/apex → marketing Pull Zone
- [ ] Admin container env: `DATABASE_URL` (libsql://…), `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://admin.wardrobe-assistants.ch`, `RESEND_API_KEY`, `EMAIL_FROM`

## Critical files

- `package.json` (root) — workspaces config
- `apps/marketing/next.config.ts` — `output: "export"`
- `apps/admin/src/lib/auth.ts` — Better Auth config
- `apps/admin/middleware.ts` — route gating
- `packages/db/src/schema.ts` — Drizzle schema
- `.github/workflows/deploy.yml` — two-job split

## Out of scope (deferred to later iterations)

- Service catalog CRUD + marketing reading prices at build (this is the first thing iteration 8 should likely do — it activates the marketing CI's read-only DB credential and the shared `packages/db` types)
- Quotes, gigs, freelancer invitations
- Organization/team membership model (Better Auth's organization plugin enabled later)
- Audit logs, rate limiting, CSP hardening beyond defaults
- Passkey/WebAuthn enrollment (start password+TOTP, evolve later)

## Done when

- `npm install` at the repo root resolves both apps + `packages/db`
- `npm -w apps/marketing run dev` renders marketing identically to before; `npm -w apps/admin run dev` redirects `/` to `/login`
- `npm -w packages/db run db:generate && db:migrate` against a local libSQL file (`file:./dev.db`) creates the Better Auth tables
- Seed script creates an admin user and prints a TOTP QR; re-running is a no-op
- Login flow: email + password → TOTP prompt → land on `/dashboard`
- `npm -w apps/marketing run build` produces a fully static `out/` directory; opening `out/index.html` in a browser renders the page
- `docker build -f apps/admin/Dockerfile .` succeeds; container boots, migrates, serves `/login`
- After deploy: `https://wardrobe-assistants.ch/` and `https://www.wardrobe-assistants.ch/` are served by the marketing Pull Zone (origin: Storage Zone); `https://admin.wardrobe-assistants.ch/` serves login; full email-password-TOTP cycle lands on dashboard
- `curl https://admin.wardrobe-assistants.ch/robots.txt` returns `Disallow: /`; admin HTML contains `noindex,nofollow`
