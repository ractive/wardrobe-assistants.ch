import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { bookings } from "./bookings";

export const bookingAssignments = sqliteTable(
  "booking_assignments",
  {
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", {
      enum: ["assigned", "requested", "confirmed", "rejected", "withdrawn"],
    })
      .notNull()
      .default("assigned"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bookingId, t.userId] }),
  }),
);
