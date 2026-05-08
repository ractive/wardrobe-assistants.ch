---
title: Iteration 16 — Events feature (CRUD, assignment, message-all-assigned)
type: iteration
order: 17
status: planned
---

# Iteration 16 — Events feature

Admins can create/delete events, assign squad members, and send a message to all assigned users (email today; SMS/WhatsApp planned in iter-21).

## Pre-flight

- [ ] iter-15 merged. Users feature working in prod. At least 1 SQUAD_MEMBER exists for testing assignment.

## Schema — `packages/db/src/schema/events.ts`

```ts
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),                            // ulid()
  name: text("name").notNull(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  venue: text("venue").notNull(),
  notes: text("notes"),
  status: text("status", { enum: ["draft", "published", "cancelled", "done"] })
    .notNull().default("draft"),
  // `createdBy` survives admin deletion: an event must not vanish because
  // its creator's account was removed. Make the column nullable + null on
  // user delete. (The column above is `.notNull()` for now to surface the
  // decision — switch it to nullable when the schema is implemented.)
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const eventAssignments = sqliteTable("event_assignments", {
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  assignedAt: integer("assigned_at", { mode: "timestamp_ms" }).notNull(),
  // Future: status (invited / accepted / declined) for assignment workflow
}, (t) => ({
  pk: primaryKey({ columns: [t.eventId, t.userId] }),
}))
```

Add aggregator entry in `packages/db/src/schema.ts`. Generate + apply migration.

## Scope — feature scaffold [0/3]

- [ ] `apps/admin/src/features/events/{schema.ts, server/, components/}`.
- [ ] Biome per-feature override.
- [ ] Route: `apps/admin/src/app/(dashboard)/events/page.tsx`. Page-top `assertPermission("EVENT_CREATE")` for admin view; squad members see a different page (route — `/my-events` — handled in iter-18).

## Scope — CRUD [0/3]

- [ ] `createEvent` action — `withPermission("EVENT_CREATE")`. Fields: name, date, venue, notes, initial status (default `draft`).
- [ ] `deleteEvent` action — `withPermission("EVENT_DELETE")`. Confirmation dialog. Cascade removes `event_assignments` via FK. Use `.returning({ id: events.id })` and return `{ error: true, message: "Event not found." }` when 0 rows are affected (same pattern as iter-15 `deleteUser`).
- [ ] `updateEvent` action — `withPermission("EVENT_CREATE")` (re-use; no separate EDIT perm yet). Allows name/date/venue/notes/status edits.

## Scope — assignment [0/3]

- [ ] `assignUser` action — `withPermission("EVENT_ASSIGN")`. Inserts a row in `event_assignments`. Idempotent (`onConflictDoNothing`).
- [ ] `unassignUser` action — same perm. Deletes the row.
- [ ] On assignment: send the user an email (`sendEmail` from `lib/email`) saying "you've been assigned to event <name> on <date> at <venue>". Subject + body templated in `features/events/server/email-templates.ts` (or inline if small). When email senders consolidate in iter-20, move templates accordingly. **Email send is best-effort:** wrap in `try/catch` so a transient email failure doesn't roll back the assignment row (the assignment is the source of truth; the email is a notification). Log the failure and return a soft warning in the `ActionResult` (`{ error: false, message: "Assigned, but notification email failed to send." }`).

## Scope — message-all-assigned [0/2]

- [ ] `messageEventAssignees` action — `withPermission("EVENT_MESSAGE_ASSIGNED")`. Input: `{ eventId, subject, body }`. Looks up assignments, fans out to `sendEmail` per assigned user. **Partial-failure handling:** wrap each `sendEmail` in `try/catch` and tally `{ sent, failed }`. Return `{ error: false, message: "Sent to N of M assignees." }` when `sent > 0`; return `{ error: true, message: "Could not send to any assignee." }` when all fail. Do not throw on per-recipient failures; admins need feedback, not a crashed server action.
- [ ] `<MessageAssigneesDialog>` UI from the event detail page.

## Scope — UI [0/4]

- [ ] `<EventsTable>` for the events list (TanStack Table). Columns: Name, Date, Venue, Status (badge), Assignees count, Actions.
- [ ] `<EventDialog>` (create + edit). shadcn `<Dialog>` with `<Calendar>` for date picking (`npx shadcn add calendar popover` if not yet installed).
- [ ] `<AssigneesPicker>` — shadcn `<Command>` (`npx shadcn add command`) for fuzzy-searching users to assign. Shows current assignees as removable chips.
- [ ] Event detail page at `app/(dashboard)/events/[id]/page.tsx` — shows name/date/venue/notes/status/assignees + the message-all dialog trigger.

## Scope — verify [0/3]

- [ ] Tests: schema validation, perm enforcement, idempotent assignment, email fanout count.
- [ ] Manual: create event, assign 2 squad members, message them, verify both emails. Delete event, confirm assignments cascade.
- [ ] `npm run verify` green.

## Conventions inherited from iter-15

- Client dialogs that call server actions must wrap the call in `try/catch`.
  `withPermission` throws on session/permission failures (it's not just an
  `ActionResult`-returning function), and an unhandled rejection inside a
  RHF `handleSubmit` crashes the form. iter-15 standardised this in
  `InviteUserForm`, `MessageUserDialog`, and `DeleteUserConfirm`; mirror
  the same try/catch + toast pattern here.
- Mutations that change the visible list should `router.refresh()` on
  success so the server-rendered table re-fetches without a full reload.
- Server actions that delete should use `.returning(...)` and report a
  not-found error when 0 rows are affected, instead of returning success
  for a no-op.

## Out of scope (deliberate)

- **Squad-member request-to-participate flow** — iter-18.
- **Squad-member view of their assigned events** — iter-18.
- **Calendar (.ics) attachment on assignment email** — future.
- **Recurring events** — single-occurrence only.
- **Event capacity / waitlist** — single role per event for now (admins control assignment manually).
- **Invoice generation from event** — iter-22 (deeper invoice flow).

## Done when

- [ ] Admin can create/edit/delete events.
- [ ] Admin can assign / unassign squad members to events.
- [ ] On assignment, the user receives an email (dev console fallback OK).
- [ ] Admin can send a single message to all assignees of an event.
- [ ] All actions perm-gated; SQUAD_MEMBER cannot reach `/events`.
- [ ] `npm run verify` green.
