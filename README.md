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

Scripts are mirrored as workspace scripts in `apps/homepage/`; run them directly with `npm -w @wardrobe-assistants/homepage run <script>`.

## Project layout

- `apps/homepage/` — Next.js homepage (App Router), the public-facing landing site
  - `src/app/` — routes (`/`, `/services`, `/impressum`, `/datenschutz`), `layout.tsx`, `sitemap.ts`, `robots.ts`, `site-config.ts`
  - `src/components/` — shared React components
  - `public/` — static assets
- `packages/` — shared libraries (populated in iter-7b)
- `tests/setup.ts` — Vitest shared setup (`@testing-library/jest-dom` matchers)
- `vitest.config.ts` — root Vitest workspace config
- `kb/` — internal knowledgebase (iteration plans, notes); markdown with YAML frontmatter, queryable via the `hyalo` CLI
- `wardrobe-assistants.pen` — design source of truth (Pencil); see `AGENTS.md`
- `.github/workflows/deploy.yml` — verify gate (typecheck + tests) followed by static deploy to bunny.net

## Deployment

Pushes to `main` first run `verify` (typecheck + Vitest). Only on green does `build-homepage` run: it builds the static export, uploads `apps/homepage/out/` to the bunny Storage Zone, and purges the Pull Zone. Markdown, design source, and `.claude/` changes are skipped from the build/deploy step (verify still runs).

Required CI secrets:

- `secrets.GITHUB_TOKEN` — provided automatically
- `secrets.BUNNY_STORAGE_ZONE_NAME`
- `secrets.BUNNY_STORAGE_PASSWORD`
- `secrets.BUNNY_PULL_ZONE_ID`
- `secrets.BUNNY_API_KEY`

## Legal pages

`/impressum` and `/datenschutz` are required by Swiss law (UWG Art. 3(1)(s) and revFADP). The operator's legal name, address and registration details live in `apps/homepage/src/app/site-config.ts` under the `operator` constant — placeholder strings prefixed with `TODO:` must be replaced with real values before going to production. A Vitest unit test (`site-config.test.ts`) plus the `assertOperatorReady` production guard fail the build if any placeholder slips through. See `kb/iteration-06-legal-compliance.md` for the legal context and `kb/no-tracking-note.md` for the consent state.

## Working with this repo

See [`AGENTS.md`](AGENTS.md) for conventions (browser debugging via `ff-rdp`, Next.js 16 caveats, the `.pen` design workflow). Knowledgebase queries should go through `hyalo` rather than raw grep.
