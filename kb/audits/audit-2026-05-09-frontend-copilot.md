---
title: Frontend / UI audit — GitHub Copilot — 2026-05-09
type: audit
status: source
reviewer: github-copilot
created: 2026-05-09
tags: [audit, frontend, ui, react, shadcn, tailwind, accessibility]
---

# Frontend / UI audit — GitHub Copilot — 2026-05-09

Verbatim output as provided by user 2026-05-09. Original markdown formatting was lightly mangled in transit; preserved as received. Used as a source document for the consolidated frontend audit.

---

# Frontend Architecture & UI Quality Review — wardrobe-assistants.ch (admin + homepage)

**Date:** 2026-05-09
**Scope:** `apps/admin/` · `apps/homepage/` (UI layer only — server infrastructure reviewed separately)
**Stack:** Next.js 16 · React 19 · TypeScript · shadcn/ui · Tailwind CSS · Radix · Vitest

## 1. Executive Summary

The frontend is clean, purposefully small, and architecturally sound for its stage. RSC/client boundaries are applied correctly, the design-token approach is consistent inside the admin app, and the shadcn/ui composition patterns are textbook. The main gaps are:

- **Login page** is out of sync with the rest of the design system (raw inputs, raw button, no `role="alert"` on errors).
- **TanStack Table** is loaded for simple, non-interactive read-only tables — it adds client bundle weight for zero user benefit.
- **No `loading.tsx`, `error.tsx`, or `not-found.tsx`** files exist anywhere; all server component fetches hang silently on slow networks.
- **No React component or UI tests** — coverage is 100% server-side.
- **Sidebar is desktop-only** with no mobile navigation for the admin dashboard.
- **Homepage** has scattered hardcoded hex values that should be CSS variables.

None of these are critical blockers, but they represent the clearest next improvement surface.

## 2. Overall Frontend Architecture Assessment

| Area | Grade | Notes |
|---|---|---|
| RSC/client split | ✅ A | Server handles auth, data, permissions; client only where interaction needed |
| shadcn/ui usage | ✅ A- | Correct dialog/form/dropdown patterns; one consistency gap in login page |
| Design tokens | ✅ B+ | Admin: consistent; homepage: ~15% hardcoded hex |
| Tailwind discipline | ✅ B+ | Mobile-first, default breakpoints, consistent `cn()` usage (with one exception) |
| Accessibility | ⚠️ B- | Good bones but missing `aria-current`, `role="alert"`, screen-reader table labels |
| Performance | ⚠️ B | TanStack Table overkill; no Suspense boundaries; no streaming |
| Testing | ❌ C | Zero component or UI tests |
| Loading/error UX | ❌ C | No loading states, error boundaries, or 404 page |

## 3. Top 10 Frontend/UI Issues

1. **Login page bypasses the design system** — raw `<input>` / `<button>` instead of `<Input>` / `<Button>` from shadcn. Focus ring, accessibility, and visual language all drift.
2. **Server errors on login have no `role="alert"`** — screen readers won't announce sign-in failure.
3. **TanStack Table loaded for trivial read-only tables** — both `UsersTable` and `EventsTable` use `@tanstack/react-table` with no sorting, filtering, or pagination, shipping ~20-30 KB of JS unnecessarily.
4. **No `loading.tsx`, `error.tsx`, or `not-found.tsx`** — uncaught server-component errors crash silently; slow fetches show a blank page.
5. **No mobile navigation for admin dashboard** — sidebar is `hidden md:block` with no mobile alternative; admin is unusable on phones.
6. **`aria-current` missing on active sidebar links** — keyboard and screen reader users cannot identify which page they are on.
7. **`AssigneesPicker` renders a permanently invisible `<Check>` icon** — `<Check className="mr-2 size-4 opacity-0" />` is always invisible; it was presumably meant for selected items but the list only shows unassigned users.
8. **`EventDetailPage` uses `EVENT_CREATE` permission to gate viewing** — semantically wrong; view access should not require create permission.
9. **Homepage hardcoded hex colors** — `#8F8A83`, `#9B958D`, `#B8B3AC` in `Footer.tsx` and `ServiceCard.tsx` should use CSS variables.
10. **No React component tests** — the entire UI layer is untested; a refactor could silently break forms, dialogs, or permission gates.

## 4. Findings Table

| ID | Severity | Category | File(s) | Problem | Why it matters | Recommended fix |
|---|---|---|---|---|---|---|
| UI-01 | High | Design system / A11y | `apps/admin/src/app/login/page.tsx` | Raw `<input>` and `<button>` used instead of shadcn `<Input>` and `<Button>` | Loses focus-ring, consistent disabled state, and Radix-managed accessibility | Replace with shadcn primitives; extract a shared `LoginForm` component |
| UI-02 | High | Accessibility | `apps/admin/src/app/login/page.tsx` | `serverError` state rendered in a plain `<p>` with no `role="alert"` | Screen readers won't announce auth failure; users may not know sign-in failed | Add `role="alert"` and `aria-live="assertive"` to the error paragraph |
| UI-03 | Medium | Performance / Bundle | `UsersTable.tsx`, `EventsTable.tsx` | TanStack Table imported for read-only, non-sortable, non-paginated tables | Ships ~20–30 KB of client JS with no user-facing benefit | Replace with plain semantic `<table>` + shadcn table primitives; remove `@tanstack/react-table` from client bundle |
| UI-04 | Medium | UX / Error handling | Entire `(dashboard)/` subtree | No `loading.tsx`, `error.tsx`, or `not-found.tsx` files | Slow fetches show blank pages; server errors are uncaught; 404s show the Next.js default | Add `(dashboard)/loading.tsx`, `(dashboard)/error.tsx`, and `app/not-found.tsx` |
| UI-05 | Medium | Accessibility / Mobile | `DashboardSidebar.tsx` | Sidebar hidden on mobile (`hidden md:block`) with no fallback navigation | Admin is entirely inaccessible on small screens | Add a top-bar mobile nav or a responsive sheet-based sidebar |
| UI-06 | Medium | Accessibility | `DashboardSidebar.tsx` | No `aria-current="page"` on the active navigation link | Screen reader users and keyboard users cannot identify the current page | Mark active link with `aria-current="page"` using `usePathname()` |
| UI-07 | Low | Bug / UX | `AssigneesPicker.tsx` | `<Check className="mr-2 size-4 opacity-0" />` is permanently invisible | Dead code; was likely intended to show a checkmark for selected items but the list only shows unassigned users | Remove the invisible icon or implement visible selection state |
| UI-08 | Low | Authz semantics | `events/[id]/page.tsx` line 26 | `userHasPermission("EVENT_CREATE")` used to gate the view-detail page | Wrong permission label; could cause future access regressions | Introduce an `EVENT_VIEW` permission for read access |
| UI-09 | Low | Design tokens | `Footer.tsx`, `ServiceCard.tsx` | Hardcoded hex values: `#8F8A83`, `#9B958D`, `#B8B3AC` | Breaks token consistency; colours cannot be updated centrally | Map to `var(--muted-foreground)` or equivalent |
| UI-10 | Low | Tailwind class composition | `EyebrowBadge.tsx` | Conditional className built via string template literals | Fragile; misses purge safety; inconsistent with `cn()` used elsewhere | Use `cn()` |
| UI-11 | Low | Accessibility | `UsersTable.tsx`, `EventsTable.tsx` | No `aria-label` on the `<Table>` element | Tables have no announced description for screen readers | Add `aria-label="Users"` / `aria-label="Events"` |
| UI-12 | Low | Redundant UX | `EventsTable.tsx` | Both the event name (link) and an "Open" button navigate to the same detail URL per row | Redundant interaction; visual clutter; extra tab stop | Remove the "Open" ghost button column |
| UI-13 | Low | Testing | All feature components | Zero React component or UI integration tests | A refactor to forms, dialogs, or permission gates could silently break | Vitest + Testing Library tests for `EventForm`, `UsersTable`, `DeleteUserConfirm`, login flow |
| UI-14 | Low | A11y / Login UX | `login/page.tsx` | Two-step form (credentials → TOTP) transitions without focus management | Users on keyboard or AT may be disoriented after step transition | `useEffect` + `ref.focus()` on transition |

## 5. React Architecture Review

### What works well

- RSC/client split is correct throughout the dashboard.
- `Promise.all` for parallel permission checks in `EventDetailPage`.
- Controlled dialogs with state hoisted to the parent.
- `useTransition` used correctly in `AssigneesPicker`.
- `router.refresh()` after mutations.

### Issues

- **UI-01**: Login page is entirely disconnected from the design system.
- **UI-08**: Wrong permission used to gate event detail view (`EVENT_CREATE`).
- **Duplicate auth guard**: Layout calls `auth.api.getSession()`; pages also call it. Pages don't need it — adds latency.

## 6. shadcn/ui Review

### What works well

- Dialogs use `DialogTitle` and `DialogDescription`.
- `DialogTrigger asChild` throughout.
- `FormField` / `FormControl` / `FormMessage` chain in `EventForm` / `InviteUserForm`.
- `DropdownMenuTrigger asChild` on icon buttons.
- `CommandInput` / `CommandList` / `CommandEmpty` correctly composed in `AssigneesPicker`.

### Issues

- **UI-07**: Dead `<Check opacity-0>` icon in `AssigneesPicker` line 132.
- **UI-01**: Login page hand-rolls form layout, label/input/error structure, and submit button instead of using `Form`/`FormField`/`Input`/`Button`.
- **Button used as `<Link>` with an emoji arrow** in `events/[id]/page.tsx` line 49: `<Link href="/events">← All events</Link>` — Unicode arrow read by screen readers as "left arrow all events." Use `<ArrowLeft />` from Lucide instead.

## 7. Tailwind / CSS Review

### Strengths

- `globals.css` is minimal and clean.
- Admin uses CSS variable references almost exclusively.
- Default Tailwind breakpoints; mobile-first.
- Transitions use `duration-200` / `transition-colors` consistently.

### Issues

- **`--radius-m: 16px`** defined in `globals.css` but most components use `rounded-md` (Tailwind default 6px). The token appears unused. Either remove it or adopt it consistently.
- **UI-09**: Homepage hardcoded hex values.
- **UI-10**: String concatenation instead of `cn()` in homepage `EyebrowBadge`.
- No dark-mode variants — admin is dark-only by design; if that changes, no scaffolding.
- Login page input className string is copy-pasted across email/password/TOTP fields.

## 8. Accessibility Review

### Strengths

- `<nav aria-label="Primary">` on sidebar.
- `aria-label` on `UserActionsMenu` trigger.
- `aria-label` on AssigneesPicker unassign buttons.
- `DialogTitle` / `DialogDescription` on all dialogs.
- Homepage custom SVG icons carry `aria-hidden="true"`.
- Sr-only "Actions" column header.

### Issues

- **UI-02**: No `role="alert"` on login server errors.
- **UI-06**: No `aria-current="page"` on active sidebar links.
- **UI-14**: Focus not moved to step 2 on login transition.
- **UI-11**: Tables have no accessible label.
- **UI-05**: Admin dashboard inaccessible on mobile.
- Login form inputs lack `aria-describedby` for field-level errors.

## 9. Performance Review

### Strengths

- Server components fetch data on the server; no `useEffect` data fetching.
- `router.refresh()` replaces full client navigations.
- Homepage uses inline SVGs instead of `lucide-react` to avoid the legacy-polyfill Lighthouse hit.
- `useTransition` in `AssigneesPicker`.

### Issues

- **UI-03**: TanStack Table for read-only static data. Both tables forced to "use client"; ~20-30 KB of unnecessary JS.
- No Suspense boundaries or `loading.tsx`. Slow DB query → blank shell.
- **`useMemo` on static column definitions** in `EventsTable` with empty dep array — no-op overhead. Define columns at module level if component stays client-side.

## 10. Design System Consistency Review

### Strengths

- Admin CSS variables consistent.
- `rounded-md` / `border` / `bg-[var(--card)]` patterns repeat uniformly.
- `text-[var(--muted-foreground)]` for secondary text.
- Badge variants used consistently.
- Lucide icons at `size-4` / `h-4 w-4`.

### Issues

- Login page diverges from the design system (different focus style, no `focus-visible:ring-2`).
- `--radius-m` token defined but unused.
- Homepage tokens not aligned with admin tokens (different names like `--primary-on-dark`; some hardcoded hex).
- EventsTable redundant "Open" action column duplicating the name link.

## 11. Test Coverage Review

### What exists

| File | Type |
|---|---|
| `features/events/schema.test.ts` | Unit — Zod schema |
| `features/events/server/actions.test.ts` | Unit — server actions |
| `features/events/server/events.smoke.test.ts` | Smoke — real DB path |
| `features/users/schema.test.ts` | Unit — Zod schema |
| `features/users/server/actions.test.ts` | Unit — server actions |
| `features/users/server/users.smoke.test.ts` | Smoke — real DB path |
| `lib/permissions.test.ts` | Unit — permission logic |
| `lib/login-schema.test.ts` | Unit — Zod schema |
| `test/http-harness.test.ts` | Integration harness |
| `middleware.test.ts` | Unit — middleware |

### What is missing

- Zero React component tests
- No form interaction tests
- No dialog open/close tests
- No keyboard navigation tests
- No accessibility assertion tests
- No loading/error state tests

### Recommended additions (priority order)

1. `LoginPage` — submit valid/invalid credentials, error announcement, TOTP step transition.
2. `EventForm` — required field validation, date picker interaction, successful submit, server error display.
3. `DeleteUserConfirm` / `DeleteEventConfirm` — confirm dialog renders, cancel closes, confirm calls action.
4. `UsersTable` / `EventsTable` — renders rows, renders empty state.
5. `DashboardSidebar` — active link `aria-current` (once implemented).

## 12. Refactoring Opportunities

### Quick wins (< 1 day each)

| Item | Effort | Benefit |
|---|---|---|
| Add `role="alert"` to login server errors | Tiny | A11y |
| Add `aria-current="page"` to sidebar links | Small | A11y |
| Add `aria-label` to both Table elements | Tiny | A11y |
| Remove dead `<Check opacity-0>` from AssigneesPicker | Tiny | Code clarity |
| Remove redundant "Open" column from EventsTable | Tiny | UX + simplicity |
| Replace homepage hex literals with CSS variables | Small | Token consistency |
| Fix `EyebrowBadge` to use `cn()` | Tiny | Tailwind consistency |
| Move duplicate auth-check from pages to layout only | Small | Performance |
| Fix `EVENT_CREATE` → correct view permission | Small | Semantic correctness |

### Medium investments (1–3 days each)

| Item | Effort | Benefit |
|---|---|---|
| Replace TanStack Table with plain semantic tables | Medium | ~20-30 KB bundle reduction; tables become server components |
| Refactor login page to use shadcn primitives | Medium | DS consistency; better a11y; less duplicated CSS |
| Add `loading.tsx` and `error.tsx` for dashboard group | Medium | UX |
| Add `not-found.tsx` | Small | UX |
| Mobile navigation for admin dashboard | Medium | A11y / mobile usability |

### Larger architectural investments (3+ days)

| Item | Effort | Benefit |
|---|---|---|
| Component tests for all forms and dialogs | Large | Refactor safety net |
| Suspense + streaming on dashboard data pages | Large | Perceived performance |
| Implement `EVENT_VIEW` permission and audit all page gates | Medium | Semantic correctness |

## 13. Components To Be Redesigned / Restructured

- **`login/page.tsx`** — replace raw input/button with shadcn primitives; wrap fields in `Form`/`FormField`; `role="alert"` on server error; focus management on step transition; extract `<CredentialsStep>` and `<TotpStep>` sub-components.
- **`EventsTable.tsx` and `UsersTable.tsx`** — remove TanStack Table; use shadcn `<Table>` directly; become server components.
- **`DashboardSidebar.tsx`** — extract `SidebarLink` client sub-component using `usePathname()`; add mobile nav sheet.

## 14. Quick Wins vs Larger Architectural Improvements

### Quick wins (single PR)

1. `role="alert"` on login server error.
2. `aria-label` on `<Table>` elements.
3. Remove dead `<Check opacity-0>` in `AssigneesPicker`.
4. Remove redundant "Open" column from `EventsTable`.
5. Fix `EyebrowBadge` to use `cn()`.
6. Replace homepage hex with CSS variables.
7. Remove duplicate `auth.api.getSession()` calls from pages.
8. Fix `EVENT_CREATE` permission gate on event detail view.

### Larger architectural improvements (planned iterations)

1. Login page redesign — shadcn primitives, focus management, step extraction.
2. Remove TanStack Table — replace with semantic tables, ship less JS.
3. Add `loading.tsx` / `error.tsx` / `not-found.tsx`.
4. Mobile admin navigation.
5. `aria-current` on sidebar via client wrapper.
6. Component and UI tests.
