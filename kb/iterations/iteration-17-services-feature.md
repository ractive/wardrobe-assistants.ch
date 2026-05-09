---
title: Iteration 17 — Services feature (CRUD with price types)
type: iteration
order: 18
status: planned
---

# Iteration 17 — Services feature

The catalogue of services the squad offers — "bring a sewing machine," "squad-member for X hours," etc. Names + descriptions + prices. Used by the iter-22 invoice flow to compose line items.

## Pre-flight

- [ ] iter-16 merged.
- [ ] Confirm price representation: cents (integer) for fixed prices, cents per hour for hourly. Currency CHF only for now.

## Schema — `packages/db/src/schema/services.ts`

```ts
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),                 // English only for now
  priceType: text("price_type", { enum: ["fixed", "hourly"] }).notNull(),
  priceCents: integer("price_cents").notNull(),               // cents (CHF) — fixed total or per-hour
  currency: text("currency").notNull().default("CHF"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
```

`archived` lets us retire a service without deleting it (preserves historical invoice line-items pointing at it). Aggregator entry + migration.

### Permissions to add to `lib/permissions.ts`

```ts
"SERVICE_CREATE", "SERVICE_DELETE",
```

ADMIN gets these automatically (`new Set(PERMISSIONS)`); SQUAD_MEMBER does not.

## Scope — feature scaffold [0/3]

- [ ] `apps/admin/src/features/services/{schema.ts, server/, components/}`.
- [ ] Biome per-feature override.
- [ ] Route: `apps/admin/src/app/(dashboard)/services/page.tsx`. `assertPermission("SERVICE_CREATE")`.

## Scope — Zod schemas [0/2]

- [ ] `serviceInput`: name (≥1), description (≥1), priceType (enum), priceCents (positive integer), currency (default "CHF").
- [ ] `serviceListItem` output: id, name, description, priceType, priceCents, currency, archived, createdAt + computed `priceFormatted` (e.g. "CHF 25.00" or "CHF 25.00/hr") via the [type-contract pattern](../admin-architecture/data-layer.md).

## Scope — CRUD [0/4]

- [ ] `createService` action — `withPermission("SERVICE_CREATE", ...)`.
- [ ] `updateService` action — re-use SERVICE_CREATE perm.
- [ ] `archiveService` action — re-use SERVICE_DELETE perm. Sets `archived: true`. Soft delete (preserves historical refs).
- [ ] `listServices` query — defaults to `archived: false`; admin UI has a toggle to show archived.

## Scope — UI [0/3]

- [ ] `<ServicesTable>` with columns: Name, Type (fixed/hourly badge), Price, Status (active/archived). Actions menu: edit, archive.
- [ ] `<ServiceDialog>` for create/edit. Form fields: name, description (textarea), priceType (radio: fixed/hourly), priceCents (number input, in CHF — show as decimal but store as cents).
- [ ] Sidebar link gated by `<HasPermission perm="SERVICE_CREATE">`.

## Scope — verify [0/4]

- [ ] Schema validation tests: rejects negative prices, invalid priceType.
- [ ] Smoke test (`services.smoke.test.ts` against the real auth + Drizzle
  path via `apps/admin/src/test/http-harness.ts`): admin can create / update /
  archive a service; SQUAD_MEMBER is denied on `SERVICE_CREATE`. Mandatory
  per slice (iter-15c motivation; iter-16 did the same).
- [ ] Manual: create both a fixed and an hourly service, edit them, archive one, confirm it's hidden by default.
- [ ] `npm run verify` green.

## Out of scope (deliberate)

- **Multilingual descriptions** — English only. DE/FR follow if iter-5 (still deferred) lands.
- **Service categories / taxonomy** — flat list for now.
- **Tax / VAT handling** — deferred to iter-22 (invoice flow).
- **Variable / tiered pricing** — single price per service.
- **Service-level photos / illustrations** — deferred.

## Done when

- [ ] Admin can create / edit / archive services.
- [ ] Active services list excludes archived; toggle to view archived.
- [ ] Prices stored as integer cents; UI formats as "CHF 25.00" or "CHF 25.00/hr".
- [ ] Permission gates working (SQUAD_MEMBER can't reach `/services`).
- [ ] `npm run verify` green.
