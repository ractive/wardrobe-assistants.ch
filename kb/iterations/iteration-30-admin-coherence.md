---
title: Iteration 30 — Admin coherence pass
type: iteration
order: 31
status: done
---

# Iteration 30 — Admin coherence pass

Polish pass after the [iter-24](iteration-24-rename-event-to-booking.md) → [iter-29](iteration-29-squad-assignment-confirmation.md) sequence. The booking lifecycle is functionally complete, but the admin surface looks like six iterations stitched together — because it is. This iteration ties the pieces together: kill stale "iter-22" copy, turn passive dashboard counts into actionable links, give admins a "new requests" inbox, expose the offer-share URL on the booking detail page, fix dead-end disabled buttons, and harden the push-subscribe button so it stops looking inert when something is wrong.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. No new domain concepts — only wiring, copy, and discoverability.

This file is a **living scope** for the iteration. The "Scope" section below is the agreed-on set as of [project_iteration_status](../../.claude/projects/-Users-james-devel-wardrobe-assistants-ch/memory/project_iteration_status.md); the user may add further small polish items in §"Pickup list" before launch.

## Decisions

- **No new tables, no new columns.** Everything in this iteration reads existing state and adjusts presentation/affordance.
- **No domain rules change.** Permission catalog stays as-is; server actions stay as-is. Terminal-state guards on `updateBooking` (already enforced) are mirrored at the UI affordance level only — the server is still authoritative.
- **The dashboard becomes the admin's home for the booking lifecycle.** Every count is a link; every "new request" is reachable in one click. Stuff that's not actionable yet ([iter-22](iteration-22-invoice-flow.md) invoices / charts) gets honest copy or is hidden until the work lands — no more "lands in iter-22" leaking to users.
- **`/bookings` gets URL-driven status tabs.** State on `?status=…` so dashboard cards can deep-link in. Mobile-first: tabs collapse to a select on narrow viewports.
- **Offer-token surfaces are admin-only.** "Copy offer link" + "View as customer" buttons appear on the booking detail page once an offer has been sent (i.e. `offerToken` is non-null). Gated on `BOOKING_OFFER_SEND` — same gate as "Send offer".
- **Push-subscribe button fails loudly.** Silent `console.error` paths in `PushSubscribeToggle.tsx` are converted to toasts; the component renders `null` when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is absent (no inert CTA).
- **No customer-side copy changes beyond fixing the one stale "Event details" string** on `/offer/[token]` (carry-over from the [iter-24](iteration-24-rename-event-to-booking.md) rename).
- **Manual smoke uses ff-rdp.** Browser inspection of the new dashboard cards, `/bookings` tabs, offer-URL controls, and push-toast paths goes through `ff-rdp` per the rule in `CLAUDE.md`. Append a dogfooding session report at `../ff-rdp/kb/dogfooding/dogfooding-session-<next>.md` recording what worked, what didn't, bugs, quirks, improvement ideas.

## Pre-flight

- [x] [iter-29](iteration-29-squad-assignment-confirmation.md) merged on `main` and deployed.
- [x] Branch `fix/admin-vapid-and-csp-nonce` and `fix/vapid-build-time-inlining` already on main; production admin is serving the rebuilt image with VAPID public key baked in.
- [x] No in-flight branches touching `apps/admin/src/app/(dashboard)/page.tsx`, `apps/admin/src/app/(dashboard)/bookings/`, `apps/admin/src/features/bookings/components/BookingDetailActions.tsx`, or `apps/admin/src/components/PushSubscribeToggle.tsx`.
- [x] `npm run verify` green on `main`.

## Scope

### 1. Dashboard refresh

`apps/admin/src/app/(dashboard)/page.tsx`:

- **Remove all "iter-22" references** in user-visible copy (currently lines ~166, 175, 188, 190). The two invoice-related cards ("Open invoices", "Pending invites") and the activity-charts placeholder either need honest copy ("Coming soon" with no iteration number) or should be hidden until [iter-22](iteration-22-invoice-flow.md) ships. Decision: **hide** them — placeholders signal incompleteness even with honest copy.
- **Add a "New requests" card** at the top of the KPI grid. Reads `count(*) FROM bookings WHERE status = 'created' AND createdBy IS NULL`. Badge styling when count > 0; muted when count = 0. Links to `/bookings?status=new-requests`.
- **Make surviving KPI cards links.** "Upcoming bookings" → `/bookings?status=upcoming` (i.e. `status=accepted` filtered to `date >= today`). "Active squad" → `/squads`. Wrap each `KpiCard` in a `<Link>` (or accept an `href` prop and have the card render as an anchor); preserve hover/focus styles.
- **Empty-state guidance** when zero bookings exist: instead of empty cards, show a single "Welcome" panel with the next two actions: create a booking, or share the public booking-request URL.

### 2. `/bookings` status filter

`apps/admin/src/app/(dashboard)/bookings/page.tsx` + `apps/admin/src/features/bookings/components/BookingsTable.tsx`:

- **URL-driven tabs** at the top of the page: `New requests | Offered | Accepted | Cancelled | All`.
  - `New requests` = `status=created AND createdBy IS NULL`
  - `Offered` = `status=offered`
  - `Accepted` = `status=accepted`
  - `Cancelled` = `status IN ('cancelled', 'rejected')`
  - `All` = everything (default fallback if `?status` is missing/unknown)
- **Server-side filter.** The page reads `searchParams.status`, narrows the Drizzle query, and revalidates on tab switch. Don't shove all bookings to the client and filter there.
- **Per-tab empty states.** `New requests` empty → "Nothing waiting on you. Customer-submitted bookings show up here." Others get parallel copy.
- **Badge on the New-requests tab** showing the same count as the dashboard card. Reuses `apps/admin/src/features/bookings/components/RequestsBadge.tsx` if applicable.
- **Mobile breakpoint:** tabs become a `<select>` at <640px so the iter-15 admin-must-work-at-375px contract holds.

### 3. Booking detail — offer URL controls

`apps/admin/src/app/(dashboard)/bookings/[id]/page.tsx` + `apps/admin/src/features/bookings/components/BookingDetailActions.tsx` (or a small adjacent component):

- When `booking.offerToken` is non-null **and** the viewer holds `BOOKING_OFFER_SEND`, render two affordances near the offer status:
  - **Copy offer link** — copies `https://admin.wardrobe-assistants.ch/offer/<token>` to the clipboard. `sonner` toast on success / "Couldn't copy" on failure.
  - **View as customer** — opens the same URL in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Read the absolute base URL from `process.env.NEXT_PUBLIC_BASE_URL` (or whatever the existing convention is — check the email-template helpers first; reuse rather than fork).
- **Smoke test:** clicking either button on a booking with no `offerToken` is unreachable (the buttons aren't rendered). Clicking on a booking with a token writes the right URL into the clipboard mock.

### 4. Customer offer page copy fix

`apps/admin/src/app/(public)/offer/[token]/page.tsx:116`: `"Event details"` → `"Booking details"`. iter-24 rename leakage, customer-visible.

### 5. Push-subscribe button — visible failure

`apps/admin/src/components/PushSubscribeToggle.tsx`:

- **Hide entirely when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is absent.** Read at the same point as `isSupported`. Component returns `null`. No more inert button.
- **Convert silent `console.error` paths to toasts** using the existing `sonner` integration:
  - `Notification.requestPermission() !== "granted"` → "Notifications blocked. Enable them in your browser settings to receive booking alerts."
  - Subscription `endpoint`/keys missing → "Couldn't enable notifications. Try a different browser."
  - Server `subscribePush` / `unsubscribePush` failure → "Couldn't save your notification preference. Try again."
- **Keep `console.error` calls** for the underlying error object — the toast is for the human, the console log is for debugging.
- **Tests:**
  - Component returns `null` when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset.
  - Clicking with permission denied surfaces a toast (mock `Notification.requestPermission`).
  - Server-error path surfaces a toast (mock `subscribePush` to return `{success: false}`).

### 6. (Stretch — pull to iter-30b if it bloats the iteration) Audit-log timeline on booking detail

A collapsible "Activity" section near the bottom of `bookings/[id]/page.tsx` rendering `audit_log` rows filtered by `targetType IN ('booking', 'booking_assignment') AND targetId = :id`. Read-only, reverse-chronological, human-friendly action labels (e.g. `booking.offer.sent` → "Offer sent"). Permission-gated on `BOOKING_VIEW` (anyone who can see the booking can see its history).

If §6 doesn't fit cleanly within the iteration's PR-review tolerance, slot it as iter-30b — don't compromise on §§1–5.

## Pickup list

Smaller polish items discovered after iter-29; tackle these inside iter-30 if they fit cleanly, otherwise spin off iter-30b. The user may add more here before launch.

- [ ] **Lifecycle action buttons hide rather than disable** when the action isn't valid for the current status (e.g. "Send offer" on a `cancelled` booking). The iter-28 implementation already gates by permission; gating by status too keeps the action bar from looking broken on terminal-state bookings. Apply uniformly to **every** action on `cancelled`/`rejected` bookings — Send offer, Accept, Reject, Cancel, Assign squad, Message assignees, Edit (already done) — so the action surface collapses cleanly. Delete stays available so admins can still purge bad rows.

- [ ] **Future-only dates on Create**, but Edit allows past dates. In `BookingForm.tsx`'s date Calendar, pass `disabled={(d) => d < startOfToday()}` only when `mode === "create"`. Edit must remain unrestricted so admins can fix typos on past bookings.

- [ ] **`assignmentInvite` email: Confirm + Decline side-by-side, not stacked.** Currently each button is wrapped in its own `<Text>`, forcing block layout. Use a 2-column `<Row>/<Column>` table (React Email's recommended cross-client pattern — flex/inline-block is unreliable in email clients). Decline stays `variant="secondary"`.

- [ ] **"Add service" Popover on booking detail (paired with autosave below).** Replace the current "add row that preselects a service" pattern with an explicit **+ Add service** button that opens a Popover containing service `<Select>` + quantity + Add. Nothing mutates until the user clicks Add inside the popover. Discoverable; reversible.

- [ ] **Autosave line-item edits; drop the "Save line items" button.** Once Add is a deliberate popover (above), per-row quantity and delete can autosave on blur with ~500ms debounce. Removes the "made changes but didn't save" failure mode. Server-side audit log captures every change. Ship these two items as a single PR — they're one design unit.

- [ ] **Consolidate booking venue fields: keep `venue` + `city`, drop `venueName`.** iter-26 left both `venue` (free text) and `venueName`+`venueCity` (customer-form schema) on the same row. Migration: `UPDATE bookings SET venue = COALESCE(venue, venueName); ALTER TABLE bookings DROP COLUMN venueName`. Rename `venueCity` → `city`. Update all UI / detail page / forms / templates accordingly. Schema rename also touches `LineItemsEditor` callers and email-template params — sweep the codebase.

- [ ] **Hard 5h minimum duration.** `durationHours: z.number().int().min(5)` in the booking input schema; `<Input type="number" min={5}>` in the form. Error copy explains the business rule.

- [ ] **Make time, duration, and city required (new submissions only).** Apply going-forward via app-layer validation in the zod schema. For the DB-level NOT NULL constraint: prefer adding it, but the migration must first reconcile any existing rows that violate it — either backfill with a sentinel (`time='TBD'`, etc., and flag on the detail page until cleaned up) or skip NOT NULL and accept that legacy rows remain non-conforming. The implementer picks the path that keeps the system working at the iteration boundary; document the choice in the iteration's done-when section.

- [ ] **Regroup booking-form fieldsets.** Two new groupings: **When** (date, time, duration) and **Where** (venue, city). Existing "Customer contact" and "Notes" / "Customer comment" stay as-is. Drop the standalone "Schedule & venue (optional)" fieldset since its fields are now required and split across When/Where.

- [ ] **Explanations on lifecycle action buttons — popover + contextual helper, both.** Two layers: (a) a one-sentence helper directly under the action row that swaps with the booking's current status (e.g. for `status=created`: "This booking is new. Send offer to email the customer the quote."); (b) a small `(i)` button next to each action button that opens a Popover (not a tooltip) with deeper detail — same gesture on mouse and touch, accessible to keyboard. Avoid hover-only tooltips because they're invisible on touch and keyboard.

- [ ] **Whole-row click on `/bookings` opens the booking.** Wrap each `<tr>` content in Next.js `<Link href={\`/bookings/${id}\`}>` (RSC-friendly). Interactive children (status badge, future kebab menu) call `stopPropagation` so they don't double-trigger. Mirror the same pattern on `/services` rows so the entire row opens the existing edit popover instead of only the kebab.

- [ ] **Theme switch moves into the user menu** (next to Sign out). Remove the standalone toggle from the sidebar. Three options: Light / Dark / System. Reuses the existing next-themes integration.

- [ ] **Show `createdAt` / `updatedAt` on the booking detail page** as a small footer ("Submitted 2 days ago · last updated 1h ago"). Helps admins triage public requests by age. Use the existing `formatDistanceToNow` pattern; full timestamp on hover/title attribute.

- [ ] **Confirmation dialog on Cancel and Reject.** Both are terminal-state transitions; Cancel fans out push+email notifications to assigned squad members. Use the same `DeleteBookingConfirm`-style pattern. Copy should name the side effects ("This will notify N squad members.").

- [ ] **Public booking-request URL surfaced on the dashboard.** Small "Share with customers" panel with the canonical homepage form URL and a Copy button. Otherwise operators have to remember/look it up. Pair with §1's empty-state Welcome panel for first-login users — same content surface.

- [ ] **`?returnTo=` round-trip from `/login`.** From iter-29's deferred follow-up: anonymous email-link click currently lands on `/login`, then on `/` after sign-in — user has to re-click the original link. Fix: preserve original URL in `?returnTo=` in `proxy.ts`'s redirect, and have `app/login/page.tsx` honour it with `router.replace(returnTo)` on successful auth. Validate `returnTo` is same-origin to avoid open-redirect.

- [ ] **`/bookings?status=…` tab navigation uses `router.push`, not `replace`.** With URL-driven tabs (§2), each tab switch should add a history entry so Back returns to the previously selected tab. One-line spec for the implementer; flagging here so PR review doesn't have to.

- [ ] **Validate `customerEmail` as an email in the booking input schema.** Currently the zod schema may accept any string in `customerEmail`; broken values silently fail when the offer email tries to send. Add `z.string().email().optional()` (or non-optional once §6 lands) and surface validation in the form. Same for customer-side public booking-request schema if it's separate.

- [ ] *(add more here as you find them — drop a one-line description; the implementer will sort scope vs defer)*

## Heads-up from iter-29

(Carry over so PR review doesn't have to flag these again.)

1. **`recordAudit` after the tx commits.** Same rule as iter-25..29 — never inline `tx.insert(auditLog).values(...)` inside a transaction.
2. **Bound user-provided text fields in zod schemas**, not just the UI.
3. **Dark-mode variants up front** on any new coloured banners (amber/red/green) — iter-28 had to retrofit `dark:bg-amber-…`.
4. **Vitest-axe smoke** for any new interactive component (dashboard cards as links, tabs on `/bookings`, offer-URL buttons, push-toggle toasts). The slice template + design-system docs make this a per-component contract, not optional.
5. **Mobile-first (375px).** Specifically the bookings status tabs and dashboard KPI grid — both currently breathe at desktop widths and crowd on narrow viewports.

## Out of scope

- Invoice flow, invoice tracking, activity charts. Still [iter-22](iteration-22-invoice-flow.md), still deferred.
- Customer message threading / notification preferences.
- New permission keys; the permission catalog is stable.
- Notification-channel preferences (per-template push vs email opt-in).
- German translation.
- Customer-facing copy beyond the single `"Event details"` → `"Booking details"` fix.

## Done when

- [x] Dashboard contains zero "iter-N" references in user-visible copy.
- [x] Dashboard KPI cards are links; clicking any count deep-links into the filtered `/bookings` view or `/users`. (Note: linked to `/users` rather than `/squads` — the existing admin route is `/users`.)
- [x] A "New requests" card with live count is visible on the dashboard for any role holding `BOOKING_VIEW`.
- [x] `/bookings?status=new-requests` returns only `created AND createdBy IS NULL` bookings, server-filtered, with the documented empty-state copy.
- [x] All four documented status tabs are present and URL-driven; mobile collapses them to a select. (Tabs are `New requests | Offered | Accepted | Upcoming | Cancelled | All`; Upcoming added during review to match the dashboard's `?status=upcoming` deep-link.)
- [x] On a booking with an `offerToken`, an admin holding `BOOKING_OFFER_SEND` sees "Copy offer link" and "View as customer" buttons; both produce the correct customer URL.
- [x] `/offer/[token]` no longer contains the word "Event"; "Booking details" used throughout.
- [x] `PushSubscribeToggle` renders `null` in environments without `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- [x] Permission-denied, server-error, and shape-error paths in `PushSubscribeToggle` each fire a toast with copy from §5.
- [x] Per-section smoke tests landed and green; vitest-axe smoke covers all new interactive components.
- [x] `npm run format` clean; `npm run verify` green.
- [ ] Manual smoke on a preview deploy: submit a public booking request → see the count tick up on the dashboard → click into `/bookings?status=new-requests` → open the booking → "Send offer" → "Copy offer link" → paste into a new tab → see the customer offer page render correctly with "Booking details" copy. *(Deferred — to be exercised post-deploy, not blocking the merge.)*
