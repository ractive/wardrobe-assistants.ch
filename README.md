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
- `npm run verify` — quality gate: `lint && typecheck && test`. Run before any commit.
- `npm run verify:tf` — Terraform gate: `tofu fmt -check && tofu validate` (requires `tofu init` first; only relevant when `infra/terraform/**` changed)
- `npm run lighthouse:homepage` / `npm run lighthouse:services` — headless Lighthouse audit (see [Performance auditing](#performance-auditing))

Scripts are mirrored as workspace scripts in `apps/homepage/`; run them directly with `npm -w @wardrobe-assistants/homepage run <script>`.

## Project layout

- `apps/homepage/` — Next.js homepage (App Router), the public-facing landing site. Deploys via `build-homepage` to `wardrobe-assistants.ch` / `www.wardrobe-assistants.ch`.
  - `src/app/` — routes (`/`, `/services`, `/impressum`, `/datenschutz`), `layout.tsx`, `sitemap.ts`, `robots.ts`, `site-config.ts`
  - `src/components/` — shared React components. Icons are inlined as SVG in [`icons.tsx`](apps/homepage/src/components/icons.tsx) (no `lucide-react` runtime in the homepage bundle); the file's header comment documents how to add a new one.
  - `public/` — static assets
- `apps/admin/` — Next.js admin app (App Router) with Better Auth (email/password + TOTP). Deploys via `build-admin` as a Docker image to a bunny.net Magic Container at `admin.wardrobe-assistants.ch`.
- `packages/db/` — shared libSQL/Drizzle schema and client used by `apps/admin/`
- `tests/setup.ts` — Vitest shared setup (`@testing-library/jest-dom` matchers)
- `vitest.config.ts` — root Vitest workspace config
- `kb/` — internal knowledgebase (iteration plans, notes); markdown with YAML frontmatter, queryable via the `hyalo` CLI
- `wardrobe-assistants.pen` — design source of truth (Pencil); see `AGENTS.md`
- `infra/terraform/` — OpenTofu config managing the bunny.net account (DNS, pull zones, storage zones, container app, image registry, libSQL database). See [Infrastructure (OpenTofu)](#infrastructure-opentofu) below.
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

## Infrastructure (OpenTofu)

The bunny.net account backing this site is managed declaratively from `infra/terraform/`. 18 resources are imported and tracked: DNS zone + 7 records, 2 storage zones (`wardrobe-assistants-ch-homepage`, `wardrobe-assistants-terraform-state`), 2 pull zones + 3 hostnames, the admin Magic Container app + image registry, and the `wa-admin-prod` libSQL database.

State lives in the bunny `wardrobe-assistants-terraform-state` storage zone via OpenTofu's `http` backend; bunny returns HTTP 201 on PUT (vs. the 200 the backend expects), so every command runs with `-lock=false`. Single-operator project — safe.

### Your role

Apply runs on **your laptop**, not in CI. CI only plans and reports drift. The flow is:

1. Edit `infra/terraform/*.tf`, open a PR. CI runs `tofu plan` and posts the diff as a PR comment (once iter-12 lands).
2. Review the plan. If it's what you want, merge.
3. Pull `main` locally, `cd infra/terraform`, run `tofu apply -lock=false`. **You** are the gate that turns a merged config diff into a live change.
4. The scheduled drift-check (also iter-12) opens an issue if anyone edits config from the bunny dashboard out-of-band.

Until iter-12 ships, every step above is purely manual.

### Local setup (one-time)

```bash
brew install opentofu                                                  # 1.9+
cd infra/terraform
TF_VAR_bunny_api_key="$BUNNY_API_KEY" tofu init \
  -backend-config=<(printf 'headers = { AccessKey = "%s" }\n' "$TERRAFORM_STATE_STORAGE_KEY")
```

`BUNNY_API_KEY` and `TERRAFORM_STATE_STORAGE_KEY` come from `.env.local` (gitignored). The full per-shell init recipe is in [`kb/iac-runbook.md`](kb/iac-runbook.md) — that's the canonical operations doc.

### Day-to-day commands

```bash
# Verify TF (fmt check + validate, no live calls)
npm run verify:tf

# See what would change
TF_VAR_bunny_api_key="$BUNNY_API_KEY" tofu plan -lock=false -detailed-exitcode
# exit 0 = no drift. exit 2 = drift; review and act.

# Apply (only after a clean plan)
TF_VAR_bunny_api_key="$BUNNY_API_KEY" tofu apply -lock=false
```

### Safety belts

- `prevent_destroy = true` on every production resource (DNS zone, storage zones, pull zones, container app, database). `tofu destroy` will hard-fail without a `lifecycle` edit in the same PR.
- `ignore_changes = [container]` on the admin app — env vars + image tag are owned by the deploy pipeline, never enter state.
- `ignore_changes = all` on Resend-managed DNS records (DKIM, SPF, MX, DMARC).
- Snapshot of the live config at iter-11 lives in [`kb/bunny-snapshot-2026-05-07/`](kb/bunny-snapshot-2026-05-07/) as a manual rebuild reference if state is ever lost.

### Disaster recovery

If the state file is lost, every resource has documented import commands in [`kb/iac-runbook.md`](kb/iac-runbook.md) under "Re-importing resources." Database snapshots are bunny-built-in: `hoppy db versions` lists them, `hoppy db restore` rolls back.

## Performance auditing

Two-browser flow: Lighthouse for the Chromium numbers, `ff-rdp` for Firefox parity.

**Lighthouse (Chromium, headless):**

```bash
npm run lighthouse:homepage    # audits https://wardrobe-assistants.ch/
npm run lighthouse:services    # audits https://wardrobe-assistants.ch/services/
```

Reports land in `kb/perf-reports/<page>-<timestamp>.report.{json,html}` (gitignored — Lighthouse appends a `.report.` infix when emitting both JSON and HTML).

To audit a local build, export the static site and serve `apps/homepage/out/` on `http://localhost:4173`, then set `LH_TARGET=local`:

```bash
npm -w @wardrobe-assistants/homepage run build
npx serve apps/homepage/out -l 4173 &
LH_TARGET=local npm run lighthouse:homepage
```

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
