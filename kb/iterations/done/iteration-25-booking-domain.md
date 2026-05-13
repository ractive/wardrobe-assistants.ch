---
title: Iteration 25 — Booking domain expansion
type: iteration
order: 26
status: done
---

# Iteration 25 — Booking domain expansion

Schema and admin-internal UI for the new booking lifecycle. No customer-facing surfaces yet. The public booking-request form, the customer-facing offer page, and the squad-confirmation flow land in [iter-26](iteration-26-public-booking-request.md), [iter-27](iteration-27-offer-flow.md), and [iter-29](iteration-29-squad-assignment-confirmation.md) respectively.

Scope is deliberately larger than a typical slice: the new status enum, the snapshot table, the pre-offer selection table, and the admin UI for the new fields all land together. Splitting them would force a deploy with half a state machine.

Implemented autonomously by `/ralph-loop`; must leave the system fully working at the iteration boundary. "Working" includes: admin-created bookings continue to work; existing assignments and squad views continue to work; nothing exposes a UI for behavior that depends on [iter-27](iteration-27-offer-flow.md)'s offer page.

## Decisions

- **One entity, `booking`.** No separate `booking_request`. The status state machine handles the lifecycle. `createdBy` is the nullable FK that distinguishes customer-created (null) from admin-created (user.id).
- **No `customer` table.** Contact fields embed on `booking` (`customerName`, `customerEmail`, `customerPhone`). Trade-off accepted: no customer history aggregation in v1.
- **Status enum**: `created | offered | accepted | rejected | cancelled`. Backfill: `draft → created`, `published → accepted`, `done → accepted` (also set `invoicedAt = bookings.date` as a best-effort heuristic — [iter-22](iterations/deferred/iteration-22-invoice-flow.md) refines), `cancelled → cancelled`.
- **`invoicedAt` is a parallel timestamp**, not a status. Populated by [iter-22](iterations/deferred/iteration-22-invoice-flow.md) work.
- **Snapshot table `booking_service_item`** follows the [iter-17](iterations/done/iteration-17-services-feature.md) + [iter-22](iterations/deferred/iteration-22-invoice-flow.md) contract: nullable `serviceId` FK (ON DELETE SET NULL), snapshot of `name/description/priceType/unitPrice`, `quantity`, `hoursInMinutes`, computed-and-stored `total`. Prices are whole-CHF integers (matches `services.price`; no centimes). Snapshot is created/replaced at every "send offer" action ([iter-27](iteration-27-offer-flow.md), [iter-28](iteration-28-offer-revisions-cancellation.md)).
- **Pre-offer selections live in `booking_service_selection`** — a separate, mutable table. Keeps `booking_service_item` strictly immutable.
- **`services.description` becomes nullable** (per Notes line 4).
- **`booking_assignments.status` enum widens** to `assigned | requested | confirmed | rejected | withdrawn`. `requested` reserved for later; `confirmed` and `withdrawn` exposed in [iter-29](iteration-29-squad-assignment-confirmation.md).
- **Admin manual accept (`created → accepted`) is allowed for any booking** in this iteration — covers "admin agreed offline" without the offer-page round-trip. Sends `offerAcceptedAdmin` email.
- **`bookingRejected` email is implemented here** so admin-side reject works end-to-end without the offer page. The other customer-facing emails (`offerSent`, `offerRevised`, `offerAccepted`, `offerAcceptedAdmin`) ship in [iter-27](iteration-27-offer-flow.md)/[iter-28](iteration-28-offer-revisions-cancellation.md).
- **No "Send offer" / "Send revised offer" buttons in this iteration.** Those buttons appear only when the offer page exists ([iter-27](iteration-27-offer-flow.md)).

## Pre-flight

- [x] [iter-24](iterations/done/iteration-24-rename-event-to-booking.md) merged on `main` and deployed; no `EVENT_*` / `features/events` strings remain.
- [x] DB backup taken — the status backfill is destructive of the old enum semantics.
- [x] No in-flight branches touching `packages/db/src/schema/bookings.ts` or `features/bookings/`.
- [x] `npm run verify` green on `main`.

## Scope

### 1. DB migration — bookings columns + status enum

```ts
// packages/db/src/schema/bookings.ts (excerpt)
export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  // existing fields preserved (title, date, createdBy, etc.)
  status: text("status", {
    enum: ["created", "offered", "accepted", "rejected", "cancelled"],
  }).notNull().default("created"),
  createdBy: text("created_by").references(() => user.id),   // nullable — customer-created = null

  offerToken: text("offer_token").notNull().unique(),        // v4 uuid, stable for lifetime
  offerVersion: integer("offer_version").notNull().default(0),
  lastOfferSentAt: integer("last_offer_sent_at", { mode: "timestamp_ms" }),
  acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
  invoicedAt: integer("invoiced_at", { mode: "timestamp_ms" }),

  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),

  startTime: text("start_time"),                             // "HH:MM"
  durationHours: integer("duration_hours"),                  // integer hours, ≥5 for new public bookings
  venueName: text("venue_name"),
  venueCity: text("venue_city"),
  comment: text("comment"),
});
```

Backfill rules (single migration, idempotent):

- `status`: `draft → created`, `published → accepted`, `done → accepted`, `cancelled → cancelled`.
- For rows backfilled `done → accepted`: also set `invoicedAt = bookings.date`. Heuristic for legacy data only.
- `offerToken`: generate a v4 UUID for every existing row at migration time. Unique constraint enforced after backfill.
- `offerVersion`: `0` for all existing rows.
- `customerName/Email/Phone`: leave NULL for existing rows. Application-level validation requires them for new customer-submitted bookings ([iter-26](iteration-26-public-booking-request.md)).
- `startTime / durationHours / venueName / venueCity / comment`: NULL for legacy rows.

App-level invariant (documented, not DB-enforced): for `createdBy IS NULL` bookings (customer-submitted), all six contact + venue + time fields are required. Enforced in the public POST handler in [iter-26](iteration-26-public-booking-request.md).

### 2. DB migration — `booking_service_item` (immutable snapshot)

```ts
export const bookingServiceItem = sqliteTable("booking_service_item", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  offerVersion: integer("offer_version").notNull(),                              // which offer version this snapshot belongs to

  serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  priceType: text("price_type", { enum: ["fixed", "hourly"] }).notNull(),
  unitPrice: integer("unit_price").notNull(),                                    // whole CHF (matches services.price)
  quantity: integer("quantity").notNull(),
  hoursInMinutes: integer("hours_in_minutes"),                                   // populated for hourly = durationHours * 60
  total: integer("total").notNull(),                                             // computed at insert, whole CHF
  position: integer("position").notNull(),
});
```

- Index on `(bookingId, offerVersion, position)`.
- No write surface in this iteration. The table is populated by `sendOffer` / `sendRevisedOffer` in [iter-27](iteration-27-offer-flow.md)/[iter-28](iteration-28-offer-revisions-cancellation.md).

### 3. DB migration — `booking_service_selection` (mutable pre-offer)

```ts
export const bookingServiceSelection = sqliteTable("booking_service_selection", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  position: integer("position").notNull(),
});
```

- Index on `(bookingId, position)`.
- Editable while `status = 'created'`. UI also allows edits in `offered` state ([iter-28](iteration-28-offer-revisions-cancellation.md) needs this for revisions); document the rule but only the `created` editor ships here.

### 4. DB migration — `services.description` nullable

```sql
-- Drizzle migration: drop NOT NULL on services.description.
-- SQLite path: recreate the table via Drizzle's standard ALTER pattern.
```

No data backfill needed; existing rows already have descriptions and stay valid.

### 5. DB migration — `booking_assignments.status` enum widening

```ts
status: text("status", {
  enum: ["assigned", "requested", "confirmed", "rejected", "withdrawn"],
}).notNull().default("assigned"),
```

- Existing rows preserved. Enum widening is forward-compatible.

### 6. Permissions (`apps/admin/src/lib/permissions.ts`)

Add (the `BOOKING_*` core keys already exist post-[iter-24](iterations/done/iteration-24-rename-event-to-booking.md)):

- `BOOKING_OFFER_SEND` — admin only. Reserved for [iter-27](iteration-27-offer-flow.md) / [iter-28](iteration-28-offer-revisions-cancellation.md); add the key now so the permission catalog is stable.
- `BOOKING_ACCEPT_MANUAL` — admin only. Used by this iteration's manual-accept action.
- `BOOKING_REJECT` — admin only. Used by this iteration's reject action.
- `BOOKING_CANCEL` — admin only. Used by this iteration's cancel action.

Role mapping: all four assigned to `ADMIN`. No squad/customer-side surfaces.

### 7. Admin UI — booking detail page

- Booking detail page renders all new fields: customer contact (name/email/phone), date + `startTime` + `durationHours`, venue (name + city), comment.
- Status badge reflects the new enum values.
- For `createdBy IS NULL` rows: show a small "Public booking request" pill near the header.

### 8. Admin UI — pre-offer line-item editor

- Visible only when `status === 'created'`. Disabled (read-only render) otherwise.
- CRUD over `booking_service_selection` rows. Form fields: service picker (from `services WHERE archived = false`), quantity. `position` auto-assigned.
- Subtotal computed live on-screen (for admin reference) using current service prices — labeled "estimated"; the locked total only exists after offer-send.

### 9. Admin server actions

- `createBooking(input)` — existing, extended to accept the new fields. Status defaults to `created`. `offerToken` generated server-side.
- `updateBooking(bookingId, input)` — edits new fields. Status-aware: contact/venue/time editable in all non-terminal states; the line-item editor lives in its own action (`replaceBookingSelections`).
- `replaceBookingSelections(bookingId, selections: Array<{ serviceId, quantity }>)` — wholesale replace of `booking_service_selection` rows for the booking. Allowed only when `status === 'created'`. Permission: `BOOKING_UPDATE`.
- `adminAcceptOffer(bookingId)` — `created → accepted` directly (manual offline-agreed path), OR `offered → accepted` (admin acting on customer's behalf — the `offered` branch becomes useful in [iter-27](iteration-27-offer-flow.md)). Sets `acceptedAt`. Sends `offerAcceptedAdmin` email to customer. Permission: `BOOKING_ACCEPT_MANUAL`.

  Note: in this iteration `created → accepted` skips snapshot creation (no offer was ever sent). To keep the invariant "an accepted booking has a current `booking_service_item` snapshot" we **snapshot at admin-accept too**: read `booking_service_selection` rows, write `booking_service_item` rows at `offerVersion = 1`, set `offerVersion = 1`. This makes [iter-22](iterations/deferred/iteration-22-invoice-flow.md)'s invoicing path uniform regardless of whether the offer flow was used.

- `rejectBooking(bookingId, reason?)` — `created → rejected`. Permission: `BOOKING_REJECT`. Sends `bookingRejected` email to customer (if `customerEmail` set). [iter-28](iteration-28-offer-revisions-cancellation.md) extends to `offered → rejected`.
- `cancelBooking(bookingId, reason?)` — `accepted → cancelled`. Permission: `BOOKING_CANCEL`. Notifies any squad members assigned to the booking (status `assigned` or `confirmed`) via `notifyUser('bookingCancelled', ...)`. Notifies customer via email (`bookingCancelled` customer variant).

All server actions are smoke-tested per the [feature-slice template](../../admin-architecture/feature-slice-template.md).

### 10. Notification templates

Add (in `apps/admin/src/email-templates/`):

- `bookingRejected` — customer-only email. Short, polite, optional admin reason.
- `bookingCancelled` — variants for `recipient: 'customer' | 'squad' | 'admin'`. Used by both `cancelBooking` (this iteration) and [iter-28](iteration-28-offer-revisions-cancellation.md).
- `offerAcceptedAdmin` — customer-only email, sent when an admin manually accepts. Includes booking summary.

Each template colocates its `pushPayloadFor` export per the [iter-23](iterations/done/iteration-23-admin-pwa-web-push.md) convention. The squad-side `bookingCancelled` variant is push-eligible (squad member is an authed user).

### 11. Audit logging

- `booking.status.changed` audit entries for every transition, with `{ from, to, byUserId, reason? }` payload.
- `booking.selections.replaced` audit entry for `replaceBookingSelections`.

## Out of scope

- Customer-facing offer page — [iter-27](iteration-27-offer-flow.md).
- Public booking-request form — [iter-26](iteration-26-public-booking-request.md).
- `sendOffer` / `sendRevisedOffer` server actions and their UI buttons — [iter-27](iteration-27-offer-flow.md) / [iter-28](iteration-28-offer-revisions-cancellation.md).
- Squad confirm/decline flow — [iter-29](iteration-29-squad-assignment-confirmation.md).
- Reminder emails / day-before notifications — deferred indefinitely.
- Customer-history aggregation; offer-PDF generation; in-app message thread; Turnstile.

## Done when

- [x] Migration runs cleanly on a fresh DB and a copy of the prod schema. All backfilled rows have `offerToken` and the new `status` value.
- [x] `bookings`, `booking_service_item`, `booking_service_selection` schemas present in `packages/db/src/schema/`; exported from `index.ts`.
- [x] `services.description` is nullable; existing services unchanged.
- [x] `booking_assignments.status` enum accepts `confirmed` and `withdrawn` (validated by inserting test rows in a smoke test).
- [x] Admin booking detail page renders all new fields; pre-offer selection editor works for `created` bookings; disabled for non-`created`.
- [x] `adminAcceptOffer`, `rejectBooking`, `cancelBooking`, `replaceBookingSelections` implemented and gated by the new permissions.
- [x] `bookingRejected`, `bookingCancelled`, `offerAcceptedAdmin` email templates added; `bookingCancelled` push payload colocated.
- [x] No UI surface exposes "Send offer" or "Send revised offer" buttons.
- [x] Smoke tests cover every new server action (success + permission denial + state-precondition failure).
- [x] `npm run format` clean; `npm run verify` green.
- [ ] System deployable; manual smoke on a preview deploy confirms admin can create a booking, add line-item selections, manually accept, and cancel. _(requires human verification on preview deploy)_

## Post-merge follow-ups (from PR review)

- Renamed `booking_service_item.unit_price_cents` / `total_cents` to `unit_price` / `total` to match the whole-CHF integer convention used by `services.price`. The original `_cents` naming would have undercharged every snapshot by 100×.
- Wrapped `snapshotSelectionsToItems` + accept-status update and `replaceBookingSelections` delete+insert in `db.transaction(...)` for atomicity.
- Booking-detail lifecycle buttons now show when the user has any of accept/reject/cancel (not only accept).
