# wardrobe-assistants.ch

Landing page for a Swiss wardrobe crew. Built with Next.js 16 (App Router) and Tailwind v4. Deployed as a fully static export to bunny.net Storage + Pull Zone.

## Stack

- **npm workspaces** monorepo (`apps/*`, `packages/*`)
- **Next.js 16** (`output: "export"`) with React 19 and the React Compiler
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Vitest** + Testing Library (happy-dom) — verify gate in CI
- **Biome** for linting and formatting
- **TypeScript**
- Static deploy to **bunny.net Storage Zone** (origin) + **Pull Zone** (edge) via GitHub Actions

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts (root)

- `npm run dev` — start the homepage dev server
- `npm run build` — production build (static export to `apps/homepage/out/`)
- `npm run typecheck` — workspace-wide TypeScript check
- `npm test` — run Vitest across the workspace
- `npm run test:watch` — Vitest in watch mode
- `npm run lint` — `biome check`
- `npm run format` — `biome format --write`
- `npm run lighthouse:homepage` / `npm run lighthouse:services` — headless Lighthouse audit (see [Performance auditing](#performance-auditing))

Scripts are mirrored as workspace scripts in `apps/homepage/`; run them directly with `npm -w @wardrobe-assistants/homepage run <script>`.

## Project layout

- `apps/homepage/` — Next.js homepage (App Router), the public-facing landing site. Deploys via `build-homepage` to `wardrobe-assistants.ch` / `www.wardrobe-assistants.ch`.
  - `src/app/` — routes (`/`, `/services`, `/impressum`, `/datenschutz`), `layout.tsx`, `sitemap.ts`, `robots.ts`, `site-config.ts`
  - `src/components/` — shared React components
  - `public/` — static assets
- `apps/admin/` — Next.js admin app (App Router) with Better Auth (email/password + TOTP). Deploys via `build-admin` as a Docker image to a bunny.net Magic Container at `admin.wardrobe-assistants.ch`.
- `packages/db/` — shared libSQL/Drizzle schema and client used by `apps/admin/`
- `tests/setup.ts` — Vitest shared setup (`@testing-library/jest-dom` matchers)
- `vitest.config.ts` — root Vitest workspace config
- `kb/` — internal knowledgebase (iteration plans, notes); markdown with YAML frontmatter, queryable via the `hyalo` CLI
- `wardrobe-assistants.pen` — design source of truth (Pencil); see `AGENTS.md`
- `.github/workflows/deploy.yml` — verify gate (typecheck + tests) followed by static deploy to bunny.net

## Deployment

Pushes to `main` first run `verify` (typecheck + Vitest + both Next builds). Only on green do the deploy jobs run:

- `build-homepage` — builds the static export, uploads `apps/homepage/out/` to the bunny Storage Zone, and purges the Pull Zone. Public origin: `wardrobe-assistants.ch` / `www.wardrobe-assistants.ch`.
- `build-admin` — builds the admin Next.js app as a Docker image, pushes to bunny's container registry, and rolls the Magic Container deployment. Public origin: `admin.wardrobe-assistants.ch`.

Markdown, design source, and `.claude/` changes are skipped from the deploy steps via paths-filter (verify still runs).

The two-origin split is deliberate: an XSS on the public homepage cannot read admin session cookies because they live on a different origin.

Required CI secrets:

- `secrets.GITHUB_TOKEN` — provided automatically
- `secrets.BUNNY_API_KEY`
- `secrets.BUNNY_STORAGE_ZONE_NAME`, `secrets.BUNNY_STORAGE_PASSWORD`, `secrets.BUNNY_PULL_ZONE_ID` — homepage upload
- `secrets.BUNNY_REGISTRY`, `secrets.BUNNY_REGISTRY_USERNAME`, `secrets.BUNNY_REGISTRY_PASSWORD` — admin Docker push
- `secrets.DATABASE_URL`, `secrets.DATABASE_AUTH_TOKEN_FULL`, `secrets.BETTER_AUTH_SECRET`, `secrets.RESEND_API_KEY` — admin runtime

Required CI variables:

- `vars.ADMIN_APP_ID` — bunny Magic Container app id used in the registry tag and the deploy POST

The infrastructure-provisioning playbook (Storage Zones, Pull Zones, Magic Container, DNS, TLS, decommission of the legacy container) lives in [`kb/runbook-go-live.md`](kb/runbook-go-live.md). Pre-cutover state snapshot: [`kb/runbook-go-live-pre-state.json`](kb/runbook-go-live-pre-state.json).

## Performance auditing

Two-browser flow: Lighthouse for the Chromium numbers, `ff-rdp` for Firefox parity.

**Lighthouse (Chromium, headless):**

```bash
npm run lighthouse:homepage    # audits https://wardrobe-assistants.ch/
npm run lighthouse:services    # audits https://wardrobe-assistants.ch/services/
```

Reports land in `kb/perf-reports/<page>-<timestamp>.{json,html}` (gitignored). Set `LH_TARGET=local` to point at a locally-served `apps/homepage/out/` instead of the live URL.

The current invariant is **Performance ≥95, Accessibility 100, Best Practices 100, SEO 100** on the desktop preset. Any regression below that bar should be triaged before merge.

**Firefox cross-check (`ff-rdp`):**

```bash
ff-rdp launch
ff-rdp perf audit > kb/perf-reports/firefox-homepage-$(date +%Y%m%d-%H%M).json
ff-rdp perf compare https://wardrobe-assistants.ch/ https://wardrobe-assistants.ch/services/
ff-rdp a11y    # contrast + a11y inspector findings
```

Meaningful divergence between Chromium and Firefox (>20% on LCP/FCP/TTFB) goes into `kb/perf-reports/cross-browser-notes.md` (the only file in that directory committed to git) so the next iteration has a baseline.

## Legal pages

`/impressum` and `/datenschutz` are required by Swiss law (UWG Art. 3(1)(s) and revFADP). The operator's legal name, address and registration details live in `apps/homepage/src/app/site-config.ts` under the `operator` constant — placeholder strings prefixed with `TODO:` must be replaced with real values before going to production. A Vitest unit test (`site-config.test.ts`) plus the `assertOperatorReady` production guard fail the build if any placeholder slips through. See `kb/iteration-06-legal-compliance.md` for the legal context and `kb/no-tracking-note.md` for the consent state.

## Working with this repo

See [`AGENTS.md`](AGENTS.md) for conventions (browser debugging via `ff-rdp`, Next.js 16 caveats, the `.pen` design workflow). Knowledgebase queries should go through `hyalo` rather than raw grep.
