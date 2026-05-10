import "server-only";
import {
  eventAssignments,
  events,
  user,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { and, asc, desc, eq, gte, notExists, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import {
  type AssignableUser,
  assignableUser,
  type EventDetail,
  eventDetail,
  eventListItem,
  type MyEventListItem,
  myEventListItem,
  type UpcomingEventForRequest,
  upcomingEventForRequest,
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

export async function listEvents() {
  // iter-16f / C-SEC-09: query is a security boundary on its own.
  await assertPermission("EVENT_VIEW");
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      venue: events.venue,
      status: events.status,
      createdAt: events.createdAt,
      assigneesCount: sql<number>`(
        SELECT COUNT(*) FROM ${eventAssignments}
        WHERE ${eventAssignments.eventId} = ${events.id}
          AND ${eventAssignments.status} = 'assigned'
      )`,
    })
    .from(events)
    .orderBy(desc(events.date));

  return rows.map((r) =>
    eventListItem.parse({
      id: r.id,
      name: r.name,
      date: r.date,
      venue: r.venue,
      status: r.status,
      assigneesCount: Number(r.assigneesCount ?? 0),
      createdAt: r.createdAt,
    }),
  );
}

export async function getEventById(id: string): Promise<EventDetail | null> {
  await assertPermission("EVENT_VIEW");
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const assigneeRows = await db
    .select({
      userId: eventAssignments.userId,
      assignedAt: eventAssignments.assignedAt,
      status: eventAssignments.status,
      email: user.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      nickname: userProfile.nickname,
    })
    .from(eventAssignments)
    .innerJoin(user, eq(user.id, eventAssignments.userId))
    .innerJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(eventAssignments.eventId, id))
    .orderBy(asc(eventAssignments.assignedAt));

  const activeAssignees = assigneeRows.filter((a) => a.status === "assigned");
  const requestRows = assigneeRows.filter((a) => a.status === "requested");

  return eventDetail.parse({
    id: row.id,
    name: row.name,
    date: row.date,
    venue: row.venue,
    notes: row.notes,
    status: row.status,
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
  });
}

export async function listAssignableUsers(): Promise<AssignableUser[]> {
  await assertPermission("EVENT_ASSIGN");
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

export async function listMyAssignedEvents(
  userId: string,
): Promise<MyEventListItem[]> {
  await assertPermission("SQUAD_VIEW_ASSIGNED");
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      venue: events.venue,
      status: events.status,
      assignmentStatus: eventAssignments.status,
      createdAt: events.createdAt,
    })
    .from(eventAssignments)
    .innerJoin(events, eq(events.id, eventAssignments.eventId))
    .where(eq(eventAssignments.userId, userId))
    .orderBy(desc(events.date));

  // Only return rows with status="assigned" (the caller of listMyRequests
  // handles requested/rejected). Filter after the join to keep one query.
  return rows
    .filter((r) => r.assignmentStatus === "assigned")
    .map((r) =>
      myEventListItem.parse({
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
): Promise<MyEventListItem[]> {
  await assertPermission("SQUAD_VIEW_ASSIGNED");
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      venue: events.venue,
      status: events.status,
      assignmentStatus: eventAssignments.status,
      createdAt: events.createdAt,
    })
    .from(eventAssignments)
    .innerJoin(events, eq(events.id, eventAssignments.eventId))
    .where(eq(eventAssignments.userId, userId))
    .orderBy(desc(events.date));

  return rows
    .filter(
      (r) =>
        r.assignmentStatus === "requested" || r.assignmentStatus === "rejected",
    )
    .map((r) =>
      myEventListItem.parse({
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

export async function listUpcomingEventsForRequest(
  userId: string,
): Promise<UpcomingEventForRequest[]> {
  await assertPermission("SQUAD_REQUEST_PARTICIPATION");
  const now = new Date();

  // Events that are published, in the future, and the user has NO existing
  // assignment row (regardless of its status — we don't want to show events
  // already assigned or already requested).
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      venue: events.venue,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(
      and(
        eq(events.status, "published"),
        gte(events.date, now),
        notExists(
          db
            .select({ _: sql`1` })
            .from(eventAssignments)
            .where(
              and(
                eq(eventAssignments.eventId, events.id),
                eq(eventAssignments.userId, userId),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(events.date));

  return rows.map((r) =>
    upcomingEventForRequest.parse({
      id: r.id,
      name: r.name,
      date: r.date,
      venue: r.venue,
      createdAt: r.createdAt,
    }),
  );
}

export async function listPendingRequestsCountByEvent(): Promise<
  Map<string, number>
> {
  await assertPermission("EVENT_APPROVE_REQUEST");
  const rows = await db
    .select({
      eventId: eventAssignments.eventId,
      cnt: sql<number>`count(*)`,
    })
    .from(eventAssignments)
    .where(eq(eventAssignments.status, "requested"))
    .groupBy(eventAssignments.eventId);

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.eventId, Number(r.cnt));
  }
  return map;
}
