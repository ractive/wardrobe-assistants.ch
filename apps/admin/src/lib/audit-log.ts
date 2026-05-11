import { auditLog } from "@wardrobe-assistants/db/schema";
import { ulid } from "ulid";
import { db } from "./db";

// iter-16f / audit C-SEC-10: append-only audit log helper.
//
// Every mutating server action emits one row via this helper. The shape
// of `metadata` is deliberately opaque (JSON-encoded text in DB) so
// callers can include action-specific context without a schema change.
//
// `correlationId` (= the audit row's `id`) is returned so the caller can
// surface the same value in the user-facing toast and the structured
// server-side error log. That way, a support engineer who hears
// "ref WX1234" can grep server logs and pull the audit row in one shot.

export interface AuditLogEntry {
  actorUserId: string;
  action: AuditAction;
  // Optional pointer to the affected entity. `targetType` is the table
  // / domain noun ("user", "event"). `targetId` is the primary key.
  targetType?: string;
  targetId?: string;
  // Arbitrary JSON-serializable context. Kept small — we don't dump full
  // request bodies. Avoid PII beyond what's already in target* fields.
  metadata?: Record<string, unknown>;
}

// Catalog of audit-log actions. Centralizing the strings prevents typos
// and gives a quick map of "what mutating actions exist." Adding a new
// action is a one-line change here + a `auditLog(...)` emit at the call
// site.
export const AUDIT_ACTIONS = [
  "user.invite",
  "user.delete",
  "user.message",
  "booking.create",
  "booking.update",
  "booking.delete",
  "booking.status.changed",
  "booking.selections.replaced",
  "booking.assign",
  "booking.unassign",
  "booking.message_assignees",
  "booking.request_participation",
  "booking.approve_request",
  "booking.reject_request",
  "booking.offer.sent",
  "booking.offer.accepted",
  "booking.offer.revised",
  "booking.offer.snapshot.archived",
  "booking.offer.rejected",
  "service.create",
  "service.update",
  "service.archive",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Insert one audit-log row. Returns the row's ULID so the caller can
 * surface it as a correlation ID. Failures are logged but never thrown
 * — losing an audit row is preferable to user-visible 500s.
 */
export async function recordAudit(entry: AuditLogEntry): Promise<string> {
  const id = ulid();
  try {
    await db.insert(auditLog).values({
      id,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetId: entry.targetId ?? null,
      targetType: entry.targetType ?? null,
      metadata:
        entry.metadata !== undefined ? JSON.stringify(entry.metadata) : null,
      createdAt: new Date(),
    });
  } catch (err) {
    // Log only the structural fields — `entry.metadata` may carry
    // user-supplied PII (emails, etc.) that we don't want in stdout.
    console.error("[audit-log] failed to insert row", {
      id,
      action: entry.action,
      actorUserId: entry.actorUserId,
      targetType: entry.targetType,
      targetId: entry.targetId,
      err,
    });
  }
  return id;
}
