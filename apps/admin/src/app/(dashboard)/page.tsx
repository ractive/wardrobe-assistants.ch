import "server-only";
import {
  eventAssignments,
  events,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { CalendarClock, MailPlus, Receipt, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { HasPermission } from "@/components/HasPermission";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { RecentEventsTable } from "@/components/RecentEventsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getCachedSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/permissions";

const VALID_STATUSES = ["draft", "published", "cancelled", "done"] as const;
type EventStatus = (typeof VALID_STATUSES)[number];

function parseEventStatus(value: string): EventStatus {
  if (!VALID_STATUSES.includes(value as EventStatus)) {
    throw new Error(`Unexpected event status: ${value}`);
  }
  return value as EventStatus;
}

async function fetchUpcomingEventCount(): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: count() })
    .from(events)
    .where(gte(events.date, startOfToday));
  return rows[0]?.count ?? 0;
}

async function fetchActiveSquadCount(): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(userProfile)
    .where(inArray(userProfile.role, ["ADMIN", "SQUAD_MEMBER"]));
  return rows[0]?.count ?? 0;
}

async function fetchRecentEvents() {
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      date: events.date,
      status: events.status,
      assigneeCount: sql<number>`(
        SELECT COUNT(*) FROM ${eventAssignments}
        WHERE ${eventAssignments.eventId} = ${events.id}
      )`,
    })
    .from(events)
    .orderBy(desc(events.date))
    .limit(5);

  return rows.map((r) => ({
    id: r.id,
    title: r.name,
    startAt: r.date,
    status: parseEventStatus(r.status),
    assigneeCount: Number(r.assigneeCount ?? 0),
  }));
}

function buildGreeting(
  profile: {
    nickname: string | null;
    firstName: string;
    lastName: string;
  } | null,
  email: string,
): string {
  if (profile?.nickname?.trim()) return profile.nickname.trim();
  if (profile?.firstName?.trim()) return profile.firstName.trim();
  return email;
}

export default async function DashboardHome() {
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  // Fetch the user's profile for the greeting fallback chain:
  // nickname → firstName → email
  const profileRows = await db
    .select({
      nickname: userProfile.nickname,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
    })
    .from(userProfile)
    .where(eq(userProfile.userId, session.user.id))
    .limit(1);

  const profile = profileRows[0] ?? null;
  const greeting = buildGreeting(profile, session.user.email);

  // Fetch KPI data and recent events in parallel, gated by permission so users
  // who lack the relevant permission don't trigger unused DB reads.
  const [canViewEvents, canInviteUsers] = await Promise.all([
    userHasPermission("EVENT_VIEW"),
    userHasPermission("USER_INVITE"),
  ]);

  const [upcomingCount, squadCount, recentEvents] = await Promise.all([
    canViewEvents ? fetchUpcomingEventCount() : Promise.resolve(null),
    canInviteUsers ? fetchActiveSquadCount() : Promise.resolve(null),
    canViewEvents ? fetchRecentEvents() : Promise.resolve(null),
  ]);

  return (
    <section className="flex flex-col gap-8">
      <PageHeader title="Overview" description={`Welcome back, ${greeting}`} />

      {/* KPI grid: 1 col mobile → 2×2 md → 4×1 xl */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HasPermission perm="EVENT_VIEW">
          <KpiCard
            title="Upcoming events"
            value={upcomingCount ?? "—"}
            icon={CalendarClock}
            description="Events scheduled from today"
          />
        </HasPermission>

        <HasPermission perm="USER_INVITE">
          <KpiCard
            title="Active squad"
            value={squadCount ?? "—"}
            icon={Users}
            description="Admins and squad members"
          />
        </HasPermission>

        <HasPermission perm="EVENT_VIEW">
          <KpiCard
            title="Open invoices"
            value="—"
            icon={Receipt}
            description="Invoice tracking lands in iter-22"
          />
        </HasPermission>

        <HasPermission perm="USER_INVITE">
          <KpiCard
            title="Pending invites"
            value="—"
            icon={MailPlus}
            description="Invite tracking lands in iter-22"
          />
        </HasPermission>
      </div>

      {/* Activity chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Charts land in iter-22</EmptyTitle>
              <EmptyDescription>
                Activity charts arrive with the invoice flow (iter-22).
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>

      {/* Recent events */}
      <HasPermission perm="EVENT_VIEW">
        <section aria-labelledby="recent-events-heading">
          <h2 id="recent-events-heading" className="mb-4 text-lg font-semibold">
            Recent events
          </h2>
          <RecentEventsTable events={recentEvents ?? []} />
        </section>
      </HasPermission>
    </section>
  );
}
