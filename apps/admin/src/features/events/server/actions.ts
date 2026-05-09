"use server";

import { eventAssignments, events, user } from "@wardrobe-assistants/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ulid } from "ulid";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { withPermission } from "@/lib/permissions";
import {
  type ActionResult,
  type AssignUserInput,
  assignUserInput,
  type CreateEventInput,
  createEventInput,
  type DeleteEventInput,
  deleteEventInput,
  type MessageEventAssigneesInput,
  messageEventAssigneesInput,
  type UnassignUserInput,
  type UpdateEventInput,
  unassignUserInput,
  updateEventInput,
} from "../schema";
import { assignmentEmail } from "./email-templates";

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
    revalidatePath("/events");
    return { error: false, message: "Event created." };
  },
);

export const updateEvent = withPermission(
  "EVENT_CREATE",
  async (_actorId, raw: UpdateEventInput): Promise<ActionResult> => {
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
    revalidatePath("/events");
    revalidatePath(`/events/${input.eventId}`);
    return { error: false, message: "Event updated." };
  },
);

export const deleteEvent = withPermission(
  "EVENT_DELETE",
  async (_actorId, raw: DeleteEventInput): Promise<ActionResult> => {
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
    revalidatePath("/events");
    return { error: false, message: "Event deleted." };
  },
);

export const assignUser = withPermission(
  "EVENT_ASSIGN",
  async (_actorId, raw: AssignUserInput): Promise<ActionResult> => {
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
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const target = userRows[0];
    if (!target) {
      return { error: true, message: "User not found." };
    }

    // Idempotent: if the assignment already exists, the upsert is a no-op
    // and we can skip the notification email.
    const inserted = await db
      .insert(eventAssignments)
      .values({ eventId, userId, assignedAt: new Date() })
      .onConflictDoNothing()
      .returning({ userId: eventAssignments.userId });

    if (inserted.length === 0) {
      revalidatePath(`/events/${eventId}`);
      return { error: false, message: "User was already assigned." };
    }

    // Best-effort notification: a transient SMTP failure must not roll back
    // the assignment row — the assignment is the source of truth, the email
    // is just a heads-up. Surface a soft warning in the result instead.
    let emailFailed = false;
    try {
      const tpl = assignmentEmail({
        eventName: event.name,
        date: event.date,
        venue: event.venue,
        notes: event.notes,
      });
      await sendEmail({
        to: target.email,
        subject: tpl.subject,
        text: tpl.text,
      });
    } catch (err) {
      emailFailed = true;
      console.error("assignUser: failed to send notification email", err);
    }

    revalidatePath(`/events/${eventId}`);
    if (emailFailed) {
      return {
        error: false,
        message: "Assigned, but notification email failed to send.",
      };
    }
    return { error: false, message: "User assigned." };
  },
);

export const unassignUser = withPermission(
  "EVENT_ASSIGN",
  async (_actorId, raw: UnassignUserInput): Promise<ActionResult> => {
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
    revalidatePath(`/events/${eventId}`);
    return { error: false, message: "User unassigned." };
  },
);

export const messageEventAssignees = withPermission(
  "EVENT_MESSAGE_ASSIGNED",
  async (_actorId, raw: MessageEventAssigneesInput): Promise<ActionResult> => {
    const parsed = messageEventAssigneesInput.safeParse(raw);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const input = parsed.data;

    const eventRows = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, input.eventId))
      .limit(1);
    if (eventRows.length === 0) {
      return { error: true, message: "Event not found." };
    }

    const recipients = await db
      .select({ email: user.email })
      .from(eventAssignments)
      .innerJoin(user, eq(user.id, eventAssignments.userId))
      .where(eq(eventAssignments.eventId, input.eventId));

    if (recipients.length === 0) {
      return {
        error: true,
        message: "No assignees on this event.",
      };
    }

    let sent = 0;
    let failed = 0;
    // Per-recipient try/catch: one bad address must not abort the fan-out.
    // Admins want feedback ("sent to 4 of 5"), not a 500.
    for (const r of recipients) {
      try {
        await sendEmail({
          to: r.email,
          subject: input.subject,
          text: input.body,
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(
          "messageEventAssignees: send failed for a recipient",
          err,
        );
      }
    }

    if (sent === 0) {
      return { error: true, message: "Could not send to any assignee." };
    }
    if (failed > 0) {
      return {
        error: false,
        message: `Sent to ${sent} of ${sent + failed} assignees.`,
      };
    }
    return { error: false, message: `Sent to ${sent} assignees.` };
  },
);
