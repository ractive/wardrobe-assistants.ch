---
title: Iteration 24 — Rename event → booking
type: iteration
order: 25
status: done
---

# Iteration 24 — Rename `event` → `booking`

Mechanical, foundational rename. Zero new functionality, zero behavioral change. After this iteration, the system uses the word "booking" everywhere `event` used to appear: database tables and columns, code, routes, permissions, templates, navigation copy.

This iteration is implemented autonomously by `/ralph-loop`; it must leave the system fully working and deployable at the iteration boundary. The downstream sequence ([iter-25](iteration-25-booking-domain.md) → [iter-29](iteration-29-squad-assignment-confirmation.md)) all assumes the `booking` vocabulary.

## Decisions

- **Hard cut on URLs.** Admin is internal-only; no redirects from `/events` → `/bookings`. Operators are notified via the iteration changelog. Removes a permanent piece of legacy routing for ~zero cost.
- **Status enum stays unchanged.** `bookings.status` keeps `draft|published|cancelled|done` in this iteration. [iter-25](iteration-25-booking-domain.md) migrates the enum.
- **Existing assignment behavior unchanged.** `booking_assignments.status` keeps `assigned|requested|rejected`. [iter-25](iteration-25-booking-domain.md) widens the enum.
- **Notification templates rename verbatim.** `eventAssigned` → `bookingAssigned`, etc. Copy text inside templates also swaps "event" → "booking" everywhere it appears as a noun referring to the entity.
- **Permission keys rename.** `EVENT_VIEW` / `EVENT_CREATE` / `EVENT_UPDATE` / `EVENT_DELETE` → `BOOKING_*` equivalents. Mapping in `lib/permissions.ts`.

## Pre-flight

- [x] iter-23 merged on `main` and deployed.
- [x] No in-flight branches touching `apps/admin/src/features/events/` or `packages/db/src/schema/events.ts` / `event-assignments.ts`. Check `git branch -r` and any open PRs.
- [ ] Backup of production DB taken (the rename is reversible, but cheap insurance). _(operational step — not verifiable from the PR diff)_
- [x] `npm run verify` green on `main` before starting.

## Scope

### 1. Database migration

Rename tables and columns. The rename is identity-preserving — no data changes.

```sql
ALTER TABLE events RENAME TO bookings;
ALTER TABLE event_assignments RENAME TO booking_assignments;
ALTER TABLE booking_assignments RENAME COLUMN event_id TO booking_id;
-- Recreate indexes/foreign-key references under new names if Drizzle's generated
-- migration doesn't do this automatically. Verify with `drizzle-kit generate`.
```

- Generate the migration with `drizzle-kit generate`, hand-inspect, commit.
- Run via the iter-15b auto-migration setup on dev + verify; production migration runs on deploy.

### 2. Schema files (`packages/db/src/schema/`)

- `events.ts` → `bookings.ts`. Table identifier `events` → `bookings`. Exported symbol `events` → `bookings`.
- `event-assignments.ts` → `booking-assignments.ts`. Table identifier and FK column renamed.
- `index.ts` re-exports updated.
- Audit-log entry types: any `event.*` keys → `booking.*`. Migrate existing `audit_log` rows in the same migration:

```sql
UPDATE audit_log SET entity_type = 'booking' WHERE entity_type = 'event';
UPDATE audit_log SET entity_type = 'booking_assignment' WHERE entity_type = 'event_assignment';
UPDATE audit_log SET action = REPLACE(action, 'event.', 'booking.') WHERE action LIKE 'event.%';
```

### 3. Feature folder

- `apps/admin/src/features/events/` → `apps/admin/src/features/bookings/`.
- All file-internal symbols renamed: components (`EventList` → `BookingList`, `EventDetail` → `BookingDetail`, etc.), server actions (`createEvent` → `createBooking`, `updateEvent` → `updateBooking`, etc.), zod schemas, types.
- Smoke tests renamed (`events.smoke.test.ts` → `bookings.smoke.test.ts`) and updated.

### 4. Routes

- `apps/admin/src/app/(dashboard)/events/` → `bookings/`.
- `apps/admin/src/app/(dashboard)/my-events/` → `my-bookings/`.
- `apps/admin/src/app/(dashboard)/upcoming-events/` → `upcoming-bookings/`.
- Nav links and breadcrumbs updated. UI copy referencing "Event" / "Events" → "Booking" / "Bookings".
- No redirects; old URLs return 404. Internal-only app.

### 5. Permissions (`apps/admin/src/lib/permissions.ts`)

Rename all four keys and any references:

```ts
// before
EVENT_VIEW, EVENT_CREATE, EVENT_UPDATE, EVENT_DELETE
// after
BOOKING_VIEW, BOOKING_CREATE, BOOKING_UPDATE, BOOKING_DELETE
```

- Update all `<HasPermission permission="EVENT_*">` and `useHasPermission("EVENT_*")` call sites.
- Update `withPermission(...)` server-action wrappers.

### 6. Notification templates

Rename and update copy:

| Old key | New key |
|---|---|
| `eventAssigned` | `bookingAssigned` |
| `eventCancelled` (if exists) | `bookingCancelled` |
| any other `event*` template | `booking*` |

- Template files in `apps/admin/src/email-templates/` renamed; English copy updated to use "booking" where it referred to the entity.
- `notifyUser` / `sendTemplated` call sites updated to new keys.

### 7. Biome `noRestrictedImports` (`biome.json`)

Update the per-feature override block:

```jsonc
// before
"apps/admin/src/features/events/**": { ... }
// after
"apps/admin/src/features/bookings/**": { ... }
```

Search for any other `features/events` strings in `biome.json` or tooling and update.

### 8. Documentation touch-up

- `CLAUDE.md`, `kb/admin-architecture/overview.md`, `kb/admin-architecture/feature-slice-template.md`: any inline references to `features/events/` or "event" as the entity → "booking". Don't rewrite full pages — narrow targeted edits only.
- `README.md` if it mentions events.
- `kb/audits/findings-index.md` only if the index has live references to `features/events/`.

## Out of scope

- Any new functionality.
- Status enum migration (iter-25).
- New columns (iter-25).
- Customer-facing surfaces (iter-26+).
- URL redirects from old `/events*` routes — hard cut.
- Renaming `services` or any other entity.

## Done when

- [x] DB tables renamed; migration runs cleanly on a fresh DB and a copy of the prod schema.
- [x] `apps/admin/src/features/bookings/` is the only feature folder (no leftover `events/`).
- [x] All routes under `(dashboard)/bookings`, `(dashboard)/my-bookings`, `(dashboard)/upcoming-bookings`.
- [x] Permission keys all start with `BOOKING_`; no `EVENT_` strings remain (`rg "EVENT_" apps/ packages/`).
- [x] Notification templates renamed; no `eventAssigned` etc. left in code.
- [x] Biome `noRestrictedImports` override uses `features/bookings/**`.
- [x] All existing smoke tests pass under their new names.
- [x] `npm run format` clean.
- [x] `npm run verify` green (lint + typecheck + test).
- [ ] System fully deployable; manual smoke against deploy preview confirms the admin app loads, the booking list renders, and assigning a squad member still works end-to-end. _(manual deploy-preview smoke not run as part of this PR)_
- [x] No half-exposed UI for future iterations — this is a pure rename.
