"use server";

import {
  eventAssignments,
  events,
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
  type CreateEventInput,
  createEventInput,
  type DeleteEventInput,
  deleteEventInput,
  type MessageEventAssigneesInput,
  messageEventAssigneesInput,
  type RejectRequestInput,
  type RequestParticipationInput,
  rejectRequestInput,
  requestParticipationInput,
  type UnassignUserInput,
  type UpdateEventInput,
  unassignUserInput,
  updateEventInput,
} from "../schema";

export const createEvent = withPermission(
  "EVENT_CREATE",
  async (actorId, raw: CreateEventInput): Promise<ActionResult> => {
    const parsed = createEventInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;
    const now = new Date();
    const id = ulid();
    await db.insert(events).values({
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
      action: "event.create",
      targetType: "event",
      targetId: id,
    });
    revalidatePath("/events");
    return { error: false, message: "Event created." };
  },
);

export const updateEvent = withPermission(
  "EVENT_CREATE",
  async (actorId, raw: UpdateEventInput): Promise<ActionResult> => {
    const parsed = updateEventInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;
    const updated = await db
      .update(events)
      .set({
        name: input.name,
        date: input.date,
        venue: input.venue,
        notes: input.notes ?? null,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(events.id, input.eventId))
      .returning({ id: events.id });
    if (updated.length === 0) {
      return { error: true, message: "Event not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "event.update",
      targetType: "event",
      targetId: input.eventId,
    });
    revalidatePath("/events");
    revalidatePath(`/events/${input.eventId}`);
    return { error: false, message: "Event updated." };
  },
);

export const deleteEvent = withPermission(
  "EVENT_DELETE",
  async (actorId, raw: DeleteEventInput): Promise<ActionResult> => {
    const parsed = deleteEventInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const deleted = await db
      .delete(events)
      .where(eq(events.id, parsed.data.eventId))
      .returning({ id: events.id });
    if (deleted.length === 0) {
      return { error: true, message: "Event not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "event.delete",
      targetType: "event",
      targetId: parsed.data.eventId,
    });
    revalidatePath("/events");
    return { error: false, message: "Event deleted." };
  },
);

export const assignUser = withPermission(
  "EVENT_ASSIGN",
  async (actorId, raw: AssignUserInput): Promise<ActionResult> => {
    const parsed = assignUserInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { eventId, userId } = parsed.data;

    const eventRows = await db
      .select({
        id: events.id,
        name: events.name,
        date: events.date,
        venue: events.venue,
        notes: events.notes,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    const event = eventRows[0];
    if (!event) {
      return { error: true, message: "Event not found." };
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
      .select({ status: eventAssignments.status })
      .from(eventAssignments)
      .where(
        and(
          eq(eventAssignments.eventId, eventId),
          eq(eventAssignments.userId, userId),
        ),
      )
      .limit(1);
    const existing = existingRows[0];

    if (existing?.status === "assigned") {
      revalidatePath(`/events/${eventId}`);
      return { error: false, message: "User was already assigned." };
    }

    if (existing) {
      await db
        .update(eventAssignments)
        .set({ status: "assigned", assignedAt: new Date() })
        .where(
          and(
            eq(eventAssignments.eventId, eventId),
            eq(eventAssignments.userId, userId),
          ),
        );
    } else {
      await db.insert(eventAssignments).values({
        eventId,
        userId,
        assignedAt: new Date(),
        status: "assigned",
      });
    }
    await recordAudit({
      actorUserId: actorId,
      action: "event.assign",
      targetType: "event",
      targetId: eventId,
      metadata: { userId },
    });

    // Best-effort notification: a transient failure must not roll back the
    // assignment row. notifyUser fires both email and push; failures in
    // either channel are logged inside notifyUser and do not throw.
    let notifyFailed = false;
    try {
      await notifyUser(userId, "eventAssigned", {
        recipientName: target.name ?? target.email,
        eventName: event.name,
        eventDate: format(event.date, "EEEE, d MMMM yyyy"),
        eventVenue: event.venue,
        eventNotes: event.notes ?? undefined,
        eventUrl: `${env.betterAuthUrl}/events/${event.id}`,
      });
    } catch (err) {
      notifyFailed = true;
      console.error("assignUser: failed to send notification", err);
    }

    revalidatePath(`/events/${eventId}`);
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
  "EVENT_ASSIGN",
  async (actorId, raw: UnassignUserInput): Promise<ActionResult> => {
    const parsed = unassignUserInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { eventId, userId } = parsed.data;
    const deleted = await db
      .delete(eventAssignments)
      .where(
        and(
          eq(eventAssignments.eventId, eventId),
          eq(eventAssignments.userId, userId),
        ),
      )
      .returning({ userId: eventAssignments.userId });
    if (deleted.length === 0) {
      return { error: true, message: "Assignment not found." };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "event.unassign",
      targetType: "event",
      targetId: eventId,
      metadata: { userId },
    });
    revalidatePath(`/events/${eventId}`);
    return { error: false, message: "User unassigned." };
  },
);

export const messageEventAssignees = withPermission(
  "EVENT_MESSAGE_ASSIGNED",
  async (actorId, raw: MessageEventAssigneesInput): Promise<ActionResult> => {
    const parsed = messageEventAssigneesInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;

    const eventRows = await db
      .select({ id: events.id, name: events.name })
      .from(events)
      .where(eq(events.id, input.eventId))
      .limit(1);
    const eventRow = eventRows[0];
    if (!eventRow) {
      return { error: true, message: "Event not found." };
    }

    const recipients = await db
      .select({ userId: eventAssignments.userId, email: user.email })
      .from(eventAssignments)
      .innerJoin(user, eq(user.id, eventAssignments.userId))
      .where(eq(eventAssignments.eventId, input.eventId));

    if (recipients.length === 0) {
      return {
        error: true,
        message: "No assignees on this event.",
      };
    }

    // Sanitize CR/LF from caller-supplied subject (header injection guard,
    // mirrors the pattern from requestParticipation's safeEventName).
    const safeSubject = input.subject.replace(/[\r\n]+/g, " ");

    // Fan out via notifyUser — both email and push per recipient.
    // notifyUser handles per-channel failures internally so one bad device
    // doesn't block the rest. Count attempts as "sent" since failure
    // reporting is best-effort inside notifyUser.
    const results = await Promise.allSettled(
      recipients.map((r) =>
        notifyUser(r.userId, "eventBroadcast", {
          subject: safeSubject,
          eventName: eventRow.name,
          body: input.body,
        }),
      ),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (sent === 0) {
      const correlationId = await recordAudit({
        actorUserId: actorId,
        action: "event.message_assignees",
        targetType: "event",
        targetId: input.eventId,
        metadata: { sent, failed, outcome: "all_failed" },
      });
      return {
        error: true,
        message: `Could not send to any assignee. (ref ${correlationId})`,
      };
    }
    await recordAudit({
      actorUserId: actorId,
      action: "event.message_assignees",
      targetType: "event",
      targetId: input.eventId,
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
    const { eventId } = parsed.data;

    const eventRows = await db
      .select({
        id: events.id,
        name: events.name,
        status: events.status,
        date: events.date,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    const event = eventRows[0];
    if (!event) {
      return { error: true, message: "Event not found." };
    }
    if (event.status !== "published") {
      return {
        error: true,
        message: "You can only request participation on published events.",
      };
    }
    if (event.date < new Date()) {
      return { error: true, message: "This event is in the past." };
    }

    // Idempotent: if a row already exists (any status), do nothing — and
    // skip the audit record + admin email fan-out so repeated clicks don't
    // spam admins.
    const inserted = await db
      .insert(eventAssignments)
      .values({
        eventId,
        userId: actorId,
        assignedAt: new Date(),
        status: "requested",
      })
      .onConflictDoNothing()
      .returning({ userId: eventAssignments.userId });

    if (inserted.length === 0) {
      return { error: false, message: "Participation already recorded." };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "event.request_participation",
      targetType: "event",
      targetId: eventId,
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
    // reach the email subject (mirrors the `messageEventAssigneesInput`
    // guard from audit C-SEC-07).
    const safeEventName = event.name.replace(/[\r\n]+/g, " ");
    const safeActorName = actorName.replace(/[\r\n]+/g, " ");
    const reviewUrl = `${env.betterAuthUrl}/events/${event.id}`;
    const eventDateStr = format(event.date, "EEEE, d MMMM yyyy");
    // Best-effort fan-out to all admins via notifyUser — both email and push.
    // Errors are logged but must not prevent the participation request from
    // being recorded. Awaited so serverless runtimes don't terminate before
    // the fan-out completes.
    if (adminRows.length > 0) {
      await Promise.allSettled(
        adminRows.map((admin) =>
          notifyUser(admin.id, "participationRequested", {
            actorName: safeActorName,
            eventName: safeEventName,
            eventDate: eventDateStr,
            reviewUrl,
          }),
        ),
      );
    }

    revalidatePath("/upcoming-events");
    revalidatePath("/my-events");
    return { error: false, message: "Participation request sent." };
  },
);

export const approveRequest = withPermission(
  "EVENT_APPROVE_REQUEST",
  async (actorId, raw: ApproveRequestInput): Promise<ActionResult> => {
    const parsed = approveRequestInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { eventId, userId } = parsed.data;

    const updated = await db
      .update(eventAssignments)
      .set({ status: "assigned" })
      .where(
        and(
          eq(eventAssignments.eventId, eventId),
          eq(eventAssignments.userId, userId),
          eq(eventAssignments.status, "requested"),
        ),
      )
      .returning({ userId: eventAssignments.userId });

    if (updated.length === 0) {
      return {
        error: true,
        message: "No pending request found for this user on this event.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "event.approve_request",
      targetType: "event",
      targetId: eventId,
      metadata: { userId },
    });

    // Send the same "you've been assigned" email — best-effort.
    const eventRows = await db
      .select({
        name: events.name,
        date: events.date,
        venue: events.venue,
        notes: events.notes,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    const event = eventRows[0];

    const userRows = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const target = userRows[0];

    let notifyFailed = false;
    if (event) {
      try {
        await notifyUser(userId, "eventAssigned", {
          recipientName: target?.name ?? target?.email ?? userId,
          eventName: event.name,
          eventDate: format(event.date, "EEEE, d MMMM yyyy"),
          eventVenue: event.venue,
          eventNotes: event.notes ?? undefined,
          eventUrl: `${env.betterAuthUrl}/events/${eventId}`,
        });
      } catch (err) {
        notifyFailed = true;
        console.error("approveRequest: failed to send notification", err);
      }
    }

    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/my-events");
    revalidatePath("/upcoming-events");
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
  "EVENT_APPROVE_REQUEST",
  async (actorId, raw: RejectRequestInput): Promise<ActionResult> => {
    const parsed = rejectRequestInput.safeParse(raw);
    if (!parsed.success) {
      return { error: true, message: "Invalid input" };
    }
    const { eventId, userId } = parsed.data;

    const updated = await db
      .update(eventAssignments)
      .set({ status: "rejected" })
      .where(
        and(
          eq(eventAssignments.eventId, eventId),
          eq(eventAssignments.userId, userId),
          eq(eventAssignments.status, "requested"),
        ),
      )
      .returning({ userId: eventAssignments.userId });

    if (updated.length === 0) {
      return {
        error: true,
        message: "No pending request found for this user on this event.",
      };
    }

    await recordAudit({
      actorUserId: actorId,
      action: "event.reject_request",
      targetType: "event",
      targetId: eventId,
      metadata: { userId },
    });

    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/my-events");
    revalidatePath("/upcoming-events");
    return { error: false, message: "Request rejected." };
  },
);
