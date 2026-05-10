import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// Bookings the squad runs. `created_by` is nullable + ON DELETE SET NULL so a
// booking survives admin account deletion — losing the audit pointer is
// preferable to losing the booking row (assignments, history, etc. all hang
// off it). Cascade is the wrong default here.
export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  venue: text("venue").notNull(),
  notes: text("notes"),
  status: text("status", {
    enum: ["draft", "published", "cancelled", "done"],
  })
    .notNull()
    .default("draft"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
