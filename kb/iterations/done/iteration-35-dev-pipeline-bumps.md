---
title: Iteration 35 — Major dev-pipeline bumps (TS6, Vite8, GH Actions)
type: iteration
order: 36
status: done
---

# Iteration 35 — Major dev-pipeline bumps (TS6, Vite8, GH Actions)

Clear the Dependabot backlog of major-version bumps that the iter-33 audit explicitly deferred and the GitHub Actions bumps that have been pending since 2026-05-09. All changes are **dev / CI tooling only** — zero production blast radius. Customer-facing surfaces (Next.js runtime, React, Drizzle, Better Auth) are untouched.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. Either the iteration lands all three blocks green or it lands the green subset and reports the blocked ones as findings — partial success is allowed.

## Decisions

- **One iteration, three blocks, one commit per bump.** Each block is independently revertible; if any bump breaks `npm run verify` or CI, that bump is reverted and reported as a finding while the rest of the iteration proceeds.
- **Drop the open Dependabot PRs in favour of a fresh branch.** PRs #45 (TS 6), #46 (Vite 8), #47 (plugin-react 6), #36-#41 (GH Actions) are superseded by this iteration's branch — close them with a "superseded by iter-35" comment after the merge lands. Rationale: nine separate PR merges is more review surface than one bundled iteration with per-bump commits, and the audit recommended these bumps land together because they share a verify cycle.
- **TypeScript 6 risk = medium.** Audit A-TS-08 flagged Drizzle, Better Auth, and react-hook-form as TS-internal-sensitive. Run `npm run verify` after the bump; if anything turns red, capture the diagnostic, revert, and queue as a separate finding rather than fighting through fix-ups in the same iteration.
- **Vite 8 + `@vitejs/plugin-react` 6 are one commit, not two.** They're a locked pair — plugin-react 6 requires Vite 8. Production builds use Next.js's bundler, not Vite, so blast radius is the test pipeline only (`vitest` + `@vitejs/plugin-react` for the React test environment).
- **GH Actions bumps run as 6 small commits**, ordered by risk (low → higher). `upload-artifact` 4→7 crosses a major boundary with known API differences in artifact paths; do it last so earlier bumps prove the workflow harness still works.
- **CI dry-run via `act` is out of scope.** Trust GitHub's runner to surface issues on the iteration's PR; that's faster than maintaining local-runner parity.
- **No production deployment is triggered by this iteration.** Verify the PR's CI suite is green, merge, then a normal release cadence picks up. The deploy workflow itself is touched (docker/build-push-action, bunnycdn-storage-deploy, upload-artifact) so the *next* deploy validates the workflow changes.
- **No smoke needed.** All changes are mechanical; existing tests + CI workflow are the gate.

## Pre-flight

- [x] iter-34 merged on `main` (commit `3d3ddac`).
- [x] `npm run verify` green on `main` at HEAD.
- [x] No in-flight branches touching `package.json`, `tsconfig*.json`, or `.github/workflows/`.
- [x] Confirm none of the open Dependabot branches have manual fix-up commits worth preserving (skim PR diffs first — they should be vanilla version bumps).

## Scope

### Block A — TypeScript 6 (closes A-TS-08 / A-DEPS-02)

Single commit: bump root `typescript` devDependency from `^5.9.3` to `^6.0.3`.

- **Skim TS 6 release notes** for: `--module preserve` default tweaks, `--out` deprecation, stricter `noImplicitOverride`, any narrowing-rule changes.
- Run `npm install` to refresh the lockfile.
- Run `npm run verify` (lint + typecheck + test). If green: commit as `chore(deps): bump typescript 5.9.3 -> 6.0.3 (iter-35 §A)`.
- **If red:** capture first 50 lines of diagnostic, revert (`git checkout HEAD -- package.json package-lock.json`), and record a finding in this plan's §"Findings" block (created during execution). Move on to Block B.
- Close GitHub PR #45 with comment: "Superseded by iter-35".

### Block B — Vite 8 + `@vitejs/plugin-react` 6 (closes A-DEPS-03)

Single commit: bump both together in root `devDependencies`.

- `vite` `^7.3.3` → `^8.0.12`.
- `@vitejs/plugin-react` `^5.2.0` → `^6.0.1`.
- Run `npm install` + `npm run verify`. Vitest is the primary surface; React-component tests use plugin-react.
- **If red:** revert and record finding (likely cause: plugin-react 6 changed Babel preset wire-up or peer-dep shape).
- Close GitHub PRs #46 + #47 with "Superseded by iter-35".

### Block C — GitHub Actions bumps (closes A-CI-* implicitly)

Six commits, in risk order (low → high). Each commit edits one or more workflow files; run a focused `awk '/uses:/' .github/workflows/*.yml` after every commit to confirm the bump landed everywhere it should.

Inventory at HEAD (from `awk '/uses:/' .github/workflows/*.yml | sort -u`):

| Current | Target | Files | Risk |
|---|---|---|---|
| `dorny/paths-filter@v3` | `@v4` | `deploy.yml` | low |
| `docker/build-push-action@v6` | `@v7` | `deploy.yml` | low (semver-only) |
| `ayeressian/bunnycdn-storage-deploy@v2.2.5` | `@v2.4.5` | `deploy.yml` | low (minor) |
| `actions/setup-node@v4` | `@v6` | `deploy.yml` | low-medium (cache: arg unchanged in v6) |
| `actions/github-script@v7` | `@v9` | `terraform-drift-check.yml`, `terraform-plan.yml` | medium (large API surface) |
| `actions/upload-artifact@v4` | `@v7` | `terraform-plan.yml` | medium-high (artifact path semantics changed across majors) |

Commit shapes:
1. `ci(deps): bump dorny/paths-filter 3 -> 4 (iter-35 §C.1)`
2. `ci(deps): bump docker/build-push-action 6 -> 7 (iter-35 §C.2)`
3. `ci(deps): bump bunnycdn-storage-deploy 2.2.5 -> 2.4.5 (iter-35 §C.3)`
4. `ci(deps): bump actions/setup-node 4 -> 6 (iter-35 §C.4)`
5. `ci(deps): bump actions/github-script 7 -> 9 (iter-35 §C.5)`
6. `ci(deps): bump actions/upload-artifact 4 -> 7 (iter-35 §C.6)`

For each: read the action's release notes for the version delta, edit the pinned tag in the workflow files, push, watch the next CI run on the iteration branch. Any CI failure → revert that commit, record finding, skip to next.

Close GitHub PRs #36-#41 (whichever land cleanly) with "Superseded by iter-35".

## Done when

- [x] Block A applied (TypeScript 6.0.3, verify green).
- [x] Block B applied (Vite 8 + plugin-react 6, verify green).
- [x] Block C: all 6 sub-bumps applied (paths-filter, build-push-action, bunnycdn-storage-deploy, setup-node, github-script, upload-artifact).
- [x] `npm run verify` green on the iteration branch HEAD.
- [x] Iteration-branch CI run is green (validated on the PR; see PR checks).
- [ ] Open Dependabot PRs #36-#41, #45-#47 closed with "Superseded by iter-35" comments. (Post-merge follow-up.)
- [x] No blocks failed; no §"Findings" section needed.

## Heads-up

- **Not in scope:** runtime dependency majors (React, Next.js, Drizzle, Better Auth, shadcn primitives, lucide-react, react-day-picker). All currently on latest within their major per iter-33 §A-DEPS-04 / §A-DEPS-05.
- **`@vitejs/plugin-react` is not used by Next.js builds.** It only powers the Vitest React test environment. If Vitest tests stay green, this bump is a no-op for production.
- **`actions/upload-artifact@v7` upgrade path:** v4 → v7 went through multiple major versions; the GitHub release notes call out artifact-name uniqueness rules and behaviour around `if-no-files-found`. Skim before bumping — most workflows aren't affected, but verify.
- **`actions/github-script@v9`** moved to Node 20 then Node 22 across majors; confirm `runs-on` and `node-version` interactions in the Terraform workflows still align.
- **Memory follow-ups still pending after iter-35:**
  - ~~`project_kb_restructure_pending` — split `design-system.md` into per-topic wiki pages.~~ **Done in iter-36** — split into `kb/admin-architecture/design-system/*.md` with `README.md` hub.
  - Lighthouse baseline capture (iter-34 §3 deferred per CodeRabbit). Worth doing before any iteration that adds homepage SEO work.
  - `useMemo` / `useCallback` removal sweep (audit A-REACT-02). Needs per-call review, not a mechanical pass.
  - `forwardRef` → ref-as-prop sweep (audit A-REACT-03). Waiting on shadcn registry upstream — re-check periodically.
- **iter-22 invoice flow** still `deferred`; not part of this sequence.
