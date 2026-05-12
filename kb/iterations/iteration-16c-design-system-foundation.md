---
title: Iteration 16c — Design system foundation
type: iteration
order: 17.4
status: done
---

# Iteration 16c — Design system foundation

The 2026-05-09 frontend audit ([consolidated](../audits/audit-2026-05-09-frontend-consolidated.md)) showed three reviewers converging on the same observation: the admin app has reasonable bones but no written contract for *how* UI should be built. iter-15/16 settled conventions implicitly; iter-17/18/19 will copy from them. Without a doc, "implicit" becomes "drifting".

This iteration writes the contract — and only the contract. **No application code changes.** Deliverables: the design-system reference doc, the vendored primitives that the cleanup iterations will need (`Sidebar`, `Sheet`, `Skeleton`), the dev-deps for component testing (`vitest-axe`), and the `kb/admin-architecture/feature-slice-template.md` cross-link.

The design-system doc must treat **mobile/responsive as a first-class concern**: admins manage events from their phones. Every primitive defined here gets a mobile-first answer alongside its desktop one.

## Pre-flight

- [x] iter-16b (edge hardening) merged. Security headers in place; CSP shape known so the doc can recommend CSS approaches that don't fight it.
- [x] [Frontend audit consolidated](../audits/audit-2026-05-09-frontend-consolidated.md) re-read.
- [x] Confirm: stay on stock shadcn/ui; do not adopt community shadcn extensions (Origin UI, Cult UI, Aceternity, etc.). Reference research in §6 of the consolidated audit.

## Scope — `kb/admin-architecture/design-system/README.md` [14/14]

The doc covers each topic with a mobile-first answer + a desktop answer + a "don't do this" anti-pattern. Concrete code snippets where they help.

- [x] **Tokens.** List every CSS variable in `apps/admin/src/app/globals.css` with what it's for. Forbid hex literals in `apps/admin/src/`; only `var(--…)` or named Tailwind tokens. Decision on `--radius-m: 16px` (drop or adopt).
- [x] **Breakpoints + responsive baseline.** Tailwind defaults — `sm` 640px, `md` 768px, `lg` 1024px. **Mobile-first**: write `text-base lg:text-sm`, never `text-sm lg:text-base`. Document that admin must work at 375px width (iPhone SE class) and up. Touch targets ≥ 44×44 (Tailwind `min-h-11 min-w-11`).
- [x] **Spacing.** One scale for page padding (`px-4 py-6 md:px-6 md:py-8`), section gap (`gap-6`), card padding (`p-4`), inline gap (`gap-2`). Pick once, document.
- [x] **Typography.** The small set actually in use: `text-2xl md:text-3xl font-semibold` h1, `text-lg md:text-xl font-medium` h2, `text-sm` body, `text-xs text-muted-foreground` help. No more.
- [x] **Layout primitives** (signatures only — built in iter-16d/e as needed). `<PageHeader title actions?>` (title + description + actions slot, mobile-stacks-actions-below). `<Section>`. `<EmptyState>`. `<TableSkeleton>`.
- [x] **Forms.** Always shadcn `<Form>`+`<FormField>`+`<FormControl>`+`<FormMessage>`. Single column on mobile, two-column grid `md:grid-cols-2` on desktop. Full-width inputs (`w-full`). Form-level server errors via `role="alert"` + `aria-live="assertive"`. Touch targets ≥ 44px on inputs and submit. Submit button full-width on mobile.
- [x] **Tables — responsive strategy.** Tables with >3 columns must render as **stacked cards on mobile, table on desktop**: `<div className="md:hidden">…cards…</div><Table className="hidden md:table">…</Table>`. Tables ≤3 columns can stay as horizontal-scrolling tables. **No TanStack Table** unless sorting/filtering/pagination is genuinely needed; if introduced, do it as a one-off with explicit justification. Document the card shape (label-value rows).
- [x] **Dialogs vs sheets on mobile.** Dialogs become sheets (`Sheet` shadcn primitive) on mobile when content is form-shaped or long. Quick confirms (delete) stay as dialogs. Document which pattern goes where, and that destructive dialogs disable Esc-to-close during pending (intentional).
- [x] **Status badges.** One shared `<StatusBadge kind status>` component. Per-`kind` variant map co-located with the schema. Same on mobile/desktop.
- [x] **Icons.** Lucide everywhere. Inline = `size-4`, button-leading = `size-5`. **No Unicode dingbats** (kills SR, F-FE-23). All icons in interactive context get `aria-hidden="true"` + a sibling text label.
- [x] **Permission gating.** Server `<HasPermission>` is authoritative. Client `useHasPermission()` is a UI hint only. Permission keys are entity-scoped: `*_VIEW` for reads, `*_CREATE`/`UPDATE`/`DELETE` for writes. **Never reuse a write perm to gate a read** (the `EVENT_CREATE`-as-view-gate bug from F-FE-08 is the precedent).
- [x] **A11y baseline.** Every interactive component gets a `vitest-axe` assertion in its test. Tables have `aria-label`. Nav items have `aria-current="page"`. Live regions for form-level server errors. Touch targets ≥ 44px. `prefers-reduced-motion` respected by all CSS animations (use `motion-safe:` Tailwind variant for animations).
- [x] **Animation.** Document `transition-colors duration-200` as the default; reserve longer / fancier transitions for one-off cases. Wrap in `motion-safe:`.
- [x] **Anti-patterns** section listing things specifically forbidden: `<div onClick>`, hardcoded hex literals in `apps/admin/src/`, `useMemo`/`useCallback` for cheap derivations (Compiler handles them), Unicode dingbats, raw HTML inputs in forms, TanStack Table for read-only data, manual focus rings (`focus-visible:` is shadcn-built-in), reusing write permissions to gate reads.

## Scope — vendor primitives needed by iter-16d/e [4/4]

Install (vendor) the shadcn primitives the cleanup iterations will use. `npx shadcn add` writes them into `apps/admin/src/components/ui/` (Biome already excludes that directory from lint).

- [x] `npx shadcn add sidebar` — replaces hand-rolled `DashboardSidebar` in iter-16d. Pulls in `Sheet` if not already present.
- [x] `npx shadcn add sheet` — explicit, in case `sidebar` doesn't pull it. Used for mobile sheet variants of dialogs.
- [x] `npx shadcn add skeleton` — used in `loading.tsx` files added by iter-16e.
- [x] Smoke check: `npm run verify` still green; no app code references the new primitives yet.

## Scope — dev tooling for component tests [2/2]

Sets up the tooling iter-16e/g need. No tests written here.

- [x] Add `vitest-axe` to `apps/admin` devDependencies.
- [x] Wire into the admin vitest project (extend `expect` with axe matchers in `tests/setup.ts`). Add a single placeholder smoke that imports vitest-axe to confirm it resolves; remove or leave as the harness self-test.

## Scope — cross-links [3/3]

- [x] Update `kb/admin-architecture/overview.md` "Start here" table to add a "Design system" row pointing at the new doc.
- [x] Update `kb/admin-architecture/feature-slice-template.md` to say "UI conventions: see [`design-system/README.md`](design-system/README.md)" — that line replaces any previously inline UI guidance.
- [x] Update `CLAUDE.md` (admin section) to point at `design-system/README.md` alongside the slice template.

## Verify [4/4]

- [x] `npm run verify` — green.
- [x] `npm run verify:tf` — green (no infra changes here, but confirm).
- [x] `kb/admin-architecture/design-system/README.md` exists, covers all 14 topics in the scope above with mobile-first answers, and reads as a one-shot reference.
- [x] Vendored primitives (`sidebar.tsx`, `sheet.tsx`, `skeleton.tsx`) exist in `components/ui/` and don't yet have any callers.

## Out of scope (deliberate)

- **Any application code changes.** This iteration is doc + foundation only. Sidebar adoption, table rewrite, form refactor — all deferred to iter-16d/e.
- **Layout primitive implementation.** Signatures documented; building `<PageHeader>` etc. waits for the first concrete need (likely iter-16d).
- **Dark/light theme switcher.** Admin is dark-only by design; doc says so.
- **Centralizing tokens between admin + homepage.** Admin and homepage have separate token sets by design (different audiences). Reconsider only if a third surface appears.
- **Tremor / shadcn Charts.** Defer until an analytics surface is requested.

## Critical files

New:
- `kb/admin-architecture/design-system/README.md`
- `apps/admin/src/components/ui/sidebar.tsx` (vendored)
- `apps/admin/src/components/ui/sheet.tsx` (vendored)
- `apps/admin/src/components/ui/skeleton.tsx` (vendored)

Edited:
- `apps/admin/package.json` (add `vitest-axe`)
- `tests/setup.ts` (extend `expect` with axe matchers)
- `kb/admin-architecture/overview.md` (cross-link)
- `kb/admin-architecture/feature-slice-template.md` (cross-link)
- `CLAUDE.md` (cross-link)

## Done when [3/3]

- [x] `design-system/README.md` is the single contract for "how to build UI here", and iter-16d/e/g/17 can reference it as a complete instruction.
- [x] Mobile/responsive is treated as a primitive, not a polish step — every section of the doc has a mobile-first answer.
- [x] All vendored primitives + dev tooling are in place so iter-16d can start mechanical cleanup without setup tax.
