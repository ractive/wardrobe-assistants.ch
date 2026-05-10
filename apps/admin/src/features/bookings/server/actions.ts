"use server";

import {
  bookingAssignments,
  bookings,
  user,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ulid } from "ulid";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notifyUser } from "@/lib/notify";
import { withPermission } from "@/lib/permissions";
import {
  type ActionResult,
  type ApproveRequestInput,
  type AssignUserInput,
  approveRequestInput,
  assignUserInput,
  type CreateBookingInput,
  createBookingInput,
  type DeleteBookingInput,
  deleteBookingInput,
  type MessageBookingAssigneesInput,
  messageBookingAssigneesInput,
  type RejectRequestInput,
  type RequestParticipationInput,
  rejectRequestInput,
  requestParticipationInput,
  type UnassignUserInput,
  type UpdateBookingInput,
  unassignUserInput,
  updateBookingInput,
} from "../schema";

export const createBooking = withPermission(
  "BOOKING_CREATE",
  async (actorId, raw: CreateBookingInput): Promise<ActionResult> => {
    const parsed = createBookingInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;
    const now = new Date();
    const id = ulid();
    await db.insert(bookings).values({
      id,
      name: input.name,
      date: input.date,
      venue: input.venue,
      notes: input.notes ?? null,
      status: input.status,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit({
      actorUserId: actorId,
      action: "booking.create",
      targetType: "booking",
      targetId: id,
    });
    revalidatePath("/bookings");
    return { error: false, message: "Booking created." };
  },
);

export const updateBooking = withPermission(
  "BOOKING_CREATE",
  async (actorId, raw: UpdateBookingInput): Promise<ActionResult> => {
    const parsed = updateBookingInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;
    const updated = await db
      .update(bookings)
      .set({
        name: input.name,
        date: input.date,
        venue: input.venue,
        notes: input.notes ?? null,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, input.bookingId))
      .returning({ id: bookings.id });
    if (updated.length === 0) {
      return { error: true, message: "Booking not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "booking.update",
      targetType: "booking",
      targetId: input.bookingId,
    });
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${input.bookingId}`);
    return { error: false, message: "Booking updated." };
  },
);

export const deleteBooking = withPermission(
  "BOOKING_DELETE",
  async (actorId, raw: DeleteBookingInput): Promise<ActionResult> => {
    const parsed = deleteBookingInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const deleted = await db
      .delete(bookings)
      .where(eq(bookings.id, parsed.data.bookingId))
      .returning({ id: bookings.id });
    if (deleted.length === 0) {
      return { error: true, message: "Booking not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "booking.delete",
      targetType: "booking",
      targetId: parsed.data.bookingId,
    });
    revalidatePath("/bookings");
    return { error: false, message: "Booking deleted." };
  },
);

export const assignUser = withPermission(
  "BOOKING_ASSIGN",
  async (actorId, raw: AssignUserInput): Promise<ActionResult> => {
    const parsed = assignUserInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { bookingId, userId } = parsed.data;

    const bookingRows = await db
      .select({
        id: bookings.id,
        name: bookings.name,
        date: bookings.date,
        venue: bookings.venue,
        notes: bookings.notes,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking) {
      return { error: true, message: "Booking not found." };
    }

    const userRows = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const target = userRows[0];
    if (!target) {
      return { error: true, message: "User not found." };
    }

    // Existing row check: a pre-existing row in `requested`/`rejected` state
    // is flipped to `assigned` so an admin assigning directly always wins.
    // If the row was already `assigned`, this is a no-op and we skip the
    // notification email.
    const existingRows = await db
      .select({ status: bookingAssignments.status })
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, userId),
        ),
      )
      .limit(1);
    const existing = existingRows[0];

    if (existing?.status === "assigned") {
      revalidatePath(`/bookings/${bookingId}`);
      return { error: false, message: "User was already assigned." };
    }

    if (existing) {
      await db
        .update(bookingAssignments)
        .set({ status: "assigned", assignedAt: new Date() })
        .where(
          and(
            eq(bookingAssignments.bookingId, bookingId),
            eq(bookingAssignments.userId, userId),
          ),
        );
    } else {
      await db.insert(bookingAssignments).values({
        bookingId,
        userId,
        assignedAt: new Date(),
        status: "assigned",
      });
    }
    await recordAudit({
      actorUserId: actorId,
      action: "booking.assign",
      targetType: "booking",
      targetId: bookingId,
      metadata: { userId },
    });

    // Best-effort notification: a transient failure must not roll back the
    // assignment row. notifyUser fires both email and push; a single-channel
    // failure is logged and resolves successfully, but it throws an
    // AggregateError when *both* channels fail so we surface a soft warning.
    let notifyFailed = false;
    try {
      await notifyUser(userId, "bookingAssigned", {
        recipientName: target.name ?? target.email,
        bookingName: booking.name,
        bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
        bookingVenue: booking.venue,
        bookingNotes: booking.notes ?? undefined,
        bookingUrl: `${env.betterAuthUrl}/bookings/${booking.id}`,
      });
    } catch (err) {
      notifyFailed = true;
      console.error("assignUser: failed to send notification", err);
    }

    revalidatePath(`/bookings/${bookingId}`);
    if (notifyFailed) {
      return {
        error: false,
        message: "Assigned, but notification failed to send.",
      };
    }
    return { error: false, message: "User assigned." };
  },
);

export const unassignUser = withPermission(
  "BOOKING_ASSIGN",
  async (actorId, raw: UnassignUserInput): Promise<ActionResult> => {
    const parsed = unassignUserInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { bookingId, userId } = parsed.data;
    const deleted = await db
      .delete(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, userId),
        ),
      )
      .returning({ userId: bookingAssignments.userId });
    if (deleted.length === 0) {
      return { error: true, message: "Assignment not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "booking.unassign",
      targetType: "booking",
      targetId: bookingId,
      metadata: { userId },
    });
    revalidatePath(`/bookings/${bookingId}`);
    return { error: false, message: "User unassigned." };
  },
);

export const messageBookingAssignees = withPermission(
  "BOOKING_MESSAGE_ASSIGNED",
  async (actorId, raw: MessageBookingAssigneesInput): Promise<ActionResult> => {
    const parsed = messageBookingAssigneesInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;

    const bookingRows = await db
      .select({ id: bookings.id, name: bookings.name })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);
    const bookingRow = bookingRows[0];
    if (!bookingRow) {
      return { error: true, message: "Booking not found." };
    }

    const recipients = await db
      .select({ userId: bookingAssignments.userId, email: user.email })
      .from(bookingAssignments)
      .innerJoin(user, eq(user.id, bookingAssignments.userId))
      .where(eq(bookingAssignments.bookingId, input.bookingId));

    if (recipients.length === 0) {
      return {
        error: true,
        message: "No assignees on this booking.",
      };
    }

    // Sanitize CR/LF from caller-supplied subject (header injection guard,
    // mirrors the pattern from requestParticipation's safeBookingName).
    const safeSubject = input.subject.replace(/[\r\n]+/g, " ");

    // Fan out via notifyUser — both email and push per recipient.
    // notifyUser only rejects when *both* channels fail for that recipient,
    // so `failed` here counts recipients who received nothing. Single-channel
    // failures are logged inside notifyUser and resolve as fulfilled.
    const results = await Promise.allSettled(
      recipients.map((r) =>
        notifyUser(r.userId, "bookingBroadcast", {
          subject: safeSubject,
          bookingName: bookingRow.name,
          body: input.body,
        }),
      ),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (sent === 0) {
      const correlationId = await recordAudit({
        actorUserId: actorId,
        action: "booking.message_assignees",
        targetType: "booking",
        targetId: input.bookingId,
        metadata: { sent, failed, outcome: "all_failed" },
      });
      return {
        error: true,
        message: `Could not send to any assignee. (ref ${correlationId})`,
      };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "booking.message_assignees",
      targetType: "booking",
      targetId: input.bookingId,
      metadata: { sent, failed },
    });
    if (failed > 0) {
      return {
        error: false,
        message: `Sent to ${sent} of ${sent + failed} assignees.`,
      };
    }
    return { error: false, message: `Sent to ${sent} assignees.` };
  },
);

export const requestParticipation = withPermission(
  "SQUAD_REQUEST_PARTICIPATION",
  async (actorId, raw: RequestParticipationInput): Promise<ActionResult> => {
    const parsed = requestParticipationInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { bookingId } = parsed.data;

    const bookingRows = await db
      .select({
        id: bookings.id,
        name: bookings.name,
        status: bookings.status,
        date: bookings.date,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking) {
      return { error: true, message: "Booking not found." };
    }
    if (booking.status !== "published") {
      return {
        error: true,
        message: "You can only request participation on published bookings.",
      };
    }
    if (booking.date < new Date()) {
      return { error: true, message: "This booking is in the past." };
    }

    // Idempotent: if a row already exists (any status), do nothing — and
    // skip the audit record + admin email fan-out so repeated clicks don't
    // spam admins.
    const inserted = await db
      .insert(bookingAssignments)
      .values({
        bookingId,
        userId: actorId,
        assignedAt: new Date(),
        status: "requested",
      })
      .onConflictDoNothing()
      .returning({ userId: bookingAssignments.userId });

    if (inserted.length === 0) {
      return { error: false, message: "Participation already recorded." };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "booking.request_participation",
      targetType: "booking",
      targetId: bookingId,
    });

    // Fan-out email to all admins — best-effort, per-recipient try/catch.
    const adminRows = await db
      .select({ id: user.id, email: user.email })
      .from(userProfile)
      .innerJoin(user, eq(user.id, userProfile.userId))
      .where(eq(userProfile.role, "ADMIN"));

    // Fetch the actor's display name for the email body.
    const actorProfileRows = await db
      .select({
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        nickname: userProfile.nickname,
        email: user.email,
      })
      .from(userProfile)
      .innerJoin(user, eq(user.id, userProfile.userId))
      .where(eq(userProfile.userId, actorId))
      .limit(1);
    const actorProfile = actorProfileRows[0];
    const actorName = actorProfile
      ? actorProfile.nickname?.trim() ||
        `${actorProfile.firstName} ${actorProfile.lastName}`.trim()
      : actorId;

    // Defense-in-depth: strip CR/LF from interpolated values before they
    // reach the email subject (mirrors the `messageBookingAssigneesInput`
    // guard from audit C-SEC-07).
    const safeBookingName = booking.name.replace(/[\r\n]+/g, " ");
    const safeActorName = actorName.replace(/[\r\n]+/g, " ");
    const reviewUrl = `${env.betterAuthUrl}/bookings/${booking.id}`;
    const bookingDateStr = format(booking.date, "EEEE, d MMMM yyyy");
    // Best-effort fan-out to all admins via notifyUser — both email and push.
    // Errors are logged but must not prevent the participation request from
    // being recorded. Awaited so serverless runtimes don't terminate before
    // the fan-out completes.
    if (adminRows.length > 0) {
      await Promise.allSettled(
        adminRows.map((admin) =>
          notifyUser(admin.id, "participationRequested", {
            actorName: safeActorName,
            bookingName: safeBookingName,
            bookingDate: bookingDateStr,
            reviewUrl,
          }),
        ),
      );
    }

    revalidatePath("/upcoming-bookings");
    revalidatePath("/my-bookings");
    return { error: false, message: "Participation request sent." };
  },
);

export const approveRequest = withPermission(
  "BOOKING_APPROVE_REQUEST",
  async (actorId, raw: ApproveRequestInput): Promise<ActionResult> => {
    const parsed = approveRequestInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { bookingId, userId } = parsed.data;

    const updated = await db
      .update(bookingAssignments)
      .set({ status: "assigned" })
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, userId),
          eq(bookingAssignments.status, "requested"),
        ),
      )
      .returning({ userId: bookingAssignments.userId });

    if (updated.length === 0) {
      return {
        error: true,
        message: "No pending request found for this user on this booking.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "booking.approve_request",
      targetType: "booking",
      targetId: bookingId,
      metadata: { userId },
    });

    // Send the same "you've been assigned" email — best-effort.
    const bookingRows = await db
      .select({
        name: bookings.name,
        date: bookings.date,
        venue: bookings.venue,
        notes: bookings.notes,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];

    const userRows = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const target = userRows[0];

    let notifyFailed = false;
    if (booking) {
      try {
        await notifyUser(userId, "bookingAssigned", {
          recipientName: target?.name ?? target?.email ?? userId,
          bookingName: booking.name,
          bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
          bookingVenue: booking.venue,
          bookingNotes: booking.notes ?? undefined,
          bookingUrl: `${env.betterAuthUrl}/bookings/${bookingId}`,
        });
      } catch (err) {
        notifyFailed = true;
        console.error("approveRequest: failed to send notification", err);
      }
    }

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/my-bookings");
    revalidatePath("/upcoming-bookings");
    if (notifyFailed) {
      return {
        error: false,
        message: "Request approved, but notification failed to send.",
      };
    }
    return { error: false, message: "Request approved." };
  },
);

export const rejectRequest = withPermission(
  "BOOKING_APPROVE_REQUEST",
  async (actorId, raw: RejectRequestInput): Promise<ActionResult> => {
    const parsed = rejectRequestInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { bookingId, userId } = parsed.data;

    const updated = await db
      .update(bookingAssignments)
      .set({ status: "rejected" })
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          eq(bookingAssignments.userId, userId),
          eq(bookingAssignments.status, "requested"),
        ),
      )
      .returning({ userId: bookingAssignments.userId });

    if (updated.length === 0) {
      return {
        error: true,
        message: "No pending request found for this user on this booking.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "booking.reject_request",
      targetType: "booking",
      targetId: bookingId,
      metadata: { userId },
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/my-bookings");
    revalidatePath("/upcoming-bookings");
    return { error: false, message: "Request rejected." };
  },
);
