---
title: Iteration 16d — UI cleanup pass 1 (navigation + data display)
type: iteration
order: 17.5
status: planned
---

# Iteration 16d — UI cleanup pass 1: navigation + data display

Apply the iter-16c design system to the existing admin code in two of the three highest-leverage surfaces: the **sidebar** and the **tables**. Plus a pile of mechanical quick wins flagged by the consolidated frontend audit. **No redesigns** — every change here either swaps a hand-rolled component for a shadcn one, deletes dead code, or applies a documented design-system rule.

Mobile responsiveness lands here for the navigation surface (sidebar offcanvas) and the data surface (tables → stacked cards on mobile, tables on desktop) per the design-system doc.

## Pre-flight

- [ ] iter-16c (design system foundation) merged. `design-system.md` is the contract; vendored `Sidebar`, `Sheet`, `Skeleton` exist; `vitest-axe` installed.
- [ ] iter-16b merged (security headers in place; CSP shape known).

## Scope — adopt official shadcn `Sidebar` [0/4]

Closes **F-FE-05** (mobile nav missing) + **F-FE-06** (no `aria-current`). The hand-rolled `DashboardSidebar.tsx` becomes a thin wrapper over the shadcn composables.

- [ ] Replace `apps/admin/src/components/DashboardSidebar.tsx` with a thin client component wrapping `<SidebarProvider>` + `<Sidebar>` + `<SidebarContent>` + `<SidebarMenu>` / `<SidebarMenuItem>`. One item per current nav entry. Existing `<HasPermission>` gating preserved per item.
- [ ] Each `<SidebarMenuItem>` reads `usePathname()` and applies `aria-current="page"` (and a visible active state — currently missing) when matching.
- [ ] Mount `<SidebarTrigger>` in `apps/admin/src/app/(dashboard)/layout.tsx` so the offcanvas opens on mobile. Layout becomes `<SidebarProvider>` at the root, with the trigger in a small header.
- [ ] Manual smoke at <md width: trigger opens sidebar; tap a link → sidebar closes + navigates; `Cmd+B` toggles on desktop. `aria-current="page"` confirmed via DevTools.

## Scope — replace TanStack Table with semantic `<Table>` + mobile cards [0/3]

Closes **F-FE-03** (TanStack overkill, ~20-30 KB unnecessary client JS). Both tables become server components. Mobile renders as stacked cards per the DS doc.

- [ ] Rewrite `apps/admin/src/features/events/components/EventsTable.tsx` as a server component using `<Table>`/`<TableHeader>`/`<TableBody>`/`<TableRow>`/`<TableCell>` from `components/ui/table.tsx`. Drop `useReactTable`, `flexRender`, `ColumnDef`, `useMemo`, `"use client"`. Add `aria-label="Events"` on the `<Table>`. Render parallel `<div className="md:hidden">…cards…</div>` block — one card per event with label-value rows for date/venue/status/assignees, full row clickable to detail. **Drop the redundant Open ghost-button column** (F-FE-18).
- [ ] Same for `apps/admin/src/features/users/components/UsersTable.tsx`. `aria-label="Users"`. Mobile cards: name/email/role/status. Action menu remains as a kebab on the card.
- [ ] Once neither admin file imports `@tanstack/react-table`, remove the dep from `apps/admin/package.json`.

## Scope — getSession dedup [0/2]

Closes **F-FE-21** (5 files call `auth.api.getSession()`). Use React's `cache()` to dedupe per-request, regardless of Better Auth's internal behavior.

- [ ] In `apps/admin/src/lib/auth.ts`, add:
  ```ts
  import { cache } from "react";
  export const getCachedSession = cache(async () => {
    return auth.api.getSession({ headers: await headers() });
  });
  ```
- [ ] Migrate the 5 call sites: `(dashboard)/layout.tsx`, `(dashboard)/page.tsx`, `(dashboard)/users/page.tsx`, `(dashboard)/events/page.tsx`, `(dashboard)/events/[id]/page.tsx`. Within a single request, identical calls now resolve from React's request-scoped cache.

## Scope — quick wins (single PR or split as convenient) [0/9]

Each item is mechanical, ≤30 min.

- [ ] **F-FE-13**: Replace hardcoded hex in `apps/homepage/src/components/Footer.tsx:14,18,65` (`#EDEAE4`, `#8F8A83`, `#9B958D`) and `ServiceCard.tsx` (`#B8B3AC`) with `var(--foreground)` / `var(--muted-foreground)`. If a shade is genuinely distinct, add it as a new token first.
- [ ] **F-FE-19**: Delete `<Check className="mr-2 size-4 opacity-0" />` at `AssigneesPicker.tsx:132`.
- [ ] **F-FE-23**: Replace Unicode `← All events` at `events/[id]/page.tsx:50` with `<ArrowLeft className="size-4" aria-hidden="true" /> All events`.
- [ ] **F-FE-29**: Refactor `apps/homepage/src/components/EyebrowBadge.tsx` to use `cn()` instead of string-template ternary.
- [ ] **F-FE-22**: Decide on `--radius-m: 16px` per the design-system doc — drop or adopt.
- [ ] **F-FE-08 + EVENT_VIEW**: Add `EVENT_VIEW` to `lib/permissions.ts` (granted to ADMIN and SQUAD_MEMBER); replace the `EVENT_CREATE` gate at `events/[id]/page.tsx:26` with `EVENT_VIEW`. Module-load self-check in `permissions.ts` will catch missing role grants.
- [ ] **F-FE-10**: Drop `useMemo` from `EventsTable.tsx:25`, `UsersTable.tsx:31`, `AssigneesPicker.tsx:38,42`. (EventsTable / UsersTable's `useMemo` goes away when they become server components anyway; AssigneesPicker keeps its client logic but loses the wrapper.)
- [ ] **F-FE-17**: Migrate `app/(dashboard)/sign-out-button.tsx` from manual `useState(pending)` to `useTransition()`; add `toast.error` on signout failure.
- [ ] **F-FE-25**: Fix `MessageAssigneesDialog.tsx:50-52` and `MessageUserDialog.tsx:47-49` form-reset `useEffect` dep array — `[open]` only.

## Scope — mobile-responsive layout polish [0/3]

Apply the DS doc's spacing scale to the existing dashboard chrome. Touches files already being edited above.

- [ ] `(dashboard)/layout.tsx`: page padding becomes `px-4 py-6 md:px-6 md:py-8` per DS. Header bar with sidebar trigger appears on mobile only.
- [ ] `(dashboard)/events/page.tsx`, `events/[id]/page.tsx`, `users/page.tsx`, `(dashboard)/page.tsx`: top-level `<main>` uses the documented spacing. `<h1>` becomes `text-2xl md:text-3xl font-semibold` per DS typography.
- [ ] Manual smoke at 375px width: every dashboard route is usable; no horizontal scroll on the main content area; primary actions reachable.

## Verify [0/5]

- [ ] `npm run verify` — green.
- [ ] `next build --analyze` (or equivalent): admin client bundle no longer contains `@tanstack/react-table`. Confirm `EventsTable` and `UsersTable` are server components.
- [ ] Manual desktop: every dashboard route renders identically to today (visual diff acceptable for the sidebar's new active state and the lost "Open" column).
- [ ] Manual mobile (375px): sidebar offcanvas works, tables render as cards, all pages usable, touch targets ≥ 44px on interactive elements.
- [ ] Screen-reader smoke (VoiceOver / NVDA): sidebar nav announces "current page" on the active item; tables announced with their `aria-label`.

## Out of scope (deliberate)

- **Login page redesign.** Deferred to iter-16g (post-design-system, post-cleanup).
- **Form-pattern extraction (`useFormAction`).** Deferred to iter-16e.
- **Error / not-found / loading boundaries.** Deferred to iter-16e.
- **`StatusBadge` consolidation.** Deferred to iter-16e (rides with form/component test work).
- **Component tests.** Deferred to iter-16e (small) + iter-16g (load-bearing).
- **Defense-in-depth security work** (rate limit, audit log, query-level authz). Deferred to iter-16f.
- **Homepage `Button` rename to `LinkButton`.** Deferred to iter-16e (keeps homepage cleanup together).

## Critical files

Edited:
- `apps/admin/src/components/DashboardSidebar.tsx` — rewritten on top of shadcn `Sidebar`
- `apps/admin/src/app/(dashboard)/layout.tsx` — `<SidebarProvider>` + trigger + responsive padding
- `apps/admin/src/features/events/components/EventsTable.tsx` — server component, semantic `<Table>` + mobile cards
- `apps/admin/src/features/users/components/UsersTable.tsx` — same
- `apps/admin/src/lib/auth.ts` — `getCachedSession()` helper
- `apps/admin/src/app/(dashboard)/{page,users/page,events/page,events/[id]/page}.tsx` — use `getCachedSession`; responsive padding/typography
- `apps/admin/src/features/events/components/AssigneesPicker.tsx` — drop `useMemo`, drop dead `<Check>`, dep array fix
- `apps/admin/src/features/{events,users}/components/Message*Dialog.tsx` — dep array fix
- `apps/admin/src/app/(dashboard)/sign-out-button.tsx` — `useTransition()` + toast
- `apps/admin/src/lib/permissions.ts` — add `EVENT_VIEW`
- `apps/admin/src/app/(dashboard)/events/[id]/page.tsx` — gate by `EVENT_VIEW`; `<ArrowLeft />`
- `apps/admin/src/app/globals.css` — `--radius-m` decision
- `apps/admin/package.json` — drop `@tanstack/react-table`
- `apps/homepage/src/components/{Footer,EyebrowBadge,ServiceCard}.tsx`

## Done when [0/6]

- [ ] Sidebar uses official shadcn `<Sidebar>`; mobile-width admin is usable; active route announces "current page".
- [ ] Both feature tables are server components from semantic `<Table>` primitives; mobile renders as cards; `@tanstack/react-table` removed.
- [ ] `getCachedSession()` is the single entry point; the 5 dashboard files use it.
- [ ] All quick wins merged; no `useMemo` rot; no dead `<Check>`; no Unicode arrow; no redundant Open column; `EVENT_VIEW` is the documented read perm.
- [ ] Every dashboard route works at 375px width with no horizontal scroll; touch targets ≥ 44px.
- [ ] Audit findings F-FE-03/05/06/08/10/13/17/18/19/21/22/23/25/29 all verifiably closed.
