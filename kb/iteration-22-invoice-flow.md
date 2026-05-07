---
title: Iteration 22 — Invoice flow (event invoicing with services)
type: iteration
order: 23
status: planned
---

# Iteration 22 — Invoice flow

The user's original spec said: "Create an invoice for an event by picking services and their amount (number of services or hours of the service used) — but the details will be discussed later." This is later.

## Open questions to resolve at iteration kickoff

- **Customer / recipient model.** Events have a venue, but invoices need a billable entity. Add a `customers` table 1-to-many with events? Or attach customer info per event? (Likely: `customers` table; events optionally link to a customer.)
- **Line item shape.** `{ serviceId, quantity, priceCents (snapshot at invoice time), notes }`. Snapshot the price so historical invoices stay correct when service prices change.
- **Hours vs units.** Hourly services need `hours` as a decimal (e.g., 2.5). Fixed services need `quantity` as integer. One field with semantic meaning per type, or two columns?
- **Tax / VAT.** Switzerland has 8.1% standard VAT (as of 2024). Are squad services VAT-applicable? Threshold for VAT registration is CHF 100k turnover/year. Below that → no VAT line. Above → calculate + show.
- **Numbering.** Sequential per year (e.g. `2026-001`)? Reserved when started or assigned at finalisation?
- **Statuses.** `draft` → `sent` → `paid`? Or simpler: `draft` / `final`?
- **PDF rendering.** React-pdf? Puppeteer? Browser-print? Server-side template with HTML→PDF via a service?
- **Email-the-invoice flow.** Send to customer with PDF attached? Just a "view invoice" link?
- **Editing after sending.** Lock fields once `status: sent`? Allow corrections via a "credit note"?
- **Recurring invoices.** Spec doesn't mention but worth confirming.
- **Currency.** CHF only — confirmed. EUR / multi-currency is future.

## Provisional schema sketch

```ts
// packages/db/src/schema/invoices.ts
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  address: text("address"),
  vatId: text("vat_id"),                                       // optional Swiss UID-MWST number
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),                   // e.g. "2026-001"
  customerId: text("customer_id").notNull().references(() => customers.id),
  eventId: text("event_id").references(() => events.id),       // optional link
  status: text("status", { enum: ["draft", "sent", "paid", "void"] }).notNull().default("draft"),
  currency: text("currency").notNull().default("CHF"),
  vatRate: integer("vat_rate_bp"),                              // basis points (e.g. 810 = 8.10%)
  subtotalCents: integer("subtotal_cents").notNull(),
  vatCents: integer("vat_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }),
})

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => services.id),  // null if free-form line
  description: text("description").notNull(),                   // snapshot
  priceType: text("price_type", { enum: ["fixed", "hourly"] }).notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),         // snapshot
  quantity: integer("quantity").notNull(),                       // units (fixed) or 1
  hours: integer("hours_in_minutes"),                            // hours stored as minutes for integer math (hourly only)
  totalCents: integer("total_cents").notNull(),                  // computed at insert
  position: integer("position").notNull(),                       // ordering within the invoice
})
```

## Provisional scope

- `features/invoices/` feature folder (CRUD, customer picker, line-item builder).
- PDF rendering: probably `@react-pdf/renderer` (no headless browser dep) — evaluate at impl time.
- Numbering: sequential per year, allocated at `status: sent` transition (not at draft creation, to avoid gaps).
- `messageEventAssignees` extended to "send invoice to customer" via the email service.
- VAT calculator: simple, configurable rate, off by default (assume below registration threshold).
- Permissions: `INVOICE_CREATE`, `INVOICE_SEND`, `INVOICE_DELETE`. ADMIN-only.

## Out of scope

- **Online payments** (Stripe / TWINT / QR-bill via PostFinance) — no payment integration.
- **Multi-currency.**
- **Recurring invoices.**
- **Customer portal** (customers signing in to see their invoices).
- **Accounting integration** (Bexio, Banana, etc.).
- **Credit notes / refunds.** Manual via void + new invoice for now.

## Done when

(Filled in at iteration kickoff.)
