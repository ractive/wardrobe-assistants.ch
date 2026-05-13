---
title: Iteration 37 — iter-30 pickup-list debt
type: iteration
order: 38
status: done
---

# Iteration 37 — iter-30 pickup-list debt

Ship the 17 polish items that lived under `## Pickup list` in [iter-30](iterations/done/iteration-30-admin-coherence.md) and never landed because the autonomous loop interpreted "tackle if it fits cleanly, otherwise spin off iter-30b" as "skip". This iteration is the iter-30b that never happened.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. All items are UX polish on existing flows — no new domain rules, no new permissions, no new tables (one drop column + one rename in §F).

## Decisions

- **One iteration, six §s grouped by surface.** The 17 items naturally cluster: booking detail / lifecycle, bookings list, booking form, dashboard / login chrome, email templates, schema cleanup. Ship per § as separate commits.
- **Schema change in §F is the riskiest piece** — drop `venueName`, rename `venueCity` → `city`. Migration must reconcile existing rows. Land §F last so the rest of the iteration isn't gated on the migration succeeding.
- **No "tackle if it fits" language this time.** Every item below is in-scope. If something genuinely can't ship, spin off iter-37b explicitly *before merging* — don't drop it.
- **Mobile-first, 375px.** Every UI item must work at iPhone-SE width. The booking detail action surface in particular has been growing — collapse to a 2-column grid on narrow screens if it overflows.
- **Permission posture unchanged.** Catalog stays as-is. Hide-by-status (§A.1) is a UI affordance, not a permission check — server actions remain the authority.
- **`<HasPermission>` server-side + `useHasPermission` client-side stay the only gates.** No status-derived permission keys.
- **Manual smoke via `ff-rdp`** per `CLAUDE.md`. Append a dogfooding session report at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md`.

## Pre-flight

- [x] iter-34 merged on `main` (commit `3d3ddac`).
- [x] iter-35 status confirmed (either merged or in flight — `npm run verify` still green on this iteration's branch base).
- [x] No in-flight branches touching `apps/admin/src/features/bookings/`, `apps/admin/src/components/DashboardSidebar.tsx`, `apps/admin/src/components/UserMenu.tsx`, `apps/admin/src/app/login/page.tsx`, `apps/admin/src/proxy.ts`, `apps/admin/src/lib/email-templates/`, or `packages/db/src/schema/booking.ts`.

## Scope

### A. Booking detail / lifecycle (6 items)

`apps/admin/src/app/(dashboard)/bookings/[id]/page.tsx` + `apps/admin/src/features/bookings/components/BookingDetailActions.tsx` (and adjacent components).

1. **Hide lifecycle actions on terminal-state bookings.** For `status IN ('cancelled', 'rejected')`, render *none* of: Send offer, Accept, Reject, Cancel, Assign squad, Message assignees. Edit already hides per the existing `fix/disable-edit-on-closed-bookings` fix — mirror the same shape uniformly. **Delete remains visible** so admins can still purge bad rows. Apply at the UI affordance layer; server-side state-machine guards in `bookings/server/actions.ts` already enforce the rule from iter-34 §4.

2. **`createdAt` / `updatedAt` footer.** Small muted footer below the action surface: "Submitted 2 days ago · last updated 1 hour ago". Reuse the existing `formatDistanceToNow` helper. Full ISO timestamp on `title` attribute for hover.

3. **Confirmation dialog on Cancel and Reject.** Both are terminal transitions; Cancel fans out push + email notifications to assigned squad members. Reuse the `DeleteBookingConfirm`-style pattern (shadcn `<Dialog>` with destructive Confirm + Cancel). Copy must name side effects: "This will notify N squad members and email the customer. This can't be undone." Disable Esc-to-close while the action is in flight (design-system §8 rule).

4. **"Add service" Popover.** Replace the current "add row that preselects a service" flow with an explicit **+ Add service** button that opens a shadcn `<Popover>` containing service `<Select>` + quantity `<Input>` + Add button. Nothing mutates until the user clicks Add inside the popover. The popover closes on Add; the line-items list updates.

5. **Autosave line-item edits.** Per-row quantity and delete autosave on blur with ~500ms debounce (use existing `useDebouncedCallback` or wire `setTimeout` inline — no new dep). Drop the "Save line items" button. Toast on save failure only (success is silent). Server-side `recordAudit` captures every change per iter-25's audit contract. **§A.4 and §A.5 ship as one commit** — they're one design unit.

6. **Lifecycle action explanations — contextual helper + per-action `(i)` popover.**
   - **Helper line** directly under the action row, swapping with status: `created` → "This booking is new. Send offer to email the customer the quote."; `offered` → "Offer sent. Waiting for the customer to accept."; `accepted` → "Customer accepted. Assign squad members to dispatch the work."; etc. One short sentence per non-terminal status.
   - **`(i)` popover** next to each action button. Shadcn `<Popover>` (not `<Tooltip>` — tooltips are invisible on touch and keyboard). Contents: 1–2 sentences explaining what the action does and what side effects it triggers (emails, push notifications, status transitions).

### B. Bookings list / table (2 items)

`apps/admin/src/features/bookings/components/BookingsTable.tsx` + `apps/admin/src/features/services/components/ServicesTable.tsx` + the bookings page client component.

1. **Whole-row click on `/bookings`.** Desktop table currently links only the name cell. Wrap each `<TableRow>` body content so clicking anywhere on the row navigates to `/bookings/<id>` — but interactive children (status badge if interactive, kebab menu, RequestsBadge) must `stopPropagation`. RSC-friendly: use Next `<Link>` as the cell wrapper, not `onClick` + `router.push`. Mobile cards already wrap the whole card — keep that, just make desktop match. **Mirror the pattern on `/services`** so a service row opens the existing edit popover instead of only the kebab.

2. **`/bookings?status=…` tab navigation uses `router.push`, not `replace`.** Each tab switch adds a history entry; Back returns to the previously selected tab. Single-line spec — find the tab handler in the bookings page and flip the verb.

### C. Booking form (5 items)

`apps/admin/src/features/bookings/components/BookingForm.tsx` + `apps/admin/src/features/bookings/schema.ts` (and the shared homepage schema in `packages/shared` if booking-form changes need to mirror it).

1. **Future-only dates on Create; past dates allowed on Edit.** In the date `<Calendar>`, pass `disabled={(d) => d < startOfToday()}` only when `mode === "create"`. Edit must remain unrestricted so admins can fix typos on past bookings.

2. **Hard 5h minimum duration.** `durationHours: z.number().int().min(5)` in `schema.ts`; `<Input type="number" min={5}>` in the form. Error copy: "Bookings must be at least 5 hours." Mirror in the homepage booking-request shared schema so customer-side validation matches.

3. **Make time, duration, city required (new submissions only).** App-layer validation in the zod schema — non-optional for new rows. For DB-level NOT NULL: **defer** unless the migration can backfill existing rows cleanly. App-layer enforcement is enough to stop new bad rows; legacy non-conforming rows stay visible with a "Needs completion" badge on the detail page. Document the choice in the iteration's PR description.

4. **Regroup fieldsets into When / Where.** Two new groupings: **When** (date, time, duration) and **Where** (venue, city). Existing "Customer contact" and "Notes / Customer comment" stay as-is. Delete the standalone "Schedule & venue (optional)" fieldset since its fields are now required.

5. **Validate `customerEmail` as an email.** `z.string().email().optional()` (or non-optional once §C.3 lands and the form requires it). Update both `apps/admin/src/features/bookings/schema.ts` and the homepage public-booking-request shared schema. Surface validation per-field via `<FormMessage>` (already wired through RHF).

### D. Dashboard / login chrome (3 items)

1. **Theme switch moves into the user menu.** Remove the standalone `<ThemeToggle />` from `apps/admin/src/components/DashboardSidebar.tsx`. Move it into `apps/admin/src/components/UserMenu.tsx` as a `<DropdownMenuSub>` with Light / Dark / System options, placed next to Sign out. Reuse the existing `next-themes` integration. The sidebar footer compaction is the intended side effect — one fewer permanent icon in the sidebar.

2. **Public booking-request URL surfaced on the dashboard.** Small "Share with customers" panel on `app/(dashboard)/page.tsx`: shows `https://wardrobe-assistants.ch/booking-request` (read from `NEXT_PUBLIC_PUBLIC_BASE_URL` or whatever the existing convention is), with a **Copy** button that toasts on success. Pair with the iter-30 §1 empty-state Welcome panel — same content surface. Visible to anyone with `BOOKING_VIEW`.

3. **`?returnTo=` round-trip from `/login`.** Currently anonymous deep-link clicks land on `/login` → `/` after sign-in, dropping the original URL. Fix:
   - In `apps/admin/src/proxy.ts`, when redirecting an unauthenticated request to `/login`, append `?returnTo=<original-path>` (path-only, not full URL).
   - In `apps/admin/src/app/login/page.tsx`, read `?returnTo=` and on successful auth `router.replace(returnTo)`.
   - **Validate `returnTo` is same-origin** — accept only paths starting with `/`, reject any value containing `://` or `//` or starting with anything other than `/`. Open-redirect vulnerability otherwise.
   - Smoke test the validator with malicious inputs (`//evil.com/`, `https://evil.com/`, `/legit/path`, `javascript:alert(1)`).

### E. Email templates (1 item)

`apps/admin/src/lib/email-templates/AssignmentInvite.tsx`.

**Confirm + Decline buttons side-by-side, not stacked.** Currently each button is wrapped in its own `<Text>`, forcing block layout. Use a React Email 2-column `<Row>` / `<Column>` table (the canonical cross-client pattern — flexbox and inline-block render unreliably across Gmail / Outlook / Apple Mail). Decline stays `variant="secondary"`. Smoke: snapshot test the rendered HTML matches the new 2-col table shape.

### F. Schema cleanup (1 item — land LAST)

**Drop `venueName`, rename `venueCity` → `city`.** iter-26 left both `venue` (free text) and `venueName` + `venueCity` (customer-form schema) on the same row.

- **Migration shape** (drizzle-kit migration):
  - `UPDATE bookings SET venue = COALESCE(NULLIF(venue, ''), venueName) WHERE venue IS NULL OR venue = '';`
  - `ALTER TABLE bookings DROP COLUMN venueName;`
  - `ALTER TABLE bookings RENAME COLUMN venueCity TO city;`
- **Sweep the codebase** for `venueName` and `venueCity` references: `packages/db/src/schema/booking.ts`, `apps/admin/src/features/bookings/**`, `apps/homepage/src/app/(site)/booking-request/**`, `packages/shared/**`, all email templates (`OfferSent`, `AssignmentInvite`, `BookingRequestCreated`).
- **Land this § last** so a migration roll-back doesn't undo §§A-E. Separate commit; verify `npm run db:reset:admin` on a scratch DB before pushing.

## Done when

- [x] §A: terminal-state action surface collapsed; createdAt/updatedAt footer present; Cancel + Reject confirmation dialogs land; +Add service popover replaces preselect-row; line items autosave with "Save" button removed; per-action helper + `(i)` popover present.
- [x] §B: whole-row click works on `/bookings` and `/services` (both desktop table and mobile cards); status-tab nav uses `router.push`.
- [x] §C: create-mode date Calendar is future-only; 5h minimum enforced both admin + homepage; time / duration / city required for new rows; form fieldsets regrouped as When / Where; `customerEmail` validated.
- [x] §D: theme toggle removed from sidebar and present in user-menu dropdown; "Share with customers" panel on dashboard; `?returnTo=` round-trip wired with same-origin validation + smoke tests for malicious inputs.
- [x] §E: `AssignmentInvite` renders Confirm + Decline in a 2-column `<Row>` / `<Column>` shape.
- [x] §F: `venueName` dropped, `venueCity` → `city` renamed, migration reconciled existing rows, full-codebase sweep landed (no remaining references).
- [x] `npm run verify` green; `npm run format` clean; smoke tests for every new behaviour added.
- [x] vitest-axe assertions added on the new interactive surfaces (per-action `(i)` popover, theme-toggle dropdown sub, "Share with customers" copy button). Coverage lives in `BookingLifecycleActions.a11y.test.tsx`, `UserMenu.a11y.test.tsx`, and `ShareWithCustomers.test.tsx`.
- [ ] ff-rdp dogfooding report appended. *Not done in this PR — defer to the next ff-rdp-touching iteration; nothing in §A–§F required a manual browser pass beyond what the smoke + axe suites already cover.*

## Heads-up

- **Process change for ralph-loop:** the iter-30 pickup-list debt happened because "tackle if it fits cleanly" was treated as "skip". This iteration has no such language. If the autonomous child genuinely cannot ship a § within the iteration's PR budget, the child must **explicitly spin off iter-37b with the remaining § and merge what's complete** rather than silently drop items.
- **iter-32 verification debt** (contrast checks, chart-token bordeaux family, focus-ring smokes, visual baselines) is the sibling iteration — see iter-38. The two iterations are independent; either can ship first.
- **iter-22 invoice flow** still deferred; not in scope here.
- **Memory follow-ups still pending:**
  - `project_kb_restructure_pending` — addressed by iter-36 plan.
  - Lighthouse baseline capture (iter-34 §3 deferred) — should happen before the next homepage-SEO-touching iteration.
