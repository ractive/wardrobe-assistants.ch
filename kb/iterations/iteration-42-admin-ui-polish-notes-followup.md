---
title: Iteration 42 — Admin UI polish & observability followup (Notes triage)
type: iteration
order: 43
status: planned
---

# Iteration 42 — Admin UI polish & observability followup

## Motivation

`kb/Notes.md` accumulated a batch of small UX gaps and one missing observability
behaviour, surfaced while dogfooding the admin app post-iter-41. Most are
narrow polish items; two have non-trivial design (server logging strategy,
derived "unread" bell badge) already discussed in conversation on 2026-05-13 and
captured here. None are blocking, all are user-visible.

This iteration bundles them so we can ship the cleanup as one PR.

## Scope

### A. Line-item amount column moves to the left

**Problem.** On wide screens, the "amount" column on both `LineItemsEditor`
(edit mode, number input) and `LineItemsReadOnly` (closed bookings) is
right-aligned next to the description. The eye has to traverse the full row
width to associate description ↔ amount.

**Fix.** Move the amount column to immediately after the description (or
quantity) and left-align it. Keep the **total** (sum row at the bottom)
right-aligned — it visually anchors the column above and reads as a footer.

**Files.** `apps/admin/src/features/bookings/components/LineItemsEditor.tsx`
and the read-only variant in the same folder.

### B. Server-side console logging

**Problem.** Auth and mutation events are not visible when tailing
`bunny logs`. Audit log covers mutations in the DB but not in stdout, and login
events aren't logged anywhere.

**Fix.** Add **plain human-readable** console logs (NOT structured JSON — we
want them readable as-is in the bunny log tail, not parsed by a pipeline). Keep
it minimal; do not go overboard.

Events to cover:

- **Auth.** Login success/fail (with reason: bad password, unknown user, rate
  limited), signout, password reset request, password reset complete, invite
  accept.
- **Mutations.** Booking create, status change, edit, cancel — one line each
  with actor email, action, and target id (e.g.
  `booking abc123 created by admin james@ractive.ch`).
- **Permission denials.** `assertPermission` failures: who tried what.
- **Unhandled errors.** Route-level error boundary catches with stack.

**Files.** `apps/admin/src/lib/auth.ts`, `apps/admin/src/lib/permissions.ts`,
and the relevant feature `server/actions.ts` files. A tiny shared helper
(`apps/admin/src/lib/log.ts`) may emerge — only if the call sites duplicate.

### C. Bell icon with unread badge

**Problem.** Push notifications arrive but leave no trail in the UI. If a
squad member misses the push (offline, denied permission, dismissed), they have
no way to know a booking is waiting for them.

**Fix.** Bell icon in the admin header next to the notifications toggle, with
an unread badge. Purely derived from domain state — no persistence of push
messages. Stays accurate even if a push delivery failed.

**Derivation rules.**
- **Squad members:** count of bookings assigned to me where my assignment
  status is `pending_confirmation`.
- **Admins:** count of **unassigned** pending bookings (NOT every pending
  booking — otherwise the badge is always non-zero and becomes noise).

**Interaction.**
- Click bell → dropdown listing those items, each linking to the booking page.
- Badge clears naturally when the underlying state changes (confirm / decline /
  assign). No "mark read" UI, no per-user persistence.
- Refresh on window focus + light poll (~60s). If the existing push
  subscription channel is open, piggyback an invalidation signal on it.

**Files.** New `apps/admin/src/components/UnreadBookingsBell.tsx` and a
`features/bookings/server/queries.ts` helper for the count + list. Header lives
in `apps/admin/src/app/(dashboard)/layout.tsx` (or wherever the
`PushSubscribeToggle` is rendered).

### D. Info (i) tooltip beside the notifications toggle

**Problem.** Even with iter-40's toggle-switch improvement, it's still
unclear *what* enabling notifications does for the user (browser push? on what
events?).

**Fix.** Add a small `(i)` icon next to the notifications toggle. Same
tooltip behaviour as the bookings/{id} action buttons — hover on desktop, tap
on mobile.

**Copy (draft).**
> Get a browser notification when a booking needs your attention — a new
> request for admins, or a new assignment to confirm for squad members.
> Notifications work even when the tab is closed. You can turn them off again
> any time.

**Files.** `apps/admin/src/components/PushSubscribeToggle.tsx`.

### E. Restrict /bookings/{id} action-button tooltip to the (i) icon

**Problem.** On the bookings/{id} page, the explanatory tooltip on each
status-change button (Send offer, Confirm, Cancel, …) fires when hovering
*anywhere* on the button. This is visually noisy and pre-empts the button's own
hover state.

**Fix.** Wire the `<TooltipTrigger>` to the `(i)` icon only, not the whole
button. The button's own hover/focus styles should remain. Verify keyboard tab
still reaches the tooltip (the icon should be focusable for a11y).

**Files.** `apps/admin/src/features/bookings/components/BookingLifecycleActions.tsx`.

## Out of scope

- **Persisting push notifications / history view.** Explicitly rejected in
  favour of derived state (§C). If a future use case needs an actual history
  (e.g. "show me the last 20 alerts I received"), open a new iteration.
- **Structured logging / log aggregation.** §B is intentionally plaintext to
  stdout. A real observability stack (DataDog, Loki, etc.) is a separate
  decision.
- **Shared table component for /bookings, /services, /users.** Evaluated and
  rejected — tables differ too much (row click semantics, action columns,
  badges) and we don't expect enough new list pages to amortize the
  abstraction. Recorded in `kb/Notes.md`.
- **Invoice / Abaninja flow.** Stays in `kb/iterations/deferred/iteration-22-invoice-flow.md`.

## Acceptance criteria

- [ ] §A — Line-item amount column is left-aligned in both editor and read-only
      views on ≥`md` breakpoint; total stays right-aligned. Mobile (375px)
      layout unchanged or improved.
- [ ] §B — Tailing `bunny logs` during a login flow + booking lifecycle shows
      readable plain-text lines for every event listed above. Permission
      denials and unhandled errors emit a single distinguishable line.
- [ ] §C — Bell badge appears in header for admin and squad sessions. Count
      matches the derivation rules above. Confirming/declining/assigning a
      booking decrements the count without a manual refresh (within poll
      window or focus event).
- [ ] §D — `(i)` tooltip beside notifications toggle renders the drafted copy;
      keyboard- and tap-accessible.
- [ ] §E — Tooltip on `/bookings/{id}` action buttons fires only when hovering
      the `(i)` icon, not the rest of the button. Keyboard tab still reaches it.
- [ ] `npm run verify` passes. Smoke test on `/bookings/<id>`, `/my-bookings`,
      and login/logout in ff-rdp.

## Notes

Source: `kb/Notes.md` triage conversation, 2026-05-13. See that file's TODO
section for the original raw items.
