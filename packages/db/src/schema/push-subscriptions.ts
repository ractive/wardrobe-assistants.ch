import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(), // ulid
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(), // browser-issued push endpoint URL
  p256dh: text("p256dh").notNull(), // public key
  auth: text("auth").notNull(), // auth secret
  userAgent: text("user_agent"), // best-effort device label
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
});
