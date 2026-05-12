import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { services } from "./services";

// Bookings the squad runs. `created_by` is nullable + ON DELETE SET NULL so a
// booking survives admin account deletion — losing the audit pointer is
// preferable to losing the booking row (assignments, history, etc. all hang
// off it). Cascade is the wrong default here.
//
// Customer-submitted bookings (iter-26) have `createdBy IS NULL` and require
// the customer contact + venue + time fields at the application layer.
export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  venue: text("venue").notNull(),
  notes: text("notes"),
  status: text("status", {
    enum: ["created", "offered", "accepted", "rejected", "cancelled"],
  })
    .notNull()
    .default("created"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),

  // Stable per-booking offer token (v4 UUID). Used by the customer-facing
  // offer page in iter-27.
  offerToken: text("offer_token").notNull().unique(),
  offerVersion: integer("offer_version").notNull().default(0),
  lastOfferSentAt: integer("last_offer_sent_at", { mode: "timestamp_ms" }),
  acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
  invoicedAt: integer("invoiced_at", { mode: "timestamp_ms" }),

  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),

  startTime: text("start_time"), // "HH:MM"
  durationHours: integer("duration_hours"),
  city: text("city"),
  comment: text("comment"),

  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// Immutable snapshot of the line items that made up a particular offer
// version. Populated by `sendOffer` / `sendRevisedOffer` (iter-27/28) and by
// `adminAcceptOffer` when accepting a `created` booking with no prior offer.
// `serviceId` is ON DELETE SET NULL so deleting a service never destroys a
// historical offer; the snapshotted `name`/`description`/`priceType`/
// `unitPrice` carry the truth. Prices are whole-CHF integers (no centimes),
// matching the convention in `services.price` and the rest of the codebase.
export const bookingServiceItem = sqliteTable(
  "booking_service_item",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    offerVersion: integer("offer_version").notNull(),
    serviceId: text("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    priceType: text("price_type", { enum: ["fixed", "hourly"] }).notNull(),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    hoursInMinutes: integer("hours_in_minutes"),
    total: integer("total").notNull(),
    position: integer("position").notNull(),
  },
  (t) => ({
    bookingVersionPosition: index(
      "booking_service_item_booking_version_position_idx",
    ).on(t.bookingId, t.offerVersion, t.position),
  }),
);

// Mutable pre-offer line-item selection. Editable while the booking is in
// `created` (and per iter-28, `offered` for revisions). Cleared on cancel.
// `serviceId` is ON DELETE RESTRICT — admins must un-select a service before
// they can archive/delete it; this surfaces stale selections instead of
// silently losing them.
export const bookingServiceSelection = sqliteTable(
  "booking_service_selection",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    position: integer("position").notNull(),
  },
  (t) => ({
    bookingPosition: index("booking_service_selection_booking_position_idx").on(
      t.bookingId,
      t.position,
    ),
  }),
);
