import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// Domain-side profile, 1:1 with Better Auth's `user` table. Holds first/last
// name, role, status — fields that don't belong in the auth-provider table.
// See kb/admin-architecture/data-layer.md for the rationale.

export const userProfile = sqliteTable("user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  nickname: text("nickname"),
  mobileNumber: text("mobile_number"),
  role: text("role", { enum: ["ADMIN", "SQUAD_MEMBER"] }).notNull(),
  status: text("status", { enum: ["invited", "verified"] })
    .notNull()
    .default("invited"),
  invitedAt: integer("invited_at", { mode: "timestamp_ms" }).notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
});
