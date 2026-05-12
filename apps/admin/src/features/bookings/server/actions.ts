"use server";

import {
  bookingAssignments,
  bookingServiceItem,
  bookingServiceSelection,
  bookings,
  services,
  user,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { format } from "date-fns";
import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ulid } from "ulid";
import { recordAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { sendTemplated } from "@/lib/email";
import { env } from "@/lib/env";
import { notifyUser } from "@/lib/notify";
import { withPermission } from "@/lib/permissions";
import {
  type ActionResult,
  type ApproveRequestInput,
  type AssignUserInput,
  approveRequestInput,
  assignUserInput,
  type CancelBookingInput,
  type CreateBookingInput,
  cancelBookingInput,
  createBookingInput,
  type DeleteBookingInput,
  deleteBookingInput,
  type MessageBookingAssigneesInput,
  messageBookingAssigneesInput,
  type RejectBookingInput,
  type RejectRequestInput,
  type ReplaceBookingSelectionsInput,
  type RequestParticipationInput,
  rejectBookingInput,
  rejectRequestInput,
  replaceBookingSelectionsInput,
  requestParticipationInput,
  type UnassignUserInput,
  type UpdateBookingInput,
  unassignUserInput,
  updateBookingInput,
} from "../schema";

// v4 UUID generator using crypto.randomUUID (Node 19+, Edge runtime safe).
function newOfferToken(): string {
  return crypto.randomUUID();
}

// Format the snapshot subtotal for the admin-accept confirmation email.
// Totals are whole CHF integers (matching `services.price`); no centimes.
function formatChfTotal(total: number): string {
  return `CHF ${total.toLocaleString("en-CH")}.-`;
}

// Compute a snapshot line's total given service price + quantity + duration.
// Hourly services multiply by minutes/60. Prices are whole CHF integers.
function computeLineTotal(
  priceType: "fixed" | "hourly",
  unitPrice: number,
  quantity: number,
  hoursInMinutes: number | null,
): number {
  if (priceType === "hourly") {
    const minutes = hoursInMinutes ?? 0;
    return Math.round((unitPrice * quantity * minutes) / 60);
  }
  return unitPrice * quantity;
}

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
      status: "created",
      createdBy: actorId,
      offerToken: newOfferToken(),
      offerVersion: 0,
      customerName: input.customerName ?? null,
      customerEmail: input.customerEmail ?? null,
      customerPhone: input.customerPhone ?? null,
      startTime: input.startTime ?? null,
      durationHours: input.durationHours ?? null,
      venueName: input.venueName ?? null,
      venueCity: input.venueCity ?? null,
      comment: input.comment ?? null,
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
    // Terminal-state guard: rejected/cancelled bookings are read-only.
    const existingRows = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      return { error: true, message: "Booking not found." };
    }
    if (existing.status === "rejected" || existing.status === "cancelled") {
      return {
        error: true,
        message: "This booking has been closed and can no longer be edited.",
      };
    }
    const updated = await db
      .update(bookings)
      .set({
        name: input.name,
        date: input.date,
        venue: input.venue,
        notes: input.notes ?? null,
        customerName: input.customerName ?? null,
        customerEmail: input.customerEmail ?? null,
        customerPhone: input.customerPhone ?? null,
        startTime: input.startTime ?? null,
        durationHours: input.durationHours ?? null,
        venueName: input.venueName ?? null,
        venueCity: input.venueCity ?? null,
        comment: input.comment ?? null,
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

    if (existing?.status === "assigned" || existing?.status === "confirmed") {
      revalidatePath(`/bookings/${bookingId}`);
      return { error: false, message: "User was already assigned." };
    }

    if (existing) {
      // Conditional UPDATE: guard on the pre-tx assignment status so a
      // concurrent confirm/decline/withdraw can't race us into an unintended
      // status transition.
      const updated = await db
        .update(bookingAssignments)
        .set({ status: "assigned", assignedAt: new Date() })
        .where(
          and(
            eq(bookingAssignments.bookingId, bookingId),
            eq(bookingAssignments.userId, userId),
            eq(bookingAssignments.status, existing.status),
          ),
        )
        .returning({ userId: bookingAssignments.userId });
      if (updated.length === 0) {
        return {
          error: true,
          message:
            "Assignment changed during update. Please refresh and try again.",
        };
      }
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

    let notifyFailed = false;
    try {
      await notifyUser(userId, "assignmentInvite", {
        recipientName: target.name ?? target.email,
        bookingName: booking.name,
        bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
        bookingVenue: booking.venue,
        bookingNotes: booking.notes ?? undefined,
        confirmUrl: `${env.betterAuthUrl}/my-bookings/${booking.id}?action=confirm`,
        declineUrl: `${env.betterAuthUrl}/my-bookings/${booking.id}?action=decline`,
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

    const safeSubject = input.subject.replace(/[\r\n]+/g, " ");

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
    // iter-25: squad members can only request participation on accepted
    // bookings (new equivalent of the old `published` state).
    if (booking.status !== "accepted") {
      return {
        error: true,
        message: "You can only request participation on accepted bookings.",
      };
    }
    if (booking.date < new Date()) {
      return { error: true, message: "This booking is in the past." };
    }

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

    const adminRows = await db
      .select({ id: user.id, email: user.email })
      .from(userProfile)
      .innerJoin(user, eq(user.id, userProfile.userId))
      .where(eq(userProfile.role, "ADMIN"));

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

    const safeBookingName = booking.name.replace(/[\r\n]+/g, " ");
    const safeActorName = actorName.replace(/[\r\n]+/g, " ");
    const reviewUrl = `${env.betterAuthUrl}/bookings/${booking.id}`;
    const bookingDateStr = format(booking.date, "EEEE, d MMMM yyyy");
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
        await notifyUser(userId, "assignmentInvite", {
          recipientName: target?.name ?? target?.email ?? userId,
          bookingName: booking.name,
          bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
          bookingVenue: booking.venue,
          bookingNotes: booking.notes ?? undefined,
          confirmUrl: `${env.betterAuthUrl}/my-bookings/${bookingId}?action=confirm`,
          declineUrl: `${env.betterAuthUrl}/my-bookings/${bookingId}?action=decline`,
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

// iter-25: pre-offer selection editor. Wholesale replacement keeps the data
// model simple — the (small) edit set never warrants a diff.
// iter-28: editable in created, offered, accepted (not terminal states).
export const replaceBookingSelections = withPermission(
  "BOOKING_CREATE",
  async (
    actorId,
    raw: ReplaceBookingSelectionsInput,
  ): Promise<ActionResult> => {
    const parsed = replaceBookingSelectionsInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const { bookingId, selections } = parsed.data;

    const bookingRows = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking) {
      return { error: true, message: "Booking not found." };
    }
    if (booking.status === "rejected" || booking.status === "cancelled") {
      return {
        error: true,
        message:
          "Line items cannot be edited once a booking is rejected or cancelled.",
      };
    }

    // Validate every referenced service exists and is not archived.
    if (selections.length > 0) {
      const serviceIds = Array.from(
        new Set(selections.map((s) => s.serviceId)),
      );
      const found = await db
        .select({ id: services.id, archived: services.archived })
        .from(services)
        .where(inArray(services.id, serviceIds));
      const foundById = new Map(found.map((f) => [f.id, f]));
      for (const sel of selections) {
        const svc = foundById.get(sel.serviceId);
        if (!svc) {
          return {
            error: true,
            message: `Unknown service ${sel.serviceId}.`,
          };
        }
        if (svc.archived) {
          return {
            error: true,
            message: "Archived services cannot be added to a booking.",
          };
        }
      }
    }

    // Atomic delete+reinsert: if the insert fails, the existing selections
    // must remain — otherwise a transient error wipes the user's work.
    await db.transaction(async (tx) => {
      await tx
        .delete(bookingServiceSelection)
        .where(eq(bookingServiceSelection.bookingId, bookingId));

      if (selections.length > 0) {
        await tx.insert(bookingServiceSelection).values(
          selections.map((s, idx) => ({
            id: ulid(),
            bookingId,
            serviceId: s.serviceId,
            quantity: s.quantity,
            position: idx,
          })),
        );
      }
    });

    await recordAudit({
      actorUserId: actorId,
      action: "booking.selections.replaced",
      targetType: "booking",
      targetId: bookingId,
      metadata: { count: selections.length },
    });

    revalidatePath(`/bookings/${bookingId}`);
    return { error: false, message: "Line items updated." };
  },
);

// Internal helper: copy current bookingServiceSelection rows into
// bookingServiceItem rows at the given offerVersion. Called by
// adminAcceptOffer when transitioning `created → accepted` so the
// "an accepted booking has a snapshot" invariant holds (iter-22 invoicing).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function snapshotSelectionsToItems(
  tx: Tx,
  bookingId: string,
  offerVersion: number,
  durationHours: number | null,
): Promise<{ total: number }> {
  const selectionRows = await tx
    .select({
      serviceId: bookingServiceSelection.serviceId,
      quantity: bookingServiceSelection.quantity,
      position: bookingServiceSelection.position,
      name: services.name,
      description: services.description,
      priceType: services.priceType,
      unitPrice: services.price,
    })
    .from(bookingServiceSelection)
    .innerJoin(services, eq(services.id, bookingServiceSelection.serviceId))
    .where(eq(bookingServiceSelection.bookingId, bookingId))
    .orderBy(asc(bookingServiceSelection.position));

  if (selectionRows.length === 0) return { total: 0 };

  const hoursInMinutes = durationHours !== null ? durationHours * 60 : null;

  const itemRows = selectionRows.map((s) => {
    const total = computeLineTotal(
      s.priceType,
      s.unitPrice,
      s.quantity,
      s.priceType === "hourly" ? hoursInMinutes : null,
    );
    return {
      id: ulid(),
      bookingId,
      offerVersion,
      serviceId: s.serviceId,
      name: s.name,
      description: s.description ?? null,
      priceType: s.priceType,
      unitPrice: s.unitPrice,
      quantity: s.quantity,
      hoursInMinutes: s.priceType === "hourly" ? hoursInMinutes : null,
      total,
      position: s.position,
    };
  });

  await tx.insert(bookingServiceItem).values(itemRows);
  const total = itemRows.reduce((sum, r) => sum + r.total, 0);
  return { total };
}

export const sendOffer = withPermission(
  "BOOKING_OFFER_SEND",
  async (actorId, raw: { bookingId: string }): Promise<ActionResult> => {
    const bookingId = String(raw?.bookingId ?? "");
    if (!bookingId) {
      return { error: true, message: "Invalid input" };
    }

    const bookingRows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking) {
      return { error: true, message: "Booking not found." };
    }
    if (booking.status !== "created") {
      return {
        error: true,
        message: `Cannot send offer for a booking in '${booking.status}' state.`,
      };
    }

    const selectionCount = await db
      .select({ id: bookingServiceSelection.id })
      .from(bookingServiceSelection)
      .where(eq(bookingServiceSelection.bookingId, bookingId))
      .limit(1);
    if (selectionCount.length === 0) {
      return {
        error: true,
        message: "Cannot send offer with no line items selected.",
      };
    }

    const nextVersion = booking.offerVersion + 1;
    const now = new Date();
    let snapshotTotal = 0;

    // Guard the UPDATE on status + the snapshotted offerVersion so a
    // double-click can't both snapshot twice and produce duplicate
    // booking_service_item rows for the same offerVersion.
    let raced = false;
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(bookings)
        .set({
          status: "offered",
          offerVersion: nextVersion,
          lastOfferSentAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.status, "created"),
            eq(bookings.offerVersion, booking.offerVersion),
          ),
        )
        .returning({ id: bookings.id });
      if (updated.length === 0) {
        raced = true;
        return;
      }

      const result = await snapshotSelectionsToItems(
        tx,
        bookingId,
        nextVersion,
        booking.durationHours,
      );
      snapshotTotal = result.total;
    });
    if (raced) {
      return {
        error: true,
        message: "Booking changed during send. Please refresh and try again.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "booking.offer.sent",
      targetType: "booking",
      targetId: bookingId,
      metadata: { offerVersion: nextVersion },
    });

    if (booking.customerEmail) {
      try {
        await sendTemplated("offerSent", booking.customerEmail, {
          customerName: booking.customerName ?? "there",
          date: format(booking.date, "EEEE, d MMMM yyyy"),
          startTime: booking.startTime ?? "",
          venueName: booking.venueName ?? booking.venue,
          venueCity: booking.venueCity ?? "",
          offerVersion: nextVersion,
          offerUrl: `${env.betterAuthUrl}/offer/${booking.offerToken}`,
          totalFormatted: formatChfTotal(snapshotTotal),
        });
      } catch (err) {
        console.error("sendOffer: customer email failed", err);
        revalidatePath(`/bookings/${bookingId}`);
        return {
          error: false,
          message: "Offer sent, but customer email failed to deliver.",
        };
      }
    }

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    return { error: false, message: "Offer sent." };
  },
);

// iter-28: send a revised offer from `offered` or `accepted` state.
// Archives the previous snapshot to audit_log, inserts a new snapshot at
// offerVersion+1, and emails the customer.
export const sendRevisedOffer = withPermission(
  "BOOKING_OFFER_SEND",
  async (actorId, raw: { bookingId: string }): Promise<ActionResult> => {
    const bookingId = String(raw?.bookingId ?? "");
    if (!bookingId) {
      return { error: true, message: "Invalid input" };
    }

    const bookingRows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking) {
      return { error: true, message: "Booking not found." };
    }
    if (booking.status !== "offered" && booking.status !== "accepted") {
      return {
        error: true,
        message: `Cannot send a revised offer for a booking in '${booking.status}' state.`,
      };
    }

    const selectionCount = await db
      .select({ id: bookingServiceSelection.id })
      .from(bookingServiceSelection)
      .where(eq(bookingServiceSelection.bookingId, bookingId))
      .limit(1);
    if (selectionCount.length === 0) {
      return {
        error: true,
        message: "Cannot send revised offer with no line items selected.",
      };
    }

    // Fetch the prior snapshot for archiving to audit.
    const prevItems = await db
      .select()
      .from(bookingServiceItem)
      .where(
        and(
          eq(bookingServiceItem.bookingId, bookingId),
          eq(bookingServiceItem.offerVersion, booking.offerVersion),
        ),
      );

    const nextVersion = booking.offerVersion + 1;
    const now = new Date();
    let snapshotTotal = 0;
    let raced = false;
    // Determined inside the tx by which conditional UPDATE branch wins, so a
    // concurrent customer accept that lands between the pre-tx read and the
    // UPDATE is reflected accurately in audit + email copy.
    let wasAccepted = false;

    await db.transaction(async (tx) => {
      const setClause = {
        status: "offered" as const,
        offerVersion: nextVersion,
        lastOfferSentAt: now,
        acceptedAt: null, // clear acceptance when revising
        updatedAt: now,
      };
      // Try the accepted→offered branch first: if it wins, the prior state was
      // actually accepted regardless of what the pre-tx read saw.
      const acceptedUpdate = await tx
        .update(bookings)
        .set(setClause)
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.status, "accepted"),
            eq(bookings.offerVersion, booking.offerVersion),
          ),
        )
        .returning({ id: bookings.id });
      if (acceptedUpdate.length > 0) {
        wasAccepted = true;
      } else {
        const offeredUpdate = await tx
          .update(bookings)
          .set(setClause)
          .where(
            and(
              eq(bookings.id, bookingId),
              eq(bookings.status, "offered"),
              eq(bookings.offerVersion, booking.offerVersion),
            ),
          )
          .returning({ id: bookings.id });
        if (offeredUpdate.length === 0) {
          raced = true;
          return;
        }
      }

      const result = await snapshotSelectionsToItems(
        tx,
        bookingId,
        nextVersion,
        booking.durationHours,
      );
      snapshotTotal = result.total;
    });

    if (raced) {
      return {
        error: true,
        message:
          "Booking changed during revision. Please refresh and try again.",
      };
    }

    // Archive prior snapshot and record revision — both after tx commits so a
    // transient audit failure never rolls back the status change.
    await recordAudit({
      actorUserId: actorId,
      action: "booking.offer.snapshot.archived",
      targetType: "booking",
      targetId: bookingId,
      metadata: {
        fromVersion: booking.offerVersion,
        toVersion: nextVersion,
        items: prevItems,
      },
    });

    await recordAudit({
      actorUserId: actorId,
      action: "booking.offer.revised",
      targetType: "booking",
      targetId: bookingId,
      metadata: { offerVersion: nextVersion, wasAccepted },
    });

    if (booking.customerEmail) {
      try {
        await sendTemplated("offerRevised", booking.customerEmail, {
          customerName: booking.customerName ?? "there",
          offerVersion: nextVersion,
          offerUrl: `${env.betterAuthUrl}/offer/${booking.offerToken}`,
          totalFormatted: formatChfTotal(snapshotTotal),
          wasAccepted,
        });
      } catch (err) {
        console.error("sendRevisedOffer: customer email failed", err);
        revalidatePath(`/bookings/${bookingId}`);
        return {
          error: false,
          message: "Revised offer sent, but customer email failed to deliver.",
        };
      }
    }

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    return { error: false, message: "Revised offer sent." };
  },
);

export const adminAcceptOffer = withPermission(
  "BOOKING_ACCEPT_MANUAL",
  async (actorId, raw: { bookingId: string }): Promise<ActionResult> => {
    const bookingId = String(raw?.bookingId ?? "");
    if (!bookingId) {
      return { error: true, message: "Invalid input" };
    }

    const bookingRows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking) {
      return { error: true, message: "Booking not found." };
    }
    if (booking.status !== "created" && booking.status !== "offered") {
      return {
        error: true,
        message: `Cannot accept a booking in '${booking.status}' state.`,
      };
    }

    const fromStatus = booking.status;
    const now = new Date();

    // For `created → accepted` we snapshot now (no prior offer existed). For
    // `offered → accepted` the snapshot was already written when the offer
    // was sent (iter-27); just bump status + acceptedAt.
    // Snapshot writes and the status update must commit atomically — otherwise
    // a partial failure leaves orphaned booking_service_item rows.
    let snapshotTotal: number | null = null;
    let raced = false;
    const newOfferVersion = fromStatus === "created" ? 1 : booking.offerVersion;
    await db.transaction(async (tx) => {
      // Conditional UPDATE: guard on the pre-tx status so a concurrent
      // accept/reject/cancel can't race us into a duplicate transition.
      // Run before the snapshot so a race rolls back without orphan items.
      const updated = await tx
        .update(bookings)
        .set({
          status: "accepted",
          acceptedAt: now,
          offerVersion: newOfferVersion,
          updatedAt: now,
        })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, fromStatus)))
        .returning({ id: bookings.id });
      if (updated.length === 0) {
        raced = true;
        return;
      }

      if (fromStatus === "created") {
        const result = await snapshotSelectionsToItems(
          tx,
          bookingId,
          newOfferVersion,
          booking.durationHours,
        );
        snapshotTotal = result.total;
      }
    });
    if (raced) {
      return {
        error: true,
        message: "Booking changed during accept. Please refresh and try again.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "booking.status.changed",
      targetType: "booking",
      targetId: bookingId,
      metadata: {
        from: fromStatus,
        to: "accepted",
        byUserId: actorId,
        manual: true,
      },
    });

    await recordAudit({
      actorUserId: actorId,
      action: "booking.offer.accepted",
      targetType: "booking",
      targetId: bookingId,
      metadata: { offerVersion: newOfferVersion, via: "admin" },
    });

    // Best-effort customer notification — only if we have a customer email
    // on file. Customer is not a user, so we send via sendTemplated directly.
    if (booking.customerEmail) {
      try {
        // Total comes from the snapshot we just wrote (created→accepted) or
        // we re-read the latest snapshot (offered→accepted).
        let total: number | null = snapshotTotal;
        if (total === null) {
          const itemRows = await db
            .select({ total: bookingServiceItem.total })
            .from(bookingServiceItem)
            .where(
              and(
                eq(bookingServiceItem.bookingId, bookingId),
                eq(bookingServiceItem.offerVersion, newOfferVersion),
              ),
            );
          total = itemRows.reduce((sum, r) => sum + r.total, 0);
        }
        await sendTemplated("offerAcceptedAdmin", booking.customerEmail, {
          recipientName: booking.customerName ?? "there",
          bookingName: booking.name,
          bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
          bookingVenue: booking.venue,
          totalFormatted: formatChfTotal(total),
        });
      } catch (err) {
        console.error("adminAcceptOffer: customer email failed", err);
      }
    }

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    return { error: false, message: "Booking accepted." };
  },
);

export const rejectBooking = withPermission(
  "BOOKING_REJECT",
  async (actorId, raw: RejectBookingInput): Promise<ActionResult> => {
    const parsed = rejectBookingInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const { bookingId, reason } = parsed.data;

    const bookingRows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking) {
      return { error: true, message: "Booking not found." };
    }
    // iter-28: also accept offered → rejected (not just created → rejected).
    if (booking.status !== "created" && booking.status !== "offered") {
      return {
        error: true,
        message: `Cannot reject a booking in '${booking.status}' state.`,
      };
    }

    const fromStatus = booking.status;
    const now = new Date();
    // Conditional UPDATE: guard on the pre-tx status so a concurrent transition
    // can't race us into rejecting an already-changed booking.
    const updated = await db
      .update(bookings)
      .set({ status: "rejected", updatedAt: now })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, fromStatus)))
      .returning({ id: bookings.id });
    if (updated.length === 0) {
      return {
        error: true,
        message: "Booking changed during reject. Please refresh and try again.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "booking.status.changed",
      targetType: "booking",
      targetId: bookingId,
      metadata: {
        from: fromStatus,
        to: "rejected",
        byUserId: actorId,
        reason: reason ?? null,
      },
    });

    if (booking.customerEmail) {
      try {
        await sendTemplated("bookingRejected", booking.customerEmail, {
          recipientName: booking.customerName ?? "there",
          bookingName: booking.name,
          bookingDate: format(booking.date, "EEEE, d MMMM yyyy"),
          reason: reason ?? undefined,
        });
      } catch (err) {
        console.error("rejectBooking: customer email failed", err);
      }
    }

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    return { error: false, message: "Booking rejected." };
  },
);

export const cancelBooking = withPermission(
  "BOOKING_CANCEL",
  async (actorId, raw: CancelBookingInput): Promise<ActionResult> => {
    const parsed = cancelBookingInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const { bookingId, reason } = parsed.data;

    const bookingRows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const booking = bookingRows[0];
    if (!booking) {
      return { error: true, message: "Booking not found." };
    }
    if (booking.status !== "accepted") {
      return {
        error: true,
        message: `Cannot cancel a booking in '${booking.status}' state.`,
      };
    }

    const now = new Date();
    // Conditional UPDATE: guard on status="accepted" so a concurrent cancel or
    // status change can't race us into cancelling twice (or cancelling something
    // that already moved out of "accepted").
    const updated = await db
      .update(bookings)
      .set({ status: "cancelled", updatedAt: now })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, "accepted")))
      .returning({ id: bookings.id });
    if (updated.length === 0) {
      return {
        error: true,
        message: "Booking changed during cancel. Please refresh and try again.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "booking.status.changed",
      targetType: "booking",
      targetId: bookingId,
      metadata: {
        from: "accepted",
        to: "cancelled",
        byUserId: actorId,
        reason: reason ?? null,
      },
    });

    const bookingDateStr = format(booking.date, "EEEE, d MMMM yyyy");
    const bookingUrl = `${env.betterAuthUrl}/bookings/${bookingId}`;

    // Notify any active squad members (assigned or confirmed). Best-effort.
    const squadRows = await db
      .select({ userId: bookingAssignments.userId, name: user.name })
      .from(bookingAssignments)
      .innerJoin(user, eq(user.id, bookingAssignments.userId))
      .where(
        and(
          eq(bookingAssignments.bookingId, bookingId),
          inArray(bookingAssignments.status, ["assigned", "confirmed"]),
        ),
      );
    if (squadRows.length > 0) {
      await Promise.allSettled(
        squadRows.map((s) =>
          notifyUser(s.userId, "bookingCancelled", {
            recipient: "squad",
            recipientName: s.name ?? "there",
            bookingName: booking.name,
            bookingDate: bookingDateStr,
            bookingVenue: booking.venue,
            reason: reason ?? undefined,
            bookingUrl,
          }),
        ),
      );
    }

    // Notify customer (if email on file). Best-effort.
    if (booking.customerEmail) {
      try {
        await sendTemplated("bookingCancelled", booking.customerEmail, {
          recipient: "customer",
          recipientName: booking.customerName ?? "there",
          bookingName: booking.name,
          bookingDate: bookingDateStr,
          bookingVenue: booking.venue,
          reason: reason ?? undefined,
        });
      } catch (err) {
        console.error("cancelBooking: customer email failed", err);
      }
    }

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    return { error: false, message: "Booking cancelled." };
  },
);
