import "server-only";
import {
  bookingAssignments,
  bookingServiceSelection,
  bookings,
  services,
  user,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { and, asc, desc, eq, gte, notExists, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import {
  type AssignableUser,
  assignableUser,
  type BookingDetail,
  bookingDetail,
  bookingListItem,
  type MyBookingListItem,
  myBookingListItem,
  type UpcomingBookingForRequest,
  upcomingBookingForRequest,
} from "../schema";

function buildDisplayName(input: {
  firstName: string;
  lastName: string;
  nickname: string | null;
}): string {
  const trimmedNickname = input.nickname?.trim();
  if (trimmedNickname) return trimmedNickname;
  return `${input.firstName} ${input.lastName}`.trim();
}

export async function listBookings() {
  // iter-16f / C-SEC-09: query is a security boundary on its own.
  await assertPermission("BOOKING_VIEW");
  const rows = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      date: bookings.date,
      venue: bookings.venue,
      status: bookings.status,
      createdBy: bookings.createdBy,
      createdAt: bookings.createdAt,
      assigneesCount: sql<number>`(
        SELECT COUNT(*) FROM ${bookingAssignments}
        WHERE ${bookingAssignments.bookingId} = ${bookings.id}
          AND ${bookingAssignments.status} = 'assigned'
      )`,
    })
    .from(bookings)
    .orderBy(desc(bookings.date));

  return rows.map((r) =>
    bookingListItem.parse({
      id: r.id,
      name: r.name,
      date: r.date,
      venue: r.venue,
      status: r.status,
      assigneesCount: Number(r.assigneesCount ?? 0),
      isPublicRequest: r.createdBy === null,
      createdAt: r.createdAt,
    }),
  );
}

export async function getBookingById(
  id: string,
): Promise<BookingDetail | null> {
  await assertPermission("BOOKING_VIEW");
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const assigneeRows = await db
    .select({
      userId: bookingAssignments.userId,
      assignedAt: bookingAssignments.assignedAt,
      status: bookingAssignments.status,
      email: user.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      nickname: userProfile.nickname,
    })
    .from(bookingAssignments)
    .innerJoin(user, eq(user.id, bookingAssignments.userId))
    .innerJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(bookingAssignments.bookingId, id))
    .orderBy(asc(bookingAssignments.assignedAt));

  const activeAssignees = assigneeRows.filter(
    (a) => a.status === "assigned" || a.status === "confirmed",
  );
  const requestRows = assigneeRows.filter((a) => a.status === "requested");

  const selectionRows = await db
    .select({
      id: bookingServiceSelection.id,
      serviceId: bookingServiceSelection.serviceId,
      serviceName: services.name,
      serviceArchived: services.archived,
      priceType: services.priceType,
      unitPriceCents: services.price,
      quantity: bookingServiceSelection.quantity,
      position: bookingServiceSelection.position,
    })
    .from(bookingServiceSelection)
    .innerJoin(services, eq(services.id, bookingServiceSelection.serviceId))
    .where(eq(bookingServiceSelection.bookingId, id))
    .orderBy(asc(bookingServiceSelection.position));

  return bookingDetail.parse({
    id: row.id,
    name: row.name,
    date: row.date,
    venue: row.venue,
    notes: row.notes,
    status: row.status,
    createdBy: row.createdBy,
    offerVersion: row.offerVersion,
    acceptedAt: row.acceptedAt,
    invoicedAt: row.invoicedAt,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    startTime: row.startTime,
    durationHours: row.durationHours,
    venueName: row.venueName,
    venueCity: row.venueCity,
    comment: row.comment,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignees: activeAssignees.map((a) => ({
      userId: a.userId,
      email: a.email,
      displayName: buildDisplayName({
        firstName: a.firstName,
        lastName: a.lastName,
        nickname: a.nickname,
      }),
      assignedAt: a.assignedAt,
      status: a.status,
    })),
    pendingRequests: requestRows.map((a) => ({
      userId: a.userId,
      email: a.email,
      displayName: buildDisplayName({
        firstName: a.firstName,
        lastName: a.lastName,
        nickname: a.nickname,
      }),
      requestedAt: a.assignedAt,
    })),
    selections: selectionRows.map((s) => ({
      id: s.id,
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      serviceArchived: s.serviceArchived,
      priceType: s.priceType,
      unitPriceCents: s.unitPriceCents,
      quantity: s.quantity,
      position: s.position,
    })),
  });
}

export async function listAssignableUsers(): Promise<AssignableUser[]> {
  await assertPermission("BOOKING_ASSIGN");
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      nickname: userProfile.nickname,
      role: userProfile.role,
    })
    .from(user)
    .innerJoin(userProfile, eq(userProfile.userId, user.id))
    .orderBy(asc(userProfile.firstName), asc(userProfile.lastName));

  return rows.map((r) =>
    assignableUser.parse({
      id: r.id,
      email: r.email,
      displayName: buildDisplayName({
        firstName: r.firstName,
        lastName: r.lastName,
        nickname: r.nickname,
      }),
      role: r.role,
    }),
  );
}

// Squad-member queries — gated by squad-specific permissions.

export async function listMyAssignedBookings(
  userId: string,
): Promise<MyBookingListItem[]> {
  await assertPermission("SQUAD_VIEW_ASSIGNED");
  const rows = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      date: bookings.date,
      venue: bookings.venue,
      status: bookings.status,
      assignmentStatus: bookingAssignments.status,
      createdAt: bookings.createdAt,
    })
    .from(bookingAssignments)
    .innerJoin(bookings, eq(bookings.id, bookingAssignments.bookingId))
    .where(eq(bookingAssignments.userId, userId))
    .orderBy(desc(bookings.date));

  return rows
    .filter(
      (r) =>
        r.assignmentStatus === "assigned" || r.assignmentStatus === "confirmed",
    )
    .map((r) =>
      myBookingListItem.parse({
        id: r.id,
        name: r.name,
        date: r.date,
        venue: r.venue,
        status: r.status,
        assignmentStatus: r.assignmentStatus,
        createdAt: r.createdAt,
      }),
    );
}

export async function listMyRequests(
  userId: string,
): Promise<MyBookingListItem[]> {
  await assertPermission("SQUAD_VIEW_ASSIGNED");
  const rows = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      date: bookings.date,
      venue: bookings.venue,
      status: bookings.status,
      assignmentStatus: bookingAssignments.status,
      createdAt: bookings.createdAt,
    })
    .from(bookingAssignments)
    .innerJoin(bookings, eq(bookings.id, bookingAssignments.bookingId))
    .where(eq(bookingAssignments.userId, userId))
    .orderBy(desc(bookings.date));

  return rows
    .filter(
      (r) =>
        r.assignmentStatus === "requested" || r.assignmentStatus === "rejected",
    )
    .map((r) =>
      myBookingListItem.parse({
        id: r.id,
        name: r.name,
        date: r.date,
        venue: r.venue,
        status: r.status,
        assignmentStatus: r.assignmentStatus,
        createdAt: r.createdAt,
      }),
    );
}

export async function listUpcomingBookingsForRequest(
  userId: string,
): Promise<UpcomingBookingForRequest[]> {
  await assertPermission("SQUAD_REQUEST_PARTICIPATION");
  const now = new Date();

  // iter-25: squad members can request participation on bookings that have
  // been accepted (the new equivalent of the old `published` state). Future
  // dates only; only when the user has no existing assignment row.
  const rows = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      date: bookings.date,
      venue: bookings.venue,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "accepted"),
        gte(bookings.date, now),
        notExists(
          db
            .select({ _: sql`1` })
            .from(bookingAssignments)
            .where(
              and(
                eq(bookingAssignments.bookingId, bookings.id),
                eq(bookingAssignments.userId, userId),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(bookings.date));

  return rows.map((r) =>
    upcomingBookingForRequest.parse({
      id: r.id,
      name: r.name,
      date: r.date,
      venue: r.venue,
      createdAt: r.createdAt,
    }),
  );
}

export async function listPendingRequestsCountByBooking(): Promise<
  Map<string, number>
> {
  await assertPermission("BOOKING_APPROVE_REQUEST");
  const rows = await db
    .select({
      bookingId: bookingAssignments.bookingId,
      cnt: sql<number>`count(*)`,
    })
    .from(bookingAssignments)
    .where(eq(bookingAssignments.status, "requested"))
    .groupBy(bookingAssignments.bookingId);

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.bookingId, Number(r.cnt));
  }
  return map;
}
