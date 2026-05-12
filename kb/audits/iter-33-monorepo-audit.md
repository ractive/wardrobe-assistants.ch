---
title: iter-33 monorepo audit
type: audit
status: current
reviewers: [claude-opus-4-7]
created: 2026-05-12
tags: [audit, monorepo, nextjs, react, typescript, dependencies, shadcn, admin, homepage, kb]
related: [../iterations/iteration-33-monorepo-audit.md, findings-index.md]
---

# iter-33 monorepo audit (2026-05-12)

A wide, mostly-read-only sweep across the monorepo: Next.js 16 / React 19 conformance, TypeScript hygiene, dependency health, shadcn + design-system drift, admin-app rules, homepage discipline, KB coherence, dead code. The autonomy boundary kept inline fixes to the obvious low-risk class; everything judgment-flavoured was written up as a finding.

## Summary

- **50 findings** (0 blockers, 9 coherence, 41 nice-to-have).
- **4 inline fixes** committed (one per concern):
  - `fe8f1b6` — normalize iter-15 / iter-25 status frontmatter from `implemented` → `done`.
  - `840b70f` — bump `libphonenumber-js` 1.13.0 → 1.13.1 (patch).
  - `e630bbd` — bump `tailwind-merge` 3.5.0 → 3.6.0 (minor).
  - `9471ac7` — bump `@types/node` 25.6.0 → 25.7.0 and `vitest` 4.1.5 → 4.1.6.
- **3 major-version bumps queued** for user decision (TypeScript 6, Vite 8, `@vitejs/plugin-react` 6). See A-TS-08 and A-DEPS-03.
- **Quality gates green at HEAD**: `npm run verify` → 51 test files / 422 tests passing, 3 Biome infos pre-existing.

The repo is in a healthy state. The most useful follow-ups are stylistic/coherence: error.tsx coverage, `useFormAction` → `useActionState` migration, and a vitest-axe gap closure.

---

## Findings

### Next.js 16 (`A-NEXT-*`)

#### A-NEXT-01 — Pages-router-free
Area: Next.js 16  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: no `pages/` directory under `apps/admin/src/` or `apps/homepage/src/`. Both apps are App-Router-only.

Recommendation: keep it that way; flag in PR review if a `pages/` directory ever lands.

#### A-NEXT-02 — `proxy.ts` matches v16 middleware semantics
Area: Next.js 16  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `apps/admin/src/proxy.ts` (v16's rename of `middleware.ts`) issues per-request CSP nonces. Cross-checked against `node_modules/next/dist/docs/03-architecture/nextjs-compiler.md` and middleware docs; the iter-26 + iter-30 fixes are consistent with v16 guidance.

Recommendation: none.

#### A-NEXT-03 — `reactCompiler: true` enabled in both apps
Area: Next.js 16  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `apps/admin/next.config.ts:57`, `apps/homepage/next.config.ts:52`. `babel-plugin-react-compiler@1.0.0` is in `devDependencies` for both apps.

Recommendation: see A-REACT-02 for downstream implications.

#### A-NEXT-04 — `output: "standalone"` (admin) vs `output: "export"` (homepage) intentional
Area: Next.js 16  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `apps/admin/next.config.ts` uses standalone for containerization; `apps/homepage/next.config.ts:46` uses static `export` (homepage is pure static). No accidental SSR found in homepage.

Recommendation: none.

#### A-NEXT-05 — `loading.tsx` + `<Suspense>` usage minimal but correct
Area: Next.js 16  ·  Severity: nice-to-have  ·  Disposition: queued

Evidence: `loading.tsx` files exist for bookings/users/services. `apps/admin/src/app/set-password/page.tsx:148-152` wraps `useSearchParams` in `<Suspense>`. Dashboard page (`apps/admin/src/app/(dashboard)/page.tsx:135-140`) already parallelises via `Promise.all`. No sequential-await anti-patterns found.

Recommendation: opportunistically add `<Suspense>` siblings if/when slow data fetches accumulate. Not actionable today.

#### A-NEXT-06 — Per-segment `error.tsx` boundaries missing on 10 pages
Area: Next.js 16  ·  Severity: nice-to-have  ·  Disposition: queued

Evidence: only one `error.tsx` exists (`apps/admin/src/app/(dashboard)/error.tsx`). Bare pages: `app/set-password/page.tsx`, `app/login/page.tsx`, `app/(dashboard)/upcoming-bookings/page.tsx`, `app/(dashboard)/bookings/page.tsx`, `app/(dashboard)/users/page.tsx`, `app/(dashboard)/my-bookings/page.tsx`, `app/(dashboard)/services/page.tsx`, `app/(public)/offer/[token]/page.tsx`, `app/(dashboard)/bookings/[id]/page.tsx`, `app/(dashboard)/my-bookings/[bookingId]/page.tsx`.

Recommendation: the `(dashboard)/error.tsx` catches most cases. Per-segment `error.tsx` is a UX polish. Bundle into a small KB-aligned iteration.

#### A-NEXT-07 — `app/manifest.ts` shape correct
Area: Next.js 16  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `apps/admin/src/app/manifest.ts:3-25` exports a typed `MetadataRoute.Manifest`. Hex literals on lines 5-6 (`theme_color`, `background_color`) are unavoidable — PWA manifest spec requires hex.

Recommendation: none.

#### A-NEXT-08 — Metadata API discipline clean
Area: Next.js 16  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: no page mixes `export const metadata` and `generateMetadata` in the same file. Homepage public pages have metadata exports (`datenschutz`, `impressum`, `booking-request`, `services`). Detailed canonical / OG-tag coverage not yet audited — see A-HOME-01.

Recommendation: none for the discipline itself.

### React 19 / React Compiler (`A-REACT-*`)

#### A-REACT-01 — React Compiler is enabled and runtime-active
Area: React 19  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `reactCompiler: true` in both `next.config.ts`; `babel-plugin-react-compiler@1.0.0` resolved in both apps. Cross-checked: `node_modules/next/dist/docs/` confirms the option is the production wire-up in v16.

Recommendation: none.

#### A-REACT-02 — `useMemo` / `useCallback` likely redundant under Compiler
Area: React 19  ·  Severity: nice-to-have  ·  Disposition: queued

Evidence: usages at `apps/admin/src/components/ui/sidebar.tsx:76, 92, 116, 610` and `apps/admin/src/hooks/use-form-action.ts:36`. Most are in shadcn-vendored primitives.

Recommendation: do **not** remove inline — some manual memoisation is intentional for downstream identity (e.g. context values where the Compiler can't always prove stability across re-renders). Convert to an explicit "remove manual memos in feature code, keep in `components/ui/`" pass in a dedicated iteration.

#### A-REACT-03 — `forwardRef` used pervasively in `components/ui/` — trivial in shape
Area: React 19  ·  Severity: nice-to-have  ·  Disposition: queued

Evidence: every shadcn primitive uses `forwardRef` (button, card, input, label, dialog, etc.). Each one simply forwards `ref` + spreads props + applies `cn(className, ...)`. React 19 deprecates `forwardRef` (refs pass as plain props).

Recommendation: this is template code from shadcn; the registry has not yet updated their primitives for React 19's ref-as-prop semantics. **Wait for shadcn registry to publish updated primitives** rather than diverging from upstream. Re-check in iter-34+ if shadcn has caught up.

#### A-REACT-04 — `useActionState` / `useFormStatus` / `useOptimistic` not used
Area: React 19  ·  Severity: coherence  ·  Disposition: queued

Evidence: zero usages in the repo. `apps/admin/src/hooks/use-form-action.ts` is a custom abstraction wrapping `try/catch + router.refresh()` — predates React 19 stable form hooks.

Recommendation: schedule a "modernise form actions" iteration. `useActionState` would replace `useFormAction` for pending/error state with first-class React semantics. Touches ~6 forms (bookings, services, users, invitation, request, set-password). Estimated effort: hours.

#### A-REACT-05 — `"use client"` discipline clean
Area: React 19  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: spot-checked `apps/homepage/src/components/Nav.tsx` (server, CSS-only menu — clean), `apps/admin/src/hooks/use-mobile.ts` (needs client — `useState` + `useEffect`), `apps/admin/src/hooks/use-has-permission.ts` (needs client — `authClient.useSession`). No false-positive `"use client"` directives found in spot-check.

Recommendation: none.

### TypeScript (`A-TS-*`)

#### A-TS-01 — `tsconfig.base.json` is strict and well-configured
Area: TypeScript  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `tsconfig.base.json` has `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, `moduleResolution: "bundler"`. Workspace overrides inherit cleanly: `apps/admin`, `apps/homepage` use `react-jsx` + DOM libs; `packages/db`, `packages/shared` use Node lib config. Path aliases match `apps/admin/components.json`.

Recommendation: none.

#### A-TS-02 — Two `as never` casts in form resolvers
Area: TypeScript  ·  Severity: coherence  ·  Disposition: queued

Evidence: `apps/admin/src/features/bookings/components/BookingForm.tsx:77` and `apps/admin/src/features/services/components/ServiceForm.tsx:47`: `zodResolver(schema) as never`. The cast bridges the RHF generic-resolver type and `react-hook-form@7` resolver overloads.

Recommendation: document intent with a single-line comment ("RHF/Zod resolver generic mismatch — see hookform/resolvers#XXXX") rather than refactoring. A `@hookform/resolvers` major bump may obsolete this.

#### A-TS-03 — Unvalidated `as` cast on JSON response in homepage booking-request page
Area: TypeScript  ·  Severity: coherence  ·  Disposition: queued

Evidence: `apps/homepage/src/app/(site)/booking-request/page.tsx:54` — `(await res.json()) as { services?: ServiceEntry[] }` against a public API response. There's no Zod validation between the fetch and the cast.

Recommendation: introduce a small Zod schema in `packages/shared` and `.safeParse` the response. Touches both the homepage page and the admin route's response shape — schedule as a small slice. Not a blocker because the data is build-time-fetched and a broken response would fail the build.

#### A-TS-04 — Double cast in `use-has-permission.ts`
Area: TypeScript  ·  Severity: nice-to-have  ·  Disposition: queued

Evidence: `apps/admin/src/hooks/use-has-permission.ts:15` — `(session?.user as { role?: string } | undefined)?.role as Role | undefined`. Two consecutive casts.

Recommendation: extract a one-line guard. Trivial, but touches a security-relevant hook; defer to a dedicated PR.

#### A-TS-05 — All `@ts-expect-error` are in generated `.next/types/`
Area: TypeScript  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: 13 occurrences, all under `apps/{admin,homepage}/.next/types/validator.ts` (auto-generated route validators). Zero in source.

Recommendation: none.

#### A-TS-06 — Zod validation coverage on server actions is 100%
Area: TypeScript  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: every server action file in `apps/admin/src/features/*/server/` uses `schema.safeParse(input)`. Verified: `bookings/server/actions.ts` (10 actions), `bookings/server/assignment-actions.ts` (3), `users/server/actions.ts` (3), `services/server/actions.ts` (3), `app/(public)/offer/[token]/actions.ts`. Public API routes (`api/auth/[...all]/route.ts`, `api/public/booking-requests/route.ts`) also validate.

Recommendation: none. Maintain this discipline for new features.

#### A-TS-07 — Discriminated unions on action returns use `error: true | false` consistently
Area: TypeScript  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: every action return type follows `{ error: true; message: string } | { error: false; message?: string }`. `apps/admin/src/features/services/schema.ts` uses `z.discriminatedUnion("error", ...)`.

Recommendation: none.

#### A-TS-08 — TypeScript 6.0.3 available
Area: TypeScript  ·  Severity: coherence  ·  Disposition: queued (user decision)

Evidence: current `^5.9.3`, latest `6.0.3`. Major bump.

Recommendation: skim the 6.0 release notes (notable: `--module preserve` default tweaks, deprecation of `--out`, stricter `noImplicitOverride`). Effort: hours of CI-driven fix-ups; risk medium because Drizzle, Better Auth, react-hook-form all interact with TS internals. Run as a dedicated iteration with a green/red verify gate.

### Dependencies (`A-DEPS-*`)

#### A-DEPS-01 — Patch / minor bumps applied inline
Area: Dependencies  ·  Severity: nice-to-have  ·  Disposition: inline-fixed (commits below)

Evidence: `npm outdated --workspaces` listed:

| Package | Current | Wanted | Latest | Action |
|---|---|---|---|---|
| `libphonenumber-js` | 1.13.0 | 1.13.1 | 1.13.1 | bumped (`840b70f`) |
| `tailwind-merge` | 3.5.0 | 3.6.0 | 3.6.0 | bumped (`e630bbd`) |
| `@types/node` | 25.6.0 | 25.7.0 | 25.7.0 | bumped (`9471ac7`) |
| `vitest` | 4.1.5 | 4.1.6 | 4.1.6 | bumped (`9471ac7`) |

Changelog skim:
- **libphonenumber-js 1.13.1** — metadata refresh only; no API change.
- **tailwind-merge 3.6.0** — adds Tailwind v4.2 class coverage; no breaking change.
- **@types/node 25.7.0** — DT definitions catch-up; types-only.
- **vitest 4.1.6** — bug-fix release; no API change.

`npm run verify` ran green after every bump.

Recommendation: future iter-N+ should keep the same one-bump-per-commit discipline.

#### A-DEPS-02 — TypeScript 6.0.3 major bump queued
Area: Dependencies  ·  Severity: coherence  ·  Disposition: queued (user decision)

See A-TS-08.

#### A-DEPS-03 — Vite 8.0.12 major bump (root devDependency via `@vitejs/plugin-react`)
Area: Dependencies  ·  Severity: nice-to-have  ·  Disposition: queued (user decision)

Evidence: `vite@7.3.3` → `8.0.12`; `@vitejs/plugin-react@5.2.0` → `6.0.1`. Only impacts the Vitest test pipeline (no production build uses Vite).

Recommendation: low blast-radius (tests only). Bump both together in one iteration. Effort: trivial unless plugin-react 6 changed Babel preset wire-up.

#### A-DEPS-04 — Biome `^2.4.14`, Drizzle ORM `^0.45.2`, Better Auth `^1.6.9`, react-day-picker `^10.0.0`, lucide-react `^1.14.0` are current
Area: Dependencies  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: none reported by `npm outdated`. All within latest major.

Recommendation: none.

#### A-DEPS-05 — Next.js 16.2.6 and React 19.2.6 are current
Area: Dependencies  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: confirmed via `package.json` in both apps; nothing newer reported by `npm outdated`.

Recommendation: none.

### shadcn usage (`A-SHADCN-*`)

#### A-SHADCN-01 — Primitive inventory matches the design system
Area: shadcn  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: 22 primitives in `apps/admin/src/components/ui/` (badge, button, calendar, card, checkbox, command, dialog, dropdown-menu, empty, form, input, label, popover, select, separator, sheet, sidebar, skeleton, sonner, table, textarea, tooltip). All match the primitive list in `kb/admin-architecture/design-system/` (audit predates the iter-36 wiki split; primitive inventory is unchanged).

Recommendation: none.

#### A-SHADCN-02 — Hex literals in email templates / manifest are intentional
Area: shadcn  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: hex literals appear in `apps/admin/src/lib/email-templates/*.tsx` (email clients don't grok CSS variables) and `apps/admin/src/app/manifest.ts` (PWA spec requires hex). Both are explicitly allowed per [`design-system/tokens.md`](../admin-architecture/design-system/tokens.md).

Recommendation: none.

#### A-SHADCN-03 — No `cn()` discipline violations found
Area: shadcn  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: 145 `className` occurrences spot-checked under `bookings/components`; no template-literal class strings bypassing `cn()`.

Recommendation: none.

#### A-SHADCN-04 — shadcn MCP registry sync deferred
Area: shadcn  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: per iter-33 scope, the shadcn MCP server is for discovery only; no registry-latest cross-check was run because no primitives appear stale. iter-32 owns the design-system rewrite.

Recommendation: next time a new shadcn primitive is added, use `mcp__shadcn__get_audit_checklist` to verify pin shape.

### Homepage (`A-HOME-*`)

#### A-HOME-01 — Public-page metadata coverage spot-checked; canonical / OG fields not exhaustively audited
Area: Homepage  ·  Severity: nice-to-have  ·  Disposition: queued

Evidence: metadata present on `(site)/datenschutz/page.tsx`, `(site)/impressum/page.tsx`, `(site)/booking-request/page.tsx`, `(site)/services/page.tsx`, and `(site)/page.tsx`. Coverage of `title + description + canonical + og:*` per page was not exhaustively verified in this audit.

Recommendation: run a focused SEO-metadata pass as a one-hour iteration; cheap to do, hard to surface in CI.

#### A-HOME-02 — Static export discipline clean
Area: Homepage  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `apps/homepage/next.config.ts:46` has `output: "export"`, `images.unoptimized: true`. No server actions, no `route.ts` files under `app/`. Build is fully static.

Recommendation: none.

#### A-HOME-03 — `/booking-request` build-time fetch fallback
Area: Homepage  ·  Severity: coherence  ·  Disposition: queued

Evidence: `apps/homepage/src/app/(site)/booking-request/page.tsx:54` fetches services at build time. Fallback path exists (empty services list). Tied to A-TS-03 (unvalidated cast on the same fetch).

Recommendation: address with A-TS-03 in the same slice.

#### A-HOME-04 — sitemap.ts + robots.ts exist
Area: Homepage  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `apps/homepage/src/app/sitemap.ts` and `apps/homepage/src/app/robots.ts` present. Detailed route-completeness check deferred.

Recommendation: include in the SEO pass (A-HOME-01).

#### A-HOME-05 — Lighthouse smoke deferred
Area: Homepage  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `npm run lighthouse:homepage` and `npm run lighthouse:services` exist (`scripts/lighthouse.mjs`). The iter-33 scope called for a baseline capture, but production reachability wasn't verified in this audit run.

Recommendation: capture baseline scores in a dedicated 30-minute follow-up; record them inline here for regression tracking.

### Admin app (`A-ADMIN-*`)

#### A-ADMIN-01 — Biome `noRestrictedImports` per-feature overrides present
Area: Admin  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `biome.json` overrides exist for `apps/admin/src/features/users/**`, `bookings/**`, `services/**`. Matches the three feature folders.

Recommendation: when adding a new feature, copy the override block per `kb/admin-architecture/feature-slice-template.md`.

#### A-ADMIN-02 — `recordAudit` usage clean; no inline `tx.insert(auditLog)`
Area: Admin  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: 34 `recordAudit(...)` calls across features; zero inline `tx.insert(auditLog)`.

Recommendation: none.

#### A-ADMIN-03 — Conditional-UPDATE pattern: verify `.returning()` on every status transition
Area: Admin  ·  Severity: coherence  ·  Disposition: queued

Evidence: grep-level scan saw `.update(bookings).set(...).where(and(...))` patterns in `apps/admin/src/features/bookings/server/actions.ts` and `assignment-actions.ts` without consistently visible `.returning(...)` calls in the same statement. The iter-27 / iter-28 rule requires `WHERE id = ? AND status = ?` + `.returning(...)` for race-safe transitions.

Recommendation: targeted code review of every UPDATE in `features/bookings/server/`. If any are missing `.returning()`, the action can silently lose a race; convert to a small dedicated iteration with a focused diff.

#### A-ADMIN-04 — Permission catalog clean
Area: Admin  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: 28 permissions in `apps/admin/src/lib/permissions.ts`. All granted to ≥1 role (module-load self-check). All used somewhere via `withPermission` / `<HasPermission>` / `useHasPermission`. No `withPermission("x")` references unknown keys.

Recommendation: none.

#### A-ADMIN-05 — vitest-axe coverage gap on 5 interactive components
Area: Admin  ·  Severity: coherence  ·  Disposition: queued

Evidence: 31 vitest-axe assertions present. Missing on `apps/admin/src/components/UserMenu.tsx`, `InstallPrompt.tsx`, `NoPermissionCard.tsx`, `features/bookings/components/IcsDownloadButton.tsx`, and arguably `BookingDetailActions.tsx`. `HasPermission.tsx` is RSC — exempt.

Recommendation: add the 4–5 missing smokes as a one-hour follow-up. Mechanically copy-paste from the existing axe tests.

#### A-ADMIN-06 — Rate-limit keys include IP + stable identifier
Area: Admin  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: `apps/admin/src/app/api/public/booking-requests/route.ts:113-126` buckets: `bookingRequest:ip-hour:${ip}`, `bookingRequest:ip-day:${ip}`, `bookingRequest:email-day:${normalizedEmail}`. Matches ADR-021.

Recommendation: none.

#### A-ADMIN-07 — Email-template props clean
Area: Admin  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: spot-checked `OfferSent`, `AssignmentInvite` templates; props interfaces match rendered fields. No unused props detected.

Recommendation: none.

### Knowledgebase (`A-KB-*`)

#### A-KB-01 — iter-15 / iter-25 status frontmatter normalised (inline-fixed)
Area: Knowledgebase  ·  Severity: coherence  ·  Disposition: inline-fixed (`fe8f1b6`)

Evidence: both files used `status: implemented` (non-canonical); now `status: done`.

Recommendation: done.

#### A-KB-02 — `kb/iterations/done/` organisational drift
Area: Knowledgebase  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: 22 done iterations live in `kb/iterations/`; older ones (iter-01..04, 06, 07a–b, 08–13, 20–21) live in `kb/iterations/done/`. Purely organisational; cross-document links work either way.

Recommendation: pick one convention (likely "leave done iterations in `kb/iterations/`, archive nothing") and document it in `kb/iterations/README.md` if it exists; otherwise no action.

#### A-KB-03 — `findings-index.md` cross-references intact
Area: Knowledgebase  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: every "deferred to iter-X" reference points to a real iteration file.

Recommendation: none.

#### A-KB-04 — CLAUDE.md rules + paths all current
Area: Knowledgebase  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: all CLAUDE.md path references (`kb/admin-architecture/overview.md`, `decision-log.md`, `design-system/README.md`, `feature-slice-template.md`, `kb/audits/findings-index.md`) exist.

Recommendation: none.

#### A-KB-05 — Decision-log ADRs match code
Area: Knowledgebase  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: spot-checked ADR-001 (feature folder layout), ADR-002 (schema per feature), ADR-003 (Biome isolation), ADR-014 (shadcn stack), ADR-016 (Bordeaux theme). All match.

Recommendation: none.

### Dead code (`A-DEAD-*`)

#### A-DEAD-01 — No stale TODOs (>60 days old)
Area: Dead code  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: 11 TODO references, all in `apps/homepage/src/app/site-config.ts` and `site-config.test.ts`. `git blame` shows 2026-05-04 / 05 — well under the 60-day threshold.

Recommendation: none.

#### A-DEAD-02 — No orphaned source files detected
Area: Dead code  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: spot-check across `apps/admin/src`, `apps/homepage/src`, `packages/*/src`. All files reachable from entry points or tests.

Recommendation: none.

#### A-DEAD-03 — No unused top-level exports
Area: Dead code  ·  Severity: nice-to-have  ·  Disposition: no-action

Evidence: spot-checked `lib/auth.ts`, `lib/permissions.ts`, `lib/email.ts`, `lib/push.ts`, `lib/notify.ts`, `lib/audit-log.ts`, `lib/utils.ts`. Every export consumed within feature slices or entry points.

Recommendation: none.

---

## Recommended next iterations

1. **iter-34 — `useFormAction` → `useActionState` migration.** Touches ~6 forms (bookings, services, users, invite, request, set-password). Drops the custom hook in favour of React 19's first-party form-action hook with `useFormStatus` for pending UI. Closes A-REACT-04 and prepares for further form modernisation. Estimated effort: half a day; tests stay green because behaviour is identical.

2. **iter-35 — Per-segment `error.tsx` + small SEO sweep.** Add 10 `error.tsx` boundaries (A-NEXT-06) and verify canonical / OG fields on all homepage public pages (A-HOME-01). Two-for-one because both are file-level additions touching only `app/`. Estimated effort: one to two hours.

3. **iter-36 — Conditional-UPDATE audit + vitest-axe gap closure.** Verify every `.update(bookings).set({status: ...}).where(...)` has a matching `.returning(...)` (A-ADMIN-03); add missing vitest-axe smokes on the 4–5 bare interactive components (A-ADMIN-05). Higher-impact because it closes a potential race window. Estimated effort: half a day.

4. **iter-37 — TypeScript 6 + Vite 8 dev-pipeline bump.** TypeScript 5.9 → 6.0 (A-TS-08), Vite 7 → 8 + `@vitejs/plugin-react` 5 → 6 (A-DEPS-03). Test-only blast radius makes this lower-risk than it sounds. Run as one iteration with `npm run verify` as the gate. Estimated effort: half a day to one day depending on changelog surprises.

5. **iter-38 — Booking-request schema hardening.** Move the shared services-list schema into `packages/shared`, validate the `/booking-request` build-time response, fix the unvalidated cast (A-TS-03 / A-HOME-03). Estimated effort: hours.

## Heads-up

- iter-32 design-system rewrite landed before this audit; the cross-check is in §5 and the doc/code pair is coherent.
- The user wants to read this report before iter-34 is chosen — none of the candidates above were pre-queued as iterations.
- Lighthouse baseline (§A-HOME-05) deferred because production reachability wasn't verified in this run; capture before iter-35 starts so the SEO pass has a regression baseline.
