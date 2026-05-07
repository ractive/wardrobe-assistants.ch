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
  createdBy: text("created_by").notNull().references(() => user.id),
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
- [ ] `deleteEvent` action — `withPermission("EVENT_DELETE")`. Confirmation dialog. Cascade removes `event_assignments` via FK.
- [ ] `updateEvent` action — `withPermission("EVENT_CREATE")` (re-use; no separate EDIT perm yet). Allows name/date/venue/notes/status edits.

## Scope — assignment [0/3]

- [ ] `assignUser` action — `withPermission("EVENT_ASSIGN")`. Inserts a row in `event_assignments`. Idempotent (`onConflictDoNothing`).
- [ ] `unassignUser` action — same perm. Deletes the row.
- [ ] On assignment: send the user an email (`sendEmail` from `lib/email`) saying "you've been assigned to event <name> on <date> at <venue>". Subject + body templated in `features/events/server/email-templates.ts` (or inline if small). When email senders consolidate in iter-20, move templates accordingly.

## Scope — message-all-assigned [0/2]

- [ ] `messageEventAssignees` action — `withPermission("EVENT_MESSAGE_ASSIGNED")`. Input: `{ eventId, subject, body }`. Looks up assignments, fans out to `sendEmail` per assigned user.
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
