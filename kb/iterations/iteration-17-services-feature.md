---
title: Iteration 17 — Services feature (catalog with archive)
type: iteration
order: 18
status: done
---

# Iteration 17 — Services feature

The catalogue of services the squad offers — "bring a sewing kit," "wardrobe assistant for X hours," etc. Names + descriptions + prices. Used by iter-22 (event billing) to compose **event line items** that are snapshotted onto the Event at agreement time.

## Domain language (project-wide)

This iteration locks in the ubiquitous language for the billing flow. The model is **event-centric** — no separate `Booking` / `Order` / `Invoice` aggregate. Every customer engagement is one Event; one event = one billing.

- **Event** — the occasion the squad serves (wedding, gala, …) and the agreement to serve it. Already exists (iter-16). Carries status: `enquired → confirmed → in_progress → delivered → invoiced → paid`. Status transitions land in iter-22.
- **Service** — a billable offering in this iteration's catalog. Mutable (rename, reprice, archive) without affecting historical Events.
- **Event line item** — a snapshotted Service on a specific Event. Immutable once set. Schema lands in iter-22; the **contract** for that schema is fixed in this iteration (see below).
- **Assignment** — who from the squad does what at the event (iter-16: `eventAssignments`).
- **Invoice** — *not a noun in our schema.* It's a verb: "invoice this event" renders the event's line items + totals into a printable doc. iter-22's job.

## Pre-flight

- [x] iter-16h merged.
- [x] Confirm with the user: single-event billing only (no aggregator across events) — recorded above.

## Schema — `packages/db/src/schema/services.ts`

```ts
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),                                       // stable, never reused (nanoid/cuid)
  name: text("name").notNull(),
  description: text("description").notNull(),                        // English only for now
  priceType: text("price_type", { enum: ["fixed", "hourly"] }).notNull(),
  price: integer("price").notNull(),                                 // whole CHF, no centimes
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
```

- **No `currency` column.** Switzerland-only, CHF-only. The "CHF" string lives in display formatting, not in storage.
- **No cents.** Prices are whole CHF integers. We will not bill in centimes for this domain.
- **`archived`** retires a service without deleting it. There is no hard-delete UI; archive is the only deactivation path. Mirrors Stripe's "you can't delete a price that's been used" rule.
- **`id`** is text + stable + never reused (already implicit since the project uses text PKs). Service IDs end up referenced informationally on event line items in iter-22; reusing an ID would silently rebind history.

Aggregator entry + migration in `packages/db/`.

### Permissions added to `lib/permissions.ts`

```ts
"SERVICE_CREATE", "SERVICE_DELETE",
```

ADMIN gets these via `new Set(PERMISSIONS)`; SQUAD_MEMBER does not. `SERVICE_DELETE` here means "archive" — there is no destructive delete.

## Contract for iter-22 — event line item snapshot pattern

iter-17 doesn't ship line items, but it locks in the **contract** so iter-22 (event billing) can't accidentally model line items as live joins onto `services`. The pattern matches Stripe (invoice line items snapshot `amount`/`description`/`quantity`; only `price`/`product` are kept as ID references) and Shopify (`title`, `variantTitle`, `originalUnitPriceSet` snapshotted "at time of order creation").

```ts
// iter-22 — event_line_items
{
  id: text,                                       // stable
  eventId: text,                                  // FK to events (live)
  serviceId: text | null,                         // FK to services — INFORMATIONAL ONLY, nullable

  // Snapshotted at line-item creation, immutable thereafter:
  name: text,                                     // service.name at billing time
  description: text,                              // service.description at billing time
  priceType: "fixed" | "hourly",
  unitPrice: integer,                             // whole CHF, snapshotted from service.price
  quantity: integer,                              // hours for hourly; 1 for fixed
  subtotal: integer,                              // unitPrice × quantity, computed at creation
  // tax / VAT — iter-22 decides
}
```

Consequences this contract guarantees:

- **Editing a service's price** never retroactively changes a historical event's billing.
- **Renaming a service** never changes what an old event line item says it billed for.
- **Archiving a service** never breaks an old event.
- **Hard-deleting a service** (not in scope but defensively): `serviceId` is nullable; the line item still renders correctly from its snapshot fields.

Industry-canonical pattern, citations: [Stripe invoice line item](https://docs.stripe.com/api/invoices/line_item) (snapshots `amount`/`description`; references `price` by ID; archived prices keep working in existing subscriptions). [Shopify Order LineItem](https://shopify.dev/docs/api/admin-graphql/latest/objects/LineItem) (snapshots `title`, `variantTitle`, `originalUnitPriceSet` "at time of order creation").

## Display format

- Fixed price: `CHF 123.-` (Swiss notation; the `.-` denotes "no centimes").
- Hourly price: `CHF 25.-/h` (Swiss/SI hourly suffix).
- A small `formatChf(price: number, type: "fixed" | "hourly"): string` helper in `apps/admin/src/features/services/format.ts`. Reused by every surface that renders a service or event line item. **No `Intl.NumberFormat` for CHF here** — its `de-CH` output is `CHF 25.00`, not the trade-standard `CHF 25.-`. Hand-rolled is shorter and exact.

## Scope — feature scaffold [3/3]

- [x] `apps/admin/src/features/services/{schema.ts, format.ts, server/, components/}`.
- [x] Biome per-feature override.
- [x] Route: `apps/admin/src/app/(dashboard)/services/page.tsx`. `assertPermission("SERVICE_CREATE")` (the page's read gate; squad members don't see the catalog management UI).

## Scope — Zod schemas [2/2]

- [x] `serviceInput`: `name` (≥1), `description` (≥1), `priceType` (enum `"fixed" | "hourly"`), `price` (positive integer, whole CHF).
- [x] `serviceListItem` output: `id`, `name`, `description`, `priceType`, `price`, `archived`, `createdAt` + computed `priceFormatted` (e.g. `"CHF 25.-"` / `"CHF 25.-/h"`) via the [type-contract pattern](../admin-architecture/data-layer.md). The `priceFormatted` field is the only thing the UI renders for prices — never read raw `price` in JSX.

## Scope — CRUD [4/4]

- [x] `createService` action — `withPermission("SERVICE_CREATE", ...)`.
- [x] `updateService` action — re-uses `SERVICE_CREATE` perm. Free to rename / reprice; iter-22 line items are unaffected by design.
- [x] `archiveService` action — uses `SERVICE_DELETE` perm. Sets `archived: true`. Soft delete only; no destructive delete path exists.
- [x] `listServices` query — defaults to `archived: false`; admin UI has a toggle to show archived.

## Scope — UI [3/3]

- [x] `<ServicesTable>` columns: Name, Type (fixed / hourly badge via `<StatusBadge kind="serviceType">`), Price (formatted), Status (active / archived). Cards on mobile, table on desktop per `design-system.md` §7. Actions menu: edit, archive (no delete). Confirm-dialog before archive.
- [x] `<ServiceDialog>` for create + edit. Form fields: name, description (textarea), priceType (radio: Fixed / Hourly), price (number input — whole CHF, validates positive integer). Submit lock + form-level error region per `design-system.md` §6.
- [x] Sidebar "Services" link in the Manage group (iter-16h's grouped nav), gated by `<HasPermission perm="SERVICE_CREATE">`. Icon: `Tag` from `lucide-react`.

## Scope — verify [4/4]

- [x] Schema validation tests: rejects negative `price`, rejects non-integer `price`, rejects invalid `priceType`, rejects empty `name` / `description`.
- [x] Smoke test (`services.smoke.test.ts` against the real auth + Drizzle path via `apps/admin/src/test/http-harness.ts`): admin can create / update / archive a service; SQUAD_MEMBER is denied on `SERVICE_CREATE` and `SERVICE_DELETE`. Mandatory per slice (iter-15c motivation).
- [x] Component tests: `ServicesTable` (active vs archived rendering, axe-clean), `ServiceDialog` (validation errors, submit disabled while pending, axe-clean) per `feature-slice-template.md`.
- [x] `npm run verify` green.

## Out of scope (deliberate)

- **Multilingual descriptions** — English only. DE/FR/IT follow if iter-5 (deferred) lands.
- **Service categories / taxonomy** — flat list.
- **Tax / VAT handling** — deferred to iter-22 (event billing).
- **Variable / tiered pricing** — single price per service.
- **Centimes / sub-CHF granularity** — domain rule: whole CHF only.
- **Currency other than CHF** — Switzerland-only project; CHF lives in display, not in storage.
- **Hard-delete UI for services** — archive is the only deactivation. Re-enter scope only with a clear use case.
- **Event line item table / billing flow** — iter-22. This iteration locks the snapshot **contract**, not the implementation.

## Done when

- [x] Admin can create / edit / archive services. SQUAD_MEMBER cannot reach `/services`.
- [x] Active services list excludes archived; toggle reveals archived.
- [x] Prices stored as whole-CHF integers; UI renders via `formatChf` as `CHF 25.-` (fixed) / `CHF 25.-/h` (hourly).
- [x] iter-22 contract recorded: event line items snapshot `name` / `description` / `priceType` / `unitPrice` at creation; `serviceId` is informational and nullable. Editing or archiving a service after the fact never retroactively changes a historical event.
- [x] `npm run verify` green.
