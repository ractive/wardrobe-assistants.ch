import { redirect } from "next/navigation";
import { MyEventsTable } from "@/features/events/components/MyEventsTable";
import {
  listMyAssignedEvents,
  listMyRequests,
} from "@/features/events/server/queries";
import { getCachedSession } from "@/lib/auth";
import { assertPermission } from "@/lib/permissions";

export default async function MyEventsPage() {
  const session = await getCachedSession();
  if (!session) redirect("/login");

  await assertPermission("SQUAD_VIEW_ASSIGNED");

  const [assignedEvents, requestEvents] = await Promise.all([
    listMyAssignedEvents(session.user.id),
    listMyRequests(session.user.id),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-semibold text-2xl md:text-3xl">My Events</h1>
        <p className="text-[var(--muted-foreground)] text-sm">
          Events you are assigned to and your participation requests.
        </p>
      </header>

      <section
        aria-labelledby="assigned-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="assigned-heading" className="font-medium text-lg md:text-xl">
          Assigned to you
        </h2>
        <MyEventsTable
          events={assignedEvents}
          emptyMessage="You have no assigned events yet."
        />
      </section>

      <section
        aria-labelledby="requests-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="requests-heading" className="font-medium text-lg md:text-xl">
          Your requests
        </h2>
        <MyEventsTable
          events={requestEvents}
          emptyMessage="You have no pending or rejected requests."
        />
      </section>
    </section>
  );
}
