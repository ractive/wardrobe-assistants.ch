# wardrobe-assistants.ch

Landing page for a Swiss wardrobe crew. Built with Next.js 16 (App Router) and Tailwind v4.

## Stack

- **Next.js 16** with React 19 and the React Compiler
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Biome** for linting and formatting
- **TypeScript**
- Container deploy to **bunny.net Magic Containers** via GitHub Actions

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build (`output: "standalone"`)
- `npm run start` — run the built server
- `npm run lint` — `biome check`
- `npm run format` — `biome format --write`

## Project layout

- `src/app/` — App Router routes, `layout.tsx`, `sitemap.ts`, `robots.ts`, `site-config.ts`
- `src/components/` — shared React components
- `public/` — static assets
- `kb/` — internal knowledgebase (iteration plans, notes); markdown with YAML frontmatter, queryable via the `hyalo` CLI
- `wardrobe-assistants.pen` — design source of truth (Pencil); see `AGENTS.md`
- `Dockerfile` — multi-stage build on `node:22-alpine`, runs `node server.js` from the standalone output
- `.github/workflows/deploy.yml` — builds the image, pushes to GHCR, rolls the bunny.net container

## Deployment

Pushes to `main` that touch app code build a Docker image, push it to `ghcr.io/<repo>:<sha>`, and update the bunny.net Magic Container. Markdown, design source, and `.claude/` changes are skipped via `paths-ignore`.

Required CI secrets/vars:

- `secrets.GITHUB_TOKEN` — provided automatically
- `secrets.BUNNYNET_API_KEY`
- `vars.APP_ID` — bunny.net Magic Containers app id

## Working with this repo

See [`AGENTS.md`](AGENTS.md) for conventions (browser debugging via `ff-rdp`, Next.js 16 caveats, the `.pen` design workflow). Knowledgebase queries should go through `hyalo` rather than raw grep.
