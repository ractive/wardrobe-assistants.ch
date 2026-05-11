import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Catalog of billable offerings the squad provides. Mutable (rename, reprice,
// archive) without affecting historical events — iter-22's event line items
// snapshot `name` / `description` / `priceType` / `unitPrice` at billing
// time. `archived` is the only deactivation path; no hard-delete UI exists.
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priceType: text("price_type", { enum: ["fixed", "hourly"] }).notNull(),
  price: integer("price").notNull(),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
