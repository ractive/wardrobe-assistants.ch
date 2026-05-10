import { redirect } from "next/navigation";
import { UpcomingEventsList } from "@/features/events/components/UpcomingEventsList";
import { listUpcomingEventsForRequest } from "@/features/events/server/queries";
import { getCachedSession } from "@/lib/auth";
import { assertPermission } from "@/lib/permissions";

export default async function UpcomingEventsPage() {
  const session = await getCachedSession();
  if (!session) redirect("/login");

  await assertPermission("SQUAD_REQUEST_PARTICIPATION");

  const events = await listUpcomingEventsForRequest(session.user.id);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-semibold text-2xl md:text-3xl">Upcoming Events</h1>
        <p className="text-[var(--muted-foreground)] text-sm">
          Published upcoming events you can request to participate in.
        </p>
      </header>
      <UpcomingEventsList events={events} />
    </section>
  );
}
