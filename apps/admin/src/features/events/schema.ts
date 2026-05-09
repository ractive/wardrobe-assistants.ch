import { z } from "zod";

export const EVENT_STATUSES = [
  "draft",
  "published",
  "cancelled",
  "done",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// Date arrives from the form as either a `Date` (RHF + Calendar) or an ISO
// string (server action raw input via JSON). Coerce so the action signature
// stays `{ date: Date }` regardless of caller.
const dateField = z.coerce.date();

export const createEventInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  date: dateField,
  venue: z.string().trim().min(1, "Venue is required").max(200),
  notes: z
    .string()
    .trim()
    .max(10_000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  status: z.enum(EVENT_STATUSES).default("draft"),
});
export type CreateEventInput = z.infer<typeof createEventInput>;

export const updateEventInput = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(200),
  date: dateField,
  venue: z.string().trim().min(1, "Venue is required").max(200),
  notes: z
    .string()
    .trim()
    .max(10_000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  status: z.enum(EVENT_STATUSES),
});
export type UpdateEventInput = z.infer<typeof updateEventInput>;

export const deleteEventInput = z.object({
  eventId: z.string().min(1),
});
export type DeleteEventInput = z.infer<typeof deleteEventInput>;

export const assignUserInput = z.object({
  eventId: z.string().min(1),
  userId: z.string().min(1),
});
export type AssignUserInput = z.infer<typeof assignUserInput>;

export const unassignUserInput = z.object({
  eventId: z.string().min(1),
  userId: z.string().min(1),
});
export type UnassignUserInput = z.infer<typeof unassignUserInput>;

export const messageEventAssigneesInput = z.object({
  eventId: z.string().min(1),
  // CR/LF stripped to neutralize email-header injection (audit C-SEC-07).
  // Mirrors the same guard on `messageUserInput` in users/schema.ts.
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(200)
    .transform((s) => s.replace(/[\r\n]+/g, " ")),
  body: z.string().trim().min(1, "Message body is required").max(10_000),
});
export type MessageEventAssigneesInput = z.infer<
  typeof messageEventAssigneesInput
>;

export const eventListItem = z.object({
  id: z.string(),
  name: z.string(),
  date: z.date(),
  venue: z.string(),
  status: z.enum(EVENT_STATUSES),
  assigneesCount: z.number().int().nonnegative(),
  createdAt: z.date(),
});
export type EventListItem = z.infer<typeof eventListItem>;

export const eventAssignee = z.object({
  userId: z.string(),
  email: z.string(),
  displayName: z.string(),
  assignedAt: z.date(),
});
export type EventAssignee = z.infer<typeof eventAssignee>;

export const eventDetail = z.object({
  id: z.string(),
  name: z.string(),
  date: z.date(),
  venue: z.string(),
  notes: z.string().nullable(),
  status: z.enum(EVENT_STATUSES),
  createdAt: z.date(),
  updatedAt: z.date(),
  assignees: z.array(eventAssignee),
});
export type EventDetail = z.infer<typeof eventDetail>;

export const assignableUser = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(["ADMIN", "SQUAD_MEMBER"]),
});
export type AssignableUser = z.infer<typeof assignableUser>;

export const actionResult = z.discriminatedUnion("error", [
  z.object({ error: z.literal(false), message: z.string() }),
  z.object({ error: z.literal(true), message: z.string() }),
]);
export type ActionResult = z.infer<typeof actionResult>;
