---
title: Iteration 10 — Lighthouse polish (perf + a11y to 100)
type: iteration
status: implemented
order: 11
---

# Iteration 10 — Lighthouse polish (perf + a11y to 100)

Bring all four Lighthouse mobile categories to ≥95 (target 100), fix the four WCAG AA color-contrast failures, and slot Lighthouse CLI into the workspace so future iterations can verify scores without a manual DevTools run. Also bundles the leftover status-hygiene items from iter-04, iter-07b, and iter-08.

## Baseline (Lighthouse mobile, 2026-05-05)

DevTools Lighthouse 13.0.2, mobile preset, run against `https://wardrobe-assistants.ch/`:

- **Performance:** 93 — FCP 1.8s, LCP 3.0s, TBT 27ms, CLS 0, SI 1.8s
- **Accessibility:** 95 — 4 color-contrast failures
- **Best Practices:** 100
- **SEO:** 100

The baseline run was done in the user's actual Chrome with extensions injected (1Password, React DevTools, crxMouse, Tag Assistant). The "unused JS 277 KiB" finding is mostly extension code and is **not** a real first-party regression. First-party unused JS is ~14 KiB of ES2022 polyfills in the Next.js bundle.

## Context — why this iteration is small but worth shipping

After iter-9 the site is live and the runtime story is settled. The remaining gaps are quality-of-experience: a slow LCP because the hero background image isn't preload-discoverable, four contrast failures from the Bordeaux primary being too dim against the dark theme, and a missing tooling step (no scripted way to re-run Lighthouse) that will keep biting if left.

Once these land, the 100/100/100/100 scoreboard is a useful invariant going forward — any regression is a single CI signal away.

## Scope — Lighthouse CLI in the workspace [3]

- [x] Add `lighthouse` as a dev dependency on the root `package.json` (added `^13.2.0` during planning).
  - Pinned major to avoid silent throttling-model changes.
- [x] Add a root script `npm run lighthouse:homepage` and `npm run lighthouse:services` that hits the live URL by default (override with `LH_TARGET=local` to boot a static preview of `apps/homepage/out/`). Use `lighthouse --preset=desktop --output=json --output=html --chrome-flags="--headless=new"`.
  - Default target: live URL (`https://wardrobe-assistants.ch/` and `https://wardrobe-assistants.ch/services/`).
  - Output to `kb/perf-reports/<page>-<timestamp>.{json,html}` (gitignored).
  - Implemented as `scripts/lighthouse.mjs` thin wrapper around the local `lighthouse` CLI.
- [x] Add `kb/perf-reports/` to `.gitignore` (with `cross-browser-notes.md` un-ignored so the overview stays committed).
- [x] Document the script in `README.md` under a new "Performance auditing" subsection (covers both Lighthouse + ff-rdp).

## Scope — cross-check with ff-rdp in Firefox [3]

For fun and as a sanity-check on Lighthouse's Chromium-only numbers, run the same pages through `ff-rdp perf` (Firefox Remote Debugging Protocol CLI). Two browsers, two measurements: divergence between them is interesting signal even when both pass.

`ff-rdp perf` exposes four subcommands relevant here:
- `ff-rdp perf vitals` — LCP, CLS, TBT, FCP, TTFB summary
- `ff-rdp perf audit` — full audit: vitals + navigation timing + resource breakdown + DOM stats
- `ff-rdp perf compare <urls...>` — navigate each URL in turn, collect vitals + timing side-by-side
- `ff-rdp perf summary` — request counts, sizes, slowest resources, domain breakdown

- [ ] Launch Firefox with remote debugging (`ff-rdp launch` per the CLI), navigate to `https://wardrobe-assistants.ch/`, capture `ff-rdp perf audit > kb/perf-reports/firefox-homepage-<timestamp>.json`.
- [ ] Repeat for `/services`.
- [ ] Run `ff-rdp perf compare https://wardrobe-assistants.ch/ https://wardrobe-assistants.ch/services/` for a single side-by-side report.
- [ ] Compare ff-rdp's LCP/FCP/TTFB against the Lighthouse numbers. Note any meaningful divergence (>20%) in `kb/perf-reports/cross-browser-notes.md` — these are the "Firefox-only" issues that wouldn't surface in CI.
- [ ] Per `AGENTS.md`, collect any ff-rdp feedback (bugs, surprising behavior, missing features) into the kb knowledgebase as a `tool-report` document, mirroring the `hoppy-usage-report.md` precedent.

## Scope — fix color-contrast failures [4]

## Scope — fix color-contrast failures [5]

All four failures involve the Bordeaux primary `#b5564f`. The design tokens live in the `.pen` file (source of truth per project memory) and in the Tailwind v4 `@theme` block. Touch the .pen first, snapshot, then propagate to CSS.

- [x] **Pill labels** — added `--primary-on-dark: #d97468` token; `EyebrowBadge` now reads it.
- [x] **CTA buttons** — `--primary-foreground` switched from `#edeae4` to `#ffffff` (ratio 4.55 against `#b5564f`).
- [x] **Inline link** — "See full services →" on the homepage now uses `text-[var(--primary-on-dark)]`. Same swap applied to the impressum `<dt>` labels, services-page example label, and the datenschutz hover-link color so the same pattern is consistent across the site.
- [x] **Footer copyright** — hardcoded `#6E6962` lifted to `#9B958D` in `Footer.tsx`.
- [ ] Run Lighthouse mobile against `/` and `/services`. Expected: 0 axe `color-contrast` failures, accessibility score 100. **(Manual — needs live deploy + `npm run lighthouse:*`.)**
- [ ] Cross-check with `ff-rdp a11y` on both pages. **(Manual.)**

## Scope — fix LCP (target <2.5s) [2]

The LCP element is the full-page background `<div>` with CSS `bg-[url('/background.webp')]`. Lighthouse insight `lcp-discovery-insight` reports `priorityHinted=false`, `requestDiscoverable=false`, and a **1921ms resource load delay** because the browser only finds the URL after CSS parses.

- [x] Added `<link rel="preload" as="image" href="/background.webp" fetchPriority="high">` to the root layout `<head>` (`apps/homepage/src/app/layout.tsx`) — covers `/`, `/services`, `/impressum`, `/datenschutz` because they all share the root layout.
- [x] Appended `&display=swap` to the bunny.net fonts CSS URL in the same layout file.
- [ ] Re-run Lighthouse against the live URL post-deploy. Expected: LCP <2.5s, performance score ≥95. **(Manual.)**
- [ ] Re-run `ff-rdp perf vitals` on `/`. Expected: Firefox LCP also <2.5s. **(Manual.)**

## Scope — verify and flip stale iteration statuses [3]

- [x] **iter-08** (rename marketing → homepage) — flipped to `status: done`.
- [ ] **iter-04** (services page) — still `status: implemented`. Lighthouse SEO ≥95 and Rich Results Test pass needed before flipping. Both require live runs against the deployed origin (manual, post-merge).
- [ ] **iter-07b** (admin app) — still `status: implemented`. Full `email → password → TOTP → /dashboard` cycle and the `robots.txt` re-check are manual against the deployed admin origin (post-merge).

## Out of scope

- **Legacy JavaScript polyfills (14 KiB)** — `Array.prototype.at`, `flat`, `flatMap`, `Object.fromEntries`, `Object.hasOwn`, `String.prototype.trim{End,Start}`. Caused by Next.js bundler's default `browserslist`. Fixing requires bumping the workspace's browserslist to "last 2 versions, not dead, > 0.5%" or similar, which is a wider compatibility decision. Defer to a separate iteration.
- **Security headers** — CSP, HSTS, COOP, X-Frame-Options, Trusted Types. All flagged "informative" by Lighthouse (don't affect Best Practices score) but missing. Bunny.net Pull Zone Edge Rules can inject them — separate iteration with its own runbook entries because it's pure infra config.
- **Multilingual** — DE/FR translations. Tracked in iter-05 (`status: deferred`). Lighthouse score is not a function of language coverage, so it's not blocking here.
- **Re-design of the Bordeaux primary** — the goal is to keep the brand color and adjust where it's used as text. No `--primary` token gets a new value; only the contexts where it serves as a foreground on dark backgrounds switch to a derivative token.

## Critical files

- `wardrobe-assistants.pen` — design tokens for primary/foreground/footer-muted (source of truth)
- `apps/homepage/app/globals.css` — Tailwind v4 `@theme` color definitions
- `apps/homepage/app/layout.tsx` — `<head>` for preload + fonts URL
- `apps/homepage/app/services/...` — share the same layout (verify preload propagates)
- `package.json` (root) — `lighthouse` devDep (added) + new `lighthouse:*` scripts
- `.gitignore` — exclude `kb/perf-reports/`
- `README.md` — Performance auditing subsection (Lighthouse + ff-rdp)
- `kb/perf-reports/cross-browser-notes.md` — Chromium-vs-Firefox divergence notes (new, gitignored siblings; this single overview file is committed)
- `kb/ff-rdp-usage-report.md` — feedback per AGENTS.md (new, only created if there's something to report)
- `kb/iteration-04-services-page.md`, `kb/iteration-07b-admin-app.md`, `kb/iteration-08-rename-marketing-to-homepage.md` — `status` field flips

## Done when

- `npm run lighthouse:homepage` and `npm run lighthouse:services` both produce JSON with **Performance ≥95, Accessibility 100, Best Practices 100, SEO 100**.
- LCP for `/` is <2.5s on the mobile preset.
- `axe-core` color-contrast audit (via Lighthouse) reports **zero failing items** on `/` and `/services`.
- `ff-rdp perf vitals` against `/` and `/services` returns LCP <2.5s in Firefox.
- `ff-rdp a11y` reports no contrast violations on either page.
- `kb/perf-reports/cross-browser-notes.md` exists and notes any Chromium-vs-Firefox divergences (or explicitly says "no significant divergence").
- iter-04, iter-07b, iter-08 all `status: done` (with the verification artifacts cited in their respective scope items).
- README documents the new Lighthouse + ff-rdp performance auditing flow.
- PR review addressed; squash-merged into `main`; bunny.net redeploy of homepage shows the new scores live (re-run from DevTools to confirm parity with CLI).
