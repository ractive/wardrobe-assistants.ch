---
title: Iteration 29 — Squad assignment confirmation
type: iteration
order: 30
status: planned
---

# Iteration 29 — Squad assignment confirmation

Closes the squad side of the booking lifecycle. When an admin assigns a squad member to a booking, the squad member receives an email with Confirm and Decline buttons. Clicking either deep-links into the (login-gated) squad-member booking detail page, which prompts for confirmation and otherwise renders the booking. Confirmed assignments unlock an ICS download. Confirmed squad members can withdraw later (with optional reason) — admins are notified.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. This is the final iteration of the public-booking-flow sequence.

## Decisions

- **Both buttons in the invite email deep-link to `/my-bookings/<bookingId>?action=confirm|decline`.** No state mutation from the email click. Defense against Outlook Safe Links and Gmail-Image-Proxy-style link prefetch.
- **The URL is login-gated.** Better Auth's existing `returnTo` round-trip handles unauthenticated users. After login the page renders with an action-prompt component primed by `?action=`.
- **Squad member can change their mind on the detail page.** Both Confirm and Decline buttons are visible inline regardless of `?action`. The prompt component is dismissible.
- **ICS download appears only when assignment `status === 'confirmed'`.** A single-event `.ics` with date/time/duration/venue.
- **Withdraw is the post-confirmation reversal**, with optional reason. Status `confirmed → withdrawn`. Admins are notified; the customer is **not** notified directly (operationally, admin reassigns and the customer flow continues opaquely).
- **No squad-member-initiated participation requests** in this iteration. The `requested` enum value (from [iter-25](iteration-25-booking-domain.md)) remains reserved.
- **Edge cases follow the locked spec**: assignment deleted → friendly message; wrong user → 403 with no booking detail leak; terminal state → show current state with inverse action when still valid.

## Pre-flight

- [ ] [iter-28](iteration-28-offer-revisions-cancellation.md) merged on `main` and deployed.
- [ ] `booking_assignments.status` enum supports `confirmed` and `withdrawn` (verified from [iter-25](iteration-25-booking-domain.md) migration).
- [ ] At least one squad-role user and one `accepted` booking exist in dev.
- [ ] No in-flight branches touching `features/bookings/` or `app/(dashboard)/my-bookings/`.
- [ ] `npm run verify` green on `main`.

## Scope

### 1. Email template — `assignmentInvite`

Replaces the existing `bookingAssigned` template (renamed in [iter-24](iteration-24-rename-event-to-booking.md)) **OR** wraps it — pick the simpler rename. The new template's body includes:

- Booking summary: date + time, venue, duration.
- Two CTA buttons:
  - **Confirm** → `${env.APP_URL}/my-bookings/<bookingId>?action=confirm`
  - **Decline** → `${env.APP_URL}/my-bookings/<bookingId>?action=decline`
- Note: "You'll be asked to sign in. Both buttons take you to your booking page where you can confirm or decline."
- Push payload: `{ title: "New assignment", body: "<booking date> · <venue>", url: "/my-bookings/<id>?action=confirm" }`.

The previously existing `bookingAssigned` is removed once references are updated.

### 2. Squad-member detail page — `/my-bookings/[bookingId]/page.tsx`

Already exists post-[iter-24](iteration-24-rename-event-to-booking.md). Extend.

Server component path:

1. Auth required (existing Better Auth gating).
2. Load the booking + the assignment row for the logged-in user (`WHERE bookingId = :id AND userId = :session.user.id`).
3. Edge cases:
   - **Assignment not found**: render "You don't have an assignment for this booking." 404-style page; do not leak booking details.
   - **Wrong user / booking exists but not assigned**: same as above (treat as "not found" for this user).
   - **Booking exists, assignment terminal** (`rejected`, `withdrawn`): render booking summary + a banner showing the current state. If the booking is still `accepted`, expose an inline action to re-Confirm (status `rejected → confirmed` or `withdrawn → confirmed`) — keeps the door open for "I changed my mind".
4. Otherwise render: full booking detail (date/time, venue, comment) + line-item summary (read-only) + the action panel.

### 3. Action prompt component

`apps/admin/src/features/bookings/components/AssignmentActionPrompt.tsx`.

Props: `{ assignment, defaultAction: 'confirm' | 'decline' | null }`.

Behavior:

- When `defaultAction === 'confirm'`: render "Confirm this assignment?" with three buttons — Confirm (primary, matches default), Decline (secondary), Dismiss (tertiary).
- When `defaultAction === 'decline'`: same shape, Decline becomes primary.
- When `defaultAction === null` (page visited without `?action`): the prompt is hidden; only the inline Confirm/Decline buttons elsewhere on the page are visible.
- **Dismiss**: closes the prompt for this page view. The inline buttons remain available — the user is just back in browse mode.
- All three buttons fire client-side server-action calls (`confirmAssignment`, `declineAssignment`, or local dismiss).

The `?action=` query param is read server-side and passed as the `defaultAction` prop. After a successful state change, the page revalidates so the prompt disappears and the new state reflects.

### 4. Server actions

`apps/admin/src/features/bookings/actions/assignments.ts`.

```ts
export async function confirmAssignment(assignmentId: string): Promise<void> {
  await withPermission("SQUAD_CONFIRM_ASSIGNMENT", async (session) => {
    const assignment = await db.query.bookingAssignments.findFirst({
      where: eq(bookingAssignments.id, assignmentId),
    });
    if (!assignment) throw notFound();
    if (assignment.userId !== session.user.id) throw new Error("Not your assignment");
    if (assignment.status === "confirmed") return; // idempotent
    if (assignment.status === "withdrawn") {
      // re-confirming after withdrawal is allowed
    }
    await db.update(bookingAssignments).set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(bookingAssignments.id, assignmentId));
    await db.insert(auditLog).values({
      entityType: "booking_assignment", entityId: assignmentId,
      action: "assignment.confirmed", byUserId: session.user.id,
      payload: { fromStatus: assignment.status },
    });
    await notifyAdmins("assignmentConfirmed", {
      bookingId: assignment.bookingId,
      squadUserName: session.user.name,
    });
  });
}
```

Analogous `declineAssignment(assignmentId)` and `withdrawAssignment(assignmentId, reason?)`. Notes:

- `declineAssignment`: allowed from `assigned`, `confirmed`. Status → `rejected`. Notify admins via `assignmentDeclined`.
- `withdrawAssignment`: allowed from `confirmed` only. Status → `withdrawn`. Optional `reason` (≤500 chars). Notify admins via `assignmentWithdrawn`.

All three actions are idempotent on already-terminal-and-matching states.

Add a small `bookingAssignments.confirmedAt` and `bookingAssignments.withdrawnAt` (timestamp_ms, nullable) — small schema migration in this iteration. Updates the `packages/db/src/schema/booking-assignments.ts` file.

### 5. Permissions

Add to `lib/permissions.ts`:

- `SQUAD_CONFIRM_ASSIGNMENT`
- `SQUAD_DECLINE_ASSIGNMENT`
- `SQUAD_WITHDRAW_ASSIGNMENT`

All three granted to the `SQUAD` role. (Admins also get them so they can simulate or correct on a squad member's behalf if needed — confirmed via `assignment.userId === session.user.id` guard inside the action.)

### 6. ICS download

`apps/admin/src/features/bookings/components/IcsDownloadButton.tsx`.

- Visible only when `assignment.status === 'confirmed'`.
- Clicking POSTs to a server endpoint that streams an `.ics` payload (single VEVENT) with:
  - `SUMMARY`: "Wardrobe Assistants — <venueName>"
  - `DTSTART` / `DTEND`: computed from `booking.date + booking.startTime` + `durationHours`. Use Europe/Zurich timezone.
  - `LOCATION`: `${venueName}, ${venueCity}`
  - `DESCRIPTION`: booking comment (if any) + a link back to `/my-bookings/<bookingId>`
  - `UID`: stable per booking (e.g. `booking-<id>@wardrobe-assistants.ch`)
- Response headers: `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="booking-<id>.ics"`.
- No external library required — `.ics` is plain text; hand-roll the formatting with proper CRLF line endings and `BEGIN:VCALENDAR`/`END:VCALENDAR` wrapping.

### 7. Withdraw flow UI

- "Withdraw assignment" button visible when `assignment.status === 'confirmed'`. Opens a modal with an optional reason textarea (≤500 chars).
- On submit: calls `withdrawAssignment` server action.
- After success: page revalidates; the assignment row shows `withdrawn` state and the inverse "Confirm again" action.

### 8. Notification templates

Add:

- **`assignmentInvite`** (squad; push + email). Replaces / supersedes the `bookingAssigned` rename target. Two CTAs as in §1.
- **`assignmentConfirmed`** (admins; push + email). Confirmation that the squad member confirmed.
- **`assignmentDeclined`** (admins; push + email). Notification that the squad member declined.
- **`assignmentWithdrawn`** (admins; push + email). Notification that the squad member withdrew post-confirmation; includes optional reason.

Push payloads colocated per the [iter-23](iteration-23-admin-pwa-web-push.md) convention.

### 9. Wire up `assignSquadMember`

The existing `assignSquadMember` server action (created in earlier iterations and renamed in [iter-24](iteration-24-rename-event-to-booking.md)) currently sends `bookingAssigned`. Update it to send `assignmentInvite` instead. Remove the old template once references are clean.

### 10. Audit logging

- `assignment.confirmed`
- `assignment.declined` (`fromStatus` recorded)
- `assignment.withdrawn` (`reason` recorded)

### 11. Smoke tests

- Anonymous click on `/my-bookings/<id>?action=confirm` → redirect to login with `returnTo=...`; no state change.
- After login, the prompt component renders with Confirm primary.
- `confirmAssignment` happy path (status `assigned → confirmed`); idempotent on repeat call.
- `confirmAssignment` from another user's session → 403.
- `confirmAssignment` from `withdrawn` works (re-confirm).
- `declineAssignment` from `assigned` and `confirmed` both work.
- `withdrawAssignment` from `confirmed` succeeds; from non-`confirmed` rejected.
- ICS download returns 200 + `text/calendar` only when status is `confirmed`; otherwise 404.
- ICS content validates against a basic VEVENT shape (DTSTART, DTEND, SUMMARY, UID present; CRLF line endings).
- Withdraw with a reason → `assignmentWithdrawn` admin notification dispatched with the reason in payload.
- Edge: assignment row deleted between page render and action call → friendly error, not a 500.

## Out of scope

- Squad-member-initiated participation requests / "I'd like to be assigned to this booking" UI. `requested` enum value stays reserved.
- Reminder emails (day before booking).
- Calendar subscribe via webcal:// URL (one-shot `.ics` download is sufficient).
- Customer-facing notification when a squad member withdraws.
- Per-template channel preferences.
- German translation.

## Done when

- [ ] `assignmentInvite` template replaces `bookingAssigned` end-to-end; `assignSquadMember` sends it; old template removed.
- [ ] `confirmAssignment`, `declineAssignment`, `withdrawAssignment` server actions exist with the documented status guards and permission gates.
- [ ] `bookingAssignments.confirmedAt` and `withdrawnAt` columns migrated.
- [ ] `/my-bookings/[bookingId]` renders with edge cases handled (no assignment / wrong user / terminal state / live state) per §2.
- [ ] Action prompt component reads `?action=` and renders the right primary action; Dismiss leaves the page in browse mode.
- [ ] ICS download visible only when status is `confirmed`; returns valid single-VEVENT `.ics` with Europe/Zurich times.
- [ ] Withdraw flow exposes an optional reason; emits `assignmentWithdrawn` to admins.
- [ ] `assignmentConfirmed`, `assignmentDeclined`, `assignmentWithdrawn` templates landed with push payloads.
- [ ] Anonymous clicks on action URLs hit Better Auth login first; no state mutation without auth.
- [ ] Audit log writes `assignment.confirmed`, `assignment.declined`, `assignment.withdrawn` rows.
- [ ] Smoke tests cover every case in §11.
- [ ] `npm run format` clean; `npm run verify` green.
- [ ] System deployable; manual smoke on a preview confirms: admin assigns squad member → email with Confirm/Decline arrives → squad member logs in → confirms → ICS downloadable → withdraws with reason → admin notified.
- [ ] Public-booking-flow sequence (iter-24 → iter-29) is fully closed; no half-exposed UI remains.
