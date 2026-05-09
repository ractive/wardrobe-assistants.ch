---
title: Iteration 16h — Adopt canonical shadcn (new-york + theme-neutral)
type: iteration
order: 17.9
status: done
---

# Iteration 16h — Adopt canonical shadcn (new-york + theme-neutral)

The admin still looks like a wireframe. Stop inventing tokens and chrome — adopt shadcn's canonical **new-york** style end-to-end, including the **`@shadcn/theme-neutral`** palette (light + dark, oklch, full semantic token set, chart palette, radius — verified via the shadcn MCP). Do **not** preserve our custom Bordeaux primary in the admin: full-adoption beats a hybrid here. Brand identity stays on the customer-facing homepage; the admin trades distinctiveness for "looks like every shadcn screenshot, ships polished out of the box."

**Working method:** vendor → run → diff → keep what helps → `git restore` what regresses. The shadcn CLI overwrites our customized files when blocks ship parallel versions; that's fine because the working tree is the safety net. We commit `e9f459f` (this plan) first, then experiment.

> **Tooling.** All shadcn registry work goes through the **shadcn MCP** registered in `.mcp.json` (`mcp__shadcn__list/view/get_examples/get_add/get_audit`). Use `--dry-run --yes` first to preview, then run for real with a clean working tree so `git diff` is the review surface.

## Pre-flight

- [x] iter-16c/d/e/g merged. Login coordinator (`credentials-step.tsx`, `totp-step.tsx`) from iter-16g must survive — anything written under `src/app/login/` by `add login-03` gets cherry-picked, not kept wholesale.
- [x] Working tree clean before each `add` so `git diff` shows exactly what landed.

## Scope — theme

- [x] `npx shadcn@latest add @shadcn/theme-neutral -c apps/admin --overwrite --yes`. Accept the canonical light + dark oklch palette wholesale into `globals.css`. No Bordeaux override block.
- [x] Add `next-themes` and wire per shadcn's [Next.js dark-mode guide](https://ui.shadcn.com/docs/dark-mode/next):
  - `components/ThemeProvider.tsx` — thin wrapper around `NextThemesProvider`.
  - `app/layout.tsx` — `<html lang="en" suppressHydrationWarning>`, `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>`. No custom inline script — `next-themes` injects its own when `attribute="class"`.
- [x] `npx shadcn@latest add @shadcn/mode-toggle -c apps/admin`. Rename to `components/ThemeToggle.tsx` for our PascalCase convention. Anchor in the sidebar footer.

## Scope — blocks (cherry-pick workflow)

For each block: run with `--overwrite`, inspect `git diff`, keep the structural improvements, `git restore` files that regress our customizations (login coordinator, permission gates, server-action wiring).

- [x] **`@shadcn/sidebar-07`** → graft icon-collapse + footer pattern into our `DashboardSidebar.tsx`. Keep our `<HasPermission>` gates around each NavLink. Add the user menu and theme toggle to the footer.
- [x] **`@shadcn/login-03`** → keep only the chrome: muted-bg full-screen flex shell, `max-w-sm` form column, brand-badge link above the form. **Restore** `src/app/login/page.tsx` to the iter-16g coordinator after the add (`git restore src/app/login/page.tsx`); the new chrome wraps it. Do not vendor `login-03/components/login-form.tsx` (uses `Field` primitives + social-login buttons we don't support).
- [x] **`@shadcn/dashboard-01`** → reference only. The `--dry-run` showed it pulls 14 deps (`@dnd-kit/*`, `recharts`, `@tabler/icons-react`, `@tanstack/react-table`, `vaul`) we don't want yet. Run `add` against a scratch branch if you want to see the structure live; otherwise read the source via `mcp__shadcn__get_item_examples_from_registries`. Hand-write `(dashboard)/page.tsx` matching its layout: page header → 4-up KPI grid (1×4 mobile, 2×2 md:, 4×1 xl:) → chart placeholder (use `@shadcn/empty`) → recent-events mini-table (cards on mobile, table on desktop per `design-system.md` §7).
- [x] `npx shadcn@latest add @shadcn/empty -c apps/admin`. Single new file; replaces the planned hand-rolled `<EmptyState>` from `design-system.md` §5.

## Scope — KB updates

- [x] `design-system.md` §1 — replace the hex tokens table with "Tokens are sourced from `@shadcn/theme-neutral`. To re-sync, re-run `npx shadcn@latest add @shadcn/theme-neutral -c apps/admin --overwrite`." Drop "dark-only" language throughout (admin now ships light + dark + system). Update §5 to reference `@shadcn/empty` instead of the planned hand-rolled `<EmptyState>`.
- [x] `ui-stack.md` — note the MCP-first / dry-run-first / commit-then-add workflow.
- [x] `decision-log.md` — single ADR: **"Admin adopts shadcn new-york + theme-neutral wholesale; no token-level brand customization."** Why: every iteration after this gets to track upstream instead of maintaining a parallel design system; brand identity stays on the customer-facing homepage where it matters.

## Verify

- [x] `npm run format` + `npm run verify` green.
- [ ] Light + dark renders correctly at 375px and 1024px on every existing screen (login, set-password, dashboard, users, events). Before/after screenshots in `kb/perf-reports/iter-16h-design-refresh/{light,dark}/`.
- [x] vitest-axe on `DashboardSidebar`, `LoginPage`, `DashboardHome`, `ThemeToggle` — `toHaveNoViolations()` per theme.
- [ ] Cold-load with `localStorage.theme = "dark"` (then `"light"`) shows no flash. Mechanism: `suppressHydrationWarning` + next-themes' built-in pre-hydration script.
- [ ] Theme toggle persists across reloads; system mode reflects OS-level changes without reload.

## Out of scope

- **Bordeaux brand customization in the admin.** Deliberate — see the ADR. Deferred to **iter-16i** (re-applying the Bordeaux override on top of theme-neutral once the canonical baseline has settled). Customer-facing homepage keeps its brand independently.
- **Real charts** (`recharts`, `chart-area-interactive`) — iter-22.
- **TanStack Table for the recent-events list** — `design-system.md` §7 still applies.
- **`@shadcn/signup-XX`** — no public sign-up surface today.
- **`@shadcn/drawer` / `@shadcn/input-otp`** — polish for a future iteration.
- **Server-side theme persistence** — client-only via `next-themes` localStorage.
- **Homepage restyle** — admin-only iteration.
- **i18n on chrome strings** — same exclusion as iter-16g.

## Critical files

New:
- `apps/admin/src/components/ThemeProvider.tsx`
- `apps/admin/src/components/ThemeToggle.tsx` (vendored from `@shadcn/mode-toggle`)
- `apps/admin/src/components/ui/empty.tsx` (vendored from `@shadcn/empty`)
- `apps/admin/src/components/UserMenu.tsx`
- `apps/admin/src/components/ThemeToggle.test.tsx`
- `apps/admin/src/components/DashboardSidebar.test.tsx`
- `kb/perf-reports/iter-16h-design-refresh/{light,dark}/*.png`

Edited:
- `apps/admin/src/app/globals.css` — replaced wholesale by `@shadcn/theme-neutral`
- `apps/admin/src/app/layout.tsx` — `<ThemeProvider>` wrap + `suppressHydrationWarning`
- `apps/admin/src/components/DashboardSidebar.tsx` — icon-collapse + footer (user menu + theme toggle); permission gates preserved
- `apps/admin/src/app/(dashboard)/page.tsx` — KPI grid + empty-chart + recent-events
- `apps/admin/src/app/login/page.tsx` — login-03 chrome around iter-16g coordinator
- `apps/admin/src/app/set-password/page.tsx` — same chrome treatment
- `apps/admin/package.json` — `next-themes`
- `kb/admin-architecture/{design-system,ui-stack,decision-log}.md`

Removed:
- `apps/admin/src/app/(dashboard)/sign-out-button.tsx` — replaced by user menu

## Done when

- [x] `globals.css` is the verbatim `@shadcn/theme-neutral` output; no project-specific tokens.
- [x] Theme toggle (Light / Dark / System) works in the sidebar footer; no flash on cold load.
- [x] Sidebar collapses to icons on desktop, offcanvas on mobile; permission gates intact.
- [x] Dashboard home matches `dashboard-01`'s layout shape (without its dependency bundle); login + set-password use `login-03` chrome around the iter-16g form bodies.
- [x] Single ADR documents the "adopt over invent" stance; `design-system.md` and `ui-stack.md` reflect the upstream-tracked baseline.
