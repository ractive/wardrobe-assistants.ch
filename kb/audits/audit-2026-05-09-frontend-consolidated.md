---
title: Frontend / UI audit — consolidated (Claude + ChatGPT + Copilot) — 2026-05-09
type: audit
status: current
reviewers: [claude-opus-4-7, chatgpt, github-copilot]
created: 2026-05-09
tags: [audit, frontend, ui, react, shadcn, tailwind, accessibility, consolidated]
related: [audit-2026-05-09-frontend-deep.md, audit-2026-05-09-frontend-chatgpt.md, audit-2026-05-09-frontend-copilot.md, audit-2026-05-09-consolidated.md]
---

# Consolidated frontend / UI audit — 2026-05-09

Three independent frontend reviews of `apps/admin` and `apps/homepage` (Claude Opus 4.7, ChatGPT, GitHub Copilot), reconciled. Source documents are preserved verbatim alongside this file. Substantive new claims from each reviewer were verified by direct grep against the codebase before publishing; one or two unverifiable claims are flagged Low confidence.

## 1. Reviewer-coverage matrix

✅ = called out clearly with file/line; ⚠️ = mentioned weakly or as a checklist row; ❌ = missed.

| # | Finding (consolidated ID) | Sev | Claude | ChatGPT | Copilot |
|---|---|---|---|---|---|
| 1 | F-FE-01 Login page bypasses shadcn `<Form>`/`<Input>`/`<Button>` (raw inputs, no `htmlFor`/`id`/`aria-describedby`) | M | ✅ UI-A | ✅ MEDIUM | ✅ UI-01 (High) |
| 2 | F-FE-02 No `role="alert"` / `aria-live` on login + set-password server errors | M | ❌ | ✅ MEDIUM | ✅ UI-02 (High) |
| 3 | F-FE-03 TanStack Table loaded for read-only, non-sortable, non-paginated tables (~20-30 KB JS) | M | ❌ | ❌ | ✅ UI-03 |
| 4 | F-FE-04 No `loading.tsx` / `error.tsx` / `not-found.tsx` boundaries | M | ✅ UI-C | ❌ | ✅ UI-04 |
| 5 | F-FE-05 Admin sidebar `hidden md:block` — no mobile navigation at all | M | ❌ | ❌ | ✅ UI-05 |
| 6 | F-FE-06 No `aria-current="page"` on active sidebar links | M | ✅ UI-F | ✅ LOW | ✅ UI-06 |
| 7 | F-FE-07 Homepage `<Button>` always renders `<a>`; `href` not required, semantic ambiguity | M | ✅ UI-B | ✅ MEDIUM | ❌ (not flagged but related to #1 cluster) |
| 8 | F-FE-08 Wrong permission gates event detail view: `EVENT_CREATE` instead of an `EVENT_VIEW` | M | ❌ | ❌ | ✅ UI-08 |
| 9 | F-FE-09 Zero React component tests (`*.test.tsx` count = 0 in admin) | M | ✅ UI-D | ⚠️ "frontend tests should include..." | ✅ UI-13 |
| 10 | F-FE-10 Manual `useMemo` on table column defs and pickers contradicts enabled React Compiler | L-M | ✅ UI-E | ❌ | ✅ "no-op overhead" |
| 11 | F-FE-11 Login two-step (credentials → TOTP) does not move focus to step 2 input | L | ❌ | ❌ | ✅ UI-14 |
| 12 | F-FE-12 EventForm `defaults?.date ?? (undefined as unknown as Date)` cast bypasses type safety | L | ✅ UI prior C-TS-02 | ✅ MEDIUM | ❌ |
| 13 | F-FE-13 Homepage hardcoded hex (`#EDEAE4`, `#8F8A83`, `#9B958D`, `#B8B3AC`) where tokens exist | L | ✅ UI-I | ❌ | ✅ UI-09 |
| 14 | F-FE-14 Mobile-nav checkbox-hack — works today but Esc/`aria-expanded`/route-change-reset rely on CSS only | L | ⚠️ UI-T (acknowledged + accepted) | ✅ MEDIUM | ❌ |
| 15 | F-FE-15 Submit-pattern duplicated across 4 forms (try/catch + toast + onSuccess + router.refresh) — no `useFormAction()` extraction | L-M | ✅ UI-G | ⚠️ DS-consistency note | ❌ |
| 16 | F-FE-16 EventStatusBadge / users StatusBadge drift (separate components, similar shape) | L | ✅ UI-H | ❌ | ❌ |
| 17 | F-FE-17 SignOutButton uses manual `useState` for pending; failures silent (no toast) | L | ✅ UI-J | ❌ | ❌ |
| 18 | F-FE-18 EventsTable redundant "Open" ghost-button column (event name link + Open button → same URL) | L | ❌ | ❌ | ✅ UI-12 |
| 19 | F-FE-19 Dead `<Check className="...opacity-0" />` in AssigneesPicker line 132 | L | ❌ | ❌ | ✅ UI-07 |
| 20 | F-FE-20 Tables (`UsersTable`, `EventsTable`) lack `aria-label` on the `<Table>` element | L | ❌ | ❌ | ✅ UI-11 |
| 21 | F-FE-21 Duplicate `auth.api.getSession()` in layout + every dashboard page | L | ⚠️ UI-V (cautious) | ❌ | ✅ "extra DB round-trip" |
| 22 | F-FE-22 `--radius-m: 16px` defined in `globals.css` but components use `rounded-md` (Tailwind 6px) — token unused | L | ❌ | ❌ | ✅ |
| 23 | F-FE-23 Unicode `←` arrow in `events/[id]/page.tsx:50` instead of `<ArrowLeft />` Lucide | L | ❌ | ❌ | ✅ |
| 24 | F-FE-24 Design tokens duplicated across admin + homepage (different token names, no shared package) | L | ❌ | ✅ LOW | ✅ "tokens not aligned" |
| 25 | F-FE-25 `MessageDialog` form reset depends on unstable `form` object in deps | L | ✅ UI-K | ❌ | ❌ |
| 26 | F-FE-26 Login page (~152 lines) muxes credentials + TOTP forms; should split before iter-19 (auth-mfa) | L | ✅ UI-L | ❌ | ✅ "extract step sub-components" |
| 27 | F-FE-27 Color-contrast risk: `--muted-foreground` on `--background` is borderline AA on small text | L | ✅ UI-S (unverified) | ❌ | ❌ |
| 28 | F-FE-28 Destructive dialogs disable Esc-to-close during pending — intentional but unconventional | L | ✅ UI-R | ❌ | ❌ |
| 29 | F-FE-29 EyebrowBadge uses string-template ternary instead of `cn()` | L | ❌ | ❌ | ✅ UI-10 |

Reviewer scoring:

- **Copilot** caught the most operationally-impactful issues missed by Claude: TanStack Table overkill (F-FE-03), mobile-nav gap (F-FE-05), wrong permission on detail view (F-FE-08), dead Check icon (F-FE-19), redundant Open column (F-FE-18), unused `--radius-m` (F-FE-22), the Unicode arrow (F-FE-23), and the duplicate `getSession()` calls (F-FE-21). It ran the build pipeline locally, which gave it concrete bundle-size context.
- **ChatGPT** caught form-error live-region gap (F-FE-02), Users-table scalability concern, and design-token duplication across apps (F-FE-24). Less specific on file/line but with a sharper a11y angle.
- **Claude** caught form-pattern duplication (F-FE-15), badge drift (F-FE-16), SignOutButton silent-failure (F-FE-17), the unstable `form` dep in MessageDialog reset (F-FE-25), and was the only one to call out the React-Compiler-vs-`useMemo` tension at the right severity.
- All three converged on the same five top-tier findings: login bypassing the design system, no `aria-current` on sidebar, missing error/loading/not-found boundaries, no component tests, hex-not-token in homepage.

## 2. Top 12 highest-impact findings (consolidated)

| Rank | ID | Sev | Title |
|---|---|---|---|
| 1 | F-FE-01 | M | Login page bypasses shadcn primitives — divergent UX, broken a11y wiring |
| 2 | F-FE-02 | M | No `role="alert"` / `aria-live` on login + set-password server errors |
| 3 | F-FE-03 | M | TanStack Table loaded for read-only static tables (~20-30 KB unnecessary client JS; forces "use client" on tables) |
| 4 | F-FE-04 | M | No `loading.tsx` / `error.tsx` / `not-found.tsx` anywhere |
| 5 | F-FE-05 | M | Admin entirely inaccessible on mobile (sidebar `hidden md:block`, no fallback) |
| 6 | F-FE-06 | M | No `aria-current="page"` on active sidebar links |
| 7 | F-FE-07 | M | Homepage `<Button>` always renders `<a>`; `href` not required |
| 8 | F-FE-08 | M | `EVENT_CREATE` gates event-detail viewing — semantically wrong |
| 9 | F-FE-09 | M | Zero React component tests across admin features |
| 10 | F-FE-15 | L-M | Form submit-pattern duplicated 4× (no `useFormAction()` extraction) |
| 11 | F-FE-10 | L-M | Manual `useMemo` on table column defs + pickers — React Compiler obviates them |
| 12 | F-FE-11 | L | Login two-step transition doesn't move focus to TOTP input |

## 3. Verified evidence

| ID | Quote | File:line |
|---|---|---|
| F-FE-01 | `<input className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--ring)]" {...credentialsForm.register("email")} />` (no `Input` import) | `apps/admin/src/app/login/page.tsx:78,92,124` |
| F-FE-03 | `import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"; ... const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })` | `apps/admin/src/features/{events,users}/components/{Events,Users}Table.tsx:4-8,79-82` |
| F-FE-05 | `<aside className="hidden w-48 shrink-0 border-[var(--border)] border-r px-3 py-6 md:block">` | `apps/admin/src/components/DashboardSidebar.tsx:35` |
| F-FE-08 | `const canView = await userHasPermission("EVENT_CREATE");` | `apps/admin/src/app/(dashboard)/events/[id]/page.tsx:26` |
| F-FE-18 | Lines 32 (name as Link) + 69-70 (`<Button asChild ... <Link href={\`/events/${row.original.id}\`}>Open</Link></Button>`) → same URL | `apps/admin/src/features/events/components/EventsTable.tsx:32,69-70` |
| F-FE-19 | `<Check className="mr-2 size-4 opacity-0" />` (always invisible) | `apps/admin/src/features/events/components/AssigneesPicker.tsx:132` |
| F-FE-21 | `auth.api.getSession()` called in: `(dashboard)/layout.tsx`, `(dashboard)/page.tsx`, `(dashboard)/users/page.tsx`, `(dashboard)/events/page.tsx`, `(dashboard)/events/[id]/page.tsx` | (5 files) |
| F-FE-22 | `--radius-m: 16px;` defined; components use `rounded-md` (Tailwind 6px) | `apps/admin/src/app/globals.css:18` |
| F-FE-23 | `<Link href="/events">← All events</Link>` | `apps/admin/src/app/(dashboard)/events/[id]/page.tsx:50` |

## 4. OWASP / a11y impact summary

- **WCAG 2.1 AA failures (real)**: F-FE-02 (no live region for auth errors), F-FE-05 (mobile nav missing → fails operable on small screens), F-FE-06 (no `aria-current`), F-FE-20 (tables without `aria-label`), F-FE-11 (focus management gap on TOTP step).
- **WCAG 2.1 AA close calls**: F-FE-27 contrast, F-FE-01 (label/input not properly associated when labels wrap inputs).
- **Operational impact**: F-FE-03 (unnecessary client JS) and F-FE-21 (extra DB round-trips) compound on slower networks.

## 5. Disputed / overstated findings

- **F-FE-14 (mobile-nav checkbox-hack)**: ChatGPT rated MEDIUM, Claude rated LOW (UI-T) and accepted it as-documented. The pattern works today and the comment in `Nav.tsx` lines 9-19 is the right level of investment for a homepage that ships once a quarter. Reconcile at LOW. Re-evaluate only if a future homepage iter adds JS state anyway.
- **Copilot's UI-09 / UI-23 hex severity**: a real cleanliness issue but not user-facing harm. LOW is correct.
- **`aria-describedby` on login form** (Copilot, Claude) — once the page moves to shadcn `<Form>`, this comes free; don't write a separate fix.

# Part 2 — Design system foundation

The user asked: *"how to create a design system for our admin app, using all the tools (shadcn, tailwind etc.), so that we can build coherent, modern looking, admin dashboards. Maybe there's even some nice UI/design library or framework or system on top of shadcn, that helps to build good looking admin apps."*

Research summary (May 2026 landscape):

## 6. Landscape — what's out there

| Option | What it is | Cost | Fits us? |
|---|---|---|---|
| **shadcn/ui official `Sidebar` component** | Composable sidebar with Provider/Trigger/Content/Group/Menu primitives, mobile offcanvas, `Cmd+B` shortcut, built-in dark mode. Install: `npx shadcn add sidebar`. | Free (vendored) | **Yes — direct fit.** Replaces the hand-rolled `DashboardSidebar.tsx`; closes F-FE-05 (mobile) + F-FE-06 (`aria-current`) for free. |
| **shadcn/ui official "blocks"** at [ui.shadcn.com/blocks](https://ui.shadcn.com/blocks) — `dashboard-01`, `sidebar-07` (collapsible icon), `sidebar-03` (submenus), auth blocks. Install: `npx shadcn add <block-name>`. | Free | **Yes — use as scaffolding reference.** Don't blindly copy a whole block; lift the structural patterns (header + breadcrumb + inset sidebar) and stay on the existing token system. |
| **shadcn/ui official Charts** (Recharts wrapper) | Line/bar/area/radial chart primitives sharing the shadcn token system. | Free | Not yet — no analytics surface. Reach for it when the first KPI page lands. |
| **Tremor** | Analytics-focused component library (~35 KPI/chart components). ~200 KB+ gzipped. | Free | **No — overkill.** This admin is CRUD, not analytics. Reconsider only if the squad asks for an analytics dashboard. |
| **shadcn-admin** ([satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin), 12k★) | Reference admin UI built on shadcn (Vite + TanStack Router, not Next.js). Includes sidebar, command palette, settings, themes. | Free / MIT | **Useful as a pattern reference**, especially for command-palette and settings layouts. Not adopt-as-a-package. |
| **Origin UI / Cult UI / Aceternity / Magic UI** | Community shadcn extensions — extra components, animations, marketing/B2B presentation patterns. | Mostly free | **Skip.** They're lovely but skewed toward landing pages, not internal tooling. Adding more component sources = more drift surface. |
| **Tailwind UI / Catalyst** | Tailwind Labs' admin-focused component library. Paid. | Paid | Not necessary at our scale; redundant with shadcn. |
| **shadcnblocks.com** | 1350+ blocks, premium templates. | Mostly paid | Skip. We don't need landing-page sections; we need reliable admin primitives. |

**Verdict:** Stay on **stock shadcn/ui** — adopt the **`Sidebar` component**, the **`Charts` primitives** (when needed), and **`<Form>`/`<Input>`/`<Button>` everywhere** (close F-FE-01). Don't add more component-source dependencies; every additional source compounds drift risk.

## 7. The design-system "rules of the road" we should write down

To make iter-17/18 (services, squad-views) feel coherent without thinking, we need a one-page DS reference inside `kb/admin-architecture/`. Proposed file: `kb/admin-architecture/design-system/README.md`. Contents:

1. **Tokens** (semantic): list every CSS variable in `globals.css` with what it's for. Forbid hex literals in app code; only `var(--...)` or named Tailwind tokens.
2. **Spacing**: page padding, section gap, card padding — pick one set and document. (e.g., `px-6 py-8` for page; `gap-4` for stacks; `gap-2` for inline.)
3. **Typography**: the small set of text sizes/weights actually in use (e.g., `text-3xl font-semibold` for h1, `text-xl font-medium` for h2, `text-sm` body, `text-xs text-muted-foreground` for help). No more.
4. **Layout primitives**: a shared `<PageHeader>` (title + description + actions slot), `<EmptyState>`, `<Section>` wrapper. Extract from existing repetition; don't pre-design.
5. **Forms**: always shadcn `<Form>` + `<FormField>` + `<FormControl>` + `<FormMessage>`; one `useFormAction()` hook for submit pattern.
6. **Tables**: semantic `<Table>` from `components/ui/table.tsx`, no TanStack unless sorting/filtering/pagination is needed (then introduce TanStack with full justification).
7. **Status badges**: one `StatusBadge` component driven by `(status: string, kind: "user" | "event" | "service") => Variant` map. One file per `kind`.
8. **Icons**: Lucide everywhere, always at `size-4` (Tailwind v4) for inline, `size-5` for buttons. Forbid Unicode dingbats (kills SR experience — F-FE-23).
9. **Permission gating**: `<HasPermission>` (server) + `useHasPermission()` (client UI hint only); `withPermission()` is authoritative server-side. Permission keys are entity-scoped (`EVENT_VIEW`, `EVENT_CREATE`, etc.) — don't reuse a write permission to gate a read.
10. **A11y baseline**: every interactive element gets keyboard + a11y test in its component test; tables get `aria-label`; nav gets `aria-current`; live regions for form-level server errors.

This document becomes the contract iter-17 copies from. ~1 hour to write; high leverage.

## 8. Final prioritized action plan

Ordered by **risk reduction × inverse effort**, scoped to land in one focused frontend iteration (see `iteration-16d-frontend-cleanup.md`).

### Group 1 — Single PR, ≤30 min each, no architectural risk

1. **F-FE-13** (Footer hex → tokens) — 5 min
2. **F-FE-19** (remove dead `<Check opacity-0>`) — 2 min
3. **F-FE-18** (drop redundant Open column from EventsTable) — 5 min
4. **F-FE-20** (`aria-label` on Tables) — 5 min
5. **F-FE-23** (`←` Unicode → `<ArrowLeft />`) — 5 min
6. **F-FE-29** (EyebrowBadge `cn()`) — 5 min
7. **F-FE-22** (decide on `--radius-m`: drop or adopt) — 10 min
8. **F-FE-08** (introduce `EVENT_VIEW` permission, replace `EVENT_CREATE` gate) — 15 min
9. **F-FE-10** (drop `useMemo` from EventsTable / UsersTable / AssigneesPicker — Compiler handles it) — 10 min
10. **F-FE-21** (verify Better Auth dedup; if confirmed, remove duplicate `getSession()` from pages) — 30 min

### Group 2 — Medium investments (each its own PR, ~1-3 hours)

11. **F-FE-02** (`role="alert"` + `aria-live` on login + set-password + dialog server errors) — 30 min
12. **F-FE-06** + **F-FE-05** (adopt official shadcn `Sidebar` component → replaces hand-rolled `DashboardSidebar`; gets `aria-current` + mobile offcanvas + `Cmd+B` for free) — 2-3 hours
13. **F-FE-04** (`(dashboard)/error.tsx`, `(dashboard)/not-found.tsx`, `app/not-found.tsx`, plus per-segment `loading.tsx`) — 1-2 hours
14. **F-FE-03** (replace TanStack Table with semantic `<Table>` from `components/ui/table.tsx`; both tables become server components; remove `@tanstack/react-table`) — 2-3 hours
15. **F-FE-15** (`useFormAction()` hook + migrate the 4 forms) — 1-2 hours
16. **F-FE-07** (rename homepage `Button` to `LinkButton` or make `href` required) — 30 min
17. **F-FE-12** (refactor EventForm date typing to `Date \| undefined`) — 30-45 min
18. **F-FE-17** (SignOutButton → `useTransition()` + error toast) — 15 min
19. **F-FE-25** (MessageDialog form-reset dep array fix) — 10 min

### Group 3 — Larger investments

20. **F-FE-01** (login page → shadcn `<Form>`/`<Input>`/`<Button>`) + **F-FE-26** (split into `<CredentialsStep>` / `<TotpStep>`) + **F-FE-11** (focus management on step transition) — 2-3 hours. **Block before iter-19 (auth-mfa).**
21. **F-FE-09** + **F-FE-16** (first three component tests with `vitest-axe`: LoginPage, EventForm, AssigneesPicker; consolidate StatusBadge across events/users) — 4-6 hours
22. **Design-system doc** (`kb/admin-architecture/design-system/README.md`) — 1 hour
23. **F-FE-24** (centralize shared tokens in `packages/ui-tokens/` or similar — only if homepage starts to grow) — defer
24. **F-FE-14** (mobile-nav from CSS-hack to small client component) — defer; not blocking

## 9. What was not verified in this session

- **F-FE-21** Better Auth's session-cache dedup behavior — not traced through `node_modules/better-auth`. The "duplicate `getSession()`" call sites are real, but whether each results in an actual extra DB round-trip depends on Better Auth's per-request cache. Verify before refactoring.
- **F-FE-27** color contrast — eyeballed only; run a contrast checker against the actual hex values.
- **F-FE-03** bundle-size impact — Copilot estimated ~20-30 KB; not personally re-measured. Run `next build --analyze` if you want the exact figure.
- **F-FE-22** whether `--radius-m` is genuinely unused — single grep confirms not used in `apps/admin/src/`, but worth a pass-2 grep across the whole repo before removing.

## 10. Sources (external research)

- [shadcn/ui blocks](https://ui.shadcn.com/blocks) — official block library
- [shadcn/ui Sidebar component docs](https://ui.shadcn.com/docs/components/sidebar)
- [satnaing/shadcn-admin (GitHub, 12k★)](https://github.com/satnaing/shadcn-admin) — reference admin pattern
- [Tremor vs shadcn comparison (thefrontkit, 2026)](https://thefrontkit.com/blogs/best-shadcn-dashboard-templates-2026)
- [Top shadcn libraries 2026 (DEV Community)](https://dev.to/wrap-pixel/best-shadcn-libraries-1857)
- [How to build modern admin dashboard with shadcn 2026 (DEV Community)](https://dev.to/ausrobdev/how-to-build-a-modern-admin-dashboard-with-shadcnui-in-2026-3477)
