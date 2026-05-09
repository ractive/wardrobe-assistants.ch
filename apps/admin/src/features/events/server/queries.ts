import "server-only";
import {
  eventAssignments,
  events,
  user,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  type AssignableUser,
  assignableUser,
  type EventDetail,
  eventDetail,
  eventListItem,
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
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const assigneeRows = await db
    .select({
      userId: eventAssignments.userId,
      assignedAt: eventAssignments.assignedAt,
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

  return eventDetail.parse({
    id: row.id,
    name: row.name,
    date: row.date,
    venue: row.venue,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignees: assigneeRows.map((a) => ({
      userId: a.userId,
      email: a.email,
      displayName: buildDisplayName({
        firstName: a.firstName,
        lastName: a.lastName,
        nickname: a.nickname,
      }),
      assignedAt: a.assignedAt,
    })),
  });
}

export async function listAssignableUsers(): Promise<AssignableUser[]> {
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
