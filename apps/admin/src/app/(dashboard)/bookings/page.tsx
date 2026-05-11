import { redirect } from "next/navigation";
import { NoPermissionCard } from "@/components/NoPermissionCard";
import { CreateBookingDialog } from "@/features/bookings/components/BookingDialog";
import { BookingsStatusTabs } from "@/features/bookings/components/BookingsStatusTabs";
import { BookingsTable } from "@/features/bookings/components/BookingsTable";
import {
  type BookingStatusFilter,
  countNewRequests,
  listBookings,
  listPendingRequestsCountByBooking,
} from "@/features/bookings/server/queries";
import { getCachedSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";

const VALID_FILTERS: BookingStatusFilter[] = [
  "new-requests",
  "offered",
  "accepted",
  "upcoming",
  "cancelled",
  "all",
];

function parseFilter(raw: string | undefined): BookingStatusFilter {
  if (raw && (VALID_FILTERS as string[]).includes(raw)) {
    return raw as BookingStatusFilter;
  }
  return "all";
}

function emptyStateCopy(filter: BookingStatusFilter): string {
  switch (filter) {
    case "new-requests":
      return "Nothing waiting on you. Customer-submitted bookings show up here.";
    case "offered":
      return "No bookings with a pending offer right now.";
    case "accepted":
      return "No accepted bookings yet.";
    case "upcoming":
      return "No upcoming accepted bookings.";
    case "cancelled":
      return "No cancelled or rejected bookings.";
    case "all":
      return "No bookings yet. Create your first booking to start scheduling the squad.";
  }
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getCachedSession();
  if (!session) redirect("/login");

  const canView = await userHasPermission("BOOKING_VIEW");
  if (!canView) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">Bookings</h1>
        <NoPermissionCard />
      </section>
    );
  }

  const params = await searchParams;
  const rawStatus = params.status;
  const activeFilter = parseFilter(
    Array.isArray(rawStatus) ? rawStatus[0] : rawStatus,
  );

  const canCreate = await userHasPermission("BOOKING_CREATE");
  const canApproveRequests = await userHasPermission("BOOKING_APPROVE_REQUEST");

  const [bookingsList, pendingRequestsCountByBooking, newRequestsCount] =
    await Promise.all([
      listBookings(activeFilter),
      canApproveRequests
        ? listPendingRequestsCountByBooking()
        : Promise.resolve(undefined),
      countNewRequests(),
    ]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-semibold text-2xl md:text-3xl">Bookings</h1>
          <p className="text-[var(--muted-foreground)] text-sm">
            Schedule bookings, assign squad members, and message assignees.
          </p>
        </div>
        {canCreate && <CreateBookingDialog />}
      </header>

      <BookingsStatusTabs
        activeFilter={activeFilter}
        newRequestsCount={newRequestsCount}
      />

      {bookingsList.length === 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
          {emptyStateCopy(activeFilter)}
        </div>
      ) : (
        <BookingsTable
          bookings={bookingsList}
          pendingRequestsCountByBooking={pendingRequestsCountByBooking}
        />
      )}
    </section>
  );
}
