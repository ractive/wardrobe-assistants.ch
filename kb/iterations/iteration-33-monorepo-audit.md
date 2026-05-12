---
title: Iteration 33 — Monorepo audit + obvious cleanups
type: iteration
order: 34
status: done
---

# Iteration 33 — Monorepo audit + obvious cleanups

A wide, mostly-read-only pass across the whole repo: homepage, admin, packages, design system, shadcn usage, dependency health. Produces a structured audit report (`kb/audits/iter-33-monorepo-audit.md`) plus *only the obvious, low-risk cleanups* committed inline. Judgment-call items — version bumps, architectural shifts, opinionated refactors — are written up as findings with severity and a disposition, not actioned. After this iteration the user reviews the report and decides what becomes iter-34, iter-35, etc.

**Autonomy boundary** (critical):
- **Fix inline** anything that is unambiguously wrong: dead files, unused imports, typos in user-visible copy, lint warnings already in the codebase, deprecated APIs that have a 1:1 modern replacement, missing `await` on async calls.
- **Report, don't fix**: anything that touches public API shapes, dependency majors, the build pipeline, the design system, or "this could be done differently". Even if you're sure — the user wants the discussion to happen before the change.
- **When in doubt, report.** The whole point of this iteration is to surface the landscape, not to disrupt it.

The Next.js 16 caveat from `CLAUDE.md` applies: read `node_modules/next/dist/docs/` before claiming any Next.js best practice. Do **not** quote training-data Next.js knowledge — it's likely out of date for v16.

## Decisions

- **Output is one report file**, not many. `kb/audits/iter-33-monorepo-audit.md` follows the existing `kb/audits/findings-index.md` pattern: each finding has `ID, area, severity, disposition, evidence, recommendation`.
- **Inline fixes are small commits, each with a one-line message** so the user can revert any individually. Group only when fixes are mechanically identical (e.g. "drop unused imports across 12 files").
- **No major version bumps.** Bumping TypeScript / React / Next.js / Biome / Vitest is reported with a per-package risk note, not executed. Minor and patch bumps within the existing major *may* be applied if `npm run verify` stays green — but only one package at a time per commit, and only after a quick changelog skim.
- **No design-system rewrite.** That's iter-32 §7. This iteration cross-checks the design system against actual code usage and flags drift, but doesn't edit `design-system.md` directly.
- **No shadcn registry changes.** Don't `npx shadcn@latest add` anything. Don't update existing primitives. The MCP server is for *discovery only* in this iteration.
- **Test surface stays green.** Every inline fix is followed by `npm run verify`. If anything turns red, revert that fix and convert it to a finding.
- **The report is the deliverable**, not the diff. A clean run could be "0 inline fixes, 40 findings" and still be a successful iteration.
- **Any browser-side audit step uses ff-rdp.** Per `CLAUDE.md`: the Lighthouse smoke in §6, any visual inspection during the homepage / admin audit, and the React-DevTools / Network tab work all go through `ff-rdp` (not the chrome MCP server). Append a dogfooding session report at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md` covering what worked, bugs, quirks, improvement ideas. iter-33 will exercise ff-rdp more heavily than any prior iteration — make the session report substantive.

## Pre-flight

- [x] iter-30, iter-31, iter-32 merged on `main` and deployed.
- [x] `npm run verify` green on `main`.
- [x] `npm run verify:tf` green on `main` (if TF changed in iter-30..32).
- [x] No uncommitted changes anywhere.
- [x] Local docs are present under `node_modules/next/dist/docs/` — if absent, run `npm ci` first.

## Scope

Each section produces findings into the report. Inline fixes happen only when the autonomy boundary above permits.

### 1. Next.js 16 audit

Read `node_modules/next/dist/docs/` first. Then audit `apps/admin/` and `apps/homepage/` against the current Next.js 16 idioms:

- **App Router usage** — every route should be `app/`, no `pages/`. Verify.
- **Server Components by default** — flag `"use client"` directives that exist on files containing no client-side hooks/state/handlers.
- **Server Actions** — verify the `"use server"` boundary discipline; flag actions that import non-action-safe modules.
- **Streaming / Suspense** — look for `loading.tsx` files and `<Suspense>` boundaries; flag pages that fetch data sequentially when they could parallelise.
- **Caching directives** — audit every `fetch(...)`, `cache: "no-store"`, `force-dynamic`, `revalidate`, `unstable_cache`. Cross-check against the docs in `node_modules/next/dist/docs/` because v16 changed defaults (compared to v14/15 training-data knowledge).
- **`proxy.ts`** (the renamed middleware.ts) — verify the iter-26+iter-30 fixes from this sprint are consistent with the v16 docs' guidance on middleware semantics.
- **`next.config.ts`** — flag deprecated options; verify the React Compiler is enabled if v16 supports it.
- **Metadata API** — verify dynamic metadata uses `generateMetadata`, static uses `export const metadata`. No mixed patterns.
- **Image / Font / Script** — verify `next/image`, `next/font`, `next/script` usage matches v16 docs.
- **PWA / Manifest** — verify `app/manifest.ts` is correctly typed and the iter-23 web-push setup hasn't drifted from v16 norms.

### 2. React 19 + React Compiler audit

- **React Compiler** — verify it's enabled in `next.config.ts` (Next.js 16 supports it). If not enabled, flag as a finding with a recommendation (do not enable it inline; that's a judgment call).
- **`useMemo` / `useCallback`** — with the Compiler enabled, manual memoisation is redundant. Flag every usage; recommend removal in a follow-up iteration. *Do not remove them inline* — even with the Compiler, some are intentional for downstream identity checks.
- **`forwardRef`** — React 19 deprecates `forwardRef` (refs are passed as props). Flag every usage. **Inline-fix candidate** for trivial cases (a `forwardRef` with no logic beyond `ref` forwarding) — convert and re-verify.
- **New hooks** — find candidates for `useActionState`, `useFormStatus`, `useOptimistic` (esp. in forms; admin's `useFormAction` hook may now be redundant). Flag, don't refactor.
- **`"use client"` discipline** — every client component should genuinely need browser APIs / hooks / event handlers. Flag stragglers.
- **Suspense boundaries** — list pages that fetch in a single `await` chain and could parallelise via `Promise.all` or `<Suspense>` siblings.
- **Error boundaries** — flag pages without `error.tsx` files that handle async errors.

### 3. TypeScript audit

- **`tsconfig.json`s** — both `apps/admin/tsconfig.json` and `apps/homepage/tsconfig.json` and `packages/db/tsconfig.json`. Verify:
  - `strict: true`
  - `noUncheckedIndexedAccess: true`
  - `verbatimModuleSyntax: true`
  - `moduleResolution: "bundler"` or equivalent for the runtime
  - Consistent `target`, `lib`, `jsx`
  - Path aliases match `components.json` (admin) and the actual import shapes
- **TypeScript version** — currently `^5.9.3`. Check if 5.10/5.11 is out; flag the upgrade with changelog notes.
- **`any` / `unknown` / `as` casts** — count and locate. Each is a potential type-safety hole. Flag the top 20 by impact (server actions, public API boundaries, schema parsers).
- **`@ts-expect-error` / `@ts-ignore`** — every one should have a comment explaining the workaround. Flag bare ones.
- **Unused exports** — run `tsc --noUnusedLocals` (already on?) and a Biome unused-symbol pass. List of dead exports.
- **Zod usage** — verify every server action and every public-API route uses zod-validated input; flag any unvalidated boundary.
- **Discriminated unions** — flag any function returning `{ error: true, message } | { error: false, data }` that doesn't use a proper discriminated union pattern.

### 4. Dependency audit

Run `npm outdated --workspaces` (or the equivalent for our setup). For each non-current dep:

| Field | What to capture |
|---|---|
| Package | name |
| Current | currently installed major.minor.patch |
| Wanted | latest within current major |
| Latest | latest overall |
| Major bump? | yes/no — if yes, severity + risk |
| Used by | which workspaces import it |

**Per major-version bump candidate**, write a short risk note:
- Is the breaking-change list small or large? Skim the changelog.
- Does any of our code touch the changed surface area?
- Estimate effort: trivial / hours / days.

**Inline fixes** for patch and minor bumps **only**: one commit per package, run `npm run verify` between. Stop at the first failure and revert that bump; convert to a finding.

**Specific majors to assess** (the user named these):
- **TypeScript** — currently `^5.9.3`. Any 5.x → 5.y is in scope; 6.0 (if released) is a major.
- **Biome** — `^2.4.14`. Bump policy + changelog.
- **Vitest** — `^4.1.5`. Bump policy.
- **Next.js / React** — already on the latest majors (16.2.6 / 19.2.6) per `package.json`. Verify nothing newer is out.
- **drizzle-orm**, **@libsql/client** — DB layer. Major bump risk: data layer drift.
- **better-auth** — auth. Major bump risk: session-token incompat.
- **react-email** + components — email rendering. Major bump risk: template re-snapshot.
- **next-themes** — currently `^0.4.6`. Any major bump impacts the CSP nonce wiring (commit 042ac76).
- **react-hook-form** + **@hookform/resolvers** — landing in iter-31. If iter-31 is already merged, ensure the new dep is at latest stable.
- **lucide-react** — icons. Low risk in bumps; flag if a hundred icons got renamed.

### 5. Shadcn usage audit (cross-check iter-32 design-system rewrite)

iter-32 rewrites `design-system.md`. This iteration verifies *the code matches the new doc*:

- Every component in `apps/admin/src/components/ui/` is referenced in the design-system "Blocks adopted" / primitive list. List unreferenced ones.
- Hardcoded colour literals (`#...`, `bg-zinc-*`, `text-neutral-*`, etc.) under `apps/admin/src/` outside `components/ui/` and the audited state-banner allowlist.
- `cn()` usage — any places passing dynamic class strings via template literals instead of the `cn()` helper.
- shadcn `components.json` consistency with actual file layout.
- Use the **shadcn MCP server** (`mcp__shadcn__*`) to verify primitives are at registry-latest; flag drift but don't update.

### 6. Homepage audit

- Static-export discipline — `apps/homepage` should produce a fully static bundle. Flag any accidental SSR or server action.
- `/booking-request` build-time fetch (iter-26 + iter-31) — verify the fallback path is graceful and the success path is exercised by a test.
- SEO metadata coverage — every public page has `generateMetadata` or static `metadata` with title + description + canonical + OG tags.
- Sitemap + robots — verify they list every public route.
- Lighthouse smoke — run against `https://wardrobe-assistants.ch` if reachable; record Performance / Accessibility / SEO / Best Practices scores in the report. Don't act on findings; just capture the baseline.

### 7. Admin app audit

- **Feature-slice isolation** — Biome `noRestrictedImports` overrides per feature (per `CLAUDE.md`). Verify each feature folder has the override block in `biome.json`. Flag missing ones.
- **Permission catalog** — every `withPermission(...)` use in server actions is granted to at least one role. Reverse-check: every permission key in the catalog is used somewhere.
- **Audit log writes** — every state-transition server action calls `recordAudit` after the tx commits. Flag any inline `tx.insert(auditLog)`.
- **Conditional UPDATE patterns** — verify every status transition uses the `WHERE id = ? AND status = ?` + `.returning(...)` pattern (the iter-27/iter-28 carry-over rule). Flag bare updates.
- **Rate-limit keys** — verify every public-API route includes the IP **and** a stable token/identifier in its rate-limit bucket key.
- **Email-template params** — verify no unused fields (iter-28 PR-review pattern).
- **`vitest-axe`** — every interactive component has a smoke. List bare ones.

### 8. Knowledgebase coherence

- **Iteration plan statuses** — every `kb/iterations/iteration-*.md` whose work is merged on `main` has `status: done`; everything else is `planned` or `deferred`. Sweep.
- **`kb/audits/findings-index.md`** — every finding referenced as "deferred to iter-X" links to an iteration that exists. Cross-check.
- **CLAUDE.md / AGENTS.md drift** — list any rule in those files that no longer matches the code.
- **`kb/admin-architecture/decision-log.md`** — every "Why X" in a code comment references a decision-log entry that exists, and vice versa for ADRs that the code now contradicts.

### 9. Dead code sweep

- **Unused files** — anything not transitively reachable from an entry point (page, API route, server action, test, story).
- **Unused exports** — anything exported but never imported elsewhere.
- **Unused dependencies** — `npm` reports + manual cross-check (some deps are runtime-only like `web-push`).
- **TODOs older than 60 days** — git-blame each TODO; flag stale ones for triage.

**Inline-fix candidates**: file deletions when:
- The file is not in any `tsconfig.json` `include` path, OR
- The file is referenced only from itself (e.g. an old `__tests__/foo.test.tsx` that doesn't run because it was renamed/moved).

When in doubt, list and don't delete.

### 10. Output: write the report

`kb/audits/iter-33-monorepo-audit.md`:

```
---
title: iter-33 monorepo audit
type: audit
status: current
---

# iter-33 monorepo audit (YYYY-MM-DD)

## Summary
- N findings (B blockers, C coherence, N nice-to-have)
- M inline fixes applied (commits SHA-list)
- K major-version bumps queued (see §4)

## Findings

### A-NEXT-01 — <title>
Area: Next.js 16
Severity: blocker / coherence / nice-to-have
Disposition: inline-fixed (sha) / queued / no-action
Evidence: <file:line>
Recommendation: <one-paragraph>

### A-NEXT-02 — …
…
```

Finding ID prefix per area:
- `A-NEXT-*` — Next.js 16
- `A-REACT-*` — React 19 / Compiler
- `A-TS-*` — TypeScript
- `A-DEPS-*` — Dependencies
- `A-SHADCN-*` — shadcn usage
- `A-HOME-*` — Homepage
- `A-ADMIN-*` — Admin app
- `A-KB-*` — Knowledgebase
- `A-DEAD-*` — Dead code

End with a **"Recommended next iterations"** section: 3-5 candidate iteration titles ordered by impact, each one paragraph, so the user can pick one for iter-34.

## Out of scope

- Any change that requires user judgment (architecture, dep majors, UX shifts). Those become findings, not edits.
- Performance optimisation. List opportunities; don't optimise.
- Test coverage expansion. List gaps; don't write new tests.
- Documentation writing beyond the report file.
- Refactors that touch ≥ 3 files. Flag, don't do.
- Anything customer-visible (homepage copy, email templates) unless it's a clearly broken typo.
- `npm audit` security findings → handled by the existing Dependabot workflow; don't duplicate.

## Done when

- [x] `kb/audits/iter-33-monorepo-audit.md` exists with sections per §§1-9 and the summary header from §10.
- [x] Every finding has `area, severity, disposition, evidence, recommendation`. (A-DEPS-02 cross-references A-TS-08 instead of duplicating fields.)
- [x] Inline fixes are each in their own commit with a one-line message; `npm run verify` is green at HEAD.
- [x] No major-version bumps committed.
- [x] Minor / patch bumps committed are listed in the report with their changelog skim.
- [x] "Recommended next iterations" section at the bottom of the report names 3-5 candidates.
- [x] `npm run format` clean; `npm run verify` green; `npm run verify:tf` green (if any TF changed).

## Heads-up for follow-ups

1. **The user wants to discuss the report before iter-34 is chosen.** Don't pre-queue any of the recommendations as auto-launched iterations.
2. **Major-version bumps are explicitly user-decisions.** Even if every test passes after a TypeScript 5.x→6.0 attempt, don't commit. Write up the risk and propose it.
3. **The audit may surface design-system drift between code and `design-system.md` after iter-32.** If iter-32 hasn't merged yet, defer the cross-check; if it has, treat any drift as a finding (probably nice-to-have, since iter-32 itself just rewrote the doc).
4. **Lighthouse baseline scores** captured in §6 should be checked into the report verbatim. A future iteration can use them as a regression baseline.
