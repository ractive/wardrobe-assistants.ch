# Frontend Architecture & UI Quality Review — wardrobe-assistants.ch (admin + homepage)

**Date:** 2026-05-09  
**Scope:** `apps/admin/` and `apps/homepage/` frontend/UI layers  
**Stack:** Next.js 16 · React 19 · TypeScript · shadcn/ui · Tailwind CSS · Radix UI · Vitest

---

## 1) Executive summary

The frontend is generally well-structured and production-minded, with strong server/client boundaries, good use of shadcn primitives in most admin features, and consistent tokenized styling in the admin app. The biggest quality gaps are not foundational architecture issues, but **consistency and completeness issues** that will matter over time:

- The login surface diverges from the shadcn/form architecture used elsewhere.
- No route-level `loading.tsx` / `error.tsx` / `not-found.tsx` fallbacks are present.
- Tables are implemented as client components with TanStack for mostly static rendering use-cases.
- Accessibility is mostly solid, but there are concrete misses (error announcements, active-nav semantics, table labelling, mobile nav coverage).
- UI test coverage is heavily backend-skewed; component/integration tests are missing.

Overall: **good architecture baseline**, **medium maintainability risk** if consistency gaps and missing UI safety nets are not addressed.

---

## 2) Overall frontend architecture assessment

### Strengths

- **Clear RSC-first approach** in admin routes:
  - Auth and permission checks happen server-side before rendering protected surfaces.
  - Data fetching is server-side in route pages, with client components used for interactive islands.
- **Feature-slice organization** (`features/events`, `features/users`) gives good boundaries.
- **UI primitives are centralized** under `apps/admin/src/components/ui` and mostly reused correctly.
- **Form validation strategy is coherent** (Zod schemas + React Hook Form + server re-validation in actions).

### Weaknesses

- **Inconsistent UI architecture on auth pages** (`login/page.tsx` bypasses shared form primitives).
- **Missing route error/loading boundaries** increases UX and resiliency risk.
- **Some client-heavy rendering where server-rendering is sufficient** (read-only table surfaces).
- **No frontend regression test layer** for dialogs/forms/navigation.

---

## 3) Top 10 frontend/UI issues

1. **Missing `loading.tsx`, `error.tsx`, and `not-found.tsx` route fallbacks** for dashboard/admin surfaces.  
2. **Login page bypasses shared shadcn form primitives**, creating design and accessibility drift.  
3. **TanStack table usage for mostly static/read-only table rendering** introduces avoidable client JS and complexity.  
4. **No active-nav semantics (`aria-current`)** in dashboard navigation links.  
5. **Desktop-only sidebar with no mobile navigation fallback** (`hidden md:block`) harms usability/accessibility on smaller viewports.  
6. **Login/server form errors are not announced via `role="alert"`/live region**, reducing SR feedback quality.  
7. **Table elements lack explicit accessible naming context** in important data views.  
8. **Permission naming mismatch** (`EVENT_CREATE` used to gate event detail viewing) weakens long-term auth clarity.  
9. **Dead/invisible UI indicator in assignee picker (`opacity-0` check icon)** suggests stale UX logic.  
10. **No React component/integration tests** for critical interactive flows (dialogs/forms/tables).

---

## 4) Findings table

| Severity | Category | File(s) | Problem | Why it matters | Recommended improvement |
|---|---|---|---|---|---|
| High | Error handling / App Router UX | `apps/admin/src/app/(dashboard)/**` | No `loading.tsx`, `error.tsx`, `not-found.tsx` fallbacks found | Poor resilience and user feedback on slow/failing routes | Add route-segment loading/error/not-found UIs with consistent shell |
| High | Design-system consistency | `apps/admin/src/app/login/page.tsx` | Login uses custom raw inputs/buttons instead of shared `components/ui` form primitives | Style drift, duplicated validation/error patterns, harder maintenance | Refactor to shared `Form`, `Input`, `Button`, `FormMessage` stack |
| Medium | Performance / architecture | `apps/admin/src/features/users/components/UsersTable.tsx`, `.../events/components/EventsTable.tsx` | Client-side TanStack setup for mostly read-only rendering | Additional JS/hydration cost and abstraction overhead | Prefer server-rendered table markup unless sorting/filtering/pinning is needed |
| Medium | Accessibility | `apps/admin/src/components/DashboardSidebar.tsx` | No active-route indication (`aria-current`) | SR/keyboard users lose location context | Add active state + `aria-current="page"` |
| Medium | Responsive UX | `apps/admin/src/components/DashboardSidebar.tsx` | Sidebar hidden below `md` and no mobile nav alternative | Navigation can be inaccessible on mobile widths | Add mobile nav sheet/menu equivalent |
| Medium | Accessibility | `apps/admin/src/app/login/page.tsx` | Server/form errors rendered without live-region semantics | Errors may not be announced to assistive tech | Use `role="alert"` and proper `aria-describedby` links |
| Low | Accessibility | `apps/admin/src/features/users/components/UsersTable.tsx`, `.../EventsTable.tsx` | Data table context labeling is minimal | Weak SR context for table purpose | Add clear table labels/captions where helpful |
| Low | Authorization clarity | `apps/admin/src/app/(dashboard)/events/[id]/page.tsx` | `userHasPermission("EVENT_CREATE")` gates viewing page | Permission semantics become misleading and brittle | Introduce/align to explicit “view event” permission intent |
| Low | UI correctness | `apps/admin/src/features/events/components/AssigneesPicker.tsx` | Invisible check icon (`opacity-0`) appears as dead state artifact | Confusing/unused visual logic | Remove or wire selected-state feedback correctly |
| Medium | Testing quality | `apps/admin/src/**/*.test.ts*` (overall) | Tests focus on schemas/server actions; minimal UI interaction testing | High risk of UI regressions | Add Testing Library tests for dialogs/forms/nav keyboard flows |

---

## 5) React architecture review

### Confirmed strengths

- **RSC + Client component boundaries are mostly correct**:
  - Server pages do auth/permission/data fetches (`headers()`, `redirect`, `notFound`, server queries).
  - Client-only interactivity is isolated into local components (`EventDialog`, `InviteUserDialog`, action menus, forms).
- **State placement is generally sensible**:
  - Dialog open/close state localized.
  - Form state managed by React Hook Form.
  - Mutations followed by `router.refresh()` for server source-of-truth syncing.
- **Async patterns are mostly safe**:
  - `useTransition` used for async assign/unassign flows.

### Confirmed issues

#### A) Unnecessary client-side table abstraction

- `UsersTable.tsx` and `EventsTable.tsx` are `"use client"` + TanStack React Table, despite simple, deterministic rendering.
- If advanced table features are not required, this can become server-rendered markup with lower hydration cost.

#### B) Login surface is architecturally isolated from shared form system

- `apps/admin/src/app/login/page.tsx` hand-rolls form labels/inputs/error rendering.
- This duplicates responsibilities already solved by shared form primitives and creates inconsistent behavior.

#### C) Suspense/error boundary coverage gaps

- No route-level `loading.tsx` / `error.tsx` boundaries in reviewed app routes.
- Long fetches or thrown errors degrade UX and maintainability.

---

## 6) shadcn/ui review

### What is done well

- **Dialog composition is correct** in reviewed components:
  - `Dialog` + `DialogTrigger asChild` + `DialogContent` + `DialogHeader` + `DialogTitle` + `DialogDescription`.
- **Form composition is strong** in event/user feature forms:
  - `Form`, `FormField`, `FormControl`, `FormMessage` used as intended.
- **Dropdown/Popover/Command primitives** are used with expected structure and semantic wrappers.
- `cn()` utility is used in several core components and forms correctly.

### Concrete issues

1. **Inconsistent primitive usage on login page** (raw HTML controls instead of shared UI primitives).
2. **Inconsistent class composition style in homepage components** (string interpolation vs. `cn()`).
3. **Dead visual affordance in command list item (`Check` icon kept invisible)** in `AssigneesPicker`.

### Accessibility regression risk areas from customization

- Any custom overrides that bypass generated primitive behavior (as in login page controls) are higher-risk than direct primitive use.

---

## 7) Tailwind/CSS review

### Strengths

- Admin global token setup is clean and compact (`apps/admin/src/app/globals.css`).
- Good use of CSS vars in utility classes (`text-[var(--muted-foreground)]`, `border-[var(--border)]`, etc.).
- Responsive patterns are conventional and maintainable (`sm/md/lg` mobile-first classes).

### Confirmed issues

1. **Hardcoded color values still exist** in homepage components (not fully tokenized).
2. **Class composition inconsistency** (template string concatenation in places that should use `cn`).
3. **Potential class bloat/duplication in login page** due to manually repeated input/button styling.
4. No explicit reduced-motion strategy surfaced in reviewed frontend components.

---

## 8) Accessibility review

### Positive findings

- Semantic structure is generally acceptable across dashboard pages and dialogs.
- Dialogs include title + description patterns expected by Radix/shadcn.
- Action icon buttons commonly include `aria-label` (e.g., user actions menu trigger).
- Navigation container uses `nav` and label in sidebar.

### Confirmed issues

1. **Error announcement gap** in login forms:
   - Error messages are visible but lack robust live-region semantics.
2. **Active navigation semantics missing**:
   - Sidebar links do not expose current route with `aria-current="page"`.
3. **Mobile navigation access gap**:
   - Hidden sidebar without replacement can strand keyboard/touch users.
4. **Table context can be stronger**:
   - Add captions/labels for SR orientation in management tables.

---

## 9) Performance review

### Positive findings

- Server-side auth/data gating minimizes client fetch churn in dashboard pages.
- Client islands are used for interaction-heavy pieces (dialogs/menus/forms), not entire pages.
- Homepage icon strategy explicitly considers bundle/runtime cost.

### Risks / opportunities

1. **TanStack client tables likely overkill** for current feature set.
2. **Missing loading boundaries** delays meaningful feedback on slow routes.
3. **No explicit lazy-loading strategy** for potentially heavy interactive modules (if growth continues).
4. Some minor unnecessary memoization patterns should be audited for net benefit.

---

## 10) Design system consistency review

### Consistent patterns

- Admin: spacing, typography weights, tokenized colors, and card/border motifs are fairly coherent.
- Button/input visual language is mostly consistent where shared primitives are used.

### Drift areas

1. **Login page style system drift** from rest of admin UI stack.
2. **Homepage token adherence is partial** due to hardcoded colors in places.
3. **Navigation state feedback inconsistency** (hover states present; active state semantics weaker).

---

## 11) Test coverage review

### Current state

- Strong coverage for:
  - schemas,
  - server actions,
  - permissions,
  - smoke tests via HTTP harness.

### Missing critical frontend coverage

- No meaningful React component interaction tests for:
  - dialogs (`EventDialog`, `InviteUserDialog`, destructive confirms),
  - forms (`EventForm`, `InviteUserForm`, login flow),
  - keyboard navigation,
  - a11y assertions (alert announcements, focus transitions, menu/dialog keyboard behavior).

### Why this matters

The most fragile UI behavior currently lacks automated verification, increasing regression risk with future refactors.

---

## 12) Refactoring opportunities

### Near-term (high impact, low-medium effort)

1. Add route-segment `loading.tsx` and `error.tsx` in dashboard app tree.
2. Add `not-found.tsx` for admin app.
3. Refactor login page to shared form primitives/components.
4. Add active-link semantics (`aria-current`) in sidebar nav.
5. Introduce mobile navigation pattern for dashboard.

### Medium-term (performance and maintainability)

6. Reevaluate TanStack usage for basic tables; migrate to server-rendered tables if advanced interactions are not planned.
7. Finish tokenization pass in homepage components (remove hardcoded color literals).
8. Normalize class composition through `cn()` and variant abstractions.

### Testing improvements

9. Add Testing Library suites for core dialogs/forms/navigation.
10. Add keyboard-focused and accessibility assertions in interactive tests.

---

## 13) Components that should be redesigned/restructured

### High-priority

- **`apps/admin/src/app/login/page.tsx`**
  - Rebuild with shared form primitives and reusable field/error patterns.

- **`apps/admin/src/components/DashboardSidebar.tsx`**
  - Add active state semantics + mobile equivalent nav surface.

### Performance-driven restructuring candidates

- **`apps/admin/src/features/users/components/UsersTable.tsx`**
- **`apps/admin/src/features/events/components/EventsTable.tsx`**
  - Consider server-rendered markup approach if table interactivity remains simple.

### Cleanup candidate

- **`apps/admin/src/features/events/components/AssigneesPicker.tsx`**
  - Remove stale invisible check indicator or implement visible selected-state logic.

---

## 14) Quick wins vs. larger architectural improvements

### Quick wins (can be delivered quickly)

- Add `loading.tsx` / `error.tsx` / `not-found.tsx` route fallbacks.
- Add `aria-current` to sidebar active link.
- Add `role="alert"` and stronger `aria-describedby` handling for login errors.
- Remove dead/invisible icon logic in assignee picker.
- Replace remaining hardcoded homepage colors with tokens.
- Add explicit table labels/captions.

### Larger improvements (higher effort, strategic)

- Refactor auth/login flow UI into shared design-system-driven form components.
- Rework table architecture to reduce client JS where advanced table features are unnecessary.
- Build a dedicated frontend interaction test suite (forms/dialogs/nav/a11y keyboard flows).

---

## Appendix: representative code references

### Missing route fallback files

- No `loading.tsx` / `error.tsx` / `not-found.tsx` discovered in reviewed admin route segments.

### Desktop-only sidebar

- `apps/admin/src/components/DashboardSidebar.tsx`

```tsx
<aside className="hidden w-48 shrink-0 border-[var(--border)] border-r px-3 py-6 md:block">
```

### Login custom controls (design drift)

- `apps/admin/src/app/login/page.tsx`

```tsx
<input
  type="email"
  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--ring)]"
  {...credentialsForm.register("email")}
/>
```

### Event detail permission semantic mismatch

- `apps/admin/src/app/(dashboard)/events/[id]/page.tsx`

```tsx
const canView = await userHasPermission("EVENT_CREATE");
```

### Dead invisible icon state

- `apps/admin/src/features/events/components/AssigneesPicker.tsx`

```tsx
<Check className="mr-2 size-4 opacity-0" />
```

