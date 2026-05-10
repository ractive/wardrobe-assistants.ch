import { z } from "zod";

export const BOOKING_STATUSES = [
  "draft",
  "published",
  "cancelled",
  "done",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Date arrives from the form as either a `Date` (RHF + Calendar) or an ISO
// string (server action raw input via JSON). Coerce so the action signature
// stays `{ date: Date }` regardless of caller.
const dateField = z.coerce.date();

export const createBookingInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  date: dateField,
  venue: z.string().trim().min(1, "Venue is required").max(200),
  notes: z
    .string()
    .trim()
    .max(10_000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  status: z.enum(BOOKING_STATUSES).default("draft"),
});
export type CreateBookingInput = z.infer<typeof createBookingInput>;

export const updateBookingInput = z.object({
  bookingId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(200),
  date: dateField,
  venue: z.string().trim().min(1, "Venue is required").max(200),
  notes: z
    .string()
    .trim()
    .max(10_000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  status: z.enum(BOOKING_STATUSES),
});
export type UpdateBookingInput = z.infer<typeof updateBookingInput>;

export const deleteBookingInput = z.object({
  bookingId: z.string().min(1),
});
export type DeleteBookingInput = z.infer<typeof deleteBookingInput>;

export const assignUserInput = z.object({
  bookingId: z.string().min(1),
  userId: z.string().min(1),
});
export type AssignUserInput = z.infer<typeof assignUserInput>;

export const unassignUserInput = z.object({
  bookingId: z.string().min(1),
  userId: z.string().min(1),
});
export type UnassignUserInput = z.infer<typeof unassignUserInput>;

export const messageBookingAssigneesInput = z.object({
  bookingId: z.string().min(1),
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
export type MessageBookingAssigneesInput = z.infer<
  typeof messageBookingAssigneesInput
>;

export const bookingListItem = z.object({
  id: z.string(),
  name: z.string(),
  date: z.date(),
  venue: z.string(),
  status: z.enum(BOOKING_STATUSES),
  assigneesCount: z.number().int().nonnegative(),
  createdAt: z.date(),
});
export type BookingListItem = z.infer<typeof bookingListItem>;

export const ASSIGNMENT_STATUSES = [
  "assigned",
  "requested",
  "rejected",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const requestParticipationInput = z.object({
  bookingId: z.string().min(1),
});
export type RequestParticipationInput = z.infer<
  typeof requestParticipationInput
>;

export const approveRequestInput = z.object({
  bookingId: z.string().min(1),
  userId: z.string().min(1),
});
export type ApproveRequestInput = z.infer<typeof approveRequestInput>;

export const rejectRequestInput = z.object({
  bookingId: z.string().min(1),
  userId: z.string().min(1),
});
export type RejectRequestInput = z.infer<typeof rejectRequestInput>;

export const bookingAssignee = z.object({
  userId: z.string(),
  email: z.string(),
  displayName: z.string(),
  assignedAt: z.date(),
  status: z.enum(ASSIGNMENT_STATUSES),
});
export type BookingAssignee = z.infer<typeof bookingAssignee>;

export const myBookingListItem = z.object({
  id: z.string(),
  name: z.string(),
  date: z.date(),
  venue: z.string(),
  status: z.enum(BOOKING_STATUSES),
  assignmentStatus: z.enum(ASSIGNMENT_STATUSES),
  createdAt: z.date(),
});
export type MyBookingListItem = z.infer<typeof myBookingListItem>;

// Bookings eligible for squad-member participation requests — no assignment yet.
export const upcomingBookingForRequest = z.object({
  id: z.string(),
  name: z.string(),
  date: z.date(),
  venue: z.string(),
  createdAt: z.date(),
});
export type UpcomingBookingForRequest = z.infer<
  typeof upcomingBookingForRequest
>;

export const pendingRequest = z.object({
  userId: z.string(),
  displayName: z.string(),
  email: z.string(),
  requestedAt: z.date(),
});
export type PendingRequest = z.infer<typeof pendingRequest>;

export const bookingDetail = z.object({
  id: z.string(),
  name: z.string(),
  date: z.date(),
  venue: z.string(),
  notes: z.string().nullable(),
  status: z.enum(BOOKING_STATUSES),
  createdAt: z.date(),
  updatedAt: z.date(),
  assignees: z.array(bookingAssignee),
  pendingRequests: z.array(pendingRequest),
});
export type BookingDetail = z.infer<typeof bookingDetail>;

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
