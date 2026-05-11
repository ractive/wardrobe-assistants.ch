import { z } from "zod";

// iter-25 booking lifecycle. The customer offer round-trip ("offered") lands
// in iter-27; admin can already drive a booking from `created` directly to
// `accepted` via the manual-accept path. `rejected` and `cancelled` are
// terminal.
export const BOOKING_STATUSES = [
  "created",
  "offered",
  "accepted",
  "rejected",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Status values where contact/venue/time fields can still be edited.
// `rejected` and `cancelled` are terminal — UI renders read-only.
export const NON_TERMINAL_BOOKING_STATUSES = [
  "created",
  "offered",
  "accepted",
] as const;

// Date arrives from the form as either a `Date` (RHF + Calendar) or an ISO
// string (server action raw input via JSON). Coerce so the action signature
// stays `{ date: Date }` regardless of caller.
const dateField = z.coerce.date();

// Trim + collapse empty-string to undefined so optional text fields don't
// store "" in the DB.
const optionalTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v));

const startTimeField = z
  .union([
    z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be HH:MM"),
    z.literal(""),
  ])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

export const createBookingInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  date: dateField,
  venue: z.string().trim().min(1, "Venue is required").max(200),
  notes: optionalTrimmedText(10_000),
  // Optional new fields. Customer-submitted bookings (iter-26) supply all of
  // them; admin-created bookings can leave them blank.
  customerName: optionalTrimmedText(200),
  customerEmail: z
    .union([
      z.string().trim().email("Customer email is invalid"),
      z.literal(""),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  customerPhone: optionalTrimmedText(50),
  startTime: startTimeField,
  durationHours: z
    .union([z.coerce.number().int().min(1).max(24), z.nan(), z.literal("")])
    .optional()
    .transform((v) =>
      v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v))
        ? undefined
        : v,
    ),
  venueName: optionalTrimmedText(200),
  venueCity: optionalTrimmedText(200),
  comment: optionalTrimmedText(10_000),
});
export type CreateBookingInput = z.infer<typeof createBookingInput>;

export const updateBookingInput = z.object({
  bookingId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(200),
  date: dateField,
  venue: z.string().trim().min(1, "Venue is required").max(200),
  notes: optionalTrimmedText(10_000),
  customerName: optionalTrimmedText(200),
  customerEmail: z
    .union([
      z.string().trim().email("Customer email is invalid"),
      z.literal(""),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  customerPhone: optionalTrimmedText(50),
  startTime: startTimeField,
  durationHours: z
    .union([z.coerce.number().int().min(1).max(24), z.nan(), z.literal("")])
    .optional()
    .transform((v) =>
      v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v))
        ? undefined
        : v,
    ),
  venueName: optionalTrimmedText(200),
  venueCity: optionalTrimmedText(200),
  comment: optionalTrimmedText(10_000),
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
  isPublicRequest: z.boolean(),
  createdAt: z.date(),
});
export type BookingListItem = z.infer<typeof bookingListItem>;

// iter-25: widened from 3 to 5 values. `confirmed` + `withdrawn` are reserved
// for iter-29 (squad confirm/decline flow); `requested` is the squad
// participation-request path that already shipped.
export const ASSIGNMENT_STATUSES = [
  "assigned",
  "requested",
  "confirmed",
  "rejected",
  "withdrawn",
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

export const bookingSelectionItem = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  serviceArchived: z.boolean(),
  priceType: z.enum(["fixed", "hourly"]),
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  position: z.number().int().nonnegative(),
});
export type BookingSelectionItem = z.infer<typeof bookingSelectionItem>;

export const bookingDetail = z.object({
  id: z.string(),
  name: z.string(),
  date: z.date(),
  venue: z.string(),
  notes: z.string().nullable(),
  status: z.enum(BOOKING_STATUSES),
  createdBy: z.string().nullable(),
  offerVersion: z.number().int().nonnegative(),
  acceptedAt: z.date().nullable(),
  invoicedAt: z.date().nullable(),
  customerName: z.string().nullable(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  startTime: z.string().nullable(),
  durationHours: z.number().int().nullable(),
  venueName: z.string().nullable(),
  venueCity: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  assignees: z.array(bookingAssignee),
  pendingRequests: z.array(pendingRequest),
  selections: z.array(bookingSelectionItem),
});
export type BookingDetail = z.infer<typeof bookingDetail>;

export const assignableUser = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(["ADMIN", "SQUAD_MEMBER"]),
});
export type AssignableUser = z.infer<typeof assignableUser>;

export const replaceBookingSelectionsInput = z.object({
  bookingId: z.string().min(1),
  selections: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        quantity: z.coerce.number().int().positive().max(10_000),
      }),
    )
    .max(100),
});
export type ReplaceBookingSelectionsInput = z.infer<
  typeof replaceBookingSelectionsInput
>;

export const bookingIdInput = z.object({
  bookingId: z.string().min(1),
});
export type BookingIdInput = z.infer<typeof bookingIdInput>;

export const rejectBookingInput = z.object({
  bookingId: z.string().min(1),
  reason: optionalTrimmedText(2_000),
});
export type RejectBookingInput = z.infer<typeof rejectBookingInput>;

export const cancelBookingInput = z.object({
  bookingId: z.string().min(1),
  reason: optionalTrimmedText(2_000),
});
export type CancelBookingInput = z.infer<typeof cancelBookingInput>;

export const actionResult = z.discriminatedUnion("error", [
  z.object({ error: z.literal(false), message: z.string() }),
  z.object({ error: z.literal(true), message: z.string() }),
]);
export type ActionResult = z.infer<typeof actionResult>;
