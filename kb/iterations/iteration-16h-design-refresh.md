---
title: Iteration 16h — Design refresh (shadcn theming + blocks)
type: iteration
order: 17.9
status: planned
---

# Iteration 16h — Design refresh (shadcn theming + blocks)

The post-iter-16 hardening sequence has rebuilt the *contract* (iter-16c) and *cleaned the existing UI to match it* (iter-16d/e/g). What's still missing is the **visual lift**: the admin still looks like a wireframe. shadcn shipped its v4 theming model and a substantial Blocks library — both are aligned with the conventions we already use, so adopting them is a low-risk way to make the app feel finished without inventing a parallel design language.

Three tracks, one iteration:

1. **Theming** — port `apps/admin/src/app/globals.css` from ad-hoc hex tokens to the shadcn-canonical [oklch + radius-scale model](https://ui.shadcn.com/docs/theming). Adds the semantic tokens we don't yet have (`--popover*`, `--accent*`, `--destructive-foreground`, `--chart-1..5`, the derived `--radius-{sm..2xl}` scale), keeps the Bordeaux brand, and stops fighting shadcn primitives that read tokens we never declared.
2. **Light mode + theme switcher** — introduce a real light palette under `:root` and move dark tokens to a `.dark` selector. Add a user-controlled theme toggle (`light` / `dark` / `system`) in the sidebar footer, following the shadcn [Next.js dark-mode guide](https://ui.shadcn.com/docs/dark-mode/next) verbatim: `next-themes` provider with `attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`, plus `suppressHydrationWarning` on `<html>`. next-themes injects its own pre-hydration script — no hand-rolled inline script.
3. **Blocks** — adopt three [shadcn/ui blocks](https://ui.shadcn.com/blocks) as the structural backbone for the surfaces that look most unfinished: `sidebar-07` (icon-collapse + user menu) as the foundation for `DashboardSidebar`, `dashboard-01` (sectioned KPI cards + chart + table) as the shape for the post-login home, and `login-03` (centered, branded, muted-bg) as the cosmetic refresh of `app/login/page.tsx`.

This iteration is **visual + structural** but stays inside the design-system contract from iter-16c. No new conventions, no new libraries — just better use of what's already vendored. Mobile-first answers (375px) per `design-system.md` are non-negotiable.

> **Tooling reminder for Claude:** every shadcn add/compose/research step in this iteration goes through the **shadcn MCP server** (project-scoped, registered in `.mcp.json`) — `mcp__shadcn__list_items_in_registries`, `view_items_in_registries`, `get_item_examples_from_registries`, `get_add_command_for_items`, `get_audit_checklist`. The MCP reads `components.json` directly and returns structured registry data; do not fall back to scraping `ui.shadcn.com` via WebFetch (lossy summaries) unless the MCP can't answer the question. The `shadcn` Skill remains a fine fallback for project-context lookups.

## Pre-flight

- [ ] iter-16c (design system foundation) merged. Tokens table is the baseline this iteration migrates.
- [ ] iter-16d (nav + data cleanup) merged. `DashboardSidebar` is currently the hand-rolled vendored-`sidebar` shape; sidebar-07 replaces it cleanly.
- [ ] iter-16e (forms + boundaries) merged. `useFormAction()` exists; the redesigned home page will reuse it for any inline actions.
- [ ] iter-16g (login redesign) merged. The login form structure is shadcn-canonical; login-03 only changes the chrome around it (logo badge, muted bg), not the form.
- [ ] Re-read [`kb/admin-architecture/design-system.md`](../admin-architecture/design-system.md) and [`ui-stack.md`](../admin-architecture/ui-stack.md) before editing tokens — they are this iteration's contract.
- [ ] Decision **reversed** from the original `globals.css` comment: admin will support **both light and dark mode** with a user-controlled toggle. Light is the new default for `:root`; dark lives under `.dark`. Both palettes derive from the same Bordeaux primary so the brand is consistent. `design-system.md` will be updated alongside (it currently says "dark-only" in several places).

## Scope — theme refresh (`globals.css`) [0/10]

The current `globals.css` declares 13 hex tokens plus `--radius-m: 16px` and a sidebar-token alias block, all under `:root`. The target is the [shadcn-canonical token set](https://ui.shadcn.com/docs/theming) expressed in **oklch** with a derived radius scale, defined twice (light under `:root`, dark under `.dark`), while preserving the Bordeaux brand (`--primary`) across both palettes.

- [ ] Define the **light palette** under `:root`. Background ≈ `oklch(0.99 0.005 80)` (warm-tinted off-white that pairs with the Bordeaux primary, not pure white), foreground ≈ `oklch(0.18 0.01 60)`. Card surfaces slightly lifted; muted slightly recessed. Bordeaux primary keeps its hue but lightens its primary-foreground for contrast on light fills. Validate WCAG AA on every text/surface pair before committing.
- [ ] Define the **dark palette** under `.dark`. Same shapes as today's hex set, restated in oklch. Today's `--background: #1a1816` ≈ `oklch(0.15 0.005 60)`; today's `--foreground: #edeae4` ≈ `oklch(0.93 0.005 80)`; today's `--primary: #b5564f` ≈ `oklch(0.59 0.12 28)`. Verify each conversion with the shadcn theme generator; perceived colour must be unchanged from today's dark UI (this is the regression-protection criterion of the verify step).
- [ ] Add the **missing semantic tokens** that shadcn primitives expect but we don't yet declare — defined in **both** `:root` (light) and `.dark` (dark) blocks:
  - `--popover` / `--popover-foreground` (currently inheriting from card; declare explicitly)
  - `--accent` / `--accent-foreground` (DropdownMenu, ContextMenu, Command hover/selected — currently visually undefined)
  - `--destructive-foreground` (text colour on destructive fills — currently relying on the foreground default)
- [ ] Add the **chart palette** `--chart-1` through `--chart-5`. Five harmonised shades around the Bordeaux brand: warm core, two cool accents, one neutral, one secondary warm. Document the intended use ordering in a comment so KPI charts in iter-22 (invoices) and any future analytics share a palette.
- [ ] Replace the single `--radius-m: 16px` literal with shadcn's [derived radius scale](https://ui.shadcn.com/docs/theming): `--radius: 0.625rem` as the source of truth, plus `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl` derived via `calc()`. shadcn primitives already reference these names — the missing scale is why some borders look mismatched.
- [ ] Update `design-system.md` §1 (Tokens table) to reflect the new variable list, the oklch values, and the radius scale. Mark the old `--radius-m` as deprecated; replace internal references with `--radius-lg`.
- [ ] Forbid any remaining hex literals in `apps/admin/src/` outside `globals.css` and `components/ui/` (Biome lint rule). The ban already exists in `design-system.md` §1; this scope adds the lint rule that enforces it.
- [ ] Update the `@theme inline` block to expose the new tokens to Tailwind (`--color-popover`, `--color-popover-foreground`, `--color-accent`, `--color-accent-foreground`, `--color-destructive-foreground`, `--color-chart-1..5`).
- [ ] Smoke: every existing screen (login, set-password, dashboard home, users, events) renders identically *or* visibly better — never worse — at 375px and ≥1024px. Capture a before/after pair in `kb/perf-reports/iter-16h-design-refresh/` for each surface.
- [ ] Decide and document: keep `--ring === --primary` (current convention, Bordeaux focus ring) **or** desaturate to a softer focus. Default decision: keep — but record it in the [decision log](../admin-architecture/decision-log.md).
- [ ] **Research-only step.** The shadcn registry exposes pre-baked theme presets — `@shadcn/theme-stone`, `@shadcn/theme-zinc`, `@shadcn/theme-neutral`, `@shadcn/theme-gray`, `@shadcn/theme-slate` (each `registry:theme`). Inspect `theme-stone` and `theme-neutral` via `mcp__shadcn__view_items_in_registries` as reference oklch palettes, then **derive** our Bordeaux-tinted equivalent rather than vendoring one wholesale. Document the chosen reference in the decision log so future maintainers know which preset to diff against if shadcn updates the canonical values.

## Scope — theme switcher (light / dark / system) [0/8]

The theme toggle is a first-class admin feature: admins manage events from phones in changing lighting (outdoor venues, dim backstage, bright daylight). Follow shadcn's [Next.js dark-mode guide](https://ui.shadcn.com/docs/dark-mode/next) verbatim — `next-themes` already handles the pre-hydration script that prevents a wrong-palette flash; do **not** roll a custom inline script.

- [ ] Add `next-themes` to `apps/admin` dependencies. Per [shadcn/dark-mode/next](https://ui.shadcn.com/docs/dark-mode/next), this is the canonical provider for App Router projects.
- [ ] Create `apps/admin/src/components/ThemeProvider.tsx` — a thin `"use client"` wrapper around `NextThemesProvider` that forwards all props (the exact shape shadcn ships).
- [ ] Wire it into `app/layout.tsx` with the four canonical props: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Add `suppressHydrationWarning` to the `<html>` tag — this is what permits next-themes to set the `.dark` class client-side without a React hydration mismatch warning. **No custom inline `<script>` needed**: next-themes injects its own pre-hydration script when `attribute="class"`, which sets the class before paint. `disableTransitionOnChange` prevents the cross-fade flash when the user actively toggles.
- [ ] **Vendor** `@shadcn/mode-toggle` via the shadcn MCP (`mcp__shadcn__get_add_command_for_items` → run command), then rename the file to `apps/admin/src/components/ThemeToggle.tsx` for consistency with our PascalCase convention. The canonical shadcn `mode-toggle` already implements the Sun/Moon icon swap (`scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90` etc.), the `sr-only "Toggle theme"` label, and the three menu items (Light / Dark / System) wired to `next-themes` `setTheme`. **Do not hand-roll it** — the canonical version is short, correct, and tracks upstream. Anchored in the new sidebar footer next to the user menu.
- [ ] Persistence policy: theme is stored client-side in `localStorage` via `next-themes` defaults. **No server round-trip** — theme is a UI preference, not user data, and persisting it server-side adds a write path for no real benefit. Document the choice in `decision-log.md`.
- [ ] Cross-cutting check: every shadcn primitive vendored in `components/ui/` already reads tokens, so the toggle "just works" for them. The two places that don't are: (1) any inline `style={{ background: "var(--…)" }}` in app code, and (2) the hand-rolled Bordeaux `BrandBadge`. Audit both and ensure they use the semantic tokens (`bg-primary text-primary-foreground`), not raw vars.
- [ ] vitest test for `ThemeToggle.tsx`: opening the menu shows three options; selecting each flips the resolved theme via `next-themes`'s `useTheme()` mock; vitest-axe `toHaveNoViolations()`.
- [ ] Manual smoke (user-driven): toggle Light → Dark → System on every screen at 375px and 1024px; cold-load each screen with each theme persisted in `localStorage` and confirm no flash. If a flash appears, it indicates either a missing `suppressHydrationWarning` on `<html>` or a primitive bypassing tokens — fix the source, do not paper over with a custom script.

## Scope — sidebar refresh (`sidebar-07` shape) [0/6]

`sidebar-07` is "a sidebar that collapses to icons" — the closest stock block to what the admin already wants: phone-offcanvas, desktop-rail-with-icons, hover-to-expand. Today's `DashboardSidebar` (56 lines) is a minimal `Sidebar collapsible="offcanvas"` with no desktop collapse, no footer/user menu, no nav grouping, and labels-only items.

- [ ] Bring in `sidebar-07` via the [`shadcn` Skill](https://ui.shadcn.com/blocks/sidebar). Inspect the produced files; do **not** wholesale replace — extract the pieces we want (icon collapse, footer with user menu, label+icon `NavLink` shape) and graft them into `DashboardSidebar.tsx`.
- [ ] `NavLink` gains a required `icon: LucideIcon` prop (`Users`, `Calendar` for the two existing links; pick a defensible `Home` for the dashboard home). Icons get `aria-hidden="true"` per `design-system.md` §10.
- [ ] Add a `<SidebarFooter>` with the user's email, the **user menu** (`DropdownMenu`) holding the existing sign-out action, and the new `<ThemeToggle>` (see the theme-switcher scope). Removes the standalone `sign-out-button.tsx` from the dashboard home.
- [ ] Switch `collapsible="offcanvas"` to `collapsible="icon"` so desktop gets the rail-with-icons collapse. Mobile keeps the offcanvas behaviour automatically (shadcn handles the breakpoint).
- [ ] Group the nav into `<SidebarGroup>` blocks with `<SidebarGroupLabel>` ("Manage", "Account") so future feature slices (services iter-17, squad iter-18) have an obvious home.
- [ ] Re-run the `<HasPermission>` gates around each `<NavLink>` exactly as today — the gate semantics don't change. Add a vitest-axe component test for the new sidebar.

## Scope — dashboard home refresh (`dashboard-01` shape) [0/6]

The post-login home (`app/(dashboard)/page.tsx`) is currently a 22-line "Hello, $email + sign-out button" placeholder. `dashboard-01` shows the canonical shape for an admin landing page (sectioned KPI cards + interactive chart + data table). We adopt the **layout shape**, not its bundle — the MCP's `view_items_in_registries` reveals dashboard-01 ships with `@dnd-kit/core`, `@dnd-kit/modifiers`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@tabler/icons-react`, `@tanstack/react-table`, and `zod` as deps. Vendoring it wholesale would import a drag-and-drop sortable data table we don't want, an icon library that competes with our `lucide-react` standard, and TanStack Table — all of which `design-system.md` §7 / §10 already forbids for static reads.

- [ ] **Do not** `npx shadcn add dashboard-01` wholesale. Use it as visual reference only: pull the structural classnames (page grid, `SectionCards` proportions, the gap and padding scale) and the section split (header → KPIs → chart → table) into our own files, hand-written using the primitives we already vendor. Vendor `@shadcn/empty` (`mcp__shadcn__get_add_command_for_items`) — it's `registry:ui`, single-file, no extra deps, and replaces the planned hand-rolled `<EmptyState>` from `design-system.md` §5.
- [ ] Replace `app/(dashboard)/page.tsx` with the dashboard-01 *layout shape*: a `<PageHeader>` ("Overview", "Welcome back, {firstName}"), a 2×2 KPI card grid (4 placeholders: "Upcoming events", "Active squad", "Open invoices", "Pending invites" — all wired to real counts where the data exists today, "—" otherwise), the chart placeholder (renders the canonical `@shadcn/empty` with a "data lands in iter-22" hint), and a "Recent events" mini-table (last 5 rows).
- [ ] KPIs use real counts from `events`, `user_profile`, and (where available) `invoices` queries. Each KPI card honours `<HasPermission>` — admins see all four; squad members see only the cards their permissions allow.
- [ ] Mobile-first: the 2×2 KPI grid stacks 1×4 below `md:`. The recent-events mini-table follows §7 of `design-system.md` (stacked cards on mobile, table on desktop) — no horizontal scroll, no TanStack Table.
- [ ] The chart placeholder is structurally there but visually disabled (skeleton/empty state) until iter-22 wires invoice/event metrics. We are explicitly **not** introducing `recharts` in this iteration — that's a separate decision belonging to iter-22.
- [ ] Note for iter-22: the registry exposes `@shadcn/chart-area-interactive` as a standalone block, separate from `dashboard-01`. iter-22 can vendor it directly without dragging in dashboard-01's dnd-kit/tabler/dnd-kit bundle.

## Scope — login chrome refresh (`login-03` shape) [0/3]

`iter-16g` redesigned the login *form*. `login-03` redesigns the *chrome around the form*: a centered card on a muted background with a brand badge above the form. We adopt the chrome and leave the form (already shadcn-canonical) untouched.

- [ ] Adopt the **chrome from `login-03`'s `page.tsx` only** — the muted-background full-screen flex shell, the `max-w-sm` form column, and the brand-badge link above the form. Do **not** vendor `login-03/components/login-form.tsx`: per the MCP's `get_item_examples_from_registries`, that file uses `Field` / `FieldGroup` / `FieldLabel` / `FieldSeparator` / `FieldDescription` — newer shadcn primitives we don't yet have, plus social-login (Apple/Google) buttons we don't support. Reuse the existing `credentials-step.tsx` + `totp-step.tsx` from iter-16g for the form body. Net effect: zero new vendored UI primitives, just the layout chrome.
- [ ] Add a brand badge above the form: a 56×56 rounded-square (`--radius-lg`) tile in `--primary` containing a Lucide icon (`ShirtIcon` or our wordmark glyph), with "Wardrobe Assistants — Admin" beneath it. Replaces the plain page-title text on `app/login/page.tsx`.
- [ ] Same treatment on `app/set-password/**` for visual consistency. The form bodies on both pages remain untouched.

## Scope — kb updates [0/4]

- [ ] `kb/admin-architecture/design-system.md` §1 — rewrite the Tokens table for the oklch + radius-scale model. §5 — replace the planned hand-rolled `<EmptyState>` signature with a reference to the canonical `@shadcn/empty` primitive vendored in this iteration. Add a new §15 "Blocks adopted" listing the three blocks (sidebar-07 — vendored; dashboard-01 — *layout reference only, not vendored*; login-03 — vendored chrome only), where each is grafted into the codebase, and the pattern each contributes (icon-collapse, KPI grid + section split, branded auth chrome).
- [ ] `kb/admin-architecture/ui-stack.md` — add a "Blocks" sub-section under the shadcn install workflow note: link to `https://ui.shadcn.com/blocks`, list the three adopted block names + locations, and mark "any future block adoption goes through the shadcn skill, not direct CLI".
- [ ] `kb/admin-architecture/decision-log.md` — record four new ADRs: (1) "Theme tokens migrated to oklch + derived radius scale" with rationale (shadcn-canonical, theme-generator-compatible); (2) "Adopted sidebar-07/dashboard-01/login-03 as structural baselines"; (3) "Reversed dark-only stance — admin now ships light + dark with a user-controlled toggle (default: system)"; (4) "Theme persistence is client-side via next-themes — no server round-trip, since it's a UI preference, not user data". Update the prior dark-only references in `design-system.md` to match.
- [ ] `kb/audits/findings-index.md` — if any open `F-FE-*` findings touch the surfaces redesigned here, mark the resolution iteration as iter-16h. Likely candidates: any "no visual hierarchy on dashboard home", any "user menu missing" finding.

## Verify [0/11]

- [ ] `npm run format` clean.
- [ ] `npm run verify` (lint + typecheck + test) green. New Biome rule blocking hex literals outside `globals.css`/`components/ui/` passes for the migrated codebase.
- [ ] **Dark-mode regression check.** Token migration is **visually equivalent or better** at 375px, 768px, and 1280px on every existing surface — with the dark theme active. Before/after screenshots saved under `kb/perf-reports/iter-16h-design-refresh/dark/`.
- [ ] **Light-mode acceptance check.** Same surfaces, same widths, light theme active. Screenshots under `kb/perf-reports/iter-16h-design-refresh/light/`. WCAG AA verified on every text/surface pair.
- [ ] **No-flash check.** Cold-load the dashboard home, login, and users page with `localStorage.theme = "dark"` set in advance — no light frame painted before hydration. Repeat with `"light"`. next-themes' built-in pre-hydration script (enabled by `attribute="class"`) is what makes this pass; if it regresses, the cause is almost always a missing `suppressHydrationWarning` on `<html>` or a primitive bypassing tokens. Do not "fix" it by adding a custom inline script.
- [ ] **Theme switcher behaviour.** Toggle Light → Dark → System; reload — preference persists. With System, flipping the OS-level dark setting flips the admin theme without a reload. ThemeToggle's vitest-axe assertion is green.
- [ ] vitest-axe assertions on the redesigned `DashboardSidebar`, `DashboardHome`, `LoginPage`, and `ThemeToggle` — all four `toHaveNoViolations()`, **once per theme**.
- [ ] Sidebar icon-collapse works at desktop widths; mobile offcanvas still works; user menu + theme toggle in the footer both work and close the sheet on mobile.
- [ ] Dashboard KPI grid stacks 1×4 on mobile, 2×2 from `md:`, 4×1 from `xl:`. The recent-events mini-table renders as cards on mobile, table on desktop.
- [ ] Login + set-password chrome (badge + muted bg) renders correctly at 375px without horizontal scroll, in both themes. Touch targets still ≥ 44×44.
- [ ] Manual smoke (user-driven): chart palette `--chart-1..5` is harmonised with the brand in **both** themes — visually inspect any placeholder chart bar/dot under each.

## Out of scope (deliberate)

- **`dashboard-01` wholesale.** Layout shape only — see the dashboard-home scope. Vendoring it would pull in `@dnd-kit/*`, `@tabler/icons-react`, `@tanstack/react-table`, and `zod` (already a dep, but the others are new and unwanted).
- **`@shadcn/signup-01..05`** blocks. The registry exposes them but the admin has no public sign-up surface today (per iter-16g out-of-scope). Re-enter only if Better Auth's signup is exposed.
- **`@shadcn/drawer` swap for `Sheet side="bottom"`** in `design-system.md` §8. The drawer primitive (vaul-based) is arguably the more idiomatic mobile-form pattern in current shadcn, but swapping it is a design-system-doc change with implications for every existing form sheet — out of scope here, queue as a follow-up.
- **`@shadcn/input-otp` swap for the TOTP step** added in iter-16g. The current implementation works; replacing it with the canonical OTP primitive is a polish iteration, not 16h's job.
- **Server-side theme persistence.** Theme is a UI preference; storing it on `user_profile` adds a write path with no real benefit. Client-only via `next-themes` localStorage. Re-enter scope only if multi-device theme sync becomes a feature request.
- **Per-page or per-route theme overrides.** One theme for the whole admin shell. Routes do not opt into a different palette.
- **Custom theme presets / multi-tenant theming.** Light + dark + system only. Branding stays Bordeaux.
- **`recharts` / real charts.** The dashboard chart is a placeholder. Wiring real metrics is iter-22's problem.
- **TanStack Table for the recent-events list.** Stays as the cards-on-mobile/table-on-desktop pattern — too few columns to justify it (`design-system.md` §7).
- **New shadcn primitives beyond what `dashboard-01`/`sidebar-07`/`login-03` pull in.** If a block requires a primitive we don't have, vendor it; do not preemptively `npx shadcn add` everything.
- **Logo asset work.** The brand-badge icon is a Lucide glyph for now; commissioning a real wordmark/glyph is a separate piece of work tracked in `kb/notes/`.
- **Homepage (`apps/homepage`) restyle.** This iteration is admin-only. The homepage's light/dark stance is independent.
- **i18n on the redesigned chrome strings.** Same exclusion as iter-16g.

## Critical files

New:
- `apps/admin/src/components/UserMenu.tsx` — the dropdown holding sign-out, used in the sidebar footer
- `apps/admin/src/components/ThemeToggle.tsx` — vendored from `@shadcn/mode-toggle` (renamed for our PascalCase convention), used in the sidebar footer
- `apps/admin/src/components/ThemeToggle.test.tsx` — vitest-axe + behavioural test for the toggle
- `apps/admin/src/components/ThemeProvider.tsx` — thin wrapper around `next-themes`'s provider with our defaults
- `apps/admin/src/components/ui/empty.tsx` — vendored from `@shadcn/empty`, replaces the planned hand-rolled `<EmptyState>`
- `apps/admin/src/components/KpiCard.tsx` — KPI tile primitive used by the dashboard home
- `apps/admin/src/components/RecentEventsTable.tsx` — mobile-cards/desktop-table mini-table for the dashboard home
- `apps/admin/src/components/BrandBadge.tsx` — the rounded-square brand tile used on login + set-password
- `apps/admin/src/components/DashboardSidebar.test.tsx` — vitest-axe + behavioural test for the redesigned sidebar
- `kb/perf-reports/iter-16h-design-refresh/{light,dark}/{login,dashboard,users,events}-{375,1024}.png` — before/after pairs per theme

Edited:
- `apps/admin/src/app/globals.css` — oklch tokens + radius scale + new semantic tokens + `:root` (light) and `.dark` (dark) blocks + `@theme inline` updates
- `apps/admin/src/app/layout.tsx` — `<ThemeProvider>` wrap (`attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`) + `suppressHydrationWarning` on `<html>`
- `apps/admin/src/components/DashboardSidebar.tsx` — icon-collapse, footer user menu + theme toggle, grouped nav, icon-bearing `NavLink`
- `apps/admin/src/app/(dashboard)/page.tsx` — KPI grid + chart placeholder + recent-events table
- `apps/admin/src/app/(dashboard)/layout.tsx` — header simplification (the sticky `SidebarTrigger` lives in `sidebar-07`'s shape)
- `apps/admin/src/app/login/page.tsx` — login-03 chrome around iter-16g's form components
- `apps/admin/src/app/set-password/page.tsx` — same chrome treatment
- `apps/admin/package.json` — adds `next-themes`
- `apps/admin/biome.json` — Biome rule banning hex literals outside `globals.css`/`components/ui/`
- `kb/admin-architecture/design-system.md` — §1 tokens table rewritten (light + dark); the dark-only references throughout the doc replaced with "tokens have a light + dark counterpart; both must meet WCAG AA"; new §15 "Blocks adopted"; new §16 "Theme switcher"
- `kb/admin-architecture/ui-stack.md` — Blocks sub-section + `next-themes` row in the stack table
- `kb/admin-architecture/decision-log.md` — four new ADRs

Removed:
- `apps/admin/src/app/(dashboard)/sign-out-button.tsx` — replaced by the user menu in the sidebar footer

## Done when [0/6]

- [ ] `globals.css` matches the shadcn-canonical token shape (oklch + `--radius` scale + full semantic set + chart palette), with **both** a light palette under `:root` and a dark palette under `.dark`. The `design-system.md` tokens table is the live reference for both.
- [ ] Theme toggle (Light / Dark / System) lives in the sidebar footer, persists across reloads via `next-themes`, and `suppressHydrationWarning` + `disableTransitionOnChange` deliver the no-flash cold-load + no-fade toggle behaviour described in shadcn's [Next.js dark-mode guide](https://ui.shadcn.com/docs/dark-mode/next).
- [ ] `DashboardSidebar` collapses to icons on desktop, offcanvas on mobile, and exposes sign-out + the theme toggle via the footer.
- [ ] Dashboard home renders a real KPI grid (counts where available, "—" placeholders elsewhere) with the chart and recent-events sections shaped per `dashboard-01`.
- [ ] Login + set-password show the branded badge + muted-background chrome from `login-03`; the iter-16g form components are unchanged.
- [ ] Before/after screenshots at 375px and 1024px confirm "equivalent or better" on every existing surface in **both** themes; the four vitest-axe component tests are green per theme.
