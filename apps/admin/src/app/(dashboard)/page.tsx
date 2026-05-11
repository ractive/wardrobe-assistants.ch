import "server-only";
import {
  bookingAssignments,
  bookings,
  userProfile,
} from "@wardrobe-assistants/db/schema";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { CalendarClock, CalendarPlus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HasPermission } from "@/components/HasPermission";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { RecentBookingsTable } from "@/components/RecentBookingsTable";
import { Button } from "@/components/ui/button";
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

async function fetchNewRequestsCount(): Promise<number> {
  const rows = await db
    .select({ cnt: count() })
    .from(bookings)
    .where(and(eq(bookings.status, "created"), isNull(bookings.createdBy)));
  return rows[0]?.cnt ?? 0;
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
  const [canViewBookings, canViewUsers] = await Promise.all([
    userHasPermission("BOOKING_VIEW"),
    userHasPermission("USER_INVITE"),
  ]);

  const [newRequestsCount, upcomingCount, squadCount, recentBookings] =
    await Promise.all([
      canViewBookings ? fetchNewRequestsCount() : Promise.resolve(null),
      canViewBookings ? fetchUpcomingBookingCount() : Promise.resolve(null),
      canViewUsers ? fetchActiveSquadCount() : Promise.resolve(null),
      canViewBookings ? fetchRecentBookings() : Promise.resolve(null),
    ]);

  // Empty state: zero bookings, zero new requests, zero squad members → welcome
  const showWelcome =
    canViewBookings &&
    newRequestsCount === 0 &&
    upcomingCount === 0 &&
    (recentBookings?.length ?? 0) === 0;

  return (
    <section className="flex flex-col gap-8">
      <PageHeader title="Overview" description={`Welcome back, ${greeting}`} />

      {/* KPI grid: 1 col mobile → 2×2 md → 3×1 xl */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HasPermission perm="BOOKING_VIEW">
          <KpiCard
            title="New requests"
            value={newRequestsCount ?? "—"}
            icon={CalendarPlus}
            description="Customer-submitted bookings awaiting review"
            href="/bookings?status=new-requests"
          />
        </HasPermission>

        <HasPermission perm="BOOKING_VIEW">
          <KpiCard
            title="Upcoming bookings"
            value={upcomingCount ?? "—"}
            icon={CalendarClock}
            description="Bookings scheduled from today"
            href="/bookings?status=upcoming"
          />
        </HasPermission>

        <HasPermission perm="USER_INVITE">
          <KpiCard
            title="Active squad"
            value={squadCount ?? "—"}
            icon={Users}
            description="Admins and squad members"
            href="/users"
          />
        </HasPermission>
      </div>

      {/* Welcome panel for first-time / empty state */}
      {showWelcome && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-medium">Get started</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No bookings yet. Here are two ways to kick things off:
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild>
              <Link href="/bookings">Create a booking</Link>
            </Button>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                Share the public booking-request URL
              </p>
              <p className="break-all text-xs text-muted-foreground">
                https://wardrobe-assistants.ch/booking-request
              </p>
            </div>
          </div>
        </div>
      )}

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
