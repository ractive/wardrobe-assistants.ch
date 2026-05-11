"use server";

import {
  bookingAssignments,
  bookings,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notifyAdmins } from "@/lib/notify";
import { withPermission } from "@/lib/permissions";
import {
  type ActionResult,
  type ConfirmAssignmentInput,
  confirmAssignmentInput,
  type DeclineAssignmentInput,
  declineAssignmentInput,
  type WithdrawAssignmentInput,
  withdrawAssignmentInput,
} from "../schema";

// iter-29: squad-member-driven assignment lifecycle (confirm / decline /
// withdraw). Each action is permission-gated and additionally enforces the
// `userId === actorId` invariant via the WHERE clause of every conditional
// UPDATE — a squad member can only mutate their own assignment row.

async function fetchSquadDisplayName(userId: string): Promise<string> {
  const rows = await db
    .select({
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      nickname: userProfile.nickname,
    })
    .from(userProfile)
    .where(eq(userProfile.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return "A squad member";
  const nick = row.nickname?.trim();
  if (nick) return nick;
  return `${row.firstName} ${row.lastName}`.trim() || "A squad member";
}

async function fetchBookingForNotify(bookingId: string) {
  const rows = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      date: bookings.date,
      venue: bookings.venue,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  return rows[0] ?? null;
}

export const confirmAssignment = withPermission(
  "SQUAD_CONFIRM_ASSIGNMENT",
  async (actorId, raw: ConfirmAssignmentInput): Promise<ActionResult> => {
    const parsed = confirmAssignmentInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { bookingId } = parsed.data;

    const result = await db.transaction(async (tx) => {
      // Confirm is valid from `assigned`, `rejected` (changed-my-mind after
      // decline), or `withdrawn` (re-confirm after withdrawal). Branch by
      // conditional UPDATE so we can report which prior state the actor
      // came from without trusting a pre-tx read.
      const now = new Date();
      for (const from of ["assigned", "rejected", "withdrawn"] as const) {
        const updated = await tx
          .update(bookingAssignments)
          .set({ status: "confirmed", confirmedAt: now })
          .where(
            and(
              eq(bookingAssignments.bookingId, bookingId),
              eq(bookingAssignments.userId, actorId),
              eq(bookingAssignments.status, from),
            ),
          )
          .returning({ userId: bookingAssignments.userId });
        if (updated.length === 1) {
          return { changed: true as const, fromStatus: from };
        }
      }

      const existing = await tx.query.bookingAssignments.findFirst({
        where: and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, actorId),
        ),
      });
      if (!existing)
        return { changed: false as const, reason: "not-found" as const };
      if (existing.status === "confirmed") {
        return { changed: false as const, reason: "idempotent" as const };
      }
      return { changed: false as const, reason: "conflict" as const };
    });

    if (!result.changed) {
      if (result.reason === "not-found") {
        return { error: true, message: "Assignment not found." };
      }
      if (result.reason === "idempotent") {
        revalidatePath(`/my-bookings/${bookingId}`);
        return { error: false, message: "Already confirmed." };
      }
      return {
        error: true,
        message: "Cannot confirm in current state.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "assignment.confirmed",
      targetType: "booking_assignment",
      targetId: bookingId,
      metadata: { fromStatus: result.fromStatus, userId: actorId },
    });

    try {
      const booking = await fetchBookingForNotify(bookingId);
      if (booking) {
        const squadMemberName = await fetchSquadDisplayName(actorId);
        await notifyAdmins("assignmentConfirmed", {
          recipientName: "Admin",
          bookingName: booking.name,
          bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
          bookingVenue: booking.venue,
          squadMemberName,
          bookingUrl: `${env.betterAuthUrl}/bookings/${bookingId}`,
        });
      }
    } catch (err) {
      console.error("confirmAssignment: notify failed", err);
    }

    revalidatePath("/my-bookings");
    revalidatePath(`/my-bookings/${bookingId}`);
    return { error: false, message: "Assignment confirmed." };
  },
);

export const declineAssignment = withPermission(
  "SQUAD_DECLINE_ASSIGNMENT",
  async (actorId, raw: DeclineAssignmentInput): Promise<ActionResult> => {
    const parsed = declineAssignmentInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { bookingId } = parsed.data;

    const result = await db.transaction(async (tx) => {
      // Decline is valid from `assigned` or `confirmed`. Branch so audit gets
      // the correct prior state regardless of a stale pre-tx read.
      for (const from of ["assigned", "confirmed"] as const) {
        const updated = await tx
          .update(bookingAssignments)
          .set({ status: "rejected" })
          .where(
            and(
              eq(bookingAssignments.bookingId, bookingId),
              eq(bookingAssignments.userId, actorId),
              eq(bookingAssignments.status, from),
            ),
          )
          .returning({ userId: bookingAssignments.userId });
        if (updated.length === 1) {
          return { changed: true as const, fromStatus: from };
        }
      }

      const existing = await tx.query.bookingAssignments.findFirst({
        where: and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, actorId),
        ),
      });
      if (!existing)
        return { changed: false as const, reason: "not-found" as const };
      if (existing.status === "rejected") {
        return { changed: false as const, reason: "idempotent" as const };
      }
      return { changed: false as const, reason: "conflict" as const };
    });

    if (!result.changed) {
      if (result.reason === "not-found") {
        return { error: true, message: "Assignment not found." };
      }
      if (result.reason === "idempotent") {
        revalidatePath(`/my-bookings/${bookingId}`);
        return { error: false, message: "Already declined." };
      }
      return {
        error: true,
        message: "Cannot decline in current state.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "assignment.declined",
      targetType: "booking_assignment",
      targetId: bookingId,
      metadata: { fromStatus: result.fromStatus, userId: actorId },
    });

    try {
      const booking = await fetchBookingForNotify(bookingId);
      if (booking) {
        const squadMemberName = await fetchSquadDisplayName(actorId);
        await notifyAdmins("assignmentDeclined", {
          recipientName: "Admin",
          bookingName: booking.name,
          bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
          bookingVenue: booking.venue,
          squadMemberName,
          fromStatus: result.fromStatus,
          bookingUrl: `${env.betterAuthUrl}/bookings/${bookingId}`,
        });
      }
    } catch (err) {
      console.error("declineAssignment: notify failed", err);
    }

    revalidatePath("/my-bookings");
    revalidatePath(`/my-bookings/${bookingId}`);
    return { error: false, message: "Assignment declined." };
  },
);

export const withdrawAssignment = withPermission(
  "SQUAD_WITHDRAW_ASSIGNMENT",
  async (actorId, raw: WithdrawAssignmentInput): Promise<ActionResult> => {
    const parsed = withdrawAssignmentInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { bookingId, reason } = parsed.data;

    const result = await db.transaction(async (tx) => {
      // Withdraw is only valid from `confirmed`.
      const now = new Date();
      const updated = await tx
        .update(bookingAssignments)
        .set({ status: "withdrawn", withdrawnAt: now })
        .where(
          and(
            eq(bookingAssignments.bookingId, bookingId),
            eq(bookingAssignments.userId, actorId),
            eq(bookingAssignments.status, "confirmed"),
          ),
        )
        .returning({ userId: bookingAssignments.userId });
      if (updated.length === 1) return { changed: true as const };

      const existing = await tx.query.bookingAssignments.findFirst({
        where: and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, actorId),
        ),
      });
      if (!existing)
        return { changed: false as const, reason: "not-found" as const };
      if (existing.status === "withdrawn") {
        return { changed: false as const, reason: "idempotent" as const };
      }
      return { changed: false as const, reason: "conflict" as const };
    });

    if (!result.changed) {
      if (result.reason === "not-found") {
        return { error: true, message: "Assignment not found." };
      }
      if (result.reason === "idempotent") {
        revalidatePath(`/my-bookings/${bookingId}`);
        return { error: false, message: "Already withdrawn." };
      }
      return {
        error: true,
        message: "Withdrawal is only allowed after confirming.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "assignment.withdrawn",
      targetType: "booking_assignment",
      targetId: bookingId,
      metadata: { userId: actorId, reason: reason ?? null },
    });

    try {
      const booking = await fetchBookingForNotify(bookingId);
      if (booking) {
        const squadMemberName = await fetchSquadDisplayName(actorId);
        await notifyAdmins("assignmentWithdrawn", {
          recipientName: "Admin",
          bookingName: booking.name,
          bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
          bookingVenue: booking.venue,
          squadMemberName,
          reason,
          bookingUrl: `${env.betterAuthUrl}/bookings/${bookingId}`,
        });
      }
    } catch (err) {
      console.error("withdrawAssignment: notify failed", err);
    }

    revalidatePath("/my-bookings");
    revalidatePath(`/my-bookings/${bookingId}`);
    return { error: false, message: "Assignment withdrawn." };
  },
);
