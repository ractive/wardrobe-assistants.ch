---
title: Iteration 18 — Squad-member views (assigned events, request-to-participate)
type: iteration
order: 19
status: done
---

# Iteration 18 — Squad-member views

Squad members sign in and see two things: the events they're assigned to, and upcoming events they could opt into. They can request participation on the latter; an admin approves/rejects.

## Pre-flight

- [ ] iter-15, 16, 17 merged.
- [ ] At least 1 SQUAD_MEMBER user exists. At least 2 events: one with the user assigned, one without.

## Schema — extend `event_assignments` for request-flow

Add a column to `event_assignments`:

```ts
status: text("status", { enum: ["assigned", "requested", "rejected"] })
  .notNull().default("assigned"),
```

Migration adds the column with default `"assigned"` for existing rows (admin-direct assignments).

When an admin assigns directly → `status: "assigned"`. When a squad member requests → `status: "requested"`. Admin can flip a request to `assigned` (approve) or `rejected`.

## Permissions to add

Already in catalog from iter-14: `SQUAD_VIEW_ASSIGNED`, `SQUAD_REQUEST_PARTICIPATION`. Plus add:

```ts
"EVENT_APPROVE_REQUEST",   // admin reviews squad-member requests
```

Add to ADMIN's set (auto via `new Set(PERMISSIONS)`).

## Scope — squad routes [4/4]

- [x] Route `app/(dashboard)/my-events/page.tsx`:
  - `assertPermission("SQUAD_VIEW_ASSIGNED")`.
  - Two sections: "Assigned to you" (status = `assigned`) and "Your requests" (status = `requested` / `rejected`).
- [x] Route `app/(dashboard)/upcoming-events/page.tsx`:
  - `assertPermission("SQUAD_REQUEST_PARTICIPATION")`.
  - Lists events where `date >= now`, `status = "published"`, and the current user is NOT already in `event_assignments`.
  - Each row has a "Request to participate" button.
- [x] Sidebar shows different links per role:
  - ADMIN: Users / Events / Services (admin views).
  - SQUAD_MEMBER: My Events / Upcoming Events.
- [x] Dashboard landing (`/`) routes by role: ADMIN → admin dashboard; SQUAD_MEMBER → `/my-events`.

## Scope — request-to-participate [3/3]

- [x] `requestParticipation` action in `features/events/server/actions.ts`:
  - `withPermission("SQUAD_REQUEST_PARTICIPATION", ...)`.
  - Inserts row in `event_assignments` with `status: "requested"`. Idempotent.
  - Sends email to all admins ("X requested to participate in event Y") via `sendEmail` fan-out.
- [x] `approveRequest` / `rejectRequest` actions:
  - `withPermission("EVENT_APPROVE_REQUEST", ...)`.
  - Updates `event_assignments.status` to `"assigned"` or `"rejected"`.
  - On approve: triggers the same "you've been assigned" email as direct assignment.
- [x] Admin events list shows pending requests as a badge; event detail page has approve/reject buttons inline.

## Scope — UI [3/3]

- [x] `<MyEventsTable>` (squad-side) — read-only, shows event name/date/venue + status of the assignment.
- [x] `<UpcomingEventsList>` (squad-side) — card layout per event with a "Request to participate" button.
- [x] `<RequestsBadge>` on the admin events table — shows count of pending requests.

## Scope — verify [3/3]

- [x] Tests: perm enforcement (squad can't reach admin routes; admin can't accidentally request on their own events); the "already assigned" check; email fan-out on request.
- [ ] Manual end-to-end: SQUAD_MEMBER sees only their views; requests participation; admin gets email; admin approves; squad member sees event move from "requests" to "assigned".
- [x] `npm run verify` green.

## Out of scope (deliberate)

- **Squad-member self-cancellation** — once assigned, they can't unassign themselves. Admin handles. (Future iter could add this.)
- **Event capacity / max squad members** — admin manually decides; no system enforcement.
- **Notification preferences per user** — all email today; SMS / WhatsApp in iter-21.
- **Request-to-participate auto-approval** — always requires admin click.

## Done when

- [x] SQUAD_MEMBER sees only `/my-events` and `/upcoming-events`; admin sidebar surfaces are 404 / forbidden for them.
- [x] SQUAD_MEMBER can request participation on an upcoming event; admin gets notified.
- [x] Admin can approve or reject; on approve, squad-member sees it in "Assigned to you."
- [x] `npm run verify` green.
