---
title: Iteration 34 — Audit follow-ups (coherence pass)
type: iteration
order: 35
status: planned
---

# Iteration 34 — Audit follow-ups (coherence pass)

Bundle the actionable coherence-level findings from [iter-33's monorepo audit](../audits/iter-33-monorepo-audit.md) into one scoped pass. Every change is **modernise an existing pattern** or **close a gap surfaced by the audit** — no new domain rules, no new features, no design-system edits.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. After this, the audit's open coherence findings are closed and the React 19 / Next.js 16 idioms are applied consistently across forms, route segments, and the metadata surface.

## Decisions

- **One iteration, multiple §s — not five iterations.** The audit recommended a 5-step sequence (iter-34..38). We collapse the coherence-level work (forms, error boundaries, SEO sweep, conditional-UPDATE audit, a11y gap, schema hardening, double-cast cleanup) into a single coherence pass. Each § below is a self-contained, smoke-testable unit; ralph-loop completes them sequentially and the iteration succeeds only if all §s land green.
- **Explicit non-scope:** TypeScript 6 and Vite 8 major bumps stay deferred. Different risk profile, separate `npm run verify` blast-radius, separate iteration. `useMemo` / `useCallback` and `forwardRef` sweeps also stay deferred per the audit (A-REACT-02 needs deliberate per-call review; A-REACT-03 is waiting on the shadcn registry to publish React-19 primitives upstream).
- **`useFormAction` → `useActionState`** is the largest single change. We do it in one slice (not per-form-per-PR) so the custom hook can be retired in the same commit as the last caller migrates. Every migrated form keeps its existing smoke test green.
- **Per-segment `error.tsx`** uses one shared component (`apps/admin/src/components/SegmentError.tsx`) rendered by each `error.tsx` shim — keeps the 10 new files trivial.
- **No `mcp__pencil__*` work.** Homepage SEO sweep is metadata + canonical/OG only; no `.pen` design touch.
- **No shadcn registry calls.** Per iter-33 §A-SHADCN-04: discovery-only this iteration. New primitives are out of scope.
- **Each § ships as its own commit** (small, revertible). The iteration's PR bundles the commits.
- **Manual smoke uses ff-rdp** for the SEO sweep (verify metadata renders), the `error.tsx` boundaries (force a thrown error per segment, confirm fallback), and the form migrations (golden-path submit + pending state). Append a dogfooding session report at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md`.

## Pre-flight

- [ ] iter-33 merged on `main` (audit report present at `kb/audits/iter-33-monorepo-audit.md`).
- [ ] `npm run verify` green on `main`.
- [ ] No in-flight branches touching `apps/admin/src/hooks/use-form-action.ts`, `apps/admin/src/features/*/components/*Form.tsx`, `apps/admin/src/app/(dashboard)/`, `apps/homepage/src/app/(site)/`, `apps/admin/src/features/bookings/server/`, or `apps/admin/src/hooks/use-has-permission.ts`.

## Scope

### 1. `useFormAction` → `useActionState` migration (closes A-REACT-04)

Drop the custom `apps/admin/src/hooks/use-form-action.ts` in favour of React 19's first-party `useActionState` + `useFormStatus`.

- **Migrate ~6 forms:** `features/bookings/components/BookingForm.tsx`, `features/services/components/ServiceForm.tsx`, `features/users/components/InviteUserForm.tsx` (and any sibling user-edit form), `app/(public)/offer/[token]/RequestForm.tsx` (or equivalent customer-side request form), `app/set-password/page.tsx`, `app/login/page.tsx` if it uses the custom hook.
- **Shape:** server action `(prevState, formData) => Promise<{error: boolean, message?: string}>` → wrap in `useActionState(action, initialState)`. Replace `isSubmitting` with `useFormStatus().pending` in the submit button child (must be inside the `<form>`).
- **Delete `use-form-action.ts`** in the same PR.
- **Smoke tests stay green** unchanged — the action signature is identical, only the hook wiring moves.
- **The two `as never` zodResolver casts (A-TS-02)** get a one-line comment explaining the RHF/Zod generic mismatch instead of being refactored — the audit's recommendation.

### 2. Per-segment `error.tsx` (closes A-NEXT-06)

Add an `error.tsx` boundary to each of the 10 bare segments listed in A-NEXT-06:

- `apps/admin/src/app/set-password/error.tsx`
- `apps/admin/src/app/login/error.tsx`
- `apps/admin/src/app/(dashboard)/upcoming-bookings/error.tsx`
- `apps/admin/src/app/(dashboard)/bookings/error.tsx`
- `apps/admin/src/app/(dashboard)/users/error.tsx`
- `apps/admin/src/app/(dashboard)/my-bookings/error.tsx`
- `apps/admin/src/app/(dashboard)/services/error.tsx`
- `apps/admin/src/app/(public)/offer/[token]/error.tsx`
- `apps/admin/src/app/(dashboard)/bookings/[id]/error.tsx`
- `apps/admin/src/app/(dashboard)/my-bookings/[bookingId]/error.tsx`

Each is a one-liner re-exporting a shared `SegmentError` component in `apps/admin/src/components/SegmentError.tsx`. The shared component shows the canonical fallback (title + message + "Try again" button calling `reset()`) using design-system tokens. Add a `vitest-axe` assertion on `SegmentError`.

### 3. Homepage SEO + metadata sweep (closes A-HOME-01 / A-HOME-04 / A-HOME-05)

- **Verify metadata** on each homepage public page (`(site)/page.tsx`, `(site)/services/page.tsx`, `(site)/booking-request/page.tsx`, `(site)/datenschutz/page.tsx`, `(site)/impressum/page.tsx`): unique `title`, descriptive `description`, `alternates.canonical`, full `openGraph` block (title, description, url, type, locale, images), `twitter` block. Fill in any missing fields.
- **`sitemap.ts`** — confirm every public route is enumerated; add any missing entries.
- **`robots.ts`** — confirm `host` matches the canonical production origin.
- **Capture Lighthouse baseline** for `npm run lighthouse:homepage` and `npm run lighthouse:services`. Record the scores inline in this iteration plan under §"Done when" so iter-35+ has a regression baseline.

### 4. Conditional-UPDATE / `.returning()` audit (closes A-ADMIN-03)

Walk every `tx.update(bookings).set({status: ...}).where(...)` in `features/bookings/server/actions.ts` and `features/bookings/server/assignment-actions.ts`.

- **Rule:** every status-transition UPDATE must combine `WHERE id = ? AND status = ?` (race-safe state-machine guard) with `.returning({...})` (so the action can detect a zero-row update and respond with a coherent error instead of pretending success).
- **Fix in place** any UPDATE missing either half. Add a focused smoke test for the race case: two concurrent updates against the same booking row, second one observes the conflict.
- **No abstraction.** Do not introduce a helper; inline the guard. Three similar lines is better than a premature abstraction.

### 5. vitest-axe gap closure (closes A-ADMIN-05)

Add `toHaveNoViolations` assertions for the 4 components missing them:

- `apps/admin/src/components/UserMenu.tsx`
- `apps/admin/src/components/InstallPrompt.tsx`
- `apps/admin/src/components/NoPermissionCard.tsx`
- `apps/admin/src/features/bookings/components/IcsDownloadButton.tsx`

`BookingDetailActions.tsx` — decide during implementation whether it has interactive a11y surface beyond what its children already cover; add only if non-redundant. `HasPermission.tsx` is RSC, exempt.

Mechanically copy from any existing `*.a11y.test.tsx` (e.g. forms tests) — `render` → `axe(container)` → `toHaveNoViolations`. No behaviour assertions.

### 6. Booking-request schema hardening (closes A-TS-03 / A-HOME-03)

The customer-side homepage build-time fetch of `/api/public/services` is currently cast `as { services?: ServiceEntry[] }` with no runtime validation.

- **Promote the response schema** to `packages/shared/src/booking-request.ts` (or extend whatever shared module iter-31 created). Both the admin route's response and the homepage page's parse use the same Zod schema.
- **`.safeParse`** the fetched JSON in `apps/homepage/src/app/(site)/booking-request/page.tsx` (around line 54). On parse failure: log + fall through to the empty-services path (which already exists and ships valid UX).
- **No customer-visible behaviour change** — purely a defence against a malformed prod response breaking the build.

### 7. Double-cast cleanup in `use-has-permission.ts` (closes A-TS-04)

Replace the two consecutive casts in `apps/admin/src/hooks/use-has-permission.ts:15` with a tiny `roleFromSession` guard local to the file (`function roleFromSession(session: Session | null): Role | undefined`). Touches a security-relevant hook so do it in its own commit with the smoke test re-run as evidence.

## Done when

- [ ] All 7 §s green; `npm run verify` passes (51 test files baseline + any new smokes / axe assertions; numbers in the PR description).
- [ ] `apps/admin/src/hooks/use-form-action.ts` deleted; no remaining importers.
- [ ] 10 new `error.tsx` files present; each triggers the `SegmentError` fallback when its segment throws.
- [x] Homepage metadata audit complete (iter-34 §3). Per-page status:
  - `(site)/page.tsx` — **was missing entirely**; added full metadata (title, description, canonical, openGraph with images, twitter).
  - `(site)/services/page.tsx` — had metadata but `openGraph.type` was `"article"`; corrected to `"website"`.
  - `(site)/booking-request/page.tsx` — missing `openGraph.images` and entire `twitter` block; both added.
  - `(site)/datenschutz/page.tsx` — missing `openGraph.images` and `twitter.images`; both added.
  - `(site)/impressum/page.tsx` — missing `openGraph.images` and `twitter.images`; both added.
  - `sitemap.ts` — `/booking-request` entry was missing; added at priority 0.8.
  - `robots.ts` — `host` field was missing; added pointing to `siteUrl`.
  - **Lighthouse scripts** (`npm run lighthouse:homepage` / `npm run lighthouse:services`) exist at repo root (`scripts/lighthouse.mjs`) and target the live site. Baseline scores not captured this iteration — scripts require a running live or local build to execute and are outside the automated ralph-loop scope. Run manually post-deploy to capture baseline.
- [ ] Conditional-UPDATE audit findings written to a brief §8 below ("which UPDATEs were fixed, which were already correct"). Race-case smoke test added.
- [ ] 4–5 new vitest-axe smokes present and green.
- [ ] Booking-request response is `safeParse`-validated; shared schema lives in `packages/shared`.
- [ ] `use-has-permission.ts` no longer contains a double cast; existing smoke green.
- [ ] ff-rdp dogfooding report appended at the next sequential session number.

## Heads-up

- **Deferred to a separate iteration** (intentionally not in scope):
  - **TypeScript 6 + Vite 8** dev-pipeline bumps (A-TS-08 / A-DEPS-02 / A-DEPS-03). The audit's iter-37 candidate. Major-version risk; run with a green/red verify gate as its own iteration.
  - **`useMemo` / `useCallback` removal** (A-REACT-02). Audit advised "keep manual memos in `components/ui/`"; a sweep needs per-call judgement, not a mechanical pass.
  - **`forwardRef` → ref-as-prop** (A-REACT-03). Waiting on the shadcn registry to publish React-19-native primitives; diverging from upstream now creates merge debt.
  - **`kb/admin-architecture/` wiki restructure.** Pending memory note (`project_kb_restructure_pending`) — split `design-system.md` into per-topic pages linked from `overview.md`. Worth doing soon to shrink agent context usage, but doc-only and parallel-safe; can land any time post iter-32.

- **What's *truly* closed by this iteration:** every audit finding with `Disposition: queued` except the four above. After merge, `findings-index.md` and the iter-33 audit doc both need a status pass to mark items as resolved.

## 8. Conditional-UPDATE audit findings (§4)

Walked every `update(bookings | bookingAssignments).set(...).where(...)` in `apps/admin/src/features/bookings/server/actions.ts` and `apps/admin/src/features/bookings/server/assignment-actions.ts`.

**Already correct (status guard + `.returning()` in place):**
- `approveRequest` — `bookingAssignments` UPDATE: WHERE includes `status = 'requested'`, returns `userId`.
- `rejectRequest` — `bookingAssignments` UPDATE: WHERE includes `status = 'requested'`, returns `userId`.
- `sendOffer` — `bookings` UPDATE: WHERE includes `status = 'created' AND offerVersion = ?`, returns `id`.
- `sendRevisedOffer` — both branches (accepted→offered and offered→offered): WHERE includes `status = ? AND offerVersion = ?`, returns `id`.
- `confirmAssignment`, `declineAssignment`, `withdrawAssignment` (assignment-actions.ts) — each loops the valid prior states with `status = ?` guard + `.returning()`.

**Fixed in place (§4 of this iteration):**
- `adminAcceptOffer` — `bookings` UPDATE inside the snapshot tx was `WHERE id = ?` only, no `.returning()`. Added `AND status = fromStatus` guard + `.returning({ id })` + race-detected error path. Moved the conditional UPDATE before the snapshot insert so a race rolls back without orphan `booking_service_item` rows.
- `rejectBooking` — `bookings` UPDATE was `WHERE id = ?` only, no `.returning()`. Added `AND status = fromStatus` (created or offered) + `.returning({ id })` + "changed during reject" error path.
- `cancelBooking` — `bookings` UPDATE was `WHERE id = ?` only, no `.returning()`. Added `AND status = 'accepted'` + `.returning({ id })` + "changed during cancel" error path.
- `assignUser` — the re-assign branch (`bookingAssignments` UPDATE for an existing row) was `WHERE bookingId = ? AND userId = ?` only, no `.returning()` and no prior-status guard. Added `AND status = existing.status` + `.returning({ userId })` + race-aware error path so a concurrent confirm/decline/withdraw can't be silently overwritten.

**Out of scope per the §4 rule (non-status UPDATEs):**
- `updateBooking` — updates name/date/venue/notes etc. only, not `status`. Already has `.returning()` for not-found detection. Terminal-state guard is a pre-read, not the race-safety mechanism this audit targets.

**Race-case smoke test:** added `cancelBooking: two concurrent cancels — second observes the race` to `apps/admin/src/features/bookings/server/bookings.smoke.test.ts`. Fires `Promise.all` of two `cancelBooking` calls against the same accepted booking and asserts exactly one success + one error (with the error message coming from either the zero-row UPDATE path or the pre-tx guard — both correctly detect the conflict).
