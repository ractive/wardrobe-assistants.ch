import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Append-only audit log of mutating actions.
//
// Closes audit C-SEC-10. Cheap, high-value compliance/IR primitive: when
// "who did X, when?" comes up (incident response, support, retro) we no
// longer have to reconstruct it from scattered logs.
//
// Notes:
//   - `actor_user_id` deliberately has no FK reference. The audit trail
//     must outlive the actor — deleting a user must not blank out their
//     history.
//   - `metadata` is opaque JSON-encoded text. Schema lives at the helper
//     layer (`apps/admin/src/lib/audit-log.ts`), not here, so adding a
//     new field is a one-file change.
//   - No automatic `id` default at the DB level — the helper assigns a
//     ULID from the application side so the same value can also be
//     surfaced as a correlation ID in user-facing toasts and server logs.
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id"),
  targetType: text("target_type"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
