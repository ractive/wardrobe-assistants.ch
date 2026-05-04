---
title: Iteration 8 — Rename "marketing" to "homepage" everywhere
type: iteration
status: in_progress
order: 9
---

# Iteration 8 — Rename "marketing" to "homepage" everywhere

A small mechanical refactor to bring code naming in line with the preferred terminology: the public-facing landing site is the **homepage**, not "marketing". This was raised mid-way through iter-7b but deliberately deferred to a standalone PR to avoid merge conflicts with iter-7b in flight.

Pure rename — zero behavior change, zero new dependencies, zero infra moves. The bunny.net Storage Zone and Pull Zone for the homepage will be provisioned in a later iteration; resource names should already use "homepage" by the time that happens, which this iteration ensures.

## Context — why this matters now

- **Vocabulary mismatch is friction.** Every future iteration that touches deploy/CI/infra will read `apps/marketing` in code while the user (and any future operator notes) say "homepage". Mechanical drag on every conversation.
- **Cheaper now than later.** Today the term lives in 11 tracked files, ~50–60 textual hits, one workspace directory. Each future iteration that adds homepage-specific code grows that count.
- **Pre-requisite for clean infra naming.** The next iteration that re-provisions the bunny.net Storage Zone + Pull Zone (rolled back during the iter-7a side-quest on 2026-05-05) should land with consistent `homepage` naming on both sides of the deploy boundary.

## Scope — directory + workspace [3/3]

- [x] `git mv apps/marketing apps/homepage`
- [x] `apps/homepage/package.json`: rename the package `name` field from `marketing` (or whatever it is) to `homepage`. Keep the version, scripts, and dependencies identical.
- [x] `npm install` at repo root to regenerate `package-lock.json` with the new workspace name; commit the regenerated lockfile.

## Scope — config files [4/4]

- [x] `vitest.config.ts` (root): update the workspace project entry — name and `root` path — to point at `apps/homepage`.
- [x] Root `package.json`: update any script that references `apps/marketing` (e.g. `npm -w apps/marketing ...`). Workspace glob `apps/*` does not need editing.
- [x] `.gitignore`: replace `apps/marketing/out/` → `apps/homepage/out/`.
- [x] `apps/homepage/next.config.ts`, `apps/homepage/tsconfig.json`, `apps/homepage/postcss.config.mjs`: scan for any hard-coded `marketing` strings (likely none, but verify).

## Scope — CI workflow [3/3]

- [x] `.github/workflows/deploy.yml`: rename the `build-marketing` job → `build-homepage`. Update every `npm -w apps/marketing` → `npm -w apps/homepage`, every `apps/marketing/**` path filter, every cache key.
- [x] Update `paths-ignore` / `paths` filters to reflect the new directory. Confirm md/pen-only changes still skip the deploy job.
- [x] Confirm GitHub repo secrets unchanged — `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_PULL_ZONE_ID`, `BUNNY_API_KEY` are name-stable across the rename. Their *values* will be set when bunny infra is provisioned in a later iteration; not in scope here.

## Scope — docs [2/2]

- [x] `README.md`: replace `marketing` references with `homepage` (6 hits expected). Keep historical/external links intact.
- [x] `kb/no-tracking-note.md`: replace `marketing` references (2 hits expected).

## Out of scope

- **Frozen historical iteration plans** — `kb/iteration-06-legal-compliance.md`, `kb/iteration-07a-workspace-foundation.md`, `kb/iteration-07b-admin-app.md`. These are point-in-time records of what was planned at that moment; rewriting them rewrites history. Leave them alone.
- **Bunny.net resource provisioning** — Storage Zone, Pull Zone, hostname binding, DNS swap, TLS. Deferred to a separate iteration that will lean on `kb/hoppy-bug-report-pullzone-storagezone.md`'s curl workaround for the Pull-Zone-↔-Storage-Zone binding gap.
- **`apps/admin/` rename** — admin is already named correctly; nothing to do.
- **Backwards-compat shims** — no temporary symlinks, no re-exports, no deprecation warnings. The rename is clean and atomic.

## Critical files

- `apps/homepage/` (was `apps/marketing/`)
- `apps/homepage/package.json` — workspace `name` field
- `vitest.config.ts` — workspace project root
- `package.json` (root) — scripts referencing the workspace
- `.github/workflows/deploy.yml` — `build-homepage` job, paths, cache keys
- `package-lock.json` — regenerated
- `.gitignore`, `README.md`, `kb/no-tracking-note.md` — text references

## Done when

- `apps/homepage/` exists; `apps/marketing/` does not.
- `npm ci && npm run typecheck && npm run test` passes locally and in CI.
- `npm -w apps/homepage run build` produces `apps/homepage/out/` with the same files as the previous `apps/marketing/out/` build.
- `git grep -i marketing` returns hits only in the three frozen iteration plans (`iteration-06`, `iteration-07a`, `iteration-07b`) and in this file itself (`iteration-08-rename-marketing-to-homepage.md`, where the term is unavoidable as the subject of the rename) — and nowhere else.
- The `verify` and `build-homepage` jobs both run green on the PR.
- PR review addressed; squash-merged into `main`.
