import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// Events the squad runs. `created_by` is nullable + ON DELETE SET NULL so an
// event survives admin account deletion — losing the audit pointer is
// preferable to losing the event row (assignments, history, etc. all hang
// off it). Cascade is the wrong default here.
export const events = sqliteTable("events", {
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

export const eventAssignments = sqliteTable(
  "event_assignments",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.userId] }),
  }),
);
