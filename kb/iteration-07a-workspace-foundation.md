---
title: Iteration 7a — Workspace foundation + tests
type: iteration
status: done
order: 7
---

# Iteration 7a — Workspace foundation + tests

The first half of the admin split. Restructure the repo into npm workspaces, migrate the marketing site to a static export served from bunny Storage + Pull Zone, and stand up a CI verify gate (typecheck + Vitest). Nothing user-visible changes; the payoff is that iter-7b's auth/DB work lands on a foundation that already has tests gating the deploy.

Splitting iter-7 into 7a + 7b is deliberate: the verify gate is most valuable *before* the risky auth code, and every prior iteration needed an "Address PR review" follow-up even at smaller scope.

## Context — why these decisions matter now

- **Workspace restructure before admin code exists** is much cheaper than after. iter-7b adds `packages/db` and `apps/admin` into a structure that already exists.
- **Marketing → static export** removes a runtime container and replaces it with cacheable HTML on bunny's edge. Origin-scoped cookies on the future `admin.wardrobe-assistants.ch` are then trivially separated from the public marketing origin (XSS on marketing cannot read admin sessions).
- **Tests + CI verify gate first** means iter-7b can't deploy code that fails typecheck or a test. Catching a Better Auth misconfiguration in CI is seconds; catching it via a failed bunny.net Magic Container roll-out is minutes.

## Target architecture (this iteration)

```
apps/
  marketing/        # Next.js, output: "export"
packages/           # created empty here, populated in 7b
package.json        # root, workspaces: ["apps/*", "packages/*"]
vitest.config.ts    # root, workspace projects
tests/setup.ts      # shared RTL + jest-dom matchers
kb/                       # stays at root
wardrobe-assistants.pen   # stays at root
.github/workflows/deploy.yml   # verify gate + static marketing deploy
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

Marketing is verified compatible with `output: "export"`: no `cookies()`/`headers()`/`searchParams`/`use server`/`next/image`/`next/font`/runtime `fetch()`. `sitemap.ts` and `robots.ts` pre-render to static files.

## Scope — repo restructure (atomic commit) [4/4]

- [x] Add root `package.json` with `"workspaces": ["apps/*", "packages/*"]`; lift devDependencies that the verify gate needs (vitest, typescript, etc.) to the root
- [x] Move `src/` → `apps/marketing/src/`; relocate `next.config.ts`, `tsconfig.json`, `next-env.d.ts`, `postcss.config.mjs`, `package.json` into `apps/marketing/`
- [x] Delete `Dockerfile` from the repo root (replaced by static export)
- [x] Keep `kb/`, `wardrobe-assistants.pen`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.claude/`, `.hyalo.toml`, `biome.json` at the repo root

## Scope — marketing → static export [2/2]

- [x] `apps/marketing/next.config.ts`: `output: "standalone"` → `output: "export"`; add `images: { unoptimized: true }` defensively
- [x] Verify `apps/marketing/out/` contains `index.html`, `services/index.html`, `impressum/index.html`, `datenschutz/index.html`, `sitemap.xml`, `robots.txt`

## Scope — testing infrastructure [5/5]

Tests gate the deploy. bunny.net rolls out are slow, so cheap signals (typecheck + Vitest) need to fail in CI before any upload runs.

- [x] Install at root: `vitest`, `@vitejs/plugin-react`, `happy-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- [x] Root `vitest.config.ts` with one workspace project pointing at `apps/marketing` (`environment: "happy-dom"` for components, `node` elsewhere); structured so iter-7b can add `apps/admin` and `packages/db` projects without rewriting it
- [x] Shared `tests/setup.ts` registers `@testing-library/jest-dom` matchers
- [x] Scripts: root `"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc -b"`; mirrored as workspace scripts in `apps/marketing`
- [x] Initial test: `apps/marketing/src/app/site-config.test.ts` — production guard throws when any operator field starts with `TODO:` and `NODE_ENV=production`; passes otherwise

## Scope — CI [3/3]

- [x] New `verify` job: `npm ci`, `npm run typecheck`, `npm run test`. Triggers on every push to `main` and every PR. **No `paths-ignore`** — md/pen-only changes still get cheap typecheck insurance.
- [x] Replace existing `build-and-push` job with `build-marketing` (`needs: verify`): runs `npm -w apps/marketing run build`, uploads `apps/marketing/out/` to bunny Storage Zone via `bunnycdn-storage` action (or equivalent), purges Pull Zone via bunny API. `paths-ignore`: `*.md`, `*.pen`, `kb/**`, `.claude/**`, `.hyalo.toml`
- [x] Required new GitHub secrets/vars: `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_PULL_ZONE_ID`, `BUNNY_API_KEY`

## Scope — bunny.net infrastructure (operational, outside the PR diff) [0/4]

- [ ] Provision Storage Zone for marketing (EU region)
- [ ] Create Pull Zone with the Storage Zone as origin; bind apex (`wardrobe-assistants.ch`) and `www.wardrobe-assistants.ch`; load free TLS cert + force-SSL on both
- [ ] DNS: apex → Pull Zone, `www` → Pull Zone (CNAME)
- [ ] After first successful Pull Zone deploy, decommission the existing marketing Magic Container

## Critical files

- `package.json` (root) — workspaces config
- `apps/marketing/next.config.ts` — `output: "export"`
- `vitest.config.ts` (root) — Vitest workspace config
- `.github/workflows/deploy.yml` — verify gate + static marketing deploy

## Out of scope (deferred to iter-7b)

- `packages/db` (Drizzle schema + libSQL client)
- `apps/admin` Next.js app
- Better Auth, TOTP, Resend
- admin Magic Container provisioning
- Service catalog, quotes, gigs (later iterations)

## Done when

- `npm install` at the repo root resolves with the workspace; `apps/marketing` builds
- `npm test` runs Vitest across the workspace and exits 0; `npm run typecheck` exits 0
- A red test or typecheck blocks the `build-marketing` job (`needs: verify`)
- `npm -w apps/marketing run dev` renders marketing identically to before
- `npm -w apps/marketing run build` produces `apps/marketing/out/` as fully static HTML
- After deploy: `https://wardrobe-assistants.ch/` and `https://www.wardrobe-assistants.ch/` are served by the bunny Pull Zone (origin: Storage Zone), all routes including `/services`, `/impressum`, `/datenschutz` reachable, sitemap and robots present
