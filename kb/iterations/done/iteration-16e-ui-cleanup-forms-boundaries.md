---
title: Iteration 16e — UI cleanup pass 2 (forms + boundaries)
type: iteration
order: 17.6
status: done
---

# Iteration 16e — UI cleanup pass 2: forms + boundaries

Continues the iter-16d cleanup, applying the iter-16c design system to: form submission patterns, route-segment boundaries (error / loading / not-found), live regions for server errors, and a single shared `<StatusBadge>`. Plus the first two component tests (small, mechanical) to establish the convention.

**Still no redesigns.** Login page redesign is iter-16g.

Mobile responsiveness applied to the boundary surfaces (loading skeletons, error UI) per the design-system doc.

## Pre-flight

- [x] iter-16c (design system foundation) merged.
- [x] iter-16d (UI cleanup pass 1) merged.

## Scope — `useFormAction()` hook + migrate forms [5/5]

Closes **F-FE-15** (4-form duplicated submit pattern). Lands before iter-17 (services) so the new feature inherits the pattern.

- [x] Add `apps/admin/src/hooks/use-form-action.ts`:

  ```ts
  type ActionResult = { error?: string; message?: string };
  export function useFormAction<I, R extends ActionResult>(
    action: (input: I) => Promise<R>,
    opts?: { onSuccess?: (result: R) => void; refresh?: boolean },
  ): (input: I) => Promise<void>;
  ```

  Behavior: `try { result = await action(input) }`; on `result.error`, `toast.error(result.message ?? "...")`; on success, `toast.success(result.message)`, `opts.onSuccess?.(result)`, `router.refresh()` if `opts.refresh ?? true`. `catch (err)` → generic `toast.error`. (Also added `fallbackErrorMessage` opt during PR review so each form keeps action-specific copy.)
- [x] Migrate `EventForm.tsx`. Remove ~20 lines of try/catch/toast.
- [x] Migrate `InviteUserForm.tsx`.
- [x] Migrate `MessageUserDialog.tsx`.
- [x] Migrate `MessageAssigneesDialog.tsx`. Removes ~80 lines of duplication across the four files.

## Scope — error / loading / not-found boundaries [4/5]

Closes **F-FE-04** (no boundaries; `notFound()` falls through to framework default). Mobile-responsive per DS.

- [x] `apps/admin/src/app/(dashboard)/error.tsx` — client component (`"use client"`), takes `error` + `reset`. Renders friendly "Something went wrong" + "Try again" button calling `reset()`. Uses DS spacing/typography.
- [x] `apps/admin/src/app/(dashboard)/not-found.tsx` — server component for unmatched dashboard routes.
- [x] `apps/admin/src/app/(dashboard)/events/[id]/not-found.tsx` — friendly "Event not found" + back-to-list link. Where `notFound()` actually fires today (line 37).
- [x] `apps/admin/src/app/(dashboard)/events/loading.tsx`, `(dashboard)/users/loading.tsx`, `(dashboard)/events/[id]/loading.tsx` — render header skeleton + `<TableSkeleton>` (or detail-skeleton). Built on `<Skeleton>` from shadcn (vendored in iter-16c). PR review added `aria-busy="true"` + `aria-label` on the loading sections.
- [ ] Manual smoke: visit `/events/<bad-id>` → custom not-found UI. Throw inside a server component → `error.tsx` with working `reset` button. Slow query → skeleton visible during fetch. _(Code-level work landed; in-browser smoke deferred to post-merge.)_

## Scope — form-level server errors as live regions [1/2]

Closes **F-FE-02** (no `role="alert"` / `aria-live` on auth errors). Apply *without redesign* — wrap the existing error spans.

- [x] In `apps/admin/src/app/login/page.tsx` and `set-password/page.tsx`, attach `role="alert"` to the `serverError` paragraph and only render it when the error is truthy. (After PR review: dropped the redundant `aria-live="assertive"` since `role="alert"` already implies assertive announcement and rendered the alert node only when there's content, to avoid empty-region announcements.)
- [ ] Confirm via screen-reader smoke that submitting wrong credentials announces the error. _(Manual SR pass deferred to post-merge.)_

## Scope — shared `<StatusBadge>` consolidation [2/2]

Closes **F-FE-16**. Refactor proactively now since iter-17 will introduce a third status enum.

- [x] Replace `EventStatusBadge.tsx` and the users `StatusBadge.tsx` with one `apps/admin/src/components/StatusBadge.tsx` taking `kind` + `status`. Per-`kind` variant maps co-located in the shared component (a comment notes shared/components is barred from importing features/, so the maps are inlined here and must be kept in sync with each feature's `schema.ts`).
- [x] Update call sites in events + users features.

## Scope — homepage Button rename [2/2]

Closes **F-FE-07**. Tightens the homepage component naming.

- [x] Rename `apps/homepage/src/components/Button.tsx` → `LinkButton.tsx`. Make `href: string` required (drop the `ComponentProps<"a">` open-ended `href`-optional shape). Update homepage call sites. (PR review added `noopener noreferrer` rel hardening for `target="_blank"`.)
- [x] Reserve `Button` for future actual `<button>` elements (none on homepage today; the rationale is captured in `LinkButton.tsx`'s file comment).

## Scope — first component tests + axe [3/3]

Establishes the convention. Small/mechanical tests; the load-bearing trio (LoginPage, EventForm, AssigneesPicker) lands in iter-16g where it pairs with the redesign.

- [x] `apps/admin/src/components/StatusBadge.test.tsx` — renders correct variant for each `kind`/`status` combination; axe-clean.
- [x] `apps/admin/src/features/events/components/DeleteEventConfirm.test.tsx` — open dialog, cancel closes, confirm fires action. Mock the action. Pending state disables Esc per the documented "destructive cannot cancel mid-deletion" pattern. Axe-clean. (PR review: switched axe to `baseElement` so Radix portal markup is included; disabled `aria-hidden-focus` for Radix's intentional focus-trap guards; added explicit `cleanup()` since vitest globals are off.)
- [x] Update `kb/admin-architecture/feature-slice-template.md`: add an "axe-clean" item to the per-iteration verify checklist.

## Scope — EventForm date typing [1/1]

Closes **F-FE-12**.

- [x] Refactor `EventForm.tsx:73` `defaults?.date ?? (undefined as unknown as Date)` to a typed `Date | undefined`. Form-state type permits `date: undefined` mid-edit; resolver enforces required at submit; PR-review follow-up replaced the `data as CreateEventInput` cast with `createEventInput.parse(data)` at the action boundary.

## Verify [1/4]

- [x] `npm run verify` — green.
- [ ] Manual: every form submission (create event, edit event, invite user, message user, message assignees) shows toast on success/error; no duplicated try/catch logic in the form components. _(In-browser pass deferred to post-merge; static check confirms duplication removed.)_
- [ ] Manual: `/events/<bad-id>`, throwing pages, slow loads — each renders the right boundary at mobile + desktop widths. _(Deferred to post-merge.)_
- [ ] Screen-reader smoke: form-level server errors announced from login + set-password. _(Deferred to post-merge.)_

## Out of scope (deliberate)

- **Login page redesign.** iter-16g.
- **Heavy component tests** (LoginPage, EventForm, AssigneesPicker). iter-16g (paired with login redesign).
- **Defense-in-depth security.** iter-16f.
- **Centralizing tokens between admin + homepage.** Out of scope; admin and homepage have separate token sets by design.

## Critical files

New:
- `apps/admin/src/hooks/use-form-action.ts`
- `apps/admin/src/components/StatusBadge.tsx`
- `apps/admin/src/components/StatusBadge.test.tsx`
- `apps/admin/src/features/events/components/DeleteEventConfirm.test.tsx`
- `apps/admin/src/app/(dashboard)/error.tsx`
- `apps/admin/src/app/(dashboard)/not-found.tsx`
- `apps/admin/src/app/(dashboard)/events/[id]/not-found.tsx`
- `apps/admin/src/app/(dashboard)/{events,users}/loading.tsx`
- `apps/admin/src/app/(dashboard)/events/[id]/loading.tsx`
- `apps/homepage/src/components/LinkButton.tsx` (renamed)

Edited:
- All four mutating forms — switch to `useFormAction()`
- `apps/admin/src/app/login/page.tsx` and `set-password/page.tsx` — `role="alert"` wrapper
- Events + users feature files using `EventStatusBadge`/`StatusBadge` — switch to shared component
- `apps/admin/src/features/events/components/EventForm.tsx` — date typing
- Homepage call sites for `Button` → `LinkButton`
- `kb/admin-architecture/feature-slice-template.md` — axe-clean verify item

## Done when [6/6]

- [x] All four forms use `useFormAction()`; ~80 lines of duplication removed.
- [x] Every dashboard segment has the boundary trio (error / not-found / loading) with mobile-responsive UI. (Dashboard root has `error.tsx` + `not-found.tsx`; child segments inherit and add their own `loading.tsx` plus the events-detail `not-found.tsx` where `notFound()` fires.)
- [x] Form-level server errors announce to screen readers via `role="alert"`.
- [x] One `<StatusBadge>` serves all entities; per-`kind` maps documented.
- [x] Homepage `Button` renamed to `LinkButton`; `href` required.
- [x] Audit findings F-FE-02/04/07/12/15/16 closed; first two component tests with axe assertions are green. (F-FE-25 was closed in iter-16d.)
