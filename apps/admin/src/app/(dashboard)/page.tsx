import "server-only";
import {
  bookingAssignments,
  bookings,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { CalendarClock, MailPlus, Receipt, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { HasPermission } from "@/components/HasPermission";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { RecentBookingsTable } from "@/components/RecentBookingsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getCachedSession, roleForUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { userHasPermission } from "@/lib/permissions";

const VALID_STATUSES = [
  "created",
  "offered",
  "accepted",
  "rejected",
  "cancelled",
] as const;
type BookingStatus = (typeof VALID_STATUSES)[number];

function parseBookingStatus(value: string): BookingStatus {
  if (!VALID_STATUSES.includes(value as BookingStatus)) {
    throw new Error(`Unexpected booking status: ${value}`);
  }
  return value as BookingStatus;
}

async function fetchUpcomingBookingCount(): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: count() })
    .from(bookings)
    .where(gte(bookings.date, startOfToday));
  return rows[0]?.count ?? 0;
}

async function fetchActiveSquadCount(): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(userProfile)
    .where(inArray(userProfile.role, ["ADMIN", "SQUAD_MEMBER"]));
  return rows[0]?.count ?? 0;
}

async function fetchRecentBookings() {
  const rows = await db
    .select({
      id: bookings.id,
      name: bookings.name,
      date: bookings.date,
      status: bookings.status,
      assigneeCount: sql<number>`(
        SELECT COUNT(*) FROM ${bookingAssignments}
        WHERE ${bookingAssignments.bookingId} = ${bookings.id}
      )`,
    })
    .from(bookings)
    .orderBy(desc(bookings.date))
    .limit(5);

  return rows.map((r) => ({
    id: r.id,
    title: r.name,
    startAt: r.date,
    status: parseBookingStatus(r.status),
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

  // Role-based redirect: squad members go to their primary view.
  const role = await roleForUserId(session.user.id);
  if (role === "SQUAD_MEMBER") {
    redirect("/my-bookings");
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

  // Fetch KPI data and recent bookings in parallel, gated by permission so users
  // who lack the relevant permission don't trigger unused DB reads.
  const [canViewBookings, canInviteUsers] = await Promise.all([
    userHasPermission("BOOKING_VIEW"),
    userHasPermission("USER_INVITE"),
  ]);

  const [upcomingCount, squadCount, recentBookings] = await Promise.all([
    canViewBookings ? fetchUpcomingBookingCount() : Promise.resolve(null),
    canInviteUsers ? fetchActiveSquadCount() : Promise.resolve(null),
    canViewBookings ? fetchRecentBookings() : Promise.resolve(null),
  ]);

  return (
    <section className="flex flex-col gap-8">
      <PageHeader title="Overview" description={`Welcome back, ${greeting}`} />

      {/* KPI grid: 1 col mobile → 2×2 md → 4×1 xl */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HasPermission perm="BOOKING_VIEW">
          <KpiCard
            title="Upcoming bookings"
            value={upcomingCount ?? "—"}
            icon={CalendarClock}
            description="Bookings scheduled from today"
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

        <HasPermission perm="BOOKING_VIEW">
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

      {/* Recent bookings */}
      <HasPermission perm="BOOKING_VIEW">
        <section aria-labelledby="recent-bookings-heading">
          <h2
            id="recent-bookings-heading"
            className="mb-4 text-lg font-semibold"
          >
            Recent bookings
          </h2>
          <RecentBookingsTable bookings={recentBookings ?? []} />
        </section>
      </HasPermission>
    </section>
  );
}
