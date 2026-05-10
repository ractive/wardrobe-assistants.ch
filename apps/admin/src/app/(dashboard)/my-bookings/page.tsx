import { redirect } from "next/navigation";
import { MyBookingsTable } from "@/features/bookings/components/MyBookingsTable";
import {
  listMyAssignedBookings,
  listMyRequests,
} from "@/features/bookings/server/queries";
import { getCachedSession } from "@/lib/auth";
import { assertPermission } from "@/lib/permissions";

export default async function MyBookingsPage() {
  const session = await getCachedSession();
  if (!session) redirect("/login");

  await assertPermission("SQUAD_VIEW_ASSIGNED");

  const [assignedBookings, requestBookings] = await Promise.all([
    listMyAssignedBookings(session.user.id),
    listMyRequests(session.user.id),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-semibold text-2xl md:text-3xl">My Bookings</h1>
        <p className="text-[var(--muted-foreground)] text-sm">
          Bookings you are assigned to and your participation requests.
        </p>
      </header>

      <section
        aria-labelledby="assigned-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="assigned-heading" className="font-medium text-lg md:text-xl">
          Assigned to you
        </h2>
        <MyBookingsTable
          bookings={assignedBookings}
          emptyMessage="You have no assigned bookings yet."
        />
      </section>

      <section
        aria-labelledby="requests-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="requests-heading" className="font-medium text-lg md:text-xl">
          Your requests
        </h2>
        <MyBookingsTable
          bookings={requestBookings}
          emptyMessage="You have no pending or rejected requests."
        />
      </section>
    </section>
  );
}
