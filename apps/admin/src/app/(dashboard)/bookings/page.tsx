import { redirect } from "next/navigation";
import { NoPermissionCard } from "@/components/NoPermissionCard";
import { CreateBookingDialog } from "@/features/bookings/components/BookingDialog";
import { BookingsTable } from "@/features/bookings/components/BookingsTable";
import {
  listBookings,
  listPendingRequestsCountByBooking,
} from "@/features/bookings/server/queries";
import { getCachedSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";

export default async function BookingsPage() {
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

  const canCreate = await userHasPermission("BOOKING_CREATE");
  const canApproveRequests = await userHasPermission("BOOKING_APPROVE_REQUEST");

  const [bookings, pendingRequestsCountByBooking] = await Promise.all([
    listBookings(),
    canApproveRequests
      ? listPendingRequestsCountByBooking()
      : Promise.resolve(undefined),
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
      <BookingsTable
        bookings={bookings}
        pendingRequestsCountByBooking={pendingRequestsCountByBooking}
      />
    </section>
  );
}
