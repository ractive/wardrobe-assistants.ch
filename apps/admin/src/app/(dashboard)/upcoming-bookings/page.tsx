import { redirect } from "next/navigation";
import { UpcomingBookingsList } from "@/features/bookings/components/UpcomingBookingsList";
import { listUpcomingBookingsForRequest } from "@/features/bookings/server/queries";
import { getCachedSession } from "@/lib/auth";
import { assertPermission } from "@/lib/permissions";

export default async function UpcomingBookingsPage() {
  const session = await getCachedSession();
  if (!session) redirect("/login");

  await assertPermission("SQUAD_REQUEST_PARTICIPATION");

  const bookings = await listUpcomingBookingsForRequest(session.user.id);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-semibold text-2xl md:text-3xl">
          Upcoming Bookings
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm">
          Published upcoming bookings you can request to participate in.
        </p>
      </header>
      <UpcomingBookingsList bookings={bookings} />
    </section>
  );
}
